/**
 * Définitions partagées serveur + appli : rangs, défis du jour, titres, récompenses, saisons.
 * (CommonJS sans dépendance : l'appli l'importe aussi.)
 *
 * Les noms des nouveaux rangs, des titres et des récompenses sont des PROPOSITIONS
 * à valider par Yassir avant d'être figés : tout est regroupé ici pour les changer facilement.
 */

// ----------------------------------------------------------------------------
// Rangs (les 5 premiers existaient déjà ; L'Boss est désormais borné)
// ----------------------------------------------------------------------------
const RANKS = [
    { min: 0, max: 200, name: 'bida2i (Débutant)', emoji: '🥚' },
    { min: 201, max: 500, name: 'Hara o kan', emoji: '🥉' },
    { min: 501, max: 1000, name: 'fchkel', emoji: '🥈' },
    { min: 1001, max: 2500, name: 'chdid', emoji: '🥇' },
    { min: 2501, max: 5000, name: "L'Boss", emoji: '👑' },
    { min: 5001, max: 9000, name: 'M3allem', emoji: '🎩' },
    { min: 9001, max: 15000, name: "Sultan dyal l'karta", emoji: '🕌', proposed: true },
    { min: 15001, max: Infinity, name: "L'Ostora", emoji: '🌟', proposed: true },
];

function rankFor(xp = 0) {
    const i = RANKS.findIndex((r) => xp <= r.max);
    const k = i === -1 ? RANKS.length - 1 : i;
    const r = RANKS[k];
    const span = r.max === Infinity ? 1 : r.max - r.min + 1;
    return {
        ...r,
        index: k,
        currentXP: xp,
        next: RANKS[k + 1] || null,
        levelProgress: r.max === Infinity ? 1 : Math.max(0, Math.min(1, (xp - r.min + (k === 0 ? 0 : 1)) / span)),
    };
}

// ----------------------------------------------------------------------------
// XP par partie (mêmes règles que l'appli avant la phase 2)
// ----------------------------------------------------------------------------
const XP = {
    hezz2: { first: 100, second: 50, other: 20, khasser: 10 },
    ronda: { mancheWon: 30, mancheLost: 10, gameWon: 100 },
    kdoub: [100, 50, 20, 10],
    sota: { first: 100, out: 50, ghamla: 10 },
};
// Au-delà de ce nombre de coups joués automatiquement (joueur absent), la partie ne rapporte pas d'XP
const AFK_XP_LIMIT = 3;

// ----------------------------------------------------------------------------
// Récompenses (dos et tapis exclusifs aux défis et aux saisons)
// ----------------------------------------------------------------------------
const REWARDS = [
    { id: 'back:menthe', kind: 'back', label: 'Thé à la menthe', source: 'challenge' },
    { id: 'back:cuivre', kind: 'back', label: 'Cuivre martelé', source: 'challenge' },
    { id: 'back:rose', kind: 'back', label: 'Rose de Kelaa', source: 'challenge' },
    { id: 'felt:hezz2:tadelakt', kind: 'felt', game: 'hezz2', label: 'Tadelakt', source: 'challenge' },
    { id: 'felt:ronda:safran', kind: 'felt', game: 'ronda', label: 'Safran', source: 'challenge' },
    { id: 'felt:kdoub:braise', kind: 'felt', game: 'kdoub', label: 'Braise', source: 'challenge' },
    { id: 'felt:sota:lavande', kind: 'felt', game: 'sota', label: 'Lavande', source: 'challenge' },
    { id: 'back:saison', kind: 'back', label: 'Saison (exclusif top 10)', source: 'season' },
    { id: 'back:tournoi', kind: 'back', label: 'Champion (rouge et or, couronne)', source: 'tournament' },
    { id: 'back:sultan', kind: 'back', label: 'Sultan (vert et or, exclusif)', source: 'binga_tournament' },
];

// ----------------------------------------------------------------------------
// Défis du jour : 3 par jour, tirés au sort de façon stable selon la date
// metric : compteur incrémenté à la fin des parties (voir progress.js)
// ----------------------------------------------------------------------------
const CHALLENGES = [
    { id: 'ronda_win2', label: 'Gagner 2 parties de Ronda', metric: 'win_ronda', target: 2, xp: 120 },
    { id: 'kdoub_call3', label: 'Crier 3 KDOUB', metric: 'kdoub_call', target: 3, xp: 80 },
    { id: 'missa2', label: 'Vider la table 2 fois avec une Missa', metric: 'missa', target: 2, xp: 100 },
    { id: 'sota_safe1', label: 'Finir une partie de Sota sans tenir la Sota', metric: 'sota_safe', target: 1, xp: 60 },
    { id: 'hezz2_win2', label: 'Gagner 2 parties de Hezz2', metric: 'win_hezz2', target: 2, xp: 100 },
    { id: 'play3', label: 'Jouer 3 parties (tous jeux)', metric: 'play_any', target: 3, xp: 60 },
    { id: 'darba3', label: 'Faire 3 Darba en Ronda', metric: 'darba', target: 3, xp: 80 },
    { id: 'kdoub_catch2', label: 'Démasquer 2 menteurs en Kdoub', metric: 'kdoub_catch', target: 2, xp: 100 },
    { id: 'kdoub_win1', label: 'Gagner une partie de Kdoub', metric: 'win_kdoub', target: 1, xp: 90 },
    { id: 'hezz2_first1', label: 'Finir 1er en Hezz2', metric: 'hezz2_first', target: 1, xp: 70 },
];

// Jour de jeu au Maroc (UTC+1), ex : "2026-11-08"
function dayKey(now = Date.now()) {
    return new Date(now + 3600 * 1000).toISOString().slice(0, 10);
}

function hashStr(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
}

function dailyChallenges(day = dayKey()) {
    const pool = [...CHALLENGES];
    const out = [];
    let h = hashStr(day);
    while (out.length < 3 && pool.length) {
        h = Math.imul(h ^ (h >>> 13), 2654435761) >>> 0;
        out.push(pool.splice(h % pool.length, 1)[0]);
    }
    return out;
}

// ----------------------------------------------------------------------------
// Titres : débloqués par les statistiques cumulées
// ----------------------------------------------------------------------------
const TITLES = [
    { id: 'roi_ronda', label: 'Rey', desc: 'Gagner 20 parties de Ronda', counter: 'win_ronda', target: 20 },
    { id: 'menteur_chef', label: 'Mosaylima al kadab', desc: 'Gagner 10 parties de Kdoub', counter: 'win_kdoub', target: 10 },
    { id: 'chasseur_sota', label: 'Chasseur de Sota', desc: 'Finir 10 parties de Sota sans la Sota', counter: 'sota_safe', target: 10 },
    { id: 'jamais_khasser', label: 'Jamais Khasser', desc: '10 parties de Hezz2 de suite sans être Khasser', counter: 'hezz2_safe_best', target: 10 },
    { id: 'moul_missa', label: 'Moul Missa', desc: 'Réussir 25 Missa', counter: 'missa', target: 25 },
    { id: 'oeil_lynx', label: 'Se7ar', desc: 'Démasquer 10 menteurs en Kdoub', counter: 'kdoub_catch', target: 10 },
    { id: 'champion', label: 'Moul chi', desc: 'Gagner un tournoi', counter: 'tournament_win', target: 1 },
    { id: 'sultan', label: "Sultan dyal l'binga", desc: 'Gagner un tournoi à entrée en binga', counter: 'binga_tournament_win', target: 1, proposed: true },
];

// ----------------------------------------------------------------------------
// Saisons de 4 semaines (la saison 1 commence le lundi 2 novembre 2026)
// ----------------------------------------------------------------------------
const SEASON_EPOCH = Date.UTC(2026, 10, 2);
const SEASON_MS = 28 * 24 * 3600 * 1000;
const SEASON_TOP_REWARD = 10; // top 10 du classement général : dos exclusif + badge

function seasonOf(now = Date.now()) {
    const id = Math.max(1, Math.floor((now - SEASON_EPOCH) / SEASON_MS) + 1);
    const start = SEASON_EPOCH + (id - 1) * SEASON_MS;
    return { id, start, end: start + SEASON_MS };
}

const GAME_KEYS = ['hezz2', 'ronda', 'kdoub', 'sota'];

// ----------------------------------------------------------------------------
// Binga : monnaie du jeu, gagnée en jouant (jamais achetée, jamais convertie en argent).
// Montants décidés par Yassir : ne pas les changer sans lui demander.
// ----------------------------------------------------------------------------
const BINGA = {
    // Partie finie : même en perdant, on gagne quelque chose
    game: {
        online: { win: 25, loss: 10 }, // au moins un adversaire humain
        bots: { win: 20, loss: 10 }, // contre l'ordinateur seulement
    },
    // Connexion du jour, en série : jour 1, 2, 3 à 6, puis 150 le 7e jour ; ensuite la série recommence
    login: [50, 75, 100, 100, 100, 100, 150],
    rankUp: 100, // à chaque nouveau rang
    playDailyCap: 500, // plafond des binga gagnés en jouant par jour (hors missions et connexion)
    stakes: [10, 50, 100], // parties à mise (salons privés, en option)
    tournamentEntry: 50, // tournoi à entrée en binga
    missions: [
        { id: 'play3', label: 'Jouer 3 parties', metric: 'play', target: 3, binga: 30 },
        { id: 'win1', label: 'Gagner 1 partie', metric: 'win', target: 1, binga: 50 },
        { id: 'other1', label: 'Jouer une partie de Ronda, Kdoub ou Sota', metric: 'other', target: 1, binga: 30 },
    ],
};

// ----------------------------------------------------------------------------
// Cosmétiques : visuels seulement, aucun effet sur le jeu. La rareté change seulement la fréquence
// d'obtention (coffres) et le prix. Les légendaires ne s'achètent pas : coffre Or seulement.
// L'identifiant est aussi la clé gardée dans la liste « unlocks » du compte.
// ----------------------------------------------------------------------------
// value : valeur de référence (doublon d'un coffre = 20 % de cette valeur, en binga)
const RARITIES = {
    commun: { label: 'Commun', price: 100, value: 100, color: '#CBD5E1', rank: 0 },
    rare: { label: 'Rare', price: 250, value: 250, color: '#60A5FA', rank: 1 },
    epique: { label: 'Épique', price: 500, value: 500, color: '#C084FC', rank: 2 },
    legendaire: { label: 'Légendaire', price: null, value: 1000, color: '#F5D77A', rank: 3 }, // coffre Or seulement
};

// ----------------------------------------------------------------------------
// Coffres : ouverts seulement avec des binga gagnés en jouant. 1 cosmétique par coffre.
// Probabilités en % (affichées avant l'ouverture : ne jamais les changer sans le dire).
// pity : après « after » coffres de ce type sans la rareté « rarity » (ou mieux), le suivant la garantit.
// ----------------------------------------------------------------------------
const CHESTS = {
    bronze: { label: 'Coffre Bronze', price: 100, odds: { commun: 70, rare: 25, epique: 5, legendaire: 0 }, color: '#CD7F32' },
    argent: { label: 'Coffre Argent', price: 250, odds: { commun: 40, rare: 40, epique: 18, legendaire: 2 }, pity: { after: 10, rarity: 'epique' }, color: '#C0C0C0' },
    or: { label: 'Coffre Or', price: 500, odds: { commun: 10, rare: 35, epique: 40, legendaire: 15 }, pity: { after: 20, rarity: 'legendaire' }, color: '#F5C542' },
};
const DUPLICATE_REFUND = 0.2; // doublon : 20 % de la valeur en binga, jamais zéro

const COSMETICS = [
    // Dos de cartes (Classique, offert à tous, est le dos par défaut)
    { id: 'back:cuivre', kind: 'back', label: 'Cuivre martelé', rarity: 'commun' },
    { id: 'back:velours', kind: 'back', label: 'Velours rouge', rarity: 'commun' },
    { id: 'back:menthe', kind: 'back', label: 'Thé à la menthe', rarity: 'rare' },
    { id: 'back:rose', kind: 'back', label: 'Rose de Kelaa', rarity: 'rare' },
    { id: 'back:zellige', kind: 'back', label: 'Zellige', rarity: 'rare' },
    { id: 'back:sahara', kind: 'back', label: 'Sahara', rarity: 'rare' },
    { id: 'back:ocean', kind: 'back', label: 'Océan', rarity: 'epique' },
    { id: 'back:neon', kind: 'back', label: 'Néon', rarity: 'epique' },
    { id: 'back:or', kind: 'back', label: 'Or', rarity: 'legendaire' },
    { id: 'back:saison', kind: 'back', label: 'Saison', rarity: 'legendaire' },
    // Champion : réservé au gagnant d'un tournoi (ni boutique, ni coffre)
    { id: 'back:tournoi', kind: 'back', label: 'Champion', rarity: 'legendaire', source: 'tournament' },
    // Sultan : réservé au gagnant d'un tournoi à entrée en binga (ni boutique, ni coffre)
    { id: 'back:sultan', kind: 'back', label: 'Sultan', rarity: 'legendaire', source: 'binga_tournament' },

    // Effets de victoire et de coup spécial (l'effet « Drapeau » est offert à tous)
    { id: 'effect:confettis', kind: 'effect', label: 'Confettis', rarity: 'commun' },
    { id: 'effect:etoiles', kind: 'effect', label: 'Étoiles', rarity: 'commun' },
    { id: 'effect:menthe', kind: 'effect', label: 'Menthe', rarity: 'rare' },
    { id: 'effect:feu', kind: 'effect', label: 'Feu', rarity: 'rare' },
    { id: 'effect:tonnerre', kind: 'effect', label: 'Tonnerre', rarity: 'epique' },
    { id: 'effect:or', kind: 'effect', label: 'Or', rarity: 'legendaire' },

    // Réactions (en plus des 4 réactions offertes : 😂 😡 😱 👏)
    { id: 'emote:rire', kind: 'emote', label: 'Rire', rarity: 'commun', emoji: '😂', text: 'Hhhhh' },
    { id: 'emote:bravo', kind: 'emote', label: 'Bravo', rarity: 'commun', emoji: '👏', text: 'Bravo !' },
    { id: 'emote:aie', kind: 'emote', label: 'Aïe', rarity: 'commun', emoji: '😖', text: 'Aïe !' },
    { id: 'emote:merci', kind: 'emote', label: 'Merci', rarity: 'commun', emoji: '🙏', text: 'Choukran' },
    { id: 'emote:triste', kind: 'emote', label: 'Triste', rarity: 'commun', emoji: '😢', text: 'Hchouma…' },
    { id: 'emote:surpris', kind: 'emote', label: 'Surpris', rarity: 'commun', emoji: '😮', text: 'Waaa !' },
    { id: 'emote:bienjoue', kind: 'emote', label: 'Bien joué', rarity: 'rare', emoji: '👍', text: 'Mzyana !' },
    { id: 'emote:dors', kind: 'emote', label: 'Dors', rarity: 'rare', emoji: '😴', text: 'Fi9 !' },
    { id: 'emote:chat', kind: 'emote', label: 'Chat', rarity: 'rare', emoji: '🐱', text: 'Miaou' },
    { id: 'emote:feu', kind: 'emote', label: 'Feu', rarity: 'rare', emoji: '🔥', text: 'Nar !' },
    { id: 'emote:menthe', kind: 'emote', label: 'Menthe', rarity: 'epique', emoji: '🍵', text: 'Atay ?', image: 'menthe' },
    { id: 'emote:couronne', kind: 'emote', label: 'Couronne', rarity: 'legendaire', emoji: '👑', text: 'Sultan !' },

    // Tables (images de Yassir) : remplacent la table du jeu, pour les 4 jeux
    { id: 'table:vert', kind: 'table', label: 'Vert classique', rarity: 'commun' },
    { id: 'table:velours', kind: 'table', label: 'Velours rouge', rarity: 'commun' },
    { id: 'table:cuivre', kind: 'table', label: 'Cuivre sculpté', rarity: 'rare' },
    { id: 'table:zellige', kind: 'table', label: 'Zellige', rarity: 'rare' },
    { id: 'table:turquoise', kind: 'table', label: 'Turquoise', rarity: 'rare' },
    { id: 'table:nuit', kind: 'table', label: 'Nuit (marbre noir)', rarity: 'epique' },
    { id: 'table:sahara', kind: 'table', label: 'Sahara', rarity: 'epique' },
    { id: 'table:pourpre', kind: 'table', label: 'Pourpre royal', rarity: 'legendaire' },

    // Portraits 13 à 28 (planche de Yassir) ; les 12 premiers restent offerts
    { id: 'avatar:13', kind: 'avatar', label: 'Roi', rarity: 'rare' },
    { id: 'avatar:14', kind: 'avatar', label: 'Reine', rarity: 'rare' },
    { id: 'avatar:15', kind: 'avatar', label: 'Lion couronné', rarity: 'epique' },
    { id: 'avatar:16', kind: 'avatar', label: 'Tigre blanc', rarity: 'epique' },
    { id: 'avatar:17', kind: 'avatar', label: 'Sage', rarity: 'rare' },
    { id: 'avatar:18', kind: 'avatar', label: 'Aigle', rarity: 'rare' },
    { id: 'avatar:19', kind: 'avatar', label: 'Touareg', rarity: 'commun' },
    { id: 'avatar:20', kind: 'avatar', label: 'Dame voilée', rarity: 'commun' },
    { id: 'avatar:21', kind: 'avatar', label: 'Cheval noir', rarity: 'commun' },
    { id: 'avatar:22', kind: 'avatar', label: 'Loup', rarity: 'rare' },
    { id: 'avatar:23', kind: 'avatar', label: 'As couronné', rarity: 'commun' },
    { id: 'avatar:24', kind: 'avatar', label: 'Bouffon', rarity: 'commun' },
    { id: 'avatar:25', kind: 'avatar', label: 'Pacha', rarity: 'commun' },
    { id: 'avatar:26', kind: 'avatar', label: 'Capuche rouge', rarity: 'commun' },
    { id: 'avatar:27', kind: 'avatar', label: 'Phénix', rarity: 'legendaire' },
    { id: 'avatar:28', kind: 'avatar', label: "Dragon d'or", rarity: 'legendaire' },

    // Tapis des défis du jour (couleur du tapis d'une table de jeu)
    { id: 'felt:hezz2:tadelakt', kind: 'felt', game: 'hezz2', label: 'Tadelakt (Hezz2)', rarity: 'rare' },
    { id: 'felt:ronda:safran', kind: 'felt', game: 'ronda', label: 'Safran (Ronda)', rarity: 'rare' },
    { id: 'felt:kdoub:braise', kind: 'felt', game: 'kdoub', label: 'Braise (Kdoub)', rarity: 'rare' },
    { id: 'felt:sota:lavande', kind: 'felt', game: 'sota', label: 'Lavande (Sota)', rarity: 'rare' },
];

// Prix en binga (null = ne s'achète pas : légendaire ou exclusif)
function priceOf(item) {
    if (!item || item.source) return null;
    return RARITIES[item.rarity]?.price ?? null;
}
const cosmetic = (id) => COSMETICS.find((c) => c.id === id) || null;
// Portraits : 1 à 12 offerts, 13 à 28 à débloquer (boutique, coffres)
const FREE_AVATARS = 12;
const MAX_AVATAR = 28;

module.exports = {
    RARITIES, COSMETICS, priceOf, cosmetic, CHESTS, DUPLICATE_REFUND, FREE_AVATARS, MAX_AVATAR,
    RANKS, rankFor, XP, AFK_XP_LIMIT, REWARDS, CHALLENGES, dailyChallenges, dayKey,
    TITLES, seasonOf, SEASON_MS, SEASON_TOP_REWARD, GAME_KEYS, BINGA,
};
