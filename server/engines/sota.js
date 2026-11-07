/**
 * Moteur Sota Ghamla (variante marocaine du Pouilleux). Serveur autoritaire.
 *
 * Règles V1 (version de Yassir, confirmées le 7 nov 2026) :
 * - 4 à 6 joueurs, chacun pour soi.
 * - Jeu espagnol avec 3 Sota (valeur 10) au lieu de 4 : 39 cartes, toutes distribuées.
 *   Deux Sota forment une paire, la troisième reste seule : c'est la carte perdante.
 * - Chacun élimine ses paires (2 cartes de même valeur) face visible, au départ puis après chaque pioche.
 * - À son tour, le joueur pioche une carte au hasard (dos) dans la main du joueur suivant.
 * - Main vide = sorti (gagné). Le dernier avec des cartes a la Sota : c'est le Ghamla (perdant).
 * - Pas de points en V1. Timer large de 30 s : pioche au hasard à l'expiration.
 *
 * Choix d'implémentation : l'élimination des paires est automatique (pas d'oubli possible),
 * et les mains sont remélangées après chaque pioche (la position d'une carte ne trahit rien).
 */
const { generateDeck, shuffleDeck } = require('./common');

const TURN_SECONDS = 30;
const SOTA = 10;
const REMOVED_SOTA = 'Bastos-10'; // une des 4 Sota est retirée → 3 Sota en jeu

const clone = (o) => JSON.parse(JSON.stringify(o));

function emit(s, ev) {
    s.eventSeq = (s.eventSeq || 0) + 1;
    s.events.push({ ...ev, id: s.eventSeq });
}

// Retire toutes les paires d'une main (2 par 2, quelle que soit la famille)
function removePairs(hand) {
    const byValue = {};
    hand.forEach((c) => { (byValue[c.value] = byValue[c.value] || []).push(c); });
    const pairs = [];
    const keep = [];
    Object.values(byValue).forEach((cards) => {
        for (let i = 0; i + 1 < cards.length; i += 2) pairs.push([cards[i], cards[i + 1]]);
        if (cards.length % 2 === 1) keep.push(cards[cards.length - 1]);
    });
    return { pairs, keep };
}

const hasCards = (s, i) => s.hands[i].length > 0;

// Prochain joueur (sens du jeu) qui a encore des cartes
function nextWithCards(s, from) {
    const n = s.numPlayers;
    for (let k = 1; k <= n; k++) {
        const i = (from + k) % n;
        if (hasCards(s, i)) return i;
    }
    return null;
}

function checkOut(s, i) {
    if (!hasCards(s, i) && !s.outOrder.includes(i)) {
        s.outOrder.push(i);
        emit(s, { type: 'out', player: i, rank: s.outOrder.length });
    }
}

function checkEnd(s) {
    const left = s.hands.map((h, i) => (h.length ? i : -1)).filter((i) => i >= 0);
    if (left.length > 1) return false;
    s.phase = 'over';
    s.mancheTerminee = true;
    s.turn = null;
    s.target = null;
    s.loser = left.length === 1 ? left[0] : null;
    s.sota = s.loser !== null ? s.hands[s.loser][0] : null;
    emit(s, { type: 'game_over', loser: s.loser, sota: s.sota, order: [...s.outOrder] });
    return true;
}

function setTurn(s, player) {
    s.turn = player;
    s.target = player === null ? null : nextWithCards(s, player);
}

function init(numPlayers, prev = null) {
    if (numPlayers < 4 || numPlayers > 6) throw new Error('Sota Ghamla : 4 à 6 joueurs');
    const deck = shuffleDeck(generateDeck((c) => c.id !== REMOVED_SOTA));
    const hands = Array.from({ length: numPlayers }, () => []);
    deck.forEach((card, i) => hands[i % numPlayers].push(card));

    const s = {
        gameType: 'sota',
        numPlayers,
        hands,
        pairs: Array.from({ length: numPlayers }, () => []),
        outOrder: [],
        turn: null,
        target: null,
        phase: 'play',
        loser: null,
        sota: null,
        manche: prev && prev.gameType === 'sota' ? (prev.manche || 1) + 1 : 1,
        mancheTerminee: false,
        events: [],
        eventSeq: prev?.eventSeq || 0,
    };
    emit(s, { type: 'deal', counts: hands.map((h) => h.length) });

    // Élimination initiale des paires
    s.hands = s.hands.map((h, i) => {
        const { pairs, keep } = removePairs(h);
        s.pairs[i].push(...pairs);
        if (pairs.length) emit(s, { type: 'initial_pairs', player: i, pairs });
        return shuffleDeck(keep);
    });
    s.hands.forEach((_, i) => checkOut(s, i));

    // Le perdant précédent commence (sinon le joueur 0), s'il a encore des cartes
    const starter = prev && prev.gameType === 'sota' && prev.loser !== null && prev.numPlayers === numPlayers ? prev.loser : 0;
    if (!checkEnd(s)) setTurn(s, hasCards(s, starter) ? starter : nextWithCards(s, starter));
    return s;
}

function pick(s, p, cardIndex) {
    if (s.phase !== 'play' || s.turn !== p || s.target === null) return false;
    const from = s.target;
    const fromHand = s.hands[from];
    if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= fromHand.length) return false;

    const [card] = fromHand.splice(cardIndex, 1);
    s.hands[p].push(card);
    emit(s, { type: 'pick', by: p, from, card, index: cardIndex });

    // Paire formée avec la carte piochée ?
    const match = s.hands[p].findIndex((c) => c !== card && c.value === card.value);
    if (match !== -1) {
        const pair = [s.hands[p][match], card];
        s.hands[p] = s.hands[p].filter((c) => c !== card && c !== pair[0]);
        s.pairs[p].push(pair);
        emit(s, { type: 'pair', player: p, pair });
    }
    s.hands[p] = shuffleDeck(s.hands[p]);
    s.hands[from] = shuffleDeck(s.hands[from]);

    checkOut(s, from);
    checkOut(s, p);
    if (checkEnd(s)) return true;

    // Le tour passe au suivant qui a encore des cartes
    setTurn(s, nextWithCards(s, p));
    return true;
}

function apply(state, p, action) {
    if (!action || p < 0) return state;
    const s = clone(state);
    s.events = [];
    let ok = false;
    if (action.type === 'pick') ok = pick(s, p, action.cardIndex);
    return ok ? s : state;
}

function timerFor(s) {
    return s.phase === 'over' ? null : TURN_SECONDS;
}

function onTimeout(state) {
    if (state.phase !== 'play' || state.target === null) return state;
    const n = state.hands[state.target].length;
    const next = apply(state, state.turn, { type: 'pick', cardIndex: Math.floor(Math.random() * n) });
    if (next !== state) emitAuto(next, state.turn);
    return next;
}
function emitAuto(s, player) {
    emit(s, { type: 'auto_pick', player });
}

// Bot : il ne peut pas savoir où est la Sota, il pioche au hasard
function botActions(s, isBot) {
    if (s.phase !== 'play' || s.turn === null || !isBot(s.turn)) return [];
    const n = s.hands[s.target].length;
    return [{ player: s.turn, delay: 1300 + Math.random() * 1200, action: { type: 'pick', cardIndex: Math.floor(Math.random() * n) } }];
}

// Chaque joueur ne voit que sa main ; la carte piochée n'est montrée qu'à celui qui pioche (et à celui qui la perd)
function viewFor(s, idx) {
    const v = clone(s);
    v.hands = s.hands.map((h, i) => (i === idx ? h : h.map((_, k) => ({ hidden: true, id: `h${i}-${k}` }))));
    v.events = v.events.map((e) => {
        if (e.type === 'pick' && e.by !== idx && e.from !== idx) {
            const { card, ...rest } = e;
            return rest;
        }
        return e;
    });
    v.myIndex = idx;
    return v;
}

// Abandon : si le partant avait la Sota... on termine proprement, le partant est le Ghamla
function forfeit(state, leaver) {
    const s = clone(state);
    s.events = [];
    s.forfeit = { player: leaver };
    emit(s, { type: 'forfeit', player: leaver });
    s.phase = 'over';
    s.mancheTerminee = true;
    s.turn = null;
    s.target = null;
    s.loser = leaver;
    s.sota = s.hands[leaver].find((c) => c.value === SOTA) || null;
    s.hands.forEach((h, i) => { if (i !== leaver && !s.outOrder.includes(i)) s.outOrder.push(i); });
    emit(s, { type: 'game_over', loser: leaver, sota: s.sota, order: [...s.outOrder] });
    return s;
}

module.exports = {
    type: 'sota',
    label: 'Sota Ghamla',
    sizes: [4, 5, 6],
    maxPlayers: 6,
    canStart: (n) => n >= 4 && n <= 6,
    init,
    apply,
    timerFor,
    onTimeout,
    botActions,
    viewFor,
    forfeit,
    isOver: (s) => s.phase === 'over',
    _internal: { removePairs, REMOVED_SOTA },
};
