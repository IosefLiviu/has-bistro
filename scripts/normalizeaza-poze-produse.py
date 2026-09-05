#!/usr/bin/env python3
"""Pregătește pozele generate pentru site: fundal transparent, mărime unitară, marjă.

    python3 scripts/normalizeaza-poze-produse.py <folder-surse> [folder-iesire]

Trei lucruri pe care generatorul nu le face bine și trebuie reparate aici:

1. „Fundalul alb" e de fapt srgb(253,253,254) cu un gradient ușor spre gri.
   Invizibil în Preview, perfect vizibil ca dreptunghi pe o pagină #FFFFFF.
   Îl normalizăm la alb pur, apoi îl scoatem prin flood-fill din cele patru
   colțuri — flood-fill, nu -transparent, ca să nu dispară și albul farfuriei.

2. Mărimea se măsoară pe FARFURIE, nu pe conturul total. Conturul include umbra,
   iar umbra variază mult între poze (mai ales după outpaint) — normalizarea pe
   contur făcea farfuriile să pară de mărimi diferite pe pagină, cu până la 16%.
   Farfuria se izolează după gradient: are muchie netă, umbra e difuză.

3. Obiectul se centrează după farfurie, tot din același motiv.

Verificarea nu se face pe alb: `magick out.png -background magenta -flatten`.
"""
import sys, os, glob
import numpy as np
from PIL import Image

CANVAS = 1024
TARGET_W = 820      # lățimea farfuriei — asta e mărimea pe care o vede omul
MIN_MARGIN = 14     # cât spațiu gol rămâne minim până la marginea pânzei
EDGE_THRESHOLD = 12 # peste atât gradientul e muchie de obiect, nu umbră


def to_transparent(im):
    """Alb aproape-pur → alb pur → transparent, doar fundalul legat de colțuri."""
    a = np.asarray(im.convert("RGB")).astype(np.int16)
    h, w, _ = a.shape
    a[a.min(axis=2) >= 252] = 255
    opaque = np.ones((h, w), bool)
    white = (a == 255).all(axis=2)

    # flood-fill iterativ din margini (BFS pe rânduri/coloane, suficient de rapid)
    from collections import deque
    seen = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if white[y, x] and not seen[y, x]:
                seen[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if white[y, x] and not seen[y, x]:
                seen[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and white[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True; q.append((ny, nx))
    opaque[seen] = False

    out = np.dstack([a, np.where(opaque, 255, 0)]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def bbox(mask):
    ys = np.nonzero(mask.any(axis=1))[0]
    xs = np.nonzero(mask.any(axis=0))[0]
    return int(xs[0]), int(xs[-1]), int(ys[0]), int(ys[-1])


def object_bbox(im):
    """Conturul farfuriei/pizzei, fără umbră — după intensitatea gradientului."""
    al = np.asarray(im)[:, :, 3]
    g = np.asarray(im.convert("L")).astype(float)
    soft = al > 8
    gy, gx = np.gradient(np.where(soft, g, 255.0))
    edge = (np.hypot(gx, gy) > EDGE_THRESHOLD) & soft
    return bbox(edge) if edge.any() else bbox(soft)


def normalize(src, dst):
    im = to_transparent(Image.open(src))
    ox0, ox1, oy0, oy1 = object_bbox(im)

    # Haloul de umbră aproape invizibil (peste 246) din AFARA farfuriei se șterge
    # de tot: pe alb nu se vede, dar umflă conturul și forța o micșorare inutilă —
    # bulgăreasca ieșea cu 16% mai mică decât Caesar. În interiorul farfuriei nu
    # atingem nimic, altfel am găuri albul din farfurie.
    arr = np.asarray(im).copy()
    lum = np.asarray(im.convert("L"))
    outside = np.ones(lum.shape, bool)
    outside[oy0:oy1 + 1, ox0:ox1 + 1] = False
    arr[:, :, 3] = np.where(outside & (lum >= 246), 0, arr[:, :, 3])
    im = Image.fromarray(arr, "RGBA")

    sx0, sx1, sy0, sy1 = bbox(arr[:, :, 3] > 8)

    scale = TARGET_W / (ox1 - ox0 + 1)
    # Umbra trebuie să încapă, dar nu simetric — dacă bate într-o parte, mutăm
    # obiectul din centru în loc să-l micșorăm. Micșorăm doar dacă nici așa nu intră.
    avail = CANVAS - 2 * MIN_MARGIN
    for _ in range(40):
        cw, ch = (sx1 - sx0 + 1) * scale, (sy1 - sy0 + 1) * scale
        if cw <= avail and ch <= avail:
            break
        scale *= min(avail / cw, avail / ch)

    nw, nh = max(1, round(im.width * scale)), max(1, round(im.height * scale))
    im2 = im.resize((nw, nh), Image.LANCZOS)
    cx, cy = (ox0 + ox1 + 1) / 2 * scale, (oy0 + oy1 + 1) / 2 * scale

    def offset(center, lo, hi):
        """Centrăm pe obiect, dar tragem înapoi cât să nu iasă umbra din pânză."""
        off = CANVAS / 2 - center
        off = min(off, MIN_MARGIN - lo * scale)          # nu depăși marginea de sus/stânga
        off = max(off, CANVAS - MIN_MARGIN - (hi + 1) * scale)
        return round(off)

    canvas = Image.new("RGBA", (CANVAS, CANVAS), (255, 255, 255, 0))
    canvas.paste(im2, (offset(cx, sx0, sx1), offset(cy, sy0, sy1)), im2)
    canvas.save(dst)

    chk = np.asarray(canvas)[:, :, 3]
    contact = int((chk[0] > 8).sum() + (chk[-1] > 8).sum()
                  + (chk[:, 0] > 8).sum() + (chk[:, -1] > 8).sum())
    ow = object_bbox(canvas)
    return contact, ow[1] - ow[0] + 1


if __name__ == "__main__":
    src_dir = sys.argv[1]
    dst_dir = sys.argv[2] if len(sys.argv) > 2 else src_dir
    os.makedirs(dst_dir, exist_ok=True)
    bad = 0
    for f in sorted(glob.glob(os.path.join(src_dir, "*.png"))):
        name = os.path.basename(f)
        contact, ow = normalize(f, os.path.join(dst_dir, name))
        flag = "" if contact == 0 else "  <-- ATINGE CADRUL"
        if contact:
            bad += 1
        print(f"{name:<32} farfurie={ow:>4}px  contact={contact}{flag}")
    print(f"\n{'toate curate' if not bad else str(bad) + ' cu probleme'}")
