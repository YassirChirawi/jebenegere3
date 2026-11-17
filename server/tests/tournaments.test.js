// Lot 2 : tournois à élimination directe (Hezz2, Ronda solo et 2 contre 2)
process.env.STORE = 'memory';
process.env.START_COUNTDOWN_MS = '0';
process.env.TOURNAMENT_SHOWUP_MS = '300';
process.env.TOURNAMENT_NEXT_MANCHE_MS = '0';

const test = require('node:test');
const assert = require('node:assert/strict');
const { io } = require('socket.io-client');
const app = require('../server');
const { getEngine } = require('../engines');
const { seed } = require('../tournaments');

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const once = (c, ev, ms = 5000) => new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout "${ev}"`)), ms);
    c.once(ev, (d) => { clearTimeout(t); resolve(d); });
});
const post = async (path, body) => {
    const r = await fetch(URL + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return r.json();
};
const inHour = () => Date.now() + 3600 * 1000;

async function players(names) {
    const list = names.map(() => client());
    await Promise.all(list.map(connected));
    return list;
}
async function create(host, opts = {}) {
    const r = await emitAck(host, 'tournament_create', { name: 'Coupe du quartier', gameType: 'hezz2', size: 4, startsAt: inHour(), ...opts });
    assert.equal(r.success, true, r.message);
    return r;
}
async function registerAll(id, list, names) {
    const out = [];
    for (let i = 0; i < list.length; i++) {
        const r = await emitAck(list[i], 'tournament_register', { id, name: names[i] });
        assert.equal(r.success, true, r.message);
        out.push(r);
    }
    return out;
}
const roomOfMatch = (matchId, tid) => Object.values(app.rooms).find((r) => r.tournament && r.tournament.id === tid && r.tournament.matchId === matchId);
// Termine la partie d'une salle de tournoi : le joueur au siège "loser" perd par forfait
function endMatch(room, loserSeat) {
    app._commitState(room.id, room.gameState, getEngine(room.gameType).forfeit(room.gameState, loserSeat));
}

test('tirage : jamais deux places vides face à face, une seule finale', () => {
    for (const n of [2, 3, 4, 5, 6, 7, 8]) {
        const t = { mode: 'solo', entrants: Array.from({ length: n }, (_, i) => ({ id: `e${i}`, name: `J${i}` })) };
        seed(t);
        t.rounds[0].forEach((m) => assert.ok(m.a !== null || m.b !== null, `n=${n}`));
        assert.equal(t.rounds[t.rounds.length - 1].length, 1);
        const placed = t.rounds[0].flatMap((m) => [m.a, m.b]).filter((x) => x !== null);
        assert.equal(placed.length, n);
    }
    const duo = { mode: 'duo', entrants: Array.from({ length: 5 }, (_, i) => ({ id: `e${i}`, name: `J${i}` })) };
    seed(duo);
    assert.equal(duo.units.length, 3);
    assert.ok(duo.units.some((u) => u.members.includes('bot')), 'le 5e joueur est complété par un bot');
});

test('création et inscription : contrôles, pseudos seulement dans la vue publique', async () => {
    const [h, a, b, c, d, e] = await players([1, 2, 3, 4, 5, 6]);
    assert.equal((await emitAck(h, 'tournament_create', { name: 'x', gameType: 'hezz2', size: 4, startsAt: inHour() })).success, false);
    assert.equal((await emitAck(h, 'tournament_create', { name: 'Coupe', gameType: 'kdoub', size: 4, startsAt: inHour() })).success, false);
    assert.equal((await emitAck(h, 'tournament_create', { name: 'Coupe', gameType: 'hezz2', size: 6, startsAt: inHour() })).success, false);
    assert.equal((await emitAck(h, 'tournament_create', { name: 'Coupe', gameType: 'hezz2', size: 4, startsAt: Date.now() + 40 * 86400000 })).success, false);
    const { id } = await create(h);
    assert.match(id, /^[A-Z2-9]{6}$/);
    const regs = await registerAll(id, [a, b, c], ['Amine', 'Badr', 'Chama']);
    assert.equal((await emitAck(d, 'tournament_register', { id, name: 'amine' })).success, false, 'pseudo déjà pris');
    assert.equal((await emitAck(d, 'tournament_register', { id: id.toLowerCase(), name: 'Dina' })).success, true, 'code en minuscules');
    assert.equal((await emitAck(e, 'tournament_register', { id, name: 'Elias' })).success, false, 'complet');
    // Désinscription puis réinscription
    assert.equal((await emitAck(c, 'tournament_unregister', { id, ticket: regs[2].ticket })).success, true);
    const view = (await emitAck(e, 'tournament_watch', { id })).tournament;
    assert.deepEqual(view.entrants.map((x) => x.name), ['Amine', 'Badr', 'Dina']);
    assert.ok(!JSON.stringify(view).includes('ticket'), 'aucun ticket dans la vue publique');
    assert.ok(!JSON.stringify(view).includes('host'), "pas d'empreinte de l'organisateur");
    // Seul l'organisateur peut lancer
    assert.equal((await emitAck(a, 'tournament_start_now', { id, hostToken: 'faux' })).success, false);
    [h, a, b, c, d, e].forEach((s) => s.close());
});

test('Hezz2 à 4 : demi-finales lancées, finale entre les vainqueurs, champion récompensé, palmarès', async () => {
    const reg = await post('/api/register', { name: 'Champi', password: 'secret12' });
    const list = await players([1, 2, 3, 4]);
    const [a] = list;
    assert.equal((await emitAck(a, 'auth', { token: reg.token })).success, true);
    const { id, hostToken } = await create(a, { name: 'Coupe Hezz2' });
    await registerAll(id, list, ['Champi', 'Badr', 'Chama', 'Dina']);
    const started = list.map((s) => once(s, 'game_started'));
    assert.equal((await emitAck(a, 'tournament_start_now', { id, hostToken })).success, true);
    await Promise.all(started);
    const t = app.tournaments._all.get(id);
    assert.equal(t.status, 'running');
    assert.equal(t.rounds[0].length, 2);
    assert.ok(t.rounds[0].every((m) => m.status === 'playing'));

    // Champi gagne sa demi-finale ; dans l'autre, le siège 0 gagne
    const nameOf = (eid) => t.entrants.find((e) => e.id === eid).name;
    const over = once(a, 'tournament_match_over');
    for (const m of t.rounds[0]) {
        const room = roomOfMatch(m.id, id);
        const champSeat = room.activePlayers.findIndex((p) => p.name === 'Champi');
        endMatch(room, champSeat === -1 ? 1 : 1 - champSeat);
    }
    const mo = await over;
    assert.equal(mo.winner, 'Champi');
    await sleep(100);
    const final = t.rounds[1][0];
    assert.equal(final.status, 'playing', 'la finale est lancée dès la fin des demi-finales');
    const finalists = [final.a, final.b].map((u) => nameOf(t.units[u].members[0]));
    assert.ok(finalists.includes('Champi'));

    const won = once(a, 'tournament_won');
    // Le premier « progress » est l'XP de la partie ; la récompense du tournoi suit
    const prog = new Promise((resolve) => a.on('progress', (x) => { if (x.reward) resolve(x); }));
    const room = roomOfMatch(final.id, id);
    endMatch(room, 1 - room.activePlayers.findIndex((p) => p.name === 'Champi'));
    assert.equal((await won).needsAccount, false);
    const p = await prog;
    assert.equal(p.reward.id, 'back:tournoi');
    assert.ok(p.profile.unlocks.includes('back:tournoi'), 'dos Champion débloqué');
    assert.ok(p.profile.titles.find((x) => x.id === 'champion').unlocked, 'titre Moul chi');
    assert.equal(t.status, 'done');
    assert.equal(t.champion.name, 'Champi');

    const pal = await emitAck(list[1], 'tournament_palmares', {});
    assert.equal(pal.list[0].name, 'Coupe Hezz2');
    assert.equal(pal.list[0].champion, 'Champi');
    // Le tournoi est sauvegardé (rechargé au redémarrage du serveur)
    assert.ok((await app.store.listTournaments()).some((x) => x.id === id && x.status === 'done'));
    list.forEach((s) => s.close());
});

test("absent à l'heure du match : forfait ; abandon en pleine partie : forfait", async () => {
    // Absence
    const [h, a, b] = await players([1, 2, 3]);
    let r = await create(h, { name: 'Coupe absence' });
    await registerAll(r.id, [a, b], ['Amine', 'Badr']);
    b.emit('tournament_unwatch', { id: r.id }); // Badr a fermé la page du tournoi
    await sleep(50);
    await emitAck(h, 'tournament_start_now', { id: r.id, hostToken: r.hostToken });
    let t = app.tournaments._all.get(r.id);
    assert.equal(t.rounds[0][0].status, 'waiting');
    await sleep(350);
    app.tournaments.tick();
    assert.equal(t.status, 'done');
    assert.equal(t.champion.name, 'Amine');
    assert.equal(t.rounds[0][0].forfeit, true);
    assert.match(t.rounds[0][0].summary[0], /Badr absent/);

    // Abandon
    const [c, d] = await players([1, 2]);
    r = await create(h, { name: 'Coupe abandon' });
    await registerAll(r.id, [c, d], ['Chama', 'Dina']);
    const st = once(c, 'game_started');
    await emitAck(h, 'tournament_start_now', { id: r.id, hostToken: r.hostToken });
    await st;
    t = app.tournaments._all.get(r.id);
    const room = roomOfMatch(t.rounds[0][0].id, r.id);
    const over = once(c, 'tournament_match_over');
    d.emit('leave_room', { roomId: room.id });
    const mo = await over;
    assert.equal(mo.winner, 'Chama');
    assert.equal(mo.forfeit, true);
    assert.ok(mo.summary.some((x) => /Dina a abandonné/.test(x)));
    assert.equal(t.champion.name, 'Chama');
    [h, a, b, c, d].forEach((s) => s.close());
});

test('Ronda 2 contre 2 : équipes sur les sièges pairs / impairs, champion = les deux coéquipiers', async () => {
    const list = await players([1, 2, 3, 4]);
    const { id, hostToken } = await create(list[0], { name: 'Ronda des amis', gameType: 'ronda', mode: 'duo' });
    await registerAll(id, list, ['Amine', 'Badr', 'Chama', 'Dina']);
    const started = list.map((s) => once(s, 'game_started'));
    await emitAck(list[0], 'tournament_start_now', { id, hostToken });
    const states = await Promise.all(started);
    assert.equal(states[0].players.length, 4);
    const t = app.tournaments._all.get(id);
    assert.equal(t.rounds.length, 1, '2 équipes : finale directe');
    const final = t.rounds[0][0];
    const room = roomOfMatch(final.id, id);
    const teamA = t.units[final.a].members.map((e) => t.entrants.find((x) => x.id === e).name);
    assert.deepEqual([room.activePlayers[0].name, room.activePlayers[2].name].sort(), [...teamA].sort(), 'équipe A aux sièges 0 et 2');
    // Le siège 1 (équipe B) abandonne : l'équipe A gagne
    const won = once(list[0], 'tournament_match_over');
    endMatch(room, 1);
    const mo = await won;
    assert.equal(mo.winner, teamA.join(' & '));
    assert.deepEqual([...t.champion.names].sort(), [...teamA].sort());
    list.forEach((s) => s.close());
});

test("Ronda : la manche suivante s'enchaîne toute seule jusqu'au score final", async () => {
    const list = await players([1, 2]);
    const { id, hostToken } = await create(list[0], { name: 'Ronda solo', gameType: 'ronda' });
    await registerAll(id, list, ['Amine', 'Badr']);
    const st = once(list[0], 'game_started');
    await emitAck(list[0], 'tournament_start_now', { id, hostToken });
    await st;
    const t = app.tournaments._all.get(id);
    const room = roomOfMatch(t.rounds[0][0].id, id);
    // Fin de manche sans vainqueur de la partie : nouvelle manche automatique
    const next = once(list[0], 'game_started');
    app._commitState(room.id, room.gameState, { ...room.gameState, mancheTerminee: true, winnerTeam: null, events: [] });
    await next;
    assert.equal(t.rounds[0][0].status, 'playing');
    assert.equal((await emitAck(list[0], 'play_again', { roomId: room.id })).success, false, 'pas de Rejouer en tournoi');
    list.forEach((s) => s.close());
});
