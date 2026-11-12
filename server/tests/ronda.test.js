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

// Distribution contrôlée de 3 cartes chacun, annonces encore ouvertes (pas encore résolues)
function fresh(hands, { numPlayers = hands.length, dealer = numPlayers - 1, lastDeal = false } = {}) {
    const s = R.init(numPlayers);
    s.hands = hands.map((h) => h.map((c) => ({ ...c })));
    s.dealtHands = JSON.parse(JSON.stringify(s.hands));
    s.table = [];
    s.dealer = dealer;
    s.turn = (dealer + 1) % numPlayers;
    s.events = [];
    if (lastDeal) { s.dealIndex = s.totalDeals; s.deck = []; }
    return s;
}

test('annonces : résultat à la fin de la distribution, tringa contre ronda = 6 points', () => {
    let s = fresh([[C(4), C(4, 'Copas'), C(4, 'Bastos')], [C(12), C(12, 'Copas'), C(1)]], { dealer: 1 });
    s = R.apply(s, 0, { type: 'announce' });
    s = R.apply(s, 1, { type: 'announce' });
    s = play(s, 0, 4);
    s = play(s, 1, 1);
    assert.ok(!s.events.some((e) => e.type === 'announce_win'), 'pas encore de résultat');
    s = play(s, 0, 4, 'Copas');
    s = play(s, 1, 12);
    s = play(s, 0, 4, 'Bastos');
    s = play(s, 1, 12, 'Copas'); // dernière carte de la distribution
    const win = s.events.find((e) => e.type === 'announce_win');
    assert.ok(win, 'résultat donné à la fin de la distribution');
    assert.equal(win.combo, 'tringa');
    assert.equal(win.points, 6);
    assert.equal(s.mancheDetail.ronda[0], 6);
});

test('annonces : deux rondas, la plus forte prend tout (12 bat 3)', () => {
    let s = fresh([[C(3), C(3, 'Copas'), C(5)], [C(12), C(12, 'Copas'), C(1)]], { dealer: 1 });
    s = R.apply(s, 0, { type: 'announce' });
    s = R.apply(s, 1, { type: 'announce' });
    for (const [p, v, suit] of [[0, 5], [1, 1], [0, 3], [1, 12], [0, 3, 'Copas']]) s = play(s, p, v, suit);
    s = play(s, 1, 12, 'Copas');
    const win = s.events.find((e) => e.type === 'announce_win');
    assert.equal(win.player, 1);
    assert.equal(win.points, 2);
});

test('annonce possible tant que les cartes de la ronda sont en main, plus après', () => {
    let s = fresh([[C(3), C(5), C(6)], [C(12), C(12, 'Copas'), C(1)]], { dealer: 1 });
    assert.equal(R.apply(s, 0, { type: 'announce' }), s, 'sans paire : impossible');
    s = play(s, 0, 3);
    s = play(s, 1, 1); // une autre carte : la paire de 12 est intacte
    s = play(s, 0, 5);
    const later = R.apply(s, 1, { type: 'announce' });
    assert.notEqual(later, s, 'annonce encore possible en milieu de distribution');

    let t = fresh([[C(3), C(5), C(6)], [C(12), C(12, 'Copas'), C(1)]], { dealer: 1 });
    t = play(t, 0, 3);
    t = play(t, 1, 12); // un 12 est posé
    assert.equal(R.apply(t, 1, { type: 'announce' }), t, 'une carte de la ronda est posée : trop tard');
});

test("égalité de rondas : le camp qui a mangé en premier avec la valeur laisse le point à l'autre", () => {
    let s = fresh([
        [C(7), C(7, 'Copas'), C(1)],
        [C(7, 'Espadas'), C(7, 'Bastos'), C(2)],
        [C(10), C(11), C(12)],
        [C(4), C(5), C(6)],
    ]);
    s = R.apply(s, 0, { type: 'announce' });
    s = R.apply(s, 1, { type: 'announce' });
    s = play(s, 0, 1);
    s = play(s, 1, 7, 'Espadas'); // pose un 7
    s = play(s, 2, 10);
    s = play(s, 3, 4);
    s = play(s, 0, 7); // l'équipe 0 mange avec un 7 la première
    s = play(s, 1, 2);
    s = play(s, 2, 11);
    s = play(s, 3, 5);
    s = play(s, 0, 7, 'Copas');
    s = play(s, 1, 7, 'Bastos');
    s = play(s, 2, 12);
    const before = [...s.scores];
    s = play(s, 3, 6); // fin de distribution
    const res = s.events.find((e) => e.type === 'ronda_tie_resolved');
    assert.ok(res);
    assert.equal(res.team, 1, "l'équipe 1 prend les points de ronda");
    assert.equal(s.scores[1] - before[1] >= 2, true);
});

test("il est rondé : on désigne le joueur, juste si une carte de sa ronda est posée", () => {
    // Paire de 6 non annoncée, un 6 déjà posé : rondé
    let s = fresh([[C(6), C(6, 'Copas'), C(1)], [C(2), C(3), C(4)]], { dealer: 1 });
    s = play(s, 0, 6);
    s = R.apply(s, 1, { type: 'denounce', target: 0 });
    let ev = s.events.find((e) => e.type === 'denounce_ok');
    assert.ok(ev && ev.warning, '1re fois : avertissement');
    assert.equal(ev.value, 6);
    assert.equal(s.warnings[0], 1);

    // 2e fois (autre distribution), en plein milieu : points pris
    let t = fresh([[C(1), C(6), C(6, 'Copas')], [C(2), C(3), C(4)]], { dealer: 1 });
    t.warnings = [1, 0];
    t = play(t, 0, 1);
    t = play(t, 1, 2);
    t = play(t, 0, 6);
    t = R.apply(t, 1, { type: 'denounce', target: 0 });
    ev = t.events.find((e) => e.type === 'denounce_ok');
    assert.equal(ev.warning, false);
    assert.equal(t.scores[1], 1);
});

test("il est rondé : faux si sa paire est encore en main (il peut encore l'annoncer)", () => {
    let s = fresh([[C(1), C(6), C(6, 'Copas')], [C(2), C(3), C(4)]], { dealer: 1 });
    s.warnings = [0, 1];
    s = play(s, 0, 1);
    s = R.apply(s, 1, { type: 'denounce', target: 0 });
    const ev = s.events.find((e) => e.type === 'denounce_false');
    assert.ok(ev);
    assert.equal(s.scores[1], -1);
});

test('dénonciation impossible avant la 1re carte de la cible ou contre un coéquipier', () => {
    let s = make({ numPlayers: 4, dealer: 3, hands: [[C(6), C(6, 'Copas')], [C(2)], [C(3)], [C(4)]] });
    s.deal.playedCount = [0, 0, 0, 0];
    assert.equal(R.apply(s, 1, { type: 'denounce', target: 0 }), s, 'pas encore joué');
    s.deal.playedCount = [1, 0, 0, 0];
    assert.equal(R.apply(s, 2, { type: 'denounce', target: 0 }), s, 'coéquipier');
});

test('42 points en pleine manche : la partie s\'arrête et le gagnant est déclaré', () => {
    let s = make({ hands: [[C(5, 'Copas'), C(1)], [C(5), C(2)]], turn: 1, dealer: 0 });
    s.scores = [10, 41];
    s.table = [];
    s = play(s, 1, 5); // pose un 5
    s = play(s, 0, 5, 'Copas'); // darba : équipe 0 +1 → 11
    assert.equal(s.mancheTerminee, false);
    let t = make({ hands: [[C(5)], [C(5, 'Copas'), C(2)]], turn: 0, dealer: 1 });
    t.scores = [10, 41];
    t = play(t, 0, 5);
    t = play(t, 1, 5, 'Copas'); // darba : équipe 1 atteint 42
    assert.equal(t.mancheTerminee, true);
    assert.equal(t.winnerTeam, 1);
    assert.equal(t.summary.stopped, true);
    assert.ok(types(t).includes('target_reached'));
    assert.deepEqual(t.hands[1].length, 1, 'arrêt immédiat, cartes restantes non jouées');
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

test('victoire à 42 points en fin de manche', () => {
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

test('détail des points : chaque catégorie séparée, la somme égale les bonus', () => {
    for (const n of [2, 4]) {
        for (let k = 0; k < 10; k++) {
            let s = R.init(n);
            let guard = 0;
            while (!s.mancheTerminee && guard++ < 1000) {
                const a = R.botActions(s, () => true);
                s = R.apply(s, a[0].player, a[0].action);
            }
            const d = s.summary.detail;
            for (const key of ['darba', 'ronda', 'hbel', 'boug', 'missa', 'rey', 'as', 'denonce']) assert.ok(Array.isArray(d[key]), key);
            [0, 1].forEach((t) => assert.equal(Object.values(d).reduce((x, v) => x + v[t], 0), s.summary.bonus[t]));
        }
    }
});

test('Darba et Hbel repartent de zéro à chaque distribution', () => {
    // Fin de distribution : le donneur pose un 5 ; nouvelle distribution : prendre ce 5 n'est pas une Darba
    let s = make({ hands: [[], [C(5)]], turn: 1 });
    s = play(s, 1, 5);
    assert.ok(types(s).includes('deal'), 'nouvelle distribution');
    s.hands[0].push(C(5, 'Copas'));
    s = play(s, 0, 5, 'Copas');
    assert.ok(types(s).includes('capture'));
    assert.ok(!types(s).includes('darba'), 'pas de Darba sur la carte de la distribution précédente');

    // Darba sur la dernière carte d'une distribution : le 3e exemplaire au début de la suivante n'est pas un Hbel
    let t = make({ hands: [[C(5)], [C(5, 'Copas')]], turn: 0 });
    t = play(t, 0, 5);
    t = play(t, 1, 5, 'Copas');
    assert.ok(types(t).includes('darba'));
    assert.ok(types(t).includes('deal'));
    t.hands[0].push(C(5, 'Espadas'));
    t = play(t, 0, 5, 'Espadas');
    assert.ok(!types(t).includes('hbel'), 'pas de Hbel à travers deux distributions');
});
