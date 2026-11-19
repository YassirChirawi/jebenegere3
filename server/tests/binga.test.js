// Lot 1 : binga gagnés en jouant (même en perdant), connexion du jour, missions, rang, plafond de 500 par jour.
// Tout est calculé par le serveur : l'appli ne peut rien créditer elle-même.
process.env.STORE = 'memory';
process.env.START_COUNTDOWN_MS = '0';

const test = require('node:test');
const assert = require('node:assert/strict');
const { io } = require('socket.io-client');
const { createProgress } = require('../progress/progress');
const { memoryStore } = require('../progress/store');
const { BINGA, dayKey } = require('../progress/defs');
const app = require('../server');
const { getEngine } = require('../engines');

const DAY = Date.UTC(2026, 10, 9, 12);
const H = 3600 * 1000;
const game = (extra) => ({ game: 'hezz2', xp: 0, record: true, won: false, result: 'x', counters: {}, ...extra });

async function fresh() {
    const p = createProgress(memoryStore());
    const { profile } = await p.register({ name: 'Joueur', password: 'secret1' });
    return { p, id: profile.id, user: await p.store.get(profile.id) };
}

// ------------------------------------------------------------------ règles (sans réseau)
test('défaite = 10 binga, victoire = 25 (en ligne) ou 20 (contre l\'ordinateur)', async () => {
    const { p, id } = await fresh();
    let r = await p.award(id, game({ won: false }), DAY);
    assert.equal(r.binga.game, 10, 'même en perdant');
    r = await p.award(id, game({ won: true }), DAY);
    assert.equal(r.binga.game, 25);
    r = await p.award(id, game({ won: true, vsBots: true }), DAY);
    assert.equal(r.binga.game, 20);
    r = await p.award(id, game({ won: false, vsBots: true }), DAY);
    assert.equal(r.binga.game, 10);
    assert.equal(r.profile.binga.playToday, 65);
});

test('abandon, partie jouée en automatique, manche de Ronda en cours : pas de binga de partie', async () => {
    const { p, id } = await fresh();
    assert.equal((await p.recordAbandon(id, 'hezz2', 'Bot', DAY)).binga.game, 0);
    assert.equal((await p.award(id, game({ afk: true, won: true }), DAY)).binga.game, 0);
    assert.equal((await p.award(id, game({ game: 'ronda', record: false }), DAY)).binga.game, 0);
    const prof = await p.profile(await p.store.get(id), DAY);
    assert.equal(prof.binga.balance, 0);
    assert.equal(prof.binga.missions.find((m) => m.id === 'play3').progress, 0, 'ne compte pas pour les missions');
});

test('missions du jour : 3 parties = 30, 1 victoire = 50, Ronda/Kdoub/Sota = 30, une seule fois par jour', async () => {
    const { p, id } = await fresh();
    let r = await p.award(id, game({ won: true }), DAY); // 25 + mission « gagner » 50
    assert.deepEqual(r.binga.missions.map((m) => [m.id, m.binga]), [['win1', 50]]);
    r = await p.award(id, game({ game: 'sota' }), DAY); // 10 + mission « autre jeu » 30
    assert.deepEqual(r.binga.missions.map((m) => m.id), ['other1']);
    r = await p.award(id, game({}), DAY); // 10 + mission « 3 parties » 30
    assert.deepEqual(r.binga.missions.map((m) => m.id), ['play3']);
    assert.equal(r.binga.total, 40);
    r = await p.award(id, game({ won: true, game: 'kdoub' }), DAY);
    assert.equal(r.binga.missions.length, 0, 'déjà faites aujourd\'hui');
    assert.equal(r.profile.binga.balance, 25 + 50 + 10 + 30 + 10 + 30 + 25);
    // Le lendemain, les missions recommencent
    r = await p.award(id, game({ won: true }), DAY + 24 * H);
    assert.deepEqual(r.binga.missions.map((m) => m.id), ['win1']);
});

test('plafond : pas plus de 500 binga par jour en jouant (missions et connexion en plus)', async () => {
    const { p, id } = await fresh();
    let r;
    for (let i = 0; i < 25; i++) r = await p.award(id, game({ won: true }), DAY); // 25 × 25 = 625 sans plafond
    assert.equal(r.profile.binga.playToday, 500);
    assert.equal(r.binga.game, 0);
    assert.equal(r.binga.capped, true);
    const missions = 30 + 50; // jouer 3 parties, gagner 1 partie
    assert.equal(r.profile.binga.balance, 500 + missions);
    const login = await p.dailyLogin(await p.store.get(id), DAY);
    assert.equal(login.reward.amount, 50, 'la connexion du jour passe au-delà du plafond');
    assert.equal(login.profile.binga.balance, 500 + missions + 50);
    // Le lendemain, on regagne
    r = await p.award(id, game({}), DAY + 24 * H);
    assert.equal(r.binga.game, 10);
});

test('plafond atteint en cours de partie : on reçoit le reste, jamais plus', async () => {
    const { p, id } = await fresh();
    for (let i = 0; i < 19; i++) await p.award(id, game({ won: true }), DAY); // 475
    await p.award(id, game({}), DAY); // 485
    const r = await p.award(id, game({ won: true }), DAY);
    assert.equal(r.binga.game, 15, 'il ne restait que 15 avant le plafond');
    assert.equal(r.binga.capped, true);
    const last = await p.award(id, game({ won: true }), DAY);
    assert.equal(last.binga.game, 0);
    assert.equal(last.profile.binga.playToday, 500);
});

test('connexion du jour : 50, 75, 100, 100, 100, 100, 150, puis la série recommence ; un jour manqué remet à 1', async () => {
    const { p, id } = await fresh();
    const got = [];
    for (let d = 0; d < 9; d++) {
        const u = await p.store.get(id);
        const r = await p.dailyLogin(u, DAY + d * 24 * H);
        got.push(r.reward.amount);
        assert.equal((await p.dailyLogin(u, DAY + d * 24 * H + H)).reward, null, 'une seule fois par jour');
    }
    assert.deepEqual(got, [50, 75, 100, 100, 100, 100, 150, 50, 75]);
    // Un jour sauté : la série repart à 50
    const r = await p.dailyLogin(await p.store.get(id), DAY + 10 * 24 * H);
    assert.equal(r.reward.amount, 50);
    assert.equal(r.reward.streak, 1);
    assert.equal(r.profile.binga.balance, 50 + 75 + 100 * 4 + 150 + 50 + 75 + 50);
});

test('jour de jeu au Maroc : la connexion de 23 h 30 et celle de 0 h 30 comptent pour deux jours', async () => {
    const { p, id } = await fresh();
    const late = Date.UTC(2026, 10, 9, 22, 30); // 23 h 30 au Maroc
    const early = Date.UTC(2026, 10, 9, 23, 30); // 0 h 30 le lendemain
    assert.notEqual(dayKey(late), dayKey(early));
    assert.equal((await p.dailyLogin(await p.store.get(id), late)).reward.amount, 50);
    assert.equal((await p.dailyLogin(await p.store.get(id), early)).reward.amount, 75);
});

test('nouveau rang : +100 binga par rang gagné', async () => {
    const { p, id } = await fresh();
    let r = await p.award(id, game({ xp: 150 }), DAY);
    assert.equal(r.binga.rank, 0);
    r = await p.award(id, game({ xp: 100 }), DAY); // 250 XP : 2e rang
    assert.equal(r.binga.rank, BINGA.rankUp);
    r = await p.award(id, game({ xp: 900, record: false }), DAY); // 1150 XP : saute 1 rang de plus (3e puis 4e)
    assert.equal(r.binga.rank, 2 * BINGA.rankUp);
});

test('le solde est gardé avec le compte (relu depuis la base)', async () => {
    const { p, id } = await fresh();
    await p.award(id, game({ won: true }), DAY);
    const u = await p.store.get(id);
    assert.equal(u.binga.balance, 75);
    assert.equal((await p.profile(u, DAY)).binga.balance, 75);
    assert.equal(u.binga.log[0].amount, 50);
});

test('ancien compte sans binga : solde à 0, rien ne casse', async () => {
    const { p, id } = await fresh();
    const u = await p.store.get(id);
    delete u.binga;
    await p.store.save(u);
    const r = await p.award(id, game({}), DAY);
    assert.equal(r.profile.binga.balance, 10);
});

// ------------------------------------------------------------------ de bout en bout (serveur réel)
let URL;
const clients = [];
test.before(async () => { URL = `http://localhost:${await app.start(0)}`; });
test.after(async () => { clients.forEach((c) => c.close()); await app.stop(); });

const post = async (path, body, token) => {
    const r = await fetch(URL + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body || {}) });
    return { status: r.status, body: await r.json() };
};
const get = async (path, token) => (await fetch(URL + path, { headers: { Authorization: `Bearer ${token}` } })).json();
function client() {
    const c = io(URL, { transports: ['websocket'], forceNew: true });
    clients.push(c);
    return c;
}
const connected = (c) => (c.connected ? Promise.resolve() : new Promise((r) => c.once('connect', r)));
const emitAck = (c, ev, data) => new Promise((r) => c.emit(ev, data, r));
const once = (c, ev, ms = 6000) => new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout ${ev}`)), ms);
    c.once(ev, (d) => { clearTimeout(t); resolve(d); });
});
async function account(name) {
    const { body } = await post('/api/register', { name, password: 'secret12' });
    const c = client();
    await connected(c);
    await emitAck(c, 'auth', { token: body.token });
    return { c, token: body.token };
}

test('en ligne : partie entre deux comptes, le perdant reçoit 10 binga, le gagnant 25', async () => {
    const a = await account('Gagnant');
    const b = await account('Perdant');
    const { roomId } = await emitAck(a.c, 'create_room', { playerName: 'x', gameType: 'hezz2' });
    await emitAck(b.c, 'join_room', { roomId, playerName: 'y' });
    const started = once(b.c, 'game_started');
    a.c.emit('start_game', { roomId });
    await started;
    const room = app.rooms[roomId];
    const prev = room.gameState;
    const pa = once(a.c, 'progress');
    const pb = once(b.c, 'progress');
    app._commitState(roomId, prev, getEngine('hezz2').forfeit(prev, 1, 0)); // b perd
    const [ra, rb] = await Promise.all([pa, pb]);
    assert.equal(ra.binga.game, 25);
    assert.equal(ra.binga.vsBots, false);
    assert.equal(rb.binga.game, 10, 'même en perdant');
    assert.equal(rb.binga.won, false);
    assert.equal((await get('/api/me', b.token)).profile.binga.balance, 10);
});

test('en ligne : partie contre l\'ordinateur gagnée = 20 binga', async () => {
    const a = await account('ContreBots');
    const r = await emitAck(a.c, 'create_bot_room', { playerName: 'x', botCount: 2, gameType: 'kdoub' });
    const room = app.rooms[r.roomId];
    const prev = room.gameState;
    const prog = once(a.c, 'progress');
    app._commitState(r.roomId, prev, getEngine('kdoub').forfeit(prev, 1, 0));
    const p = await prog;
    assert.equal(p.binga.vsBots, true);
    assert.equal(p.binga.game, 20);
});

test('en ligne : connexion du jour une seule fois, l\'appli ne peut pas se créditer elle-même', async () => {
    const { token } = await account('Matinal');
    const first = await post('/api/daily-login', {}, token);
    assert.equal(first.body.reward.amount, 50);
    const again = await post('/api/daily-login', {}, token);
    assert.equal(again.body.reward, null);
    await post('/api/me', { binga: { balance: 99999 }, balance: 99999 }, token);
    assert.equal((await get('/api/me', token)).profile.binga.balance, 50);
    assert.equal((await post('/api/daily-login', {}, 'faux.jeton')).status, 401);
});
