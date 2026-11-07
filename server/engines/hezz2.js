// Adaptateur Hezz2 : expose le moteur historique (GameEngine.js) et son IA via l'interface commune.
const { initializeGame, playCard, drawCards, canPlayCard, applyPendingAction } = require('../GameEngine');

function init(numPlayers, prev = null) {
    const prevScores = prev && prev.gameType === 'hezz2'
        ? Array.from({ length: numPlayers }, (_, i) => prev.scores?.[i] ?? 0)
        : null;
    const s = initializeGame(numPlayers, prevScores);
    s.gameType = 'hezz2';
    return s;
}

function apply(state, p, action) {
    if (!action) return state;
    if (action.type === 'play') return playCard(state, p, action.cardIndex, action.newSuitFor7);
    if (action.type === 'draw') return drawCards(state, p);
    return state;
}

function timerFor(s) {
    if (s.mancheTerminee) return null;
    return s.pendingAction ? 3 : 15;
}

function onTimeout(s) {
    if (s.pendingAction) return applyPendingAction(s);
    return drawCards(s, s.turn);
}

// IA historique : normale > 2 > 1 > 7, défense prioritaire, 7 vers la famille la plus fournie
function botActions(s, isBot) {
    if (s.mancheTerminee) return [];
    const p = s.turn;
    if (!isBot(p) || s.finishedPlayers.includes(p)) return [];
    const hand = s.hands[p];
    const delay = s.pendingAction ? 1500 : 1500 + Math.random() * 1500;

    const playable = [];
    hand.forEach((card, i) => { if (canPlayCard(card, s)) playable.push({ card, i }); });

    if (playable.length === 0) {
        if (s.pendingAction) {
            // Pas de 1 pour se défendre : le bot râle, le délai de 3 s fera le reste
            const emojis = ['😡', '😱', '😭', '🤬'];
            return [{ player: p, delay: 800, reaction: emojis[Math.floor(Math.random() * emojis.length)] }];
        }
        return [{ player: p, delay, action: { type: 'draw' } }];
    }

    let chosen;
    if (s.pendingAction || s.drawPenalty > 0) {
        chosen = (playable.find((x) => x.card.value === 1 || x.card.value === 2) || playable[0]).i;
    } else {
        const pick = (arr) => arr[Math.floor(Math.random() * arr.length)].i;
        const normals = playable.filter((x) => ![1, 2, 7].includes(x.card.value));
        const twos = playable.filter((x) => x.card.value === 2);
        const ones = playable.filter((x) => x.card.value === 1);
        const sevens = playable.filter((x) => x.card.value === 7);
        chosen = normals.length ? pick(normals) : twos.length ? pick(twos) : ones.length ? pick(ones) : sevens.length ? sevens[0].i : playable[0].i;
    }

    let newSuitFor7 = null;
    if (hand[chosen].value === 7) {
        const count = { Oros: 0, Copas: 0, Espadas: 0, Bastos: 0 };
        hand.forEach((c) => { if (c.value !== 7) count[c.suit]++; });
        newSuitFor7 = Object.keys(count).reduce((a, b) => (count[b] > count[a] ? b : a));
    }
    return [{ player: p, delay, action: { type: 'play', cardIndex: chosen, newSuitFor7 } }];
}

module.exports = {
    type: 'hezz2',
    label: 'Hezz2',
    sizes: [2, 3, 4],
    maxPlayers: 4,
    canStart: (n) => n >= 2 && n <= 4,
    init,
    apply,
    timerFor,
    onTimeout,
    botActions,
    viewFor: null, // Hezz2 diffuse l'état complet (comportement historique)
    isOver: (s) => s.mancheTerminee,
    rotateLoser: true,
};
