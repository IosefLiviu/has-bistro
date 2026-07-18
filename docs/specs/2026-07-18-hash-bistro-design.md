# HASH Bistro — Website & Ordering System — Design Spec

Date: 2026-07-18 · Status: approved for implementation (autonomous build, decisions delegated by Liviu)

## 1. Brand system (extracted from official flyers)

- **Identity**: HASH Bistro & Take Away, gold circular lettermark with script "h", tagline *"Poftiți la masă!"*, phones 0722 305 909 / 0730 411 042, program Luni–Duminică 10:00–22:00. Location: Bucharest (exact address configurable in admin — not public online; placeholder pin used until staff sets it).
- **Palette**: near-black canvas `#0A0A0B`, elevated surfaces `#141416`/`#1B1B1F`; gold gradient `#F5C044 → #D99A26 → #A8690F` (flyer gold); hot highlight `#FFE9A8`; cream text `#F5EFE4`; muted `#9C948A`; alert red `#E5484D` (flyer's "8 LEI" red); success green for order states.
- **Type**: Display **Sora** (bold geometric, matches flyer headers, latin-ext for diacritics); UI/body **Manrope**; script accent **Great Vibes** for taglines (latin-ext). Prices in tabular numerals.
- **Texture/motion**: 3% SVG film grain, gold shimmer on hover, dark vignettes over photography, slow ember-gradient animation as video fallback. Category headers reproduce the flyer's gold pill with black bold text.

## 2. UX concept — "Linia de comandă" (the kitchen pass)

Storefront reads like a cinematic menu ledger; ordering is 3 taps from anywhere.

- **Hero**: 100svh video (`/media/hero.mp4`, poster + animated gold-ember CSS fallback until Liviu drops in the professional video), script tagline draws in, CTAs "Comandă acum" / "Vezi meniul", infinite dish ticker along the bottom edge like an order rail.
- **Meniul Zilei**: spotlight card on home — daily AI image in a gold frame, date stamp, 30 lei, configurator (fel principal + garnitură + salată, upsell ciorbă +8 lei → 38 lei), managed from admin with scheduling/auto-expiry/archive.
- **Menu** (`/meniu`): sticky gold-pill category rail (horizontal chips on mobile, side rail on desktop), products as editorial rows with dotted leaders `Nume …… preț` + thumbnail; tap opens bottom-sheet with description, ingredients, allergens, option groups, qty; instant `+` quick-add for optionless products. Search. Unavailable items shown dimmed with "Indisponibil".
- **Cart**: floating gold pill (count + total) bottom-center mobile / drawer desktop; localStorage persistence.
- **Checkout** (`/comanda`): single page, sections Livrare→Date→Plată; delivery/pickup toggle; address field geocodes on blur (Nominatim, `countrycodes=ro`) → haversine vs restaurant pin; **outside 4 km ⇒ red banner + Glovo button, direct checkout blocked**; inside ⇒ green confirmation + fee. ASAP or scheduled time within working hours. 5 payment methods: card online (Stripe, hidden when keys absent), cash/card la livrare, cash/card la ridicare. Guest or logged-in; guests deduped into `customers` by normalized phone.
- **Tracking** (`/comanda/[id]`): live status timeline via Supabase Realtime, restaurant contact, reorder.
- **Account** (`/cont`): email+password (Supabase Auth), order history, saved addresses, one-tap reorder.

## 3. Architecture

- **Next.js 15** App Router + TS + Tailwind v4. RSC for catalog; client islands for cart/checkout/admin.
- **Supabase** `bymooluipmmzjwblrahn` (eu-central-1): Postgres+RLS, Realtime (orders INSERT/UPDATE → admin board), Storage buckets `products`, `daily-menu`, Auth (customers + staff; staff = row in `staff` table keyed by auth uid, roles admin/manager/staff).
- **API route handlers** (service role, server-only): `POST /api/orders` re-validates prices from DB, recomputes totals, re-checks zone server-side, upserts customer by phone; `GET /api/orders/[id]` for guest tracking; `/api/geocode` Nominatim proxy with DB cache + rate courtesy; `/api/checkout/intent` + `/api/stripe/webhook` (payment_status=paid); admin mutations under `/api/admin/*` guarded by staff check.
- **Payments**: Stripe (RON). Rationale vs Netopia: instant test mode, superior API, Apple/Google Pay; swap-friendly via single payments module. Offline methods bypass processor entirely.
- **Notifications (admin)**: realtime INSERT → looping WebAudio chime (configurable sound/volume) + Notification API + tab-title flash + pulsing card until *Preia comanda* (sets acknowledged/accepted, staff attribution, timestamps). Unacknowledged past threshold ⇒ visual escalation + faster chime + optional escalation webhook URL (for WhatsApp/SMS bridge) — configurable in Setări, with quiet-hours.
- **Printing**: `/admin/comenzi/[id]/print` — 72mm-wide receipt CSS (`@page` 80mm), full order payload, `Print` button + auto-print-on-accept toggle stored in settings (per-device localStorage override).

## 4. Data model (Postgres)

`categories` (slug, name, sort, active) · `products` (category, slug, name, description, ingredients, allergens[], weight_label, price, promo_price/label, image_url, available, featured, sort, archived) · `product_option_groups` (product, name, required, multi, min/max, sort) + `product_option_items` (name, price_delta, default, available) · `daily_menus` (menu_date unique, title, description, price, image_url, published, available) · `customers` (phone unique, name, email, auth_user_id, notes) + view `customer_stats` (orders_count, total_spent, last_order_at, top_products) · `customer_addresses` (label, street, details, lat/lng, is_default) · `orders` (order_number identity 1001+, uuid pk for public link, type delivery/pickup, status: new→accepted→preparing→ready→out_for_delivery→completed | cancelled | refunded, payment_method ∈ {card_online, cash_delivery, card_delivery, cash_pickup, card_pickup}, payment_status ∈ {pending, paid, failed, refunded}, snapshots of customer+address jsonb, requested_time, subtotal/delivery_fee/discount/total, promo_code, stripe_payment_intent, acknowledged/accepted/completed timestamps + staff ids) · `order_items` (name/price snapshots, qty, options jsonb, notes) · `order_events` (audit: who, what, from→to, when) · `staff` (uid, name, role, active) · `settings` (key/value jsonb: restaurant info+pin, delivery fee/min/radius, hours, notification config, printer config, glovo_url, stripe toggle) · `promo_codes` · `geocode_cache`.

**RLS**: anon SELECT on catalog + published daily menus + public settings; orders/customers only staff (full) or owning authenticated customer; all writes to orders via service role API. Realtime channel restricted by staff RLS.

## 5. Seed

Real menu from flyers (~100 items, 15 categories): Meniul Zilei (30 lei, 16 feluri × 8 garnituri × 4 salate + ciorbă +8), Meniuri speciale, Salate aperitiv, Supe/Ciorbe, Pește, Mâncare tradițională, Paste, La tigaie, Grătar (+ platouri 240/300), Garnituri, Salate de însoțire, Pizza (16 + extra topping options), Burgers, Desert, Sosuri/Extra. Prices exactly as printed.

## 6. Non-goals (v1)

Fiscal receipt integration (printer is non-fiscal), courier GPS tracking, multi-restaurant, i18n (site is Romanian-only per brand), native apps. Escalation SMS/WhatsApp ships as webhook hook, provider wiring documented.

## 7. Verification plan

Boot dev server; Playwright/browser pass: in-zone order (cash la livrare) → appears realtime in admin with sound state, acknowledge → accept → …→ completed with audit trail; out-of-zone address shows red banner + Glovo and blocks submit; pickup order with scheduled time; print view renders 80mm; mobile viewport (375px) for home/menu/checkout; Lighthouse-style sanity on image sizes and CLS.
