-- Keep the establishment's login e-mail in the same transaction as Supabase
-- Auth. Updating the same Auth e-mail also repairs an existing mirror mismatch.
begin;

create function public.sync_establishment_access_email()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.establishments e
  set access_email = lower(btrim(new.email))
  from public.profiles p
  where p.id = new.id
    and p.role = 'establishment'
    and e.id = p.establishment_id
    and e.access_email is distinct from lower(btrim(new.email));
  return new;
end;
$$;

revoke all on function public.sync_establishment_access_email() from public, anon, authenticated;

create trigger auth_user_email_sync
  after update of email on auth.users
  for each row execute function public.sync_establishment_access_email();

-- The server checks this before changing Auth so an incomplete deployment
-- cannot silently create divergence. Only the server's service role can call it.
create function public.access_email_sync_ready()
returns boolean
language sql stable set search_path = ''
as $$
  select exists (
    select 1
    from pg_catalog.pg_trigger t
    join pg_catalog.pg_attribute a on a.attrelid = t.tgrelid and a.attname = 'email'
    where t.tgrelid = 'auth.users'::pg_catalog.regclass
      and t.tgname = 'auth_user_email_sync'
      and not t.tgisinternal
      and t.tgenabled in ('O', 'A')
      and t.tgtype = 17 -- AFTER UPDATE FOR EACH ROW
      and t.tgfoid = 'public.sync_establishment_access_email()'::pg_catalog.regprocedure
      and pg_catalog.cardinality(t.tgattr::smallint[]) = 1
      and a.attnum = any(t.tgattr)
      and t.tgqual is null
      and t.tgnargs = 0
  );
$$;

revoke all on function public.access_email_sync_ready() from public, anon, authenticated;
grant execute on function public.access_email_sync_ready() to service_role;

comment on function public.sync_establishment_access_email() is
  'Synchronizes the establishment login e-mail atomically after Supabase Auth updates; no historical backfill.';

notify pgrst, 'reload schema';
commit;