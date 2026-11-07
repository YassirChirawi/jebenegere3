const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../engines/sota');

const C = (value, suit = 'Oros') => ({ id: `${suit}-${value}`, suit, value });

function make(hands, turn = 0) {
    const s = S.init(hands.length);
    s.hands = hands.map((h) => h.map((c) => ({ ...c })));
    s.pairs = hands.map(() => []);
    s.outOrder = [];
    s.phase = 'play';
    s.mancheTerminee = false;
    s.turn = turn;
    s.target = (turn + 1) % hands.length;
    s.events = [];
    return s;
}

test('paquet : 39 cartes avec 3 Sota, toutes distribuées', () => {
    for (const n of [4, 5, 6]) {
        const s = S.init(n);
        const inHands = s.hands.reduce((a, h) => a + h.length, 0);
        const inPairs = s.pairs.reduce((a, p) => a + p.length * 2, 0);
        assert.equal(inHands + inPairs, 39);
        const sotas = [...s.hands.flat(), ...s.pairs.flat(2)].filter((c) => c.value === 10);
        assert.equal(sotas.length, 3);
        assert.ok(!sotas.some((c) => c.id === S._internal.REMOVED_SOTA));
    }
});

test('élimination des paires au départ : 2 → 0 gardée, 3 → 1 gardée, 4 → 2 paires', () => {
    const { pairs, keep } = S._internal.removePairs([C(5), C(5, 'Copas'), C(7), C(7, 'Copas'), C(7, 'Espadas'), C(2), C(2, 'Copas'), C(2, 'Espadas'), C(2, 'Bastos'), C(12)]);
    assert.equal(pairs.length, 4); // 5-5, 7-7, 2-2, 2-2
    assert.deepEqual(keep.map((c) => c.value).sort((a, b) => a - b), [7, 12]);
});

test('après la distribution, aucune main ne contient de paire', () => {
    for (let g = 0; g < 50; g++) {
        const s = S.init(4);
        s.hands.forEach((h) => {
            const vals = h.map((c) => c.value);
            assert.equal(new Set(vals).size, vals.length);
        });
    }
});

test('pioche chez le joueur suivant, élimination immédiate de la paire formée', () => {
    let s = make([[C(3), C(6)], [C(3, 'Copas'), C(11)], [C(12)], [C(10)]]);
    const idx = s.hands[1].findIndex((c) => c.value === 3);
    s = S.apply(s, 0, { type: 'pick', cardIndex: idx });
    assert.deepEqual(s.hands[0].map((c) => c.value), [6]);
    assert.equal(s.pairs[0].length, 1);
    assert.ok(s.events.some((e) => e.type === 'pair'));
    assert.equal(s.turn, 1);
    assert.equal(s.target, 2);
});

test('pioche sans paire : la carte reste en main', () => {
    let s = make([[C(3)], [C(5), C(11)], [C(12)], [C(10)]]);
    const idx = s.hands[1].findIndex((c) => c.value === 5);
    s = S.apply(s, 0, { type: 'pick', cardIndex: idx });
    assert.deepEqual(s.hands[0].map((c) => c.value).sort((a, b) => a - b), [3, 5]);
});

test('on ne pioche que chez le suivant qui a encore des cartes, et seulement à son tour', () => {
    let s = make([[C(3)], [], [C(3, 'Copas'), C(12)], [C(10)]]);
    s.outOrder = [1];
    s.target = 2;
    assert.equal(S.apply(s, 2, { type: 'pick', cardIndex: 0 }), s, 'pas son tour');
    assert.equal(S.apply(s, 0, { type: 'pick', cardIndex: 5 }), s, 'index invalide');
    const n = S.apply(s, 0, { type: 'pick', cardIndex: s.hands[2].findIndex((c) => c.value === 3) });
    assert.equal(n.hands[0].length, 0);
    assert.ok(n.outOrder.includes(0), 'main vide = sorti');
});

test('fin : le dernier joueur avec des cartes a la Sota, c\'est le Ghamla', () => {
    let s = make([[C(4)], [C(4, 'Copas')], [], [C(10)]]);
    s.outOrder = [2];
    s.target = 1;
    // Joueur 0 pioche le 4 du joueur 1 : les deux sortent, il ne reste que le joueur 3 avec la Sota
    s = S.apply(s, 0, { type: 'pick', cardIndex: 0 });
    assert.equal(s.phase, 'over');
    assert.equal(s.loser, 3);
    assert.equal(s.sota.value, 10);
});

test('partie complète entre bots : finit toujours avec une Sota chez le perdant', () => {
    for (const n of [4, 5, 6]) {
        for (let g = 0; g < 30; g++) {
            let s = S.init(n);
            let guard = 0;
            while (s.phase !== 'over' && guard++ < 2000) {
                const a = S.botActions(s, () => true)[0];
                s = S.apply(s, a.player, a.action);
            }
            assert.equal(s.phase, 'over');
            assert.equal(s.sota.value, 10);
            assert.equal(s.hands[s.loser].length, 1);
            assert.equal(s.outOrder.length, n - 1);
        }
    }
});

test('timer : pioche au hasard à l\'expiration', () => {
    const s = make([[C(3)], [C(5), C(11)], [C(12)], [C(10)]]);
    assert.equal(S.timerFor(s), 30);
    const n = S.onTimeout(s);
    assert.equal(n.hands[0].length, 2);
    assert.ok(n.events.some((e) => e.type === 'auto_pick'));
});

test('vue : mains adverses cachées, carte piochée visible seulement des deux joueurs concernés', () => {
    let s = make([[C(3)], [C(5), C(11)], [C(12)], [C(10)]]);
    s = S.apply(s, 0, { type: 'pick', cardIndex: 0 });
    const v2 = S.viewFor(s, 2);
    assert.equal(v2.hands[0][0].hidden, true);
    assert.equal(v2.events.find((e) => e.type === 'pick').card, undefined);
    const v0 = S.viewFor(s, 0);
    assert.ok(v0.events.find((e) => e.type === 'pick').card);
});
