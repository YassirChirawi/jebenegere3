const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../engines/ronda');

const C = (value, suit = 'Oros') => ({ id: `${suit}-${value}`, suit, value });
const types = (s) => s.events.map((e) => e.type);

// État contrôlé : 2 joueurs, distribution en cours, donneur = 1 (le joueur 0 commence)
function make({ hands, table = [], numPlayers = 2, dealer = numPlayers - 1, turn = 0, lastDeal = false } = {}) {
    const s = R.init(numPlayers);
    s.hands = hands.map((h) => h.map((c) => ({ ...c })));
    s.dealtHands = s.hands.map((h) => h.map((c) => ({ ...c })));
    s.table = table;
    s.dealer = dealer;
    s.turn = turn;
    s.deal.playedCount = Array(numPlayers).fill(1); // annonces déjà résolues par défaut
    s.deal.resolved = true;
    s.events = [];
    if (lastDeal) {
        s.dealIndex = s.totalDeals;
        s.deck = [];
    }
    return s;
}
const play = (s, p, value, suit) => {
    const idx = s.hands[p].findIndex((c) => c.value === value && (!suit || c.suit === suit));
    assert.notEqual(idx, -1, `carte ${value} absente de la main de ${p}`);
    const next = R.apply(s, p, { type: 'play', cardIndex: idx });
    assert.notEqual(next, s, 'coup refusé');
    return next;
};

test('distribution : 3 cartes chacun, table vide, 6 distributions en 1v1 et 3 en 2v2', () => {
    const a = R.init(2);
    assert.deepEqual(a.hands.map((h) => h.length), [3, 3]);
    assert.equal(a.table.length, 0);
    assert.equal(a.totalDeals, 6);
    const b = R.init(4);
    assert.deepEqual(b.hands.map((h) => h.length), [3, 3, 3, 3]);
    assert.equal(b.totalDeals, 3);
    assert.equal(b.deck.length, 40 - 12);
});

test('capture simple + suite ascendante (un 3 prend 3, 4, 5 mais pas 7)', () => {
    let s = make({ hands: [[C(3, 'Copas'), C(12)], [C(1), C(2)]], table: [C(3), C(4), C(5), C(7)] });
    s = play(s, 0, 3);
    assert.deepEqual(s.table.map((c) => c.value), [7]);
    assert.equal(s.captured[0], 4); // 3, 4, 5 + la carte jouée
    assert.ok(types(s).includes('capture'));
});

test('un 7 prend 7, 10, 11', () => {
    let s = make({ hands: [[C(7, 'Copas'), C(1)], [C(2), C(3)]], table: [C(7), C(10), C(11), C(4)] });
    s = play(s, 0, 7);
    assert.deepEqual(s.table.map((c) => c.value), [4]);
    assert.equal(s.captured[0], 4);
});

test('carte qui ne prend rien : reste sur la table', () => {
    let s = make({ hands: [[C(6), C(1)], [C(2), C(3)]], table: [C(4)] });
    s = play(s, 0, 6);
    assert.deepEqual(s.table.map((c) => c.value).sort(), [4, 6]);
    assert.equal(s.turn, 1);
});

test('Darba +1, puis Hbel +5, puis B\'achra +10 (2 contre 2)', () => {
    let s = make({
        numPlayers: 4,
        dealer: 3,
        hands: [[C(5, 'Oros'), C(1)], [C(5, 'Copas'), C(2)], [C(5, 'Espadas'), C(3)], [C(5, 'Bastos'), C(4)]],
        table: [C(11)],
    });
    s = play(s, 0, 5); // posé
    s = play(s, 1, 5); // darba équipe 1
    assert.ok(types(s).includes('darba'));
    assert.deepEqual(s.scores, [0, 1]);
    assert.equal(s.captured[1], 2);
    s = play(s, 2, 5); // hbel équipe 0 : reprend 3 cartes
    assert.ok(types(s).includes('hbel'));
    assert.deepEqual(s.scores, [5, 1]);
    assert.deepEqual(s.captured, [3, 0]);
    s = play(s, 3, 5); // boug équipe 1 : reprend 4 cartes
    assert.ok(types(s).includes('bachra'));
    assert.deepEqual(s.scores, [5, 11]);
    assert.deepEqual(s.captured, [0, 4]);
});

test('pas de darba si la carte prise n\'est pas celle qui vient d\'être posée', () => {
    let s = make({ hands: [[C(9 - 6), C(1)], [C(5, 'Copas'), C(2)]], table: [C(5)] });
    s = play(s, 0, 3); // pose un 3
    s = play(s, 1, 5); // prend le 5 qui était déjà là
    assert.ok(!types(s).includes('darba'));
    assert.deepEqual(s.scores, [0, 0]);
});

test('Missa +1 quand la table est vidée', () => {
    let s = make({ hands: [[C(4, 'Copas'), C(1)], [C(2), C(3)]], table: [C(4), C(5)] });
    s = play(s, 0, 4);
    assert.ok(types(s).includes('missa'));
    assert.deepEqual(s.scores, [1, 0]);
});

test('pas de Missa sur la toute dernière capture de la manche', () => {
    let s = make({ hands: [[], [C(4, 'Copas')]], table: [C(4)], turn: 1, lastDeal: true });
    s = play(s, 1, 4);
    assert.ok(!types(s).includes('missa'));
});

test('annonces : tringa contre ronda = 6 points à la tringa', () => {
    let s = R.init(2);
    s.hands = [[C(4), C(4, 'Copas'), C(4, 'Bastos')], [C(12), C(12, 'Copas'), C(1)]];
    s.dealtHands = JSON.parse(JSON.stringify(s.hands));
    s.table = [];
    s.turn = 0;
    s = R.apply(s, 0, { type: 'announce' });
    s = R.apply(s, 1, { type: 'announce' });
    s = play(s, 0, 4);
    s = play(s, 1, 1);
    const win = s.events.find((e) => e.type === 'announce_win');
    assert.ok(win);
    assert.equal(win.combo, 'tringa');
    assert.equal(win.points, 6);
    assert.equal(s.scores[0] >= 6, true);
});

test('annonces : deux rondas, la plus forte prend tout (12 bat 3)', () => {
    let s = R.init(2);
    s.hands = [[C(3), C(3, 'Copas'), C(5)], [C(12), C(12, 'Copas'), C(1)]];
    s.dealtHands = JSON.parse(JSON.stringify(s.hands));
    s.table = [];
    s.turn = 0;
    s = R.apply(s, 0, { type: 'announce' });
    s = R.apply(s, 1, { type: 'announce' });
    s = play(s, 0, 5);
    s = play(s, 1, 1);
    const win = s.events.find((e) => e.type === 'announce_win');
    assert.equal(win.player, 1);
    assert.equal(win.points, 2);
});

test('annonce impossible sans paire, ou après sa première carte', () => {
    let s = R.init(2);
    s.hands = [[C(3), C(5), C(6)], [C(12), C(12, 'Copas'), C(1)]];
    s.turn = 0;
    assert.equal(R.apply(s, 0, { type: 'announce' }), s);
    s.deal.playedCount[1] = 1;
    assert.equal(R.apply(s, 1, { type: 'announce' }), s);
});

test('égalité de rondas : celui qui mange avec la valeur laisse le point à l\'autre', () => {
    let s = R.init(4);
    s.dealer = 3;
    s.hands = [
        [C(7), C(7, 'Copas'), C(1)],
        [C(7, 'Espadas'), C(7, 'Bastos'), C(2)],
        [C(10), C(11), C(12)],
        [C(4), C(5), C(6)],
    ];
    s.dealtHands = JSON.parse(JSON.stringify(s.hands));
    s.table = [];
    s.turn = 0;
    s = R.apply(s, 0, { type: 'announce' });
    s = R.apply(s, 1, { type: 'announce' });
    s = play(s, 0, 7); // pose un 7
    s = play(s, 1, 2);
    s = play(s, 2, 10);
    s = play(s, 3, 4); // tout le monde a joué : égalité détectée
    assert.ok(s.deal.tie);
    s = play(s, 0, 1);
    const before = [...s.scores];
    s = play(s, 1, 7); // l'équipe 1 mange avec un 7 (darba) → l'équipe 0 prend le point de ronda (2 = 1+1)
    const res = s.events.find((e) => e.type === 'ronda_tie_resolved');
    assert.ok(res);
    assert.equal(res.team, 0);
    assert.equal(s.scores[0], before[0] + 2);
});

test('dénonciation juste : avertissement la 1re fois, points la 2e', () => {
    let s = make({ hands: [[C(6), C(6, 'Copas'), C(1)], [C(2), C(3), C(4)]] });
    s.deal = { playedCount: [0, 0], announced: [null, null], denounceUsed: [false, false], denounced: [false, false], resolved: false, tie: null };
    s = play(s, 0, 1); // joue sans annoncer sa ronda de 6
    s = R.apply(s, 1, { type: 'denounce', target: 0, value: 6 });
    let ev = s.events.find((e) => e.type === 'denounce_ok');
    assert.ok(ev && ev.warning);
    assert.deepEqual(s.scores, [0, 0]);
    assert.equal(s.warnings[0], 1);

    // Deuxième fois (nouvelle distribution simulée)
    s.deal = { playedCount: [1, 0], announced: [null, null], denounceUsed: [false, false], denounced: [false, false], resolved: true, tie: null };
    s = R.apply(s, 1, { type: 'denounce', target: 0, value: 6 });
    ev = s.events.find((e) => e.type === 'denounce_ok');
    assert.equal(ev.warning, false);
    assert.equal(s.scores[1], 1);
});

test('fausse dénonciation : avertissement puis -1 ; une seule par distribution', () => {
    let s = make({ hands: [[C(6), C(5), C(1)], [C(2), C(3), C(4)]] });
    s.deal = { playedCount: [1, 0], announced: [null, null], denounceUsed: [false, false], denounced: [false, false], resolved: false, tie: null };
    s = R.apply(s, 1, { type: 'denounce', target: 0, value: 6 });
    assert.ok(s.events.find((e) => e.type === 'denounce_false').warning);
    assert.equal(R.apply(s, 1, { type: 'denounce', target: 0, value: 5 }), s, 'une seule dénonciation par distribution');
    s.deal.denounceUsed = [false, false];
    s = R.apply(s, 1, { type: 'denounce', target: 0, value: 5 });
    assert.equal(s.scores[1], -1);
});

test('dénonciation impossible après la 2e carte de la cible ou contre un coéquipier', () => {
    let s = make({ numPlayers: 4, dealer: 3, hands: [[C(6), C(6, 'Copas')], [C(2)], [C(3)], [C(4)]] });
    s.deal.playedCount = [2, 0, 0, 0];
    assert.equal(R.apply(s, 1, { type: 'denounce', target: 0, value: 6 }), s);
    s.deal.playedCount = [1, 0, 0, 0];
    assert.equal(R.apply(s, 2, { type: 'denounce', target: 0, value: 6 }), s, 'coéquipier');
});

test('dernière carte du donneur : 12 qui mange = +5 (Rey)', () => {
    let s = make({ hands: [[], [C(12, 'Copas')]], table: [C(12)], turn: 1, dealer: 1, lastDeal: true });
    s = play(s, 1, 12);
    assert.ok(types(s).includes('rey'));
    assert.equal(s.summary.bonus[1], 5);
});

test('dernière carte du donneur : rien mangé = +5 adverse (AS)', () => {
    let s = make({ hands: [[], [C(6)]], table: [C(12)], turn: 1, dealer: 1, lastDeal: true });
    s = play(s, 1, 6);
    const ev = s.events.find((e) => e.type === 'as');
    assert.ok(ev);
    assert.equal(ev.team, 0);
});

test('dernière carte du donneur : manger avec un 1 = +5 adverse', () => {
    let s = make({ hands: [[], [C(1, 'Copas')]], table: [C(1)], turn: 1, dealer: 1, lastDeal: true });
    s = play(s, 1, 1);
    assert.equal(s.events.find((e) => e.type === 'as').team, 0);
});

test('fin de manche : reste de table au dernier preneur, 1 point par carte au-delà de 20', () => {
    let s = make({ hands: [[], [C(6)]], table: [C(2), C(3)], turn: 1, dealer: 1, lastDeal: true });
    s.captured = [24, 13];
    s.lastCaptureTeam = 0;
    s = play(s, 1, 6); // ne prend rien → table (2, 3, 6) au dernier preneur (équipe 0)
    assert.equal(s.mancheTerminee, true);
    assert.deepEqual(s.summary.captured, [27, 13]);
    assert.deepEqual(s.summary.cardPoints, [7, 0]);
    // + 5 pour l'équipe 0 car le donneur n'a rien mangé
    assert.deepEqual(s.scores, [12, 0]);
});

test('victoire à 41 points', () => {
    let s = make({ hands: [[], [C(6)]], table: [], turn: 1, dealer: 1, lastDeal: true });
    s.scores = [38, 10];
    s.captured = [22, 17];
    s.lastCaptureTeam = 0;
    s = play(s, 1, 6);
    assert.equal(s.winnerTeam, 0);
});

test('manche complète entre bots : 40 cartes comptées, pas de blocage', () => {
    for (const n of [2, 4]) {
        let s = R.init(n);
        let guard = 0;
        while (!s.mancheTerminee && guard++ < 500) {
            const acts = R.botActions(s, () => true);
            assert.ok(acts.length > 0, 'les bots doivent toujours avoir une action');
            const a = acts[0];
            const next = R.apply(s, a.player, a.action);
            assert.notEqual(next, s, `action refusée ${JSON.stringify(a)}`);
            s = next;
        }
        assert.equal(s.mancheTerminee, true);
        assert.equal(s.summary.captured[0] + s.summary.captured[1], 40, `n=${n}`);
    }
});

test('vue joueur : les mains adverses sont cachées', () => {
    const s = R.init(2);
    const v = R.viewFor(s, 0);
    assert.equal(v.hands[0][0].hidden, undefined);
    assert.equal(v.hands[1][0].hidden, true);
    assert.equal(v.deck, undefined);
    assert.equal(v.dealtHands, undefined);
});
