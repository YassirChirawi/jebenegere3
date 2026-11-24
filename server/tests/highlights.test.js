// Temps forts de la partie (écran de fin, résumé des matchs de tournoi) : affichage seulement.
const test = require('node:test');
const assert = require('node:assert/strict');
const { resetHighlights, trackHighlights, highlightsFor } = require('../progress/highlights');
const { tallyEvents, gameResults } = require('../progress/results');
const { buildSummary } = require('../tournaments');

const room = (gameType, n = 2) => {
    const r = { gameType, activePlayers: Array.from({ length: n }, (_, i) => ({ name: `J${i}`, userId: `u${i}` })) };
    resetHighlights(r);
    return r;
};

test('Ronda : les temps forts couvrent toutes les manches (les compteurs des défis, eux, repartent à zéro)', () => {
    const r = room('ronda');
    const manche1 = { events: [{ type: 'darba', player: 0 }, { type: 'missa', player: 1 }, { type: 'hbel', player: 0 }] };
    tallyEvents(r, manche1.events);
    trackHighlights(r, {}, manche1);
    // Fin de manche : les défis sont crédités et room.tally est vidé
    gameResults(r, { summary: { cardPoints: [3, 1], bonus: [0, 0] }, winnerTeam: null, scores: [10, 5] });
    assert.deepEqual(r.tally, {});
    const manche2 = { events: [{ type: 'darba', player: 0 }, { type: 'announce_win', player: 1, combo: 'tringa' }, { type: 'rey', player: 1 }] };
    tallyEvents(r, manche2.events);
    trackHighlights(r, {}, manche2);
    const h = highlightsFor(r, { winnerTeam: 0 });
    assert.deepEqual(h.find((x) => x.kind === 'darba'), { kind: 'darba', player: 0, n: 2 });
    assert.ok(h.some((x) => x.kind === 'tringa' && x.player === 1));
    assert.ok(h.some((x) => x.kind === 'hbel' && x.player === 0));
    // Ordre : les plus gros coups d'abord
    assert.equal(h[0].kind, 'hbel');
});

test('Tournoi de Ronda : le résumé du match n\'est plus vide', () => {
    const r = room('ronda');
    trackHighlights(r, {}, { events: [{ type: 'darba', player: 0 }, { type: 'darba', player: 0 }, { type: 'bachra', player: 1 }] });
    r.tally = {}; // remis à zéro en fin de manche, avant le résumé
    const s = buildSummary(r, { winnerTeam: 0 });
    assert.ok(s.includes('⚡ Boug : J1'), s.join(' | '));
    assert.ok(s.includes('💥 Darba ×2 : J0'), s.join(' | '));
});

test('Hezz2 : la plus grosse pioche et le premier sorti', () => {
    const r = room('hezz2', 3);
    const hand = (k) => Array.from({ length: k }, () => ({}));
    trackHighlights(r, { hands: [hand(4), hand(4), hand(4)] }, { hands: [hand(4), hand(8), hand(4)] }); // +4
    trackHighlights(r, { hands: [hand(4), hand(8), hand(4)] }, { hands: [hand(6), hand(8), hand(4)] }); // +2
    trackHighlights(r, { hands: [hand(6), hand(8), hand(4)] }, { hands: [hand(6), hand(8), hand(5)] }); // +1 : ignoré
    // Cartes posées au milieu : 2 joués par J0 (deux fois), 1 joué par J2
    const mid = (k, v) => [...Array.from({ length: k }, () => ({ value: 5 })), { value: v }];
    trackHighlights(r, { turn: 0, hands: [hand(1)], middlePile: mid(0, 5) }, { hands: [hand(1)], middlePile: mid(1, 2) });
    trackHighlights(r, { turn: 0, hands: [hand(1)], middlePile: mid(1, 2) }, { hands: [hand(1)], middlePile: mid(2, 2) });
    trackHighlights(r, { turn: 2, hands: [hand(1)], middlePile: mid(2, 2) }, { hands: [hand(1)], middlePile: mid(3, 1) });
    trackHighlights(r, { turn: 1, hands: [hand(1)], middlePile: mid(9, 2) }, { hands: [hand(1)], middlePile: mid(0, 2) }); // pioche refaite : rien
    const h = highlightsFor(r, { finishedPlayers: [2, 0], loserIndex: 1 });
    assert.deepEqual(h, [{ kind: 'pile', player: 1, n: 4 }, { kind: 'two', player: 0, n: 2 }, { kind: 'one', player: 2, n: 1 }, { kind: 'first', player: 2, n: 1 }]);
    assert.ok(buildSummary(r, { finishedPlayers: [2, 0], loserIndex: 1 }).includes('🃏 J1 ramasse 4 cartes'));
});

test('Kdoub : menteurs démasqués et plus gros tas ramassé', () => {
    const r = room('kdoub', 3);
    trackHighlights(r, {}, { events: [{ type: 'kdoub', by: 0, truthful: false, loser: 1, taken: 9 }] });
    trackHighlights(r, {}, { events: [{ type: 'kdoub', by: 2, truthful: true, loser: 2, taken: 3 }] });
    const h = highlightsFor(r, {});
    assert.deepEqual(h, [{ kind: 'catch', player: 0, n: 1 }, { kind: 'pile', player: 1, n: 9 }]);
});

test('Sota : le plus de paires et le premier sorti (pas le perdant, pas en cas d\'abandon)', () => {
    const r = room('sota', 4);
    const st = { pairs: [[1], [1, 2, 3], [], [1, 2]], outOrder: [3, 0, 1], loser: 2 };
    assert.deepEqual(highlightsFor(r, st), [{ kind: 'pairs', player: 1, n: 3 }, { kind: 'first', player: 3, n: 1 }]);
    assert.deepEqual(highlightsFor(r, { ...st, forfeit: { player: 2 } }), [{ kind: 'pairs', player: 1, n: 3 }]);
});

test('Nouvelle partie : les temps forts repartent de zéro', () => {
    const r = room('ronda');
    trackHighlights(r, {}, { events: [{ type: 'missa', player: 0 }] });
    resetHighlights(r);
    assert.deepEqual(highlightsFor(r, {}), []);
});
