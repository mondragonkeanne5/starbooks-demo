create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  customer_email text not null,
  subtotal_cents integer not null check (subtotal_cents >= 0),
  status text not null default 'receipt_sent' check (status in ('receipt_sent')),
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  isbn text not null,
  title_snapshot text not null,
  author_snapshot text not null,
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  created_at timestamptz not null default now()
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists order_items_order_id_idx on public.order_items (order_id);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

revoke all on public.orders from anon, authenticated;
revoke all on public.order_items from anon, authenticated;

grant select on public.orders to authenticated;
grant select on public.order_items to authenticated;
grant all on table public.orders to service_role;
grant all on table public.order_items to service_role;

drop policy if exists "Admins can read orders" on public.orders;
create policy "Admins can read orders"
  on public.orders
  for select
  to authenticated
  using ((select public.is_starbooks_admin()));

drop policy if exists "Admins can read order_items" on public.order_items;
create policy "Admins can read order_items"
  on public.order_items
  for select
  to authenticated
  using ((select public.is_starbooks_admin()));

comment on table public.orders is 'Successful Starbooks receipt orders used for the authorized admin reports view.';
comment on table public.order_items is 'Item snapshots for successful Starbooks receipt orders.';
