"""
Découpe la planche des 40 cartes (image fournie par Yassir) et reconstruit les 4 planches
utilisées par src/components/Card.js (4 colonnes x 3 lignes, la dernière : 1 ligne).

    python scripts/build-card-sheets.py <planche.png>

Planche source : 4 lignes (Bastos, Espadas, Oros, Copas) x 10 colonnes (1 à 7, 10, 11, 12),
cartes posées sur un fond kraft. Chaque carte est détectée par ses bords, rognée juste à
l'intérieur de son contour, puis complétée (sans déformation) au format 0,7 du jeu.
Sortie : assets/cards/deck_0.jpg … deck_3.jpg
"""
import os
import sys
import numpy as np
from PIL import Image

SRC = sys.argv[1]
ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'assets', 'cards')
CELL_W, CELL_H = 240, 343  # rapport 0,7 comme CARD_WIDTH / CARD_HEIGHT

SRC_ROWS = ['bastos', 'espadas', 'oros', 'copas']
VALUES = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12]
SUIT_ORDER = {'oros': 0, 'bastos': 1, 'espadas': 2, 'copas': 3}  # ordre de Card.js

img = Image.open(SRC).convert('RGB')
a = np.array(img).astype(int)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
bg = (r - b > 45) & (r < 215) & (r > 120) & (g < 190)  # fond kraft


def runs(v, th):
    out, start = [], None
    for i, x in enumerate(v):
        if x > th and start is None:
            start = i
        if x <= th and start is not None:
            out.append((start, i - 1))
            start = None
    if start is not None:
        out.append((start, len(v) - 1))
    return out


def separators(profile, n, size):
    """n-1 séparations : le creux le plus marqué près de chaque position attendue."""
    seps = []
    for k in range(1, n):
        c = int(k * size / n)
        lo, hi = max(0, c - 40), min(size, c + 40)
        seps.append(lo + int(np.argmax(profile[lo:hi])))
    return [0] + seps + [size]


ys = separators(bg.mean(axis=1), 4, a.shape[0])
cards = {}


def column_separators():
    """Séparations verticales communes aux 4 lignes : pour chaque coupure attendue, on garde la
    position où le fond kraft apparaît dans le plus de lignes (certaines cartes se touchent)."""
    W = a.shape[1]
    seps = [0]
    for k in range(1, 10):
        c = int(k * W / 10)
        lo, hi = c - 40, c + 40
        score = np.zeros(hi - lo)
        for ri in range(4):
            y0, y1 = ys[ri], ys[ri + 1]
            score += (bg[y0 + 20:y1 - 20, lo:hi].mean(axis=0) > 0.5)
            score += bg[y0 + 20:y1 - 20, lo:hi].mean(axis=0) * 0.01
        seps.append(lo + int(np.argmax(score)))
    return seps + [W]


XS = column_separators()
print('séparations', XS)
for ri, suit in enumerate(SRC_ROWS):
    y0, y1 = ys[ri], ys[ri + 1]
    xs = XS
    for ci, value in enumerate(VALUES):
        x0, x1 = xs[ci], xs[ci + 1]
        box = ~bg[y0:y1, x0:x1]
        rows_on = np.where(box.mean(axis=1) > 0.6)[0]
        cols_on = np.where(box.mean(axis=0) > 0.6)[0]
        top, bottom = y0 + rows_on[0], y0 + rows_on[-1]
        left, right = x0 + cols_on[0], x0 + cols_on[-1]
        inset = 5  # sous le contour noir et les coins arrondis
        crop = img.crop((left + inset, top + inset, right - inset, bottom - inset))
        cards[(suit, value)] = crop


def fit(card):
    """Met la carte au format de la cellule sans la déformer : fond crème sur les côtés."""
    w, h = card.size
    px = np.array(card).reshape(-1, 3)
    light = px[(px.sum(axis=1) > 690)]
    cream = tuple(int(x) for x in (np.median(light, axis=0) if len(light) else (250, 246, 236)))
    scale = min(CELL_W / w, CELL_H / h)
    nw, nh = round(w * scale), round(h * scale)
    resized = card.resize((nw, nh), Image.LANCZOS)
    cell = Image.new('RGB', (CELL_W, CELL_H), cream)
    cell.paste(resized, ((CELL_W - nw) // 2, (CELL_H - nh) // 2))
    return cell


os.makedirs(OUT, exist_ok=True)
ordered = sorted(cards.items(), key=lambda kv: SUIT_ORDER[kv[0][0]] * 10 + VALUES.index(kv[0][1]))
for sheet in range(4):
    chunk = ordered[sheet * 12:(sheet + 1) * 12]
    rows = 3 if sheet < 3 else 1
    out = Image.new('RGB', (CELL_W * 4, CELL_H * rows), (250, 246, 236))
    for i, (_, card) in enumerate(chunk):
        out.paste(fit(card), ((i % 4) * CELL_W, (i // 4) * CELL_H))
    path = os.path.join(OUT, f'deck_{sheet}.jpg')
    out.save(path, quality=90, optimize=True)
    print(path, out.size)
