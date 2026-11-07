/**
 * Moteur Kdoub (bluff, variante marocaine du Menteur). Serveur autoritaire.
 *
 * Règles V1 (validées par Yassir le 7 nov 2026) :
 * - 3 à 6 joueurs, jeu espagnol 40 cartes entièrement distribué (certains ont une carte de plus).
 * - Ordre imposé en boucle : 1, 2, 3, 4, 5, 6, 7, 10, 11, 12, puis 1…
 * - À son tour, on pose 1 à 4 cartes face cachée en annonçant la valeur attendue.
 *   On peut mentir sur les cartes, pas sur le nombre.
 * - Fenêtre de 5 s après chaque pose : n'importe quel adversaire peut crier KDOUB.
 *   Menteur → il ramasse tout le tas. Vrai → l'accusateur ramasse tout le tas.
 * - Personne n'accuse : le tas reste, le tour passe au suivant.
 * - Le premier à vider sa main gagne (validé à la fin de la fenêtre), les autres sont classés
 *   selon le nombre de cartes restantes.
 *
 * Choix d'implémentation (à valider) :
 * - Après une accusation, c'est le joueur APRÈS CELUI QUI RAMASSE le tas qui joue, avec la valeur suivante.
 *   (Repartir après le poseur crée un piège : avec 10 valeurs et 4, 5 ou 6 joueurs, chacun ne voit
 *   jamais que certaines valeurs et ne peut plus poser honnêtement ses autres cartes ; la partie
 *   durait alors plusieurs centaines de poses en simulation, contre ~60 avec cette règle.)
 * - Pas de chrono de 15 s, mais 40 s de sécurité anti-AFK (pose d'une carte au hasard).
 */
const { VALUES, generateDeck, shuffleDeck, nextValueLoop } = require('./common');

const WINDOW_SECONDS = 5;
const TURN_SECONDS = 40;
const MAX_POSE = 4;

const clone = (o) => JSON.parse(JSON.stringify(o));
const nextPlayer = (p, n) => (p + 1) % n;

function emit(s, ev) {
    s.eventSeq = (s.eventSeq || 0) + 1;
    s.events.push({ ...ev, id: s.eventSeq });
}

function init(numPlayers, prev = null) {
    if (numPlayers < 3 || numPlayers > 6) throw new Error('Kdoub : 3 à 6 joueurs');
    const deck = shuffleDeck(generateDeck());
    const hands = Array.from({ length: numPlayers }, () => []);
    deck.forEach((card, i) => hands[i % numPlayers].push(card));

    // On fait commencer le joueur après le gagnant précédent (ou le joueur 0)
    const starter = prev && prev.gameType === 'kdoub' && prev.winner !== null && prev.numPlayers === numPlayers
        ? nextPlayer(prev.winner, numPlayers)
        : 0;

    const s = {
        gameType: 'kdoub',
        numPlayers,
        hands,
        pile: [],
        expected: VALUES[0],
        turn: starter,
        phase: 'play', // 'play' | 'window' | 'over'
        lastPose: null, // { player, count, value, cardIds }
        history: [],
        winner: null,
        ranking: null,
        manche: prev && prev.gameType === 'kdoub' ? (prev.manche || 1) + 1 : 1,
        mancheTerminee: false,
        events: [],
        eventSeq: prev?.eventSeq || 0,
    };
    emit(s, { type: 'deal', counts: hands.map((h) => h.length) });
    return s;
}

function finish(s, winner) {
    s.phase = 'over';
    s.mancheTerminee = true;
    s.winner = winner;
    s.turn = null;
    const others = s.hands
        .map((h, i) => ({ player: i, cards: h.length }))
        .filter((r) => r.player !== winner)
        .sort((a, b) => a.cards - b.cards);
    s.ranking = [{ player: winner, cards: 0 }, ...others];
    emit(s, { type: 'game_over', winner, ranking: s.ranking });
}

function advance(s, from = s.lastPose.player) {
    s.turn = nextPlayer(from, s.numPlayers);
    s.expected = nextValueLoop(s.lastPose.value);
    s.phase = 'play';
}

function pose(s, p, cardIndexes) {
    if (s.phase !== 'play' || s.turn !== p) return false;
    if (!Array.isArray(cardIndexes)) return false;
    const idx = [...new Set(cardIndexes)].filter((i) => Number.isInteger(i) && i >= 0 && i < s.hands[p].length);
    if (idx.length < 1 || idx.length > MAX_POSE || idx.length !== cardIndexes.length) return false;

    const cards = idx.map((i) => s.hands[p][i]);
    s.hands[p] = s.hands[p].filter((_, i) => !idx.includes(i));
    s.pile.push(...cards);
    s.lastPose = { player: p, count: cards.length, value: s.expected, cardIds: cards.map((c) => c.id) };
    s.history.push({ player: p, count: cards.length, value: s.expected });
    if (s.history.length > 12) s.history.shift();
    s.phase = 'window';
    emit(s, { type: 'pose', player: p, count: cards.length, value: s.expected, pile: s.pile.length, last: s.hands[p].length === 0 });
    return true;
}

function accuse(s, by) {
    if (s.phase !== 'window' || !s.lastPose || by === s.lastPose.player) return false;
    const target = s.lastPose.player;
    const revealed = s.pile.slice(-s.lastPose.count);
    const truthful = revealed.every((c) => c.value === s.lastPose.value);
    const loser = truthful ? by : target;
    const taken = s.pile.length;
    s.hands[loser].push(...s.pile);
    s.pile = [];
    emit(s, { type: 'kdoub', by, target, truthful, revealed, value: s.lastPose.value, loser, taken });

    if (truthful && s.hands[target].length === 0) {
        finish(s, target);
        return true;
    }
    advance(s, loser); // le joueur après celui qui ramasse reprend
    return true;
}

// Fin de la fenêtre sans accusation
function closeWindow(s) {
    if (s.phase !== 'window') return false;
    const p = s.lastPose.player;
    emit(s, { type: 'window_closed', player: p });
    if (s.hands[p].length === 0) {
        finish(s, p);
        return true;
    }
    advance(s);
    return true;
}

function apply(state, p, action) {
    if (!action || p < 0) return state;
    const s = clone(state);
    s.events = [];
    let ok = false;
    if (action.type === 'pose') ok = pose(s, p, action.cardIndexes);
    else if (action.type === 'accuse') ok = accuse(s, p);
    // Interne (bots uniquement, filtré par le serveur) : personne ne peut plus accuser
    else if (action.type === '_close_window') ok = closeWindow(s);
    return ok ? s : state;
}

function timerFor(s) {
    if (s.phase === 'over') return null;
    return s.phase === 'window' ? WINDOW_SECONDS : TURN_SECONDS;
}

function onTimeout(state) {
    const s = clone(state);
    s.events = [];
    if (s.phase === 'window') return closeWindow(s) ? s : state;
    if (s.phase === 'play' && s.turn !== null) {
        const hand = s.hands[s.turn];
        if (!hand.length) return state;
        const ok = pose(s, s.turn, [Math.floor(Math.random() * hand.length)]);
        if (ok) emit(s, { type: 'auto_pose', player: s.turn });
        return ok ? s : state;
    }
    return state;
}

/* ------------------------------ BOTS ------------------------------ */

// Probabilité estimée que la dernière pose soit un mensonge, du point de vue du bot.
// Volontairement simple : des bots "parfaits" rallongent beaucoup les parties (mesuré en simulation).
function lieProbability(s, bot) {
    const { count, value, player } = s.lastPose;
    const mine = s.hands[bot].filter((c) => c.value === value).length;
    if (mine + count > 4) return 1; // impossible : mensonge certain
    let p = 0.2 + 0.15 * (count - 1) + 0.15 * mine;
    if (s.hands[player].length === 0) p += 0.25; // il pose ses dernières cartes : on vérifie plus volontiers
    if (s.hands[player].length <= 2) p += 0.1;
    return Math.min(0.95, p);
}

function choosePose(s, p) {
    const hand = s.hands[p];
    const good = hand.map((c, i) => (c.value === s.expected ? i : -1)).filter((i) => i >= 0);
    if (good.length) {
        // Vérité, en ajoutant parfois une carte "cachée" (bluff partiel)
        const pick = good.slice(0, MAX_POSE);
        const others = hand.map((_, i) => i).filter((i) => !good.includes(i));
        if (pick.length < MAX_POSE && others.length && Math.random() < 0.15) pick.push(others[Math.floor(Math.random() * others.length)]);
        return pick;
    }
    // Pas la bonne valeur : on doit mentir. Bluff "gonflé" environ 25 % du temps.
    const order = hand.map((_, i) => i).sort(() => Math.random() - 0.5);
    const n = Math.random() < 0.25 ? Math.min(hand.length, 2 + Math.floor(Math.random() * 2)) : 1;
    return order.slice(0, n);
}

function botActions(s, isBot) {
    if (s.phase === 'over') return [];
    if (s.phase === 'window') {
        // Le bot le plus "convaincu" décide, avec un seul tirage (sinon à plusieurs on accuse toujours)
        let best = null;
        let humanJudge = false;
        for (let b = 0; b < s.numPlayers; b++) {
            if (b === s.lastPose.player) continue;
            if (!isBot(b)) { humanJudge = true; continue; }
            const pr = lieProbability(s, b);
            if (!best || pr > best.pr) best = { b, pr };
        }
        if (best && best.pr >= 0.5 && Math.random() < best.pr) {
            return [{ player: best.b, delay: 1200 + Math.random() * 2300, action: { type: 'accuse' } }];
        }
        // Seuls des bots peuvent accuser et aucun ne le fait : on n'attend pas les 5 s
        if (!humanJudge) return [{ player: s.lastPose.player, delay: 1200, action: { type: '_close_window' } }];
        return [];
    }
    if (isBot(s.turn)) {
        return [{ player: s.turn, delay: 1300 + Math.random() * 1200, action: { type: 'pose', cardIndexes: choosePose(s, s.turn) } }];
    }
    return [];
}

/* ------------------------------ VUE ------------------------------ */

function viewFor(s, idx) {
    const v = clone(s);
    v.hands = s.hands.map((h, i) => (i === idx ? h : h.map((_, k) => ({ hidden: true, id: `h${i}-${k}` }))));
    v.pileCount = s.pile.length;
    delete v.pile;
    if (v.lastPose) delete v.lastPose.cardIds;
    v.myIndex = idx;
    return v;
}

module.exports = {
    type: 'kdoub',
    label: 'Kdoub',
    sizes: [3, 4, 5, 6],
    maxPlayers: 6,
    canStart: (n) => n >= 3 && n <= 6,
    init,
    apply,
    timerFor,
    onTimeout,
    botActions,
    viewFor,
    isOver: (s) => s.phase === 'over',
    _internal: { lieProbability, WINDOW_SECONDS },
};
