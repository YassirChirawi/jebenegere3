// Ordinateur (1440 x 900) et tablette (1024 x 768) : une partie solo de chaque jeu prend toute la fenêtre.
// Captures dans e2e/.shots (partie-large-*.png)
const path = require('path');
const { setup, createChecker } = require('./helpers');

const GAMES = [['Hezz2', 'hezz2', '2 joueurs'], ['Ronda', 'ronda', '1 contre 1'], ['Kdoub', 'kdoub', '3 joueurs'], ['Sota Ghamla', 'sota', '4 joueurs']];

(async () => {
    const t = await setup();
    const c = createChecker('parties en large');
    for (const [w, h, tag] of [[1440, 900, 'pc'], [1024, 768, 'tablette']]) {
        for (const [label, type, n] of GAMES) {
            // Un joueur neuf par partie (sinon l'accueil ramène à la partie en cours)
            const r = await t.app.progress.register({ name: `${tag}${type}`.slice(0, 16), password: 'secret12' });
            const p = await t.page(await t.context({ token: r.token, width: w, height: h }));
            await p.goto(t.url);
            await t.sleep(4000);
            await p.locator(`[aria-label="${label}"] >> visible=true`).first().click({ force: true });
            await t.sleep(600);
            await p.locator('[aria-label="Solo"] >> visible=true').first().click({ force: true });
            await t.sleep(1000);
            await p.locator(`[aria-label="${n}"] >> visible=true`).first().click({ force: true });
            await t.sleep(5500);
            const room = Object.values(t.app.rooms).find((r) => r.gameType === type && r.activePlayers.some((x) => x.name === `${tag}${type}`.slice(0, 16)));
            // La table occupe la fenêtre : au moins une carte de ma main est à plus de 600 px du bord gauche
            const spread = await p.evaluate(() => {
                const xs = [...document.querySelectorAll('[aria-label]')].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0);
                return Math.max(...xs.map((r) => r.right)) - Math.min(...xs.map((r) => r.left));
            });
            c.check(`${tag} · ${label} : partie lancée sur toute la largeur`, !!room && spread > w * 0.7);
            await p.screenshot({ path: path.join(t.OUT, `partie-large-${tag}-${type}.png`) });
            // Table agrandie : un clic sur la pioche fait bien piocher (Hezz2, c'est à moi de jouer)
            if (type === 'hezz2' && room) {
                const me = room.activePlayers.findIndex((x) => x.name === `${tag}${type}`.slice(0, 16));
                const before = room.gameState.hands[me].length;
                await p.locator('text=PIOCHER >> visible=true').first().click();
                await t.sleep(1500);
                c.check(`${tag} · Hezz2 : clic sur la pioche`, room.gameState.hands[me].length === before + 1);
            }
        }
    }
    // Salon privé sur ordinateur : toute la largeur, invitation à gauche, joueurs à droite, sans colonne de navigation
    const r = await t.app.progress.register({ name: 'Salonpc', password: 'secret12' });
    const p = await t.page(await t.context({ token: r.token, width: 1440, height: 900 }));
    await p.goto(t.url);
    await t.sleep(4000);
    await p.locator('[aria-label="Entre amis"] >> visible=true').first().click({ force: true });
    await t.sleep(3000);
    const txt = await t.text(p);
    const back = await p.evaluate(() => document.querySelector('[aria-label="Retour"]')?.getBoundingClientRect().left ?? 999);
    const side = await p.locator('[aria-label="Collection"] >> visible=true').count();
    c.check('salon privé : large, sans colonne de navigation', /INVITE TES AMIS/.test(txt) && /JOUEURS/.test(txt) && back < 100 && side === 0);
    await p.screenshot({ path: path.join(t.OUT, 'salon-large.png') });
    await t.close();
    process.exit(c.ok ? 0 : 1);
})().catch((e) => { console.error('ERREUR', e.message.split('\n')[0]); process.exit(1); });
