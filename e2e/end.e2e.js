// Écran de fin de partie : temps forts de la partie et « Rejouer » en grand (Hezz2 et Ronda).
// La partie est jouée en solo, puis le serveur reçoit quelques coups marquants et la fin (via _commitState).
// Captures dans e2e/.shots (fin-*.png)
const path = require('path');
const { setup, createChecker } = require('./helpers');

async function startSolo(t, name, label, size, width, height) {
    const r = await t.app.progress.register({ name, password: 'secret12' });
    const p = await t.page(await t.context({ token: r.token, width, height }));
    await p.goto(t.url);
    await t.sleep(4000);
    await p.locator(`[aria-label="${label}"] >> visible=true`).first().click({ force: true });
    await t.sleep(600);
    await p.locator('[aria-label="Solo"] >> visible=true').first().click({ force: true });
    await t.sleep(1000);
    await p.locator(`[aria-label="${size}"] >> visible=true`).first().click({ force: true });
    await t.sleep(4500);
    const room = Object.values(t.app.rooms).find((x) => x.activePlayers.some((q) => q.name === name));
    const me = room.activePlayers.findIndex((q) => q.name === name);
    return { p, room, me };
}

const clone = (s) => JSON.parse(JSON.stringify(s));

(async () => {
    const t = await setup();
    const c = createChecker('fin de partie');

    for (const [w, h, tag] of [[390, 844, 'tel'], [1440, 900, 'pc']]) {
        // ---------------- Hezz2 : je pose deux 2, le bot pioche 4 cartes, puis je gagne
        const { p, room, me } = await startSolo(t, `Fin${tag}`, 'Hezz2', '2 joueurs', w, h);
        const bot = 1 - me;
        const commit = (fn) => { const prev = room.gameState; const next = clone(prev); fn(next, prev); t.app._commitState(room.id, prev, next); };
        const two = { suit: 'Oros', value: 2, id: 'Oros-2' };
        commit((s) => { s.turn = bot; s.middlePile.push(two); });
        room.gameState.turn = me; // pour que le 2 suivant soit compté pour moi
        commit((s) => { s.turn = bot; s.middlePile.push({ ...two, suit: 'Copas', id: 'Copas-2' }); });
        commit((s) => { s.hands[bot].push(...s.deck.splice(0, 4)); s.turn = me; });
        commit((s) => { s.hands[me] = []; s.finishedPlayers = [me]; s.loserIndex = bot; s.mancheTerminee = true; s.scores[me] += 1; });
        await t.sleep(3500);
        // Bilan du compte (XP, binga) par-dessus : on le ferme
        await p.locator('text=Continuer >> visible=true').first().click({ force: true }).catch(() => {});
        await t.sleep(800);
        const txt = await t.text(p);
        c.check(`${tag} · Hezz2 : temps forts (plus grosse pioche, 2 joués)`, /TEMPS FORTS/.test(txt) && /Grosse pioche/.test(txt) && /4 cartes/.test(txt) && /Le plus de 2 joués/.test(txt));
        const replay = p.locator('text=Rejouer >> visible=true').first();
        const quit = p.locator('text=Quitter >> visible=true').first();
        // Taille du bouton entier (le texte est dedans)
        const [rb, qb] = [await replay.locator('xpath=..').boundingBox(), await quit.locator('xpath=..').boundingBox()];
        c.check(`${tag} · Hezz2 : « Rejouer » en grand, au-dessus de « Quitter »`, !!rb && !!qb && rb.width > qb.width * 1.5 && rb.height > qb.height && rb.y < qb.y);
        await p.screenshot({ path: path.join(t.OUT, `fin-hezz2-${tag}.png`) });
        // Rejouer marche toujours : nouvelle partie, temps forts remis à zéro
        await replay.click({ force: true });
        await t.sleep(3000);
        c.check(`${tag} · Hezz2 : Rejouer relance une partie sans anciens temps forts`, !room.gameState.mancheTerminee && Object.keys(room.hl.counts).length === 0);
    }

    // ---------------- Ronda (téléphone en paysage n'est pas utile ici : ordinateur) : fin de partie après 2 manches
    const { p, room, me } = await startSolo(t, 'FinRonda', 'Ronda', '1 contre 1', 1440, 900);
    const other = 1 - me;
    let seq = 1000; // numéros d'événements (le client ignore un événement déjà vu)
    const commit = (fn) => {
        const prev = room.gameState; const next = clone(prev); fn(next, prev);
        next.events = (next.events || []).map((e) => ({ ...e, id: (seq += 1) }));
        t.app._commitState(room.id, prev, next);
    };
    const card = { suit: 'Oros', value: 5, id: 'Oros-5' };
    commit((s) => { s.events = [{ type: 'darba', player: me, team: me % 2, card, points: 1 }, { type: 'missa', player: other, team: other % 2, points: 1 }]; });
    commit((s) => { s.events = [{ type: 'darba', player: me, team: me % 2, card, points: 1 }, { type: 'bachra', player: me, team: me % 2, card, points: 10, count: 4 }, { type: 'announce_win', player: other, team: other % 2, combo: 'tringa', value: 3, points: 5 }]; });
    commit((s) => {
        const myT = me % 2;
        s.events = [{ type: 'manche_end' }];
        s.mancheTerminee = true;
        s.winnerTeam = myT;
        s.scores = myT === 0 ? [42, 27] : [27, 42];
        s.summary = { captured: [22, 18], cardPoints: [2, 0], bonus: [12, 6], scores: s.scores, detail: { darba: [2, 0], ronda: [0, 5], hbel: [0, 0], boug: [10, 0], missa: [0, 1], rey: [0, 0], as: [0, 0] } };
    });
    await t.sleep(12000); // les bandeaux (Darba, Boug…) passent avant l'écran de fin
    await p.locator('text=Continuer >> visible=true').first().click({ force: true }).catch(() => {});
    await t.sleep(800);
    const txt = await t.text(p);
    if (!/Darba ×2/.test(txt)) console.log('TEXTE', txt.split('\n').join(' | ').slice(0, 600));
    c.check('Ronda : temps forts de toute la partie (Boug, Tringa, Darba ×2, Missa)', /Boug · Toi/.test(txt) && /Darba ×2 · Toi/.test(txt) && /Tringa · /.test(txt) && /Missa · /.test(txt));
    await p.screenshot({ path: path.join(t.OUT, 'fin-ronda-pc.png') });

    await t.close();
    process.exit(c.ok ? 0 : 1);
})().catch((e) => { console.error('ERREUR', e.message.split('\n')[0]); process.exit(1); });
