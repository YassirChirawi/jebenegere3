/**
 * Modération du chat : filtre des insultes les plus courantes (français, darija en lettres latines,
 * arabe), raisons de signalement, clé anonyme d'un joueur.
 *
 * Le filtre refuse le message (l'expéditeur est prévenu) mais ne sanctionne pas le joueur :
 * un mot de travers ne doit pas bannir quelqu'un. Les abus répétés passent par les signalements.
 */
const crypto = require('crypto');

// Mots entiers (après mise en minuscules et suppression des accents). En darija, 3, 7 et 9 sont des lettres.
const LATIN_WORDS = [
    // français
    'con', 'conne', 'connard', 'connards', 'connasse', 'connasses', 'salope', 'salopes', 'salaud', 'salauds',
    'pute', 'putes', 'encule', 'encules', 'enculer', 'enfoire', 'enfoires', 'batard', 'batards', 'fdp', 'ntm',
    'nique', 'niquer', 'niktamer', 'nique ta mere', 'fils de pute', 'ta gueule', 'pd', 'pede', 'pedes', 'tapette',
    'negre', 'negro', 'bougnoule', 'bougnoules', 'youpin', 'bicot', 'chienne', 'trou du cul', 'abruti', 'debile',
    'mongol', 'gogol', 'pouffiasse', 'catin',
    // darija (lettres latines)
    'zamel', 'zaml', 'zamal', 'zwamel', '9a7ba', '97ba', 'qahba', 'kahba', '9ahba', '9e7ba', 'qehba', '9hab', 'q7ab',
    't9awed', 't9wad', 'tqawed', 'tqwad', 'nikmok', 'nik mok', 'nikomok', 'zebi', 'zbi', 'zeb', 'zab',
    '7mar', 'hmar', '7mara', 'hmara', 'kelb', 'kalb', 'klab', 'khra', 'khara', 'mnayek', 'mnyouk', 'manyouk',
    'charmouta', 'sharmouta', '7chouma 3lik', 'wld l97ba', 'weld l9a7ba', 'ould l9a7ba',
];

// Arabe : recherche dans le texte (les mots arabes portent souvent des préfixes collés)
const ARABIC = ['زامل', 'قحب', 'زبي', 'حمار', 'كلب', 'نيك', 'منيوك', 'شرموط', 'تقواد', 'خرا', 'زمل'];

const strip = (s) => String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/(.)\1{2,}/g, '$1$1'); // « connnnard » → « connard »

// Expressions en mots entiers : les séparateurs (espaces, ponctuation, emojis) délimitent les mots
const latinPatterns = LATIN_WORDS.map((w) => new RegExp(`(^|[^a-z0-9])${w.replace(/ /g, '[^a-z0-9]+')}($|[^a-z0-9])`));

function isOffensive(text) {
    const t = strip(text);
    if (latinPatterns.some((re) => re.test(t))) return true;
    // aussi sans doublement de lettres (« salllope » → déjà réduit à « sallope »)
    const single = t.replace(/(.)\1+/g, '$1');
    if (latinPatterns.some((re) => re.test(single))) return true;
    const arabic = String(text || '').replace(/[ً-ٟـ]/g, ''); // voyelles et tatouil
    return ARABIC.some((w) => arabic.includes(w));
}

const REASONS = ['insulte', 'spam', 'triche', 'autre'];

// Clé anonyme d'un joueur (compte ou appareil) : permet de le bloquer sans exposer son identifiant
function playerKey(identity) {
    return `k${crypto.createHash('sha256').update(String(identity)).digest('hex').slice(0, 16)}`;
}

const isKey = (k) => typeof k === 'string' && /^k[0-9a-f]{16}$/.test(k);

// Liste de joueurs bloqués envoyée par le client : [{ key, name, at }]
function cleanBlocked(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const out = [];
    for (const b of list.slice(0, 500)) {
        if (!b || !isKey(b.key) || seen.has(b.key)) continue;
        seen.add(b.key);
        out.push({ key: b.key, name: String(b.name || '').slice(0, 24), at: Number(b.at) || Date.now() });
    }
    return out;
}

module.exports = { isOffensive, REASONS, playerKey, isKey, cleanBlocked };
