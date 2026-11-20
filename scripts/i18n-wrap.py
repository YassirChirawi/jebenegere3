"""
Prépare la traduction d'un écran : entoure ses textes français avec t(…) et ajoute l'import.

    python scripts/i18n-wrap.py src/screens/HomeScreen.js [autres fichiers…]
    python scripts/i18n-wrap.py --literals src/…  aussi les textes dans les conditions et les gabarits `…${x}…`
    python scripts/i18n-wrap.py --keys        liste les textes à traduire (src/i18n/keys.txt)

Ce qui est pris en charge :
- texte JSX entre balises : <Text>Bonjour</Text>, et les morceaux autour d'une expression ({…}) ;
- props title / label / placeholder / sub / accessibilityLabel en texte simple ;
- dialog.alert('Titre', 'Message', [{ text: 'Annuler' }]) : titre, message et boutons en texte simple.
Les gabarits `…${x}…` restent à traiter à la main (t('… {x} …', { x })).
Relire le diff : le script ne touche pas le code, seulement des textes.
"""
import glob
import json
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(__file__), '..')
FN = 't'  # nom de la fonction de traduction dans le fichier (« --fn tr » si « t » sert déjà de variable locale)
LETTER = re.compile(r'[A-Za-zÀ-ÿ]{2}')
JS_WORDS = re.compile(r'^\s*(else|catch|finally|return|const|let|var|if|while|for|case|default|function|async|await)\b')


def looks_like_text(s):
    s2 = s.strip()
    if not s2 or not LETTER.search(s2):
        return False
    if JS_WORDS.match(s2) or any(c in s2 for c in [';', '=', '&&', '||', '=>', '`']):
        return False
    return True


def wrap_jsx_text(src):
    # >TEXT<  >TEXT{  }TEXT<   (le caractère avant « > » n'est pas une espace : fin de balise)
    pat = re.compile(r'([\w"\'}\)/]>|\})([ \t]*)([^<>{}\n`]*?[^<>{}\s`])([ \t]*)(<|\{)')

    def rep(m):
        tok, lead, text, trail, after = m.groups()
        if tok == '}' and after == '{':
            return m.group(0)
        if not looks_like_text(text):
            return m.group(0)
        return f'{tok}{lead}{{{FN}({json.dumps(text, ensure_ascii=False)})}}{trail}{after}'
    return pat.sub(rep, src)


def wrap_props(src):
    return re.sub(r'\b(title|label|placeholder|sub|accessibilityLabel)="([^"{}]+)"',
                  lambda m: f'{m.group(1)}={{{FN}({json.dumps(m.group(2), ensure_ascii=False)})}}' if looks_like_text(m.group(2)) else m.group(0), src)


LIT = r"('(?:[^'\\\n]|\\.)*'|\"(?:[^\"\\\n]|\\.)*\")"


def wrap_dialogs(src):
    # dialog.alert('A'  et  dialog.alert(X, 'B'
    src = re.sub(r'(dialog\.alert\(\s*)' + LIT, lambda m: f'{m.group(1)}{FN}({m.group(2)})', src)
    src = re.sub(r'(dialog\.alert\(\s*' + FN + r'\(' + LIT + r'\),\s*)' + LIT, lambda m: f'{m.group(1)}{FN}({m.group(3)})', src)
    # boutons { text: 'Annuler' }
    src = re.sub(r'(\{\s*text:\s*)' + LIT, lambda m: f'{m.group(1)}{FN}({m.group(2)})', src)
    return src


FRENCH = re.compile(r"[A-Za-zÀ-ÿ']{3,}")


# Noms d'écrans, de jeux et de valeurs internes : jamais traduits
CODE_WORDS = {'Home', 'Lobby', 'Game', 'Profile', 'Shop', 'Wheel', 'Missions', 'Friends', 'Leaderboard', 'Legal', 'Tournaments',
              'Tournament', 'Hezz2', 'Ronda', 'Kdoub', 'Sota', 'Discord', 'Stripe', 'Binga', 'Render'}


def is_phrase(body):
    """Une phrase à afficher : au moins un mot, avec une espace ou un accent ; pas un chemin, une couleur, une clé."""
    if body in CODE_WORDS:
        return False
    if not FRENCH.search(body):
        return False
    if re.match(r'^(\.\./|\./|#|rgba|https?:|[a-z_]+:[a-z_]+$)', body):
        return False
    return ' ' in body.strip() or bool(re.search(r'[À-ÿ]', body)) or bool(re.match(r'^[A-ZÀ-Ý][a-zà-ÿ]+$', body))


def wrap_literals(src):
    """Textes dans des conditions (? 'X' : 'Y'), valeurs par défaut (|| 'X') et gabarits avec variables."""
    out = []
    for line in src.split('\n'):
        st = line.strip()
        if st.startswith(('import ', '//', '*', '/*')) or 'require(' in st:
            out.append(line)
            continue

        def lit_rep(m):
            pre, lit = m.group(1), m.group(2)
            body = lit[1:-1]
            if not is_phrase(body) or '\\n' in body and len(body) < 4:
                return m.group(0)
            return f'{pre}{FN}({lit})'
        # « ? 'X' », « || 'X' », « ?? 'X' », puis le « : 'Y' » d'une condition déjà traduite (jamais un « : » seul :
        # il apparaît aussi dans les textes, les clés d'objets et les identifiants comme 'avatar:')
        line = re.sub(r'((?<![\w\'"])(?:\?|\|\||\?\?)\s*)(\'(?:[^\'\\]|\\.)*\'|"(?:[^"\\]|\\.)*")', lit_rep, line)
        line = re.sub(r'(\?\s*' + FN + r'\((?:\'(?:[^\'\\]|\\.)*\'|"(?:[^"\\]|\\.)*")\)\s*:\s*)(\'(?:[^\'\\]|\\.)*\'|"(?:[^"\\]|\\.)*")', lit_rep, line)

        def tpl_rep(m):
            pre, body = m.group(1), m.group(2)
            if re.search(r'(===|!==|==|!=)\s*$', pre) or not FRENCH.search(re.sub(r'\$\{[^}]*\}', '', body)):
                return m.group(0)
            plain = re.sub(r'\$\{[^}]*\}', '', body)
            if ' ' not in plain.strip() and not re.search(r'[À-ÿ]', plain):
                return m.group(0)
            if re.search(r'(deg|px|%)$', body) or '${' in body and re.search(r'\$\{[^}]*\{', body):
                return m.group(0)
            exprs = []

            def name(mm):
                exprs.append(mm.group(1))
                return '{' + f'p{len(exprs) - 1}' + '}'
            key = re.sub(r'\$\{([^}]*)\}', name, body)
            if not exprs:
                return f'{pre}{FN}({json.dumps(key, ensure_ascii=False)})'
            params = ', '.join(f'p{i}: {e}' for i, e in enumerate(exprs))
            return f'{pre}{FN}({json.dumps(key, ensure_ascii=False)}, {{ {params} }})'
        # gabarits imbriqués ou plusieurs gabarits sur la ligne : à traiter à la main
        if line.count('`') == 2:
            line = re.sub(r'([^\w`$]|^)`((?:[^`\\]|\\.)*)`', tpl_rep, line)
        out.append(line)
    return '\n'.join(out)


def add_import(src, path):
    if re.search(r"import \{[^}]*\b" + FN + r"\b[^}]*\} from '[./]+i18n'", src):
        return src
    rel = os.path.relpath(os.path.join(ROOT, 'src', 'i18n'), os.path.dirname(path)).replace(os.sep, '/')
    if not rel.startswith('.'):
        rel = './' + rel
    lines = src.split('\n')
    last = max(i for i, l in enumerate(lines) if l.startswith('import '))
    # fin de l'import (peut tenir sur plusieurs lignes)
    while not lines[last].rstrip().endswith(';'):
        last += 1
    lines.insert(last + 1, f"import {{ t }} from '{rel}';" if FN == 't' else f"import {{ t as {FN} }} from '{rel}';")
    return '\n'.join(lines)


def unjs(lit):
    q = lit[0]
    body = lit[1:-1]
    return re.sub(r'\\(.)', lambda m: {'n': '\n', 't': '\t'}.get(m.group(1), m.group(1)), body) if q in '\'"' else body


def keys():
    found = {}
    for f in glob.glob(os.path.join(ROOT, 'src', '**', '*.js'), recursive=True):
        s = open(f, encoding='utf-8').read()
        for m in re.finditer(r'\b(?:t|tr)\(\s*' + LIT, s):
            k = unjs(m.group(1))
            found.setdefault(k, os.path.relpath(f, ROOT))
    out = os.path.join(ROOT, 'src', 'i18n', 'keys.txt')
    with open(out, 'w', encoding='utf-8', newline='\n') as fh:
        for k in sorted(found):
            fh.write(json.dumps(k, ensure_ascii=False) + '\n')
    print(len(found), 'textes ->', out)


if __name__ == '__main__':
    if sys.argv[1:] == ['--keys']:
        keys()
        sys.exit(0)
    literals = '--literals' in sys.argv
    args = sys.argv[1:]
    if '--fn' in args:
        FN = args[args.index('--fn') + 1]
        args = [a for i, a in enumerate(args) if a != '--fn' and (i == 0 or args[i - 1] != '--fn')]
    for path in [a for a in args if not a.startswith('--')]:
        s = open(path, encoding='utf-8').read()
        o = s
        s = wrap_dialogs(wrap_props(wrap_jsx_text(s)))
        if literals:
            s = wrap_literals(s)
        if s != o:
            s = add_import(s, path)
            open(path, 'w', encoding='utf-8', newline='').write(s)
            print('ok', path)
        else:
            print('rien', path)
