# Admin v2 — Plan 1: Fundația (migrarea 0005)

> **Pentru agenți:** folosiți superpowers:executing-plans. Pașii au checkbox (`- [ ]`).

**Goal:** Baza de date devine scriibilă în siguranță de către un client fără service role, astfel încât adminul static să poată salva catalogul.

**Architecture:** Toate scrierile trec prin RLS, cu rolurile impuse în bază prin funcții `security definer`, nu în cod de aplicație. Adminul static folosește cheia publishable plus JWT-ul de staff; nicio cheie secretă nu ajunge în browser.

**Tech Stack:** Postgres 15 (Supabase `bymooluipmmzjwblrahn`), RLS, Storage, SQL rulat prin conectorul MCP Supabase.

---

## Context verificat pe baza live (2026-07-26)

Nu presupune nimic din README — a fost verificat direct:

- 14 tabele, 16 categorii, 107 produse, 382 opțiuni, 1 comandă, 1 cont staff.
- 14 politici RLS, **toate de citire** cu patru excepții: `orders` update, `order_events` insert, `customer_addresses` all, și cele de Storage.
- `promo_codes` și `geocode_cache`: RLS activ, **zero politici**. Inaccesibile oricui în afară de service role.
- `orders` **nu are politică de INSERT**. Comenzile vor veni exclusiv prin Edge Function cu service role (Plan 2). Asta e intenționat — nu adăuga o politică de insert pentru anon.
- Tabela de migrări Supabase e **goală**: schema a fost aplicată ca SQL direct. `0005` va fi prima migrare înregistrată. Nu te aștepta ca 0001–0004 să apară în `list_migrations`.
- `categories` **nu are coloană de imagine**. Site-ul folosește fișiere de pe disc din `img/categorii/`.

### Capcana de mapare a imaginilor

15 fișiere pe disc, 16 categorii în bază. Maparea nu e mecanică — un
`slug || '.png'` ar pune imaginea greșită pe două categorii:

| slug în bază | fișier pe disc | atenție |
|---|---|---|
| `supe-ciorbe` | `supe.png` | nume diferit |
| `burgers` | `burgeri.png` | nume diferit |
| `salate-aperitiv` | `salate.png` | **încrucișat** |
| `salate` (= „de însoțire") | `salate-insotire.png` | **încrucișat** |
| `sosuri` | — | **nu există imagine** |
| celelalte 11 | `<slug>.png` | potrivire directă |

`sosuri` („Sosuri și extra", 7 produse) nu apare nici în `menu-data.js`. Vezi
Task 8 — necesită o decizie de la Liviu, nu o alegere tăcută.

---

## Structura fișierelor

- Creare: `supabase/migrations/0005_rls_write_roles.sql` — migrarea propriu-zisă
- Creare: `supabase/tests/rls_write.sql` — probele, rulate într-o tranzacție cu rollback
- Creare: `scripts/upload-category-images.mjs` — încarcă cele 15 imagini în bucket

Migrarea e un singur fișier pentru că e o unitate atomică: politicile n-au sens
pe jumătate aplicate. Probele stau separat ca să poată fi rerulate oricând.

---

## Task 1: Harness-ul de probe RLS

Fără el, fiecare politică se verifică „pare bine", ceea ce nu e verificare.
Probele creează utilizatori temporari și dau rollback, deci baza rămâne curată.

**Files:**
- Create: `supabase/tests/rls_write.sql`

- [ ] **Step 1: Scrie harness-ul cu prima probă, care trebuie să pice**

```sql
-- supabase/tests/rls_write.sql
-- Rulează cu: MCP execute_sql. Totul într-o tranzacție cu rollback la final.
begin;

-- utilizatori de probă: unul per rol
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-4000-a000-000000000001','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated','test-admin@hash.local','x',now(),now(),now()),
  ('00000000-0000-4000-a000-000000000002','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated','test-manager@hash.local','x',now(),now(),now()),
  ('00000000-0000-4000-a000-000000000003','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated','test-staff@hash.local','x',now(),now(),now());

insert into public.staff (id, name, role, active) values
  ('00000000-0000-4000-a000-000000000001','Test Admin','admin',true),
  ('00000000-0000-4000-a000-000000000002','Test Manager','manager',true),
  ('00000000-0000-4000-a000-000000000003','Test Staff','staff',true);

-- devine utilizatorul dat, ca un client real cu JWT
create or replace function pg_temp.act_as(uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',
    json_build_object('sub',uid::text,'role','authenticated')::text, true);
end $$;

create or replace function pg_temp.act_as_service() returns void
language plpgsql as $$
begin
  perform set_config('role','postgres',true);
  perform set_config('request.jwt.claims','', true);
end $$;

-- afirmă că o expresie e adevărată, altfel oprește cu mesaj
create or replace function pg_temp.check(ok boolean, label text) returns void
language plpgsql as $$
begin
  if ok then raise notice 'OK   %', label;
  else raise exception 'ESEC %', label;
  end if;
end $$;

-- ── Proba 1: managerul poate crea o categorie ────────────────────────────────
select pg_temp.act_as('00000000-0000-4000-a000-000000000002');
do $$
declare inserted boolean := false;
begin
  begin
    insert into public.categories (slug, name, sort, active)
    values ('proba-manager','Probă manager', 999, false);
    inserted := true;
  exception when insufficient_privilege then inserted := false;
  end;
  perform pg_temp.check(inserted, 'managerul poate insera categorie');
end $$;

rollback;
```

- [ ] **Step 2: Rulează și confirmă că pică**

Rulează prin MCP `execute_sql` cu conținutul fișierului.
Așteptat: `ESEC managerul poate insera categorie` — nu există încă politică de
insert pe `categories`, deci RLS refuză.

Dacă în schimb **trece**, oprește-te: înseamnă că rulezi ca service role și
harness-ul nu impersonează corect. Verifică `select current_setting('role')`.

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/rls_write.sql
git commit -m "test: harness RLS cu utilizatori de probă per rol"
```

---

## Task 2: Funcțiile de rol

**Files:**
- Create: `supabase/migrations/0005_rls_write_roles.sql`

- [ ] **Step 1: Scrie funcțiile**

`is_staff()` există deja din 0002 și rămâne neatins. Adăugăm doar nivelurile.

```sql
-- supabase/migrations/0005_rls_write_roles.sql
-- Admin v2: politici de scriere cu roluri, reordonare atomică, imagini categorii.

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
```

- [ ] **Step 2: Aplică prin MCP `apply_migration`**

Nume: `0005_rls_write_roles`. Va fi prima migrare înregistrată.

- [ ] **Step 3: Verifică nivelurile**

```sql
begin;
select set_config('role','authenticated',true);
select set_config('request.jwt.claims',
  '{"sub":"<id-ul contului de staff existent>","role":"authenticated"}', true);
select public.staff_role(), public.is_manager(), public.is_admin();
rollback;
```

Așteptat: rolul real al contului, cu `is_manager`/`is_admin` coerente.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0005_rls_write_roles.sql
git commit -m "feat(db): funcții de rol staff_role/is_manager/is_admin"
```

---

## Task 3: Politicile de catalog

Cele care deblochează adminul. `is_manager()` — un cont `staff` nu schimbă prețuri.

**Files:**
- Modify: `supabase/migrations/0005_rls_write_roles.sql`

- [ ] **Step 1: Adaugă proba pentru fiecare regulă, înainte de politici**

Adaugă în `supabase/tests/rls_write.sql`, înainte de `rollback`:

```sql
-- ── Proba 2: contul staff NU poate schimba prețuri ───────────────────────────
select pg_temp.act_as('00000000-0000-4000-a000-000000000003');
do $$
declare n int;
begin
  update public.products set price = price + 1 where slug is not null;
  get diagnostics n = row_count;
  perform pg_temp.check(n = 0, 'contul staff nu poate schimba preturi');
end $$;

-- ── Proba 3: managerul poate schimba prețuri ─────────────────────────────────
select pg_temp.act_as('00000000-0000-4000-a000-000000000002');
do $$
declare n int;
begin
  update public.products set available = available where slug is not null;
  get diagnostics n = row_count;
  perform pg_temp.check(n > 0, 'managerul poate actualiza produse');
end $$;
```

Notă: un UPDATE blocat de RLS afectează 0 rânduri, nu ridică eroare. De asta
proba se uită la `row_count`, nu la excepție.

- [ ] **Step 2: Rulează, confirmă că Proba 3 pică**

Așteptat: Proba 2 trece deja (nu există politică de update, deci nimeni nu poate),
Proba 3 pică. Asta confirmă că proba chiar măsoară ceva.

- [ ] **Step 3: Adaugă politicile**

```sql
-- ─── Catalog: scriere pentru manageri ───────────────────────────────────────
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

-- promo_codes nu avea NICIO politică: nici citire
create policy "promo staff read" on public.promo_codes
  for select to authenticated using (public.is_staff());
create policy "promo manager write" on public.promo_codes
  for all to authenticated
  using (public.is_manager()) with check (public.is_manager());
```

`for all` acoperă insert, update și delete deodată. Politica de select existentă
din 0002 rămâne — politicile se cumulează prin OR, deci publicul continuă să
citească doar ce e activ.

- [ ] **Step 4: Aplică și rulează probele**

Așteptat: toate trei trec.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0005_rls_write_roles.sql supabase/tests/rls_write.sql
git commit -m "feat(db): scriere catalog pentru manageri, prin RLS"
```

---

## Task 4: Setări, clienți, personal

**Files:**
- Modify: `supabase/migrations/0005_rls_write_roles.sql`, `supabase/tests/rls_write.sql`

- [ ] **Step 1: Probe — managerul NU atinge setările, adminul da**

```sql
-- ── Proba 4: managerul nu poate schimba setările ─────────────────────────────
select pg_temp.act_as('00000000-0000-4000-a000-000000000002');
do $$
declare n int;
begin
  update public.settings set updated_at = now();
  get diagnostics n = row_count;
  perform pg_temp.check(n = 0, 'managerul nu poate schimba setari');
end $$;

-- ── Proba 5: adminul poate ──────────────────────────────────────────────────
select pg_temp.act_as('00000000-0000-4000-a000-000000000001');
do $$
declare n int;
begin
  update public.settings set updated_at = now();
  get diagnostics n = row_count;
  perform pg_temp.check(n > 0, 'adminul poate schimba setari');
end $$;

-- ── Proba 6: staff-ul vede lista de personal (pentru jurnal), nu o modifică ──
select pg_temp.act_as('00000000-0000-4000-a000-000000000003');
do $$
declare c int; n int;
begin
  select count(*) into c from public.staff;
  perform pg_temp.check(c >= 3, 'staff-ul vede lista de personal');
  update public.staff set role = 'admin'
    where id = '00000000-0000-4000-a000-000000000003';
  get diagnostics n = row_count;
  perform pg_temp.check(n = 0, 'staff-ul nu isi poate ridica rolul');
end $$;
```

Proba 6 e cea care contează: fără ea, o politică prea largă pe `staff` ar permite
escaladarea de privilegii.

- [ ] **Step 2: Rulează, confirmă eșecurile așteptate**

- [ ] **Step 3: Adaugă politicile**

```sql
-- ─── Setări: doar adminul ───────────────────────────────────────────────────
create policy "settings admin write" on public.settings
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ─── Clienți: staff-ul poate scrie notițe interne ───────────────────────────
create policy "customers staff update" on public.customers
  for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ─── Personal: toți văd lista, doar adminul modifică ────────────────────────
create policy "staff list read" on public.staff
  for select to authenticated using (public.is_staff());
create policy "staff admin write" on public.staff
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
```

Politica existentă `staff self read` din 0002 rămâne — e necesară la login, când
`is_staff()` încă nu s-a putut evalua.

- [ ] **Step 4: Aplică, rulează, toate probele trec**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(db): politici setari, clienti si personal, cu roluri"
```

---

## Task 5: Reordonare atomică

Vechiul cod trimitea două PATCH-uri paralele care se puteau încrucișa. Cu
adăugări și ștergeri în joc, asta chiar rupe ordinea.

**Files:**
- Modify: `supabase/migrations/0005_rls_write_roles.sql`, `supabase/tests/rls_write.sql`

- [ ] **Step 1: Proba**

```sql
-- ── Proba 7: reordonarea renumerotează 0..n-1 într-o singură scriere ─────────
select pg_temp.act_as('00000000-0000-4000-a000-000000000002');
do $$
declare ids uuid[]; first_sort int; last_sort int;
begin
  select array_agg(id order by sort desc) into ids from public.categories;
  perform public.reorder_categories(ids);
  select sort into first_sort from public.categories where id = ids[1];
  select sort into last_sort  from public.categories where id = ids[array_length(ids,1)];
  perform pg_temp.check(first_sort = 0, 'prima categorie primeste sort 0');
  perform pg_temp.check(last_sort = array_length(ids,1) - 1, 'ultima primeste n-1');
end $$;
```

- [ ] **Step 2: Rulează — pică pentru că funcția nu există**

- [ ] **Step 3: Scrie funcțiile**

```sql
-- ─── Reordonare atomică ─────────────────────────────────────────────────────
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
revoke execute on function public.reorder_products(uuid[]) from anon;
```

`security definer` ocolește RLS, deci verificarea de rol se face explicit în corp.
Fără ea, funcția ar fi o portiță.

- [ ] **Step 4: Rulează, proba trece**

- [ ] **Step 5: Proba de securitate — contul staff e refuzat**

```sql
select pg_temp.act_as('00000000-0000-4000-a000-000000000003');
do $$
declare blocked boolean := false;
begin
  begin
    perform public.reorder_categories(array(select id from public.categories));
  exception when others then blocked := true;
  end;
  perform pg_temp.check(blocked, 'contul staff nu poate reordona');
end $$;
```

- [ ] **Step 6: Commit**

```bash
git commit -am "feat(db): reorder_categories si reorder_products, atomice"
```

---

## Task 6: `orders.escalated_at`

Dedupe-ul escaladării era un `Set` în memorie: la refresh de pagină se retrimiteau
webhookuri pentru aceleași comenzi.

**Files:**
- Modify: `supabase/migrations/0005_rls_write_roles.sql`

- [ ] **Step 1: Adaugă coloana**

```sql
alter table public.orders add column if not exists escalated_at timestamptz;
comment on column public.orders.escalated_at is
  'Momentul trimiterii webhookului de escaladare. Non-null = nu se retrimite.';
```

- [ ] **Step 2: Aplică și verifică**

```sql
select column_name from information_schema.columns
where table_schema='public' and table_name='orders' and column_name='escalated_at';
```

Așteptat: un rând.

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(db): orders.escalated_at pentru escaladare idempotenta"
```

---

## Task 7: Coloana de imagine pentru categorii

**Files:**
- Modify: `supabase/migrations/0005_rls_write_roles.sql`

- [ ] **Step 1: Adaugă coloana și fă backfill cu maparea explicită**

Maparea e explicită pentru că `salate-aperitiv` și `salate` sunt încrucișate față
de numele fișierelor. Un `slug || '.png'` ar pune imaginea greșită pe amândouă.

```sql
alter table public.categories add column if not exists image_url text;

update public.categories c set image_url = m.path
from (values
  ('meniul-zilei',     'img/categorii/meniul-zilei.png'),
  ('meniuri-speciale', 'img/categorii/meniuri-speciale.png'),
  ('salate-aperitiv',  'img/categorii/salate.png'),
  ('supe-ciorbe',      'img/categorii/supe.png'),
  ('peste',            'img/categorii/peste.png'),
  ('traditionale',     'img/categorii/traditionale.png'),
  ('paste',            'img/categorii/paste.png'),
  ('la-tigaie',        'img/categorii/la-tigaie.png'),
  ('gratar',           'img/categorii/gratar.png'),
  ('platouri',         'img/categorii/platouri.png'),
  ('garnituri',        'img/categorii/garnituri.png'),
  ('salate',           'img/categorii/salate-insotire.png'),
  ('pizza',            'img/categorii/pizza.png'),
  ('burgers',          'img/categorii/burgeri.png'),
  ('desert',           'img/categorii/desert.png')
) as m(slug, path)
where c.slug = m.slug;
```

- [ ] **Step 2: Verifică — exact una rămâne fără imagine**

```sql
select slug, name from public.categories where image_url is null;
```

Așteptat: un singur rând, `sosuri`. Orice altceva înseamnă că maparea e greșită —
oprește-te și corecteaz-o înainte de a continua.

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(db): categories.image_url cu backfill din img/categorii"
```

---

## Task 8: Bucket-ul de imagini pentru categorii

**Files:**
- Modify: `supabase/migrations/0005_rls_write_roles.sql`
- Create: `scripts/upload-category-images.mjs`

- [ ] **Step 1: Bucket și politici**

Politicile din 0002 acoperă doar `products` și `daily-menu`. Le extindem în loc
să le duplicăm.

```sql
insert into storage.buckets (id, name, public)
values ('categories','categories', true)
on conflict (id) do nothing;

drop policy if exists "public read product images"  on storage.objects;
drop policy if exists "staff write product images"  on storage.objects;
drop policy if exists "staff update product images" on storage.objects;
drop policy if exists "staff delete product images" on storage.objects;

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
```

- [ ] **Step 2: Încarcă cele 15 imagini existente**

Adminul încarcă în Storage, deci imaginile trebuie să ajungă acolo, nu să rămână
doar pe disc. Scriptul citește cheia din `.env.local` — nu o tipări niciodată.

```js
// scripts/upload-category-images.mjs
import { createClient } from "@supabase/supabase-js";
import { readFile, readdir } from "node:fs/promises";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Lipsesc SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");

const db = createClient(url, key);
const dir = "img/categorii";

for (const file of await readdir(dir)) {
  if (!file.endsWith(".png")) continue;
  const body = await readFile(`${dir}/${file}`);
  const { error } = await db.storage
    .from("categories")
    .upload(file, body, { contentType: "image/png", upsert: true });
  console.log(error ? `EROARE ${file}: ${error.message}` : `urcat ${file}`);
}
```

Rulează: `node scripts/upload-category-images.mjs`
Așteptat: 15 linii `urcat`.

- [ ] **Step 3: Mută `image_url` pe URL-urile publice**

```sql
update public.categories
   set image_url = replace(image_url, 'img/categorii/',
       'https://bymooluipmmzjwblrahn.supabase.co/storage/v1/object/public/categories/')
 where image_url like 'img/categorii/%';
```

- [ ] **Step 4: Verifică o imagine în browser**

Deschide un `image_url` din tabel. Așteptat: imaginea se încarcă, fără autentificare.

- [ ] **Step 5: Commit**

```bash
git add scripts/upload-category-images.mjs supabase/migrations/0005_rls_write_roles.sql
git commit -m "feat(storage): bucket categories si urcarea imaginilor existente"
```

---

## Task 9: Regula „categorie activă cere imagine"

Prima dintre garanțiile de afișare din spec §5. Impusă în bază, ca să nu depindă
de disciplina UI-ului.

**Files:**
- Modify: `supabase/migrations/0005_rls_write_roles.sql`, `supabase/tests/rls_write.sql`

- [ ] **Step 1: DECIZIE NECESARĂ — ce facem cu `sosuri`**

`sosuri` („Sosuri și extra", 7 produse) e activă și n-are imagine. Constrângerea
ar pica la aplicare. **Nu alege singur.** Întreabă-l pe Liviu:

- (a) generează o imagine pentru ea, apoi aplică constrângerea; sau
- (b) `active=false` până apare imaginea — produsele ei dispar de pe site; sau
- (c) categoria e doar pentru extra-uri din configuratorul de produs, nu un card
  în grilă, deci are nevoie de un tratament separat.

Varianta (c) e plauzibilă: „Sosuri și extra" nu apare în `menu-data.js`, ceea ce
sugerează că nu a fost gândită ca o categorie vizibilă. Confirmă înainte.

- [ ] **Step 2: Proba**

```sql
-- ── Proba 8: nu se poate activa o categorie fără imagine ────────────────────
select pg_temp.act_as('00000000-0000-4000-a000-000000000002');
do $$
declare blocked boolean := false;
begin
  begin
    insert into public.categories (slug, name, sort, active, image_url)
    values ('proba-fara-imagine','Probă', 998, true, null);
  exception when check_violation then blocked := true;
  end;
  perform pg_temp.check(blocked, 'categorie activa fara imagine este refuzata');
end $$;
```

- [ ] **Step 3: Rulează — pică, nu există constrângerea**

- [ ] **Step 4: Aplică constrângerea, după ce decizia de la Step 1 e pusă în practică**

```sql
alter table public.categories
  add constraint categories_active_needs_image
  check (not active or image_url is not null);
```

Dacă pică cu `check constraint is violated by some row`, înseamnă că Step 1 n-a
fost rezolvat. Nu adăuga `not valid` ca să treci peste — ar goli regula de sens.

- [ ] **Step 5: Rulează toate probele, de la 1 la 8**

Așteptat: opt linii `OK`, zero `ESEC`.

- [ ] **Step 6: Commit**

```bash
git commit -am "feat(db): categorie activa cere imagine, impus prin constrangere"
```

---

## Task 10: Proba finală de capăt la capăt

- [ ] **Step 1: Confirmă că adminul static chiar poate lucra**

Cu cheia publishable și un JWT de manager real, dintr-un browser:

```js
const db = supabase.createClient(URL, PUBLISHABLE_KEY);
await db.auth.signInWithPassword({ email, password });
const { error } = await db.from("categories")
  .insert({ slug: "test-browser", name: "Test", sort: 99,
            active: false, image_url: null });
console.log(error ?? "scriere reusita");
```

Așteptat: `scriere reusita`. Asta e proba că premisa întregului Plan 3 ține.
Șterge rândul după.

- [ ] **Step 2: Confirmă că anonimul rămâne blocat**

Fără `signInWithPassword`, aceeași inserare. Așteptat: eroare de RLS.

- [ ] **Step 3: Verifică lipsa avertismentelor de securitate**

Rulează consilierul Supabase (`get_advisors`, tip `security`). Așteptat: nicio
problemă nouă față de starea dinainte.

---

## Ce urmează

- **Plan 2 — Intrarea comenzilor:** Edge Functions `place-order` și `geocode`,
  legarea checkout-ului. Din acest moment există comenzi reale.
- **Plan 3 — Adminul:** `admin-core.js`, login, bord, catalog, restul ecranelor.
- **Plan 4 — Curățenie:** fixul `.catgrid`, ștergerea `src/` și a scaffolding-ului.

Fiecare se scrie după ce precedentul e verificat, nu înainte — Planul 3 depinde de
forma reală a datelor pe care le produce Planul 2.
