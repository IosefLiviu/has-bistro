-- HASH Bistro — RLS, realtime, storage, default settings

-- staff check helper (security definer so RLS on staff doesn't recurse)
create or replace function public.is_staff()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (select 1 from public.staff s where s.id = auth.uid() and s.active);
$$;

create or replace function public.my_customer_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select id from public.customers where auth_user_id = auth.uid();
$$;

alter table public.categories            enable row level security;
alter table public.products              enable row level security;
alter table public.product_option_groups enable row level security;
alter table public.product_option_items  enable row level security;
alter table public.daily_menus           enable row level security;
alter table public.customers             enable row level security;
alter table public.customer_addresses    enable row level security;
alter table public.staff                 enable row level security;
alter table public.orders                enable row level security;
alter table public.order_items           enable row level security;
alter table public.order_events          enable row level security;
alter table public.promo_codes           enable row level security;
alter table public.settings              enable row level security;
alter table public.geocode_cache         enable row level security;

-- Catalog public
create policy "catalog public read" on public.categories
  for select using (active or public.is_staff());
create policy "products public read" on public.products
  for select using ((not archived) or public.is_staff());
create policy "option groups public read" on public.product_option_groups
  for select using (true);
create policy "option items public read" on public.product_option_items
  for select using (true);
create policy "daily menu public read" on public.daily_menus
  for select using (published or public.is_staff());
create policy "public settings read" on public.settings
  for select using (public or public.is_staff());

-- Clienți: propriul profil + staff
create policy "customer self read" on public.customers
  for select using (auth_user_id = auth.uid() or public.is_staff());
create policy "addresses owner" on public.customer_addresses
  for all using (customer_id = public.my_customer_id() or public.is_staff())
  with check (customer_id = public.my_customer_id() or public.is_staff());

-- Staff: se vede pe sine (pentru gate-ul de admin); admin gestionează prin API
create policy "staff self read" on public.staff
  for select using (id = auth.uid());

-- Comenzi: staff totul, clientul propriile comenzi
create policy "orders staff read" on public.orders
  for select using (public.is_staff() or customer_id = public.my_customer_id());
create policy "orders staff update" on public.orders
  for update using (public.is_staff());
create policy "order items read" on public.order_items
  for select using (exists (
    select 1 from public.orders o
    where o.id = order_id
      and (public.is_staff() or o.customer_id = public.my_customer_id())
  ));
create policy "order events staff" on public.order_events
  for select using (public.is_staff());
create policy "order events staff insert" on public.order_events
  for insert with check (public.is_staff());

-- Realtime pentru panoul de comenzi
alter publication supabase_realtime add table public.orders;

-- Storage buckets publice pentru imagini
insert into storage.buckets (id, name, public)
values ('products','products',true), ('daily-menu','daily-menu',true)
on conflict (id) do nothing;

create policy "public read product images" on storage.objects
  for select using (bucket_id in ('products','daily-menu'));
create policy "staff write product images" on storage.objects
  for insert with check (bucket_id in ('products','daily-menu') and public.is_staff());
create policy "staff update product images" on storage.objects
  for update using (bucket_id in ('products','daily-menu') and public.is_staff());
create policy "staff delete product images" on storage.objects
  for delete using (bucket_id in ('products','daily-menu') and public.is_staff());

-- Setări implicite
insert into public.settings (key, value, public) values
('restaurant', '{
  "name": "HASH Bistro & Take Away",
  "tagline": "Poftiți la masă!",
  "phones": ["0722 305 909", "0730 411 042"],
  "email": "",
  "address_label": "București (setați adresa exactă din panoul de administrare)",
  "lat": 44.4268,
  "lng": 26.1025,
  "events_note": "Organizăm evenimente și mese festive — maximum 30 persoane."
}', true),
('delivery', '{
  "radius_km": 4,
  "fee": 10,
  "free_over": 150,
  "min_order": 40
}', true),
('hours', '{
  "mon": {"open": "10:00", "close": "22:00"},
  "tue": {"open": "10:00", "close": "22:00"},
  "wed": {"open": "10:00", "close": "22:00"},
  "thu": {"open": "10:00", "close": "22:00"},
  "fri": {"open": "10:00", "close": "22:00"},
  "sat": {"open": "10:00", "close": "22:00"},
  "sun": {"open": "10:00", "close": "22:00"},
  "closed_dates": []
}', true),
('ordering', '{
  "enabled": true,
  "delivery_enabled": true,
  "pickup_enabled": true,
  "prep_minutes": 30,
  "delivery_minutes": 45,
  "pause_message": ""
}', true),
('glovo', '{
  "url": "https://glovoapp.com/ro/ro/bucuresti/",
  "label": "Comandă prin Glovo"
}', true),
('notifications', '{
  "sound": "clopotel",
  "volume": 0.9,
  "repeat_seconds": 15,
  "escalate_after_minutes": 3,
  "escalation_webhook_url": "",
  "browser_notifications": true,
  "quiet_hours": null
}', false),
('printer', '{
  "auto_print_on_accept": false,
  "width_mm": 80,
  "header_note": "",
  "footer_note": "Vă mulțumim! Poftă bună!"
}', false)
on conflict (key) do nothing;
