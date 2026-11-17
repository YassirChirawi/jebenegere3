// Portrait choisi sans compte : envoyé avec « auth », visible des autres joueurs du salon
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

test('invité : le portrait choisi suit le joueur dans le salon ; valeur invalide = 0', async () => {
    const [h, a] = [client(), client()];
    await Promise.all([h, a].map(connected));
    await emitAck(h, 'auth', { token: null, avatar: 7 });
    await emitAck(a, 'auth', { token: null, avatar: 99 });
    const { roomId } = await emitAck(h, 'create_room', { playerName: 'Hote', gameType: 'hezz2' });
    await emitAck(a, 'join_room', { roomId, playerName: 'Amine' });
    const room = app.rooms[roomId];
    assert.deepEqual(room.activePlayers.map((p) => [p.name, p.avatar]), [['Hote', 7], ['Amine', 0]]);
    // 12 = dernier portrait (1 à 12 : portrait choisi ; 0 : tiré du pseudo)
    await emitAck(a, 'auth', { token: null, avatar: 12 });
    const { roomId: r2 } = await emitAck(a, 'create_room', { playerName: 'Amine', gameType: 'hezz2' });
    assert.equal(app.rooms[r2].activePlayers[0].avatar, 12);
});
