/**
 * Traduit la fin d'une partie (ou d'une manche de Ronda) en résultats par joueur :
 * XP (mêmes règles que l'appli), victoire / défaite, texte d'historique, compteurs pour les défis.
 */
const { XP, AFK_XP_LIMIT } = require('./defs');

// Compte les coups spéciaux pendant la partie, à partir des événements des moteurs
function tallyEvents(room, events) {
    if (!events || !events.length) return;
    const t = (room.tally = room.tally || {});
    const add = (p, k, n = 1) => {
        if (p === undefined || p === null || p < 0) return;
        t[p] = t[p] || {};
        t[p][k] = (t[p][k] || 0) + n;
    };
    events.forEach((e) => {
        if (['darba', 'hbel', 'bachra', 'missa'].includes(e.type)) add(e.player, e.type);
        if (e.type === 'kdoub') {
            add(e.by, 'kdoub_call');
            if (!e.truthful) add(e.by, 'kdoub_catch');
        }
    });
}

const opponentsOf = (room, i) => room.activePlayers.filter((_, k) => k !== i).map((p) => p.name).join(', ');

/**
 * Résultats pour les joueurs humains connectés à un compte.
 * Renvoie [{ index, userId, entry }]
 */
function gameResults(room, state) {
    const out = [];
    const n = room.activePlayers.length;
    const tally = room.tally || {};
    const afk = room.afkCount || {};
    const push = (i, entry) => {
        const p = room.activePlayers[i];
        if (!p || p.isBot || !p.userId) return;
        if ((afk[i] || 0) > AFK_XP_LIMIT) entry.xp = 0; // partie jouée en automatique : pas d'XP
        out.push({ index: i, userId: p.userId, entry: { opponents: opponentsOf(room, i), ...entry } });
    };

    switch (room.gameType) {
        case 'hezz2': {
            const loser = state.loserIndex;
            const order = (state.finishedPlayers || []).filter((i) => i !== loser);
            for (let i = 0; i < n; i++) {
                if (i === loser) {
                    push(i, { game: 'hezz2', xp: XP.hezz2.khasser, record: true, won: false, result: 'Khasser 💀', counters: {}, hezz2Khasser: true });
                } else {
                    const pos = order.indexOf(i);
                    const place = pos === -1 ? order.length + 1 : pos + 1;
                    const xp = place === 1 ? XP.hezz2.first : place === 2 ? XP.hezz2.second : XP.hezz2.other;
                    push(i, {
                        game: 'hezz2', xp, record: true, won: true,
                        result: state.forfeit ? 'Victoire par forfait 🏳️' : place === 1 ? 'Victoire 🎉' : `${place}e place`,
                        counters: place === 1 ? { hezz2_first: 1 } : {},
                    });
                }
            }
            break;
        }
        case 'ronda': {
            const sum = state.summary;
            if (!sum) break;
            const gain = [0, 1].map((t) => (sum.cardPoints?.[t] || 0) + (sum.bonus?.[t] || 0));
            const gameOver = state.winnerTeam !== null && state.winnerTeam !== undefined;
            for (let i = 0; i < n; i++) {
                const team = i % 2;
                let xp = gain[team] > gain[1 - team] ? XP.ronda.mancheWon : XP.ronda.mancheLost;
                const won = gameOver && state.winnerTeam === team;
                if (won) xp += XP.ronda.gameWon;
                const counters = {};
                ['darba', 'hbel', 'bachra', 'missa'].forEach((k) => { if (tally[i]?.[k]) counters[k] = tally[i][k]; });
                push(i, {
                    game: 'ronda', xp, record: gameOver, won,
                    result: `${won ? (state.forfeit ? 'Victoire par forfait 🏳️' : 'Victoire 🎉') : 'Défaite 💀'} ${state.scores?.[team] ?? 0}-${state.scores?.[1 - team] ?? 0}`,
                    counters,
                });
            }
            room.tally = {}; // les compteurs sont crédités à chaque fin de manche
            break;
        }
        case 'kdoub': {
            const ranking = state.ranking || [];
            for (let i = 0; i < n; i++) {
                const place = ranking.findIndex((r) => r.player === i);
                const xp = XP.kdoub[Math.min(3, place === -1 ? 3 : place)];
                const counters = {};
                ['kdoub_call', 'kdoub_catch'].forEach((k) => { if (tally[i]?.[k]) counters[k] = tally[i][k]; });
                push(i, {
                    game: 'kdoub', xp, record: true, won: state.winner === i,
                    result: state.winner === i ? (state.forfeit ? 'Victoire par forfait 🏳️' : 'Victoire 🎉') : `${place + 1}e place`,
                    counters,
                });
            }
            break;
        }
        case 'sota': {
            const order = state.outOrder || [];
            for (let i = 0; i < n; i++) {
                const lost = state.loser === i;
                const place = order.indexOf(i);
                const xp = lost ? XP.sota.ghamla : place === 0 ? XP.sota.first : XP.sota.out;
                push(i, {
                    game: 'sota', xp, record: true, won: !lost,
                    result: lost ? 'Ghamla 💀 (Sota)' : place === 0 ? 'Sorti 1er 🎉' : `Sorti ${place + 1}e`,
                    counters: lost ? {} : { sota_safe: 1 },
                });
            }
            break;
        }
        default:
            break;
    }
    return out;
}

module.exports = { tallyEvents, gameResults };
