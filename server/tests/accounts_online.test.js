// Phase 2, de bout en bout : compte HTTP + socket authentifié + XP attribuée par le serveur en fin de partie
process.env.STORE = 'memory';

const test = require('node:test');
const assert = require('node:assert/strict');
const { io } = require('socket.io-client');
const app = require('../server');
const { getEngine } = require('../engines');

let URL;
const clients = [];
test.before(async () => { URL = `http://localhost:${await app.start(0)}`; });
test.after(async () => { clients.forEach((c) => c.close()); await app.stop(); });

const post = async (path, body, token) => {
    const r = await fetch(URL + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json() };
};
const get = async (path, token) => {
    const r = await fetch(URL + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    return { status: r.status, body: await r.json() };
};
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

test('compte : inscription, connexion, profil, erreurs', async () => {
    const reg = await post('/api/register', { name: 'Yassir', password: 'secret12', importXp: 400 });
    assert.equal(reg.status, 200);
    assert.equal(reg.body.profile.xp, 400);
    assert.equal((await post('/api/register', { name: 'yassir', password: 'secret12' })).status, 400);
    assert.equal((await post('/api/login', { name: 'Yassir', password: 'mauvais' })).status, 401);
    const log = await post('/api/login', { name: 'YASSIR', password: 'secret12' });
    assert.equal(log.status, 200);
    const me = await get('/api/me', log.body.token);
    assert.equal(me.body.profile.name, 'Yassir');
    assert.equal(me.body.profile.daily.list.length, 3);
    assert.equal((await get('/api/me', 'faux.jeton')).status, 401);
});

test('partie contre bots : le serveur attribue XP, stats et historique au compte, avec le pseudo du compte', async () => {
    const { body } = await post('/api/register', { name: 'Karima', password: 'secret12' });
    const c = client();
    await connected(c);
    const auth = await emitAck(c, 'auth', { token: body.token });
    assert.equal(auth.user.name, 'Karima');

    const r = await emitAck(c, 'create_bot_room', { playerName: 'NomSaisi', botCount: 2, gameType: 'hezz2' });
    assert.equal(r.gameState.players[0].name, 'Karima', 'le pseudo du compte remplace le nom saisi');
    assert.equal(r.gameState.players[0].userId, body.profile.id);

    // Fin de partie forcée : le joueur gagne par forfait du bot
    const room = app.rooms[r.roomId];
    const prev = room.gameState;
    const next = getEngine('hezz2').forfeit(prev, 1, 0);
    const prog = once(c, 'progress');
    app._commitState(r.roomId, prev, next);
    const p = await prog;
    assert.equal(p.game, 'hezz2');
    assert.ok(p.xpGained >= 100);
    assert.equal(p.profile.stats.hezz2.wins, 1);
    assert.equal(p.profile.history[0].game, 'hezz2');

    // Données relues depuis le serveur (comme après une reconnexion)
    const me = await get('/api/me', body.token);
    assert.equal(me.body.profile.stats.hezz2.played, 1);
    assert.ok(me.body.profile.xp >= 100);
    c.close();
});

test('déconnexion puis reconnexion : la progression est intacte', async () => {
    const { body } = await post('/api/register', { name: 'Reco', password: 'secret12' });
    let c = client();
    await connected(c);
    await emitAck(c, 'auth', { token: body.token });
    const r = await emitAck(c, 'create_bot_room', { playerName: 'x', botCount: 2, gameType: 'kdoub' });
    const room = app.rooms[r.roomId];
    const prev = room.gameState;
    const next = getEngine('kdoub').forfeit(prev, 1, 0);
    const prog = once(c, 'progress');
    app._commitState(r.roomId, prev, next);
    const before = (await prog).profile.xp;
    c.close();

    c = client();
    await connected(c);
    const auth = await emitAck(c, 'auth', { token: body.token });
    assert.equal(auth.user.name, 'Reco');
    const me = await get('/api/me', body.token);
    assert.equal(me.body.profile.xp, before);
    assert.equal(me.body.profile.stats.kdoub.wins, 1);
    c.close();
});

test('abandon en cours de partie : défaite enregistrée, sans XP', async () => {
    const { body } = await post('/api/register', { name: 'Fuyard', password: 'secret12' });
    const a = client();
    const b = client();
    await Promise.all([connected(a), connected(b)]);
    await emitAck(a, 'auth', { token: body.token });
    const room = await emitAck(a, 'create_room', { playerName: 'x', gameType: 'hezz2' });
    await emitAck(b, 'join_room', { roomId: room.roomId, playerName: 'Invité' });
    const started = once(b, 'game_started');
    a.emit('start_game', { roomId: room.roomId });
    await started;
    a.emit('leave_room', { roomId: room.roomId });
    await new Promise((r) => setTimeout(r, 400));
    const me = await get('/api/me', body.token);
    assert.equal(me.body.profile.stats.hezz2.losses, 1);
    assert.equal(me.body.profile.history[0].result, 'Abandon 🏳️');
    assert.equal(me.body.profile.xp, 0);
    b.close();
});

test('classement de la saison : accessible sans compte, pseudo seulement', async () => {
    const lb = await get('/api/leaderboard?game=all');
    assert.equal(lb.status, 200);
    assert.ok(lb.body.season.id >= 1);
    assert.ok(lb.body.top.length >= 1);
    lb.body.top.forEach((row) => assert.deepEqual(Object.keys(row).sort(), ['avatar', 'name', 'rank', 'title', 'xp']));
});

test('invité sans compte : la partie fonctionne comme avant, sans progression serveur', async () => {
    const c = client();
    await connected(c);
    const r = await emitAck(c, 'create_bot_room', { playerName: 'Invité', botCount: 2, gameType: 'hezz2' });
    assert.equal(r.gameState.players[0].name, 'Invité');
    assert.equal(r.gameState.players[0].userId, undefined);
    let got = false;
    c.on('progress', () => { got = true; });
    const room = app.rooms[r.roomId];
    app._commitState(r.roomId, room.gameState, getEngine('hezz2').forfeit(room.gameState, 1, 0));
    await new Promise((res) => setTimeout(res, 300));
    assert.equal(got, false);
    c.close();
});
