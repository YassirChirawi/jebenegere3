"""
Habillage de l'accueil, découpé dans la maquette fournie par Yassir (accueil L'Carta, générée par IA).

    python scripts/build-home-ui.py <accueil.png>

<accueil.png> : la maquette de l'accueil en 1024 x 1536.
Le fond bleu nuit autour des éléments devient transparent (couleur du fond estimée sur le bord
de chaque découpe, puis « retirée » des pixels du bord pour garder des contours propres).
Sortie : assets/ui/*.webp, quelques dizaines de Ko chacun.
"""
import os
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'assets', 'ui')
os.makedirs(OUT, exist_ok=True)
src = Image.open(sys.argv[1]).convert('RGB')
assert src.size == (1024, 1536), src.size


def save(img, name, quality=84):
    path = os.path.join(OUT, name)
    img.save(path, quality=quality, method=6)
    print(f'{name:22s} {img.size[0]}x{img.size[1]}  {os.path.getsize(path) // 1024} Ko')


def keyed(box, t0=38, t1=95, clear=()):
    """Découpe box ; le fond (médiane du bord) devient transparent, en douceur."""
    a = np.asarray(src.crop(box)).astype(np.float32)
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    bg = np.median(border, axis=0)
    dist = np.sqrt(((a - bg) ** 2).sum(axis=2))
    alpha = np.clip((dist - t0) / (t1 - t0), 0, 1)
    for (x0, y0, x1, y1) in clear:  # zones à vider (bouts d'autres éléments de la maquette)
        alpha[y0:y1, x0:x1] = 0
    safe = np.maximum(alpha, 1e-3)[..., None]
    rgb = np.clip((a - (1 - alpha[..., None]) * bg) / safe, 0, 255)
    out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    return Image.fromarray(out)


def fit(img, width):
    return img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)


# Logo (cartes, couronne, bandeau L'CARTA)
save(fit(keyed((228, 14, 792, 258), clear=((0, 0, 100, 40), (470, 0, 564, 40), (0, 190, 30, 244))), 520), 'logo_banner.webp')

# Coin d'arche avec lanterne (à gauche ; retourné en miroir à droite dans l'appli)
corner = src.crop((0, 0, 330, 300)).convert('RGBA')
m = Image.new('L', corner.size, 255)
d = ImageDraw.Draw(m)
d.rectangle((126, 142, 330, 300), fill=0)  # pas l'enveloppe ni le haut du profil
m = m.filter(ImageFilter.GaussianBlur(6))
# bords intérieurs fondus dans le fond de la page
fade = np.asarray(m).astype(np.float32) / 255
h, w = fade.shape
fade *= np.clip((h - np.arange(h)) / 40, 0, 1)[:, None]
fade *= np.clip((w - np.arange(w)) / 30, 0, 1)[None, :]
corner.putalpha(Image.fromarray((fade * 255).astype(np.uint8)))
save(fit(corner, 240), 'arch_corner.webp')

# Cadre de lauriers du portrait (le centre est vidé : le portrait du joueur passe dessous)
laurel = keyed((60, 232, 326, 502), clear=((232, 50, 266, 72), (0, 256, 100, 270), (175, 256, 266, 270), (0, 0, 70, 45), (205, 0, 266, 45), (0, 266, 266, 270), (240, 228, 266, 256)))
cx, cy, r = 197 - 60, 365 - 232, 89
hole = Image.new('L', laurel.size, 255)
ImageDraw.Draw(hole).ellipse((cx - r, cy - r, cx + r, cy + r), fill=0)
la = np.minimum(np.asarray(laurel.getchannel('A')), np.asarray(hole.filter(ImageFilter.GaussianBlur(1))))
laurel.putalpha(Image.fromarray(la))
save(fit(laurel, 240), 'laurel_frame.webp')

# Trophée (rang)
save(fit(keyed((758, 272, 918, 372), clear=((0, 92, 160, 100),)), 150), 'trophy.webp')

# Icônes de la ligne de statistiques
for name, box in {
    'stat_parties': (122, 518, 178, 570),
    'stat_victoires': (352, 516, 418, 574),
    'stat_serie': (572, 516, 648, 570),
    'stat_taux': (772, 512, 834, 578),
}.items():
    save(fit(keyed(box), 72), f'{name}.webp')

# Icônes des raccourcis
for name, box in {
    'tile_collection': (88, 648, 242, 752),
    'tile_recompenses': (336, 646, 460, 752),
    'tile_classement': (568, 646, 708, 750),
    'tile_profil': (826, 652, 922, 746),
}.items():
    save(fit(keyed(box), 140), f'{name}.webp')

# bouts de la bordure des cartes hexagonales de la maquette
MODE_CLEAR = {'mode_enligne': ((0, 0, 30, 14), (150, 0, 184, 14)), 'mode_ordi': ((0, 0, 60, 20), (120, 0, 166, 20))}
# Icônes des modes de jeu (sur fond rouge, bleu, violet, vert)
for name, box in {
    'mode_enligne': (68, 944, 252, 1068),
    'mode_ordi': (312, 930, 478, 1068),
    'mode_tournoi': (546, 946, 722, 1068),
    'mode_salon': (798, 958, 942, 1048),
}.items():
    # fond à motif coloré : seuil plus haut (l'or et le blanc restent, le motif part)
    save(fit(keyed(box, t0=95, t1=150, clear=MODE_CLEAR.get(name, ())), 160), f'{name}.webp')

# Scène du bas (Marrakech au coucher du soleil, pièces, cartes, thé), haut fondu dans la page
scene = src.crop((0, 1200, 1024, 1536)).convert('RGBA')
h = scene.height
alpha = np.clip(np.arange(h) / 90, 0, 1)[:, None] * np.ones((1, scene.width))
scene.putalpha(Image.fromarray((alpha * 255).astype(np.uint8)))
save(fit(scene, 760), 'scene_bottom.webp', quality=74)

# Couleur du fond de la maquette (pour le fond de l'appli)
a = np.asarray(src.crop((420, 470, 600, 500))).reshape(-1, 3)
print('fond', '#%02x%02x%02x' % tuple(int(v) for v in np.median(a, axis=0)))
a = np.asarray(src.crop((480, 780, 560, 800))).reshape(-1, 3)
print('fond bas', '#%02x%02x%02x' % tuple(int(v) for v in np.median(a, axis=0)))
