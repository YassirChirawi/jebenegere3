"""
Image d'aperçu du lien (Open Graph, 1200 x 630) : WhatsApp, Facebook, X, Discord, Google…

    python scripts/build-og-image.py

Fond : l'affiche du jeu (assets/brand/affiche.jpg, cartes espagnoles 10, 11, 12), logo L'Carta
(assets/brand/logo.webp) et le nom des 4 jeux sur une bande sombre en bas.
Écrit public/og-image.jpg (servi tel quel à https://jebengere3.fun/og-image.jpg).
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), '..')
W, H = 1200, 630
FONT = 'C:/Windows/Fonts/seguibl.ttf'  # Segoe UI Black (Windows) ; sinon police par défaut


def font(size):
    try:
        return ImageFont.truetype(FONT, size)
    except OSError:
        return ImageFont.load_default()


def main():
    bg = Image.open(os.path.join(ROOT, 'assets', 'brand', 'affiche.jpg')).convert('RGB')
    # Largeur 1200, on garde le haut des cartes (chiffres) et on coupe le sol
    s = W / bg.width
    bg = bg.resize((W, round(bg.height * s)), Image.LANCZOS)
    top = 40
    img = bg.crop((0, top, W, top + H)).convert('RGBA')

    # Bande sombre en dégradé en bas, pour le texte
    shade = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(shade)
    band = 210
    for i in range(band):
        a = int(235 * (i / band) ** 1.4)
        d.line([(0, H - band + i), (W, H - band + i)], fill=(8, 12, 28, a))
    img.alpha_composite(shade)

    # Logo à gauche, texte à droite
    logo = Image.open(os.path.join(ROOT, 'assets', 'brand', 'logo.webp')).convert('RGBA')
    L = 190
    logo = logo.resize((L, L), Image.LANCZOS)
    img.alpha_composite(logo, (36, H - L - 14))

    d = ImageDraw.Draw(img)
    x = 36 + L + 24
    title = font(62)
    sub = font(30)
    gold, cream = (245, 207, 114), (255, 246, 228)

    def text(xy, s, f, fill):
        d.text((xy[0] + 3, xy[1] + 3), s, font=f, fill=(0, 0, 0, 200))
        d.text(xy, s, font=f, fill=fill)

    text((x, H - 168), 'Jeux de cartes marocains', title, gold)
    text((x, H - 88), 'Hezz2 · Ronda · Kdoub · Sota Ghamla  —  gratuit, avec tes amis', sub, cream)

    out = os.path.join(ROOT, 'public', 'og-image.jpg')
    img.convert('RGB').save(out, 'JPEG', quality=86, optimize=True, progressive=True)
    print(out, os.path.getsize(out) // 1024, 'Ko')


if __name__ == '__main__':
    main()
