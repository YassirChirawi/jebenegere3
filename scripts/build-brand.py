"""
Icônes et écran de lancement à partir de l'affiche de Jeben Gere3 (Sota, Caballo, Rey à Marrakech).

    python scripts/build-brand.py <affiche.png>

Sorties :
- assets/brand/affiche.jpg            l'affiche elle-même (gardée dans le dépôt)
- assets/brand/icon-1024.png          icône iOS / stores (carrée, sans transparence)
- assets/brand/adaptive-foreground.png  icône adaptative Android (pleine image, le cavalier au centre)
- assets/brand/splash.png             écran de lancement (affiche entière, coins arrondis)
- assets/brand/favicon.png            onglet du site
- public/icons/*                      icônes du site et de l'appli installée (PWA)
"""
import os
import sys
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), '..')
P = lambda *p: os.path.join(ROOT, *p)

src = Image.open(sys.argv[1]).convert('RGB')
W, H = src.size

# Carré centré sur le cavalier (le Caballo est au milieu de l'affiche)
side = min(W, H)
left = max(0, min(W - side, (W - side) // 2))
square = src.crop((left, 0, left + side, side)).resize((1024, 1024), Image.LANCZOS)


def rounded(img, radius):
    mask = Image.new('L', img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, img.size[0] - 1, img.size[1] - 1), radius, fill=255)
    out = Image.new('RGBA', img.size, (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


os.makedirs(P('assets', 'brand'), exist_ok=True)
src.save(P('assets', 'brand', 'affiche.jpg'), quality=88, optimize=True)
square.save(P('assets', 'brand', 'icon-1024.png'), optimize=True)
square.save(P('assets', 'brand', 'adaptive-foreground.png'), optimize=True)
splash = rounded(src.resize((1200, round(1200 * H / W)), Image.LANCZOS), 48)
splash.save(P('assets', 'brand', 'splash.png'), optimize=True)
square.resize((48, 48), Image.LANCZOS).save(P('assets', 'brand', 'favicon.png'), optimize=True)

for name, size in [('icon-192.png', 192), ('icon-512.png', 512), ('maskable-512.png', 512), ('apple-touch-icon.png', 180)]:
    square.resize((size, size), Image.LANCZOS).save(P('public', 'icons', name), optimize=True)

for f in ['icon-1024.png', 'adaptive-foreground.png', 'splash.png', 'favicon.png']:
    print('assets/brand/' + f, os.path.getsize(P('assets', 'brand', f)) // 1024, 'Ko')
