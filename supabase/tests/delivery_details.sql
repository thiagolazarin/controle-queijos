-- Apply all migrations first. Run as postgres only on a disposable development
-- database: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/delivery_details.sql
-- Tests real PostgreSQL RLS, triggers and RPCs; all fixtures roll back.
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

create function pg_temp.authenticate(p_id uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
end;
$$;

-- Round-trip the exact database text as PostgREST/UI callers do; keep microseconds.
create function pg_temp.order_version(p_id uuid)
returns timestamptz language sql as $$
  select updated_at::text::timestamptz from public.orders where id=p_id;
$$;
insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('a2000000-0000-4000-8000-000000000001','authenticated','authenticated','delivery-admin@example.invalid','',now(),now(),now()),
  ('a2000000-0000-4000-8000-000000000002','authenticated','authenticated','delivery-client-a@example.invalid','',now(),now(),now()),
  ('a2000000-0000-4000-8000-000000000003','authenticated','authenticated','delivery-client-b@example.invalid','',now(),now(),now());
insert into public.establishments (id,name,access_email,address)
values
  ('e2000000-0000-4000-8000-000000000001','Padaria entrega A','delivery-client-a@example.invalid','  Rua da Família, 10  '),
  ('e2000000-0000-4000-8000-000000000002','Mercado sem endereço','delivery-client-b@example.invalid',null);
insert into public.profiles (id,role,establishment_id)
values
  ('a2000000-0000-4000-8000-000000000001','admin',null),
  ('a2000000-0000-4000-8000-000000000002','establishment','e2000000-0000-4000-8000-000000000001'),
  ('a2000000-0000-4000-8000-000000000003','establishment','e2000000-0000-4000-8000-000000000002');

select pg_temp.assert_true(
  to_regprocedure('public.create_order(integer,date,uuid,text)') is null
  and to_regprocedure('public.create_order(integer,date,uuid,text,text)') is not null,
  'Creation RPC has one unambiguous signature with an optional fifth argument');
select pg_temp.assert_true(
  to_regprocedure('public.update_order(uuid,integer,date,text)') is null
  and to_regprocedure('public.update_order(uuid,integer,date,text,text)') is not null,
  'Update RPC has one unambiguous signature with an optional fifth argument');

select pg_temp.assert_true(
  to_regprocedure('public.set_delivery_estimate(uuid,text)') is null
  and to_regprocedure('public.set_delivery_estimate(uuid,text,timestamptz)') is not null,
  'Estimate RPC requires an explicit version and has no obsolete overload');
set local role authenticated;
select pg_temp.authenticate('a2000000-0000-4000-8000-000000000002');
-- An old caller omitting the optional address receives a real saved-address snapshot.
select set_config('test.delivery_fallback', public.create_order(
  2, (now() at time zone 'America/Sao_Paulo')::date + 1, null, 'Portão azul'
)::text, true);
select pg_temp.assert_true((
  select delivery_address = 'Rua da Família, 10' and delivery_estimate is null and total_price = 40
  from public.orders where id = current_setting('test.delivery_fallback')::uuid
), 'New order snapshots the saved address, keeps backend price and has no estimate');

select pg_temp.assert_raises(
  $$select public.create_order(1,current_date+1,null,null,'   ')$$,
  '23514','An explicitly empty address is rejected instead of silently using the default');
select pg_temp.assert_raises(
  $$select public.create_order(1,current_date+1,null,null,E' \t\n ')$$,
  '23514','Whitespace-only delivery address is rejected');
select pg_temp.assert_raises(
  $$select public.create_order(1,current_date+1,null,null,repeat('x',501))$$,
  '23514','Delivery address over 500 characters is rejected');
select pg_temp.assert_raises(
  $$select public.create_order(p_quantity=>1,p_delivery_date=>current_date+1,p_estimate=>'8h')$$,
  '42883','Creation RPC does not accept a client-supplied estimate');
select pg_temp.assert_raises(
  $$select public.set_delivery_estimate(current_setting('test.delivery_fallback')::uuid,'8h',pg_temp.order_version(current_setting('test.delivery_fallback')::uuid))$$,
  '42501','Client cannot set their own delivery estimate');
select pg_temp.assert_raises(
  $$update public.orders set delivery_estimate='8h' where id=current_setting('test.delivery_fallback')::uuid$$,
  '42501','Direct client updates cannot bypass estimate authorization');

select set_config('test.delivery_override', public.create_order(
  3, (now() at time zone 'America/Sao_Paulo')::date + 1, null, null, '  Rua da Feira, 20  '
)::text, true);
select pg_temp.assert_true((
  select delivery_address='Rua da Feira, 20' and delivery_estimate is null
  from public.orders where id=current_setting('test.delivery_override')::uuid
), 'Client can confirm a different, trimmed delivery address');
select pg_temp.assert_true((
  select address='  Rua da Família, 10  ' from public.establishments where id='e2000000-0000-4000-8000-000000000001'
), 'Order override does not change establishment registration');

select pg_temp.authenticate('a2000000-0000-4000-8000-000000000003');
select pg_temp.assert_raises(
  $$select public.create_order(1,current_date+1)$$,
  '23514','No saved address means a new order must supply a delivery address');
select set_config('test.delivery_no_default',public.create_order(1,current_date+1,null,null,'Rua do Mercado, 30')::text,true);
select pg_temp.assert_true((
  select delivery_address='Rua do Mercado, 30' from public.orders where id=current_setting('test.delivery_no_default')::uuid
), 'Client without a saved address can explicitly confirm a valid delivery address');
select pg_temp.assert_true((
  select count(*)=0 from public.orders where id=current_setting('test.delivery_fallback')::uuid
), 'Another client cannot read the delivery address snapshot or estimate');

select pg_temp.authenticate('a2000000-0000-4000-8000-000000000001');
select pg_temp.assert_raises(
  $$select public.set_delivery_estimate(current_setting('test.delivery_fallback')::uuid,'8h',null)$$,
  '22023','An estimate requires the version read by the administrator');
select pg_temp.assert_raises(
  $$select public.set_delivery_estimate(current_setting('test.delivery_fallback')::uuid,'8h')$$,
  '42883','Callers cannot omit the mandatory expected version');
update public.establishments set address='Rua do Cadastro Novo, 40' where id='e2000000-0000-4000-8000-000000000001';
select pg_temp.assert_true((
  select delivery_address='Rua da Família, 10' from public.orders where id=current_setting('test.delivery_fallback')::uuid
), 'Editing the establishment address never rewrites an existing order snapshot');
select set_config('test.delivery_new_default', public.create_order(
  1,current_date+1,'e2000000-0000-4000-8000-000000000001'
)::text,true);
select pg_temp.assert_true((
  select delivery_address='Rua do Cadastro Novo, 40' from public.orders where id=current_setting('test.delivery_new_default')::uuid
), 'A subsequent manual order uses the current registration as its new snapshot');

select public.set_delivery_estimate(current_setting('test.delivery_fallback')::uuid,'  Entre 8h e 10h  ',pg_temp.order_version(current_setting('test.delivery_fallback')::uuid));
select pg_temp.assert_true((
  select delivery_estimate='Entre 8h e 10h' from public.orders where id=current_setting('test.delivery_fallback')::uuid
), 'Admin saves a trimmed delivery estimate');
select public.update_order(current_setting('test.delivery_fallback')::uuid,4,
  (now() at time zone 'America/Sao_Paulo')::date+1,'Quantidade corrigida');
select pg_temp.assert_true((
  select delivery_address='Rua da Família, 10' and delivery_estimate='Entre 8h e 10h' and total_price=80
  from public.orders where id=current_setting('test.delivery_fallback')::uuid
), 'Old four-argument edit preserves the snapshot and estimate while updating quantity/notes');
select public.update_order(current_setting('test.delivery_fallback')::uuid,4,
  (now() at time zone 'America/Sao_Paulo')::date+1,null,'  Rua da Família, 10  ');
select pg_temp.assert_true((
  select delivery_estimate='Entre 8h e 10h' from public.orders where id=current_setting('test.delivery_fallback')::uuid
), 'Reconfirming the same trimmed address does not invalidate an estimate');

select public.update_order(current_setting('test.delivery_fallback')::uuid,4,
  (now() at time zone 'America/Sao_Paulo')::date+1,null,'Rua da Entrega Corrigida, 50');
select pg_temp.assert_true((
  select delivery_address='Rua da Entrega Corrigida, 50' and delivery_estimate is null
  from public.orders where id=current_setting('test.delivery_fallback')::uuid
), 'Changing the delivery address clears the stale estimate');
select public.set_delivery_estimate(current_setting('test.delivery_fallback')::uuid,'À tarde',pg_temp.order_version(current_setting('test.delivery_fallback')::uuid));
select public.update_order(current_setting('test.delivery_fallback')::uuid,4,
  (now() at time zone 'America/Sao_Paulo')::date+2);
select pg_temp.assert_true((
  select delivery_estimate is null and delivery_address='Rua da Entrega Corrigida, 50'
  from public.orders where id=current_setting('test.delivery_fallback')::uuid
), 'Changing the delivery date clears the stale estimate and preserves the address');

-- now() is constant in this transactional suite. An earlier captured version is
-- represented by a one-second older timestamp, not by disabling integrity rules.
select pg_temp.assert_raises(
  $$select public.set_delivery_estimate(current_setting('test.delivery_fallback')::uuid,'Previsão da data antiga',pg_temp.order_version(current_setting('test.delivery_fallback')::uuid)-interval '1 second')$$,
  '40001','A stale form cannot reintroduce the estimate after the delivery date changes');
select pg_temp.assert_true((
  select delivery_estimate is null from public.orders where id=current_setting('test.delivery_fallback')::uuid
), 'Rejected stale estimate leaves the new delivery date without a forecast');
select public.set_delivery_estimate(current_setting('test.delivery_fallback')::uuid,'Previsão atual',pg_temp.order_version(current_setting('test.delivery_fallback')::uuid));
select pg_temp.assert_raises(
  $$select public.set_delivery_estimate(current_setting('test.delivery_fallback')::uuid,'Sobrescrita antiga',pg_temp.order_version(current_setting('test.delivery_fallback')::uuid)-interval '1 second')$$,
  '40001','An earlier version cannot overwrite a newer forecast');
select pg_temp.assert_raises(
  $$select public.set_delivery_estimate(current_setting('test.delivery_fallback')::uuid,'Versão imprecisa',pg_temp.order_version(current_setting('test.delivery_fallback')::uuid)-interval '1 microsecond')$$,
  '40001','Optimistic comparison preserves full timestamp microsecond precision');
select pg_temp.assert_true((
  select delivery_estimate='Previsão atual' from public.orders where id=current_setting('test.delivery_fallback')::uuid
), 'Rejected stale writes preserve the current forecast');


select public.set_delivery_estimate(current_setting('test.delivery_fallback')::uuid,repeat('x',120),pg_temp.order_version(current_setting('test.delivery_fallback')::uuid));
select pg_temp.assert_true((
  select char_length(delivery_estimate)=120 from public.orders where id=current_setting('test.delivery_fallback')::uuid
), 'A 120-character estimate is valid');
select pg_temp.assert_raises(
  $$select public.set_delivery_estimate(current_setting('test.delivery_fallback')::uuid,repeat('x',121),pg_temp.order_version(current_setting('test.delivery_fallback')::uuid))$$,
  '23514','Estimate over 120 characters is rejected');
select pg_temp.assert_true((
  select char_length(delivery_estimate)=120 from public.orders where id=current_setting('test.delivery_fallback')::uuid
), 'A failed estimate update preserves the previous estimate');
select public.set_delivery_estimate(current_setting('test.delivery_fallback')::uuid,E' \t\n ',pg_temp.order_version(current_setting('test.delivery_fallback')::uuid));
select pg_temp.assert_true((
  select delivery_estimate is null from public.orders where id=current_setting('test.delivery_fallback')::uuid
), 'A blank estimate explicitly clears the forecast');
select public.set_delivery_estimate(current_setting('test.delivery_fallback')::uuid,'Pela manhã',pg_temp.order_version(current_setting('test.delivery_fallback')::uuid));
select public.set_delivery_estimate(current_setting('test.delivery_fallback')::uuid,null,pg_temp.order_version(current_setting('test.delivery_fallback')::uuid));
select pg_temp.assert_true((
  select delivery_estimate is null from public.orders where id=current_setting('test.delivery_fallback')::uuid
), 'Explicit NULL clears the estimate with the current version');
select pg_temp.assert_raises(
  $$select public.set_delivery_estimate('f2000000-0000-4000-8000-000000000099','8h',now())$$,
  'P0002','Estimate requires an existing confirmed order');
select pg_temp.assert_raises(
  $$select public.update_order(current_setting('test.delivery_fallback')::uuid,4,current_date+2,null,' ')$$,
  '23514','An admin cannot erase the address with an empty string');
select pg_temp.assert_raises(
  $$select public.update_order(current_setting('test.delivery_fallback')::uuid,4,current_date+2,null,repeat('x',501))$$,
  '23514','An admin cannot save an oversized address');

select public.set_delivery_estimate(current_setting('test.delivery_fallback')::uuid,'Depois das 14h',pg_temp.order_version(current_setting('test.delivery_fallback')::uuid));
select pg_temp.authenticate('a2000000-0000-4000-8000-000000000002');
select pg_temp.assert_true((
  select delivery_estimate='Depois das 14h' from public.orders where id=current_setting('test.delivery_fallback')::uuid
), 'Client sees the estimate set by the family');
select pg_temp.authenticate('a2000000-0000-4000-8000-000000000001');
select public.cancel_order(current_setting('test.delivery_fallback')::uuid);
select pg_temp.assert_true((
  select cancelled_at is not null and delivery_address='Rua da Entrega Corrigida, 50' and delivery_estimate='Depois das 14h'
  from public.orders where id=current_setting('test.delivery_fallback')::uuid
), 'Cancellation preserves the confirmed address and estimate in history');
select pg_temp.assert_raises(
  $$select public.set_delivery_estimate(current_setting('test.delivery_fallback')::uuid,'8h',pg_temp.order_version(current_setting('test.delivery_fallback')::uuid))$$,
  'P0002','Even admin cannot change a cancelled order estimate');
select pg_temp.assert_raises(
  $$select public.update_order(current_setting('test.delivery_fallback')::uuid,4,current_date+2,null,'Outro local')$$,
  'P0002','Even admin cannot change a cancelled order address');

reset role;
select pg_temp.assert_raises(
  $$update public.orders set delivery_address='Outro local' where id=current_setting('test.delivery_fallback')::uuid$$,
  '23514','Table trigger protects cancelled address against accidental privileged updates');
select pg_temp.assert_raises(
  $$update public.orders set delivery_estimate='8h' where id=current_setting('test.delivery_fallback')::uuid$$,
  '23514','Table trigger protects cancelled estimate against accidental privileged updates');
select pg_temp.assert_raises(
  $$insert into public.orders(establishment_id,quantity,delivery_date,created_by)
    values('e2000000-0000-4000-8000-000000000001',1,current_date+1,'a2000000-0000-4000-8000-000000000001')$$,
  '23514','Table trigger requires an address even on direct privileged inserts');
select pg_temp.assert_raises(
  $$insert into public.orders(establishment_id,quantity,delivery_date,created_by,delivery_address,delivery_estimate)
    values('e2000000-0000-4000-8000-000000000001',1,current_date+1,'a2000000-0000-4000-8000-000000000001','Rua confirmada','8h')$$,
  '23514','New orders cannot start with a preassigned estimate');

-- Emulate an older order whose address was never known; it must remain editable
-- and cancellable without inventing a historical address or moving its date.
alter table public.orders disable trigger orders_enforce_integrity;
update public.orders set delivery_date=(now() at time zone 'America/Sao_Paulo')::date-1,delivery_address=null
where id=current_setting('test.delivery_override')::uuid;
alter table public.orders enable trigger orders_enforce_integrity;
set local role authenticated;
select pg_temp.authenticate('a2000000-0000-4000-8000-000000000001');
select public.update_order(current_setting('test.delivery_override')::uuid,5,
  (now() at time zone 'America/Sao_Paulo')::date-1,'Correção de registro antigo');
select pg_temp.assert_true((
  select delivery_address is null and quantity=5 and delivery_date=(now() at time zone 'America/Sao_Paulo')::date-1
  from public.orders where id=current_setting('test.delivery_override')::uuid
), 'Legacy unknown address stays unknown when an admin corrects historical quantity');
select public.set_delivery_estimate(current_setting('test.delivery_override')::uuid,'Combinado com o responsável',pg_temp.order_version(current_setting('test.delivery_override')::uuid));
select public.cancel_order(current_setting('test.delivery_override')::uuid);
select pg_temp.assert_true((
  select cancelled_at is not null and delivery_address is null and delivery_estimate='Combinado com o responsável'
  from public.orders where id=current_setting('test.delivery_override')::uuid
), 'Historical cancellation preserves unknown address and the existing estimate');

reset role;
set local role anon;
select pg_temp.assert_raises(
  $$select public.set_delivery_estimate(current_setting('test.delivery_fallback')::uuid,'8h',now())$$,
  '42501','Anonymous callers cannot execute delivery-estimate RPC');

rollback;
\echo 'PASS: delivery snapshots, address validation, estimate permissions, invalidation and cancelled history.'