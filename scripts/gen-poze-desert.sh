#!/bin/bash
# Pozele de desert, generate din text în stilul cardurilor de categorie HASH.
#
#   scripts/gen-poze-desert.sh [slug ...]     fără argumente = toate cinci
#
# Motor: nano_banana_pro, 2k, 1:1 — 2 credite bucata. NU product-photoshoot,
# fiindcă acela forțează gpt_image_2 la 8,5 credite pentru același rezultat.
#
# Nu există poze de referință pentru desert (folderul bistroului e gol), deci
# se generează din text — exact ca pozele de categorie, care au ieșit curate.
# Tăierea farfuriilor venea din copierea încadrării pozei de referință.
#
# După generare, obligatoriu:
#   python3 scripts/normalizeaza-poze-produse.py <out> img/produse
# și nu se livrează nimic cu „ATINGE CADRUL".

set -u
SP="${SP:-/private/tmp/claude-501/-Users-iosefliviu-Proiecte-Liviu-HAS-BISTRO/88cb56ce-fb67-49f1-9781-e62272c8a5dd/scratchpad}"
OUT="$SP/desert"
LOG="$SP/desert.log"
mkdir -p "$OUT"

# Referința de stil: chiar cardul de categorie Desert. Fără ea, nano_banana_pro
# scoate un fundal gri de studio (236–248) din care farfuria albă NU se mai poate
# decupa — bordul farfuriei măsura 229, adică mai închis decât fundalul.
# Se încarcă în JPEG; la PNG pică semnătura S3. ATENȚIE: auto-upload-ul din
# `generate create --image <cale>` pică și el cu SignatureDoesNotMatch — se
# încarcă separat cu `higgsfield upload create x.jpg` și se dă UUID-ul primit.
REF="${REF:-739827d1-5ebf-428c-982f-6a45c3fe1f0e}"

# Stilul cardurilor de categorie: farfurie albă rotundă, fundal alb, 45°.
STYLE="Copy the photographic style of the reference image exactly: same lighting, same plain glossy white round ceramic plate with a wide clean visible rim, same 45 degree elevated three-quarter camera angle so the plate reads as an ellipse, same soft realistic drop shadow under the plate. The background must be pure flat white #FFFFFF, blown out to paper white, with absolutely no grey studio backdrop, no seamless sweep, no gradient, no vignette and no coloured cast. Clean menu catalogue food photography, natural appetising colours, sharp focus, no styling props, no table, no cutlery, no wooden board, no cloth, no text, no hands. The reference image defines only the style, the plate, the lighting and the background — the dessert itself is different and is described below."

# Regula de încadrare — se cere în prompt, nu se repară după.
FRAME="Framing: the entire plate is fully inside the frame with its complete unbroken outline visible on all sides; nothing is cropped or touching any edge. Leave a wide empty margin of pure white background around the plate on all four sides. The plate occupies about 70 percent of the image width and is centred in the square frame."

PORTION="One single modest restaurant portion, not a pile, not a banquet."

gen() {
  local slug="$1" dish="$2"
  echo "=== $slug ===" >>"$LOG"
  local url
  url=$(higgsfield generate create nano_banana_pro \
        --prompt "$dish $PORTION $STYLE $FRAME" \
        --image-references "$REF" \
        --aspect_ratio 1:1 --resolution 2k --wait 2>>"$LOG" \
        | grep -o 'https://[^ ]*' | tail -1)
  if [ -n "$url" ]; then
    /usr/bin/curl -sS -o "$OUT/$slug.png" "$url" && echo "OK   $slug"
  else
    echo "FAIL $slug  (vezi $LOG)"
  fi
}

# — de1 — vișine, ca să nu se calce cu afinele de la de5
d_clatite_dulceata="Romanian clatite cu dulceata: three thin pale-golden Romanian crepes with lightly browned freckles, rolled into tight cylinders and laid side by side, generously topped with glossy dark red sour cherry preserve with whole cherries in it, dusted with icing sugar. No chocolate, no banana, no nuts, no whipped cream, no ice cream, no mint."

# — de2 —
d_clatite_nutella="Romanian clatite cu Nutella: three thin pale-golden Romanian crepes with lightly browned freckles, rolled into tight cylinders and laid side by side, generously drizzled with glossy dark chocolate hazelnut spread running over them, dusted with icing sugar. No fruit, no banana, no nuts, no jam, no whipped cream, no ice cream, no mint."

# — de3 —
d_clatite_nutella_banane="Romanian clatite cu Nutella, banane si nuca: three thin pale-golden Romanian crepes rolled into cylinders and laid side by side, drizzled with glossy dark chocolate hazelnut spread, topped with fresh round banana slices and a scattering of coarsely chopped walnuts, dusted with icing sugar. No jam, no berries, no whipped cream, no ice cream, no mint."

# — de4 —
d_papanasi_nutella="Romanian papanasi cu Nutella: two round golden deep-fried sweet cheese doughnuts, each crowned with a smaller fried dough ball sitting on top, generously covered with glossy dark chocolate hazelnut spread dripping down the sides, dusted with icing sugar. No sour cream, no jam, no berries, no mint."

# — de5 — compoziție diferită de cardul de categorie, ca să nu iasă poza dublată
d_papanasi_smantana="Romanian papanasi cu smantana si dulceata de afine: two round golden deep-fried sweet cheese doughnuts, each crowned with a smaller fried dough ball, thickly topped with white sour cream and a generous spoon of dark purple blueberry preserve with whole blueberries, the cream running down the sides, dusted with icing sugar. No chocolate, no banana, no nuts, no mint."

run() {
  case "$1" in
    clatite-dulceata)         gen "$1" "$d_clatite_dulceata" ;;
    clatite-nutella)          gen "$1" "$d_clatite_nutella" ;;
    clatite-nutella-banane)   gen "$1" "$d_clatite_nutella_banane" ;;
    papanasi-nutella)         gen "$1" "$d_papanasi_nutella" ;;
    papanasi-smantana)        gen "$1" "$d_papanasi_smantana" ;;
    *) echo "slug necunoscut: $1"; return 1 ;;
  esac
}

if [ $# -gt 0 ]; then
  for s in "$@"; do run "$s"; done
else
  for s in clatite-dulceata clatite-nutella clatite-nutella-banane \
           papanasi-nutella papanasi-smantana; do run "$s"; done
fi

higgsfield account status
