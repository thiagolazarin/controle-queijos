-- Run after all migrations as postgres on a disposable Supabase development
-- database: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/access_email.sql
-- Fixtures, temporary role, trigger checks and mirror changes all roll back.
\set ON_ERROR_STOP on
begin;

create function pg_temp.assert_true(p_condition boolean, p_message text)
returns void language plpgsql as $$
begin
  if p_condition is not true then raise exception 'FAIL: %', p_message; end if;
end;
$$;

create function pg_temp.assert_raises(p_sql text, p_sqlstate text, p_message text)
returns void language plpgsql as $$
declare v_code text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate;
    if v_code <> p_sqlstate then
      raise exception 'FAIL: % (expected SQLSTATE %, received %: %)', p_message, p_sqlstate, v_code, sqlerrm;
    end if;
    return;
  end;
  raise exception 'FAIL: % (statement was unexpectedly accepted)', p_message;
end;
$$;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('a5000000-0000-4000-8000-000000000001','authenticated','authenticated','email-admin@example.invalid','',now(),now(),now()),
  ('a5000000-0000-4000-8000-000000000002','authenticated','authenticated','email-client-a@example.invalid','',now(),now(),now()),
  ('a5000000-0000-4000-8000-000000000003','authenticated','authenticated','email-client-b@example.invalid','',now(),now(),now()),
  ('a5000000-0000-4000-8000-000000000004','authenticated','authenticated','email-unlinked@example.invalid','',now(),now(),now());
insert into public.establishments (id,name,access_email,address)
values
  ('e5000000-0000-4000-8000-000000000001','Email A','email-client-a@example.invalid','Rua A'),
  ('e5000000-0000-4000-8000-000000000002','Email B','email-client-b@example.invalid','Rua B');
insert into public.profiles (id,role,establishment_id)
values
  ('a5000000-0000-4000-8000-000000000001','admin',null),
  ('a5000000-0000-4000-8000-000000000002','establishment','e5000000-0000-4000-8000-000000000001'),
  ('a5000000-0000-4000-8000-000000000003','establishment','e5000000-0000-4000-8000-000000000002');

set local role service_role;
select pg_temp.assert_true(public.access_email_sync_ready(), 'Service role can confirm synchronization readiness');
reset role;

set local role anon;
select pg_temp.assert_raises($$select public.access_email_sync_ready()$$,'42501','Anonymous callers cannot access readiness RPC');
select pg_temp.assert_raises($$select public.sync_establishment_access_email()$$,'42501','Anonymous callers cannot execute trigger helper');
select pg_temp.assert_raises($$update auth.users set email='tamper@example.invalid' where id='a5000000-0000-4000-8000-000000000002'$$,'42501','Anonymous callers cannot update Auth e-mails');
reset role;
set local role authenticated;
select pg_temp.assert_raises($$select public.access_email_sync_ready()$$,'42501','Authenticated callers cannot access readiness RPC');
select pg_temp.assert_raises($$select public.sync_establishment_access_email()$$,'42501','Authenticated callers cannot execute trigger helper');
select pg_temp.assert_raises($$update auth.users set email='tamper@example.invalid' where id='a5000000-0000-4000-8000-000000000002'$$,'42501','Application users cannot update Auth e-mails directly');
reset role;

-- This role has only the Auth columns used by its UPDATE. It cannot read or
-- write establishments/profiles; synchronization must use the narrow definer.
create role access_email_test_auth nologin noinherit;
grant usage on schema auth to access_email_test_auth;
grant select (id,email), update (email) on auth.users to access_email_test_auth;
select pg_temp.assert_true(not has_table_privilege('access_email_test_auth','public.establishments','UPDATE'), 'Minimal Auth writer has no establishment write permission');
set local role access_email_test_auth;
update auth.users set email='  EMAIL-NEW@EXAMPLE.INVALID  ' where id='a5000000-0000-4000-8000-000000000002';
reset role;
select pg_temp.assert_true((
  select access_email='email-new@example.invalid' from public.establishments where id='e5000000-0000-4000-8000-000000000001'
), 'Minimal Auth writer synchronizes a trimmed lowercase mirror');
select pg_temp.assert_true((
  select access_email='email-client-b@example.invalid' from public.establishments where id='e5000000-0000-4000-8000-000000000002'
), 'Synchronization touches only the linked establishment');

-- A collision in the mirror must roll back the Auth update itself. Reserve an
-- address only in the mirror so failure comes from its unique index.
update public.establishments set access_email='reserved@example.invalid' where id='e5000000-0000-4000-8000-000000000002';
set local role access_email_test_auth;
select pg_temp.assert_raises(
  $$update auth.users set email='reserved@example.invalid' where id='a5000000-0000-4000-8000-000000000002'$$,
  '23505','A duplicate mirror e-mail rejects the whole Auth update');
reset role;
select pg_temp.assert_true((
  select email='  EMAIL-NEW@EXAMPLE.INVALID  ' from auth.users where id='a5000000-0000-4000-8000-000000000002'
), 'Auth e-mail is unchanged after mirror uniqueness failure');
select pg_temp.assert_true((
  select access_email='email-new@example.invalid' from public.establishments where id='e5000000-0000-4000-8000-000000000001'
), 'Mirror e-mail is unchanged after the rejected transaction');

-- A same-value Auth update repairs an old discrepancy. Once synchronized, it
-- must avoid another table UPDATE (ctid stays stable, as do touch timestamps).
update public.establishments set access_email='old-mismatch@example.invalid' where id='e5000000-0000-4000-8000-000000000001';
set local role access_email_test_auth;
update auth.users set email=email where id='a5000000-0000-4000-8000-000000000002';
reset role;
select pg_temp.assert_true((
  select access_email='email-new@example.invalid' from public.establishments where id='e5000000-0000-4000-8000-000000000001'
), 'A same-value Auth update repairs an existing mirror mismatch');
select set_config('test.email_before_ctid',ctid::text,true) from public.establishments where id='e5000000-0000-4000-8000-000000000001';
set local role access_email_test_auth;
update auth.users set email=email where id='a5000000-0000-4000-8000-000000000002';
reset role;
select pg_temp.assert_true((
  select ctid::text=current_setting('test.email_before_ctid') from public.establishments where id='e5000000-0000-4000-8000-000000000001'
), 'An already synchronized e-mail does not update establishment timestamps');

set local role access_email_test_auth;
update auth.users set email='admin-changed@example.invalid' where id='a5000000-0000-4000-8000-000000000001';
update auth.users set email='unlinked-changed@example.invalid' where id='a5000000-0000-4000-8000-000000000004';
reset role;
select pg_temp.assert_true((
  select count(*)=2 from auth.users where (id='a5000000-0000-4000-8000-000000000001' and email='admin-changed@example.invalid')
    or (id='a5000000-0000-4000-8000-000000000004' and email='unlinked-changed@example.invalid')
), 'Admin and unlinked Auth users can change e-mail without an establishment');
select pg_temp.assert_true((
  select count(*)=2 from public.establishments where (id='e5000000-0000-4000-8000-000000000001' and access_email='email-new@example.invalid')
    or (id='e5000000-0000-4000-8000-000000000002' and access_email='reserved@example.invalid')
), 'Admin and unlinked Auth updates leave establishment mirrors unchanged');

update public.establishments set active=false where id='e5000000-0000-4000-8000-000000000001';
set local role access_email_test_auth;
update auth.users set email='inactive-new@example.invalid' where id='a5000000-0000-4000-8000-000000000002';
reset role;
select pg_temp.assert_true((
  select not active and access_email='inactive-new@example.invalid' from public.establishments where id='e5000000-0000-4000-8000-000000000001'
), 'Inactive establishment e-mail remains synchronized for future reactivation');

alter table auth.users disable trigger auth_user_email_sync;
set local role service_role;
select pg_temp.assert_true(not public.access_email_sync_ready(), 'Disabled synchronization is reported as unavailable');
reset role;
alter table auth.users enable trigger auth_user_email_sync;
set local role service_role;
select pg_temp.assert_true(public.access_email_sync_ready(), 'Re-enabled synchronization is reported as ready');
reset role;

drop trigger auth_user_email_sync on auth.users;
create trigger auth_user_email_sync before update of email on auth.users
for each row execute function public.sync_establishment_access_email();
set local role service_role;
select pg_temp.assert_true(not public.access_email_sync_ready(), 'A trigger with the wrong timing is not accepted as ready');
reset role;

rollback;
\echo 'PASS: atomic Auth e-mail mirror, normalization, repair, least privilege and readiness.'