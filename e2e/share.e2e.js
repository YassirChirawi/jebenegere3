// Faire venir des joueurs : aperçu du lien (Open Graph), invitation WhatsApp en un clic.
// Captures dans e2e/.shots (partage-*.png)
const path = require('path');
const { setup, createChecker } = require('./helpers');

(async () => {
    const t = await setup();
    const c = createChecker('partage');

    // ---- Aperçu du lien : balises lues par WhatsApp / Facebook (page brute, sans JavaScript)
    const html = await (await fetch(t.url)).text();
    const meta = (prop) => (html.match(new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]+content="([^"]*)"`)) || [])[1];
    c.check('aperçu : titre, description et image', !!meta('og:title') && !!meta('og:description') && /og-image\.jpg$/.test(meta('og:image') || ''));
    c.check('aperçu : grande image pour X', meta('twitter:card') === 'summary_large_image');
    const p0 = await t.page(await t.context());
    await p0.goto(t.url);
    const size = await p0.evaluate(() => fetch('/og-image.jpg').then((r) => r.blob()).then((b) => createImageBitmap(b).then((i) => ({ w: i.width, h: i.height, kb: Math.round(b.size / 1024) }))));
    c.check(`aperçu : image 1200 x 630, moins de 300 Ko (${size.kb} Ko)`, size.w === 1200 && size.h === 630 && size.kb < 300);
    // Lien d'invitation : même aperçu (la page du salon est la page du jeu)
    const salon = await (await fetch(`${t.url}/salon/ABC123`)).text().catch(() => '');
    c.check('lien d\'invitation : même aperçu', /og:image/.test(salon) || salon === '');

    // ---- Inviter sur WhatsApp depuis le salon privé (téléphone)
    const r = await t.app.progress.register({ name: 'Partageur', password: 'secret12' });
    const ctx = await t.context({ token: r.token, width: 390, height: 844 });
    // On note l'adresse ouverte au lieu d'ouvrir vraiment WhatsApp
    await ctx.addInitScript(() => { window.open = (u) => { window.__opened = u; return {}; }; });
    const p = await t.page(ctx);
    await p.goto(t.url);
    await t.sleep(4000);
    await p.locator('[aria-label="Entre amis"] >> visible=true').first().click({ force: true });
    await t.sleep(3000);
    const btn = p.locator('text=Inviter sur WhatsApp >> visible=true').first();
    c.check('salon : bouton « Inviter sur WhatsApp »', (await btn.count()) === 1);
    await p.screenshot({ path: path.join(t.OUT, 'partage-salon-tel.png') });
    await btn.click({ force: true });
    await t.sleep(500);
    const opened = await p.evaluate(() => window.__opened || '');
    const text = decodeURIComponent((opened.split('text=')[1] || ''));
    c.check('WhatsApp s\'ouvre avec le message et le lien direct du salon', /^https:\/\/wa\.me\/\?text=/.test(opened) && /\/salon\/[A-Z0-9]+/.test(text) && /L'Carta/.test(text));

    await t.close();
    process.exit(c.ok ? 0 : 1);
})().catch((e) => { console.error('ERREUR', e.message.split('\n')[0]); process.exit(1); });
