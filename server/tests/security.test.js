// Sécurité : origines autorisées, en-têtes HTTP, limite de messages par connexion
process.env.STORE = 'memory';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { io } = require('socket.io-client');
const app = require('../server');
const { isAllowedOrigin } = require('../security');

let PORT;
const clients = [];
test.before(async () => { PORT = await app.start(0); });
test.after(async () => { clients.forEach((c) => c.close()); await app.stop(); });

const get = (path, headers = {}) => new Promise((resolve, reject) => {
    http.get({ host: 'localhost', port: PORT, path, headers }, (res) => { res.resume(); resolve(res); }).on('error', reject);
});

test('origines : le site, Vercel, localhost et l\'appli installée passent ; un autre site non', () => {
    assert.ok(isAllowedOrigin('https://jebengere3.fun'));
    assert.ok(isAllowedOrigin('https://www.jebengere3.fun'));
    assert.ok(isAllowedOrigin('https://hezz2-game-abc123.vercel.app'));
    assert.ok(isAllowedOrigin('http://localhost:8081'));
    assert.ok(isAllowedOrigin(undefined), 'pas d\'origine : appli native, outils');
    assert.ok(!isAllowedOrigin('https://pirate.example.com'));
    assert.ok(!isAllowedOrigin('https://jebengere3.fun.pirate.com'));
});

test('en-têtes de sécurité et CORS limité', async () => {
    const ok = await get('/version', { Origin: 'https://jebengere3.fun' });
    assert.equal(ok.headers['x-content-type-options'], 'nosniff');
    assert.equal(ok.headers['x-powered-by'], undefined);
    assert.equal(ok.headers['access-control-allow-origin'], 'https://jebengere3.fun');
    const bad = await get('/version', { Origin: 'https://pirate.example.com' });
    assert.equal(bad.headers['access-control-allow-origin'], undefined);
});

test('connexion WebSocket refusée depuis un site non autorisé', async () => {
    const c = io(`http://localhost:${PORT}`, { transports: ['websocket'], forceNew: true, reconnection: false, extraHeaders: { Origin: 'https://pirate.example.com' } });
    clients.push(c);
    const res = await new Promise((r) => { c.once('connect', () => r('connect')); c.once('connect_error', () => r('refused')); });
    assert.equal(res, 'refused');
});

test('trop de messages : ignorés puis connexion coupée', async () => {
    const c = io(`http://localhost:${PORT}`, { transports: ['websocket'], forceNew: true, reconnection: false });
    clients.push(c);
    await new Promise((r) => c.once('connect', r));
    const dropped = new Promise((r) => c.once('disconnect', r));
    for (let i = 0; i < 200; i++) c.emit('leave_room', { roomId: 'XXXX' });
    await dropped;
    assert.equal(c.connected, false);
});
