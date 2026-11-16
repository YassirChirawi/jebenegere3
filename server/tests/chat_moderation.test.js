// Modération du chat : filtre d'insultes, signalements, blocage entre joueurs
process.env.STORE = 'memory';

const test = require('node:test');
const assert = require('node:assert/strict');
const { io } = require('socket.io-client');
const app = require('../server');
const moderation = require('../moderation');
const { memoryStore, pgStore, REPORT_TTL_MS } = require('../progress/store');

let URL;
const clients = [];
test.before(async () => { URL = `http://localhost:${await app.start(0)}`; });
test.after(async () => { clients.forEach((c) => c.close()); await app.stop(); });

function client() {
    const c = io(URL, { transports: ['websocket'], forceNew: true });
    clients.push(c);
    return c;
}
const connected = (c) => (c.connected ? Promise.resolve() : new Promise((r) => c.once('connect', r)));
const emitAck = (c, ev, data) => new Promise((r) => c.emit(ev, data, r));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function collect(c, ev) {
    const list = [];
    c.on(ev, (d) => list.push(d));
    return list;
}

async function roomOf3() {
    const [a, b, c] = [client(), client(), client()];
    await Promise.all([a, b, c].map(connected));
    const keys = [];
    for (const [s, i] of [[a, 1], [b, 2], [c, 3]]) {
        keys.push((await emitAck(s, 'client_info', { deviceId: `appareil-test-${Date.now()}-${i}`, blocked: [] })).key);
    }
    const { roomId } = await emitAck(a, 'create_room', { playerName: 'Amine', gameType: 'kdoub' });
    await emitAck(b, 'join_room', { roomId, playerName: 'Badr' });
    await emitAck(c, 'join_room', { roomId, playerName: 'Chama' });
    return { a, b, c, roomId, keys };
}

test('filtre : insultes FR / darija / arabe refusées, messages normaux et messages rapides acceptés', () => {
    for (const t of ['espèce de connard', 'CONNNNARD', 'ya zamel', 'wld l97ba', 'nique ta mère', 'انت زامل', 'fdp']) {
        assert.equal(moderation.isOffensive(t), true, t);
    }
    for (const t of ['L3eb a zmagri !', 'Zid Jouj !', 'Hezz !', 'Zrebti 3lina...', 'Wry9a wa7da 😉', 'Saaaaaaaafi 😡', 'concours', 'bien joué', 'Kdoub !', 'zebra', 'debout']) {
        assert.equal(moderation.isOffensive(t), false, t);
    }
});

test('chat : message insultant refusé (expéditeur prévenu, personne ne le reçoit) ; message normal reçu avec son auteur', async () => {
    const { a, b, c, roomId, keys } = await roomOf3();
    const gotB = collect(b, 'chat_message');
    const rejected = collect(a, 'chat_rejected');
    a.emit('send_chat', { roomId, message: 'Badr t es un connard' });
    await sleep(200);
    assert.equal(rejected.length, 1);
    assert.match(rejected[0].message, /refusé/);
    assert.equal(gotB.length, 0);
    a.emit('send_chat', { roomId, message: 'Zid Jouj !' });
    await sleep(200);
    assert.equal(gotB.length, 1);
    assert.equal(gotB[0].from, keys[0]);
    assert.equal(gotB[0].playerName, 'Amine');
    [a, b, c].forEach((s) => s.close());
});

test('signalement : enregistré avec le contenu, la raison, l\'auteur ; pas son propre message ; raison obligatoire', async () => {
    const { a, b, c, roomId } = await roomOf3();
    const gotB = collect(b, 'chat_message');
    const gotA = collect(a, 'chat_message');
    a.emit('send_chat', { roomId, message: 'tu triches, je le sais' });
    await sleep(200);
    const msgId = gotB[0].id;
    assert.equal((await emitAck(b, 'report_chat', { messageId: msgId, reason: 'n_importe_quoi' })).success, false);
    assert.equal((await emitAck(a, 'report_chat', { messageId: gotA[0].id, reason: 'spam' })).success, false, 'son propre message');
    assert.equal((await emitAck(b, 'report_chat', { messageId: msgId, reason: 'insulte' })).success, true);
    const reports = await app.store.listReports();
    const r = reports.find((x) => x.messageId === msgId);
    assert.ok(r);
    assert.equal(r.message, 'tu triches, je le sais');
    assert.equal(r.authorName, 'Amine');
    assert.equal(r.reporterName, 'Badr');
    assert.equal(r.reason, 'insulte');
    assert.ok(r.at > 0);
    [a, b, c].forEach((s) => s.close());
});

test('blocage : dans les deux sens, messages et réactions ; les autres reçoivent tout ; déblocage', async () => {
    const { a, b, c, roomId, keys } = await roomOf3();
    // Badr bloque Amine
    assert.equal((await emitAck(b, 'set_blocked', { blocked: [{ key: keys[0], name: 'Amine', at: Date.now() }] })).success, true);
    const gotA = collect(a, 'chat_message');
    const gotB = collect(b, 'chat_message');
    const gotC = collect(c, 'chat_message');
    const reactB = collect(b, 'player_reaction_broadcast');
    a.emit('send_chat', { roomId, message: 'salut Badr' });
    b.emit('send_chat', { roomId, message: 'salut Chama' });
    a.emit('player_reaction', { roomId, reactionType: '😂' });
    await sleep(250);
    assert.deepEqual(gotB.map((m) => m.message), ['salut Chama'], 'Badr ne voit plus Amine');
    assert.deepEqual(gotA.map((m) => m.message), ['salut Badr'], 'Amine ne voit plus Badr');
    assert.deepEqual(gotC.map((m) => m.message).sort(), ['salut Badr', 'salut Chama']);
    assert.equal(reactB.length, 0, 'ni ses réactions');
    // Déblocage
    await emitAck(b, 'set_blocked', { blocked: [] });
    a.emit('send_chat', { roomId, message: 'on se reparle ?' });
    await sleep(200);
    assert.ok(gotB.some((m) => m.message === 'on se reparle ?'));
    [a, b, c].forEach((s) => s.close());
});

test('blocage lié au compte : retrouvé sur un nouvel appareil', async () => {
    const { token } = await app.progress.register({ name: 'Bloqueur', password: 'secret12' });
    const s1 = client();
    await connected(s1);
    await emitAck(s1, 'auth', { token });
    const target = moderation.playerKey('d:quelqu-un');
    await emitAck(s1, 'set_blocked', { blocked: [{ key: target, name: 'Relou', at: 1 }] });
    s1.close();
    const s2 = client();
    await connected(s2);
    await emitAck(s2, 'auth', { token });
    const r = await emitAck(s2, 'client_info', { deviceId: 'autre-appareil-123', blocked: [] });
    assert.deepEqual(r.blocked.map((x) => x.name), ['Relou']);
    s2.close();
});

test('stockage des signalements : purge après 6 mois (mémoire et PostgreSQL)', async () => {
    const now = Date.now();
    const m = memoryStore();
    await m.addReport({ id: 'vieux', at: now - REPORT_TTL_MS - 1000 });
    await m.addReport({ id: 'recent', at: now });
    assert.deepEqual((await m.listReports()).map((r) => r.id), ['recent']);
    assert.equal(await m.deleteReport('recent'), true);
    assert.equal((await m.listReports()).length, 0);

    const { newDb } = require('pg-mem');
    const db = newDb({ noAstCoverageCheck: true });
    const { Pool } = db.adapters.createPg();
    const pg = pgStore('postgres://test', Pool);
    await pg.addReport({ id: 'vieux', at: now - REPORT_TTL_MS - 1000, message: 'x' });
    await pg.addReport({ id: 'recent', at: now, message: 'y' });
    assert.deepEqual((await pg.listReports()).map((r) => r.id), ['recent']);
    assert.equal(await pg.deleteReport('recent'), true);
});

test('deux onglets du même navigateur (même appareil) : deux joueurs distincts, signalement et blocage possibles', async () => {
    const [a, b] = [client(), client()];
    await Promise.all([a, b].map(connected));
    const ka = (await emitAck(a, 'client_info', { deviceId: 'meme-appareil-0001', blocked: [] })).key;
    const kb = (await emitAck(b, 'client_info', { deviceId: 'meme-appareil-0001', blocked: [] })).key;
    assert.notEqual(ka, kb, 'clés différentes');
    const { roomId } = await emitAck(a, 'create_room', { playerName: 'Onglet1', gameType: 'hezz2' });
    await emitAck(b, 'join_room', { roomId, playerName: 'Onglet2' });
    const gotA = collect(a, 'chat_message');
    b.emit('send_chat', { roomId, message: 'depuis l onglet 2' });
    await sleep(200);
    assert.equal(gotA.length, 1);
    assert.equal(gotA[0].sid, b.id, 'expéditeur reconnaissable');
    assert.equal((await emitAck(a, 'report_chat', { messageId: gotA[0].id, reason: 'spam' })).success, true);
    // On ne peut pas se bloquer soi-même : sa propre clé est retirée de la liste
    const r = await emitAck(a, 'set_blocked', { blocked: [{ key: ka, name: 'moi', at: 1 }, { key: kb, name: 'Onglet2', at: 1 }] });
    assert.deepEqual(r.blocked.map((x) => x.key), [kb]);
    b.emit('send_chat', { roomId, message: 'bloqué ?' });
    await sleep(200);
    assert.equal(gotA.length, 1, 'plus rien de l onglet 2');
    [a, b].forEach((s) => s.close());
});
