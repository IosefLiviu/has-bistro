# H'ash Bistro & Take-Away — site + admin

Un singur folder, un singur repo. Ce e la rădăcină este **exact ce rulează pe
https://has-bistro.vercel.app** (proiectul Vercel `has-bistro`). Restul e
adminul, baza de date și materialul de lucru.

## Structura

| Ce | Rol |
|---|---|
| `index.html` | site-ul — markup, stiluri, meniul în două stări, coșul, harta zonei de livrare; format DC (`{{ }}`, `sc-if`, `sc-for`) |
| `support.js` | runtime-ul DC care randează template-ul |
| `image-slot.js` | componenta pentru sloturile de imagine |
| `menu-data.js` | meniul afișat pe site: categorii, preparate, prețuri, opțiuni |
| `img/` | logo-ul (SVG, extras din flyer), pozele de categorii, produse și bannerele din avizier |
| `video/` | filmul din hero (webm + mp4) și posterul lui |
| `vendor/leaflet/` | harta zonei de livrare, servită local |
| `flyer-img/` | imaginile din flyerul oficial (site-ul folosește doar `p5-10`) |
| `admin/` | panoul de administrare, pagină statică + Supabase JS de pe CDN; **nu e încă pe Vercel** |
| `supabase/migrations/` | schema bazei de date, sursa de adevăr: 16 categorii / 107 produse / 382 opțiuni, roluri, RLS, funcții |
| `supabase/tests/` | probe RLS și cap-la-cap cu cheia publishable |
| `scripts/` | generarea/normalizarea pozelor, extragerea logo-ului, `gen-admin-config.mjs` |
| `docs/specs`, `docs/plans`, `notes/` | specificații, planuri, brand |
| `uploads/` | flyerele PDF originale (sursa vectorială a siglei) |

Ce nu se deploy-ază este listat în `.vercelignore`.

## Rulare locală

Trebuie servit de un server, fișierele se referă relativ:

```bash
python3 -m http.server 4321 --bind 127.0.0.1
```

Site: http://localhost:4321 · Admin: http://localhost:4321/admin/

Adminul cere `admin/config.js` (ignorat de git, ține cheia publishable):

```bash
node scripts/gen-admin-config.mjs
```

## Deploy

Proiectul Vercel `has-bistro` a fost publicat manual (`vercel deploy --prod`),
fără legătură cu git. Din rădăcina acestui folder:

```bash
vercel link --yes --project has-bistro && vercel deploy --prod --yes
```

## Date reale (confirmate de Liviu, 2026-08-23)

- telefon unic **0722 305 909**
- program **L–S 11:00–22:00, D 12:00–22:00**
- adresă **Str. Cireșar 22, Bragadiru, Ilfov**
- livrare pe o rază de 4 km în jurul restaurantului

## Istoric

Până în iulie 2026 exista o aplicație Next.js (comenzi online, geocodare,
imprimarea bonului, panou admin). A fost înlocuită cu site-ul static + adminul
static + Supabase. Codul ei rămâne în istoricul git, vezi `docs/arhiva-nextjs.md`.
