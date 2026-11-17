// Test de charge (node scripts/loadtest/load_run.js [salons,salons,...], depuis server/).
// Montée en charge : pour chaque palier, un serveur neuf, N salons de 4 joueurs pendant 50 s ; moyenne après 20 s
const { spawn } = require('child_process');
const path = require('path');
const LEVELS = (process.argv[2] || '25,50,100,200,300').split(',').map(Number);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

async function level(rooms) {
  const srv = spawn(process.execPath, [path.join(__dirname, 'load_server.js')], { stdio: ['ignore', 'ignore', 'pipe'] });
  const stats = [];
  srv.stderr.on('data', (d) => String(d).split('\n').forEach((l) => { if (l.startsWith('STAT ')) stats.push({ t: Date.now(), ...JSON.parse(l.slice(5)) }); }));
  await sleep(1500);
  const t0 = Date.now();
  const cli = spawn(process.execPath, [path.join(__dirname, 'load_clients.js'), String(rooms)], { stdio: ['ignore', 'pipe', 'inherit'] });
  const cstats = [];
  cli.stdout.on('data', (d) => String(d).split('\n').forEach((l) => { if (l.startsWith('CLIENT ')) cstats.push({ t: Date.now(), ...JSON.parse(l.slice(7)) }); }));
  await sleep(50000);
  cli.kill(); srv.kill();
  const s = stats.filter((x) => x.t - t0 > 20000), c = cstats.filter((x) => x.t - t0 > 20000);
  return {
    joueurs: rooms * 4, parties: Math.round(avg(s.map((x) => x.playing))),
    cpu: +avg(s.map((x) => x.cpu)).toFixed(1), cpuMax: Math.max(0, ...s.map((x) => x.cpu)),
    memMo: Math.max(0, ...s.map((x) => x.rss)),
    lagP99: +avg(s.map((x) => x.lagP99)).toFixed(1), lagMax: Math.max(0, ...s.map((x) => x.lagMax)),
    coupsParS: +(avg(c.map((x) => x.moves)) / 5).toFixed(1),
    repMed: Math.round(avg(c.map((x) => x.rttMed))), repP95: Math.max(0, ...c.map((x) => x.rttP95)),
  };
}

(async () => {
  for (const n of LEVELS) {
    const r = await level(n);
    console.log(JSON.stringify(r));
    await sleep(2000);
  }
  process.exit(0);
})();
