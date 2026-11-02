-- Delivery address is a snapshot of the order; the estimate is assigned later
-- by the family. Existing cancelled history must remain unchanged.
begin;

alter table public.orders
  add column delivery_address text,
  add column delivery_estimate text,
  add constraint orders_delivery_address_length_check check (
    delivery_address is null or char_length(btrim(delivery_address, E' \t\n\r\f' || chr(11))) between 1 and 500
  ),
  add constraint orders_delivery_estimate_length_check check (
    delivery_estimate is null or char_length(btrim(delivery_estimate, E' \t\n\r\f' || chr(11))) between 1 and 120
  );

-- Only today/future uncancelled orders with a known, valid address are backfilled.
-- Unknown addresses remain NULL; do not manufacture or truncate history.
update public.orders o
set delivery_address = btrim(e.address, E' \t\n\r\f' || chr(11))
from public.establishments e
where o.establishment_id = e.id
  and o.cancelled_at is null
  and o.delivery_date >= (now() at time zone 'America/Sao_Paulo')::date
  and char_length(btrim(e.address, E' \t\n\r\f' || chr(11))) between 1 and 500;

create or replace function public.enforce_order_integrity()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.cancelled_at is not null or new.cancelled_by is not null then
      raise exception using errcode = '23514', message = 'Um novo pedido precisa estar confirmado.';
    end if;
    new.unit_price := 20.00;
    new.created_at := now();
    new.delivery_address := btrim(new.delivery_address, E' \t\n\r\f' || chr(11));
    if new.delivery_address is null or char_length(new.delivery_address) not between 1 and 500 then
      raise exception using errcode = '23514', message = 'Informe um endereço de entrega com até 500 caracteres.';
    end if;
    if new.delivery_estimate is not null then
      raise exception using errcode = '23514', message = 'A previsão de entrega será informada pela administração após a confirmação.';
    end if;
  else
    if old.cancelled_at is not null then
      raise exception using errcode = '23514', message = 'Pedidos cancelados preservam o histórico e não podem ser alterados.';
    end if;
    if new.id is distinct from old.id
       or new.order_number is distinct from old.order_number
       or new.establishment_id is distinct from old.establishment_id
       or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at
       or new.unit_price is distinct from old.unit_price then
      raise exception using errcode = '23514', message = 'A identificação, a autoria e o preço do pedido são imutáveis.';
    end if;

    new.delivery_address := btrim(new.delivery_address, E' \t\n\r\f' || chr(11));
    new.delivery_estimate := nullif(btrim(new.delivery_estimate, E' \t\n\r\f' || chr(11)), '');

    if new.cancelled_at is not null then
      if new.quantity is distinct from old.quantity
         or new.delivery_date is distinct from old.delivery_date
         or new.notes is distinct from old.notes
         or new.delivery_address is distinct from old.delivery_address
         or new.delivery_estimate is distinct from old.delivery_estimate then
        raise exception using errcode = '23514', message = 'O cancelamento deve preservar os dados originais do pedido.';
      end if;
      new.cancelled_at := now();
    elsif new.delivery_date is distinct from old.delivery_date
       or new.delivery_address is distinct from old.delivery_address then
      -- A forecast for the previous date or place must not survive this change.
      new.delivery_estimate := null;
    end if;
  end if;

  if tg_op = 'INSERT' then
    if new.delivery_date < (now() at time zone 'America/Sao_Paulo')::date then
      raise exception using errcode = '23514', message = 'A data de entrega não pode estar no passado.';
    end if;
  elsif new.delivery_date is distinct from old.delivery_date then
    if new.delivery_date < (now() at time zone 'America/Sao_Paulo')::date then
      raise exception using errcode = '23514', message = 'A data de entrega não pode estar no passado.';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

-- Replace rather than overload: positional calls with the previous four
-- arguments still resolve through the default fifth argument.
drop function public.create_order(integer, date, uuid, text);
create function public.create_order(
  p_quantity integer,
  p_delivery_date date,
  p_establishment_id uuid default null,
  p_notes text default null,
  p_delivery_address text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_establishment_id uuid;
  v_default_address text;
  v_delivery_address text;
  v_id uuid;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'Entre na sua conta para registrar um pedido.';
  end if;
  perform 1 from public.profiles where id = v_uid for share;

  if public.is_admin() then
    if p_establishment_id is null then
      raise exception using errcode = '22023', message = 'Selecione o estabelecimento.';
    end if;
    v_establishment_id := p_establishment_id;
  else
    v_establishment_id := public.current_establishment_id();
    if v_establishment_id is null
       or (p_establishment_id is not null and p_establishment_id <> v_establishment_id) then
      raise exception using errcode = '42501', message = 'Seu estabelecimento não tem permissão para registrar este pedido.';
    end if;
  end if;

  -- Also locks the default address while this snapshot is being created.
  select address into v_default_address from public.establishments
  where id = v_establishment_id and active for share;
  if not found then
    raise exception using errcode = '42501', message = 'O estabelecimento está inativo ou não foi encontrado.';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 100000 then
    raise exception using errcode = '23514', message = 'Informe uma quantidade entre 1 e 100.000 queijos.';
  end if;
  if p_delivery_date is null then
    raise exception using errcode = '23514', message = 'Informe a data de entrega.';
  end if;

  v_delivery_address := btrim(coalesce(p_delivery_address, v_default_address), E' \t\n\r\f' || chr(11));
  if v_delivery_address is null or char_length(v_delivery_address) not between 1 and 500 then
    raise exception using errcode = '23514', message = 'Informe um endereço de entrega com até 500 caracteres.';
  end if;

  insert into public.orders (establishment_id, quantity, delivery_date, notes, created_by, delivery_address)
  values (v_establishment_id, p_quantity, p_delivery_date, nullif(btrim(p_notes), ''), v_uid, v_delivery_address)
  returning id into v_id;
  return v_id;
end;
$$;

drop function public.update_order(uuid, integer, date, text);
create function public.update_order(
  p_order_id uuid,
  p_quantity integer,
  p_delivery_date date,
  p_notes text default null,
  p_delivery_address text default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_delivery_address text;
begin
  perform 1 from public.profiles where id = auth.uid() for share;
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Somente administradores podem editar pedidos.';
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 100000 then
    raise exception using errcode = '23514', message = 'Informe uma quantidade entre 1 e 100.000 queijos.';
  end if;
  if p_delivery_date is null then
    raise exception using errcode = '23514', message = 'Informe a data de entrega.';
  end if;
  if p_delivery_address is not null then
    v_delivery_address := btrim(p_delivery_address, E' \t\n\r\f' || chr(11));
    if char_length(v_delivery_address) not between 1 and 500 then
      raise exception using errcode = '23514', message = 'Informe um endereço de entrega com até 500 caracteres.';
    end if;
  end if;

  update public.orders
  set quantity = p_quantity,
      delivery_date = p_delivery_date,
      notes = nullif(btrim(p_notes), ''),
      delivery_address = coalesce(v_delivery_address, delivery_address)
  where id = p_order_id and cancelled_at is null;
  if not found then
    raise exception using errcode = 'P0002', message = 'Pedido não encontrado ou já cancelado.';
  end if;
end;
$$;

create function public.set_delivery_estimate(
  p_order_id uuid,
  p_estimate text,
  p_expected_updated_at timestamptz
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_estimate text := nullif(btrim(p_estimate, E' \t\n\r\f' || chr(11)), '');
begin
  perform 1 from public.profiles where id = auth.uid() for share;
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Somente administradores podem informar a previsão de entrega.';
  end if;
  if p_expected_updated_at is null then
    raise exception using errcode = '22023', message = 'Atualize a página para obter a versão atual do pedido.';
  end if;
  if char_length(v_estimate) > 120 then
    raise exception using errcode = '23514', message = 'A previsão de entrega deve ter até 120 caracteres.';
  end if;

  -- PostgREST accepts the exact updated_at text returned by the last read;
  -- clients must not truncate its microseconds through a JavaScript Date.
  update public.orders set delivery_estimate = v_estimate
  where id = p_order_id and cancelled_at is null and updated_at = p_expected_updated_at;
  if not found then
    if exists (select 1 from public.orders where id = p_order_id and cancelled_at is null) then
      raise exception using errcode = '40001', message = 'O pedido foi alterado. Atualize a página antes de salvar a previsão.';
    end if;
    raise exception using errcode = 'P0002', message = 'Pedido não encontrado ou já cancelado.';
  end if;
end;
$$;
revoke all on function public.create_order(integer, date, uuid, text, text) from public, anon;
revoke all on function public.update_order(uuid, integer, date, text, text) from public, anon;
revoke all on function public.set_delivery_estimate(uuid, text, timestamptz) from public, anon;
grant execute on function public.create_order(integer, date, uuid, text, text),
  public.update_order(uuid, integer, date, text, text),
  public.set_delivery_estimate(uuid, text, timestamptz) to authenticated;

comment on column public.orders.delivery_address is 'Endereço confirmado neste pedido. NULL somente para histórico legado sem endereço conhecido.';
comment on column public.orders.delivery_estimate is 'Previsão informada pela família; limpa automaticamente quando data ou endereço mudam.';

notify pgrst, 'reload schema';
commit;