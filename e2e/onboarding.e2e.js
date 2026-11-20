// Premier lancement : 4 écrans, pseudo, première partie contre l'ordinateur ; pas revu ensuite
const { setup, createChecker } = require('./helpers');

(async () => {
    const t = await setup();
    const c = createChecker('premier lancement');
    const p = await t.page(await t.context({ fresh: true, width: 420, height: 880 }));
    await p.goto(t.url);
    c.check('écran 1 : bienvenue', await t.waitText(p, /Bienvenue sur L'Carta/));
    c.check('pas de fenêtre du jour ni de règles par-dessus', !/Crée ton compte, c'est gratuit|Règles du/.test(await t.text(p)));
    for (const [n, re] of [[2, /même en perdant/], [3, /Coffres, roue et boutique/], [4, /À toi de jouer/]]) {
        await p.locator('text=/^Suivant$/ >> visible=true').first().click();
        await t.sleep(700);
        c.check(`écran ${n}`, re.test(await t.text(p)));
    }
    // (la case pseudo et les onglets de jeu existent aussi sur l'accueil, derrière : on prend ceux de la présentation)
    await p.locator('[aria-label="Ton pseudo"] >> visible=true').last().fill('Nadia');
    await p.locator('text=/^Ronda$/ >> visible=true').last().click();
    await t.sleep(300);
    await p.locator('text=/Jouer · Ronda/ >> visible=true').first().click();
    await t.sleep(4000);
    const room = Object.values(t.app.rooms).find((r) => r.activePlayers.some((x) => x.name === 'Nadia'));
    c.check('première partie : Ronda contre l\'ordinateur, 1 contre 1', !!room && room.gameType === 'ronda' && room.activePlayers.length === 2);
    await p.goto(t.url);
    await t.sleep(4500);
    const kept = await p.locator('[aria-label="Ton pseudo"]').first().inputValue().catch(() => '');
    c.check('relancement : plus de présentation, pseudo gardé', !/Bienvenue sur L'Carta/.test(await t.text(p)) && kept === 'Nadia');
    await t.close();
    process.exit(c.ok ? 0 : 1);
})().catch((e) => { console.error('ERREUR', e.message.split('\n')[0]); process.exit(1); });
