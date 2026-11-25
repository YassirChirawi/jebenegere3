"""
Personnages assis à la table (Animations 3D) : découpe des dessins de Yassir en morceaux animables.

    python scripts/build-characters.py            # sources dans assets/sources/characters/ (non suivi par git)

Pour chaque personnage (numéro du portrait, comme assets/avatars/avatar_XX.webp) :
  - body.webp       : buste assis. Si une tête séparée existe, la tête du buste est effacée (la tête dessinée à part
                      est posée par-dessus et peut bouger / cligner) ;
  - head.webp, head-blink.webp : tête yeux ouverts / fermés (même cadrage) ;
  - hand-open / hand-hold / hand-point.webp : mains (lots 2 et 3).
Écrit aussi src/components/room/characterArt.generated.json (boîte de la tête, en fractions du buste).

Les dessins sont détourés (fond transparent) ; on garde seulement les pixels assez opaques
pour enlever le halo doux autour de chaque morceau.
"""
import json
import os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'assets', 'sources', 'characters')
OUT = os.path.join(ROOT, 'assets', 'characters')
BODY_H = 330      # hauteur du buste exporté (affiché jusqu'à ~110 px, x3 pour les écrans fins)
ASPECT = 1.05     # boîte du personnage : hauteur = 1,05 x largeur (Character.js)

# Planche avec buste + têtes + mains : boîtes (x0, y0, x1, y1) dans l'image source
CHARACTERS = {
    0: {
        'sheet': 'c00-planche-1.png',
        'body': (32, 8, 552, 548),
        'head': (596, 44, 960, 480),
        'blink': (1076, 44, 1440, 480),
        'hands': {'open': (28, 652, 508, 984), 'hold': (508, 560, 932, 1000), 'point': (1008, 636, 1488, 976)},
        # Où poser la tête sur le buste (pixels du buste découpé) et ce qu'il faut effacer de la tête d'origine :
        # ovale (x0, y0, x1, y1) effacé sur le buste avant de poser la nouvelle tête (la capuche reste)
        'head_on_body': (148, 2, 345, 236),
        'erase': (140, -8, 372, 216),
    },
    1: {
        # Buste seul (tête comprise) : il bouge en entier, pas de clignement
        'sheet': 'c01-buste.png',
        'body': None,
        # Mains sur des images à part : (fichier, boîte). rest : main posée à plat sur la table
        'hands': {
            'point': ('c01-mains-pointe.png', (100, 432, 572, 892)),
            'rest': ('c01-mains-pointe.png', (596, 528, 1156, 888)),
            'hold': ('c01-mains-carte.png', (72, 256, 604, 1068)),
        },
    },
}


def clean(im, cut=60):
    """Enlève le halo doux : alpha < cut -> transparent, le reste garde son alpha."""
    r, g, b, a = im.split()
    a = a.point(lambda v: 0 if v < cut else v)
    return Image.merge('RGBA', (r, g, b, a))


def trim(im):
    box = im.getchannel('A').getbbox()
    return im.crop(box) if box else im


def fit_box(im, aspect=ASPECT):
    """Pose l'image en bas et au centre d'une boîte largeur x (largeur * aspect)."""
    w, h = im.size
    W = max(w, int(round(h / aspect)))
    H = int(round(W * aspect))
    box = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    box.alpha_composite(im, ((W - w) // 2, H - h))
    return box, ((W - w) // 2, H - h)


def save(im, path, height=None):
    if height and im.height != height:
        im = im.resize((round(im.width * height / im.height), height), Image.LANCZOS)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, 'WEBP', quality=86, method=6)
    return im.size


def main():
    meta = {}
    for idx, c in CHARACTERS.items():
        out = os.path.join(OUT, f'c{idx:02d}')
        src = clean(Image.open(os.path.join(SRC, c['sheet'])).convert('RGBA'))
        body = trim(src) if c['body'] is None else src.crop(c['body'])
        entry = {}
        if c.get('head'):
            # Efface la tête d'origine du buste
            mask = Image.new('L', body.size, 255)
            d = ImageDraw.Draw(mask)
            d.ellipse(c['erase'], fill=0)
            mask = mask.filter(ImageFilter.GaussianBlur(1.2))
            r, g, b, a = body.split()
            a = Image.composite(a, Image.new('L', body.size, 0), mask)
            body = Image.merge('RGBA', (r, g, b, a))
        boxed, (ox, oy) = fit_box(body)
        scale = BODY_H / boxed.height
        save(boxed, os.path.join(out, 'body.webp'), BODY_H)
        if c.get('head'):
            hx0, hy0, hx1, hy1 = c['head_on_body']
            hw, hh = (hx1 - hx0), (hy1 - hy0)
            for key, name in (('head', 'head'), ('blink', 'head-blink')):
                head = src.crop(c[key]).resize((round(hw * 3 * scale), round(hh * 3 * scale)), Image.LANCZOS)
                save(head, os.path.join(out, f'{name}.webp'))
            W, H = boxed.size
            entry['head'] = [round((hx0 + ox) / W, 4), round((hy0 + oy) / H, 4), round(hw / W, 4), round(hh / H, 4)]
            # Aperçu (contrôle visuel du montage)
            prev = boxed.copy()
            prev.alpha_composite(src.crop(c['head']).resize((hw, hh), Image.LANCZOS), (hx0 + ox, hy0 + oy))
            prev.save(os.path.join(SRC, f'apercu-c{idx:02d}.png'))
        for k, box in (c.get('hands') or {}).items():
            img = src
            if isinstance(box[0], str):  # (fichier, boîte)
                img = clean(Image.open(os.path.join(SRC, box[0])).convert('RGBA'))
                box = box[1]
            save(trim(img.crop(box)), os.path.join(out, f'hand-{k}.webp'), 240)
        meta[idx] = entry
        print(f'c{idx:02d}', entry)
    with open(os.path.join(ROOT, 'src', 'components', 'room', 'characterArt.generated.json'), 'w', encoding='utf-8') as f:
        json.dump(meta, f, indent=2)


if __name__ == '__main__':
    main()
