"""
Décor du binga et des tournois, découpé dans les illustrations fournies par Yassir (générées par IA).

    python scripts/build-decor.py <dossier des images>

Le dossier doit contenir :
  piece.png   : la grande pièce au pique (vue de face)       -> assets/decor/binga.webp (icône de la monnaie)
  jetons.png  : les 4 jetons (pique, cœur, trèfle, carreau) -> assets/decor/jeton_*.webp (mises, roue, tournois)
               et le jeton couronne (au-dessus)             -> assets/decor/jeton_couronne.webp
  embleme.png : la scène au pique sur coussin                -> assets/decor/fond_roue.webp (fond de la roue du jour)
  coffre.png  : le coffre rempli de pièces                   -> assets/decor/coffres.webp (bandeau des coffres)

Tout est réduit et compressé (webp) : quelques dizaines de Ko en tout.
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'assets', 'decor')
SRC = sys.argv[1]
os.makedirs(OUT, exist_ok=True)


def disc(img, cx, cy, rx, ry, size, name):
    """Découpe un disque (ellipse rx x ry), le remet au rond, coins transparents."""
    crop = img.crop((round(cx - rx), round(cy - ry), round(cx + rx), round(cy + ry))).resize((size * 2, size * 2), Image.LANCZOS)
    mask = Image.new('L', crop.size, 0)
    ImageDraw.Draw(mask).ellipse((2, 2, crop.width - 3, crop.height - 3), fill=255)
    crop = crop.convert('RGBA')
    crop.putalpha(mask.filter(ImageFilter.GaussianBlur(1.5)))
    crop = crop.resize((size, size), Image.LANCZOS)
    path = os.path.join(OUT, name)
    crop.save(path, quality=86, method=6)
    print(name, os.path.getsize(path) // 1024, 'Ko')


def banner(img, box, width, name, quality=78):
    crop = img.crop(box)
    h = round(crop.height * width / crop.width)
    crop = crop.resize((width, h), Image.LANCZOS)
    path = os.path.join(OUT, name)
    crop.save(path, quality=quality, method=6)
    print(name, crop.size, os.path.getsize(path) // 1024, 'Ko')


piece = Image.open(os.path.join(SRC, 'piece.png')).convert('RGB')
disc(piece, 744, 533, 142, 140, 128, 'binga.webp')

jetons = Image.open(os.path.join(SRC, 'jetons.png')).convert('RGB')
for name, (cx, cy) in {'pique': (312, 583), 'coeur': (672, 590), 'trefle': (1012, 590), 'carreau': (1350, 583)}.items():
    disc(jetons, cx, cy, 178, 186, 112, f'jeton_{name}.webp')
disc(jetons, 868, 150, 170, 95, 112, 'jeton_couronne.webp')

embleme = Image.open(os.path.join(SRC, 'embleme.png')).convert('RGB')
banner(embleme, (0, 0, embleme.width, embleme.height), 800, 'fond_roue.webp', quality=68)

coffre = Image.open(os.path.join(SRC, 'coffre.png')).convert('RGB')
banner(coffre, (120, 140, 1460, 900), 720, 'coffres.webp')
