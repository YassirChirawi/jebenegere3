// Serveur du test de charge : le vrai serveur, plus des mesures toutes les 2 s (processeur, mémoire, retard de la boucle)
process.env.STORE = 'memory';
process.env.ALLOWED_ORIGINS = '*';
const { monitorEventLoopDelay } = require('perf_hooks');
const app = require('../../server');
const h = monitorEventLoopDelay({ resolution: 10 });
h.enable();
let lastCpu = process.cpuUsage(), lastT = process.hrtime.bigint();
app.start(3100).then(() => {
  setInterval(() => {
    const cpu = process.cpuUsage(lastCpu), t = process.hrtime.bigint();
    const wallUs = Number(t - lastT) / 1000;
    lastCpu = process.cpuUsage(); lastT = t;
    const rooms = Object.values(app.rooms);
    const playing = rooms.filter((r) => r.gameState).length;
    const sockets = rooms.reduce((n, r) => n + r.activePlayers.filter((p) => !p.isBot).length, 0);
    process.stderr.write(`STAT ${JSON.stringify({
      cpu: +(100 * (cpu.user + cpu.system) / wallUs).toFixed(1),
      rss: Math.round(process.memoryUsage().rss / 1048576),
      heap: Math.round(process.memoryUsage().heapUsed / 1048576),
      lagP99: +(h.percentile(99) / 1e6).toFixed(1), lagMax: +(h.max / 1e6).toFixed(1),
      rooms: rooms.length, playing, humans: sockets,
    })}\n`);
    h.reset();
  }, 2000);
});
