/**
 * Moteur Ronda (serveur, autoritaire).
 *
 * Règles V1 (version de Yassir) :
 * - 1 contre 1 (2 joueurs) ou 2 contre 2 (4 joueurs, coéquipiers face à face : 0+2 contre 1+3).
 * - Distributions 3, 3 puis 4 cartes par joueur ; en 1 contre 1, deux cycles (6 distributions).
 * - Capture : même valeur + suite ascendante 1..7,10,11,12.
 * - Darba +1 (prendre la carte que l'adversaire vient de poser), Hbel +5 (3e exemplaire à la suite),
 *   B'achra +10 (4e exemplaire), Missa +1 (vider la table, sauf la toute dernière capture).
 * - Annonces Ronda +1 / Tringa +5 avant sa première carte ; seule la plus forte marque
 *   (et prend la somme des annonces : ronda contre tringa = 6, tringa contre tringa = 10).
 * - Égalité de rondas : le camp qui mange en premier avec cette valeur perd le point, l'autre le prend.
 * - Dénonciation "Il est rondé", avertissement la 1re fois puis pénalité.
 * - Dernière carte du donneur : 12 qui mange = +5 (9a3a Rey) ; 1 ou rien mangé = +5 adverse (9a3a AS).
 * - Fin de manche : reste de la table au dernier preneur, 1 point par carte au-delà de 20. Cible 41.
 */
const { VALUES, generateDeck, shuffleDeck, valueRank, nextValue } = require('./common');

const TARGET = 41;
const NEUTRAL = 20;
const DEAL_SIZES = [3, 3, 4];
const ANN_POINTS = { ronda: 1, tringa: 5 };
const TURN_SECONDS = 15;

const teamOf = (p) => p % 2;
const nextPlayer = (p, n) => (p + 1) % n;
const clone = (o) => JSON.parse(JSON.stringify(o));

function emit(s, ev) {
    s.eventSeq = (s.eventSeq || 0) + 1;
    s.events.push({ ...ev, id: s.eventSeq });
}

function addPoints(s, team, pts) {
    s.scores[team] += pts;
    s.mancheBonus[team] += pts;
}

// Meilleure annonce d'une main : tringa (3 identiques) sinon ronda la plus forte
function bestCombo(cards) {
    const counts = {};
    cards.forEach((c) => { counts[c.value] = (counts[c.value] || 0) + 1; });
    let best = null;
    for (const [v, n] of Object.entries(counts)) {
        if (n < 2) continue;
        const combo = { type: n >= 3 ? 'tringa' : 'ronda', value: Number(v) };
        if (!best || stronger(combo, best)) best = combo;
    }
    return best;
}

function stronger(a, b) {
    if (a.type !== b.type) return a.type === 'tringa';
    return valueRank(a.value) > valueRank(b.value);
}

function newDealTracking(n) {
    return {
        playedCount: Array(n).fill(0),
        announced: Array(n).fill(null),
        denounceUsed: Array(n).fill(false),
        denounced: Array(n).fill(false),
        resolved: false,
        tie: null,
    };
}

function dealNext(s) {
    const n = s.numPlayers;
    const size = DEAL_SIZES[s.dealIndex % DEAL_SIZES.length];
    for (let k = 0; k < size; k++) {
        for (let i = 1; i <= n; i++) {
            const p = (s.dealer + i) % n;
            s.hands[p].push(s.deck.pop());
        }
    }
    s.dealtHands = s.hands.map((h) => h.map((c) => ({ ...c })));
    s.deal = newDealTracking(n);
    s.dealIndex += 1;
    s.turn = nextPlayer(s.dealer, n);
    s.chain = null;
    s.lastPlay = null;
    emit(s, { type: 'deal', index: s.dealIndex, total: s.totalDeals, size });
}

function init(numPlayers, prev = null) {
    if (numPlayers !== 2 && numPlayers !== 4) throw new Error('Ronda : 2 ou 4 joueurs');
    const sameGame = prev && prev.gameType === 'ronda' && prev.numPlayers === numPlayers;
    const continuing = sameGame && prev.winnerTeam === null;
    const dealer = sameGame ? nextPlayer(prev.dealer, numPlayers) : numPlayers - 1;

    const s = {
        gameType: 'ronda',
        numPlayers,
        target: TARGET,
        dealer,
        deck: shuffleDeck(generateDeck()),
        hands: Array.from({ length: numPlayers }, () => []),
        dealtHands: [],
        table: [],
        captured: [0, 0],
        topCaptured: [null, null],
        mancheBonus: [0, 0],
        scores: continuing ? [...prev.scores] : [0, 0],
        warnings: continuing ? [...prev.warnings] : Array(numPlayers).fill(0),
        manche: continuing ? prev.manche + 1 : 1,
        turn: null,
        dealIndex: 0,
        totalDeals: numPlayers === 2 ? 6 : 3,
        deal: null,
        chain: null,
        lastPlay: null,
        lastCaptureTeam: null,
        playedValues: {},
        events: [],
        eventSeq: prev?.eventSeq || 0,
        mancheTerminee: false,
        winnerTeam: null,
        summary: null,
    };
    dealNext(s);
    return s;
}

function resolveAnnouncements(s) {
    s.deal.resolved = true;
    const list = s.deal.announced.map((a, p) => (a ? { ...a, player: p } : null)).filter(Boolean);
    if (list.length === 0) return;

    let best = list[0];
    list.forEach((a) => { if (stronger(a, best)) best = a; });
    const total = list.reduce((sum, a) => sum + ANN_POINTS[a.type], 0);

    // Égalité : deux rondas de même valeur dans deux camps différents
    const rival = list.find((a) => a !== best && a.type === best.type && a.value === best.value && teamOf(a.player) !== teamOf(best.player));
    if (rival) {
        s.deal.tie = { value: best.value, points: total, players: [best.player, rival.player] };
        emit(s, { type: 'ronda_tie', value: best.value, players: [best.player, rival.player], points: total });
        return;
    }

    addPoints(s, teamOf(best.player), total);
    emit(s, {
        type: 'announce_win',
        player: best.player,
        team: teamOf(best.player),
        combo: best.type,
        value: best.value,
        points: total,
        all: list.map((a) => ({ player: a.player, combo: a.type, value: a.value })),
    });
}

function isLastDeal(s) {
    return s.dealIndex === s.totalDeals;
}

function endManche(s) {
    // Le reste de la table part au dernier camp qui a mangé
    if (s.table.length > 0) {
        const team = s.lastCaptureTeam ?? teamOf(s.dealer);
        s.captured[team] += s.table.length;
        s.topCaptured[team] = s.table[s.table.length - 1];
        emit(s, { type: 'table_rest', team, count: s.table.length });
        s.table = [];
    }
    const cardPoints = s.captured.map((c) => Math.max(0, c - NEUTRAL));
    cardPoints.forEach((pts, t) => { s.scores[t] += pts; });

    s.summary = {
        captured: [...s.captured],
        cardPoints,
        bonus: [...s.mancheBonus],
        scores: [...s.scores],
    };
    s.mancheTerminee = true;
    s.turn = null;

    const [a, b] = s.scores;
    if ((a >= TARGET || b >= TARGET) && a !== b) s.winnerTeam = a > b ? 0 : 1;
    emit(s, { type: 'manche_end', winnerTeam: s.winnerTeam });
}

function play(s, p, cardIndex) {
    if (s.turn !== p || s.mancheTerminee) return false;
    const hand = s.hands[p];
    const card = hand[cardIndex];
    if (!card) return false;
    hand.splice(cardIndex, 1);

    const n = s.numPlayers;
    const t = teamOf(p);
    const prevPlayer = (p - 1 + n) % n;
    const finalPlay = isLastDeal(s) && s.hands.every((h) => h.length === 0);
    s.playedValues[card.value] = (s.playedValues[card.value] || 0) + 1;

    let capturedSomething = false;
    const chainAlive = s.chain && s.lastPlay && s.lastPlay.player === prevPlayer && s.chain.value === card.value && s.chain.team !== t;

    if (chainAlive) {
        // Hbel (3e exemplaire) ou B'achra (4e) : on reprend toute la chaîne
        const len = s.chain.cards.length;
        s.captured[s.chain.team] -= len;
        s.captured[t] += len + 1;
        const kind = len === 2 ? 'hbel' : 'bachra';
        const pts = kind === 'hbel' ? 5 : 10;
        addPoints(s, t, pts);
        s.chain = { value: card.value, cards: [...s.chain.cards, card], team: t };
        s.topCaptured[t] = card;
        s.lastCaptureTeam = t;
        capturedSomething = true;
        emit(s, { type: kind, player: p, team: t, card, points: pts, count: len + 1 });
    } else {
        const idx = s.table.findIndex((c) => c.value === card.value);
        if (idx !== -1) {
            const taken = [s.table[idx]];
            s.table.splice(idx, 1);
            let v = nextValue(card.value);
            while (v !== null) {
                const j = s.table.findIndex((c) => c.value === v);
                if (j === -1) break;
                taken.push(s.table[j]);
                s.table.splice(j, 1);
                v = nextValue(v);
            }
            s.captured[t] += taken.length + 1;
            s.topCaptured[t] = card;
            s.lastCaptureTeam = t;
            capturedSomething = true;
            emit(s, { type: 'capture', player: p, team: t, card, taken });

            const darba = s.lastPlay && s.lastPlay.player === prevPlayer && !s.lastPlay.captured && s.lastPlay.card.id === taken[0].id;
            if (darba) {
                addPoints(s, t, 1);
                s.chain = { value: card.value, cards: [taken[0], card], team: t };
                emit(s, { type: 'darba', player: p, team: t, card, points: 1 });
            } else {
                s.chain = null;
            }

            if (s.table.length === 0 && !finalPlay) {
                addPoints(s, t, 1);
                emit(s, { type: 'missa', player: p, team: t, points: 1 });
            }
        } else {
            s.table.push(card);
            s.chain = null;
            emit(s, { type: 'place', player: p, card });
        }
    }

    // Égalité de rondas : le camp qui mange avec cette valeur laisse le point à l'autre
    const tie = s.deal.tie;
    if (tie && capturedSomething && card.value === tie.value) {
        const eater = tie.players.find((q) => teamOf(q) === t);
        const other = tie.players.find((q) => teamOf(q) !== t);
        if (eater !== undefined && other !== undefined) {
            addPoints(s, teamOf(other), tie.points);
            emit(s, { type: 'ronda_tie_resolved', eater, player: other, team: teamOf(other), value: tie.value, points: tie.points });
            s.deal.tie = null;
        }
    }

    s.lastPlay = { player: p, card, captured: capturedSomething };
    s.deal.playedCount[p] += 1;
    if (!s.deal.resolved && s.deal.playedCount.every((c) => c >= 1)) resolveAnnouncements(s);

    // Dernière carte du donneur
    if (p === s.dealer && finalPlay) {
        if (capturedSomething && card.value === 12) {
            addPoints(s, t, 5);
            emit(s, { type: 'rey', player: p, team: t, points: 5 });
        } else if (!capturedSomething || card.value === 1) {
            addPoints(s, 1 - t, 5);
            emit(s, { type: 'as', player: p, team: 1 - t, points: 5, missed: !capturedSomething });
        }
    }

    if (s.hands.every((h) => h.length === 0)) {
        if (s.deal.tie) emit(s, { type: 'ronda_tie_void', value: s.deal.tie.value });
        if (!isLastDeal(s)) dealNext(s);
        else endManche(s);
    } else {
        s.turn = nextPlayer(p, n);
        if (s.turn === s.dealer && isLastDeal(s) && s.hands[s.dealer].length === 1) {
            emit(s, { type: 'dealer_last', player: s.dealer });
        }
    }
    return true;
}

function announce(s, p) {
    if (s.mancheTerminee || s.deal.playedCount[p] > 0 || s.deal.announced[p]) return false;
    const combo = bestCombo(s.hands[p]);
    if (!combo) return false;
    s.deal.announced[p] = combo;
    emit(s, { type: 'announce', player: p, combo: combo.type });
    return true;
}

// Fenêtre de dénonciation : la cible a joué exactement sa première carte de la distribution sans annoncer
function canDenounce(s, d, target) {
    if (s.mancheTerminee || !s.deal) return false;
    if (teamOf(d) === teamOf(target)) return false;
    if (s.deal.denounceUsed[d] || s.deal.denounced[target]) return false;
    return s.deal.playedCount[target] === 1 && !s.deal.announced[target];
}

function denounce(s, d, target, value) {
    if (!VALUES.includes(value) || !canDenounce(s, d, target)) return false;
    s.deal.denounceUsed[d] = true;
    const count = s.dealtHands[target].filter((c) => c.value === value).length;

    if (count >= 2) {
        s.deal.denounced[target] = true;
        const combo = count >= 3 ? 'tringa' : 'ronda';
        const warning = s.warnings[target] === 0;
        s.warnings[target] += 1;
        const pts = warning ? 0 : ANN_POINTS[combo];
        if (pts) addPoints(s, teamOf(d), pts);
        emit(s, { type: 'denounce_ok', by: d, target, value, combo, warning, points: pts, team: teamOf(d) });
    } else {
        const warning = s.warnings[d] === 0;
        s.warnings[d] += 1;
        if (!warning) addPoints(s, teamOf(d), -1);
        emit(s, { type: 'denounce_false', by: d, target, value, warning, points: warning ? 0 : -1, team: teamOf(d) });
    }
    return true;
}

function apply(state, p, action) {
    if (!action || p < 0) return state;
    const s = clone(state);
    s.events = [];
    let ok = false;
    if (action.type === 'play') ok = play(s, p, action.cardIndex);
    else if (action.type === 'announce') ok = announce(s, p);
    else if (action.type === 'denounce') ok = denounce(s, p, action.target, action.value);
    return ok ? s : state;
}

function timerFor(s) {
    return s.mancheTerminee ? null : TURN_SECONDS;
}

// Temps écoulé : une carte au hasard (si une seule carte, c'est elle)
function onTimeout(state) {
    const hand = state.hands[state.turn] || [];
    if (!hand.length) return state;
    return apply(state, state.turn, { type: 'play', cardIndex: Math.floor(Math.random() * hand.length) });
}

/* ------------------------------ BOTS ------------------------------ */

// Hash stable pour que la décision "dénoncer ou pas" ne soit tirée qu'une fois par situation
function chance(...parts) {
    let h = 7;
    parts.join('|').split('').forEach((ch) => { h = (h * 31 + ch.charCodeAt(0)) >>> 0; });
    return (h % 1000) / 1000;
}

function evaluatePlay(s, p, card) {
    const n = s.numPlayers;
    const t = teamOf(p);
    const prevPlayer = (p - 1 + n) % n;
    if (s.chain && s.lastPlay && s.lastPlay.player === prevPlayer && s.chain.value === card.value && s.chain.team !== t) {
        return s.chain.cards.length === 2 ? 30 : 60;
    }
    const idx = s.table.findIndex((c) => c.value === card.value);
    if (idx === -1) return 0;
    let taken = 1;
    let v = nextValue(card.value);
    const values = new Set(s.table.map((c) => c.value));
    while (v !== null && values.has(v)) { taken++; v = nextValue(v); }
    let score = 2 + taken * 2;
    if (s.lastPlay && s.lastPlay.player === prevPlayer && !s.lastPlay.captured && s.lastPlay.card.value === card.value) score += 6;
    if (taken === s.table.length) score += 3;
    return score;
}

function riskOfPlacing(s, p, card) {
    const inHand = s.hands[p].filter((c) => c.value === card.value).length;
    const unseen = 4 - (s.playedValues[card.value] || 0) - inHand;
    let risk = Math.max(0, unseen) * 2;
    // Poser une carte qui prolonge une suite déjà sur la table offre une plus grosse prise
    const rank = valueRank(card.value);
    if (rank > 0 && s.table.some((c) => c.value === VALUES[rank - 1])) risk += 2;
    return risk;
}

function chooseCard(s, p) {
    const hand = s.hands[p];
    const lastDealDealer = p === s.dealer && isLastDeal(s);
    let best = 0;
    let bestScore = -Infinity;
    hand.forEach((card, i) => {
        let score = evaluatePlay(s, p, card);
        if (score === 0) score = -riskOfPlacing(s, p, card);
        // Donneur : garder un 12 (ou une carte qui mange) pour la dernière carte
        if (lastDealDealer && hand.length > 1 && card.value === 12 && score <= 0) score -= 10;
        if (score > bestScore) { bestScore = score; best = i; }
    });
    return best;
}

function botActions(s, isBot) {
    if (s.mancheTerminee) return [];
    const out = [];
    for (let p = 0; p < s.numPlayers; p++) {
        if (!isBot(p)) continue;
        // Annonce automatique avant la première carte
        if (s.deal.playedCount[p] === 0 && !s.deal.announced[p] && bestCombo(s.hands[p])) {
            out.push({ player: p, delay: 500 + p * 150, action: { type: 'announce' } });
            continue;
        }
        // Dénonciation d'une ronda adverse non annoncée (pas à chaque fois)
        for (let target = 0; target < s.numPlayers; target++) {
            if (!canDenounce(s, p, target)) continue;
            const combo = bestCombo(s.dealtHands[target]);
            if (combo && chance(s.manche, s.dealIndex, p, target) < 0.45) {
                out.push({ player: p, delay: 900, action: { type: 'denounce', target, value: combo.value } });
                break;
            }
        }
    }
    if (out.length) return out;
    const p = s.turn;
    if (p !== null && isBot(p) && s.hands[p].length) {
        out.push({ player: p, delay: 1100 + Math.random() * 900, action: { type: 'play', cardIndex: chooseCard(s, p) } });
    }
    return out;
}

/* ------------------------------ VUE ------------------------------ */

// Chaque joueur ne voit que sa propre main
function viewFor(s, idx) {
    const v = clone(s);
    v.hands = s.hands.map((h, i) => (i === idx ? h : h.map((_, k) => ({ hidden: true, id: `h${i}-${k}` }))));
    v.deckCount = s.deck.length;
    delete v.deck;
    delete v.dealtHands;
    if (v.deal) {
        v.deal.announced = s.deal.announced.map((a, i) => (a && i !== idx ? { hidden: true } : a));
        if (v.deal.tie) v.deal.tie = { ...v.deal.tie };
    }
    v.myIndex = idx;
    return v;
}

module.exports = {
    type: 'ronda',
    label: 'Ronda',
    sizes: [2, 4],
    maxPlayers: 4,
    canStart: (n) => n === 2 || n === 4,
    init,
    apply,
    timerFor,
    onTimeout,
    botActions,
    viewFor,
    isOver: (s) => s.mancheTerminee,
    // exposés pour les tests
    _internal: { bestCombo, stronger, teamOf, TARGET, NEUTRAL },
};
