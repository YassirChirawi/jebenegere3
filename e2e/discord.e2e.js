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
    await t.close();
    process.exit(c.ok ? 0 : 1);
})().catch((e) => { console.error('ERREUR', e.message.split('\n')[0]); process.exit(1); });
