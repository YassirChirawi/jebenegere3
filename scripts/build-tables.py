"""
Tables de jeu (images générées par IA, fournies par Yassir), une par jeu.

    python scripts/build-tables.py <dossier des images sources>

Sources attendues dans le dossier : 3.png (velours rouge, ovale), 4.png (cuivre, ronde),
5.png (néon, ovale), 6.png (verte, ronde, thé), 7.png (verte, ovale, tournoi).
Sorties : assets/tables/<nom>.jpg, et <nom>-portrait.jpg (tournée d'un quart de tour) pour
les tables ovales, utilisée quand l'écran de jeu est plus haut que large.
"""
import os
import sys
from PIL import Image

SRC_DIR = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'tables')
os.makedirs(OUT, exist_ok=True)

TABLES = {
    'velours': '3.png',   # Ronda
    'cuivre': '4.png',    # Kdoub
    'neon': '5.png',      # Sota Ghamla
    'menthe': '6.png',    # Hezz2
    'tournoi': '7.png',   # en réserve
}
MAX = 1600

for name, file in TABLES.items():
    im = Image.open(os.path.join(SRC_DIR, file)).convert('RGB')
    if max(im.size) > MAX:
        k = MAX / max(im.size)
        im = im.resize((round(im.size[0] * k), round(im.size[1] * k)), Image.LANCZOS)
    im.save(os.path.join(OUT, f'{name}.jpg'), quality=84, optimize=True)
    out = [f'{name}.jpg {im.size}']
    if im.size[0] > im.size[1] * 1.15:
        rot = im.transpose(Image.Transpose.ROTATE_270)  # quart de tour, sens horaire
        rot.save(os.path.join(OUT, f'{name}-portrait.jpg'), quality=84, optimize=True)
        out.append(f'{name}-portrait.jpg {rot.size}')
    print(' · '.join(out), ' ', sum(os.path.getsize(os.path.join(OUT, f.split()[0])) for f in out) // 1024, 'Ko')
