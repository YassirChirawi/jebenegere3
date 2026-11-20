// Discord : page servie sous <id>.discordsays.com, serveur joint par /server ; SDK chargé seulement là
const { setup, createChecker } = require('./helpers');

(async () => {
    const t = await setup();
    const c = createChecker('discord');
    const p = await t.page(await t.context());
    const urls = [];
    p.on('request', (r) => urls.push(r.url()));
    await p.goto(`${t.discordUrl}/?instance_id=i-test&frame_id=x&platform=desktop`);
    await t.sleep(6000);
    c.check('aucune requête directe vers le serveur de jeu', !urls.some((u) => /onrender|localhost:3000/.test(u)));
    c.check('serveur joint par /server', t.stats.proxied > 0 && urls.some((u) => u.includes('/server/socket.io')));
    c.check('SDK Discord dans un fichier à part', new Set(urls.filter((u) => /_expo\/static\/js\/web\//.test(u))).size === 2);
    c.check('accueil affiché sans la présentation', /Modes de jeu/.test(await t.text(p)) && !/Bienvenue sur L'Carta/.test(await t.text(p)));

    const p2 = await t.page(await t.context());
    const u2 = [];
    p2.on('request', (r) => u2.push(r.url()));
    await p2.goto(t.url);
    await t.sleep(3000);
    c.check('hors Discord : pas de SDK', new Set(u2.filter((u) => /_expo\/static\/js\/web\//.test(u))).size === 1);
    // Compte créé dans Discord → relié au compte L'Carta « Karima » depuis le Profil
    await t.app.progress.register({ name: 'Karima', password: 'motdepasse' });
    const d = await t.app.progress.discordLogin({ id: '123123123123', username: 'kar', global_name: 'Kari' });
    const p3 = await t.page(await t.context({ token: d.token }));
    await p3.goto(t.url);
    await t.sleep(4000);
    await p3.locator('[aria-label="Profil"]').last().click({ force: true });
    await t.sleep(2000);
    c.check('profil : proposition de relier le compte', /Relier à mon compte L'Carta/.test(await t.text(p3)));
    await p3.locator("[aria-label=\"Pseudo du compte L'Carta\"]").fill('Karima');
    await p3.locator("[aria-label=\"Mot de passe du compte L'Carta\"]").fill('motdepasse');
    await p3.locator('text=/Relier mes comptes/').click();
    await t.sleep(600);
    await p3.locator('text=/^Relier$/').last().click();
    await t.sleep(2500);
    const txt = await t.text(p3);
    c.check('comptes reliés : on joue avec « Karima »', /Comptes reliés/.test(txt) && /Karima/.test(txt));
    const back = await t.app.progress.discordLogin({ id: '123123123123', username: 'kar' });
    c.check('ensuite, Discord ouvre le compte Karima', back.profile.name === 'Karima');
    await t.close();
    process.exit(c.ok ? 0 : 1);
})().catch((e) => { console.error('ERREUR', e.message.split('\n')[0]); process.exit(1); });
