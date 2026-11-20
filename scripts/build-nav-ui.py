"""
Icônes de la navigation, des missions et des badges, découpées dans la maquette « Collection / Profil »
fournie par Yassir (générée par IA, deux téléphones côte à côte, 1199 x 1312).

    python scripts/build-nav-ui.py <profil.png>

Même méthode que build-home-ui.py : le fond est estimé sur le bord de chaque découpe puis rendu transparent.
Sortie : assets/ui/nav_*.webp, daily_*.webp, mission_*.webp, badge_*.webp, diamant.webp.
"""
import os
import sys
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'assets', 'ui')
os.makedirs(OUT, exist_ok=True)
src = Image.open(sys.argv[1]).convert('RGB')
assert src.size == (1199, 1312), src.size


def keyed(box, t0=40, t1=100, clear=()):
    a = np.asarray(src.crop(box)).astype(np.float32)
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    bg = np.median(border, axis=0)
    dist = np.sqrt(((a - bg) ** 2).sum(axis=2))
    alpha = np.clip((dist - t0) / (t1 - t0), 0, 1)
    for (x0, y0, x1, y1) in clear:
        alpha[y0:y1, x0:x1] = 0
    safe = np.maximum(alpha, 1e-3)[..., None]
    rgb = np.clip((a - (1 - alpha[..., None]) * bg) / safe, 0, 255)
    return Image.fromarray(np.dstack([rgb, alpha * 255]).astype(np.uint8))


def save(img, name, width):
    img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    path = os.path.join(OUT, name)
    img.save(path, quality=86, method=6)
    print(f'{name:22s} {img.size[0]}x{img.size[1]}  {os.path.getsize(path) // 1024} Ko')


ICONS = {
    # barre de navigation (téléphone de droite)
    'nav_accueil': ((657, 1172, 708, 1218), 96, {}),
    'nav_collection': ((757, 1172, 818, 1222), 96, {}),
    'nav_recompenses': ((878, 1172, 934, 1222), 96, {}),
    'nav_missions': ((987, 1172, 1043, 1222), 96, {}),
    'nav_profil': ((1097, 1172, 1148, 1226), 96, {'t0': 70, 't1': 130}),
    # récompense quotidienne
    'daily_pieces': ((876, 586, 930, 634), 110, {'clear': ((49, 0, 54, 48),)}),
    # diamant (monnaie achetée)
    'diamant': ((634, 131, 682, 172), 96, {'clear': ((18, 0, 48, 4), (44, 0, 48, 41), (0, 33, 9, 41), (24, 34, 48, 41))}),
    # missions
    'mission_carte': ((638, 752, 692, 802), 96, {}),
    'mission_cartes': ((636, 812, 698, 862), 110, {}),
    # badges (succès)
    'badge_champion': ((638, 998, 738, 1094), 150, {'clear': ((0, 85, 100, 96),)}),
    'badge_ronda': ((758, 1002, 838, 1088), 130, {}),
    'badge_tringa': ((862, 1002, 948, 1088), 130, {}),
    'badge_serie': ((966, 998, 1064, 1094), 150, {'clear': ((0, 85, 98, 96),)}),
    'badge_collection': ((1078, 1002, 1152, 1088), 130, {}),
}
for name, (box, width, opts) in ICONS.items():
    save(keyed(box, **opts), f'{name}.webp', width)
