// Lot 2 : catalogue des cosmétiques, achat en binga (vérifié par le serveur), choix gardés avec le compte,
// réactions achetées réservées à leur propriétaire
process.env.STORE = 'memory';
process.env.START_COUNTDOWN_MS = '0';

const test = require('node:test');
const assert = require('node:assert/strict');
const { io } = require('socket.io-client');
const { createProgress } = require('../progress/progress');
const { memoryStore } = require('../progress/store');
const { COSMETICS, RARITIES, priceOf } = require('../progress/defs');
const app = require('../server');

const DAY = Date.UTC(2026, 10, 9, 12);
const kinds = (k) => COSMETICS.filter((c) => c.kind === k);

test('catalogue : 10 dos (avec Classique offert), 6 effets, 12 réactions, raretés et prix', () => {
    // Classique (offert) + les 9 autres dos demandés, + Rose de Kelaa et Saison (déjà existants, repris)
    assert.equal(kinds('back').length, 11);
    ['Cuivre martelé', 'Velours rouge', 'Thé à la menthe', 'Zellige', 'Sahara', 'Océan', 'Néon', 'Or', 'Champion'].forEach((l) => assert.ok(kinds('back').some((c) => c.label === l), l));
    assert.deepEqual(kinds('effect').map((c) => c.label), ['Confettis', 'Étoiles', 'Menthe', 'Feu', 'Tonnerre', 'Or']);
    assert.deepEqual(kinds('emote').map((c) => c.label), ['Rire', 'Bravo', 'Aïe', 'Merci', 'Triste', 'Surpris', 'Bien joué', 'Dors', 'Chat', 'Feu', 'Menthe', 'Couronne']);
    COSMETICS.forEach((c) => assert.ok(RARITIES[c.rarity], c.id));
    assert.equal(priceOf(COSMETICS.find((c) => c.id === 'back:cuivre')), 100);
    assert.equal(priceOf(COSMETICS.find((c) => c.id === 'back:menthe')), 250);
    assert.equal(priceOf(COSMETICS.find((c) => c.id === 'back:neon')), 500);
    assert.equal(priceOf(COSMETICS.find((c) => c.id === 'back:or')), null, 'légendaire : coffre Or seulement');
    assert.equal(priceOf(COSMETICS.find((c) => c.id === 'back:tournoi')), null, 'Champion : tournoi seulement');
    assert.equal(new Set(COSMETICS.map((c) => c.id)).size, COSMETICS.length, 'identifiants uniques');
});

async function richPlayer(balance) {
    const p = createProgress(memoryStore());
    const { profile } = await p.register({ name: 'Acheteur', password: 'secret1' });
    const u = await p.store.get(profile.id);
    u.binga = { balance, log: [] };
    await p.store.save(u);
    return { p, id: profile.id, user: u };
}

test('achat : prix retiré du solde, objet gardé, pas deux fois, solde insuffisant refusé', async () => {
    const { p, user } = await richPlayer(400);
    let r = await p.buy(user, 'back:menthe', DAY);
    assert.ok(r.success);
    assert.equal(r.profile.binga.balance, 150);
    assert.ok(r.profile.unlocks.includes('back:menthe'));
    assert.equal(r.profile.binga.log[0].amount, -250);
    assert.match((await p.buy(user, 'back:menthe', DAY)).error, /déjà/);
    r = await p.buy(user, 'effect:tonnerre', DAY);
    assert.match(r.error, /manque 350 binga/);
    assert.equal((await p.profile(await p.store.get(user.id), DAY)).binga.balance, 150, 'rien retiré');
});

test('achat refusé : légendaire, Champion, objet inconnu', async () => {
    const { p, user } = await richPlayer(5000);
    assert.match((await p.buy(user, 'back:or', DAY)).error, /coffre Or/);
    assert.match((await p.buy(user, 'emote:couronne', DAY)).error, /coffre Or/);
    assert.match((await p.buy(user, 'back:tournoi', DAY)).error, /tournoi/);
    assert.ok((await p.buy(user, 'back:inconnu', DAY)).error);
    assert.equal((await p.store.get(user.id)).binga.balance, 5000);
});

test('choix (dos, effet, tapis) gardés avec le compte ; valeurs invalides ignorées', async () => {
    const { p, user } = await richPlayer(0);
    const prof = await p.updateMe(user, { equipped: { back: 'menthe', effect: 'feu', felts: { ronda: 'safran', poker: 'x' }, extra: 1 } });
    assert.deepEqual(prof.equipped, { back: 'menthe', effect: 'feu', felts: { ronda: 'safran' } });
    const bad = await p.updateMe(user, { equipped: { back: '<script>', effect: 42 } });
    assert.deepEqual(bad.equipped, {});
});

// ------------------------------------------------------------------ de bout en bout
let URL;
const clients = [];
test.before(async () => { URL = `http://localhost:${await app.start(0)}`; });
test.after(async () => { clients.forEach((c) => c.close()); await app.stop(); });
const post = async (path, body, token) => {
    const r = await fetch(URL + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body || {}) });
    return { status: r.status, body: await r.json() };
};
function client() {
    const c = io(URL, { transports: ['websocket'], forceNew: true });
    clients.push(c);
    return c;
}
const connected = (c) => (c.connected ? Promise.resolve() : new Promise((r) => c.once('connect', r)));
const emitAck = (c, ev, data) => new Promise((r) => c.emit(ev, data, r));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function giveBinga(name, amount) {
    const u = await app.progress.store.getByName(name);
    u.binga = { ...(u.binga || {}), balance: amount, log: [] };
    await app.progress.store.save(u);
}

test('en ligne : achat, puis « réinstallation » (nouvelle connexion) : l\'objet et le choix sont retrouvés', async () => {
    const reg = await post('/api/register', { name: 'Fidele', password: 'secret12' });
    await giveBinga('Fidele', 300);
    const r = await post('/api/shop/buy', { id: 'back:sahara' }, reg.body.token);
    assert.equal(r.status, 200);
    assert.equal(r.body.profile.binga.balance, 50);
    await post('/api/me', { equipped: { back: 'sahara' } }, reg.body.token);
    // Appli réinstallée : plus rien sur l'appareil, on se reconnecte avec le pseudo et le mot de passe
    const again = await post('/api/login', { name: 'Fidele', password: 'secret12' });
    assert.ok(again.body.profile.unlocks.includes('back:sahara'));
    assert.equal(again.body.profile.equipped.back, 'sahara');
    assert.equal(again.body.profile.binga.balance, 50);
    assert.equal((await post('/api/shop/buy', { id: 'back:sahara' }, 'faux.jeton')).status, 401);
});

test('en ligne : une réaction achetée est envoyée ; sans l\'avoir achetée, elle est bloquée', async () => {
    const reg = await post('/api/register', { name: 'Rieur', password: 'secret12' });
    await giveBinga('Rieur', 100);
    const a = client();
    const b = client();
    await Promise.all([connected(a), connected(b)]);
    await emitAck(a, 'auth', { token: reg.body.token });
    const { roomId } = await emitAck(a, 'create_room', { playerName: 'x', gameType: 'hezz2' });
    await emitAck(b, 'join_room', { roomId, playerName: 'Invite' });
    const got = [];
    b.on('player_reaction_broadcast', (d) => got.push(d.reactionType));
    a.emit('player_reaction', { roomId, reactionType: 'emote:rire' }); // pas encore achetée
    b.emit('player_reaction', { roomId, reactionType: 'emote:rire' }); // invité : jamais
    await sleep(200);
    assert.deepEqual(got, []);
    assert.equal((await post('/api/shop/buy', { id: 'emote:rire' }, reg.body.token)).status, 200);
    a.emit('player_reaction', { roomId, reactionType: 'emote:rire' });
    a.emit('player_reaction', { roomId, reactionType: '😂' }); // les réactions offertes marchent toujours
    await sleep(200);
    assert.deepEqual(got, ['emote:rire', '😂']);
});
