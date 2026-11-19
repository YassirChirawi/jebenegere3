"""
Icônes des effets spéciaux des jeux, découpées dans la planche de Yassir (6 colonnes x 5 lignes d'icônes lumineuses sur fond noir).

    python scripts/build-fx-icons.py <planche.png>

Le fond noir devient transparent (la lumière garde son halo). Sortie : assets/fx/<nom>.webp (192 px).
"""
import os
import sys
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'assets', 'fx')
COLS, ROWS = 6, 5
SIZE = 192
# (ligne, colonne) dans la planche
ICONS = {
    'restriction': (1, 2),  # cadenas et chaînes : le 1 du Hezz2
    'plus2': (1, 3),        # +2 : le 2 du Hezz2
    'choix': (3, 4),        # flèches : le 7 du Hezz2 (choix de la couleur)
    'ronda': (1, 5),        # Ronda (2 cartes semblables)
    'tringa': (2, 0),       # Tringa (3 cartes semblables)
    'royal': (2, 1),        # 12 couronné : dernière carte avec le 12 (Rey)
    'flop': (2, 2),         # carte barrée : dernière carte sans rien prendre
    'secret': (2, 3),       # œil barré : la Sota que toi seul vois
    'dix': (2, 4),          # carte 10 dorée : la Sota arrive dans ta main
    'pinocchio': (2, 5),    # Pinocchio : menteur démasqué au Kdoub
}

src = Image.open(sys.argv[1]).convert('RGB')
W, H = src.size
cw, ch = W / COLS, H / ROWS
os.makedirs(OUT, exist_ok=True)
for name, (row, col) in ICONS.items():
    # (marge en haut : la ligne du dessus déborde un peu dans la case)
    cell = src.crop((round(col * cw), round(row * ch) + 16, round((col + 1) * cw), round((row + 1) * ch)))
    side = max(cell.size)
    sq = Image.new('RGB', (side, side), (0, 0, 0))
    sq.paste(cell, ((side - cell.width) // 2, (side - cell.height) // 2))
    sq = sq.resize((SIZE, SIZE), Image.LANCZOS)
    # Noir -> transparent : alpha = luminosité max, couleur « dé-prémultipliée » pour garder l'éclat
    px = sq.load()
    out = Image.new('RGBA', sq.size)
    po = out.load()
    for y in range(SIZE):
        for x in range(SIZE):
            r, g, b = px[x, y]
            m = max(r, g, b)
            a = min(255, int(max(0, m - 12) * 1.25))
            if a == 0:
                po[x, y] = (0, 0, 0, 0)
            else:
                k = 255 / max(m, 1)
                po[x, y] = (min(255, int(r * k)), min(255, int(g * k)), min(255, int(b * k)), a)
    path = os.path.join(OUT, f'{name}.webp')
    out.save(path, quality=88, method=6)
    print(name, os.path.getsize(path) // 1024, 'Ko')
