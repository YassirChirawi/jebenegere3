/**
 * Tirage des coffres, toujours côté serveur, avec le générateur aléatoire du serveur (crypto).
 * L'appli ne choisit jamais son lot : elle demande seulement d'ouvrir un coffre.
 */
const crypto = require('crypto');
const { CHESTS, COSMETICS, RARITIES, DUPLICATE_REFUND } = require('./defs');

const ORDER = ['commun', 'rare', 'epique', 'legendaire'];
// Champion (tournoi) n'est jamais dans un coffre
const POOL = COSMETICS.filter((c) => !c.source);

// Entier aléatoire dans [0, n)
const serverRng = (n) => crypto.randomInt(0, n);

function rollRarity(chest, rng = serverRng) {
    const r = rng(100); // probabilités en pourcentages entiers
    let acc = 0;
    for (const rarity of ORDER) {
        acc += chest.odds[rarity] || 0;
        if (r < acc) return rarity;
    }
    return 'commun';
}

/**
 * Tire le contenu d'un coffre.
 * pityCount : coffres de ce type déjà ouverts d'affilée sans la rareté garantie.
 * owned : objets déjà possédés (on tire d'abord parmi ceux qui manquent ; s'il n'en manque aucun de cette rareté,
 * c'est un doublon, remboursé à 20 % de sa valeur).
 * Renvoie { item, rarity, duplicate, refund, pity (garantie utilisée), nextPity }
 */
function rollChest(chestId, pityCount = 0, owned = [], rng = serverRng) {
    const chest = CHESTS[chestId];
    if (!chest) throw new Error(`coffre inconnu : ${chestId}`);
    let rarity = rollRarity(chest, rng);
    let pity = false;
    if (chest.pity && pityCount >= chest.pity.after && RARITIES[rarity].rank < RARITIES[chest.pity.rarity].rank) {
        rarity = chest.pity.rarity;
        pity = true;
    }
    const all = POOL.filter((c) => c.rarity === rarity);
    const missing = all.filter((c) => !owned.includes(c.id));
    const from = missing.length ? missing : all;
    const item = from[rng(from.length)];
    const duplicate = !missing.length;
    const refund = duplicate ? Math.max(1, Math.round(RARITIES[rarity].value * DUPLICATE_REFUND)) : 0;
    let nextPity = pityCount;
    if (chest.pity) nextPity = RARITIES[rarity].rank >= RARITIES[chest.pity.rarity].rank ? 0 : pityCount + 1;
    return { item, rarity, duplicate, refund, pity, nextPity };
}

// « Plus que N coffres avant un Épique garanti » : le N-ième coffre au plus tard
const pityLeft = (chestId, pityCount = 0) => {
    const chest = CHESTS[chestId];
    return chest?.pity ? Math.max(1, chest.pity.after + 1 - pityCount) : null;
};

module.exports = { rollChest, rollRarity, pityLeft, POOL, ORDER };
