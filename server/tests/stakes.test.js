// Lot 4 : parties à mise en binga (retirée au début, le gagnant prend le pot, personne n'est forcé)
// et tournoi à entrée en binga (dos exclusif, titre et XP pour le gagnant)
process.env.STORE = 'memory';
process.env.START_COUNTDOWN_MS = '0';

const test = require('node:test');
const assert = require('node:assert/strict');
const { io } = require('socket.io-client');
const app = require('../server');
const { getEngine } = require('../engines');
const { createProgress } = require('../progress/progress');
const { memoryStore } = require('../progress/store');
const { stakeWinners } = require('../stakes');

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
const once = (c, ev, ms = 6000) => new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout ${ev}`)), ms);
    c.once(ev, (d) => { clearTimeout(t); resolve(d); });
});
const user = (name) => app.progress.store.getByName(name);
async function account(name, balance) {
    const { body } = await post('/api/register', { name, password: 'secret12' });
    const u = await user(name);
    u.binga = { balance, log: [] };
    await app.progress.store.save(u);
    const c = client();
    await connected(c);
    await emitAck(c, 'auth', { token: body.token });
    return { c, token: body.token, name };
}
async function guest() {
    const c = client();
    await connected(c);
    return { c };
}
const logHas = async (name, re) => (await user(name)).binga.log.some((l) => re.test(l.reason));

test('mise de 50 : retirée au début de la partie, le gagnant prend le pot (100)', async () => {
    const a = await account('Hote50', 100);
    const b = await account('Invite50', 100);
    const { roomId } = await emitAck(a.c, 'create_room', { playerName: 'x', gameType: 'hezz2' });
    await emitAck(b.c, 'join_room', { roomId, playerName: 'y' });
    assert.equal((await emitAck(a.c, 'set_stake', { roomId, stake: 50 })).success, true);
    assert.equal((await emitAck(b.c, 'set_stake', { roomId, stake: 100 })).success, false, "seul l'hôte choisit la mise");
    assert.equal((await emitAck(b.c, 'stake_opt', { roomId, on: true })).success, true);
    const paidA = once(a.c, 'stake_update');
    const paidB = once(b.c, 'stake_update');
    a.c.emit('start_game', { roomId });
    const [ua, ub] = await Promise.all([paidA, paidB]);
    assert.equal(ua.paid, true);
    assert.equal(ub.paid, true);
    // Retirée AU DÉBUT : avant toute fin de partie
    assert.equal((await user('Hote50')).binga.balance, 50);
    assert.equal((await user('Invite50')).binga.balance, 50);
    const room = app.rooms[roomId];
    const prev = room.gameState;
    const resA = once(a.c, 'stake_result');
    const resB = once(b.c, 'stake_result');
    app._commitState(roomId, prev, getEngine('hezz2').forfeit(prev, 1, 0)); // b perd
    const [ra, rb] = await Promise.all([resA, resB]);
    assert.equal(ra.gain, 100, 'le gagnant prend la mise de chaque joueur');
    assert.equal(rb.gain, 0);
    assert.deepEqual(ra.winners, ['Hote50']);
    await sleep(100);
    assert.ok(await logHas('Hote50', /Pot gagné/));
    // b garde ses autres binga : 50 restants + 10 de la partie perdue
    assert.equal((await user('Invite50')).binga.balance, 60);
    assert.deepEqual(Object.keys((await user('Hote50')).binga.stakes || {}), [], 'plus de mise en attente');
});

test('personne n\'est forcé : sans binga, sans compte ou sans accord, on joue gratuitement', async () => {
    const a = await account('HoteRiche', 500);
    const pauvre = await account('Pauvre', 20);
    const prudent = await account('Prudent', 500);
    const g = await guest();
    const { roomId } = await emitAck(a.c, 'create_room', { playerName: 'x', gameType: 'kdoub' });
    for (const p of [pauvre, prudent, g]) await emitAck(p.c, 'join_room', { roomId, playerName: p.name || 'Invité' });
    await emitAck(a.c, 'set_stake', { roomId, stake: 100 });
    await emitAck(pauvre.c, 'stake_opt', { roomId, on: true }); // veut miser mais n'a que 20
    assert.equal((await emitAck(g.c, 'stake_opt', { roomId, on: true })).success, false, 'invité : pas de mise');
    const ev = {};
    const waits = [a, pauvre, prudent, g].map((p, i) => once(p.c, 'stake_update').then((d) => { ev[i] = d; }));
    const started = once(g.c, 'game_started');
    a.c.emit('start_game', { roomId });
    await started; // la partie démarre pour tout le monde, sans blocage
    await Promise.all(waits);
    assert.equal(ev[0].paid, true);
    assert.equal(ev[1].paid, false);
    assert.match(ev[1].reason, /Pas assez de binga.*gratuitement/);
    assert.equal(ev[2].paid, false, 'n\'a pas choisi de miser');
    assert.equal(ev[3].paid, false);
    assert.equal((await user('Pauvre')).binga.balance, 20, 'rien retiré');
    assert.equal((await user('Prudent')).binga.balance, 500, 'rien retiré');
    assert.equal((await user('HoteRiche')).binga.balance, 400);
    // Le gagnant (Prudent, siège 2) n'a pas misé : l'hôte récupère sa mise
    const room = app.rooms[roomId];
    const prev = room.gameState;
    const res = once(a.c, 'stake_result');
    app._commitState(roomId, prev, getEngine('kdoub').forfeit(prev, 0, 2));
    const r = await res;
    assert.equal(r.refunded, true);
    assert.equal(r.gain, 100);
});

test('parties classiques : gratuites, aucune mise sans choix de l\'hôte', async () => {
    const a = await account('Classique', 300);
    const b = await account('Classique2', 300);
    const { roomId } = await emitAck(a.c, 'create_room', { playerName: 'x', gameType: 'hezz2' });
    await emitAck(b.c, 'join_room', { roomId, playerName: 'y' });
    const started = once(b.c, 'game_started');
    a.c.emit('start_game', { roomId });
    await started;
    await sleep(150);
    assert.equal((await user('Classique')).binga.balance, 300);
    assert.equal((await user('Classique2')).binga.balance, 300);
    assert.equal((await emitAck(a.c, 'set_stake', { roomId, stake: 50 })).success, false, 'pas de changement pendant la partie');
    assert.equal((await emitAck(a.c, 'set_stake', { roomId: 'ZZZZZ', stake: 50 })).success, false);
});

test('mise refusée : montant inconnu', async () => {
    const a = await account('Montant', 300);
    const { roomId } = await emitAck(a.c, 'create_room', { playerName: 'x', gameType: 'hezz2' });
    assert.equal((await emitAck(a.c, 'set_stake', { roomId, stake: 1000 })).success, false);
    assert.equal((await emitAck(a.c, 'set_stake', { roomId, stake: -50 })).success, false);
});

test('Ronda 2 contre 2 : le pot est partagé dans l\'équipe gagnante', () => {
    const room = { gameType: 'ronda', activePlayers: [{}, {}, {}, {}] };
    assert.deepEqual(stakeWinners(room, { winnerTeam: 1 }), [1, 3]);
    assert.deepEqual(stakeWinners(room, { winnerTeam: null }), [], 'manche finie, pas la partie');
    assert.deepEqual(stakeWinners({ gameType: 'hezz2', activePlayers: [{}, {}, {}] }, { loserIndex: 2, finishedPlayers: [1, 0] }), [1]);
});

test('serveur redémarré pendant une partie à mise : la mise est rendue à la reconnexion', async () => {
    const p = createProgress(memoryStore());
    p.setRoomAlive(() => false); // la salle n'existe plus
    const { profile } = await p.register({ name: 'Coupe', password: 'secret1' });
    const u = await p.store.get(profile.id);
    u.binga = { balance: 100, log: [] };
    await p.store.save(u);
    assert.equal((await p.chargeStake(profile.id, 'ABCDE', 50)).ok, true);
    const prof = await p.profile(await p.store.get(profile.id));
    assert.equal(prof.binga.balance, 100);
    assert.match(prof.binga.log[0].reason, /Mise rendue/);
});

test('tournoi à entrée en binga : 50 retirés au début, le gagnant reçoit le dos Sultan, le titre et de l\'XP', async () => {
    const a = await account('Sultan1', 80);
    const b = await account('Fauche', 10);
    const t = await emitAck(a.c, 'tournament_create', { name: 'Coupe binga', gameType: 'hezz2', size: 4, startsAt: Date.now() + 3600e3, entry: true });
    assert.equal(t.tournament.entry, 50);
    await emitAck(a.c, 'tournament_register', { id: t.id, name: 'Sultan1' });
    await emitAck(b.c, 'tournament_register', { id: t.id, name: 'Fauche' });
    assert.equal((await user('Sultan1')).binga.balance, 80, 'rien retiré à l\'inscription');
    const ea = once(a.c, 'tournament_entry');
    const eb = once(b.c, 'tournament_entry');
    const match = once(a.c, 'game_started');
    await emitAck(a.c, 'tournament_start_now', { id: t.id, hostToken: t.hostToken });
    const [pa, pb] = await Promise.all([ea, eb]);
    assert.equal(pa.paid, true);
    assert.equal(pb.paid, false, 'pas assez de binga : joue gratuitement');
    assert.equal((await user('Sultan1')).binga.balance, 30);
    assert.equal((await user('Fauche')).binga.balance, 10);
    const st = await match;
    const room = app.rooms[st.roomId];
    const meIdx = room.activePlayers.findIndex((x) => x.name === 'Sultan1');
    const prog = new Promise((resolve) => a.c.on('progress', (p) => { if (p.reward) resolve(p); }));
    app._commitState(room.id, room.gameState, getEngine('hezz2').forfeit(room.gameState, 1 - meIdx, meIdx));
    const won = await prog;
    assert.equal(won.reward.id, 'back:sultan');
    const u = await user('Sultan1');
    assert.ok(u.unlocks.includes('back:sultan') && u.unlocks.includes('back:tournoi'));
    assert.ok(u.titles.includes('sultan'));
    assert.ok(u.xp >= 300, 'XP doublée pour un tournoi à entrée');
});
