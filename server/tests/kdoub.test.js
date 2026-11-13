const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('../engines/kdoub');

const C = (value, suit = 'Oros') => ({ id: `${suit}-${value}`, suit, value });
const types = (s) => s.events.map((e) => e.type);

function make(hands, { turn = 0, expected = 1, pile = [] } = {}) {
    const s = K.init(hands.length);
    s.hands = hands.map((h) => h.map((c) => ({ ...c })));
    s.turn = turn;
    s.expected = expected;
    s.pile = pile;
    s.events = [];
    return s;
}
const pose = (s, p, idx, value) => {
    const n = K.apply(s, p, { type: 'pose', cardIndexes: idx, value });
    assert.notEqual(n, s, 'pose refusée');
    return n;
};

test('distribution : 40 cartes réparties, écart max 1 carte', () => {
    for (const n of [3, 4, 5, 6]) {
        const s = K.init(n);
        const sizes = s.hands.map((h) => h.length);
        assert.equal(sizes.reduce((a, b) => a + b, 0), 40);
        assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
        assert.equal(s.expected, null, 'le premier joueur choisit la valeur');
    }
});

test('le premier joueur choisit la valeur ; sans KDOUB, tout le monde continue sur la même', () => {
    let s = make([[C(5), C(2)], [C(3), C(4)], [C(5, 'Copas'), C(6)]], { expected: null });
    assert.equal(K.apply(s, 0, { type: 'pose', cardIndexes: [0] }), s, 'valeur obligatoire');
    assert.equal(K.apply(s, 0, { type: 'pose', cardIndexes: [0], value: 8 }), s, 'valeur inexistante');
    s = pose(s, 0, [0], 5);
    assert.equal(s.lastPose.value, 5);
    assert.ok(types(s).includes('choose'));
    s = K.onTimeout(s); // fenêtre fermée sans accusation
    assert.equal(s.expected, 5, 'même valeur');
    assert.equal(s.turn, 1);
    s = pose(s, 1, [0], 12); // la valeur proposée est ignorée : on reste sur 5
    assert.equal(s.lastPose.value, 5);
    assert.equal(s.claimed, 2);
    s = K.onTimeout(s);
    assert.equal(s.expected, 5);
    assert.equal(s.turn, 2);
});

test('pose : 1 à 4 cartes seulement, à son tour, pas pendant la fenêtre', () => {
    const s = make([[C(1), C(1, 'Copas'), C(2), C(3), C(4)], [C(5)], [C(6)]]);
    assert.equal(K.apply(s, 0, { type: 'pose', cardIndexes: [] }), s);
    assert.equal(K.apply(s, 0, { type: 'pose', cardIndexes: [0, 1, 2, 3, 4] }), s);
    assert.equal(K.apply(s, 1, { type: 'pose', cardIndexes: [0] }), s, 'pas son tour');
    const w = pose(s, 0, [0, 1]);
    assert.equal(w.phase, 'window');
    assert.equal(K.apply(w, 1, { type: 'pose', cardIndexes: [0] }), w, 'le suivant attend la fin de la fenêtre');
});

test('accusation juste : le menteur ramasse tout le tas', () => {
    let s = make([[C(3), C(5)], [C(6)], [C(7)]], { expected: 1, pile: [C(10), C(11)] });
    s = pose(s, 0, [0]); // annonce 1 avec un 3 : mensonge
    s = K.apply(s, 2, { type: 'accuse' });
    const ev = s.events.find((e) => e.type === 'kdoub');
    assert.equal(ev.truthful, false);
    assert.equal(ev.loser, 0);
    assert.equal(s.hands[0].length, 1 + 3);
    assert.equal(s.pile.length, 0);
    assert.equal(s.turn, 1, "le joueur d'après le menteur choisit la nouvelle valeur");
    assert.equal(s.expected, null);
    assert.equal(s.claimed, 0);
});

test('accusation fausse : l\'accusateur ramasse tout le tas', () => {
    let s = make([[C(1), C(1, 'Copas'), C(5)], [C(6)], [C(7)]], { expected: 1, pile: [C(10)] });
    s = pose(s, 0, [0, 1]);
    s = K.apply(s, 1, { type: 'accuse' });
    const ev = s.events.find((e) => e.type === 'kdoub');
    assert.equal(ev.truthful, true);
    assert.equal(ev.loser, 1);
    assert.equal(s.hands[1].length, 1 + 3);
    assert.equal(ev.revealed.length, 2);
    assert.equal(s.turn, 0, 'celui qui a dit vrai choisit la nouvelle valeur et rejoue');
    assert.equal(s.expected, null);
    s = pose(s, 0, [0], 5);
    assert.equal(s.lastPose.value, 5);
});

test('on ne peut pas s\'accuser soi-même, ni accuser hors fenêtre, ni deux fois', () => {
    let s = make([[C(1), C(5)], [C(6)], [C(7)]]);
    assert.equal(K.apply(s, 1, { type: 'accuse' }), s, 'hors fenêtre');
    s = pose(s, 0, [1]);
    assert.equal(K.apply(s, 0, { type: 'accuse' }), s, 'soi-même');
    s = K.apply(s, 1, { type: 'accuse' });
    assert.equal(K.apply(s, 2, { type: 'accuse' }), s, 'déjà jugé');
});

test('personne n\'accuse : le tas reste et le tour passe', () => {
    let s = make([[C(1), C(5)], [C(6)], [C(7)]]);
    s = pose(s, 0, [1]);
    s = K.onTimeout(s);
    assert.equal(s.pile.length, 1);
    assert.equal(s.turn, 1);
    assert.equal(s.phase, 'play');
});

test('fin de manche : vider sa main gagne après la fenêtre, classement par cartes restantes', () => {
    let s = make([[C(1)], [C(6), C(7), C(2)], [C(7, 'Copas')]]);
    s = pose(s, 0, [0]);
    assert.equal(s.phase, 'window');
    s = K.onTimeout(s);
    assert.equal(s.phase, 'over');
    assert.equal(s.winner, 0);
    assert.deepEqual(s.ranking.map((r) => r.player), [0, 2, 1]);
});

test('dernières cartes posées en mentant et accusé : pas de victoire', () => {
    let s = make([[C(5)], [C(6), C(7)], [C(2)]], { expected: 1 });
    s = pose(s, 0, [0]);
    s = K.apply(s, 1, { type: 'accuse' });
    assert.equal(s.phase, 'play');
    assert.equal(s.winner, null);
    assert.equal(s.hands[0].length, 1);
});

test('dernières cartes posées en disant vrai et accusé : victoire immédiate', () => {
    let s = make([[C(1)], [C(6), C(7)], [C(2)]], { expected: 1 });
    s = pose(s, 0, [0]);
    s = K.apply(s, 2, { type: 'accuse' });
    assert.equal(s.phase, 'over');
    assert.equal(s.winner, 0);
});

test('timer : 5 s pendant la fenêtre ; pose automatique en cas d\'absence (même s\'il faut choisir)', () => {
    let s = make([[C(1), C(2)], [C(6)], [C(7)]], { expected: null });
    assert.equal(K.timerFor(s), 40);
    s = K.onTimeout(s);
    assert.equal(s.phase, 'window');
    assert.equal(K.timerFor(s), 5);
    assert.ok(types(s).includes('auto_pose'));
    assert.ok([1, 2].includes(s.lastPose.value), 'valeur choisie = la carte posée');
});

test("bot : sait qu'il y a mensonge quand plus de 4 cartes ont été annoncées sur la valeur", () => {
    let s = make([[C(1), C(2), C(3)], [C(1, 'Copas'), C(6)], [C(7), C(10)]], { expected: 1 });
    s.claimed = 3;
    s = pose(s, 0, [0]);
    assert.equal(K._internal.lieProbability(s, 1), 1);
});

test('bot : accuse quand la pose est impossible (il a déjà les cartes)', () => {
    let s = make([[C(1), C(2), C(3)], [C(1, 'Copas'), C(1, 'Espadas'), C(1, 'Bastos')], [C(7)]]);
    s = pose(s, 0, [0, 1]); // annonce deux 1 alors que le joueur 1 en a trois
    assert.equal(K._internal.lieProbability(s, 1), 1);
});

test('partie complète entre bots : se termine avec un gagnant', () => {
    for (const n of [3, 4, 6]) {
        let s = K.init(n);
        let guard = 0;
        while (s.phase !== 'over' && guard++ < 3000) {
            const acts = K.botActions(s, () => true);
            const a = acts[0];
            if (a) {
                const next = K.apply(s, a.player, a.action);
                assert.notEqual(next, s, JSON.stringify(a));
                s = next;
            } else {
                s = K.onTimeout(s); // fenêtre close sans accusation
            }
        }
        assert.equal(s.phase, 'over', `n=${n} trop long`);
        const total = s.hands.reduce((a, h) => a + h.length, 0);
        assert.equal(total + (s.pile ? s.pile.length : 0), 40, 'aucune carte perdue');
        assert.equal(s.hands[s.winner].length, 0);
    }
});

test('vue joueur : mains adverses et tas cachés', () => {
    let s = make([[C(1), C(2)], [C(6)], [C(7)]]);
    s = pose(s, 0, [0]);
    const v = K.viewFor(s, 1);
    assert.equal(v.pile, undefined);
    assert.equal(v.pileCount, 1);
    assert.equal(v.hands[0][0].hidden, true);
    assert.equal(v.lastPose.cardIds, undefined);
});

test('durée raisonnable : une partie entre bots se termine en moins de 400 poses (médiane < 120)', () => {
    for (const n of [4, 6]) {
        const lens = [];
        for (let g = 0; g < 40; g++) {
            let s = K.init(n);
            let poses = 0;
            let guard = 0;
            while (s.phase !== 'over' && guard++ < 4000) {
                const a = K.botActions(s, () => true)[0];
                if (a.action.type === 'pose') poses++;
                s = K.apply(s, a.player, a.action);
            }
            lens.push(s.phase === 'over' ? poses : Infinity);
        }
        lens.sort((a, b) => a - b);
        assert.ok(lens[20] < 120, `n=${n} médiane ${lens[20]}`);
    }
});
