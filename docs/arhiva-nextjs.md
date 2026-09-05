# Arhiva aplicației Next.js

Aplicația Next.js 15 a fost ștearsă din arborele de lucru la consolidarea din
**2026-09-05**, dar nu s-a pierdut nimic: e în istoricul git.

| Commit | Ce conține |
|---|---|
| `26bdcec` | instantaneul complet dinainte de consolidare: `src/` întreg, `package.json`, toate variantele `.dc.html`, pozele, adminul, scripturile |
| `e7214f0` | prima versiune a aplicației, 2026-07-18: site + comenzi online + panou admin |

Ca să te uiți la un fișier fără să restaurezi nimic:

```bash
git show 26bdcec:src/app/imprimare/[id]/page.tsx
git ls-tree -r --name-only 26bdcec -- src/ | less
```

## Ce logică era acolo și trebuie refăcută în adminul static

Toate se sprijină pe aceeași bază Supabase (`has-bistro`, `bymooluipmmzjwblrahn`),
care a rămas neatinsă. Schema e în `supabase/migrations/`.

- **Plasarea comenzii** cu validarea zonei de livrare, client și server.
- **Geocodare** prin Nominatim, cu cache în tabela `geocode_cache`, plus raza
  de 4 km (haversine). În afara zonei: banner roșu + buton Glovo, trimiterea blocată.
- **Imprimarea bonului** la `/imprimare/[id]`: layout de 80 mm, tipărire automată
  la deschidere, `?preview=1` sare peste dialogul de print.
- **Panou admin**: comenzi în timp real (realtime Supabase), catalog, setări
  restaurant și locație („Caută pe hartă"), personal, rapoarte.
- **Stripe** condiționat de chei în `.env.local`; fără chei, „Card online" se ascunde.

Planul pentru adminul static: `docs/specs/2026-07-26-admin-v2-design.md` și
`docs/plans/2026-07-26-admin-v2-fundatie.md`. Ce nu poate rula în browser
(plasarea comenzii, geocodarea, webhook-ul Stripe, escaladarea) devine Supabase
Edge Function.
