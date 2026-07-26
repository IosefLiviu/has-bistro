-- HASH Bistro — probe pentru politicile de scriere RLS (migrarea 0005)
--
-- Rulare: conectorul MCP Supabase, execute_sql, tot fișierul într-un singur apel.
--
-- Trei lucruri aflate rulând, care explică forma fișierului:
--   1. Conectorul returnează doar rezultatul ULTIMEI instrucțiuni, deci fiecare
--      probă își scrie rezultatul într-o tabelă temporară și la final e un
--      singur select.
--   2. Probele NU ridică excepții. O excepție ar abandona restul fișierului,
--      inclusiv curățenia, lăsând utilizatori de test în bază.
--   3. `set local role authenticated` e obligatoriu. Fără el rulăm ca postgres,
--      care e proprietarul tabelelor și ocolește RLS — toate probele ar trece
--      fără să dovedească nimic.
--
-- Probele care ating date reale sunt scrise ca no-op (`set price = price`) și
-- restaurează ce modifică. O probă n-are voie să strice catalogul.
--
-- Curățenia e explicită și idempotentă: fișierul se poate rerula oricând.

-- ─── Curățenie preventivă, dacă o rulare anterioară a fost întreruptă ───────
delete from public.categories where slug like 'zzz-proba-%';
delete from auth.users where email like '%@proba.hash.local';

-- ─── Utilizatori de probă, unul per rol ─────────────────────────────────────
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-4000-a000-000000000001','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated','admin@proba.hash.local','x',now(),now(),now()),
  ('00000000-0000-4000-a000-000000000002','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated','manager@proba.hash.local','x',now(),now(),now()),
  ('00000000-0000-4000-a000-000000000003','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated','staff@proba.hash.local','x',now(),now(),now());

insert into public.staff (id, name, role, active) values
  ('00000000-0000-4000-a000-000000000001','Probă Admin','admin',true),
  ('00000000-0000-4000-a000-000000000002','Probă Manager','manager',true),
  ('00000000-0000-4000-a000-000000000003','Probă Staff','staff',true);

-- ─── Colectorul de rezultate și ajutoarele ──────────────────────────────────
create temp table rez(nr int, rezultat text, proba text);
grant all on rez to authenticated, anon;

-- Copie de siguranță a ordinii categoriilor, restaurată după proba 7.
create temp table ordine_initiala as
  select id, sort from public.categories;

create or replace function pg_temp.nota(nr int, ok boolean, proba text)
returns void language sql as $$
  insert into rez values (nr, case when ok then 'OK' else 'ESEC' end, proba)
$$;

create or replace function pg_temp.act_as(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',
    json_build_object('sub',uid::text,'role','authenticated')::text, true);
end $$;

grant execute on function pg_temp.nota(int, boolean, text) to authenticated, anon;
grant execute on function pg_temp.act_as(uuid) to authenticated, anon;

-- ════════════════════════════════════════════════════════════════════════════
-- Catalog
-- ════════════════════════════════════════════════════════════════════════════

-- Proba 1 — managerul poate crea o categorie
do $$
declare ok boolean := false;
begin
  perform pg_temp.act_as('00000000-0000-4000-a000-000000000002');
  begin
    insert into public.categories (slug, name, sort, active)
    values ('zzz-proba-manager','Probă manager', 999, false);
    ok := true;
  exception when others then ok := false;
  end;
  perform set_config('role','postgres',true);
  perform pg_temp.nota(1, ok, 'managerul poate crea o categorie');
end $$;

-- Proba 2 — contul staff NU poate atinge preturile.
-- Un UPDATE blocat de RLS afecteaza 0 randuri, nu ridica eroare: de aceea
-- proba se uita la row_count. Atribuirea e no-op, ca sa nu riste datele.
do $$
declare n int;
begin
  perform pg_temp.act_as('00000000-0000-4000-a000-000000000003');
  update public.products set price = price
   where id = (select id from public.products order by slug limit 1);
  get diagnostics n = row_count;
  perform set_config('role','postgres',true);
  perform pg_temp.nota(2, n = 0, 'contul staff NU poate modifica produse');
end $$;

-- Proba 3 — managerul poate actualiza produse
do $$
declare n int;
begin
  perform pg_temp.act_as('00000000-0000-4000-a000-000000000002');
  update public.products set available = available
   where id = (select id from public.products order by slug limit 1);
  get diagnostics n = row_count;
  perform set_config('role','postgres',true);
  perform pg_temp.nota(3, n > 0, 'managerul poate actualiza produse');
end $$;

-- Proba 4 — promo_codes: staff-ul le poate citi (azi n-are NICIO politica)
do $$
declare c int;
begin
  perform pg_temp.act_as('00000000-0000-4000-a000-000000000003');
  select count(*) into c from public.promo_codes;
  perform set_config('role','postgres',true);
  perform pg_temp.nota(4, c is not null and c >= 0
    and exists (select 1 from pg_policies
                where schemaname='public' and tablename='promo_codes'),
    'promo_codes are politici si staff-ul le citeste');
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- Setări, personal
-- ════════════════════════════════════════════════════════════════════════════

-- Proba 5 — managerul NU poate schimba setarile
do $$
declare n int;
begin
  perform pg_temp.act_as('00000000-0000-4000-a000-000000000002');
  update public.settings set updated_at = updated_at
   where key = (select key from public.settings order by key limit 1);
  get diagnostics n = row_count;
  perform set_config('role','postgres',true);
  perform pg_temp.nota(5, n = 0, 'managerul NU poate schimba setarile');
end $$;

-- Proba 6 — adminul poate
do $$
declare n int;
begin
  perform pg_temp.act_as('00000000-0000-4000-a000-000000000001');
  update public.settings set updated_at = updated_at
   where key = (select key from public.settings order by key limit 1);
  get diagnostics n = row_count;
  perform set_config('role','postgres',true);
  perform pg_temp.nota(6, n > 0, 'adminul poate schimba setarile');
end $$;

-- Proba 7 — staff-ul vede lista de personal, pentru jurnalul comenzilor
do $$
declare c int;
begin
  perform pg_temp.act_as('00000000-0000-4000-a000-000000000003');
  select count(*) into c from public.staff;
  perform set_config('role','postgres',true);
  perform pg_temp.nota(7, c >= 3, 'staff-ul vede lista de personal');
end $$;

-- Proba 8 — staff-ul NU isi poate ridica singur rolul.
-- Fara proba asta, o politica prea larga pe staff ar fi o cale de escaladare.
do $$
declare n int;
begin
  perform pg_temp.act_as('00000000-0000-4000-a000-000000000003');
  update public.staff set role = 'admin'
   where id = '00000000-0000-4000-a000-000000000003';
  get diagnostics n = row_count;
  perform set_config('role','postgres',true);
  perform pg_temp.nota(8, n = 0, 'staff-ul NU isi poate ridica rolul');
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- Reordonare
-- ════════════════════════════════════════════════════════════════════════════

-- Proba 9 — reordonarea renumeroteaza 0..n-1 intr-o singura scriere
do $$
declare ids uuid[]; primul int; ultimul int; ok boolean := false;
begin
  perform pg_temp.act_as('00000000-0000-4000-a000-000000000002');
  begin
    select array_agg(id order by sort) into ids from public.categories;
    perform public.reorder_categories(ids);
    select sort into primul  from public.categories where id = ids[1];
    select sort into ultimul from public.categories where id = ids[array_length(ids,1)];
    ok := primul = 0 and ultimul = array_length(ids,1) - 1;
  exception when others then ok := false;
  end;
  perform set_config('role','postgres',true);
  perform pg_temp.nota(9, ok, 'reorder_categories renumeroteaza 0..n-1');
end $$;

-- Proba 10 — contul staff NU poate reordona
do $$
declare blocat boolean := false;
begin
  perform pg_temp.act_as('00000000-0000-4000-a000-000000000003');
  begin
    perform public.reorder_categories(array(select id from public.categories order by sort));
    blocat := false;
  exception when others then blocat := true;
  end;
  perform set_config('role','postgres',true);
  perform pg_temp.nota(10, blocat, 'contul staff NU poate reordona');
end $$;

-- restaurarea ordinii dinaintea probelor
reset role;
update public.categories c set sort = o.sort
  from ordine_initiala o where o.id = c.id and c.sort is distinct from o.sort;

-- ════════════════════════════════════════════════════════════════════════════
-- Garanțiile de afișare
-- ════════════════════════════════════════════════════════════════════════════

-- Proba 11 — o categorie de GRILA, activa si fara imagine, e refuzata de baza.
--
-- Prinde EXACT check_violation, nu `others`. La prima rulare proba trecea
-- fals: coloana image_url nu exista inca, deci inserarea esua cu "column does
-- not exist" — un esec adevarat mascat drept succes.
do $$
declare blocat boolean := false;
begin
  perform pg_temp.act_as('00000000-0000-4000-a000-000000000002');
  begin
    insert into public.categories (slug, name, sort, active, show_in_grid, image_url)
    values ('zzz-proba-fara-imagine','Probă fără imagine', 998, true, true, null);
    blocat := false;
  exception when check_violation then blocat := true;
           when others then blocat := false;
  end;
  perform set_config('role','postgres',true);
  perform pg_temp.nota(11, blocat, 'categoria activa fara imagine e refuzata');
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- Anonimul
-- ════════════════════════════════════════════════════════════════════════════

-- Proba 12 — anonimul nu poate scrie in catalog
do $$
declare ok boolean := false;
begin
  perform set_config('role','anon',true);
  perform set_config('request.jwt.claims','{"role":"anon"}',true);
  begin
    insert into public.categories (slug, name, sort, active)
    values ('zzz-proba-anon','Probă anon', 997, false);
    ok := false;
  exception when others then ok := true;
  end;
  perform set_config('role','postgres',true);
  perform pg_temp.nota(12, ok, 'anonimul NU poate scrie in catalog');
end $$;

-- Proba 13 — anonimul nu poate insera comenzi (raman doar prin Edge Function)
do $$
declare ok boolean := false;
begin
  perform set_config('role','anon',true);
  perform set_config('request.jwt.claims','{"role":"anon"}',true);
  begin
    insert into public.orders (type, payment_method, customer_name, customer_phone,
                               requested_time, subtotal, total)
    values ('pickup','cash_pickup','Probă','0700000000','asap',10,10);
    ok := false;
  exception when others then ok := true;
  end;
  perform set_config('role','postgres',true);
  perform pg_temp.nota(13, ok, 'anonimul NU poate insera comenzi direct');
end $$;

-- Proba 18 — o categorie de EXTRA-URI n-are nevoie de imagine.
-- Cazul `sosuri`: exista ca sa organizeze produse mici, nu e desenata nicaieri,
-- deci constrangerea n-are ce sa ceara de la ea.
do $$
declare ok boolean := false;
begin
  perform pg_temp.act_as('00000000-0000-4000-a000-000000000002');
  begin
    insert into public.categories (slug, name, sort, active, show_in_grid, image_url)
    values ('zzz-proba-extra','Probă extra-uri', 996, true, false, null);
    ok := true;
  exception when others then ok := false;
  end;
  perform set_config('role','postgres',true);
  perform pg_temp.nota(18, ok, 'categoria de extra-uri e permisa fara imagine');
end $$;

-- Proba 19 — sosuri e chiar marcata ca fiind in afara grilei
do $$
declare in_grila boolean;
begin
  select show_in_grid into in_grila from public.categories where slug = 'sosuri';
  perform pg_temp.nota(19, in_grila = false, 'sosuri e in afara grilei');
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- Funcțiile expuse prin API (migrarea 0006)
-- ════════════════════════════════════════════════════════════════════════════
-- Chemata ca anon, sales_report intorcea incasarile, numarul de comenzi si
-- numele plus telefonul clientilor. Confirmat prin exploatare, nu presupus.

-- Proba 14 — anonimul NU poate chema rapoartele
do $$
declare blocat boolean := false;
begin
  perform set_config('role','anon',true);
  perform set_config('request.jwt.claims','{"role":"anon"}',true);
  begin
    perform public.sales_report(now() - interval '90 days', now());
    blocat := false;
  exception when others then blocat := true;
  end;
  perform set_config('role','postgres',true);
  perform pg_temp.nota(14, blocat, 'anonimul NU poate chema sales_report');
end $$;

-- Proba 15 — staff-ul poate. Garda nu are voie sa blocheze adminul.
do $$
declare ok boolean := false;
begin
  perform pg_temp.act_as('00000000-0000-4000-a000-000000000003');
  begin
    perform public.sales_report(now() - interval '90 days', now());
    ok := true;
  exception when others then ok := false;
  end;
  perform set_config('role','postgres',true);
  perform pg_temp.nota(15, ok, 'staff-ul POATE chema sales_report');
end $$;

-- Proba 16 — anonimul nu poate arde coduri promo in bucla pana la max_uses
do $$
declare blocat boolean := false;
begin
  perform set_config('role','anon',true);
  perform set_config('request.jwt.claims','{"role":"anon"}',true);
  begin
    perform public.increment_promo_use(gen_random_uuid());
    blocat := false;
  exception when others then blocat := true;
  end;
  perform set_config('role','postgres',true);
  perform pg_temp.nota(16, blocat, 'anonimul NU poate incrementa promo');
end $$;

-- Proba 17 — REGRESIE: 0006 revoca functiile de nivel de la anon. Politicile de
-- citire a catalogului evalueaza `active or is_staff()`, deci daca revocarea a
-- mers prea departe, site-ul ramane fara meniu.
do $$
declare cat int; prod int; opt int;
begin
  perform set_config('role','anon',true);
  perform set_config('request.jwt.claims','{"role":"anon"}',true);
  select count(*) into cat  from public.categories;
  select count(*) into prod from public.products;
  select count(*) into opt  from public.product_option_items;
  perform set_config('role','postgres',true);
  perform pg_temp.nota(17, cat > 0 and prod > 0 and opt > 0,
    format('anonimul citeste catalogul (%s cat, %s prod, %s opt)', cat, prod, opt));
end $$;

-- ─── Curățenie ──────────────────────────────────────────────────────────────
reset role;
delete from public.categories where slug like 'zzz-proba-%';
delete from auth.users where email like '%@proba.hash.local';

-- ─── Rezultatele ────────────────────────────────────────────────────────────
select nr, rezultat, proba from rez order by nr;
