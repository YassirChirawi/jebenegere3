"""
Icônes, écran de lancement et logo de L'Carta à partir du logo carré (cadre doré arrondi sur fond bleu nuit).

    python scripts/build-brand.py <logo.png>

Sorties :
- assets/brand/logo-source.png          le logo d'origine (gardé dans le dépôt)
- assets/brand/logo.webp                logo détouré (coins transparents), 512 px, ~95 Ko, pour l'accueil
- assets/brand/icon-1024.png            icône iOS / stores (carrée, sans transparence)
- assets/brand/adaptive-foreground.png  icône adaptative Android (logo réduit dans la zone sûre, fond transparent)
- assets/brand/splash.png               écran de lancement (logo détouré)
- assets/brand/favicon.png              onglet du site
- public/icons/*                        icônes du site et de l'appli installée (PWA)
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), '..')
P = lambda *p: os.path.join(ROOT, *p)
NAVY = (2, 14, 40)  # couleur des coins du logo, reprise en fond (Android, PWA « maskable »)

src = Image.open(sys.argv[1]).convert('RGB')
side = min(src.size)
src = src.crop((0, 0, side, side))
W = side

# Détourage : on remplit depuis les 4 coins tout le fond sombre qui entoure le cadre doré
lum = src.convert('L')
mask = Image.new('L', src.size, 255)
dark = lum.point(lambda v: 255 if v < 70 else 0)
for corner in [(0, 0), (W - 1, 0), (0, W - 1), (W - 1, W - 1)]:
    ImageDraw.floodfill(dark, corner, 128)
mask = dark.point(lambda v: 0 if v == 128 else 255).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
cut = src.convert('RGBA')
cut.putalpha(mask)
cut = cut.crop(mask.getbbox())
# On remet le logo détouré au centre d'un carré transparent
c = max(cut.size)
logo = Image.new('RGBA', (c, c), (0, 0, 0, 0))
logo.paste(cut, ((c - cut.size[0]) // 2, (c - cut.size[1]) // 2))


def on(bg, size, scale):
    """Logo détouré, réduit à `scale` de la taille, centré sur un fond (None = transparent)."""
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0) if bg is None else bg + (255,))
    s = round(size * scale)
    l = logo.resize((s, s), Image.LANCZOS)
    out.alpha_composite(l, ((size - s) // 2, (size - s) // 2))
    return out if bg is None else out.convert('RGB')


os.makedirs(P('assets', 'brand'), exist_ok=True)
src.save(P('assets', 'brand', 'logo-source.png'), optimize=True)
logo.resize((512, 512), Image.LANCZOS).save(P('assets', 'brand', 'logo.webp'), quality=86, method=6)
src.resize((1024, 1024), Image.LANCZOS).save(P('assets', 'brand', 'icon-1024.png'), optimize=True)
on(None, 1024, 0.62).save(P('assets', 'brand', 'adaptive-foreground.png'), optimize=True)
on(None, 1024, 1.0).save(P('assets', 'brand', 'splash.png'), optimize=True)
logo.resize((48, 48), Image.LANCZOS).save(P('assets', 'brand', 'favicon.png'), optimize=True)

# Icônes du site : 256 couleurs, 5 fois plus légères
for name, size in [('icon-192.png', 192), ('icon-512.png', 512)]:
    logo.resize((size, size), Image.LANCZOS).quantize(256, method=Image.FASTOCTREE, dither=Image.FLOYDSTEINBERG).save(P('public', 'icons', name), optimize=True)
on(NAVY, 512, 0.78).save(P('public', 'icons', 'maskable-512.png'), optimize=True)
src.resize((180, 180), Image.LANCZOS).save(P('public', 'icons', 'apple-touch-icon.png'), optimize=True)

for f in ['logo-source.png', 'logo.webp', 'icon-1024.png', 'adaptive-foreground.png', 'splash.png', 'favicon.png']:
    print('assets/brand/' + f, os.path.getsize(P('assets', 'brand', f)) // 1024, 'Ko')
for f in ['icon-192.png', 'icon-512.png', 'maskable-512.png', 'apple-touch-icon.png']:
    print('public/icons/' + f, os.path.getsize(P('public', 'icons', f)) // 1024, 'Ko')
