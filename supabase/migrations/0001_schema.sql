-- HASH Bistro — schema
create extension if not exists pgcrypto;

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ─── Catalog ────────────────────────────────────────────────────────────────
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  slug text not null unique,
  name text not null,
  description text,
  ingredients text,
  allergens text[] not null default '{}',
  weight_label text,
  price numeric(8,2) not null check (price >= 0),
  promo_price numeric(8,2) check (promo_price is null or promo_price >= 0),
  promo_label text,
  image_url text,
  available boolean not null default true,
  featured boolean not null default false,
  is_new boolean not null default false,
  sort int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_category_idx on public.products(category_id, sort);
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

create table public.product_option_groups (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  required boolean not null default false,
  multi boolean not null default false,
  min_select int not null default 0,
  max_select int not null default 1,
  sort int not null default 0
);
create index pog_product_idx on public.product_option_groups(product_id, sort);

create table public.product_option_items (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.product_option_groups(id) on delete cascade,
  name text not null,
  price_delta numeric(8,2) not null default 0,
  default_selected boolean not null default false,
  available boolean not null default true,
  sort int not null default 0
);
create index poi_group_idx on public.product_option_items(group_id, sort);

-- ─── Meniul zilei ───────────────────────────────────────────────────────────
create table public.daily_menus (
  id uuid primary key default gen_random_uuid(),
  menu_date date not null unique,
  title text not null,
  description text,
  price numeric(8,2) not null,
  image_url text,
  published boolean not null default true,
  available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger daily_menus_updated_at before update on public.daily_menus
  for each row execute function public.set_updated_at();

-- ─── Clienți ────────────────────────────────────────────────────────────────
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  name text not null default '',
  email text,
  auth_user_id uuid unique references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);
create index customers_email_idx on public.customers(lower(email));

create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  label text not null default 'Acasă',
  street text not null,
  details text,
  city text not null default 'București',
  lat double precision,
  lng double precision,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index addr_customer_idx on public.customer_addresses(customer_id);

-- ─── Personal ───────────────────────────────────────────────────────────────
create table public.staff (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text not null default 'staff' check (role in ('admin','manager','staff')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ─── Comenzi ────────────────────────────────────────────────────────────────
create sequence public.order_number_seq start 1001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint not null default nextval('public.order_number_seq') unique,
  customer_id uuid references public.customers(id) on delete set null,
  type text not null check (type in ('delivery','pickup')),
  status text not null default 'new' check (status in
    ('new','accepted','preparing','ready','out_for_delivery','completed','cancelled','refunded')),
  payment_method text not null check (payment_method in
    ('card_online','cash_delivery','card_delivery','cash_pickup','card_pickup')),
  payment_status text not null default 'pending' check (payment_status in
    ('pending','paid','failed','refunded')),
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  address jsonb,                      -- {street, details, city, lat, lng, distance_km}
  delivery_notes text,
  notes text,
  requested_time text not null default 'asap',   -- 'asap' | ISO local time
  subtotal numeric(8,2) not null,
  delivery_fee numeric(8,2) not null default 0,
  discount numeric(8,2) not null default 0,
  total numeric(8,2) not null,
  promo_code text,
  stripe_payment_intent text,
  acknowledged_at timestamptz,
  acknowledged_by uuid references public.staff(id),
  accepted_at timestamptz,
  accepted_by uuid references public.staff(id),
  completed_at timestamptz,
  cancelled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_status_idx on public.orders(status, created_at desc);
create index orders_customer_idx on public.orders(customer_id, created_at desc);
create index orders_created_idx on public.orders(created_at desc);
create trigger orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  qty int not null check (qty > 0),
  unit_price numeric(8,2) not null,
  options jsonb not null default '[]',   -- [{group, item, delta}]
  total numeric(8,2) not null,
  notes text
);
create index order_items_order_idx on public.order_items(order_id);

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  staff_id uuid references public.staff(id),
  staff_name text,
  event_type text not null,          -- created|acknowledged|status_changed|payment|printed|note
  from_status text,
  to_status text,
  note text,
  created_at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events(order_id, created_at);

-- ─── Promo & diverse ────────────────────────────────────────────────────────
create table public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  type text not null check (type in ('percent','fixed')),
  value numeric(8,2) not null check (value > 0),
  min_order numeric(8,2) not null default 0,
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  max_uses int,
  used_count int not null default 0,
  created_at timestamptz not null default now()
);
create unique index promo_codes_code_idx on public.promo_codes(lower(code));

create table public.settings (
  key text primary key,
  value jsonb not null,
  public boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.geocode_cache (
  query text primary key,
  lat double precision,
  lng double precision,
  display_name text,
  created_at timestamptz not null default now()
);

-- ─── Statistici clienți ─────────────────────────────────────────────────────
create view public.customer_stats
with (security_invoker = on) as
select
  c.id,
  c.phone,
  c.name,
  c.email,
  c.auth_user_id,
  c.notes,
  c.created_at,
  count(o.id) filter (where o.status not in ('cancelled','refunded')) as orders_count,
  coalesce(sum(o.total) filter (where o.status not in ('cancelled','refunded')), 0) as total_spent,
  max(o.created_at) as last_order_at
from public.customers c
left join public.orders o on o.customer_id = c.id
group by c.id;
