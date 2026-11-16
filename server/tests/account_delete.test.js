// Suppression de compte (exigée par Apple) : tout est effacé, aucune copie gardée
process.env.STORE = 'memory';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { io } = require('socket.io-client');
const app = require('../server');
const { fileStore, pgStore } = require('../progress/store');
const { createProgress } = require('../progress/progress');

let URL;
test.before(async () => { URL = `http://localhost:${await app.start(0)}`; });
test.after(async () => { await app.stop(); });

const api = (p, { method = 'GET', token, body, headers = {} } = {}) => fetch(URL + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
});

test('DELETE /api/me : compte, progression, joueurs bloqués effacés ; jeton invalide ; pseudo libéré', async () => {
    const reg = await (await api('/api/register', { method: 'POST', body: { name: 'AEffacer', password: 'secret12' } })).json();
    const { token, profile } = reg;
    await app.progress.award(profile.id, { game: 'ronda', xp: 120, record: true, won: true, result: 'Victoire', counters: { missa: 1 } });
    await app.progress.setBlocked(profile.id, [{ key: 'k0123456789abcdef', name: 'X', at: 1 }]);

    // Un joueur connecté au jeu avec ce compte
    const s = io(URL, { transports: ['websocket'], forceNew: true });
    await new Promise((r) => s.once('connect', r));
    await new Promise((r) => s.emit('auth', { token }, r));

    assert.equal((await api('/api/me', { method: 'DELETE' })).status, 401, 'sans jeton');
    const del = await api('/api/me', { method: 'DELETE', token });
    assert.equal(del.status, 200);
    assert.deepEqual(await del.json(), { success: true });

    assert.equal(await app.store.get(profile.id), null);
    assert.equal(await app.store.getByName('AEffacer'), null);
    assert.equal((await app.store.all()).some((u) => u.id === profile.id), false);
    assert.equal((await api('/api/me', { token })).status, 401, 'jeton invalide');
    assert.equal((await api('/api/login', { method: 'POST', body: { name: 'AEffacer', password: 'secret12' } })).status, 401);
    const lb = await (await api('/api/leaderboard?game=all')).json();
    assert.equal(JSON.stringify(lb).includes('AEffacer'), false);
    // Les récompenses de fin de partie ne recréent pas le compte
    await app.progress.award(profile.id, { game: 'ronda', xp: 50, record: true, won: true, result: 'Victoire', counters: {} });
    assert.equal(await app.store.get(profile.id), null);
    // Le pseudo est de nouveau disponible
    assert.equal((await api('/api/register', { method: 'POST', body: { name: 'AEffacer', password: 'autre123' } })).status, 200);
    s.close();
});

test('CORS : DELETE autorisé pour le site', async () => {
    const r = await api('/api/me', { method: 'OPTIONS', headers: { Origin: 'https://www.jebengere3.fun', 'Access-Control-Request-Method': 'DELETE' } });
    assert.match(r.headers.get('access-control-allow-methods') || '', /DELETE/);
});

test('fichier local : le compte disparaît du fichier', async () => {
    const file = path.join(os.tmpdir(), `jg3-del-${Date.now()}.json`);
    const store = fileStore(file);
    const p = createProgress(store);
    const a = await p.register({ name: 'Garde', password: 'secret12' });
    const b = await p.register({ name: 'Supprime', password: 'secret12' });
    await p.deleteAccount(b.profile.id);
    const onDisk = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.deepEqual(onDisk.map((u) => u.name), ['Garde']);
    assert.equal(JSON.stringify(onDisk).includes('Supprime'), false);
    assert.ok(a.profile.id);
    fs.rmSync(file, { force: true });
});

test('PostgreSQL : ligne supprimée de la table players', async () => {
    const { newDb } = require('pg-mem');
    const db = newDb({ noAstCoverageCheck: true });
    const { Pool } = db.adapters.createPg();
    const store = pgStore('postgres://test', Pool);
    const p = createProgress(store);
    const r = await p.register({ name: 'PgSupprime', password: 'secret12' });
    assert.equal(await p.deleteAccount(r.profile.id), true);
    assert.equal(await store.get(r.profile.id), null);
    assert.equal((await store.all()).length, 0);
});
