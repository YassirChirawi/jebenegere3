// Parties de Ronda au hasard (coups, annonces, dénonciations, temps écoulés) pour trouver un coup qui fait planter le moteur.
//   node scripts/fuzz-ronda.js [parties] [joueurs]
const ronda = require('../engines/ronda');
const N = Number(process.argv[2] || 3000);
const P = Number(process.argv[3] || 4);
let seed = 1;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
Math.random = rnd; // parties reproductibles
let failures = 0;
for (let g = 0; g < N; g++) {
    let s = ronda.init(P);
    const trail = [];
    for (let step = 0; step < 2000 && s.winnerTeam === null; step++) {
        if (s.mancheTerminee) { s = ronda.init(P, s); trail.length = 0; continue; }
        const r = rnd();
        let p, action;
        if (r < 0.08) { p = Math.floor(rnd() * P); action = { type: 'announce' }; }
        else if (r < 0.14) { p = Math.floor(rnd() * P); action = { type: 'denounce', target: Math.floor(rnd() * P), value: rnd() < 0.5 ? undefined : [1, 2, 3, 4, 5, 6, 7, 10, 11, 12][Math.floor(rnd() * 10)] }; }
        else if (r < 0.18) { action = { type: '_timeout' }; }
        else if (r < 0.24) { // action d'un bot
            const acts = ronda.botActions(s, () => true).filter((a) => a.action);
            if (!acts.length) continue;
            ({ player: p, action } = acts[Math.floor(rnd() * acts.length)]);
        } else { p = s.turn; action = { type: 'play', cardIndex: Math.floor(rnd() * Math.max(1, s.hands[p]?.length || 1)) }; }
        trail.push({ p, action, turn: s.turn, deal: s.dealIndex, hands: s.hands.map((h) => h.length) });
        try {
            if (action.type === '_timeout') s = ronda.onTimeout(s);
            else s = ronda.apply(s, p, action);
            for (let v = 0; v < P; v++) ronda.viewFor(s, v);
            ronda.botActions(s, () => true);
            if (!s.mancheTerminee && (s.turn === null || !s.hands[s.turn].length)) throw new Error(`tour ${s.turn} sans carte, mains ${s.hands.map((h) => h.length)}`);
        } catch (e) {
            failures += 1;
            if (failures <= 3) {
                console.log(`PLANTAGE partie ${g}, coup ${step} : ${e.stack.split('\n').slice(0, 4).join(' | ')}`);
                console.log('  derniers coups :', JSON.stringify(trail.slice(-4)));
            }
            break;
        }
    }
}
console.log(`${N} parties à ${P} joueurs : ${failures} plantage(s)`);
