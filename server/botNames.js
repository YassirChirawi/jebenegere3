/**
 * Pseudos des bots : écrits comme ceux des joueurs (prénom + chiffres, surnom, initiale…),
 * sans « Bot » devant. Uniques dans un salon ; les chiffres au hasard rendent improbable
 * la rencontre avec le pseudo d'un vrai compte.
 */
const FIRST = [
    'Hamza', 'Yassine', 'Soufiane', 'Ayoub', 'Mehdi', 'Anas', 'Othmane', 'Zakaria', 'Ilyas', 'Reda',
    'Amine', 'Karim', 'Hicham', 'Youssef', 'Omar', 'Ismail', 'Badr', 'Taha', 'Nabil', 'Adil',
    'Salma', 'Imane', 'Kawtar', 'Nouhaila', 'Meryem', 'Hiba', 'Ghita', 'Sara', 'Yasmine', 'Fatima',
    'Khadija', 'Asmae', 'Houda', 'Chaimae', 'Zineb', 'Hajar', 'Oumaima', 'Lamia', 'Nisrine', 'Rania',
];
const NICK = ['Simo', 'Hamoudi', 'Zakizak', 'Lmoudir', 'Bouchta', 'Lhaj', 'Driss', 'Nono', 'Mimi', 'Titi', 'Jojo', 'Kiki'];
const TAGS = ['ma', 'mtl', 'casa', 'rbt', 'tng', 'fes', 'agd', 'mrk', 'oujda'];
const LETTERS = 'ABCDEHKLMRSTZ';

const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];
const num = (rnd, max) => 1 + Math.floor(rnd() * max);

function candidate(rnd = Math.random) {
    const f = pick(FIRST, rnd);
    switch (Math.floor(rnd() * 8)) {
        case 0: return `${f}${num(rnd, 99)}`;                  // Hamza27
        case 1: return `${f}_${num(rnd, 999)}`;                // Salma_212
        case 2: return `${f}${pick(LETTERS, rnd)}`;            // SoufianeK
        case 3: return `${f}.${pick(TAGS, rnd)}`;              // Imane.casa
        case 4: return `${pick(NICK, rnd)}${num(rnd, 99)}`;    // Simo10
        case 5: return `${f.toLowerCase()}${num(rnd, 9)}${num(rnd, 9)}`; // ayoub47
        case 6: return `${f}${2000 + num(rnd, 9)}`;            // Mehdi2004
        default: return `${pick(NICK, rnd)}_${f}`.slice(0, 16); // Lhaj_Omar
    }
}

/** Un pseudo de bot qui n'est pas déjà utilisé (comparaison sans majuscules). */
function botName(used = [], rnd = Math.random) {
    const taken = new Set([...used].map((n) => String(n).toLowerCase()));
    for (let i = 0; i < 50; i++) {
        const n = candidate(rnd).slice(0, 16);
        if (!taken.has(n.toLowerCase())) return n;
    }
    return `Joueur${Math.floor(1000 + rnd() * 9000)}`;
}

// Portraits (valeur 1 à 12, voir assets/avatars) : femmes et hommes de la planche
const WOMEN_AVATARS = [2, 5, 7, 11];
const MEN_AVATARS = [1, 3, 4, 6, 8, 9, 10, 12];
const WOMEN = new Set(FIRST.slice(20).map((n) => n.toLowerCase()));

/** Portrait au hasard, assorti au prénom du pseudo (femme / homme) quand on le reconnaît. */
function botAvatar(name = '', rnd = Math.random) {
    const low = String(name).toLowerCase();
    const isWoman = [...WOMEN].some((f) => low.includes(f));
    const isMan = FIRST.slice(0, 20).some((f) => low.includes(f.toLowerCase()));
    const pool = isWoman ? WOMEN_AVATARS : isMan ? MEN_AVATARS : [...WOMEN_AVATARS, ...MEN_AVATARS];
    return pool[Math.floor(rnd() * pool.length)];
}

module.exports = { botName, botAvatar, candidate, WOMEN_AVATARS, MEN_AVATARS };
