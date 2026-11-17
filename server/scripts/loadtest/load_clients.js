// Faux joueurs du test de charge : salons privés de Hezz2 à 4 humains qui jouent comme des humains
// (1 à 2,5 s de réflexion), et relancent une manche dès qu'elle finit. Usage : node load_clients.js <salons>
const { io } = require('socket.io-client');
const { botActions } = require('../../engines/hezz2');
const URL = 'http://localhost:3100';
const ROOMS = Number(process.argv[2] || 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const emitAck = (c, ev, d) => new Promise((r) => c.emit(ev, d, r));
let moves = 0, rtts = [], manches = 0;

function player(name) {
  const c = io(URL, { transports: ['websocket'], forceNew: true, extraHeaders: { origin: 'http://localhost' } });
  c.name = name;
  let pendingVersion = null;
  const onState = (s) => {
    if (!s || !s.players) return;
    const me = s.players.findIndex((p) => p.id === c.id);
    if (me < 0) return;
    if (s.mancheTerminee) {
      if (s.hostId === c.id && c.lastOver !== s) { c.lastOver = s; manches += 1; setTimeout(() => c.emit('play_again', { roomId: c.roomId }, () => {}), 3000); }
      return;
    }
    if ((s.startIn || 0) > 0) { setTimeout(() => onState({ ...s, startIn: 0 }), s.startIn + 50); return; }
    if (s.turn !== me) return;
    const key = `${s.middlePile?.length}-${s.hands?.[me]?.length}-${s.pendingAction ? 1 : 0}`;
    if (pendingVersion === key) return;
    pendingVersion = key;
    const [a] = botActions(s, (i) => i === me).filter((x) => x.action);
    if (!a) return;
    setTimeout(() => {
      const t0 = Date.now();
      c.once('game_state_update', () => { rtts.push(Date.now() - t0); });
      if (a.action.type === 'play') c.emit('play_card', { roomId: c.roomId, cardIndex: a.action.cardIndex, newSuitFor7: a.action.newSuitFor7 });
      else c.emit('draw_card', { roomId: c.roomId });
      moves += 1;
    }, 1000 + Math.random() * 1500);
  };
  c.on('game_started', onState);
  c.on('game_state_update', onState);
  return c;
}

(async () => {
  for (let r = 0; r < ROOMS; r++) {
    const ps = [0, 1, 2, 3].map((k) => player(`J${r}_${k}`));
    await Promise.all(ps.map((c) => new Promise((ok) => (c.connected ? ok() : c.once('connect', ok)))));
    const { roomId } = await emitAck(ps[0], 'create_room', { playerName: ps[0].name, gameType: 'hezz2' });
    ps[0].roomId = roomId;
    for (const c of ps.slice(1)) { c.roomId = roomId; await emitAck(c, 'join_room', { roomId, playerName: c.name }); }
    ps[0].emit('start_game', { roomId });
    if (r % 10 === 9) await sleep(200);
  }
  setInterval(() => {
    const s = [...rtts].sort((a, b) => a - b);
    const q = (p) => (s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0);
    process.stdout.write(`CLIENT ${JSON.stringify({ moves, manches, rttMed: q(0.5), rttP95: q(0.95), rttMax: s[s.length - 1] || 0 })}\n`);
    rtts = []; moves = 0;
  }, 5000);
})();
