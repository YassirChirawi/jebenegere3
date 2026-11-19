"""
Les 8 tables de la boutique, découpées dans la planche de Yassir (2 colonnes x 4 lignes, séparées par des filets clairs).

    python scripts/build-table-skins.py <planche.png>

Sortie : assets/tables/skins/<id>.jpg (paysage) et <id>-portrait.jpg (tournée d'un quart de tour, pour les écrans
plus hauts que larges), à la taille d'origine (pas d'agrandissement : l'appareil s'en charge).
"""
import os
import sys
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'assets', 'tables', 'skins')
# Ordre de lecture de la planche (gauche, droite, ligne par ligne)
IDS = ['velours', 'vert', 'zellige', 'pourpre', 'cuivre', 'turquoise', 'nuit', 'sahara']

src = Image.open(sys.argv[1]).convert('RGB')
W, H = src.size
gray = src.convert('L')
px = gray.load()


def separators(length, other, at):
    """Positions des filets clairs (moyenne > 150) le long d'un axe."""
    lines = []
    for i in range(length):
        vals = [at(i, j) for j in range(0, other, 4)]
        if sum(vals) / len(vals) > 150:
            lines.append(i)
    return lines


def bands(lines, length):
    """Bandes entre les filets : [(début, fin), ...] (un filet épais = plusieurs pixels voisins)."""
    groups = []
    for v in lines:
        if groups and v - groups[-1][-1] <= 2:
            groups[-1].append(v)
        else:
            groups.append([v])
    edges = [(-1, -1)] + [(g[0], g[-1]) for g in groups] + [(length, length)]
    return [(edges[k][1] + 3, edges[k + 1][0] - 3) for k in range(len(edges) - 1)]


xs = bands(separators(W, H, lambda x, y: px[x, y]), W)
ys = bands(separators(H, W, lambda y, x: px[x, y]), H)
assert len(xs) == 2 and len(ys) == 4, (xs, ys)

os.makedirs(OUT, exist_ok=True)
k = 0
for y0, y1 in ys:
    for x0, x1 in xs:
        cell = src.crop((x0, y0, x1, y1))
        land = os.path.join(OUT, f'{IDS[k]}.jpg')
        port = os.path.join(OUT, f'{IDS[k]}-portrait.jpg')
        cell.save(land, quality=84, optimize=True, progressive=True)
        cell.rotate(-90, expand=True).save(port, quality=84, optimize=True, progressive=True)
        print(IDS[k], cell.size, os.path.getsize(land) // 1024, 'Ko +', os.path.getsize(port) // 1024, 'Ko')
        k += 1
