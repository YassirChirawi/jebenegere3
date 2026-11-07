// Outils communs à tous les jeux : jeu espagnol de 40 cartes, mélange, ordre des valeurs.

const SUITS = ['Oros', 'Copas', 'Espadas', 'Bastos'];
const VALUES = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

function generateDeck(filter) {
    const deck = [];
    for (const suit of SUITS) {
        for (const value of VALUES) {
            const card = { id: `${suit}-${value}`, suit, value };
            if (!filter || filter(card)) deck.push(card);
        }
    }
    return deck;
}

function shuffleDeck(deck, rng = Math.random) {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Rang d'une valeur dans l'ordre 1..7, 10, 11, 12 (0 à 9)
const valueRank = (v) => VALUES.indexOf(v);

// Valeur suivante dans l'ordre (12 → null)
const nextValue = (v) => {
    const r = valueRank(v);
    return r >= 0 && r < VALUES.length - 1 ? VALUES[r + 1] : null;
};

// Valeur suivante en boucle (12 → 1), utile pour Kdoub
const nextValueLoop = (v) => VALUES[(valueRank(v) + 1) % VALUES.length];

const randomInt = (n, rng = Math.random) => Math.floor(rng() * n);

module.exports = { SUITS, VALUES, generateDeck, shuffleDeck, valueRank, nextValue, nextValueLoop, randomInt };
