-- HASH Bistro — al doilea strat pe funcțiile de raportare.
--
-- 0006 le-a pus garda interna `if not is_staff() then raise`. Functioneaza —
-- anonimul primeste 401 — dar e aparare pe un singur strat: endpointul RPC
-- ramane expus si raspunde. Aici se retrage si dreptul, deci endpointul nu mai
-- exista deloc pentru anon.
--
-- `revoke ... from anon` singur nu ajunge: anon mosteneste de la PUBLIC, deci
-- dreptul trebuie retras si de acolo. Aceeasi capcana ca la reorder_* in 0006.

revoke execute on function public.sales_report(timestamptz, timestamptz) from public, anon;
revoke execute on function public.customer_top_products(uuid, integer)    from public, anon;

grant  execute on function public.sales_report(timestamptz, timestamptz) to authenticated;
grant  execute on function public.customer_top_products(uuid, integer)   to authenticated;

-- Garda interna ramane: `authenticated` include si conturile de client, nu doar
-- staff. Dreptul deschide usa, is_staff() decide cine intra.

-- set_updated_at ramane executabil de public, intentionat: intoarce `trigger`,
-- iar PostgREST refuza sa expuna ca RPC functiile care intorc trigger. Expunerea
-- e nula, iar o revocare ar risca declansatoarele fara sa castige nimic.
