-- HASH Bistro — Admin v2: politici de scriere cu roluri, reordonare atomică,
-- imagini de categorie.
--
-- De ce există: politicile din 0002 au fost scrise pentru arhitectura veche,
-- unde fiecare scriere trecea printr-o rută API cu service role, care ocolește
-- RLS complet. RLS e activ pe 14 tabele, dar 6 au doar politici de citire,
-- promo_codes și geocode_cache n-au niciuna, iar orders n-are politică de
-- insert. Fără migrarea asta, baza e read-only pentru orice client care nu e
-- service role — deci adminul static nu poate salva nimic.
--
-- Întregul fișier e idempotent și se poate rerula.

-- ════════════════════════════════════════════════════════════════════════════
-- 1. Nivelurile de rol
-- ════════════════════════════════════════════════════════════════════════════
-- is_staff() există din 0002 și rămâne neatins. Aici adăugăm doar nivelurile.
-- Toate sunt security definer: citesc tabela staff ocolind RLS, altfel s-ar
-- autoreferi la propria politică.

create or replace function public.staff_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.staff where id = auth.uid() and active
$$;

create or replace function public.is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.staff_role() in ('admin','manager'), false)
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.staff_role() = 'admin', false)
$$;

comment on function public.staff_role() is
  'Rolul contului de staff autentificat, sau null daca nu e staff activ.';

-- ════════════════════════════════════════════════════════════════════════════
-- 2. Catalog: scriere pentru manageri
-- ════════════════════════════════════════════════════════════════════════════
-- `for all` acopera insert, update si delete deodata. Politicile de citire din
-- 0002 raman: politicile permisive se cumuleaza prin OR, deci publicul continua
-- sa vada doar ce e activ si nearhivat.

drop policy if exists "categories manager write"   on public.categories;
drop policy if exists "products manager write"     on public.products;
drop policy if exists "option groups manager write" on public.product_option_groups;
drop policy if exists "option items manager write" on public.product_option_items;
drop policy if exists "daily menus manager write"  on public.daily_menus;

create policy "categories manager write" on public.categories
  for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

create policy "products manager write" on public.products
  for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

create policy "option groups manager write" on public.product_option_groups
  for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

create policy "option items manager write" on public.product_option_items
  for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

create policy "daily menus manager write" on public.daily_menus
  for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- promo_codes avea RLS activ si ZERO politici: era invizibil pentru toata lumea,
-- inclusiv pentru staff. Validarea codului la checkout ramane in Edge Function
-- cu service role, deci publicul tot nu are nevoie de citire aici.
drop policy if exists "promo staff read"    on public.promo_codes;
drop policy if exists "promo manager write" on public.promo_codes;

create policy "promo staff read" on public.promo_codes
  for select to authenticated using (public.is_staff());

create policy "promo manager write" on public.promo_codes
  for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Setări, clienți, personal
-- ════════════════════════════════════════════════════════════════════════════

drop policy if exists "settings admin write"   on public.settings;
drop policy if exists "customers staff update" on public.customers;
drop policy if exists "staff list read"        on public.staff;
drop policy if exists "staff admin write"      on public.staff;

-- Setarile schimba program, raza de livrare si taxe: doar adminul.
create policy "settings admin write" on public.settings
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Staff-ul are voie doar la notitele interne despre client.
create policy "customers staff update" on public.customers
  for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- Toata lumea din staff vede lista, ca sa poata fi afisat cine a facut ce in
-- jurnalul comenzii. Doar adminul modifica — altfel un cont staff si-ar putea
-- ridica singur rolul.
create policy "staff list read" on public.staff
  for select to authenticated using (public.is_staff());

create policy "staff admin write" on public.staff
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Politica "staff self read" din 0002 ramane: e necesara la login, cand
-- is_staff() inca nu se poate evalua fara sa se autoreferi.

-- ════════════════════════════════════════════════════════════════════════════
-- 4. Reordonare atomică
-- ════════════════════════════════════════════════════════════════════════════
-- Vechiul cod trimitea doua PATCH-uri paralele care se puteau incrucisa. Cu
-- adaugari si stergeri in joc, asta chiar rupe ordinea.
--
-- security definer ocoleste RLS, deci verificarea de rol se face explicit in
-- corp. Fara ea, functia ar fi o portita care ocoleste politicile de mai sus.

create or replace function public.reorder_categories(ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_manager() then
    raise exception 'Doar managerii pot reordona categoriile.';
  end if;
  update public.categories c
     set sort = x.idx - 1
    from unnest(ids) with ordinality as x(id, idx)
   where c.id = x.id;
end $$;

create or replace function public.reorder_products(ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_manager() then
    raise exception 'Doar managerii pot reordona produsele.';
  end if;
  update public.products p
     set sort = x.idx - 1
    from unnest(ids) with ordinality as x(id, idx)
   where p.id = x.id;
end $$;

revoke execute on function public.reorder_categories(uuid[]) from anon;
revoke execute on function public.reorder_products(uuid[])   from anon;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. Escaladare idempotentă
-- ════════════════════════════════════════════════════════════════════════════
-- Dedupe-ul era un Set in memoria paginii: la refresh se retrimiteau webhookuri
-- pentru aceleasi comenzi.

alter table public.orders add column if not exists escalated_at timestamptz;

comment on column public.orders.escalated_at is
  'Momentul trimiterii webhookului de escaladare. Non-null = nu se retrimite.';

-- ════════════════════════════════════════════════════════════════════════════
-- 6. Imaginea de categorie
-- ════════════════════════════════════════════════════════════════════════════
-- categories n-avea coloana de imagine: site-ul folosea fisiere de pe disc din
-- img/categorii/. Maparea e explicita pentru ca slug-urile NU se potrivesc cu
-- numele fisierelor, iar `salate-aperitiv` si `salate` sunt incrucisate — un
-- `slug || '.png'` ar pune imaginea gresita pe amandoua.

alter table public.categories add column if not exists image_url text;

update public.categories c set image_url = m.path
from (values
  ('meniul-zilei',     'img/categorii/meniul-zilei.png'),
  ('meniuri-speciale', 'img/categorii/meniuri-speciale.png'),
  ('salate-aperitiv',  'img/categorii/salate.png'),          -- incrucisat
  ('supe-ciorbe',      'img/categorii/supe.png'),
  ('peste',            'img/categorii/peste.png'),
  ('traditionale',     'img/categorii/traditionale.png'),
  ('paste',            'img/categorii/paste.png'),
  ('la-tigaie',        'img/categorii/la-tigaie.png'),
  ('gratar',           'img/categorii/gratar.png'),
  ('platouri',         'img/categorii/platouri.png'),
  ('garnituri',        'img/categorii/garnituri.png'),
  ('salate',           'img/categorii/salate-insotire.png'), -- incrucisat
  ('pizza',            'img/categorii/pizza.png'),
  ('burgers',          'img/categorii/burgeri.png'),
  ('desert',           'img/categorii/desert.png')
) as m(slug, path)
where c.slug = m.slug and c.image_url is null;

-- Ramane exact una fara imagine: `sosuri`. Constrangerea care cere imagine
-- pentru categoriile active se adauga separat, dupa ce se decide ce e cu ea.

-- ════════════════════════════════════════════════════════════════════════════
-- 7. Storage: bucket pentru imaginile de categorie
-- ════════════════════════════════════════════════════════════════════════════
-- Politicile din 0002 acopereau doar 'products' si 'daily-menu'. Le inlocuim cu
-- unele care includ si 'categories', in loc sa le duplicam.

insert into storage.buckets (id, name, public)
values ('categories','categories', true)
on conflict (id) do nothing;

drop policy if exists "public read product images"   on storage.objects;
drop policy if exists "staff write product images"   on storage.objects;
drop policy if exists "staff update product images"  on storage.objects;
drop policy if exists "staff delete product images"  on storage.objects;
drop policy if exists "public read catalog images"   on storage.objects;
drop policy if exists "manager write catalog images" on storage.objects;
drop policy if exists "manager update catalog images" on storage.objects;
drop policy if exists "manager delete catalog images" on storage.objects;

create policy "public read catalog images" on storage.objects
  for select using (bucket_id in ('products','daily-menu','categories'));

create policy "manager write catalog images" on storage.objects
  for insert to authenticated with check (
    bucket_id in ('products','daily-menu','categories') and public.is_manager());

create policy "manager update catalog images" on storage.objects
  for update to authenticated using (
    bucket_id in ('products','daily-menu','categories') and public.is_manager());

create policy "manager delete catalog images" on storage.objects
  for delete to authenticated using (
    bucket_id in ('products','daily-menu','categories') and public.is_manager());
