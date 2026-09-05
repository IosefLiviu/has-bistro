#!/usr/bin/env python3
"""Reconstruiește conturul farfuriilor tăiate de marginea cadrului.

    python3 scripts/repara-farfurii-taiate.py <sursa.png> <iesire.png>

Generatorul încadrează uneori farfuria peste marginea imaginii, așa că arcul
exterior lipsește din pixeli — de obicei 2–3% din lățime. Regenerarea costă
credite; asta o repară gratis.

Cum: potrivește o conică pe conturul care NU atinge cadrul, deduce unde ar fi
trebuit să fie marginea, apoi pentru fiecare rând tăiat transplantează profilul
orizontal al bordului (fundal → muchie → interior) luat din primul rând
nedecupat de deasupra și de dedesubt, interpolat după poziția pe verticală ca
să prindă și variația de lumină.

Merge pe farfurii — margine netedă, culoare uniformă. Pe un preparat cu textură
tăiată de cadru (grămadă de cartofi, platou plin) nu are ce reconstrui; acolo
chiar trebuie regenerat.
"""
import sys, math
import numpy as np
from PIL import Image

BG = 250          # sub atât = obiect; fundalul generat e 252–255
PAD = 90          # cât extindem pânza în lateral
PROFILE_IN = 70   # cât din interiorul farfuriei intră în profil


def silhouette_rows(mask):
    rows = {}
    for y in np.nonzero(mask.any(axis=1))[0]:
        xs = np.nonzero(mask[y])[0]
        rows[int(y)] = (int(xs[0]), int(xs[-1]))
    return rows


def fit_conic(pts):
    x, y = pts[:, 0], pts[:, 1]
    A = np.column_stack([x * x, x * y, y * y, x, y, np.ones_like(x)])
    return np.linalg.svd(A)[2][-1]


def conic_x_at(c, y):
    """x-urile conicei pe rândul y (stânga, dreapta) sau None."""
    a, b, cc, d, e, f = c
    A, B, C = a, b * y + d, cc * y * y + e * y + f
    if abs(A) < 1e-12:
        return None
    disc = B * B - 4 * A * C
    if disc < 0:
        return None
    r = math.sqrt(disc)
    return tuple(sorted(((-B - r) / (2 * A), (-B + r) / (2 * A))))


def repair(src_path, dst_path):
    im = Image.open(src_path).convert("RGB")
    a = np.asarray(im).astype(np.int16)
    h, w, _ = a.shape
    lum = a.mean(axis=2)
    mask = lum < BG

    rows = silhouette_rows(mask)
    clipped = sorted(y for y, (l, r) in rows.items() if l == 0 or r == w - 1)
    if not clipped:
        Image.fromarray(a.astype(np.uint8)).save(dst_path)
        return "curat, nimic de reparat"

    free = [(y, l, r) for y, (l, r) in rows.items() if l > 2 and r < w - 3]
    if len(free) < 40:
        return "prea puțin contur liber ca să potrivesc elipsa — trebuie regenerat"
    pts = np.array([(l, y) for y, l, _ in free] + [(r, y) for y, _, r in free], float)
    c = fit_conic(pts)

    y0, y1 = clipped[0], clipped[-1]
    # rândurile-donor: primul nedecupat deasupra și dedesubtul zonei tăiate
    above = max((y for y, _, _ in free if y < y0), default=None)
    below = min((y for y, _, _ in free if y > y1), default=None)
    if above is None or below is None:
        return "zona tăiată atinge marginea de sus/jos — trebuie regenerat"

    out = np.full((h, w + 2 * PAD, 3), 255, np.int16)
    out[:, PAD:PAD + w] = a

    def profile(y_src, side):
        """Profil orizontal fundal→muchie→interior, orientat spre exterior."""
        l, r = rows[y_src]
        if side == "L":
            seg = a[y_src, max(0, l - 6):l + PROFILE_IN]
            return seg[::-1]           # de la interior spre exterior
        seg = a[y_src, max(0, r - PROFILE_IN):min(w, r + 7)]
        return seg

    pa_l, pb_l = profile(above, "L"), profile(below, "L")
    pa_r, pb_r = profile(above, "R"), profile(below, "R")
    n_l = min(len(pa_l), len(pb_l))
    n_r = min(len(pa_r), len(pb_r))

    # Rampă de racordare: reconstruim și câteva zeci de rânduri dinainte și de după
    # zona tăiată, trecând treptat de la muchia reală la cea dedusă. Fără ea rămâne
    # o treaptă vizibilă exact acolo unde începe arcul reconstruit.
    RAMP = 70
    fixed = 0
    for y in range(max(0, y0 - RAMP), min(h, y1 + RAMP + 1)):
        if y not in rows:
            continue
        xs = conic_x_at(c, y)
        if xs is None:
            continue
        t = (y - above) / max(1, below - above)
        l, r = rows[y]
        # cât de mult ne bazăm pe conică (1 în zona tăiată, 0 la capătul rampei)
        if y < y0:
            k = 1 - (y0 - y) / RAMP
        elif y > y1:
            k = 1 - (y - y1) / RAMP
        else:
            k = 1.0
        k = max(0.0, min(1.0, k))
        if k <= 0:
            continue

        prof = pa_l[:n_l] * (1 - t) + pb_l[:n_l] * t          # interior → exterior
        edge = xs[0] * k + l * (1 - k)
        if edge < l - 0.5:
            e = int(round(edge))
            for i in range(n_l):
                x = PAD + e + i
                if 0 <= x < out.shape[1]:
                    out[y, x] = prof[n_l - 1 - i]
            fixed += 1

        prof = pa_r[:n_r] * (1 - t) + pb_r[:n_r] * t
        edge = xs[1] * k + r * (1 - k)
        if edge > r + 0.5:
            e = int(round(edge))
            for i in range(n_r):
                x = PAD + e - (n_r - 1 - i)
                if 0 <= x < out.shape[1]:
                    out[y, x] = prof[i]
            fixed += 1

    # Netezirea siluetei pe banda atinsă: la capetele rampei rămân pinteni de
    # câțiva pixeli, unde muchia dedusă sare peste cea reală. Îi tăiem comparând
    # fiecare rând cu media vecinilor — în banda asta conturul e bord de farfurie,
    # deci neted prin natura lui, și nu riscăm să retezăm o garnitură.
    lo, hi = max(0, y0 - RAMP), min(h, y1 + RAMP + 1)
    m2 = out.mean(axis=2) < BG
    edges = {}
    for y in range(lo, hi):
        xs = np.nonzero(m2[y])[0]
        if len(xs):
            edges[y] = (xs[0], xs[-1])
    ys = sorted(edges)
    if ys:
        W = 15
        L = np.array([edges[y][0] for y in ys], float)
        R = np.array([edges[y][1] for y in ys], float)
        k = np.ones(2 * W + 1) / (2 * W + 1)
        Ls = np.convolve(np.pad(L, W, mode="edge"), k, "valid")
        Rs = np.convolve(np.pad(R, W, mode="edge"), k, "valid")
        for i, y in enumerate(ys):
            lcut, rcut = int(round(Ls[i])) - 2, int(round(Rs[i])) + 2
            if edges[y][0] < lcut:
                out[y, :lcut] = 255
            if edges[y][1] > rcut:
                out[y, rcut + 1:] = 255

    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(dst_path)
    return f"reconstruit pe {fixed} segmente de contur ({y0}–{y1})"


if __name__ == "__main__":
    print(repair(sys.argv[1], sys.argv[2]))
