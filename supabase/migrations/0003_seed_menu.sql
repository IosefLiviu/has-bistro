-- HASH Bistro — seed meniu complet (din flyerele oficiale)

insert into public.categories (slug, name, description, sort) values
('meniul-zilei',     'Meniul Zilei',          'Fel principal 180–220g + garnitură + salată — alegerea ta, în fiecare zi.', 1),
('meniuri-speciale', 'Meniuri speciale',      'Farfurii complete, gata de poftă.', 2),
('salate-aperitiv',  'Salate aperitiv',       'Salate mari, servite cu o chiflă.', 3),
('supe-ciorbe',      'Supe și ciorbe',        'Ca la mama acasă, în fiecare zi.', 4),
('peste',            'Pește',                 'Proaspăt, la grătar sau la tigaie.', 5),
('traditionale',     'Mâncare tradițională',  'Gătite după rețete tradiționale.', 6),
('paste',            'Paste',                 'Spaghete sau penne, 350g finit.', 7),
('la-tigaie',        'La tigaie',             'Sotate în tigaie, pline de savoare.', 8),
('gratar',           'Grătar',                'Pe jar, ca la noi.', 9),
('platouri',         'Platouri',              'Pentru 4–6 persoane, gata de petrecere.', 10),
('garnituri',        'Garnituri',             'Din legume fresh.', 11),
('salate',           'Salate de însoțire',    'Porții de 200g.', 12),
('pizza',            'Pizza',                 'Blat întins în casă, copt pe vatră.', 13),
('burgers',          'Burgeri',               'Vită Black Angus, cartofi prăjiți incluși.', 14),
('desert',           'Desert',                'Dulcele de la final.', 15),
('sosuri',           'Sosuri și extra',       'Completează-ți masa.', 16);

-- ─── Meniul Zilei (produs configurabil) ─────────────────────────────────────
with c as (select id from public.categories where slug='meniul-zilei')
insert into public.products (category_id, slug, name, description, weight_label, price, featured, sort)
select c.id, 'meniul-zilei', 'Meniul Zilei',
  'Alege felul principal, garnitura și salata — prânzul complet, gătit în ziua respectivă. Adaugă o ciorbă de 350ml la doar 8 lei.',
  'fel principal 180–220g + garnitură 200–250g + salată 150g', 30, true, 1
from c;

with p as (select id from public.products where slug='meniul-zilei')
insert into public.product_option_groups (product_id, name, required, multi, min_select, max_select, sort)
select p.id, g.name, g.required, false, g.min_select, 1, g.sort from p, (values
  ('Felul principal', true, 1, 1),
  ('Garnitura (200–250g)', true, 1, 2),
  ('Salata (150g)', true, 1, 3),
  ('Pâine', false, 0, 4),
  ('Adaugă o ciorbă (350ml)', false, 0, 5)
) as g(name, required, min_select, sort);

insert into public.product_option_items (group_id, name, price_delta, sort)
select g.id, v.name, v.delta, v.sort
from public.product_option_groups g
join public.products p on p.id = g.product_id and p.slug = 'meniul-zilei'
cross join lateral (values
  ('Felul principal', 'Aripioare la ceaun', 0, 1),
  ('Felul principal', 'Cârnați speciali', 0, 2),
  ('Felul principal', 'Ceafă', 0, 3),
  ('Felul principal', 'Chifteluțe de pui marinate', 0, 4),
  ('Felul principal', 'Chifteluțe de pui simple', 0, 5),
  ('Felul principal', 'Frigărui de pui cu legume', 0, 6),
  ('Felul principal', 'Mici (3 buc)', 0, 7),
  ('Felul principal', 'Mușchi file de porc', 0, 8),
  ('Felul principal', 'Ostropel de pui', 0, 9),
  ('Felul principal', 'Piept de pui la grătar', 0, 10),
  ('Felul principal', 'Pui Shanghai', 0, 11),
  ('Felul principal', 'Pulpă de pui la cuptor', 0, 12),
  ('Felul principal', 'Pulpă dezosată la grătar', 0, 13),
  ('Felul principal', 'Șnițel de porc', 0, 14),
  ('Felul principal', 'Șnițel de pui', 0, 15),
  ('Felul principal', 'Șnițel de pui „California”', 0, 16),
  ('Felul principal', 'Strips piept de pui', 0, 17),
  ('Garnitura (200–250g)', 'Cartofi prăjiți', 0, 1),
  ('Garnitura (200–250g)', 'Piure', 0, 2),
  ('Garnitura (200–250g)', 'Cartofi nature', 0, 3),
  ('Garnitura (200–250g)', 'Cartofi țărănești', 0, 4),
  ('Garnitura (200–250g)', 'Orez libanez', 0, 5),
  ('Garnitura (200–250g)', 'Orez cu legume', 0, 6),
  ('Garnitura (200–250g)', 'Orez cu ciuperci', 0, 7),
  ('Garnitura (200–250g)', 'Mămăligă', 0, 8),
  ('Salata (150g)', 'Varză albă', 0, 1),
  ('Salata (150g)', 'Varză murată', 0, 2),
  ('Salata (150g)', 'Murături asortate', 0, 3),
  ('Salata (150g)', 'Salată de vară', 0, 4),
  ('Pâine', 'Pâine', 0, 1),
  ('Pâine', 'Chiflă', 0, 2),
  ('Adaugă o ciorbă (350ml)', 'Ciorba zilei (350ml)', 8, 1)
) as v(gname, name, delta, sort)
where g.name = v.gname;

-- ─── Meniuri speciale ───────────────────────────────────────────────────────
with c as (select id from public.categories where slug='meniuri-speciale')
insert into public.products (category_id, slug, name, ingredients, weight_label, price, featured, sort)
select c.id, v.slug, v.name, v.ing, v.w, v.price, v.f, v.sort from c, (values
  ('pui-sweet-chilly', 'Pui Sweet Chilly + orez basmati', 'piept de pui, morcov, sos sweet chilly, orez basmati — ușor picant', '100g/150g/150g', 38, false, 1),
  ('pui-curry', 'Pui Curry cu orez basmati', 'piept de pui, ceapă, condimente, orez basmati', '100g/150g/150g', 38, false, 2),
  ('shaorma-pui-farfurie', 'Shaorma de pui la farfurie', 'carne de pui, cartofi prăjiți, salată de varză, ceapă, castraveți murați, maioneză, sos iaurt cu curry', '180g/100g/150g', 35, true, 3),
  ('shaorma-vita', 'Shaorma de vită la farfurie', 'carne de vită, cartofi prăjiți, salată de varză, ceapă, castraveți murați, sos Anatolia', '180g/100g/150g', 42, false, 4),
  ('pastrama-oaie', 'Pastramă de oaie cu mămăligă și usturoi', 'pastramă de oaie, mămăligă, mujdei de usturoi', '180g/200g/50g', 49, false, 5)
) as v(slug, name, ing, w, price, f, sort);

-- ─── Salate aperitiv ────────────────────────────────────────────────────────
with c as (select id from public.categories where slug='salate-aperitiv')
insert into public.products (category_id, slug, name, ingredients, weight_label, price, sort)
select c.id, v.slug, v.name, v.ing, v.w, v.price, v.sort from c, (values
  ('salata-bulgareasca', 'Salată bulgărească', 'salată iceberg, roșii, castraveți, ardei gras, șuncă, măsline, brânză, ou + o chiflă', '400–500g', 32, 1),
  ('salata-caesar', 'Salată Caesar', 'salată iceberg, roșii, castraveți, ardei gras, măsline, piept de pui, sos Caesar + o chiflă', '400g', 35, 2),
  ('salata-con-tonno', 'Salată Con Tonno', 'salată iceberg, roșii, ardei gras, măsline, porumb dulce, ton, lămâie + o chiflă', '400g', 32, 3),
  ('salata-crispy', 'Salată crispy de pui', 'salată iceberg, roșii, castraveți, ardei gras, măsline, piept de pui crispy, dressing + o chiflă', '400g', 30, 4),
  ('salata-somon-fume', 'Salată Somon Fume', 'somon fume, castraveți, salată iceberg, roșii, ardei gras, parmezan, porumb dulce, lămâie + o chiflă', '400g', 38, 5)
) as v(slug, name, ing, w, price, sort);

-- ─── Supe și ciorbe ─────────────────────────────────────────────────────────
with c as (select id from public.categories where slug='supe-ciorbe')
insert into public.products (category_id, slug, name, weight_label, price, sort)
select c.id, v.slug, v.name, v.w, v.price, v.sort from c, (values
  ('supa-pui-galuste', 'Supă de pui cu găluște', '400g/100g', 18, 1),
  ('supa-crema-legume', 'Supă cremă de legume', '400g', 18, 2),
  ('ciorba-burta', 'Ciorbă de burtă', '80g/400g', 20, 3),
  ('ciorba-vacuta', 'Ciorbă de văcuță', '80g/400g', 20, 4),
  ('ciorba-pui-grec', 'Ciorbă de pui a la grec', '80g/400g', 18, 5),
  ('ciorba-perisoare', 'Ciorbă de perișoare de pui', '400g/80g', 18, 6),
  ('fasole-afumatura', 'Fasole cu afumătură', '430g/50g', 18, 7),
  ('ciorba-cartofi-afumatura', 'Ciorbă de cartofi și afumătură', '400g/80g', 25, 8),
  ('fasole-post', 'Fasole de post', '480g', 15, 9),
  ('ciorba-legume-post', 'Ciorbă de legume de post', '480g', 15, 10)
) as v(slug, name, w, price, sort);

-- ─── Pește ──────────────────────────────────────────────────────────────────
with c as (select id from public.categories where slug='peste')
insert into public.products (category_id, slug, name, ingredients, weight_label, price, featured, sort)
select c.id, v.slug, v.name, v.ing, v.w, v.price, v.f, v.sort from c, (values
  ('somon-file', 'File de somon', 'file de somon, orez basmati, lămâie', '220g + orez 150g + lămâie 50g', 55, true, 1),
  ('pastrav-gratar', 'Păstrăv la grătar', 'păstrăv, cartofi nature, lămâie', '250g + cartofi 150g + lămâie 50g', 42, false, 2),
  ('hamsii', 'Hamsii', 'hamsii, mămăligă, mujdei de usturoi', '150g + mămăligă 180g + usturoi 50g', 25, false, 3)
) as v(slug, name, ing, w, price, f, sort);

-- ─── Mâncare tradițională ───────────────────────────────────────────────────
with c as (select id from public.categories where slug='traditionale')
insert into public.products (category_id, slug, name, ingredients, weight_label, price, featured, sort)
select c.id, v.slug, v.name, v.ing, v.w, v.price, v.f, v.sort from c, (values
  ('carcalete', 'Carcalete', 'cartofi prăjiți, ceafă de porc, ou, telemea de vacă, unt', '150g/150g/50g/50g', 44, false, 1),
  ('ciulama-pui', 'Ciulama de pui cu ciuperci și mămăligă', 'pui, ciuperci, stock de pui, smântână de gătit, unt, făină, condimente', '250g/250g', 28, false, 2),
  ('iahnie-carnati', 'Iahnie cu cârnați și salată de murături', 'iahnie de fasole, cârnați, murături asortate', '300g/100g/100g', 28, false, 3),
  ('mamaliga-branza', 'Mămăligă cu brânză și smântână', 'mămăligă, brânză, smântână', '200g/80g/80g', 25, false, 4),
  ('garnitura-zilei-post', 'Mazăre / Iahnie de fasole / Spanac', 'preparat de post, la alegere', '300g', 22, false, 5),
  ('mazare-pui', 'Mazăre cu piept de pui sau aripioare', 'mazăre gătită, piept de pui sau aripioare', '200g/100g', 28, false, 6),
  ('pomana-porcului', 'Pomana porcului cu mămăligă', 'carne de porc, mămăligă', '250g/200g', 35, false, 7),
  ('saramura-pui', 'Saramură de pui cu mămăligă', 'pui, saramură, mămăligă', '250g/200g', 35, false, 8),
  ('sarmale', 'Sarmale cu carne în foi de varză (4 buc)', 'sarmale cu carne în foi de varză, mămăligă', '200g/200g', 35, true, 9),
  ('sarmale-post', 'Sarmale tradiționale de post (4 buc)', 'sarmale de post, mămăligă', '200g/200g', 28, false, 10),
  ('tocanita-cartofi', 'Tocăniță de cartofi cu ciuperci', 'cartofi, ciuperci, legume', '300g', 22, false, 11),
  ('tochitura', 'Tochitură dobrogeană cu mămăligă', 'carne de porc, mămăligă, ou, telemea', '250g/200g/50g/50g', 38, false, 12),
  ('varza-calita', 'Varză călită cu cârnăciori și mămăligă', 'varză călită, cârnăciori, mămăligă', '200g/100g/200g', 36, false, 13)
) as v(slug, name, ing, w, price, f, sort);

-- variante pentru preparatele „la alegere”
with p as (select id from public.products where slug='garnitura-zilei-post')
insert into public.product_option_groups (product_id, name, required, multi, min_select, max_select, sort)
select p.id, 'Alege preparatul', true, false, 1, 1, 1 from p;
insert into public.product_option_items (group_id, name, sort)
select g.id, v.name, v.sort
from public.product_option_groups g
join public.products p on p.id = g.product_id and p.slug='garnitura-zilei-post'
cross join lateral (values ('Mazăre', 1), ('Iahnie de fasole', 2), ('Spanac', 3)) as v(name, sort);

with p as (select id from public.products where slug='mazare-pui')
insert into public.product_option_groups (product_id, name, required, multi, min_select, max_select, sort)
select p.id, 'Alege carnea', true, false, 1, 1, 1 from p;
insert into public.product_option_items (group_id, name, sort)
select g.id, v.name, v.sort
from public.product_option_groups g
join public.products p on p.id = g.product_id and p.slug='mazare-pui'
cross join lateral (values ('Piept de pui', 1), ('Aripioare', 2)) as v(name, sort);

-- ─── Paste ──────────────────────────────────────────────────────────────────
with c as (select id from public.categories where slug='paste')
insert into public.products (category_id, slug, name, ingredients, weight_label, price, sort)
select c.id, v.slug, v.name, v.ing, '350g finit', v.price, v.sort from c, (values
  ('paste-amatriciana', 'Paste Amatriciana', 'paste grana duro, sos de roșii, bacon, usturoi, busuioc, parmezan, ulei de măsline, condimente', 30, 1),
  ('paste-bolognese', 'Paste Bolognese', 'paste grana duro, sos de roșii, carne de vită, sos ragu, parmezan, ulei de măsline, condimente', 35, 2),
  ('paste-carbonara', 'Paste Carbonara', 'paste grana duro, smântână de gătit, ouă, bacon, usturoi, busuioc, parmezan, ulei de măsline, condimente', 30, 3),
  ('paste-ton', 'Paste cu ton', 'paste grana duro, ton, roșii, porumb, ceapă, capere, usturoi, busuioc, parmezan, ulei de măsline, condimente', 30, 4),
  ('paste-milanese', 'Paste Milanese', 'paste grana duro, sos de roșii, șuncă, ciuperci, usturoi, busuioc, parmezan, ulei de măsline, condimente', 30, 5),
  ('paste-quattro-formaggi', 'Paste Quattro Formaggi', 'paste grana duro, smântână de gătit, gorgonzola, mozzarella, cașcaval afumat, brânză brie, busuioc, parmezan, ulei de măsline', 35, 6),
  ('paste-siciliene', 'Paste Siciliene', 'paste grana duro, sos de roșii, piept de pui, măsline, ciuperci, usturoi, busuioc, parmezan, ulei de măsline, condimente', 30, 7)
) as v(slug, name, ing, price, sort);

with pg as (
  insert into public.product_option_groups (product_id, name, required, multi, min_select, max_select, sort)
  select p.id, 'Alege pastele', true, false, 1, 1, 0
  from public.products p join public.categories c on c.id = p.category_id
  where c.slug = 'paste'
  returning id
)
insert into public.product_option_items (group_id, name, sort)
select pg.id, v.name, v.sort from pg cross join lateral (values ('Spaghete', 1), ('Penne', 2)) as v(name, sort);

-- ─── La tigaie ──────────────────────────────────────────────────────────────
with c as (select id from public.categories where slug='la-tigaie')
insert into public.products (category_id, slug, name, ingredients, weight_label, price, sort)
select c.id, v.slug, v.name, v.ing, v.w, v.price, v.sort from c, (values
  ('ficatei-vin', 'Ficăței în sos de vin', 'ficăței de pasăre, unt, ulei de floarea-soarelui, vin alb, sare, piper', '250g', 22, 1),
  ('ficatei-lionezi', 'Ficăței Lionezi', 'ficăței de pasăre, ceapă, unt, ulei de floarea-soarelui, vin alb, sare, piper', '250g', 24, 2),
  ('tigaie-pui-porc', 'Tigaie de pui, porc sau mix', 'pui/porc, ceapă, ardei gras, morcov, țelină, ciuperci, usturoi, vin alb, condimente — normală sau picantă', '100g/200g', 32, 3),
  ('piept-gorgonzola', 'Piept de pui cu sos gorgonzola', 'piept de pui, brânză gorgonzola, unt, smântână de gătit, condimente', '180g/150g', 35, 4),
  ('tigaie-vita-rodie', 'Tigaie de vită cu sos de rodie', 'vită, ceapă, ardei gras, sos de rodie, condimente', '180g/150g', 47, 5),
  ('wok-pui', 'Wok de pui', 'piept de pui, ceapă, morcov, țelină, ciuperci, usturoi, ghimbir, ulei de susan, sos soia, semințe de susan', '250g', 28, 6),
  ('noodles-legume', 'Noodles cu legume (de post)', 'tăiței, ceapă, morcov, țelină, ciuperci, usturoi, ghimbir, ulei de susan, sos soia, condimente', '350g', 35, 7),
  ('noodles-pui', 'Noodles cu pui și legume', 'tăiței, piept de pui, ceapă, morcov, țelină, ciuperci, usturoi, ghimbir, ulei de susan, sos soia, condimente', '350g', 38, 8)
) as v(slug, name, ing, w, price, sort);

with p as (select id from public.products where slug='tigaie-pui-porc')
insert into public.product_option_groups (product_id, name, required, multi, min_select, max_select, sort)
select p.id, g.name, true, false, 1, 1, g.sort from p, (values ('Alege carnea', 1), ('Cum o vrei?', 2)) as g(name, sort);
insert into public.product_option_items (group_id, name, sort)
select g.id, v.name, v.sort
from public.product_option_groups g
join public.products p on p.id = g.product_id and p.slug='tigaie-pui-porc'
cross join lateral (values
  ('Alege carnea', 'Pui', 1), ('Alege carnea', 'Porc', 2), ('Alege carnea', 'Mix', 3),
  ('Cum o vrei?', 'Normală', 1), ('Cum o vrei?', 'Picantă', 2)
) as v(gname, name, sort)
where g.name = v.gname;

-- ─── Grătar ─────────────────────────────────────────────────────────────────
with c as (select id from public.categories where slug='gratar')
insert into public.products (category_id, slug, name, ingredients, weight_label, price, featured, sort)
select c.id, v.slug, v.name, v.ing, v.w, v.price, v.f, v.sort from c, (values
  ('ceafa-porc', 'Ceafă de porc', null, '220g', 25, false, 1),
  ('frigarui-pui', 'Frigărui de pui cu legume (2 buc)', 'piept de pui, legume', '250g', 22, false, 2),
  ('mici', 'Mici (1 buc)', 'amestec de vită și porc', '60g', 6, false, 3),
  ('muschi-cotlet-porc', 'Mușchi file sau cotlet de porc', null, '250g', 18, false, 4),
  ('piept-pui-gratar', 'Piept de pui la grătar', null, '180g', 18, false, 5),
  ('pulpa-dezosata', 'Pulpă dezosată la grătar', null, '180g', 18, false, 6),
  ('scaricica-fleica', 'Scăricică sau fleică de porc', null, '200g', 18, false, 7),
  ('piept-pui-ou-cheddar', 'Piept de pui cu ou și cheddar', 'piept de pui, ou, cheddar', '180g/50g/50g', 39, false, 8),
  ('cotlet-berbecut', 'Cotlet de berbecuț (3–4 buc)', null, '300g', 51, true, 9)
) as v(slug, name, ing, w, price, f, sort);

with p as (select id from public.products where slug='muschi-cotlet-porc')
insert into public.product_option_groups (product_id, name, required, multi, min_select, max_select, sort)
select p.id, 'Alege bucata', true, false, 1, 1, 1 from p;
insert into public.product_option_items (group_id, name, sort)
select g.id, v.name, v.sort
from public.product_option_groups g
join public.products p on p.id = g.product_id and p.slug='muschi-cotlet-porc'
cross join lateral (values ('Mușchi file', 1), ('Cotlet de porc', 2)) as v(name, sort);

with p as (select id from public.products where slug='scaricica-fleica')
insert into public.product_option_groups (product_id, name, required, multi, min_select, max_select, sort)
select p.id, 'Alege bucata', true, false, 1, 1, 1 from p;
insert into public.product_option_items (group_id, name, sort)
select g.id, v.name, v.sort
from public.product_option_groups g
join public.products p on p.id = g.product_id and p.slug='scaricica-fleica'
cross join lateral (values ('Scăricică', 1), ('Fleică de porc', 2)) as v(name, sort);

-- ─── Platouri ───────────────────────────────────────────────────────────────
with c as (select id from public.categories where slug='platouri')
insert into public.products (category_id, slug, name, ingredients, weight_label, price, featured, sort)
select c.id, v.slug, v.name, v.ing, v.w, v.price, v.f, v.sort from c, (values
  ('platou-cald', 'Platou cald (4–6 persoane)', 'mici 6 buc, cârnați extra 6 buc, Shanghai (gujon) 14 buc, chifteluțe de pui 12 buc, cașcaval pane 6 buc, cartofi prăjiți 6 porții, murături 6 porții, chifle, muștar — tacâmuri incluse', 'pentru 4–6 persoane', 240, true, 1),
  ('platou-mix-grill', 'Platou mix grill (4–6 persoane)', 'mici 6 buc, piept de pui 6 buc, frigărui de pui 6 buc, cârnați 6 buc, cartofi prăjiți 6 porții, murături 6 porții, chifle — tacâmuri incluse', 'pentru 4–6 persoane', 300, false, 2)
) as v(slug, name, ing, w, price, f, sort);

-- ─── Garnituri ──────────────────────────────────────────────────────────────
with c as (select id from public.categories where slug='garnituri')
insert into public.products (category_id, slug, name, weight_label, price, sort)
select c.id, v.slug, v.name, '200g', v.price, v.sort from c, (values
  ('cartofi-nature', 'Cartofi nature', 8, 1),
  ('cartofi-prajiti', 'Cartofi prăjiți', 8, 2),
  ('cartofi-rustici', 'Cartofi rustici', 13, 3),
  ('mamaliga', 'Mămăligă', 8, 4),
  ('orez-basmati-legume', 'Orez basmati cu legume', 15, 5),
  ('piure-cartofi', 'Piure de cartofi', 13, 6)
) as v(slug, name, price, sort);

-- ─── Salate de însoțire ─────────────────────────────────────────────────────
with c as (select id from public.categories where slug='salate')
insert into public.products (category_id, slug, name, ingredients, weight_label, price, sort)
select c.id, v.slug, v.name, v.ing, '200g', 10, v.sort from c, (values
  ('salata-castraveti', 'Castraveți verzi', 'castraveți verzi, oțet, ulei de floarea-soarelui, mărar, sare', 1),
  ('salata-muraturi', 'Murături asortate', 'varză murată, gogonele, gogoșar murat, castravete murat, mărar, boia dulce', 2),
  ('salata-rosii', 'Roșii', 'roșii, ulei de floarea-soarelui, sare, piper', 3),
  ('salata-vara', 'Salată de vară', 'roșii, castraveți, ceapă, ardei gras, salată iceberg, ulei, oțet, sare', 4),
  ('salata-varza-alba', 'Varză albă', 'varză albă, morcov, mărar, ulei de floarea-soarelui, oțet, sare', 5),
  ('salata-varza-murata', 'Varză murată', 'varză murată, ulei de floarea-soarelui, mărar, boia dulce', 6)
) as v(slug, name, ing, sort);

-- ─── Pizza ──────────────────────────────────────────────────────────────────
with c as (select id from public.categories where slug='pizza')
insert into public.products (category_id, slug, name, ingredients, price, featured, sort)
select c.id, v.slug, v.name, v.ing, v.price, v.f, v.sort from c, (values
  ('pizza-margherita', 'Pizza Margherita', 'blat pizza, sos de roșii, mozzarella, busuioc', 32, false, 1),
  ('pizza-capriciosa', 'Pizza Capriciosa', 'blat pizza, sos de roșii, mozzarella, șuncă, ciuperci, măsline', 39, false, 2),
  ('pizza-carbonara', 'Pizza Carbonara', 'blat pizza, sos alb, mozzarella, șuncă, parmezan, ou, usturoi', 43, false, 3),
  ('pizza-carnivora', 'Pizza Carnivora', 'blat pizza, sos de roșii, mozzarella, salam chorizo, salam picant, bacon, piept de pui, cârnăciori', 43, false, 4),
  ('pizza-hash', 'Pizza H''ash', 'blat pizza, salam, cârnăciori, ciuperci, măsline, ardei gras, porumb, ceapă, prosciutto', 45, true, 5),
  ('pizza-diavola', 'Pizza Diavola', 'blat pizza, sos de roșii, mozzarella, salam picant, ardei iute', 37, false, 6),
  ('pizza-funghi', 'Pizza Funghi', 'blat pizza, sos de roșii, mozzarella, ciuperci, oregano', 35, false, 7),
  ('pizza-hawai', 'Pizza Hawai', 'blat pizza, sos de roșii, șuncă, mozzarella, ananas, porumb', 38, false, 8),
  ('pizza-polo-funghi', 'Pizza Polo e Funghi', 'blat pizza, sos de roșii, mozzarella, piept de pui, ciuperci, porumb', 39, false, 9),
  ('pizza-prosciutto-funghi', 'Pizza Prosciutto Funghi', 'blat pizza, sos de roșii, mozzarella, șuncă, ciuperci', 37, false, 10),
  ('pizza-per-bambini', 'Pizza per Bambini', 'blat pizza, sos de roșii, mozzarella, șuncă, porumb', 36, false, 11),
  ('pizza-quattro-stagioni', 'Pizza Quattro Stagioni', 'blat pizza, sos de roșii, mozzarella, șuncă, salam, ciuperci, măsline', 39, false, 12),
  ('pizza-quattro-formaggi', 'Pizza Quattro Formaggi', 'blat pizza, sos alb, mozzarella, cașcaval afumat, gorgonzola, parmezan', 42, false, 13),
  ('pizza-tonno', 'Pizza Tonno', 'blat pizza, sos de roșii, mozzarella, ton, ceapă, capere, porumb', 39, false, 14),
  ('pizza-summer', 'Pizza Summer', 'blat pizza, sos de roșii, mozzarella, dovlecel, roșii cherry, ciuperci, porumb, ceapă, ardei gras, măsline', 39, false, 15),
  ('pizza-nordica', 'Pizza Nordica', 'blat pizza, sos de roșii, mozzarella, lămâie, capere, ceapă, smântână, somon afumat', 45, false, 16)
) as v(slug, name, ing, price, f, sort);

-- topping-uri extra pentru toate pizzele
with pg as (
  insert into public.product_option_groups (product_id, name, required, multi, min_select, max_select, sort)
  select p.id, 'Extra topping', false, true, 0, 10, 1
  from public.products p join public.categories c on c.id = p.category_id
  where c.slug = 'pizza'
  returning id
)
insert into public.product_option_items (group_id, name, price_delta, sort)
select pg.id, v.name, v.delta, v.sort from pg cross join lateral (values
  ('Mozzarella', 5, 1), ('Ardei', 5, 2), ('Măsline', 5, 3), ('Ciuperci', 5, 4),
  ('Porumb', 5, 5), ('Ananas', 5, 6), ('Ceapă', 5, 7), ('Roșii', 5, 8), ('Șuncă', 5, 9),
  ('Bacon', 6, 10), ('Cârnați', 6, 11), ('Ton', 6, 12), ('Salam', 6, 13),
  ('Parmezan', 6, 14), ('Piept de pui', 6, 15)
) as v(name, delta, sort);

with pg as (
  insert into public.product_option_groups (product_id, name, required, multi, min_select, max_select, sort)
  select p.id, 'Sosuri', false, true, 0, 5, 2
  from public.products p join public.categories c on c.id = p.category_id
  where c.slug = 'pizza'
  returning id
)
insert into public.product_option_items (group_id, name, price_delta, sort)
select pg.id, v.name, v.delta, v.sort from pg cross join lateral (values
  ('Sos dulce', 5, 1), ('Sos picant', 5, 2), ('Sos Glen', 5, 3), ('Smântână', 5, 4), ('Ardei iute', 2, 5)
) as v(name, delta, sort);

-- ─── Burgeri ────────────────────────────────────────────────────────────────
with c as (select id from public.categories where slug='burgers')
insert into public.products (category_id, slug, name, ingredients, weight_label, price, featured, sort)
select c.id, v.slug, v.name, v.ing, v.w, v.price, v.f, v.sort from c, (values
  ('burger-hash', 'Burger H''ash', 'chiflă, vită Black Angus, cheddar, salată, ceapă caramelizată, castravete murat, bacon, sos H''ash — cu cartofi prăjiți', '400g/80g', 40, true, 1),
  ('burger-chicken-hash', 'Burger Chicken H''ash', 'chiflă, piept de pui crispy, cheddar, salată, castravete murat, ceapă caramelizată, bacon, sos H''ash — cu cartofi prăjiți', '400g/80g', 38, false, 2),
  ('burger-clasic', 'Burger Clasic', 'chiflă, vită Black Angus, roșie, salată, ceapă roșie, castravete murat, sos H''ash — cu cartofi prăjiți', '400g/80g', 32, false, 3),
  ('dublu-cheeseburger', 'Dublu Cheeseburger', 'chiflă, 2× vită Black Angus, ceapă roșie, salată, cheddar, castravete murat, ceapă caramelizată, sos H''ash — cu cartofi prăjiți', '550g/80g', 59, false, 4)
) as v(slug, name, ing, w, price, f, sort);

-- ─── Desert ─────────────────────────────────────────────────────────────────
with c as (select id from public.categories where slug='desert')
insert into public.products (category_id, slug, name, ingredients, weight_label, price, featured, sort)
select c.id, v.slug, v.name, v.ing, v.w, v.price, v.f, v.sort from c, (values
  ('clatite-dulceata', 'Clătite cu dulceață', 'clătite, dulceață de vișine sau afine', '250g', 15, false, 1),
  ('clatite-nutella', 'Clătite cu Nutella', 'clătite, cremă Nutella', '250g', 18, false, 2),
  ('clatite-nutella-banane', 'Clătite cu Nutella, banane și nucă', 'clătite, Nutella, banane, nucă', '350g', 20, false, 3),
  ('papanasi-nutella', 'Papanași cu ciocolată Nutella', 'papanași, ciocolată Nutella', '250g/80g/50g', 25, true, 4),
  ('papanasi-smantana', 'Papanași cu smântână și dulceață de afine', 'papanași, smântână, dulceață de afine', '250g/80g/50g', 25, false, 5)
) as v(slug, name, ing, w, price, f, sort);

with p as (select id from public.products where slug='clatite-dulceata')
insert into public.product_option_groups (product_id, name, required, multi, min_select, max_select, sort)
select p.id, 'Alege dulceața', true, false, 1, 1, 1 from p;
insert into public.product_option_items (group_id, name, sort)
select g.id, v.name, v.sort
from public.product_option_groups g
join public.products p on p.id = g.product_id and p.slug='clatite-dulceata'
cross join lateral (values ('Vișine', 1), ('Afine', 2)) as v(name, sort);

-- ─── Sosuri și extra ────────────────────────────────────────────────────────
with c as (select id from public.categories where slug='sosuri')
insert into public.products (category_id, slug, name, price, sort)
select c.id, v.slug, v.name, v.price, v.sort from c, (values
  ('sos-glen', 'Sos Glen', 5, 1),
  ('sos-dulce', 'Sos dulce', 5, 2),
  ('sos-picant', 'Sos picant', 5, 3),
  ('smantana', 'Smântână', 5, 4),
  ('ardei-iute', 'Ardei iute', 2, 5),
  ('paine', 'Pâine', 3, 6),
  ('chifla', 'Chiflă', 3, 7)
) as v(slug, name, price, sort);
