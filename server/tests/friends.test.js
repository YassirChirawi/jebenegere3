// Amis : demandes, acceptation, retrait, liste en ligne ; invitation directe dans un salon
process.env.STORE = 'memory';
process.env.START_COUNTDOWN_MS = '0';

const test = require('node:test');
const assert = require('node:assert/strict');
const { io } = require('socket.io-client');
const app = require('../server');
const { createProgress } = require('../progress/progress');
const { memoryStore } = require('../progress/store');

let URL;
const clients = [];
test.before(async () => { URL = `http://localhost:${await app.start(0)}`; });
test.after(async () => { clients.forEach((c) => c.close()); await app.stop(); });

const call = (path, token, body) => fetch(URL + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
}).then(async (r) => ({ status: r.status, ...(await r.json()) }));
function client(token) {
    const c = io(URL, { transports: ['websocket'], forceNew: true });
    clients.push(c);
    return new Promise((resolve) => c.once('connect', () => c.emit('auth', { token }, () => resolve(c))));
}
const once = (c, ev, ms = 3000) => new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout ${ev}`)), ms);
    c.once(ev, (d) => { clearTimeout(t); resolve(d); });
});
const emitAck = (c, ev, data) => new Promise((r) => c.emit(ev, data, r));

test('demande, acceptation automatique si croisée, refus, retrait', async () => {
    const p = createProgress(memoryStore());
    const a = await p.register({ name: 'Amine', password: 'secret12' });
    const b = await p.register({ name: 'Badr', password: 'secret12' });
    const c = await p.register({ name: 'Chaima', password: 'secret12' });
    const A = await p.userFromToken(a.token), B = await p.userFromToken(b.token), C = await p.userFromToken(c.token);

    assert.match((await p.requestFriend(A, 'Personne')).error, /Aucun joueur/);
    assert.match((await p.requestFriend(A, 'amine')).error, /toi/);
    assert.ok((await p.requestFriend(A, 'badr')).sent);
    assert.match((await p.requestFriend(A, 'Badr')).error, /déjà envoyée/);
    let vb = await p.friendsView(B);
    assert.equal(vb.incoming[0].name, 'Amine');
    // Badr demande Amine à son tour : ils deviennent amis
    const r = await p.requestFriend(B, 'Amine');
    assert.ok(r.accepted);
    const va = await p.friendsView(A, (id) => id === B.id);
    assert.deepEqual(va.friends.map((f) => [f.name, f.online]), [['Badr', true]]);
    assert.equal(va.outgoing.length, 0);
    assert.ok(await p.areFriends(A.id, B.id) && await p.areFriends(B.id, A.id));

    // Chaima → Amine, refusée
    await p.requestFriend(C, 'Amine');
    await p.respondFriend(A, C.id, false);
    assert.equal((await p.friendsView(A)).incoming.length, 0);
    assert.equal((await p.friendsView(C)).outgoing.length, 0);

    await p.removeFriend(A, B.id);
    assert.ok(!(await p.areFriends(B.id, A.id)), 'retiré des deux côtés');
});

test('routes amis et invitation directe d\'un ami connecté dans un salon', async () => {
    const a = await app.progress.register({ name: 'Yasmine', password: 'secret12' });
    const b = await app.progress.register({ name: 'Ziad', password: 'secret12' });
    const ca = await client(a.token);
    const cb = await client(b.token);

    const noti = once(cb, 'friends_changed');
    assert.ok((await call('/api/friends/request', a.token, { name: 'Ziad' })).sent);
    assert.equal((await noti).type, 'request');
    const list = await call('/api/friends', b.token);
    assert.equal(list.incoming[0].name, 'Yasmine');
    const acc = once(ca, 'friends_changed');
    assert.ok((await call('/api/friends/respond', b.token, { id: list.incoming[0].id, accept: true })).accepted);
    assert.equal((await acc).type, 'accepted');
    const la = await call('/api/friends', a.token);
    assert.deepEqual(la.friends.map((f) => [f.name, f.online]), [['Ziad', true]]);

    const { roomId } = await emitAck(ca, 'create_room', { playerName: 'Yasmine', gameType: 'ronda' });
    const got = once(cb, 'friend_invite');
    const r = await emitAck(ca, 'friend_invite', { roomId, userId: la.friends[0].id });
    assert.ok(r.success && r.delivered);
    const inv = await got;
    assert.equal(inv.roomId, roomId);
    assert.equal(inv.from.name, 'Yasmine');
    assert.equal(inv.gameType, 'ronda');

    // Pas un ami : refusé ; pas dans le salon : refusé
    const z = await app.progress.register({ name: 'Inconnu', password: 'secret12' });
    await new Promise((res) => setTimeout(res, 1600));
    assert.equal((await emitAck(ca, 'friend_invite', { roomId, userId: (await app.progress.userFromToken(z.token)).id })).success, false);
    assert.equal((await emitAck(cb, 'friend_invite', { roomId, userId: la.friends[0].id })).success, false);
    assert.equal((await call('/api/friends', 'faux.jeton')).status, 401);
});
