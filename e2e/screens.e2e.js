// Accueil, partie solo, et tous les écrans par la barre du bas ; accueil en paysage. Captures dans e2e/.shots
const path = require('path');
const { setup, createChecker } = require('./helpers');

(async () => {
    const t = await setup();
    const c = createChecker('écrans');
    const reg = await t.app.progress.register({ name: 'Yassir', password: 'secret12' });
    const p = await t.page(await t.context({ token: reg.token }));
    const shot = (n) => p.screenshot({ path: path.join(t.OUT, `${n}.png`) });
    const home = async () => { await p.goto(t.url); await t.sleep(4000); };
    const tap = async (label, last = false) => { const l = p.locator(`[aria-label="${label}"]`); await (last ? l.last() : l.first()).click({ force: true }); await t.sleep(1800); };

    await home();
    c.check('accueil : carte du joueur et modes de jeu', /Yassir/.test(await t.text(p)) && /Modes de jeu/.test(await t.text(p)));
    await shot('accueil');
    await tap('Solo');
    c.check('Solo : choix du nombre de joueurs', /Choisis le nombre de joueurs/.test(await t.text(p)));
    await tap('2 joueurs');
    await t.sleep(2000);
    const room = Object.values(t.app.rooms).find((r) => r.activePlayers.some((x) => x.name === 'Yassir'));
    c.check('partie solo lancée', !!room && room.isBotMatch && room.activePlayers.length === 2);
    await shot('partie');

    for (const [label, re, name] of [
        ['Collection', /Ma Collection/, 'collection'],
        ['Récompenses', /Roue du jour/, 'roue'],
        ['Missions', /Récompense quotidienne/, 'missions'],
        ['Profil', /Mon Profil/, 'profil'],
    ]) {
        await home();
        await tap(label, true);
        c.check(`barre du bas → ${name}`, re.test(await t.text(p)));
        await shot(name);
    }
    await home();
    await tap('Classement');
    c.check('classement', /Classement/.test(await t.text(p)));
    await home();
    await tap('Tournois');
    c.check('tournois', /Créer un tournoi/i.test(await t.text(p)));

    // Paysage (ordinateur) : 3 colonnes sur toute la largeur
    const l = await t.page(await t.context({ token: reg.token, width: 1280, height: 720 }));
    await l.goto(t.url);
    await t.sleep(4500);
    const width = await l.evaluate(() => document.querySelector('[aria-label="Solo"]')?.getBoundingClientRect().width || 0);
    c.check('paysage : navigation, modes et saison', /Accueil/.test(await t.text(l)) && /Saison/.test(await t.text(l)) && width > 100);
    await l.screenshot({ path: path.join(t.OUT, 'paysage.png') });
    await t.close();
    process.exit(c.ok ? 0 : 1);
})().catch((e) => { console.error('ERREUR', e.message.split('\n')[0]); process.exit(1); });
