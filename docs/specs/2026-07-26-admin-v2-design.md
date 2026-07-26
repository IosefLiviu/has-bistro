# HASH Bistro — Admin v2 pe Supabase

**Data:** 2026-07-26
**Status:** spec, în așteptarea aprobării
**Înlocuiește:** arhitectura din `docs/specs/2026-07-18-hash-bistro-design.md`

---

## 1. Decizia

Aplicația Next.js din `src/` dispare. Rămân trei lucruri:

1. **Site-ul actual** — `H'ash Site v2.dc.html` plus `menu-data.js`, `support.js`,
   `image-slot.js` și folderele de imagini. Neatins ca design.
2. **Adminul nou** — pagină statică de același tip, cu clientul Supabase JS.
3. **Supabase** — proiectul `bymooluipmmzjwblrahn`, cu schema și meniul deja
   seed-uite (16 categorii, 107 produse, 382 opțiuni).

Nu mai există server propriu. Tot ce cerea până acum un backend Node trece pe
Supabase: Postgres + RLS pentru date și autorizare, Storage pentru imagini,
Realtime pentru bordul de comenzi, Edge Functions pentru operațiile care nu au
voie să se execute în browser.

## 2. De ce migrarea 0005 e piatra de temelie

Politicile RLS actuale au fost scrise pentru arhitectura veche, unde fiecare
scriere trecea printr-o rută API cu service role — care ocolește RLS complet.
Verificat în `supabase/migrations/0002_rls_realtime_storage.sql`:

| Tabel | Ce există azi | Ce lipsește pentru admin static |
|---|---|---|
| `categories` | doar select | insert, update, delete |
| `products` | doar select | insert, update, delete |
| `product_option_groups` / `_items` | doar select | insert, update, delete |
| `daily_menus` | doar select | insert, update, delete |
| `settings` | doar select | update |
| `customers` | doar select | update (notițe) |
| `staff` | select doar pe sine | select listă, insert, update |
| `promo_codes` | **RLS activ, zero politici** | tot |
| `geocode_cache` | **RLS activ, zero politici** | tot |
| `orders` | select + update staff | **insert** (nici site-ul nu poate comanda) |
| `order_items` | doar select | insert |

Fără migrarea 0005, baza e read-only pentru orice client care nu e service role.
Adminul static nu ar putea salva nimic. Ăsta e primul lucru care se construiește.

### Rolurile intră în bază

Vechiul app verifica rolurile ad-hoc în handlere, și inconsecvent: `staff` și
`setari` verificau, dar `produse`, `meniul-zilei`, `promo` și `clienti` nu — deci
un cont cu rol `staff` putea schimba prețuri sau șterge coduri promo. Cu RLS,
regula se scrie o dată și se aplică peste tot:

```sql
create or replace function public.staff_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.staff where id = auth.uid() and active
$$;

create or replace function public.is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select public.staff_role() in ('admin','manager')
$$;
```

- **catalog** (categorii, produse, opțiuni, meniul zilei, promo) → `is_manager()`
- **comenzi** (status, jurnal, notițe client) → `is_staff()`
- **setări și personal** → `staff_role() = 'admin'`

## 3. Ce se șterge

Reversibil oricând: totul e commit-uit curat la `e7214f0`, recuperabil cu
`git checkout e7214f0 -- src/`.

```
src/                      next.config.ts        postcss.config.mjs
.next/                    tsconfig.json         tsconfig.tsbuildinfo
node_modules/             package.json          package-lock.json
```

`supabase/` rămâne — migrările sunt sursa de adevăr a schemei. `.claude/launch.json`
se rescrie ca server static, nu `npm run dev`.

## 4. Adminul

Un fișier per ecran, în stilul site-ului, plus un modul comun `admin-core.js`
pentru client Supabase, sesiune, gărzi de rol și helperele de formatare.

| Ecran | Conținut |
|---|---|
| `admin-login` | email + parolă, `signInWithPassword` |
| `admin-comenzi` | bord live: realtime, sunet repetat până la preluare, escaladare, taburi active/noi/programate/finalizate, căutare |
| `admin-comanda` | detaliu: articole, client, adresă, jurnal `order_events`, tranziții de status, bon |
| `admin-catalog` | categorii **și** produse — vezi §5 |
| `admin-meniul-zilei` | programare pe date, imagine, expirare |
| `admin-promo` | coduri, tip, valoare, limite |
| `admin-clienti` | statistici din `customer_stats`, notițe, export CSV |
| `admin-rapoarte` | RPC `sales_report`, perioade azi/7/30/90, export CSV |
| `admin-setari` | locație, rază, taxe, program, notificări, imprimantă, Glovo, personal |
| `admin-bon` | bon 80mm, mono alb-negru, `window.print()` |

Design: tokenii site-ului — `--brown:#451400`, `--red:#AD2118`, `--red-d:#8E1A13`,
`--gold:#B68207`, `--green:#90A035`, `--line:rgba(69,20,0,.14)`, radius 4px,
butoane 40px, Barlow Semi Condensed / Barlow Condensed / Nunito.

Stări de comandă mapate pe paletă, nu pe culori inventate: `new` → red,
`accepted`/`preparing` → gold, `ready`/`out_for_delivery` → green, `completed` →
brown estompat, `cancelled`/`refunded` → line.

Bonul rămâne mono alb-negru pe hârtie de 80mm. Nu primește reskin — tokenii warm
ies prost la imprimanta termică.

## 5. Catalog: categorii și produse

Cerința: adăugare și ștergere de categorii și de produse, fără ca site-ul să arate
vreodată rupt.

### Categorii

- **Adaugă** — nume → slug kebab-case auto, cu dedupe pe coliziune (`slug` e unique).
  Imagine în bucket nou `categories`. Poziție la final.
- **Ascunde** — `active=false`. Dispare de pe site imediat, revine cu un click.
- **Șterge definitiv** — butonul apare doar când categoria n-are niciun produs,
  nici arhivat. `products.category_id` are `on delete restrict`, deci baza refuză
  oricum; UI-ul prinde cazul înainte și oferă mutarea produselor în altă categorie.
- **Reordonare** — drag & drop, o singură scriere prin `reorder_categories(ids uuid[])`
  care renumerotează `sort` 0..n-1. Vechiul cod făcea două PATCH-uri paralele care
  se pot încrucișa; cu adăugări și ștergeri în joc, asta chiar rupe ordinea.

### Produse

- **Adaugă** în categorie, **mută** între categorii (intră la finalul destinației),
  **reordonează** prin `reorder_products(ids uuid[])`.
- **Ascunde** — `archived=true`, mecanism deja existent.
- **Șterge definitiv** — doar dacă produsul n-a fost comandat niciodată. Dacă are
  rânduri în `order_items`, butonul explică de ce nu se poate și oferă ascunderea.
  Altfel ai pierde produsul din rapoarte.

### Garanțiile de afișare

Regulile care fac imposibil ca o acțiune din admin să strice pagina publică:

1. O categorie nu poate fi activată fără imagine. Niciun card rupt, niciodată.
2. Categorie activă rămasă fără niciun produs disponibil → se ascunde automat.
   Nu trimiți clientul într-o listă goală.
3. Ștergerea definitivă e blocată cât timp există produse, cu mesaj util în loc de
   eroare Postgres.
4. Produsul ascuns dispare de pe site, dar rămâne în comenzile vechi și în rapoarte.

### Layout: „să pice frumos și la rând"

Grila e `repeat(3,…)` desktop, 2 coloane sub 1000px, 1 sub 620px. Cu 15 categorii
cade perfect pe 3 coloane (5 rânduri) dar lasă un orfan pe tabletă (7 rânduri + 1).
Cu 16, invers. Singurele numere bune în ambele sunt multiplii de 6.

Concluzia: **nu se poate garanta prin numărul de categorii.** Se rezolvă doar
făcând ultimul rând să se centreze singur:

```css
.catgrid{display:flex;flex-wrap:wrap;justify-content:center;gap:54px 28px;
         max-width:1200px;margin:0 auto}
.catcard{flex:0 1 calc((100% - 56px)/3)}
@media(max-width:1000px){.catgrid{gap:44px 24px}.catcard{flex-basis:calc((100% - 24px)/2)}}
@media(max-width:620px){.catcard{flex-basis:100%}}
```

Aceleași lățimi și gap-uri ca acum, dar orice număr arată intenționat. În admin,
un preview live al grilei cu datele reale, comutabil pe cele trei lățimi.

## 6. Edge Functions

Ce nu are voie în browser, pentru că poate fi falsificat sau are nevoie de secrete:

| Funcție | Rol |
|---|---|
| `place-order` | recalculează prețurile din bază, validează promo, verifică zona de livrare și programul, inserează `orders` + `order_items` + eveniment `created`. Sursa de adevăr pentru totaluri. |
| `geocode` | proxy OpenStreetMap cu cache în `geocode_cache`; ține user-agent-ul și rate-limit-ul în afara browserului |
| `stripe-webhook` | confirmă plata card online, mută `payment_status` pe `paid` |
| `escalate` | trimite webhook-ul de escaladare, marchează `orders.escalated_at` |

Ultimele două se construiesc când intră plata online, respectiv când e configurat
webhook-ul. `place-order` și `geocode` sunt necesare de la început.

Totalul nu se calculează niciodată în browser. Coșul trimite id-uri și cantități;
funcția citește prețurile din bază.

## 7. Corecturi față de vechiul admin

Duse mai departe pentru că sunt greșeli de comportament, nu cosmetică:

1. **Escaladare idempotentă** — dedupe-ul era un `Set` în memorie; la refresh de
   pagină se re-trimiteau webhookuri pentru aceleași comenzi. Trece pe coloana
   `orders.escalated_at`.
2. **Roluri impuse peste tot** — prin RLS, §2.
3. **Reordonare atomică** — prin RPC, §5.
4. **Istoric comenzi** — bordul vechi era limitat la ziua curentă plus comenzile
   active, maximum 200. Tab separat cu interval de date, căutare pe telefon și
   număr de comandă, paginat.
5. **Acțiuni în masă pe produse** — selecție multiplă → disponibil/indisponibil
   dintr-o mișcare. Cazul „s-a terminat la ora 20".

## 8. Ordinea de construcție

1. Migrarea `0005`: politici RLS de scriere cu roluri, `reorder_categories`,
   `reorder_products`, `orders.escalated_at`, bucket `categories` cu politici.
2. Edge Function `place-order` + `geocode`; checkout-ul site-ului se leagă la ele.
   Din acest moment există comenzi reale în bază.
3. `admin-core.js` + login + bordul de comenzi.
4. Catalog: categorii, produse, garanțiile de afișare, preview-ul grilei.
5. Meniul zilei, promo, clienți, rapoarte, setări, bon.
6. Fixul `.catgrid` în site.
7. Ștergerea `src/` și a scaffolding-ului Next.js.

Ștergerea e ultima intenționat: până atunci vechiul admin rămâne funcțional ca
plasă de siguranță și ca referință de comportament.

## 9. Verificare

Nu „compilează, deci merge". Fiecare bucată se probează rulând:

- Comandă reală plasată din site, dusă prin tot pipeline-ul de statusuri, cu jurnal
  verificat în `order_events`.
- Bon printat în `?preview=1`, măsurat pe 80mm.
- Escaladare declanșată, pagină reîncărcată, confirmat că **nu** se retrimite.
- Rol `staff` încearcă să schimbe un preț → refuzat de bază, nu doar ascuns în UI.
- Categorie ștearsă și adăugată la 13, 14, 15, 16 elemente; grila verificată la
  1280px, 900px și 500px.

## 10. Ce rămâne deschis

- **Conturile de client** (`/cont`, istoric, adrese salvate, re-comandă) dispar
  odată cu `src/`. Se pot reconstrui ca pagină statică peste `customer_addresses`
  și `my_customer_id()`, care rămân în schemă. Nu intră în runda asta.
- **Urmărirea comenzii** de către client — la fel, link privat per comandă.
- **Meniul site-ului vine încă din `menu-data.js` hardcodat.** Modificările din
  admin nu apar pe site până când site-ul nu citește din Supabase. Se vede în
  preview-ul din admin. Legătura date → site e proiect separat.
