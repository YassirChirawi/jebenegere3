"""
Fond de table des parties : reprend assets/table.png et remplace les 4 cartes posées sur le
coffret par des cartes du jeu actuel (assets/cards), en perspective.

    python scripts/build-table-bg.py

Sortie : assets/table-bg.jpg (même taille que table.png, 1211 x 1536).
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), '..')
A = lambda *p: os.path.join(ROOT, 'assets', *p)
CELL_W, CELL_H = 240, 343
SUIT = {'oros': 0, 'bastos': 1, 'espadas': 2, 'copas': 3}
VALUES = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12]


def card(suit, value):
    i = SUIT[suit] * 10 + VALUES.index(value)
    sheet = Image.open(A('cards', f'deck_{i // 12}.jpg')).convert('RGB')
    p = i % 12
    c = sheet.crop(((p % 4) * CELL_W, (p // 4) * CELL_H, (p % 4 + 1) * CELL_W, (p // 4 + 1) * CELL_H))
    # fin liseré gris pour détacher la carte, comme une vraie carte
    d = ImageDraw.Draw(c)
    d.rounded_rectangle((0, 0, CELL_W - 1, CELL_H - 1), radius=14, outline=(120, 110, 95), width=3)
    return c


def coeffs(dst, src):
    """Coefficients PIL PERSPECTIVE : point de sortie (dst) -> point source (src)."""
    m = []
    for (x, y), (u, v) in zip(dst, src):
        m.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        m.append([0, 0, 0, x, y, 1, -v * x, -v * y])
    sol = np.linalg.solve(np.array(m, dtype=float), np.array(src, dtype=float).reshape(8))
    return sol.tolist()


# Faces des 4 cartes dans table.png (coins : haut-gauche, haut-droit, bas-droit, bas-gauche),
# relevées sur l'image, légèrement agrandies pour couvrir les anciennes faces
QUADS = [
    (('copas', 1), [(367, 513), (481, 499), (499, 591), (376, 609)]),
    (('oros', 2), [(490, 491), (596, 498), (593, 597), (499, 591)]),
    (('bastos', 3), [(599, 489), (711, 504), (697, 599), (578, 584)]),
    (('espadas', 12), [(714, 499), (835, 532), (799, 622), (658, 591)]),
]

base = Image.open(A('table.png')).convert('RGB')
W, H = base.size
src_corners = [(0, 0), (CELL_W, 0), (CELL_W, CELL_H), (0, CELL_H)]
for (suit, value), quad in QUADS:
    face = card(suit, value)
    warped = face.transform((W, H), Image.PERSPECTIVE, coeffs(quad, src_corners), Image.BICUBIC)
    mask = Image.new('L', (W, H), 0)
    ImageDraw.Draw(mask).polygon(quad, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(0.8))
    # ombre douce sous la carte
    shadow = Image.new('L', (W, H), 0)
    ImageDraw.Draw(shadow).polygon([(x + 4, y + 6) for x, y in quad], fill=110)
    shadow = shadow.filter(ImageFilter.GaussianBlur(5))
    base = Image.composite(Image.new('RGB', (W, H), (25, 15, 8)), base, shadow)
    # lumière de la scène : cartes un peu moins blanches que le blanc pur
    warped = Image.eval(warped, lambda v: int(v * 0.93))
    base = Image.composite(warped, base, mask)

out = A('table-bg.jpg')
base.save(out, quality=88, optimize=True)
print(out, base.size, os.path.getsize(out) // 1024, 'Ko')
