// Lot 1 : rejoindre par lien (code normalisé), spectateurs, annonce du départ d'un joueur
process.env.STORE = 'memory';
process.env.START_COUNTDOWN_MS = '0';

const test = require('node:test');
const assert = require('node:assert/strict');
const { io } = require('socket.io-client');
const app = require('../server');

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
const collect = (c, ev) => { const l = []; c.on(ev, (d) => l.push(d)); return l; };
const once = (c, ev, ms = 5000) => new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout "${ev}"`)), ms);
    c.once(ev, (d) => { clearTimeout(t); resolve(d); });
});

test('code collé (minuscules, espaces) accepté ; même lien ouvert deux fois : pas de doublon', async () => {
    const [h, a] = [client(), client()];
    await Promise.all([h, a].map(connected));
    const { roomId } = await emitAck(h, 'create_room', { playerName: 'Hote', gameType: 'hezz2' });
    const r = await emitAck(a, 'join_room', { roomId: `  ${roomId.toLowerCase()} `, playerName: 'Amine' });
    assert.equal(r.success, true);
    assert.equal(r.roomId, roomId);
    assert.equal(r.spectator, false);
    const again = await emitAck(a, 'join_room', { roomId, playerName: 'Amine' });
    assert.equal(again.success, true);
    assert.equal(app.rooms[roomId].activePlayers.length, 2, 'pas de doublon');
    [h, a].forEach((s) => s.close());
});

test('partie en cours : le nouveau venu devient spectateur et reçoit la partie ; 6 spectateurs maximum', async () => {
    const [h, a] = [client(), client()];
    await Promise.all([h, a].map(connected));
    const { roomId } = await emitAck(h, 'create_room', { playerName: 'Hote', gameType: 'hezz2' });
    await emitAck(a, 'join_room', { roomId, playerName: 'Amine' });
    const started = once(h, 'game_started');
    h.emit('start_game', { roomId });
    await started;
    const specs = [];
    for (let i = 0; i < 6; i++) {
        const s = client(); await connected(s);
        const r = await emitAck(s, 'join_room', { roomId, playerName: `Spec${i}` });
        assert.equal(r.success, true);
        assert.equal(r.spectator, true);
        assert.ok(r.gameState && Array.isArray(r.gameState.players), 'partie en cours reçue');
        specs.push(s);
    }
    const seventh = client(); await connected(seventh);
    assert.equal((await emitAck(seventh, 'join_room', { roomId, playerName: 'Spec7' })).success, false);
    assert.equal(app.rooms[roomId].spectators.length, 6);
    [h, a, seventh, ...specs].forEach((s) => s.close());
});

test('spectateur : pas de chat écrit (refusé, personne ne le reçoit), réactions emoji transmises avec son nom', async () => {
    const [h, a, sp] = [client(), client(), client()];
    await Promise.all([h, a, sp].map(connected));
    const { roomId } = await emitAck(h, 'create_room', { playerName: 'Hote', gameType: 'hezz2' });
    await emitAck(a, 'join_room', { roomId, playerName: 'Amine' });
    const started = once(h, 'game_started');
    h.emit('start_game', { roomId });
    await started;
    await emitAck(sp, 'join_room', { roomId, playerName: 'Curieux' });
    const chatH = collect(h, 'chat_message');
    const rejected = collect(sp, 'chat_rejected');
    const reactH = collect(h, 'player_reaction_broadcast');
    sp.emit('send_chat', { roomId, message: 'je regarde' });
    sp.emit('player_reaction', { roomId, reactionType: '👏' });
    await sleep(250);
    assert.equal(chatH.length, 0);
    assert.equal(rejected.length, 1);
    assert.match(rejected[0].message, /spectateurs/);
    assert.deepEqual(reactH[0], { playerIndex: -1, spectatorName: 'Curieux', reactionType: '👏' });
    [h, a, sp].forEach((s) => s.close());
});

test('départ en pleine partie : annonce visible, remplacé par un bot à 3 ; victoire par forfait à 2', async () => {
    const [h, a, b] = [client(), client(), client()];
    await Promise.all([h, a, b].map(connected));
    const { roomId } = await emitAck(h, 'create_room', { playerName: 'Hote', gameType: 'hezz2' });
    await emitAck(a, 'join_room', { roomId, playerName: 'Amine' });
    await emitAck(b, 'join_room', { roomId, playerName: 'Badr' });
    let started = once(h, 'game_started');
    h.emit('start_game', { roomId });
    await started;
    let left = once(h, 'player_left');
    b.emit('leave_room', { roomId });
    let d = await left;
    assert.equal(d.name, 'Badr');
    assert.equal(d.replacedByBot, true);
    assert.equal(app.rooms[roomId].activePlayers[2].isBot, true);

    const { roomId: r2 } = await emitAck(h, 'create_room', { playerName: 'Hote', gameType: 'hezz2' });
    await emitAck(a, 'join_room', { roomId: r2, playerName: 'Amine' });
    started = once(h, 'game_started');
    h.emit('start_game', { roomId: r2 });
    await started;
    left = once(h, 'player_left');
    a.emit('leave_room', { roomId: r2 });
    d = await left;
    assert.equal(d.forfeit, true);
    [h, a, b].forEach((s) => s.close());
});
