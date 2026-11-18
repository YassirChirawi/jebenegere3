// Coupures et pannes : micro-coupure réseau (on garde sa place), coupure longue (remplacé après le délai de grâce),
// partie disparue (le joueur est prévenu), erreur d'un moteur (le serveur continue)
process.env.STORE = 'memory';
process.env.START_COUNTDOWN_MS = '0';
process.env.RECONNECT_GRACE_MS = '600';

const test = require('node:test');
const assert = require('node:assert/strict');
const { io } = require('socket.io-client');
const app = require('../server');
const { getEngine } = require('../engines');

let URL;
const clients = [];
test.before(async () => { URL = `http://localhost:${await app.start(0)}`; });
test.after(async () => { clients.forEach((c) => c.close()); await app.stop(); });

function client() {
    // Reconnexion rapide (l'appli met 1 à 5 s ; ici le délai de grâce est raccourci à 0,6 s)
    const c = io(URL, { transports: ['websocket'], forceNew: true, reconnectionDelay: 50, reconnectionDelayMax: 100 });
    clients.push(c);
    return c;
}
const connected = (c) => (c.connected ? Promise.resolve() : new Promise((r) => c.once('connect', r)));
const emitAck = (c, ev, data) => new Promise((r) => c.emit(ev, data, r));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const once = (c, ev, ms = 5000) => new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout "${ev}"`)), ms);
    c.once(ev, (d) => { clearTimeout(t); resolve(d); });
});

test('micro-coupure : même connexion retrouvée, le joueur garde sa place et peut jouer', async () => {
    const c = client();
    await connected(c);
    const { roomId } = await emitAck(c, 'create_bot_room', { playerName: 'Yassir', botCount: 2, gameType: 'ronda' });
    await once(c, 'game_state_update').catch(() => {}); // au moins un message reçu (point de reprise)
    const id = c.id;
    c.io.engine.close(); // coupure brutale du réseau
    await once(c, 'connect', 8000);
    assert.equal(c.recovered, true, 'connexion retrouvée');
    assert.equal(c.id, id);
    await sleep(900); // plus long que le délai de grâce
    const room = app.rooms[roomId];
    assert.equal(room.activePlayers[0].id, id, 'toujours à sa place');
    assert.ok(!room.activePlayers[0].isBot);
    assert.equal((await emitAck(c, 'room_check', { roomId })).ok, true);
});

test('coupure longue : place gardée pendant le délai de grâce, puis remplacé (forfait à 2)', async () => {
    const [a, b] = [client(), client()];
    await Promise.all([a, b].map(connected));
    const { roomId } = await emitAck(a, 'create_room', { playerName: 'Amine', gameType: 'ronda' });
    await emitAck(b, 'join_room', { roomId, playerName: 'Badr' });
    a.emit('start_game', { roomId });
    await once(b, 'game_started');
    // b disparaît sans prévenir (la connexion ne revient pas)
    b.io.reconnection(false);
    b.io.engine.close();
    await sleep(200);
    assert.ok(!app.rooms[roomId].gameState.mancheTerminee, 'pas de forfait tout de suite');
    assert.equal(app.rooms[roomId].activePlayers[1].name, 'Badr');
    await sleep(800);
    assert.ok(app.rooms[roomId].gameState.forfeit, 'forfait après le délai de grâce');
});

test('départ volontaire : immédiat, sans délai de grâce', async () => {
    const [a, b] = [client(), client()];
    await Promise.all([a, b].map(connected));
    const { roomId } = await emitAck(a, 'create_room', { playerName: 'Amine', gameType: 'ronda' });
    await emitAck(b, 'join_room', { roomId, playerName: 'Badr' });
    a.emit('start_game', { roomId });
    await once(b, 'game_started');
    b.disconnect();
    await sleep(150);
    assert.ok(app.rooms[roomId].gameState.forfeit);
});

test('partie disparue (serveur redémarré) : le joueur est prévenu au lieu de rester figé', async () => {
    const c = client();
    await connected(c);
    const gone = once(c, 'room_gone');
    c.emit('game_action', { roomId: 'ZZZZZ', action: { type: 'play', cardIndex: 0 } });
    assert.deepEqual(await gone, { roomId: 'ZZZZZ' });
    assert.equal((await emitAck(c, 'room_check', { roomId: 'ZZZZZ' })).ok, false);
});

test("erreur d'un moteur : l'action est refusée, le serveur et la partie continuent", async () => {
    const c = client();
    await connected(c);
    const { roomId } = await emitAck(c, 'create_bot_room', { playerName: 'Yassir', botCount: 2, gameType: 'ronda' });
    const engine = getEngine('ronda');
    const apply = engine.apply;
    engine.apply = () => { throw new Error('bug simulé'); };
    const errLog = console.error;
    console.error = () => {};
    try {
        const rejected = once(c, 'action_rejected');
        c.emit('game_action', { roomId, action: { type: 'play', cardIndex: 0 } });
        await rejected;
    } finally {
        engine.apply = apply;
        console.error = errLog;
    }
    assert.ok(app.rooms[roomId], 'la partie existe toujours');
    assert.equal((await emitAck(c, 'room_check', { roomId })).ok, true);
});
