# HASH Bistro & Take Away — site + comenzi online

Site de prezentare și magazin online complet pentru HASH Bistro (București), cu panou
de administrare în timp real. Construit cu **Next.js 15 + Tailwind v4 + Supabase**,
identitate vizuală black&gold derivată din flyerele oficiale.

## Pornire locală

```bash
npm install
npm run dev        # http://localhost:3000
```

`.env.local` este deja configurat cu proiectul Supabase `has-bistro`
(`bymooluipmmzjwblrahn`, eu-central-1). Baza de date are schema aplicată
(migrările din `supabase/migrations/`, aplicate în ordine) și meniul complet
seed-uit din flyere: **16 categorii, 107 produse, 382 opțiuni**.

## Conturi

| Rol | URL | Cont |
|---|---|---|
| Panou administrare | `/admin` | `admin@hashbistro.ro` · parola inițială: `HashAdmin2026!` — **schimb-o imediat** (Setări → Personal creezi conturi noi; parola contului admin se schimbă din Supabase Dashboard → Authentication) |
| Client | `/cont` | oricine își poate face cont; comenzile merg și ca vizitator |

## Ce trebuie completat de Liviu / restaurant

1. **Videoclipul din hero** — pune fișierul la `public/media/hero.mp4`
   (până atunci rulează fundalul animat „jar auriu”, arată bine și fără video).
2. **Adresa exactă a restaurantului** — Admin → Setări → „Restaurant și locație” →
   scrie adresa → „Caută pe hartă” → Salvează. *Coordonatele sunt centrul zonei de
   livrare de 4 km* (acum e un pin generic în centrul Bucureștiului).
3. **Stripe (plata online cu cardul)** — creează cont Stripe România, apoi în
   `.env.local`:
   ```
   STRIPE_SECRET_KEY=sk_live_…
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_…
   STRIPE_WEBHOOK_SECRET=whsec_…   # webhook: /api/stripe/webhook, eveniment payment_intent.*
   ```
   Fără chei, opțiunea „Card online” e ascunsă automat — restul metodelor
   (numerar/card la livrare/ridicare) funcționează.
4. **Link Glovo** — Admin → Setări → Glovo (linkul exact al restaurantului).
5. **Imagini produse** — Admin → Produse → ✎ → „Încarcă imagine”. Fără imagine se
   afișează o placă aurie elegantă cu monograma h.

## Funcționalități

**Storefront** (`/`, `/meniu`, `/comanda`, `/comanda/[id]`, `/cont`)
- Hero video full-screen cu fallback animat, bandă rulantă cu preparate
- Meniul Zilei: imagine AI zilnică + configurator (fel principal × garnitură ×
  salată + ciorbă +8 lei)
- Meniu tip „registru”: căutare, rail de categorii cu scrollspy, opțiuni per produs
- Coș persistent, pastilă plutitoare, checkout într-o singură pagină
- **Validarea zonei de livrare**: geocodare (OpenStreetMap) + verificare rază;
  în afara zonei → banner roșu + buton Glovo + ridicare personală; comanda directă
  e blocată și client-side și server-side
- 5 metode de plată; program de funcționare respectat (ASAP doar când e deschis,
  programare în intervalul orar); cod promoțional
- Urmărire comandă în timp real (link privat per comandă)
- Cont client: istoric, adrese salvate, re-comandă; vizitatorii sunt dedupe-uiți
  după telefon în același profil de client

**Admin** (`/admin`)
- Bord live cu Supabase Realtime: sunet repetat până la preluare (WebAudio, fără
  fișiere), notificări browser, titlu tab intermitent, escaladare vizuală + webhook
  configurabil (SMS/WhatsApp prin Make/Zapier/Twilio) după X minute
- Pipeline statusuri: nouă → acceptată → în preparare → gata/în livrare → finalizată
  (+ anulată/rambursată), cu jurnal complet: cine, ce, când
- **Bon 80mm** la `/imprimare/[id]` (auto-print; `?preview=1` pentru verificare),
  buton „Printează bonul” + printare automată la acceptare (opțional, din Setări)
- Produse: CRUD complet, imagini, opțiuni/extra, promoții, ordine, arhivare
- Meniul zilei: încărcare imagine, programare pe date viitoare, expirare automată
- Clienți: statistici, preferate, notițe interne, export CSV
- Rapoarte: azi/7/30/90 zile — încasări pe zile, top produse, metode de plată,
  livrare vs ridicare, top clienți, export CSV comenzi
- Setări: locație+rază, taxe/minim, program+sărbători, pauză comenzi, notificări
  (volum/test/repetare/escaladare), imprimantă, Glovo, personal cu roluri
  (admin/manager/staff)

## Arhitectură

- `src/app/(store)` — storefront · `src/app/admin/(panel)` — panou (gard server-side
  prin tabela `staff`) · `src/app/imprimare` — bon fără chrome
- `src/app/api/*` — creare comenzi (prețurile se recalculează din DB, zona se
  re-verifică server-side), geocodare cu cache în DB, Stripe, mutații admin
- RLS activ pe toate tabelele; scrierile trec doar prin API cu service role;
  clienții își văd doar propriile comenzi; catalogul e public
- `supabase/migrations/` — sursa de adevăr pentru schemă (0001–0004)

## Deploy (Vercel)

```bash
npx vercel deploy   # sau conectează repo-ul în dashboard
```
Setează în Vercel env: cele din `.env.local` (+ Stripe la activare) și schimbă
`NEXT_PUBLIC_SITE_URL`. Rulează `npm run build` local înainte, ca verificare.
