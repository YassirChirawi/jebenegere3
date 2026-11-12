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
    { id: 'back:tournoi', kind: 'back', label: 'Champion de tournoi', source: 'tournament' },
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

module.exports = {
    RANKS, rankFor, XP, AFK_XP_LIMIT, REWARDS, CHALLENGES, dailyChallenges, dayKey,
    TITLES, seasonOf, SEASON_MS, SEASON_TOP_REWARD, GAME_KEYS,
};
