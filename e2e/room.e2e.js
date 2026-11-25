// Animations 3D, lot 1 : salle commune, table inclinée, joueurs assis (avatar en buste) autour de la table,
// joueur actif éclairé avec l'anneau du minuteur. Réglage « Animations 3D » coupé : retour à la table à plat.
// Les 4 jeux contre l'ordinateur, téléphone et ordinateur (1920 x 999). Captures dans e2e/.shots (salle-*.png)
const path = require('path');
const { setup, createChecker } = require('./helpers');

async function startSolo(t, p, label, size) {
    await p.goto(t.url);
    await t.sleep(4000);
    await p.locator(`[aria-label="${label}"] >> visible=true`).first().click({ force: true });
    await t.sleep(600);
    await p.locator('[aria-label="Solo"] >> visible=true').first().click({ force: true });
    await t.sleep(1000);
    await p.locator(`[aria-label="${size}"] >> visible=true`).first().click({ force: true });
    await t.sleep(5000);
}

const GAMES = [['Hezz2', '4 joueurs', 3], ['Ronda', '2 contre 2', 3], ['Kdoub', '4 joueurs', 3], ['Sota Ghamla', '4 joueurs', 3]];

(async () => {
    const t = await setup();
    const c = createChecker('salle');
    let n = 0;
    for (const [w, h, tag] of [[390, 844, 'tel'], [1920, 999, 'pc']]) {
        for (const [label, size, opp] of GAMES) {
            const reg = await t.app.progress.register({ name: `Salle${(n += 1)}`, password: 'secret12' });
            const p = await t.page(await t.context({ token: reg.token, width: w, height: h }));
            const errors = [];
            p.on('pageerror', (e) => errors.push(e.message));
            await startSolo(t, p, label, size);
            const chars = await p.locator('[aria-label="personnage"] >> visible=true').count();
            const tilted = await p.locator('[data-testid="table-3d"]').count();
            c.check(`${tag} · ${label} : ${opp} joueurs assis autour de la table inclinée`, chars === opp && tilted === 1);
            c.check(`${tag} · ${label} : pas d'erreur`, errors.length === 0);
            await p.screenshot({ path: path.join(t.OUT, `salle-${label.split(' ')[0].toLowerCase()}-${tag}.png`) });
            // Fluidité : images par seconde pendant 2 s de partie (respiration, cartes)
            const fps = await p.evaluate(() => new Promise((res) => {
                let f = 0; const t0 = performance.now();
                const tick = () => { f += 1; if (performance.now() - t0 < 2000) requestAnimationFrame(tick); else res(f / 2); };
                requestAnimationFrame(tick);
            }));
            c.check(`${tag} · ${label} : fluide (${Math.round(fps)} images/s)`, fps >= 30);
            await p.context().close();
        }
    }

    // Réglage coupé : table à plat et portraits ronds, comme avant
    const reg = await t.app.progress.register({ name: 'SalleOff', password: 'secret12' });
    const ctx = await t.context({ token: reg.token, width: 390, height: 844 });
    await ctx.addInitScript(() => localStorage.setItem('cosmetics', JSON.stringify({ fx3d: false })));
    const p = await t.page(ctx);
    await startSolo(t, p, 'Hezz2', '4 joueurs');
    c.check('Animations 3D coupées : table à plat, pas de personnages', (await p.locator('[aria-label="personnage"]').count()) === 0 && (await p.locator('[data-testid="table-3d"]').count()) === 0);
    await p.screenshot({ path: path.join(t.OUT, 'salle-off-tel.png') });

    await t.close();
    process.exit(c.ok ? 0 : 1);
})().catch((e) => { console.error('ERREUR', e.message.split('\n')[0]); process.exit(1); });
