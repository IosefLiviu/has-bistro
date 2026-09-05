#!/bin/bash
# Generează pozele de preparat în stilul cardurilor de categorie HASH.
# Fiecare rulare = 7 credite Higgsfield (GPT Image 2, 2k, 1:1).

SP="/private/tmp/claude-501/-Users-iosefliviu-Proiecte-Liviu-HAS-BISTRO/2fb8b81e-85d9-45cd-828d-4c83b60bf0b7/scratchpad"
OUT="$SP/out"
mkdir -p "$OUT"
LOG="$SP/batch.log"

FIDELITY="Reproduce the reference dish exactly: same ingredients, same quantity, same arrangement, same modest single portion, same colours, same proportions. Do not add any ingredient, do not remove any ingredient, do not invent garnishes, do not increase the amount of food, do not pile it higher, do not overfill."

PLATE="The ONLY change is the presentation: the food is moved onto a plain glossy white round ceramic plate with a wide clean visible rim, isolated on a pure white seamless background, soft realistic drop shadow under the plate, camera at a 45 degree elevated three-quarter angle so the plate reads as an ellipse. Clean menu catalogue food photography. No props, no table, no cutlery, no wooden board, no text, no hands."

PIZZA="The ONLY change is the presentation: the pizza is isolated on a pure white seamless background with no plate and no board underneath it, soft realistic drop shadow directly under the pizza, camera at a 45 degree elevated three-quarter angle so the pizza reads as an ellipse. Clean menu catalogue food photography. No props, no table, no cutlery, no text, no hands."

gen() {
  local src="$1" slug="$2" style="$3" ctx="$4"
  echo "=== $slug ($src) ===" >> "$LOG"
  local url
  url=$(higgsfield product-photoshoot create \
        --mode product_shot \
        --image "$SP/src/$src.jpeg" \
        --aspect_ratio 1:1 --count 1 \
        --product_context "$ctx" \
        --prompt "$FIDELITY $style" 2>>"$LOG" | grep -o 'https://[^ ]*' | tail -1)
  if [ -n "$url" ]; then
    /usr/bin/curl -sS -o "$OUT/$slug.png" "$url" && echo "OK $slug" >> "$LOG"
    echo "OK $slug"
  else
    echo "FAIL $slug" >> "$LOG"
    echo "FAIL $slug"
  fi
}

gen 02 "cheesy-bacon-fried" "$PLATE" \
"Cheesy bacon fried: a portion of french fries completely smothered in thick orange cheddar cheese sauce, with cubes of pink ham and bacon mixed through, topped with TWO fried eggs sunny side up with set white and soft yolk, dusted with red paprika. Currently served in a small black oval cast-iron skillet. No vegetables, no salad, no bread."

gen 04 "pizza-crispy" "$PIZZA" \
"Pizza Crispy: a round pizza with a thick puffy golden crust, tomato sauce and melted mozzarella base, red bell pepper pieces, topped with strips of breaded crispy fried chicken and a generous scattering of french fries, finished with a lattice drizzle of bright yellow-orange cheddar sauce piped across the whole surface. Whole uncut pizza."

gen 06 "pizza-hash" "$PIZZA" \
"Pizza Hash: a round pizza with a thick puffy golden crust, tomato sauce and melted mozzarella, topped with sliced black olives, sweet corn kernels, strips of red bell pepper, slivers of red onion and pieces of ham. Whole uncut pizza, no drizzle, no fries."

gen 09 "muschi-de-vita" "$PLATE" \
"Muschi de vita: one thick grilled beef tenderloin steak with a dark seared crust, topped with a small tuft of pea microgreens; next to it a pile of golden french fries, three round lemon slices, one quenelle of pale green herb butter sitting on a lemon slice, one whole cherry tomato, and a small blue ceramic bowl of creamy white garlic sauce. Currently served on a wooden board."

gen 14 "bruschete" "$PLATE" \
"Bruschete: about six oval slices of toasted baguette, each topped with tomato, melted mozzarella and slices of pink prosciutto or ham, some with black olive pieces, garnished with fresh green basil leaves and fine julienne of leek and thin red chili slivers. Currently arranged on a wooden board."

gen S-bulgareasca "salata-bulgareasca" "$PLATE" \
"Salata bulgareasca: a bed of chopped iceberg lettuce with chunks of red tomato, cubes of pink ham, cubes of white telemea cheese, black olives, strips of green pepper, topped with a fan of sliced hard-boiled egg, finished with a drizzle of dark balsamic glaze. One single salad portion."

gen 17 "coasta-porc-bbq" "$PLATE" \
"Coasta de porc cu sos barbecue: one whole slab of pork ribs glazed deep glossy red-brown with barbecue sauce, next to a round moulded mound of yellow mashed potato, a small metal cup of dark barbecue sauce, and a small pile of golden french fries. Currently served on a wooden board."

gen 20 "tagliatele-fructe-de-mare" "$PLATE" \
"Tagliatele cu fructe de mare: a nest of flat tagliatele pasta in a pale creamy white sauce, with whole pink shrimp, small pieces of shelled seafood and mussel meat mixed through, dusted with finely grated parmesan and topped with a small sprig of green microgreens. One single portion."

gen 21 "burger-chicken-hash" "$PLATE" \
"Burger Chicken Hash: a tall burger on a sesame seed bun dusted with grated parmesan, filled with two breaded fried chicken fillets, melted cheddar slices, iceberg lettuce, tomato slices and bacon, held with a wooden skewer; beside it a pile of thick hand-cut french fries, a small pale green ceramic bowl of creamy pink herbed sauce, and a small garnish of green julienne and red chili."

gen S-caesar "salata-caesar" "$PLATE" \
"Salata Caesar: a bed of shredded iceberg lettuce with cucumber slices, strips of red bell pepper, black olives and thin red onion, topped with fanned strips of grilled chicken breast, dusted with finely grated parmesan and finished with a drizzle of dark balsamic glaze. One single salad portion."

gen 23 "carne-la-garnita" "$PLATE" \
"Carne la garnita cu mamaliga si usturoi: chunks of roasted pork and smoked pork belly, slices of grilled sausage and pieces of smoked rib, next to a thick wedge of bright yellow polenta, a small metal cup of creamy white garlic sauce, and a garnish of curled red and yellow bell pepper strips with a cucumber slice cut as a star."

gen 24 "pastrama-oaie-mamaliguta" "$PLATE" \
"Pastrama de oaie cu mamaliguta: chunks of pan-fried lamb pastrami, browned and glossy, sitting in a pool of creamy yellow sauce, next to a thick rectangular block of bright yellow polenta, garnished with a few green celery and parsley leaves and thin strips of yellow and red pepper."

gen 25 "creveti-sos-vin" "$PLATE" \
"Creveti in sos de vin: whole shell-on prawns with heads and tails intact, pink and orange, sitting in a glossy golden-orange wine sauce, garnished with fine curls of orange and red bell pepper and a small tuft of pea microgreens. One single portion."

gen 26 "pizza-quatro-formagi" "$PIZZA" \
"Pizza quattro formaggi: a round pizza with a thick puffy blistered golden crust, the whole surface covered in melted mixed white cheeses — mozzarella, gorgonzola with blue-green flecks and a creamy cheese base — with lightly browned bubbles. No tomato sauce, no vegetables, no meat. Whole uncut pizza."

gen 28 "coaste-pui-sos-picant" "$PLATE" \
"Chopped smoked pork and chicken pieces with slices of grilled sausage and bacon, tossed with chopped parsley and green onion batons, next to a thick wedge of bright yellow polenta and a small blue ceramic bowl of creamy white garlic sauce."

gen 30 "cotlet-berbecut" "$PLATE" \
"Cotlet de berbecut la gratar: three or four grilled lamb chops with frenched bones standing upright, dark grill marks, resting on a bed of yellow mashed potato, with glossy dark brown demi-glace sauce pooled and dotted around, garnished with fresh green basil leaves."

gen 31 "pui-shanghai" "$PLATE" \
"Pui Shanghai: a pile of crispy battered fried chicken strips, golden and craggy, coated in a creamy pale pink-orange Shanghai sauce that pools underneath, garnished with a curl of red chili and fine julienne of green onion, with a small dark blue cup of the same creamy pink sauce on the side."

echo "BATCH DONE" >> "$LOG"
higgsfield account status >> "$LOG"
