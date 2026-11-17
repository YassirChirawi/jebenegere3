// Joueurs en ligne : nombre de connectés, parties en cours, recherches par jeu et taille
process.env.STORE = 'memory';
process.env.ONLINE_STATS_MS = '200';

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
    c.stats = null;
    c.on('online_stats', (s) => { c.stats = s; });
    return c;
}
const connected = (c) => (c.connected ? Promise.resolve() : new Promise((r) => c.once('connect', r)));
const emitAck = (c, ev, data) => new Promise((r) => c.emit(ev, data, r));
const until = async (fn, ms = 4000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { if (fn()) return true; await new Promise((r) => setTimeout(r, 50)); }
    return false;
};

test('connectés, partie contre des bots en cours, recherche en ligne', async () => {
    const [a, b, c] = [client(), client(), client()];
    await Promise.all([a, b, c].map(connected));
    assert.ok(await until(() => a.stats && a.stats.online === 3), `3 connectés (${JSON.stringify(a.stats)})`);

    // b joue contre l'ordinateur : 1 partie en cours, 1 joueur en partie (les bots ne comptent pas)
    await emitAck(b, 'create_bot_room', { playerName: 'Badr', botCount: 2, gameType: 'hezz2' });
    assert.ok(await until(() => a.stats.games === 1 && a.stats.playing === 1), `partie en cours (${JSON.stringify(a.stats)})`);

    // c cherche une Ronda en 1 contre 1
    await emitAck(c, 'find_match', { playerName: 'Chama', targetSize: 2, gameType: 'ronda' });
    assert.ok(await until(() => a.stats.searching['ronda:2'] === 1), `recherche (${JSON.stringify(a.stats)})`);
    c.emit('cancel_match', {});
    assert.ok(await until(() => !a.stats.searching['ronda:2']), 'recherche annulée');

    // Départ d'un joueur : le nombre de connectés baisse
    c.close();
    assert.ok(await until(() => a.stats.online === 2), `2 connectés (${JSON.stringify(a.stats)})`);
});
