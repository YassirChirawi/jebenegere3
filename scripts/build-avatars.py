"""
Les 12 avatars des joueurs, découpés dans la planche (4 colonnes x 3 lignes de médaillons dorés sur fond bleu nuit).

    python scripts/build-avatars.py <planche.png>

Sortie : assets/avatars/avatar_00.webp à avatar_11.webp (160 px, disque sans le cadre doré, coins transparents),
dans l'ordre de lecture de la planche (de gauche à droite, puis de haut en bas).
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'assets', 'avatars')
SIZE = 160
COLS, ROWS = 4, 3

src = Image.open(sys.argv[1]).convert('RGB')
W, H = src.size
os.makedirs(OUT, exist_ok=True)


# Fond : tout le bleu nuit relié aux bords de la planche (rempli depuis les 4 coins)
dark = src.convert('L').point(lambda v: 255 if v < 40 else 0)
for corner in [(0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1)]:
    ImageDraw.floodfill(dark, corner, 128)
medals = dark.point(lambda v: 0 if v == 128 else 255)  # médaillons (intérieur compris) en blanc

k = 0
for row in range(ROWS):
    for col in range(COLS):
        # Médaillon de la case : la tache blanche qui contient le milieu de la case
        cx, cy = int((col + 0.5) * W / COLS), int((row + 0.5) * H / ROWS)
        one = medals.copy()
        ImageDraw.floodfill(one, (cx, cy), 200)
        l, t, r, b = one.point(lambda v: 255 if v == 200 else 0).getbbox()
        cx, cy = (l + r) / 2, (t + b) / 2
        radius = min(r - l, b - t) / 2
        inner = radius * 0.93  # on garde l'intérieur, sans l'anneau doré
        box = (round(cx - inner), round(cy - inner), round(cx + inner), round(cy + inner))
        face = src.crop(box).resize((SIZE * 2, SIZE * 2), Image.LANCZOS)
        mask = Image.new('L', face.size, 0)
        ImageDraw.Draw(mask).ellipse((1, 1, face.width - 2, face.height - 2), fill=255)
        face = face.convert('RGBA')
        face.putalpha(mask.filter(ImageFilter.GaussianBlur(1)))
        face = face.resize((SIZE, SIZE), Image.LANCZOS)
        path = os.path.join(OUT, f'avatar_{k:02d}.webp')
        face.save(path, quality=84, method=6)
        print(os.path.relpath(path, ROOT), f'centre ({cx:.0f}, {cy:.0f}) rayon {radius:.0f}', os.path.getsize(path) // 1024, 'Ko')
        k += 1
