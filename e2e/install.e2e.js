// Installer le jeu depuis le site (sans les stores) : bouton sur l'accueil, en large comme sur téléphone,
// et fichier d'installation complet (icônes + captures pour la fenêtre d'installation de Chrome).
const path = require('path');
const { setup, createChecker } = require('./helpers');

// Chrome sans fenêtre ne propose jamais l'installation : on simule la proposition du navigateur
async function fakePrompt(p) {
    await p.evaluate(() => {
        window.__installPrompt = { prompt() { window.__prompted = true; }, userChoice: Promise.resolve({ outcome: 'accepted' }) };
        window.dispatchEvent(new Event('jg3-installable'));
    });
}

(async () => {
    const t = await setup();
    const c = createChecker('installer');
    const reg = await t.app.progress.register({ name: 'Installe', password: 'secret12' });

    // Fichier d'installation : icônes et captures présentes sur le site
    const p0 = await t.page(await t.context({ token: reg.token }));
    await p0.goto(t.url);
    const manifest = await p0.evaluate(() => fetch('/manifest.webmanifest').then((r) => r.json()));
    const shots = manifest.screenshots || [];
    const sizes = await p0.evaluate((list) => Promise.all(list.map((s) => fetch(s.src).then((r) => r.ok ? r.blob() : null).then((b) => b && createImageBitmap(b)).then((i) => (i ? `${i.width}x${i.height}` : null)))), shots);
    c.check('fichier d\'installation : captures larges et téléphone', shots.some((s) => s.form_factor === 'wide') && shots.some((s) => s.form_factor === 'narrow'));
    c.check('captures : chaque image existe à la taille annoncée', shots.length > 0 && shots.every((s, i) => sizes[i] === s.sizes));

    for (const [w, h, tag] of [[1440, 900, 'pc'], [390, 844, 'telephone']]) {
        const p = await t.page(await t.context({ token: reg.token, width: w, height: h }));
        await p.goto(t.url);
        await t.sleep(4500);
        const btn = p.locator('[aria-label="Installer L\'Carta"] >> visible=true');
        c.check(`${tag} : pas de bouton tant que le navigateur ne propose rien`, (await btn.count()) === 0);
        await fakePrompt(p);
        await t.sleep(500);
        if (tag === 'telephone') await btn.first().scrollIntoViewIfNeeded().catch(() => {});
        c.check(`${tag} : bouton « Installer l'appli » affiché`, (await btn.count()) === 1);
        await p.screenshot({ path: path.join(t.OUT, `installer-${tag}.png`) });
        await btn.first().click({ force: true });
        await t.sleep(600);
        c.check(`${tag} : la fenêtre d'installation du navigateur s'ouvre, puis le bouton disparaît`, (await p.evaluate(() => !!window.__prompted)) && (await btn.count()) === 0);
    }
    await t.close();
    process.exit(c.ok ? 0 : 1);
})().catch((e) => { console.error('ERREUR', e.message.split('\n')[0]); process.exit(1); });
