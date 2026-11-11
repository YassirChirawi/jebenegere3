// Salon privé : compléter avec des bots et choisir les équipes (places échangées par l'hôte)
process.env.STORE = 'memory';

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
const once = (c, ev, ms = 6000) => new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout "${ev}"`)), ms);
    c.once(ev, (d) => { clearTimeout(t); resolve(d); });
});

test('Ronda à 3 humains + 1 bot, équipes choisies, la partie démarre et le bot joue', async () => {
    const [h, a, b] = [client(), client(), client()];
    await Promise.all([h, a, b].map(connected));
    const { roomId } = await emitAck(h, 'create_room', { playerName: 'Hote', gameType: 'ronda' });
    await emitAck(a, 'join_room', { roomId, playerName: 'Amine' });
    await emitAck(b, 'join_room', { roomId, playerName: 'Badr' });

    // Un invité ne peut pas ajouter de bot
    assert.equal((await emitAck(a, 'add_bot', { roomId })).success, false);
    assert.equal((await emitAck(h, 'add_bot', { roomId })).success, true);
    assert.equal((await emitAck(h, 'add_bot', { roomId })).success, false, 'salon complet à 4');

    let room = app.rooms[roomId];
    assert.deepEqual(room.activePlayers.map((p) => !!p.isBot), [false, false, false, true]);

    // Hôte + Amine ensemble (places 0 et 2) : on échange Amine (1) et Badr (2)
    assert.equal((await emitAck(h, 'swap_seats', { roomId, a: a.id, b: b.id })).success, true);
    assert.deepEqual(room.activePlayers.map((p) => p.name).slice(0, 3), ['Hote', 'Badr', 'Amine']);

    const started = once(h, 'game_started');
    h.emit('start_game', { roomId });
    const st = await started;
    assert.equal(st.numPlayers, 4);
    assert.equal(app.rooms[roomId].isBotMatch, true);
    assert.equal((await emitAck(h, 'add_bot', { roomId })).success, false, 'pas de bot en pleine partie');

    // Le bot (place 3) finit par jouer : on fait jouer les humains au hasard jusqu'à son tour
    const t0 = Date.now();
    let botPlayed = false;
    while (Date.now() - t0 < 20000 && !botPlayed) {
        const s = app.rooms[roomId].gameState;
        if (s.turn === 3) {
            const before = s.hands[3].length;
            await new Promise((r) => setTimeout(r, 3500));
            botPlayed = app.rooms[roomId].gameState.hands[3].length < before || app.rooms[roomId].gameState.dealIndex > s.dealIndex;
        } else {
            const c = [h, b, a][s.turn];
            c.emit('game_action', { roomId, action: { type: 'play', cardIndex: 0 } });
            await new Promise((r) => setTimeout(r, 150));
        }
    }
    assert.ok(botPlayed, 'le bot a joué');
});

test("un bot peut être retiré, et un humain qui rejoint un salon complet prend la place d'un bot", async () => {
    const [h, x] = [client(), client()];
    await Promise.all([h, x].map(connected));
    const { roomId } = await emitAck(h, 'create_room', { playerName: 'Hote2', gameType: 'ronda' });
    await emitAck(h, 'add_bot', { roomId });
    await emitAck(h, 'add_bot', { roomId });
    await emitAck(h, 'add_bot', { roomId });
    const room = app.rooms[roomId];
    assert.equal(room.activePlayers.length, 4);
    const bot = room.activePlayers[3];
    assert.equal((await emitAck(h, 'remove_bot', { roomId, playerId: bot.id })).success, true);
    assert.equal(room.activePlayers.length, 3);
    await emitAck(h, 'add_bot', { roomId });
    const r = await emitAck(x, 'join_room', { roomId, playerName: 'Xavier' });
    assert.equal(r.success, true);
    assert.equal(room.activePlayers.length, 4);
    assert.equal(room.activePlayers.filter((p) => !p.isBot).length, 2);
    assert.equal(room.spectators.length, 0);
});
