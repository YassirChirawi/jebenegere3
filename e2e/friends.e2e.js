// Amis : Nadia ajoute Omar, Omar accepte ; Nadia crée un salon et invite Omar, qui rejoint depuis la carte d'invitation
const { setup, createChecker } = require('./helpers');

(async () => {
    const t = await setup();
    const c = createChecker('amis');
    const a = await t.app.progress.register({ name: 'Nadia', password: 'secret12' });
    const b = await t.app.progress.register({ name: 'Omar', password: 'secret12' });
    const pa = await t.page(await t.context({ token: a.token }));
    const pb = await t.page(await t.context({ token: b.token }));
    await pa.goto(t.url);
    await pb.goto(t.url);
    await t.sleep(4000);

    await pa.locator('[aria-label="Amis"]').first().click({ force: true });
    await t.sleep(1500);
    await pa.locator('[aria-label="Pseudo de l\'ami"]').fill('Omar');
    await pa.locator('text=/^Ajouter$/').click();
    await t.sleep(1500);
    c.check('demande envoyée', /Demande envoyée à Omar/.test(await t.text(pa)));

    await pb.locator('[aria-label="Amis"]').first().click({ force: true });
    await t.sleep(1500);
    c.check('Omar voit la demande de Nadia', /Demandes reçues/.test(await t.text(pb)) && /Nadia/.test(await t.text(pb)));
    await pb.locator('text=/^✓$/').first().click();
    await t.sleep(1500);
    c.check('amis : Nadia en ligne chez Omar', /Mes amis/.test(await t.text(pb)) && /en ligne/.test(await t.text(pb)));
    await pb.locator('[aria-label="Accueil"]').last().click({ force: true });
    await t.sleep(1500);

    // Nadia crée un salon et invite Omar
    await pa.goto(t.url);
    await t.sleep(3500);
    await pa.locator('[aria-label="Entre amis"]').first().click({ force: true });
    await t.sleep(2000);
    await pa.locator('text=/Inviter un ami/').first().click();
    await t.sleep(1500);
    await pa.locator('text=/^Inviter$/').first().click();
    await t.sleep(1500);
    c.check('invitation envoyée', /Invitation envoyée/.test(await t.text(pa)));
    c.check('Omar reçoit « Nadia t\'invite »', await t.waitText(pb, /Nadia t'invite/, 4000));
    await pb.locator('text=/Rejoindre$/').last().click();
    await t.sleep(3500);
    const room = Object.values(t.app.rooms).find((r) => r.activePlayers.some((p) => p.name === 'Nadia'));
    c.check('Omar est dans le salon de Nadia', !!room && room.activePlayers.some((p) => p.name === 'Omar'));
    await t.close();
    process.exit(c.ok ? 0 : 1);
})().catch((e) => { console.error('ERREUR', e.message.split('\n')[0]); process.exit(1); });
