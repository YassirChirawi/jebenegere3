// Anti-blocage Hezz2 : un joueur qui ne joue jamais ne doit pas faire durer la partie indéfiniment
const test = require('node:test');
const assert = require('node:assert/strict');
const e = require('../engines/hezz2');

function run(n, afkPlayers) {
    let s = e.init(n);
    let steps = 0;
    let maxHand = 0;
    while (!e.isOver(s) && steps < 3000) {
        const acts = afkPlayers.includes(s.turn) && !s.pendingAction ? [] : e.botActions(s, (i) => !afkPlayers.includes(i)).filter((a) => a.action);
        const next = acts.length ? e.apply(s, acts[0].player, acts[0].action) : s;
        s = next === s ? e.onTimeout(s) : next;
        maxHand = Math.max(maxHand, ...afkPlayers.map((p) => s.hands[p].length));
        steps++;
    }
    return { s, steps, maxHand };
}

test('un joueur absent contre un bot : la partie se termine, la main ne gonfle pas', () => {
    for (let k = 0; k < 40; k++) {
        const { s, maxHand } = run(2, [0]);
        assert.ok(e.isOver(s), 'partie terminée');
        assert.ok(maxHand <= 14, `main max ${maxHand}`);
    }
});

test('tous les joueurs absents : la partie se termine quand même', () => {
    for (let k = 0; k < 20; k++) assert.ok(e.isOver(run(3, [0, 1, 2]).s));
});

test("le compteur d'inactivité retombe à 0 dès que le joueur rejoue", () => {
    let s = e.init(2);
    while (s.turn !== 0) s = e.onTimeout(s);
    s = e.onTimeout(s); // 1er oubli : pioche
    assert.equal(s.afk[0], 1);
    while (s.turn !== 0 || s.pendingAction) s = e.onTimeout(s);
    const [a] = e.botActions(s, () => true).filter((x) => x.action);
    s = e.apply(s, 0, a.action);
    assert.equal(s.afk[0], 0);
});

test('la fenêtre de défense contre le 1 dure 5 s', () => {
    assert.equal(e.timerFor({ pendingAction: { type: 'skip_response' }, mancheTerminee: false }), 5);
});
