// Roue du jour : 1 tour gratuit par jour, toujours un lot, chances affichées respectées, tirage côté serveur
process.env.STORE = 'memory';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createProgress } = require('../progress/progress');
const { memoryStore } = require('../progress/store');
const { WHEEL, COSMETICS } = require('../progress/defs');
const { rollWheel } = require('../progress/chests');
const app = require('../server');

const DAY = Date.UTC(2026, 10, 9, 12);
const H = 3600 * 1000;
const forced = (segment) => {
    // rng qui tombe sur la case voulue (premier tirage), puis 0
    let first = true;
    const start = WHEEL.segments.slice(0, segment).reduce((n, s) => n + s.odds, 0);
    return () => { if (first) { first = false; return start; } return 0; };
};

async function player(balance = 0, unlocks = []) {
    const p = createProgress(memoryStore());
    const { profile } = await p.register({ name: 'Tourneur', password: 'secret1' });
    const u = await p.store.get(profile.id);
    u.binga = { balance, log: [] };
    u.unlocks = unlocks;
    await p.store.save(u);
    return { p, user: u };
}

test('roue : chances qui totalisent 100 %, toujours un lot, jamais payante', () => {
    assert.equal(WHEEL.segments.reduce((n, s) => n + s.odds, 0), 100);
    WHEEL.segments.forEach((s) => assert.ok(s.binga || s.chest || s.cosmetic, `${s.id} donne un lot`));
    assert.ok(!('price' in WHEEL), 'pas de tour payant');
});

test('roue : 40 000 tirages, écart de moins de 1 point avec les chances affichées', () => {
    const N = 40000;
    const count = WHEEL.segments.map(() => 0);
    for (let i = 0; i < N; i++) count[rollWheel()] += 1;
    WHEEL.segments.forEach((s, i) => {
        const pct = (100 * count[i]) / N;
        assert.ok(Math.abs(pct - s.odds) < 1, `${s.label} : ${pct.toFixed(2)} % au lieu de ${s.odds} %`);
    });
    console.log('  ', WHEEL.segments.map((s, i) => `${s.label} ${((100 * count[i]) / N).toFixed(1)} %`).join(' · '));
});

test('un tour par jour : le 2e est refusé, le lendemain ça repart', async () => {
    const { p, user } = await player();
    const r = await p.spinWheel(user, DAY, forced(2)); // 50 binga
    assert.equal(r.result.binga, 50);
    assert.equal(r.profile.binga.balance, 50);
    assert.equal(r.profile.wheel.available, false);
    assert.match((await p.spinWheel(user, DAY + H)).error, /demain/);
    const next = await p.spinWheel(user, DAY + 24 * H, forced(0));
    assert.equal(next.result.binga, 20);
});

test('lot « coffre » : le coffre est ouvert gratuitement (rien retiré), l\'objet est ajouté', async () => {
    const { p, user } = await player(0);
    const r = await p.spinWheel(user, DAY, forced(1)); // Coffre Bronze
    assert.equal(r.result.chest.chest, 'bronze');
    assert.equal(r.result.chest.gift, true);
    assert.equal(r.profile.binga.balance, 0, 'rien retiré');
    assert.ok(r.profile.unlocks.includes(r.result.chest.item.id));
    assert.equal(r.profile.chests.history[0].gift, true);
});

test('lot « cosmétique Commun » : un objet qu\'on n\'a pas ; tout possédé = 20 binga', async () => {
    const { p, user } = await player();
    const r = await p.spinWheel(user, DAY, forced(3));
    assert.equal(r.result.item.rarity, 'commun');
    assert.ok(r.profile.unlocks.includes(r.result.item.id));
    const communs = COSMETICS.filter((c) => !c.source && c.rarity === 'commun').map((c) => c.id);
    const { p: p2, user: u2 } = await player(0, communs);
    const r2 = await p2.spinWheel(u2, DAY, forced(3));
    assert.equal(r2.result.duplicate, true);
    assert.equal(r2.result.binga, 20);
});

let URL;
test.before(async () => { URL = `http://localhost:${await app.start(0)}`; });
test.after(async () => { await app.stop(); });

test('en ligne : un tour par jour, l\'appli ne choisit pas la case', async () => {
    const post = async (path, body, token) => {
        const r = await fetch(URL + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body || {}) });
        return { status: r.status, body: await r.json() };
    };
    const reg = await post('/api/register', { name: 'Roue1', password: 'secret12' });
    const r = await post('/api/wheel/spin', { segment: 7 }, reg.body.token);
    assert.equal(r.status, 200);
    assert.ok(Number.isInteger(r.body.result.segment));
    assert.equal((await post('/api/wheel/spin', {}, reg.body.token)).status, 400);
    assert.equal((await post('/api/wheel/spin', {}, 'faux.jeton')).status, 401);
});
