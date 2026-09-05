#!/usr/bin/env python3
"""Extrage sigla H'ash din flyerul original si scrie variantele pentru web.

Sursa e arta vectoriala din `uploads/meniu hash grafica 1-6.pdf` (export
CorelDRAW), pagina 1 — nu o poza vectorizata, ci curbele graficianului.

De ce mai multe variante: sigla e desenata pentru tipar. Cercul are 0,9 unitati
grosime dintr-o latime totala de 182,5 — la 74 px inaltime pe ecran asta
inseamna 0,4 px, iar orice linie sub 1 px se stinge in antialiasing si sigla
pare stearsa. Fiecare varianta adauga un contur calculat pentru marimea ei.

    python3 scripts/extract-logo.py

Scrie in img/:
    logo-hash.svg        master, fidel 1:1, monocrom (arhiva / tipar / >250px)
    logo-hash-sm.svg     header + favicon, pana in ~100px — contur gros
    logo-hash-md.svg     footer, ~100-250px — contur usor
    logo-hash-light.svg  alb integral, pentru bannerele inchise la culoare
"""
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF = os.path.join(ROOT, "uploads", "meniu hash grafica 1-6.pdf")
OUTDIR = os.path.join(ROOT, "img")
TMP = os.path.join(OUTDIR, ".logo-crop.svg")

BROWN = "#451400"   # --brown, cerneala site-ului
RED = "#AD2118"     # --red, acelasi rosu ca butoanele

# decupajul din pagina 1 care contine doar sigla, in puncte PDF
CROP = ("-x", "30", "-y", "30", "-W", "200", "-H", "172")

# ordinea formelor asa cum apar in PDF, si grosimea lor bruta in unitati viewBox
SHAPES = ("cerc", "HASH", "BISTRO", "h")

# contur adaugat per forma + culorile; „h" e deja gros, abia il atingem.
# None la culoare = master monocrom, se lasa recolorat din CSS prin currentColor.
VARIANTS = {
    "":       ((0, 0, 0, 0),             None),
    "-sm":    ((2.0, 1.5, 1.5, 0.5),     (BROWN, RED)),
    "-md":    ((0.5, 0.35, 0.35, 0.1),   (BROWN, RED)),
    # pe fotografie inchisa rosul iese prea intunecat — sigla merge alba integral
    "-light": ((2.0, 1.5, 1.5, 0.5),     ("#FFFFFF", "#FFFFFF")),
}


def extract():
    """Ruleaza pdftocairo si scoate cele patru forme din SVG-ul rezultat."""
    if not os.path.exists(PDF):
        sys.exit(f"lipseste flyerul: {PDF}")
    subprocess.run(["pdftocairo", "-svg", "-f", "1", "-l", "1", *CROP, PDF, TMP], check=True)
    src = open(TMP).read()
    os.remove(TMP)

    yellow = 'fill="rgb(100%, 92.941284%, 0%)"'
    shapes = re.findall(
        r'<path fill-rule="nonzero" ' + re.escape(yellow) + r' fill-opacity="1" d="([^"]*)"', src)
    # „h" caligrafic e desenat ca dreptunghi cu gradient auriu taiat de un
    # clipPath — conturul literei e in clip-4, nu intr-un <path> obisnuit
    h = None
    for m in re.finditer(r'<clipPath id="clip-4[^"]*">\s*<path[^>]*?d="([^"]*)"', src, re.S):
        h = m.group(1)
    if len(shapes) != 3 or h is None:
        sys.exit(f"structura neasteptata in PDF: {len(shapes)} forme galbene, h={'da' if h else 'nu'}")
    return shapes + [h]


# --- bbox exact, cu extremele curbelor Bezier cubice ---
NUM = r'-?\d*\.?\d+(?:[eE][-+]?\d+)?'


def bezier_bounds(p0, p1, p2, p3):
    lo, hi = min(p0, p3), max(p0, p3)
    a, b, c = -p0 + 3 * p1 - 3 * p2 + p3, 2 * (p0 - 2 * p1 + p2), p1 - p0
    roots = []
    if abs(a) < 1e-12:
        if abs(b) > 1e-12:
            roots.append(-c / b)
    else:
        disc = b * b - 4 * a * c
        if disc >= 0:
            r = disc ** 0.5
            roots += [(-b + r) / (2 * a), (-b - r) / (2 * a)]
    for t in roots:
        if 0 < t < 1:
            u = 1 - t
            v = u**3 * p0 + 3 * u**2 * t * p1 + 3 * u * t**2 * p2 + t**3 * p3
            lo, hi = min(lo, v), max(hi, v)
    return lo, hi


def path_bbox(d):
    tok = re.findall(r'[MLCZmlcz]|' + NUM, d)
    i, cur, start, cmd = 0, (0.0, 0.0), (0.0, 0.0), None
    xs, ys = [float('inf'), float('-inf')], [float('inf'), float('-inf')]

    def hit(x, y):
        xs[0], xs[1] = min(xs[0], x), max(xs[1], x)
        ys[0], ys[1] = min(ys[0], y), max(ys[1], y)

    while i < len(tok):
        if tok[i].isalpha():
            cmd = tok[i]; i += 1
            if cmd in 'Zz':
                cur = start
                continue
        if cmd in ('M', 'L'):
            x, y = float(tok[i]), float(tok[i + 1]); i += 2
            hit(x, y)
            if cmd == 'M':
                start = (x, y)
            cur = (x, y)
        elif cmd == 'C':
            x1, y1, x2, y2, x, y = (float(v) for v in tok[i:i + 6]); i += 6
            bx, by = bezier_bounds(cur[0], x1, x2, x), bezier_bounds(cur[1], y1, y2, y)
            hit(bx[0], by[0]); hit(bx[1], by[1])
            cur = (x, y)
        else:
            i += 1
    return xs[0], ys[0], xs[1], ys[1]


def main():
    paths = extract()
    boxes = [path_bbox(d) for d in paths]
    # conturul cel mai gros iese in afara formei cu jumatate din grosimea lui
    pad = max(max(st) for st, _ in VARIANTS.values()) / 2
    x0 = min(b[0] for b in boxes) - pad
    y0 = min(b[1] for b in boxes) - pad
    w = max(b[2] for b in boxes) + pad - x0
    h = max(b[3] for b in boxes) + pad - y0
    vb = f"{x0:.3f} {y0:.3f} {w:.3f} {h:.3f}"

    for suffix, (strokes, palette) in VARIANTS.items():
        body = []
        for d, sw, name in zip(paths, strokes, SHAPES):
            # master ramane monocrom si se lasa recolorat din CSS prin currentColor;
            # variantele de web au „h"-ul in rosul site-ului, restul in cerneala
            col = "currentColor" if palette is None else (palette[1] if name == "h" else palette[0])
            stroke = (f' stroke="{col}" stroke-width="{sw}" stroke-linejoin="round"'
                      f' stroke-linecap="round"') if sw else ""
            body.append(f'  <path d="{d}" fill="{col}"{stroke}/>')
        root_color = f' color="{BROWN}"' if palette is None else ""
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" '
               f'width="{w:.1f}" height="{h:.1f}"{root_color} fill-rule="nonzero" '
               f'role="img" aria-label="H\'ash Bistro &amp; Take-Away">\n'
               + "\n".join(body) + "\n</svg>\n")
        out = os.path.join(OUTDIR, f"logo-hash{suffix}.svg")
        open(out, "w").write(svg)
        print(f"{os.path.relpath(out, ROOT):24s} {len(svg):6d} octeti   contur {strokes}")
    print(f"viewBox: {vb}   raport {w / h:.4f}")


if __name__ == "__main__":
    main()
