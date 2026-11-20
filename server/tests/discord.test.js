// Discord Activities : compte lié à Discord, échange du code, salon commun par instance, préfixe /server
process.env.STORE = 'memory';
process.env.START_COUNTDOWN_MS = '0';

const test = require('node:test');
const assert = require('node:assert/strict');
const { io } = require('socket.io-client');
const app = require('../server');
const discord = require('../discord');
const { isAllowedOrigin } = require('../security');
const { createProgress } = require('../progress/progress');
const { memoryStore } = require('../progress/store');

let PORT, URL;
const clients = [];
test.before(async () => { PORT = await app.start(0); URL = `http://localhost:${PORT}`; });
test.after(async () => { clients.forEach((c) => c.close()); discord.setFetch(null); delete process.env.DISCORD_CLIENT_SECRET; await app.stop(); });

function client(opts = {}) {
    const c = io(URL, { transports: ['websocket'], forceNew: true, ...opts });
    clients.push(c);
    return c;
}
const connected = (c) => (c.connected ? Promise.resolve() : new Promise((r, j) => { c.once('connect', r); c.once('connect_error', j); }));
const emitAck = (c, ev, data) => new Promise((r) => c.emit(ev, data, r));
const post = (path, body) => fetch(URL + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    .then(async (r) => ({ status: r.status, ...(await r.json()) }));

test('compte Discord : créé au premier passage avec le pseudo Discord nettoyé, retrouvé ensuite, sans mot de passe', async () => {
    const p = createProgress(memoryStore());
    const a = await p.discordLogin({ id: '123456789012', username: 'nadia_99', global_name: '✨ Nadia ✨' });
    assert.equal(a.profile.name, 'Nadia');
    assert.ok(a.created && a.token.startsWith('discord-123456789012.'));
    const again = await p.discordLogin({ id: '123456789012', username: 'autre' });
    assert.ok(!again.created);
    assert.equal(again.profile.name, 'Nadia', 'même compte, même pseudo');
    assert.ok(await p.userFromToken(again.token));
    // Pas de connexion par pseudo + mot de passe sur un compte Discord
    assert.ok((await p.login({ name: 'Nadia', password: '' })).error);
    // Pseudo déjà pris : rendu unique ; pseudo illisible : « Joueur » ; « bot » réservé
    const b = await p.discordLogin({ id: '222222222222', username: 'nadia', global_name: 'Nadia' });
    assert.match(b.profile.name, /^Nadia \d{4}$/);
    assert.equal((await p.discordLogin({ id: '333333333333', username: '★★', global_name: null })).profile.name, 'Joueur');
    assert.ok(!/^bot\b/i.test((await p.discordLogin({ id: '444444444444', username: 'Bot Hassan' })).profile.name));
    assert.ok((await p.discordLogin({ id: 'abc' })).error);
});

test('origine de l\'Activity Discord autorisée (et pas un autre sous-domaine de discordsays)', () => {
    assert.ok(isAllowedOrigin('https://1572975413687226451.discordsays.com'));
    assert.ok(!isAllowedOrigin('https://999.discordsays.com'));
});

test('échange du code : refusé tant que le Client Secret n\'est pas configuré, puis compte + jeton Discord', async () => {
    delete process.env.DISCORD_CLIENT_SECRET;
    const off = await post('/api/discord/token', { code: 'abcdef123' });
    assert.equal(off.status, 503);

    process.env.DISCORD_CLIENT_SECRET = 'test-secret';
    const calls = [];
    discord.setFetch(async (url, opts) => {
        calls.push({ url, opts });
        if (url.endsWith('/oauth2/token')) {
            const ok = new URLSearchParams(opts.body).get('code') === 'goodcode1';
            return { ok, json: async () => (ok ? { access_token: 'dc-token' } : { error: 'invalid_grant' }) };
        }
        return { ok: true, json: async () => ({ id: '555555555555', username: 'karim', global_name: 'Karim' }) };
    });
    const bad = await post('/api/discord/token', { code: 'badcode1' });
    assert.equal(bad.status, 401);
    assert.equal((await post('/api/discord/token', { code: '../x' })).status, 400);

    const r = await post('/api/discord/token', { code: 'goodcode1' });
    assert.equal(r.status, 200);
    assert.equal(r.access_token, 'dc-token');
    assert.equal(r.profile.name, 'Karim');
    const body = new URLSearchParams(calls.find((c) => c.url.endsWith('/oauth2/token')).opts.body);
    assert.equal(body.get('client_id'), '1572975413687226451');
    assert.equal(body.get('client_secret'), 'test-secret');
    assert.equal(body.get('grant_type'), 'authorization_code');
    const me = await fetch(`${URL}/api/me`, { headers: { Authorization: `Bearer ${r.token}` } }).then((x) => x.json());
    assert.equal(me.profile.name, 'Karim');
});

test('salon Discord : le premier crée (hôte), les suivants rejoignent le même salon, même en arrivant ensemble', async () => {
    const [a, b, c] = [client(), client(), client()];
    await Promise.all([a, b, c].map(connected));
    const inst = 'i-1234567890-gc-1-2';
    const [ra, rb] = await Promise.all([
        emitAck(a, 'discord_room', { instanceId: inst, playerName: 'Amine', gameType: 'ronda' }),
        emitAck(b, 'discord_room', { instanceId: inst, playerName: 'Badr' }),
    ]);
    assert.ok(ra.success && rb.success);
    assert.equal(ra.roomId, rb.roomId, 'un seul salon');
    assert.ok(ra.isHost && !rb.isHost);
    assert.equal(app.rooms[ra.roomId].gameType, 'ronda');
    assert.equal(app.rooms[ra.roomId].activePlayers.length, 2);
    const other = await emitAck(c, 'discord_room', { instanceId: 'i-autre', playerName: 'Chaima' });
    assert.notEqual(other.roomId, ra.roomId, 'autre partie Discord = autre salon');
    assert.equal((await emitAck(c, 'discord_room', { instanceId: 'bad id !', playerName: 'Chaima' })).success, false);
});

test('préfixe /server de l\'Activity : routes et Socket.io joignables avec ou sans préfixe', async () => {
    const v = await fetch(`${URL}/server/version`).then((r) => r.json());
    assert.ok(v.features.includes('discord'));
    const v2 = await fetch(`${URL}/.proxy/server/version`).then((r) => r.json());
    assert.ok(v2.version);
    const s = client({ path: '/server/socket.io' });
    await connected(s);
    assert.ok(s.connected);
    const p = client({ path: '/server/socket.io', transports: ['polling'] });
    await connected(p);
    assert.ok(p.connected);
});

test('relier Discord à un compte L\'Carta : progression ajoutée, puis Discord ouvre le compte L\'Carta', async () => {
    const p = createProgress(memoryStore());
    const site = await p.register({ name: 'Samira', password: 'motdepasse' });
    const siteUser = await p.userFromToken(site.token);
    siteUser.xp = 300; siteUser.binga.balance = 120; siteUser.stats.ronda = { played: 4, wins: 2, losses: 2, streak: 0, best: 2 };
    siteUser.unlocks = ['back:zellige'];
    await p.store.save(siteUser);

    const d = await p.discordLogin({ id: '777777777777', username: 'sam', global_name: 'Sam' });
    const dUser = await p.userFromToken(d.token);
    assert.equal(d.profile.discord, 'only');
    dUser.xp = 50; dUser.binga.balance = 40; dUser.stats.ronda = { played: 3, wins: 3, losses: 0, streak: 3, best: 3 };
    dUser.unlocks = ['emote:rire'];
    await p.store.save(dUser);

    assert.match((await p.linkDiscord(dUser, { name: 'Samira', password: 'faux' })).error, /incorrect/);
    const r = await p.linkDiscord(dUser, { name: 'samira', password: 'motdepasse' });
    assert.ok(r.token && !r.error, r.error);
    assert.equal(r.profile.name, 'Samira');
    assert.equal(r.profile.discord, 'linked');
    assert.equal(r.profile.xp, 350);
    assert.equal(r.profile.binga.balance, 160);
    assert.equal(r.profile.stats.ronda.played, 7);
    assert.equal(r.profile.stats.ronda.best, 3);
    assert.deepEqual([...r.profile.unlocks].sort(), ['back:zellige', 'emote:rire']);
    assert.equal(await p.userFromToken(d.token), null, 'l\'ancienne session Discord ne sert plus');

    // Plus tard, depuis Discord : on arrive directement sur le compte L'Carta
    const again = await p.discordLogin({ id: '777777777777', username: 'sam' });
    assert.equal(again.profile.name, 'Samira');
    assert.ok(!again.created);
    // Le renvoi n'apparaît nulle part comme joueur
    assert.equal(await p.store.getByName('Sam'), null);

    // Un autre compte Discord ne peut pas prendre ce compte L'Carta ; un compte du site ne peut pas « se relier »
    const other = await p.discordLogin({ id: '888888888888', username: 'autre' });
    assert.match((await p.linkDiscord(await p.userFromToken(other.token), { name: 'Samira', password: 'motdepasse' })).error, /autre compte Discord/);
    assert.match((await p.linkDiscord(await p.userFromToken(again.token), { name: 'Samira', password: 'motdepasse' })).error, /créé dans Discord/);
});

test('compte L\'Carta relié puis supprimé : Discord recrée un compte neuf', async () => {
    const p = createProgress(memoryStore());
    await p.register({ name: 'Hamza', password: 'motdepasse' });
    const d = await p.discordLogin({ id: '999999999999', username: 'hamza' });
    const r = await p.linkDiscord(await p.userFromToken(d.token), { name: 'Hamza', password: 'motdepasse' });
    await p.deleteAccount((await p.userFromToken(r.token)).id);
    const fresh = await p.discordLogin({ id: '999999999999', username: 'hamza' });
    assert.ok(fresh.created);
    assert.equal(fresh.profile.discord, 'only');
});

test('route /api/discord/link : session exigée', async () => {
    const res = await post('/api/discord/link', { name: 'x', password: 'y' });
    assert.equal(res.status, 401);
});
