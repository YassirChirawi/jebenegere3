// Salon privé : compte à rebours avant le premier coup, retour au salon et changement de jeu
process.env.STORE = 'memory';
process.env.START_COUNTDOWN_MS = '1200';

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
const once = (c, ev, ms = 6000) => new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout "${ev}"`)), ms);
    c.once(ev, (d) => { clearTimeout(t); resolve(d); });
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('compte à rebours : coups refusés pendant, acceptés après, chrono lancé après', async () => {
    const [h, a] = [client(), client()];
    await Promise.all([h, a].map(connected));
    const { roomId } = await emitAck(h, 'create_room', { playerName: 'Hote', gameType: 'ronda' });
    await emitAck(a, 'join_room', { roomId, playerName: 'Amine' });
    const started = once(h, 'game_started');
    let ticks = 0;
    h.on('timer_tick', () => { ticks++; });
    h.emit('start_game', { roomId });
    const st = await started;
    assert.ok(st.startIn > 800 && st.startIn <= 1200, `startIn = ${st.startIn}`);
    const room = app.rooms[roomId];
    const c = [h, a][room.gameState.turn];
    const before = room.version;
    const rejected = once(c, 'action_rejected');
    c.emit('game_action', { roomId, action: { type: 'play', cardIndex: 0 } });
    await rejected;
    assert.equal(room.version, before, 'aucun coup pendant le compte à rebours');
    await sleep(300);
    assert.equal(ticks, 0, 'pas de chrono pendant le compte à rebours');
    await sleep(1100);
    assert.ok(ticks > 0, 'le chrono démarre après');
    const c2 = [h, a][room.gameState.turn];
    c2.emit('game_action', { roomId, action: { type: 'play', cardIndex: 0 } });
    await sleep(200);
    assert.ok(room.version > before, 'le coup passe après le compte à rebours');
});

test('changer de jeu dans le salon : joueurs en trop, retour au salon, nouveau jeu', async () => {
    const [h, a, b, x] = [client(), client(), client(), client()];
    await Promise.all([h, a, b, x].map(connected));
    const { roomId } = await emitAck(h, 'create_room', { playerName: 'Hote', gameType: 'kdoub' });
    for (const [c, n] of [[a, 'Amine'], [b, 'Badr']]) await emitAck(c, 'join_room', { roomId, playerName: n });
    await emitAck(h, 'add_bot', { roomId });
    await emitAck(h, 'add_bot', { roomId });
    const room = app.rooms[roomId];
    assert.equal(room.activePlayers.length, 5);

    // Un invité ne peut pas changer de jeu
    assert.equal((await emitAck(a, 'change_game', { roomId, gameType: 'ronda' })).success, false);
    // Kdoub à 5 → Ronda (4 max) : un bot part
    const r = await emitAck(h, 'change_game', { roomId, gameType: 'ronda' });
    assert.equal(r.success, true);
    assert.equal(r.roomData.gameType, 'ronda');
    assert.equal(room.activePlayers.length, 4);
    assert.equal(room.activePlayers.filter((p) => p.isBot).length, 1);
    assert.equal((await emitAck(h, 'change_game', { roomId, gameType: 'poker' })).success, false);

    // Partie de Ronda, puis on ne peut pas changer de jeu pendant la partie
    const started = once(a, 'game_started');
    h.emit('start_game', { roomId });
    assert.equal((await started).gameType, 'ronda');
    assert.equal((await emitAck(h, 'change_game', { roomId, gameType: 'hezz2' })).success, false);
    assert.equal((await emitAck(h, 'back_to_lobby', { roomId })).success, false, 'partie en cours');

    // Fin de partie (forcée) → retour au salon pour tout le monde
    room.gameState = { ...room.gameState, winnerTeam: 0, mancheTerminee: true, gameOver: true };
    const engine = require('../engines').getEngine('ronda');
    if (!engine.isOver(room.gameState)) room.gameState.scores = [99, 0];
    assert.ok(engine.isOver(room.gameState));
    const back = Promise.all([a, b].map((c) => once(c, 'back_to_lobby')));
    assert.equal((await emitAck(h, 'back_to_lobby', { roomId })).success, true);
    const [ra] = await back;
    assert.equal(ra.inGame, false);
    assert.equal(room.gameState, null);

    // Un nouveau venu rejoint le salon, puis passage au Hezz2 (4 max) : le bot part, le nouveau joue
    await emitAck(x, 'join_room', { roomId, playerName: 'Xavier' });
    assert.equal((await emitAck(h, 'change_game', { roomId, gameType: 'hezz2' })).success, true);
    assert.equal(room.gameType, 'hezz2');
    assert.ok(room.activePlayers.length <= 4);
    assert.equal(room.activePlayers.filter((p) => p.isBot).length, 0);
    const st2 = once(b, 'game_started');
    h.emit('start_game', { roomId });
    assert.equal((await st2).gameType, 'hezz2');
});

test('salon de matchmaking ou partie contre bots : pas de retour au salon', async () => {
    const h = client();
    await connected(h);
    const r = await emitAck(h, 'create_bot_room', { playerName: 'Solo', botCount: 2, gameType: 'ronda' });
    assert.equal(r.success, true);
    assert.ok(r.gameState.startIn > 0, 'compte à rebours aussi contre les bots');
    assert.equal((await emitAck(h, 'change_game', { roomId: r.roomId, gameType: 'hezz2' })).success, false);
});
