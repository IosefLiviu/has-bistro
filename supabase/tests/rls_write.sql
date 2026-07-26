-- HASH Bistro — probe pentru politicile de scriere RLS (migrarea 0005)
--
-- Rulare: conectorul MCP Supabase, execute_sql, tot fișierul într-un singur apel.
--
-- Două lucruri aflate rulând, care explică forma fișierului:
--   1. Conectorul returnează doar rezultatul ULTIMEI instrucțiuni, deci fiecare
--      probă își scrie rezultatul într-o tabelă temporară și la final e un
--      singur select.
--   2. Probele NU ridică excepții. O excepție ar abandona restul fișierului,
--      inclusiv curățenia, lăsând utilizatori de test în bază.
--
-- Curățenia e explicită și idempotentă: fișierul se poate rerula oricând.

-- ─── Curățenie preventivă, în caz că o rulare anterioară a fost întreruptă ───
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

-- ─── Colectorul de rezultate ────────────────────────────────────────────────
create temp table rez(nr int, rezultat text, proba text);
grant all on rez to authenticated;

create or replace function pg_temp.nota(nr int, ok boolean, proba text)
returns void language sql as $$
  insert into rez values (nr, case when ok then 'OK' else 'ESEC' end, proba)
$$;

-- Devine utilizatorul dat, exact cum apare un client real cu JWT.
-- set local role e obligatoriu: postgres e proprietarul tabelelor și ocolește RLS.
create or replace function pg_temp.act_as(uid uuid)
returns void language plpgsql as $$
begin
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claims',
    json_build_object('sub',uid::text,'role','authenticated')::text, true);
end $$;

grant execute on function pg_temp.nota(int, boolean, text) to authenticated;
grant execute on function pg_temp.act_as(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- Proba 1 — managerul poate crea o categorie
-- ════════════════════════════════════════════════════════════════════════════
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

-- ─── Curățenie ──────────────────────────────────────────────────────────────
reset role;
delete from public.categories where slug like 'zzz-proba-%';
delete from auth.users where email like '%@proba.hash.local';

-- ─── Rezultatele ────────────────────────────────────────────────────────────
select nr, rezultat, proba from rez order by nr;
