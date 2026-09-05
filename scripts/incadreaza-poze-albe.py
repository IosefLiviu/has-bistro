#!/usr/bin/env python3
"""Aduce pozele generate la mărimea și încadrarea de pe site, fără să le decupeze.

    python3 scripts/incadreaza-poze-albe.py <folder-surse> [folder-iesire]

De ce fără decupaj. Fundalul din spatele unei poze de produs în pagină este
`body` alb pur — `.prodthumb.hasphoto` e transparent și nu are niciun card
colorat sub el. Deci o poză opacă pe alb arată identic cu una decupată, iar
decupajul aduce doar necazuri: farfuria e albă, fundalul e alb, și flood-fill-ul
se strecoară prin bord și mănâncă o felie din farfurie. Se vede pe magenta, nu
se vede pe alb, dar e o reparație inutilă pentru o problemă inventată.

Condiția e ca generatorul să scoată fundal alb pur. nano_banana_pro fără
referință scoate un gri de studio (233–248) — cu cardul de categorie ca
referință de stil scoate 255. Verificarea de mai jos pică dacă nu-i alb.

Ce face totuși scriptul, fiindcă altfel farfuriile ies de mărimi diferite:
mărimea se măsoară pe FARFURIE, nu pe conturul total, fiindcă umbra variază
mult de la poză la poză. Farfuria se izolează după gradient — are muchie netă,
umbra e difuză.
"""
import sys, os, glob
import numpy as np
from PIL import Image

CANVAS = 1024
TARGET_W = 820      # lățimea farfuriei — mărimea pe care o vede omul
MIN_MARGIN = 14     # cât alb gol rămâne minim până la marginea pânzei
EDGE_THRESHOLD = 12 # peste atât gradientul e muchie de obiect, nu umbră
WHITE_MIN = 250     # sub atât nu mai e fundal alb
WHITE_MEAN = 253.5  # media minimă pe colțuri; pragul e „nu mai prost decât ce
                    # e deja publicat" — cardurile de categorie stau la 253,8,
                    # iar ratarea reală, fundalul de studio, dă ~240


def bbox(mask):
    ys = np.nonzero(mask.any(axis=1))[0]
    xs = np.nonzero(mask.any(axis=0))[0]
    return int(xs[0]), int(xs[-1]), int(ys[0]), int(ys[-1])


def plate_bbox(im):
    """Conturul farfuriei, fără umbră — după intensitatea gradientului."""
    g = np.asarray(im.convert("L")).astype(float)
    gy, gx = np.gradient(g)
    edge = np.hypot(gx, gy) > EDGE_THRESHOLD
    return bbox(edge)


def content_bbox(im):
    """Tot ce nu e fundal alb, umbra inclusă."""
    a = np.asarray(im.convert("RGB")).astype(int)
    return bbox(a.min(axis=2) < WHITE_MIN)


def check_white(im, patch=100):
    """Media pe cele patru colțuri. Un pixel izolat nu spune nimic — zgomotul
    de compresie coboară la 251 și pe pozele bune. Ce se vede pe pagină e media:
    fundalul de studio al lui nano_banana_pro fără referință dă ~240, iar
    cardurile de categorie deja publicate stau la 253,8."""
    a = np.asarray(im.convert("RGB")).astype(int).min(axis=2)
    c = np.concatenate([a[:patch, :patch].ravel(), a[:patch, -patch:].ravel(),
                        a[-patch:, :patch].ravel(), a[-patch:, -patch:].ravel()])
    return float(c.mean())


def frame(src, dst):
    im = Image.open(src).convert("RGB")
    white = check_white(im)
    px0, px1, py0, py1 = plate_bbox(im)
    cx0, cx1, cy0, cy1 = content_bbox(im)

    scale = TARGET_W / (px1 - px0 + 1)
    avail = CANVAS - 2 * MIN_MARGIN
    for _ in range(40):
        cw, ch = (cx1 - cx0 + 1) * scale, (cy1 - cy0 + 1) * scale
        if cw <= avail and ch <= avail:
            break
        scale *= min(avail / cw, avail / ch)

    im2 = im.resize((max(1, round(im.width * scale)),
                     max(1, round(im.height * scale))), Image.LANCZOS)
    pcx, pcy = (px0 + px1 + 1) / 2 * scale, (py0 + py1 + 1) / 2 * scale

    def offset(center, lo, hi):
        """Centrăm pe farfurie, dar tragem înapoi cât să încapă și umbra."""
        off = CANVAS / 2 - center
        off = min(off, MIN_MARGIN - lo * scale)
        off = max(off, CANVAS - MIN_MARGIN - (hi + 1) * scale)
        return round(off)

    canvas = Image.new("RGB", (CANVAS, CANVAS), (255, 255, 255))
    canvas.paste(im2, (offset(pcx, cx0, cx1), offset(pcy, cy0, cy1)))
    canvas.save(dst)

    fx0, fx1, fy0, fy1 = content_bbox(canvas)
    margin = min(fx0, fy0, CANVAS - 1 - fx1, CANVAS - 1 - fy1)
    fp = plate_bbox(canvas)
    return white, fp[1] - fp[0] + 1, margin


if __name__ == "__main__":
    src_dir = sys.argv[1]
    dst_dir = sys.argv[2] if len(sys.argv) > 2 else src_dir
    os.makedirs(dst_dir, exist_ok=True)
    bad = 0
    print(f"{'fisier':<32}{'alb':>7}{'farfurie':>10}{'marja':>7}")
    for f in sorted(glob.glob(os.path.join(src_dir, "*.png"))):
        name = os.path.basename(f)
        white, pw, margin = frame(f, os.path.join(dst_dir, name))
        why = []
        if white < WHITE_MEAN:
            why.append("FUNDAL GRI")
        if margin < MIN_MARGIN:
            why.append("ATINGE CADRUL")
        if why:
            bad += 1
        print(f"{name:<32}{white:>5}{pw:>10}{margin:>7}   {' '.join(why)}")
    print(f"\n{'toate curate' if not bad else str(bad) + ' cu probleme'}")
