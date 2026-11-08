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

function rawApply(state, p, action) {
    if (!action) return state;
    if (action.type === 'play') return playCard(state, p, action.cardIndex, action.newSuitFor7);
    if (action.type === 'draw') return drawCards(state, p);
    return state;
}

// Une vraie action du joueur remet son compteur d'inactivité à zéro
function apply(state, p, action) {
    const next = rawApply(state, p, action);
    if (next !== state && state.afk?.[p]) next.afk = { ...state.afk, [p]: 0 };
    return next;
}

// Anti-blocage : après 2 tours sans jouer, le joueur absent joue automatiquement (comme un bot)
// au lieu de piocher indéfiniment ; la partie avance et se termine.
const AFK_AUTOPLAY_AFTER = 2;
const DEFENSE_SECONDS = 5;

function timerFor(s) {
    if (s.mancheTerminee) return null;
    if (s.pendingAction) return DEFENSE_SECONDS;
    return (s.afk?.[s.turn] || 0) >= AFK_AUTOPLAY_AFTER ? 8 : 15;
}

function onTimeout(s) {
    if (s.pendingAction) return applyPendingAction(s);
    const p = s.turn;
    const missed = (s.afk?.[p] || 0) + 1;
    let next = null;
    if (missed >= AFK_AUTOPLAY_AFTER) {
        const [auto] = botActions(s, () => true).filter((a) => a.action);
        if (auto) next = rawApply(s, p, auto.action);
        if (next === s) next = null;
        if (next) next.autoPlay = { player: p, n: (s.autoPlay?.n || 0) + 1 };
    }
    if (!next) next = drawCards(s, p);
    return { ...next, afk: { ...(s.afk || {}), [p]: missed } };
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

// Abandon en 1 contre 1 : le joueur parti est le Khasser, les autres sont classés devant lui
function forfeit(s, leaver) {
    const n = s.hands.length;
    const order = [...s.finishedPlayers];
    for (let i = 0; i < n; i++) if (i !== leaver && !order.includes(i)) order.push(i);
    const scores = [...s.scores];
    order.forEach((p, k) => { scores[p] += n - k - 1; });
    return { ...s, mancheTerminee: true, loserIndex: leaver, finishedPlayers: order, pendingAction: null, scores, forfeit: { player: leaver } };
}

// Mode test : donne au joueur des 1, 2 et 7 pour vérifier les cartes spéciales contre les bots
const SPECIALS = ['Oros-1', 'Oros-2', 'Oros-7', 'Copas-1', 'Copas-2', 'Copas-7'];
function rigSpecials(state, p = 0, mode = 'specials') {
    const s = JSON.parse(JSON.stringify(state));
    if (mode === 'big') {
        // Grosse main (20 cartes) pour vérifier l'affichage de l'éventail
        while (s.hands[p].length < 20 && s.deck.length > 0) s.hands[p].push(s.deck.pop());
        return s;
    }
    const hand = s.hands[p];
    SPECIALS.forEach((id) => {
        if (hand.some((c) => c.id === id) || s.middlePile.some((c) => c.id === id)) return;
        const swapIdx = hand.findIndex((c) => !SPECIALS.includes(c.id));
        let where = s.deck;
        let k = where.findIndex((c) => c.id === id);
        if (k === -1) {
            for (const h of s.hands) {
                const j = h.findIndex((c) => c.id === id);
                if (j !== -1) { where = h; k = j; break; }
            }
        }
        if (k === -1) return;
        if (swapIdx === -1 || hand.length >= SPECIALS.length) {
            // main pleine de spéciales : on ajoute la carte (la main grossit un peu, c'est un mode test)
            hand.push(where.splice(k, 1)[0]);
        } else {
            const tmp = hand[swapIdx];
            hand[swapIdx] = where[k];
            where[k] = tmp;
        }
    });
    return s;
}

module.exports = {
    type: 'hezz2',
    forfeit,
    rigSpecials,
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
