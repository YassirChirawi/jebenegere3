"""
8 portraits premium (deux planches de Yassir, 2 x 2 médaillons dorés chacune) -> avatar_28.webp à avatar_35.webp
(portraits 29 à 36 dans le jeu).

    python scripts/build-avatars-premium.py <planche1.png> <planche2.png>

planche1 : Lion roi, Tigresse reine, Aigle roi, Mage ; planche2 : Loup roi, Renarde mage, Ours roi, Hibou mage.
Les médaillons ont un cadre épais (couronne, lauriers) : on garde l'intérieur, en disque, comme les autres portraits.
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'assets', 'avatars')
SIZE = 160
# (centre x, centre y, rayon gardé) de chaque portrait, dans l'ordre de lecture
SHEETS = [
    [(442, 252, 210), (1092, 252, 210), (412, 770, 210), (1092, 770, 210)],
    [(316, 290, 250), (985, 290, 250), (316, 895, 250), (985, 895, 250)],
]

k = 28
for path, discs in zip(sys.argv[1:3], SHEETS):
    src = Image.open(path).convert('RGB')
    for cx, cy, r in discs:
        face = src.crop((cx - r, cy - r, cx + r, cy + r)).resize((SIZE * 2, SIZE * 2), Image.LANCZOS)
        mask = Image.new('L', face.size, 0)
        ImageDraw.Draw(mask).ellipse((1, 1, face.width - 2, face.height - 2), fill=255)
        face = face.convert('RGBA')
        face.putalpha(mask.filter(ImageFilter.GaussianBlur(1)))
        face = face.resize((SIZE, SIZE), Image.LANCZOS)
        out = os.path.join(OUT, f'avatar_{k:02d}.webp')
        face.save(out, quality=84, method=6)
        print(os.path.relpath(out, ROOT), os.path.getsize(out) // 1024, 'Ko')
        k += 1
