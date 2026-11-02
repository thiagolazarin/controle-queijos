-- Run after migrations, as postgres, against a disposable Supabase development
-- database: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/security.sql
-- No pgTAP dependency. All fixtures roll back, including temporary auth users.
\set ON_ERROR_STOP on
begin;

create function pg_temp.assert_true(p_condition boolean, p_message text)
returns void language plpgsql as $$
begin
  if p_condition is not true then
    raise exception 'FAIL: %', p_message;
  end if;
end;
$$;

create function pg_temp.assert_raises(p_sql text, p_sqlstate text, p_message text)
returns void language plpgsql as $$
declare
  v_code text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate;
    if v_code <> p_sqlstate then
      raise exception 'FAIL: % (expected SQLSTATE %, received %: %)',
        p_message, p_sqlstate, v_code, sqlerrm;
    end if;
    return;
  end;
  raise exception 'FAIL: % (statement was unexpectedly accepted)', p_message;
end;
$$;

-- This only supplies the claims normally verified and set by Supabase's API.
-- Application callers cannot arbitrarily impersonate these JWTs.
create function pg_temp.authenticate(p_id uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('a1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'admin-test@example.invalid', '', now(), now(), now()),
  ('a1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'client-a-test@example.invalid', '', now(), now(), now()),
  ('a1000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'client-b-test@example.invalid', '', now(), now(), now()),
  ('a1000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'inactive-test@example.invalid', '', now(), now(), now()),
  ('a1000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'no-profile-test@example.invalid', '', now(), now(), now());

-- Only a privileged bootstrap operation may create the very first admin.
insert into public.profiles (id, full_name, role)
values ('a1000000-0000-4000-8000-000000000001', 'Admin teste', 'admin');

set local role authenticated;
select pg_temp.authenticate('a1000000-0000-4000-8000-000000000001');
select pg_temp.assert_true(public.is_admin(), 'Admin profile is recognized');

insert into public.establishments (id, name, access_email, active)
values
  ('e1000000-0000-4000-8000-000000000001', 'Padaria A', 'client-a-test@example.invalid', true),
  ('e1000000-0000-4000-8000-000000000002', 'Mercado B', 'client-b-test@example.invalid', true),
  ('e1000000-0000-4000-8000-000000000003', 'Restaurante inativo', 'inactive-test@example.invalid', false);

insert into public.profiles (id, role, establishment_id)
values
  ('a1000000-0000-4000-8000-000000000002', 'establishment', 'e1000000-0000-4000-8000-000000000001'),
  ('a1000000-0000-4000-8000-000000000003', 'establishment', 'e1000000-0000-4000-8000-000000000002'),
  ('a1000000-0000-4000-8000-000000000004', 'establishment', 'e1000000-0000-4000-8000-000000000003');

-- Real admin manual order, automatically attributed to the admin.
select set_config('test.manual_order', public.create_order(
  5, (now() at time zone 'America/Sao_Paulo')::date + 1,
  'e1000000-0000-4000-8000-000000000002', 'Recebido por telefone'
)::text, true);

select pg_temp.authenticate('a1000000-0000-4000-8000-000000000002');
select pg_temp.assert_true(not public.is_admin(), 'Client is not admin');
select pg_temp.assert_true((select count(*) from public.establishments) = 1, 'Client reads own establishment only');
select pg_temp.assert_true((select count(*) from public.profiles) = 1, 'Client reads own profile only');
select pg_temp.assert_true((select count(*) from public.orders) = 0, 'Client cannot read another establishment manual order');

select set_config('test.client_order', public.create_order(
  10, (now() at time zone 'America/Sao_Paulo')::date + 1
)::text, true);

select pg_temp.assert_true((select count(*) from public.orders) = 1, 'Client order is persisted and visible');
select pg_temp.assert_true((
  select quantity = 10 and unit_price = 20 and total_price = 200
    and created_by = auth.uid() and order_number > 0
    and establishment_id = 'e1000000-0000-4000-8000-000000000001'
  from public.orders where id = current_setting('test.client_order')::uuid
), '10 cheeses cost BRL 200 and authorship/establishment are assigned by the backend');

select pg_temp.assert_raises(
  $$select public.create_order(1, (now() at time zone 'America/Sao_Paulo')::date, 'e1000000-0000-4000-8000-000000000002')$$,
  '42501', 'Client cannot impersonate another establishment');
select pg_temp.assert_raises(
  $$select public.create_order(0, (now() at time zone 'America/Sao_Paulo')::date)$$,
  '23514', 'Zero quantity rejected');
select pg_temp.assert_raises(
  $$select public.create_order(-1, (now() at time zone 'America/Sao_Paulo')::date)$$,
  '23514', 'Negative quantity rejected');
select pg_temp.assert_raises(
  $$select public.create_order(100001, (now() at time zone 'America/Sao_Paulo')::date)$$,
  '23514', 'Quantity above the application limit rejected');
select pg_temp.assert_raises(
  $$select public.create_order(1, (now() at time zone 'America/Sao_Paulo')::date - 1)$$,
  '23514', 'Past Sao Paulo delivery date rejected');
select pg_temp.assert_raises(
  $$select public.create_order(1, null)$$, '23514', 'Missing delivery date rejected');
select pg_temp.assert_raises(
  $$select public.create_order(1, 'infinity'::date)$$,
  '23514', 'Infinite delivery date cannot reach application date formatting');
select pg_temp.assert_raises(
  $$select public.create_order(1, '-infinity'::date)$$,
  '23514', 'Negative infinite delivery date rejected');
select pg_temp.assert_raises(
  $$select public.create_order(1, date '10000-01-01')$$,
  '23514', 'Delivery years outside four digits rejected');
select pg_temp.assert_raises(
  $$select public.create_order(1, (now() at time zone 'America/Sao_Paulo')::date, null, repeat('x', 1001))$$,
  '23514', 'Oversized notes rejected');
select pg_temp.assert_raises(
  $$insert into public.orders (establishment_id, quantity, unit_price, delivery_date, created_by)
    values ('e1000000-0000-4000-8000-000000000001', 1, 0, current_date, auth.uid())$$,
  '42501', 'Direct order insertion / price tampering denied');
select pg_temp.assert_raises(
  $$update public.orders set unit_price = 0 where id = current_setting('test.client_order')::uuid$$,
  '42501', 'Direct order updates denied');
select pg_temp.assert_raises(
  $$delete from public.orders where id = current_setting('test.client_order')::uuid$$,
  '42501', 'Order deletion denied');
select pg_temp.assert_raises(
  $$select public.update_order(current_setting('test.client_order')::uuid, 2, current_date)$$,
  '42501', 'Client edit RPC denied');
select pg_temp.assert_raises(
  $$select public.cancel_order(current_setting('test.client_order')::uuid)$$,
  '42501', 'Client cancel RPC denied');

with changed as (
  update public.profiles set role = 'admin', establishment_id = null
  where id = auth.uid() returning id
)
select pg_temp.assert_true((select count(*) from changed) = 0, 'Client cannot elevate own profile');
select pg_temp.assert_true(not public.is_admin(), 'Self promotion did not take effect');
with changed as (
  update public.establishments set active = false
  where id = 'e1000000-0000-4000-8000-000000000001' returning id
)
select pg_temp.assert_true((select count(*) from changed) = 0, 'Client cannot edit establishment data');
select pg_temp.assert_raises(
  $$insert into public.profiles (id, role) values ('a1000000-0000-4000-8000-000000000005', 'admin')$$,
  '42501', 'Client cannot create another admin');

select pg_temp.authenticate('a1000000-0000-4000-8000-000000000003');
select pg_temp.assert_true((select count(*) from public.orders) = 1, 'Other client sees only own manual order');
select pg_temp.assert_true((
  select created_by = 'a1000000-0000-4000-8000-000000000001'
  from public.orders where id = current_setting('test.manual_order')::uuid
), 'Manual order preserves administrator authorship');

select pg_temp.authenticate('a1000000-0000-4000-8000-000000000004');
select pg_temp.assert_true((select count(*) from public.establishments) = 0, 'Inactive client cannot read establishment data');
select pg_temp.assert_true((select count(*) from public.orders) = 0, 'Inactive client cannot read orders');
select pg_temp.assert_true((select count(*) from public.profiles) = 1, 'Inactive client can read own blocked profile');
select pg_temp.assert_raises(
  $$select public.create_order(1, current_date + 1)$$,
  '42501', 'Inactive establishment cannot create orders');

select pg_temp.authenticate('a1000000-0000-4000-8000-000000000005');
select pg_temp.assert_true((select count(*) from public.orders) = 0, 'User without profile has no orders');
select pg_temp.assert_raises(
  $$select public.create_order(1, current_date + 1)$$,
  '42501', 'User without profile cannot create orders');

select pg_temp.authenticate('a1000000-0000-4000-8000-000000000001');
select pg_temp.assert_true((select count(*) from public.orders) = 2, 'Admin dashboard sees all orders');
select pg_temp.assert_true((
  select sum(quantity) = 15 and sum(total_price) = 300
  from public.orders where cancelled_at is null
    and delivery_date = (now() at time zone 'America/Sao_Paulo')::date + 1
), 'Daily totals sum orders from every establishment');
select public.update_order(current_setting('test.client_order')::uuid, 12,
  (now() at time zone 'America/Sao_Paulo')::date + 1, 'Quantidade corrigida');
select pg_temp.assert_true((
  select quantity = 12 and total_price = 240
    and created_by = 'a1000000-0000-4000-8000-000000000002'
  from public.orders where id = current_setting('test.client_order')::uuid
), 'Admin updates recalculate total and preserve creator');
select pg_temp.assert_raises(
  $$select public.update_order(current_setting('test.client_order')::uuid, 12, (now() at time zone 'America/Sao_Paulo')::date - 1)$$,
  '23514', 'Admin cannot change delivery date to a past date');
select pg_temp.assert_raises(
  $$select public.update_order(current_setting('test.client_order')::uuid, 12, 'infinity'::date)$$,
  '23514', 'Admin cannot change delivery date to infinity');
select pg_temp.assert_raises(
  $$select public.update_order(current_setting('test.client_order')::uuid, 100001, (now() at time zone 'America/Sao_Paulo')::date + 1)$$,
  '23514', 'Admin cannot exceed the quantity limit on edit');
select pg_temp.assert_raises(
  $$select public.update_order(current_setting('test.client_order')::uuid, 12, (now() at time zone 'America/Sao_Paulo')::date + 1, repeat('x', 1001))$$,
  '23514', 'Admin cannot exceed the notes limit on edit');

select public.cancel_order(current_setting('test.client_order')::uuid);
select pg_temp.assert_true((
  select quantity = 12 and total_price = 240 and cancelled_at is not null
    and cancelled_by = auth.uid()
  from public.orders where id = current_setting('test.client_order')::uuid
), 'Cancelled order is preserved with cancellation audit');
select pg_temp.assert_true((
  select sum(quantity) = 5 and sum(total_price) = 100
  from public.orders where cancelled_at is null
), 'Cancelled order is excluded from active totals');
select pg_temp.assert_raises(
  $$select public.update_order(current_setting('test.client_order')::uuid, 99, current_date + 1)$$,
  'P0002', 'Cancelled order cannot be edited through RPC');
select pg_temp.assert_raises(
  $$select public.cancel_order(current_setting('test.client_order')::uuid)$$,
  'P0002', 'Repeated cancellation rejected');
select pg_temp.assert_raises(
  $$delete from public.establishments where id = 'e1000000-0000-4000-8000-000000000001'$$,
  '42501', 'Even admin cannot permanently delete establishments');

-- Deactivation immediately revokes client reads/writes; admin keeps history.
update public.establishments set active = false where id = 'e1000000-0000-4000-8000-000000000002';
select pg_temp.authenticate('a1000000-0000-4000-8000-000000000003');
select pg_temp.assert_true((select count(*) from public.orders) = 0, 'Deactivation revokes existing client session reads');
select pg_temp.assert_raises(
  $$select public.create_order(1, current_date + 1)$$,
  '42501', 'Deactivation revokes existing client session writes');
select pg_temp.authenticate('a1000000-0000-4000-8000-000000000001');
update public.establishments set active = true where id = 'e1000000-0000-4000-8000-000000000002';
select pg_temp.authenticate('a1000000-0000-4000-8000-000000000003');
select pg_temp.assert_true((select count(*) from public.orders) = 1, 'Reactivation restores preserved history');

reset role;
-- The trigger also preserves cancelled history against a privileged accidental update.
select pg_temp.assert_raises(
  $$update public.orders set quantity = 99 where id = current_setting('test.client_order')::uuid$$,
  '23514', 'Cancelled history remains immutable at the table level');
select pg_temp.assert_raises(
  $$delete from auth.users where id = 'a1000000-0000-4000-8000-000000000002'$$,
  '23503', 'Auth user deletion cannot destroy order authorship');

-- Historical rows must remain cancellable after their delivery date passes.
alter table public.orders disable trigger orders_enforce_integrity;
update public.orders set delivery_date = (now() at time zone 'America/Sao_Paulo')::date - 1
where id = current_setting('test.manual_order')::uuid;
alter table public.orders enable trigger orders_enforce_integrity;
set local role authenticated;
select pg_temp.authenticate('a1000000-0000-4000-8000-000000000001');
select public.update_order(current_setting('test.manual_order')::uuid, 6,
  (now() at time zone 'America/Sao_Paulo')::date - 1, 'Correção histórica');
select public.cancel_order(current_setting('test.manual_order')::uuid);
select pg_temp.assert_true((
  select quantity = 6 and total_price = 120 and cancelled_at is not null
  from public.orders where id = current_setting('test.manual_order')::uuid
), 'Admin can edit quantity and cancel historical orders without moving their delivery date');

reset role;
set local role anon;
select pg_temp.assert_raises($$select * from public.orders$$, '42501', 'Anonymous order reads denied');
select pg_temp.assert_raises($$select * from public.profiles$$, '42501', 'Anonymous profile reads denied');
select pg_temp.assert_raises($$select * from public.establishments$$, '42501', 'Anonymous establishment reads denied');
select pg_temp.assert_raises(
  $$select public.create_order(1, current_date + 1)$$, '42501', 'Anonymous RPC invocation denied');

rollback;
\echo 'PASS: permissions, ownership, calculation, dates, manual orders, cancellation and history.'
