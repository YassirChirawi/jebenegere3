// Pseudos : bots écrits comme des joueurs (sans « Bot »), uniques à la table ;
// le pseudo d'un compte est réservé à ce compte (un invité ne peut pas le prendre)
process.env.STORE = 'memory';

const test = require('node:test');
const assert = require('node:assert/strict');
const { io } = require('socket.io-client');
const app = require('../server');
const { botName } = require('../botNames');

let URL, PORT;
const clients = [];
test.before(async () => { PORT = await app.start(0); URL = `http://localhost:${PORT}`; });
test.after(async () => { clients.forEach((c) => c.close()); await app.stop(); });

function client() {
    const c = io(URL, { transports: ['websocket'], forceNew: true });
    clients.push(c);
    return c;
}
const connected = (c) => (c.connected ? Promise.resolve() : new Promise((r) => c.once('connect', r)));
const emitAck = (c, ev, data) => new Promise((r) => c.emit(ev, data, r));
const NAME_RE = /^[\p{L}\p{N} _.'-]{3,16}$/u;

test('pseudos de bots : format de pseudo valide, jamais « Bot », jamais deux fois le même', () => {
    for (let i = 0; i < 2000; i++) {
        const n = botName();
        assert.ok(NAME_RE.test(n), n);
        assert.ok(!/^bot\b/i.test(n), n);
    }
    // Portrait assorti au prénom
    const { botAvatar, WOMEN_AVATARS, MEN_AVATARS } = require('../botNames');
    for (let i = 0; i < 50; i++) {
        assert.ok(WOMEN_AVATARS.includes(botAvatar('Salma_212')));
        assert.ok(WOMEN_AVATARS.includes(botAvatar('OumaimaB')));
        assert.ok(MEN_AVATARS.includes(botAvatar('Hamza27')));
    }
    const used = [];
    for (let i = 0; i < 6; i++) used.push(botName(used));
    assert.equal(new Set(used.map((n) => n.toLowerCase())).size, 6);
});

test('partie contre l\'ordinateur : bots avec un pseudo et un portrait de joueur', async () => {
    const c = client();
    await connected(c);
    const r = await emitAck(c, 'create_bot_room', { playerName: 'Yassir', botCount: 4, gameType: 'hezz2' });
    const players = app.rooms[r.roomId].activePlayers;
    assert.equal(players.length, 4);
    players.slice(1).forEach((p) => {
        assert.ok(p.isBot && !/bot/i.test(p.name), p.name);
        assert.ok(p.avatar >= 1 && p.avatar <= 12);
    });
    assert.equal(new Set(players.map((p) => p.name.toLowerCase())).size, 4);
});

test('pseudo d\'un compte : refusé pour un invité, accepté pour le compte connecté', async () => {
    const reg = await (await fetch(`${URL}/api/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Moulchi', password: 'secret12' }) })).json();
    assert.ok(reg.token);
    const guest = client();
    await connected(guest);
    for (const [ev, data] of [
        ['create_room', { playerName: 'moulchi', gameType: 'hezz2' }],
        ['create_bot_room', { playerName: 'Moulchi', botCount: 2, gameType: 'hezz2' }],
        ['find_match', { playerName: 'MOULCHI', targetSize: 2, gameType: 'hezz2' }],
    ]) {
        const r = await emitAck(guest, ev, data);
        assert.equal(r.success, false, ev);
        assert.match(r.message, /appartient à un compte/);
    }
    // Un autre pseudo marche
    assert.equal((await emitAck(guest, 'create_room', { playerName: 'Visiteur', gameType: 'hezz2' })).success, true);
    // Rejoindre sous le pseudo d'un compte : refusé aussi
    const host = client();
    await connected(host);
    const { roomId } = await emitAck(host, 'create_room', { playerName: 'Hote', gameType: 'hezz2' });
    const g2 = client();
    await connected(g2);
    assert.equal((await emitAck(g2, 'join_room', { roomId, playerName: 'Moulchi' })).success, false);
    // Le propriétaire connecté joue sous son pseudo
    const owner = client();
    await connected(owner);
    await emitAck(owner, 'auth', { token: reg.token });
    const r = await emitAck(owner, 'create_bot_room', { playerName: 'peu importe', botCount: 2, gameType: 'hezz2' });
    assert.equal(r.success, true);
    assert.equal(app.rooms[r.roomId].activePlayers[0].name, 'Moulchi');
});
