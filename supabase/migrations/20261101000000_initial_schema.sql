-- Run with the Supabase CLI or a privileged database connection. Application
-- writes use the authenticated user's JWT; the service key is never a client key.
begin;

create table public.establishments (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 160),
  contact_name text,
  phone text,
  address text,
  access_email text not null check (char_length(btrim(access_email)) between 3 and 254),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index establishments_access_email_key
  on public.establishments (lower(btrim(access_email)));

create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  full_name text,
  role text not null check (role in ('admin', 'establishment')),
  establishment_id uuid unique references public.establishments (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint profiles_role_establishment_check check (
    (role = 'admin' and establishment_id is null)
    or (role = 'establishment' and establishment_id is not null)
  )
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique not null,
  establishment_id uuid not null references public.establishments (id) on delete restrict,
  quantity integer not null check (quantity between 1 and 100000),
  unit_price numeric(8, 2) not null default 20.00 check (unit_price = 20.00),
  total_price numeric(14, 2) generated always as (quantity::numeric * unit_price) stored not null,
  delivery_date date not null,
  notes text check (notes is null or char_length(notes) <= 1000),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id) on delete restrict,
  constraint orders_delivery_date_supported_check check (
    isfinite(delivery_date)
    and delivery_date between date '0001-01-01' and date '9999-12-31'
  ),
  constraint orders_cancellation_pair_check check (
    (cancelled_at is null and cancelled_by is null)
    or (cancelled_at is not null and cancelled_by is not null)
  )
);

create index orders_establishment_history_idx
  on public.orders (establishment_id, created_at desc, order_number desc);
create index orders_delivery_date_idx on public.orders (delivery_date, establishment_id);
create index orders_active_delivery_idx on public.orders (delivery_date)
  include (quantity, total_price) where cancelled_at is null;
create index profiles_role_idx on public.profiles (role);

-- These predicates bypass RLS to avoid recursive profile policies. Every object
-- is schema-qualified and search_path is empty to prevent object substitution.
create function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create function public.current_establishment_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select p.establishment_id
  from public.profiles p
  join public.establishments e on e.id = p.establishment_id
  where p.id = auth.uid() and p.role = 'establishment' and e.active;
$$;

create function public.touch_establishment()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.created_at := old.created_at;
  end if;
  new.name := btrim(new.name);
  new.access_email := lower(btrim(new.access_email));
  new.updated_at := now();
  return new;
end;
$$;

create trigger establishments_touch
before insert or update on public.establishments
for each row execute function public.touch_establishment();

create function public.enforce_order_integrity()
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
    if new.cancelled_at is not null then
      if new.quantity is distinct from old.quantity
         or new.delivery_date is distinct from old.delivery_date
         or new.notes is distinct from old.notes then
        raise exception using errcode = '23514', message = 'O cancelamento deve preservar os dados originais do pedido.';
      end if;
      new.cancelled_at := now();
    end if;
  end if;

  -- A past delivery date remains valid in historical rows. Validate it only
  -- when creating an order or changing that date, never when cancelling one.
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

create trigger orders_enforce_integrity
before insert or update on public.orders
for each row execute function public.enforce_order_integrity();

alter table public.establishments enable row level security;
alter table public.profiles enable row level security;
alter table public.orders enable row level security;

create policy establishments_read on public.establishments
for select to authenticated
using ((select public.is_admin()) or id = (select public.current_establishment_id()));

create policy establishments_admin_insert on public.establishments
for insert to authenticated with check ((select public.is_admin()));

create policy establishments_admin_update on public.establishments
for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

-- A blocked user can inspect only their own profile so the server can explain
-- why access was disabled. They have no access to establishment/order data.
create policy profiles_read on public.profiles
for select to authenticated using (id = (select auth.uid()) or (select public.is_admin()));

create policy profiles_admin_insert on public.profiles
for insert to authenticated with check ((select public.is_admin()));

create policy profiles_admin_update on public.profiles
for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

create policy orders_read on public.orders
for select to authenticated
using ((select public.is_admin()) or establishment_id = (select public.current_establishment_id()));

-- There are intentionally no client INSERT/UPDATE/DELETE policies on orders.
-- Narrow RPCs assign authorship, price and cancellation details on the server.
create function public.create_order(
  p_quantity integer,
  p_delivery_date date,
  p_establishment_id uuid default null,
  p_notes text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_establishment_id uuid;
  v_id uuid;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'Entre na sua conta para registrar um pedido.';
  end if;

  -- Serialize creation with changes to this account's role or establishment.
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

  -- Lock the row until commit, serializing order creation with deactivation.
  perform 1 from public.establishments
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

  insert into public.orders (establishment_id, quantity, delivery_date, notes, created_by)
  values (v_establishment_id, p_quantity, p_delivery_date, nullif(btrim(p_notes), ''), v_uid)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.update_order(
  p_order_id uuid,
  p_quantity integer,
  p_delivery_date date,
  p_notes text default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
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

  update public.orders
  set quantity = p_quantity, delivery_date = p_delivery_date, notes = nullif(btrim(p_notes), '')
  where id = p_order_id and cancelled_at is null;
  if not found then
    raise exception using errcode = 'P0002', message = 'Pedido não encontrado ou já cancelado.';
  end if;
end;
$$;

create function public.cancel_order(p_order_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform 1 from public.profiles where id = auth.uid() for share;
  if not public.is_admin() then
    raise exception using errcode = '42501', message = 'Somente administradores podem cancelar pedidos.';
  end if;

  update public.orders
  set cancelled_at = now(), cancelled_by = auth.uid()
  where id = p_order_id and cancelled_at is null;
  if not found then
    raise exception using errcode = 'P0002', message = 'Pedido não encontrado ou já cancelado.';
  end if;
end;
$$;

revoke all on public.establishments, public.profiles, public.orders from public, anon, authenticated;
grant select, insert, update on public.establishments, public.profiles to authenticated;
grant select on public.orders to authenticated;
grant all on public.establishments, public.profiles, public.orders to service_role;
revoke all on sequence public.orders_order_number_seq from public, anon, authenticated;
grant all on sequence public.orders_order_number_seq to service_role;

revoke all on function public.is_admin() from public, anon;
revoke all on function public.current_establishment_id() from public, anon;
revoke all on function public.touch_establishment() from public, anon, authenticated;
revoke all on function public.enforce_order_integrity() from public, anon, authenticated;
revoke all on function public.create_order(integer, date, uuid, text) from public, anon;
revoke all on function public.update_order(uuid, integer, date, text) from public, anon;
revoke all on function public.cancel_order(uuid) from public, anon;
grant execute on function public.is_admin(), public.current_establishment_id() to authenticated, service_role;
grant execute on function public.create_order(integer, date, uuid, text),
  public.update_order(uuid, integer, date, text), public.cancel_order(uuid) to authenticated;

comment on table public.orders is 'Pedidos confirmados automaticamente; cancelamentos preservam o histórico.';
comment on column public.orders.delivery_date is 'Data civil de entrega; regras calculadas em America/Sao_Paulo.';
comment on column public.orders.total_price is 'Calculado no PostgreSQL; não pode ser fornecido pelo cliente.';

commit;
