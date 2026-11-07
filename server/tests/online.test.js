// Tests réseau de bout en bout : vrai serveur Socket.io + vrais clients.
// Couvre les bugs remontés au test du 7 nov 2026 : matchmaking, Rejouer, abandon en cours de partie.
process.env.MATCHMAKING_WAIT_MS = '1500'; // au lieu de 10 s, pour des tests rapides

const test = require('node:test');
const assert = require('node:assert/strict');
const { io } = require('socket.io-client');
const app = require('../server');
const { getEngine } = require('../engines');

let URL;
const clients = [];

test.before(async () => {
    const port = await app.start(0);
    URL = `http://localhost:${port}`;
});
test.after(async () => {
    clients.forEach((c) => c.close());
    await app.stop();
});

function client() {
    const c = io(URL, { transports: ['websocket'], forceNew: true });
    clients.push(c);
    return c;
}
const connected = (c) => (c.connected ? Promise.resolve() : new Promise((r) => c.once('connect', r)));
const once = (c, ev, ms = 6000) => new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout en attendant "${ev}"`)), ms);
    c.once(ev, (d) => { clearTimeout(t); resolve(d); });
});
const emitAck = (c, ev, data) => new Promise((r) => c.emit(ev, data, r));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Attendre un état qui vérifie une condition
const waitState = (c, pred, ms = 8000) => new Promise((resolve, reject) => {
    const t = setTimeout(() => { c.off('game_state_update', h); reject(new Error('état attendu jamais reçu')); }, ms);
    function h(s) { if (pred(s)) { clearTimeout(t); c.off('game_state_update', h); resolve(s); } }
    c.on('game_state_update', h);
});

// Termine la partie d'une room côté serveur (pour tester Rejouer sans jouer toute une manche)
function endGameNow(roomId) {
    const room = app.rooms[roomId];
    const engine = getEngine(room.gameType);
    const bot = room.activePlayers.findIndex((p) => p.isBot);
    room.gameState = engine.forfeit(room.gameState, bot === -1 ? 1 : bot, 0);
    if (room.timerInterval) clearInterval(room.timerInterval);
}

test('le serveur annonce sa version et ses fonctionnalités à la connexion', async () => {
    const c = client();
    const info = await once(c, 'server_info');
    assert.ok(info.version >= 3);
    assert.ok(info.features.includes('matchmaking'));
    assert.ok(info.games.includes('hezz2'));
});

test('bug 1 : deux joueurs qui cherchent une partie à 2 sont appariés', async () => {
    const a = client();
    const b = client();
    await Promise.all([connected(a), connected(b)]);
    const ma = once(a, 'match_found');
    const mb = once(b, 'match_found');
    assert.deepEqual(await emitAck(a, 'find_match', { playerName: 'A', targetSize: 2 }), { success: true });
    await emitAck(b, 'find_match', { playerName: 'B', targetSize: 2 });
    const [da, db] = await Promise.all([ma, mb]);
    assert.equal(da.roomId, db.roomId);
    assert.deepEqual(da.gameState.players.map((p) => p.name).sort(), ['A', 'B']);
    assert.ok(da.gameState.players.every((p) => !p.isBot));
});

for (const size of [2, 3, 4]) {
    test(`bug 1 : un joueur seul (partie à ${size}) est complété par des bots`, async () => {
        const c = client();
        await connected(c);
        const m = once(c, 'match_found', 8000);
        await emitAck(c, 'find_match', { playerName: `Solo${size}`, targetSize: size });
        const d = await m;
        assert.equal(d.gameState.players.length, size);
        assert.equal(d.gameState.players.filter((p) => p.isBot).length, size - 1);
        c.close();
    });
}

test('bug 1 : annuler la recherche retire vraiment le joueur de la file', async () => {
    const c = client();
    await connected(c);
    let matched = false;
    c.on('match_found', () => { matched = true; });
    await emitAck(c, 'find_match', { playerName: 'Annule', targetSize: 3 });
    c.emit('cancel_match');
    await sleep(4500);
    assert.equal(matched, false);
});

test('bug 2 : Rejouer contre les bots fonctionne 3 fois de suite', async () => {
    const c = client();
    await connected(c);
    const r = await emitAck(c, 'create_bot_room', { playerName: 'Rejoueur', botCount: 2, gameType: 'hezz2' });
    assert.ok(r.success);
    for (let k = 0; k < 3; k++) {
        endGameNow(r.roomId);
        const started = once(c, 'game_started');
        const ack = await emitAck(c, 'play_again', { roomId: r.roomId });
        assert.deepEqual(ack, { success: true });
        const s = await started;
        assert.equal(s.mancheTerminee, false);
        assert.deepEqual(s.hands.map((h) => h.length), [4, 4]);
    }
    c.close();
});

test('bug 2 : Rejouer refusé avec une explication (pas hôte, partie en cours)', async () => {
    const a = client();
    const b = client();
    await Promise.all([connected(a), connected(b)]);
    const room = await emitAck(a, 'create_room', { playerName: 'Hote', gameType: 'hezz2' });
    await emitAck(b, 'join_room', { roomId: room.roomId, playerName: 'Invite' });
    const started = once(b, 'game_started');
    a.emit('start_game', { roomId: room.roomId });
    await started;
    const enCours = await emitAck(a, 'play_again', { roomId: room.roomId });
    assert.equal(enCours.success, false);
    endGameNow(room.roomId);
    const pasHote = await emitAck(b, 'play_again', { roomId: room.roomId });
    assert.equal(pasHote.success, false);
    assert.match(pasHote.message, /hôte/);
    a.close();
    b.close();
});

for (const how of ['leave_room', 'disconnect']) {
    test(`bug 3 : abandon de l'hôte en 1 contre 1 (${how}) = victoire par forfait, timer arrêté`, async () => {
        const a = client();
        const b = client();
        await Promise.all([connected(a), connected(b)]);
        const room = await emitAck(a, 'create_room', { playerName: 'Hote', gameType: 'hezz2' });
        await emitAck(b, 'join_room', { roomId: room.roomId, playerName: 'Reste' });
        const started = once(b, 'game_started');
        a.emit('start_game', { roomId: room.roomId });
        await started;

        const ended = waitState(b, (s) => s.mancheTerminee);
        if (how === 'leave_room') a.emit('leave_room', { roomId: room.roomId });
        else a.close();
        const s = await ended;
        assert.equal(s.forfeit.player, 0);
        assert.equal(s.loserIndex, 0);
        assert.equal(s.players[1].name, 'Reste');

        // Plus aucun tic de chrono après la fin
        let ticks = 0;
        b.on('timer_tick', () => ticks++);
        await sleep(2200);
        assert.equal(ticks, 0);

        // Le joueur restant devient hôte et peut rejouer (contre le bot qui a pris la place)
        const again = once(b, 'game_started');
        assert.deepEqual(await emitAck(b, 'play_again', { roomId: room.roomId }), { success: true });
        const s2 = await again;
        assert.equal(s2.mancheTerminee, false);
        b.close();
    });
}

test('bug 3 : à 3 joueurs, un départ ne bloque pas la partie (un bot reprend la place)', async () => {
    const [a, b, c] = [client(), client(), client()];
    await Promise.all([a, b, c].map(connected));
    const room = await emitAck(a, 'create_room', { playerName: 'A', gameType: 'hezz2' });
    await emitAck(b, 'join_room', { roomId: room.roomId, playerName: 'B' });
    await emitAck(c, 'join_room', { roomId: room.roomId, playerName: 'C' });
    const started = once(b, 'game_started');
    a.emit('start_game', { roomId: room.roomId });
    const s0 = await started;
    assert.equal(s0.turn, 0);

    const replaced = waitState(b, (s) => s.players[0].isBot);
    a.emit('leave_room', { roomId: room.roomId });
    const s1 = await replaced;
    assert.equal(s1.mancheTerminee, false);
    // C'était le tour du joueur parti : le bot joue à sa place, le tour avance
    const moved = await waitState(b, (s) => s.turn !== 0, 6000);
    assert.notEqual(moved.turn, 0);
    b.close();
    c.close();
});

test('bug 3 : abandon en Ronda et en Kdoub = fin propre par forfait', async () => {
    const a = client();
    const b = client();
    await Promise.all([connected(a), connected(b)]);
    const room = await emitAck(a, 'create_room', { playerName: 'A', gameType: 'ronda' });
    await emitAck(b, 'join_room', { roomId: room.roomId, playerName: 'B' });
    const started = once(b, 'game_started');
    a.emit('start_game', { roomId: room.roomId });
    await started;
    const ended = waitState(b, (s) => s.mancheTerminee);
    a.emit('leave_room', { roomId: room.roomId });
    const s = await ended;
    assert.equal(s.winnerTeam, 1);
    assert.ok(s.events.some((e) => e.type === 'forfeit'));

    const k = getEngine('kdoub');
    const st = k.forfeit(k.init(3), 0, 2);
    assert.equal(st.phase, 'over');
    assert.equal(st.winner, 2);
    assert.equal(st.ranking[0].player, 2);
    b.close();
});

test('mode test : main forcée avec des 1, 2 et 7 (parties contre bots)', async () => {
    const c = client();
    await connected(c);
    const r = await emitAck(c, 'create_bot_room', { playerName: 'Testeur', botCount: 2, gameType: 'hezz2', debugHand: 'specials' });
    const values = r.gameState.hands[0].map((x) => x.value);
    assert.ok(values.includes(1) && values.includes(2) && values.includes(7), `main : ${values}`);
    const total = r.gameState.hands.reduce((n, h) => n + h.length, 0) + r.gameState.deck.length + r.gameState.middlePile.length;
    assert.equal(total, 40, 'aucune carte perdue ni dupliquée');
    c.close();
});

test('bug 3 : abandon du joueur NON hôte en 1 contre 1 = victoire par forfait de l\'hôte', async () => {
    const a = client();
    const b = client();
    await Promise.all([connected(a), connected(b)]);
    const room = await emitAck(a, 'create_room', { playerName: 'Hote', gameType: 'hezz2' });
    await emitAck(b, 'join_room', { roomId: room.roomId, playerName: 'Invite' });
    const started = once(a, 'game_started');
    a.emit('start_game', { roomId: room.roomId });
    await started;
    const ended = waitState(a, (s) => s.mancheTerminee);
    b.close();
    const s = await ended;
    assert.equal(s.forfeit.player, 1);
    assert.equal(s.loserIndex, 1);
    assert.deepEqual(await emitAck(a, 'play_again', { roomId: room.roomId }), { success: true });
    a.close();
});
