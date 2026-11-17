"""
Brin de menthe affiché à côté du joueur dont c'est le tour, à partir de la photo détourée (fond transparent).

    python scripts/build-mint.py <menthe.png>

Sortie : assets/menthe.png (120 px de large, fond transparent).
Nettoyage : on retire le plan de travail blanc sous les feuilles et le liseré vert fluo laissé par le détourage.
"""
import os
import sys
from PIL import Image, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'assets', 'menthe.png')

im = Image.open(sys.argv[1]).convert('RGBA')
px = im.load()
alpha = Image.new('L', im.size, 0)
ap = alpha.load()
for y in range(im.height):
    for x in range(im.width):
        r, g, b, a = px[x, y]
        mx, mn = max(r, g, b), min(r, g, b)
        whitish = mx > 110 and (mx - mn < 55 or (mn > 150 and mx - mn < 70))  # plan de travail blanc / gris (peu saturé)
        neon = g > 200 and r < 140 and b < 90 and a < 250  # liseré vert fluo du détourage
        ap[x, y] = 0 if (whitish or neon) else a
# On ronge 2 px de bord (reste du liseré) puis on adoucit
alpha = alpha.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(1.2))
im.putalpha(alpha)
im = im.crop(alpha.point(lambda v: 255 if v > 40 else 0).getbbox())
w = 120  # affichée en 26-28 px : 120 px suffisent pour les écrans haute densité
im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
im.save(OUT, optimize=True)
print(os.path.relpath(OUT, ROOT), im.size, os.path.getsize(OUT) // 1024, 'Ko')
