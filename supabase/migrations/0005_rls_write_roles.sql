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
