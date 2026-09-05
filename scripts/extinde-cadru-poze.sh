#!/bin/bash
# Repară încadrarea pozelor generate care ies lipite de marginea cadrului.
#
#   ./scripts/extinde-cadru-poze.sh <folder-surse> <folder-iesire> <nume...>
#
# Modelele de generare umplă cadrul — farfuria iese tăiată pe lateral, indiferent
# de motor (verificat pe GPT Image 2, Nano Banana Pro, Nano Banana 2) și indiferent
# cât de explicit ceri marjă în prompt. Regenerarea costă 7 credite și schimbă
# preparatul. Outpaint-ul costă ~3 și completează DOAR conturul lipsă, fără să
# atingă mâncarea.
#
# Limită: pânza extinsă nu poate depăși 4 MP, de-aia scalăm sursa la 1500px.
# Referința se încarcă în JPEG — la PNG semnătura S3 a upload-ului pică.

set -uo pipefail

SRC="${1:?folder surse}"
DST="${2:?folder iesire}"
shift 2
EXPAND="${EXPAND:-180}"

mkdir -p "$DST"
TMP=$(mktemp -d)

for name in "$@"; do
  src="$SRC/$name.png"
  [ -f "$src" ] || { echo "LIPSĂ  $name"; continue; }

  # sursa jos jos ca să încapă în 4 MP după extindere
  magick "$src" -resize 1500x1500 -quality 95 "$TMP/$name.jpg"
  id=$(higgsfield upload create "$TMP/$name.jpg" 2>&1 | tail -1)
  case "$id" in *-*-*-*-*) ;; *) echo "UPLOAD EȘUAT  $name"; continue;; esac

  # laturile de extins: doar cele care chiar ating cadrul
  sides=$(python3 - "$src" <<'PY'
import sys
from PIL import Image
import numpy as np
a = np.asarray(Image.open(sys.argv[1]).convert('L')).astype(int)
m = a < 250
h, w = a.shape
out = []
if m[:, 0].sum()  > 20: out.append('--expand_left')
if m[:, -1].sum() > 20: out.append('--expand_right')
if m[0].sum()     > 20: out.append('--expand_top')
if m[-1].sum()    > 20: out.append('--expand_bottom')
print(' '.join(f'{s} EXP' for s in out))
PY
)
  sides=${sides//EXP/$EXPAND}
  [ -n "$sides" ] || { echo "CURAT  $name"; cp "$src" "$DST/$name.png"; continue; }

  url=$(higgsfield generate create flux_2_pro_outpaint --image-references "$id" $sides --wait 2>&1 \
        | grep -oE 'https://[^ ]+' | tail -1)
  if [ -z "$url" ]; then echo "EȘUAT  $name"; continue; fi
  /usr/bin/curl -sS -o "$DST/$name.png" "$url"

  # verificarea e obligatorie: zero contact cu cadrul, altfel nu livrăm
  python3 - "$DST/$name.png" "$name" <<'PY'
import sys
from PIL import Image
import numpy as np
a = np.asarray(Image.open(sys.argv[1]).convert('L')).astype(int)
m = a < 250
c = m[0].sum() + m[-1].sum() + m[:, 0].sum() + m[:, -1].sum()
print(f'{"OK   " if c == 0 else "ÎNCĂ TĂIAT"}  {sys.argv[2]}  contact={c}')
PY
done

rm -rf "$TMP"
