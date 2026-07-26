-- HASH Bistro — categorii de grilă vs. categorii de extra-uri.
--
-- `sosuri` bloca constrangerea "categorie activa cere imagine": e activa, are 7
-- produse si n-are imagine. Interogarea continutului a lamurit de ce — Sos Glen,
-- Sos dulce, Sos picant, Smantana, Ardei iute, Paine, Chifla, toate 2-5 lei,
-- niciunul cu grupuri de optiuni proprii, si fiecare apare de 16-48 de ori ca
-- optiune pe alte produse.
--
-- Nu e o categorie de meniu, e sertarul de extra-uri. Nu trebuie sa fie card in
-- grila, dar produsele ei trebuie sa ramana disponibile.
--
-- Ascunderea ei nu rupe optiunile de pe alte produse: product_option_items sunt
-- randuri independente, cu nume si pret propriu, fara cheie straina catre
-- produsele astea.

alter table public.categories
  add column if not exists show_in_grid boolean not null default true;

comment on column public.categories.show_in_grid is
  'Apare ca un card in grila de categorii de pe site. False = categorie de '
  'extra-uri, existenta doar ca sa organizeze produse mici.';

update public.categories set show_in_grid = false where slug = 'sosuri';

-- ════════════════════════════════════════════════════════════════════════════
-- Prima garanție de afișare: niciun card rupt, niciodată
-- ════════════════════════════════════════════════════════════════════════════
-- Se aplica doar categoriilor care chiar ajung in grila. O categorie de
-- extra-uri n-are nevoie de imagine, pentru ca nu e desenata nicaieri.

alter table public.categories
  drop constraint if exists categories_grid_needs_image;

alter table public.categories
  add constraint categories_grid_needs_image
  check (image_url is not null or not (active and show_in_grid));

-- ════════════════════════════════════════════════════════════════════════════
-- Convenția pentru imagini
-- ════════════════════════════════════════════════════════════════════════════
-- image_url pastreaza URL-ul canonic al obiectului:
--   .../storage/v1/object/public/categories/<fisier>
--
-- Consumatorii construiesc varianta redimensionata inlocuind
--   /object/public/  ->  /render/image/public/
-- si adaugand ?width=<px>&quality=<n>.
--
-- Masurat pe salate.png (1345 kB original):
--   600px + Accept: image/webp  ->  63 kB
--   300px + Accept: image/webp  ->  33 kB
-- Grila de 15: 19.7 MB -> 0.92 MB la 600px.
--
-- Atentie: transformarea intoarce WebP DOAR daca clientul trimite antetul
-- Accept: image/webp. Fara el primesti tot PNG, iar `quality` n-are efect,
-- pentru ca PNG e fara pierderi. Browserele trimit antetul; scripturile nu.
--
-- Dimensiunea NU se pastreaza in image_url intentionat: ar fixa o marime in
-- baza, iar grila vrea 300px si o pagina de categorie ar vrea 1200.

comment on column public.categories.image_url is
  'URL canonic al obiectului din Storage. Pentru miniaturi, inlocuieste '
  '/object/public/ cu /render/image/public/ si adauga ?width=&quality=.';
