// Installer le jeu depuis le site (sans les stores) : grande fenêtre « Installe L'Carta » (au plus tous les 3 jours),
// bouton sur l'accueil, en large comme sur téléphone, et fichier d'installation complet
// (icônes + captures pour la fenêtre d'installation de Chrome).
// Captures dans e2e/.shots (installer-*.png)
const path = require('path');
const { setup, createChecker } = require('./helpers');

// Chrome sans fenêtre ne propose jamais l'installation : on simule la proposition du navigateur
async function fakePrompt(p) {
    await p.evaluate(() => {
        window.__installPrompt = { prompt() { window.__prompted = true; }, userChoice: Promise.resolve({ outcome: 'accepted' }) };
        window.dispatchEvent(new Event('jg3-installable'));
    });
}

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const DAY = 24 * 3600 * 1000;

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
        const ctx = await t.context({ token: reg.token, width: w, height: h });
        const p = await t.page(ctx);
        const popup = p.locator('[aria-label="Installe L\'Carta"] >> visible=true');
        const btn = p.locator('[aria-label="Installer L\'Carta"] >> visible=true');
        await p.goto(t.url);
        await t.sleep(4500);
        c.check(`${tag} : ni fenêtre ni bouton tant que le navigateur ne propose rien`, (await btn.count()) === 0 && (await popup.count()) === 0);

        // 1re visite : la grande fenêtre s'ouvre
        await fakePrompt(p);
        await t.sleep(2000);
        const txt = await t.text(p);
        c.check(`${tag} : grande fenêtre « Installe L'Carta » (avantages, captures, lien confidentialité)`,
            (await popup.count()) === 1 && /meilleure expérience/.test(txt) && /Plein écran/.test(txt) && /Politique de confidentialité/.test(txt)
            && (await p.locator('img[src*="/screenshots/"]').count()) > 0);
        await p.screenshot({ path: path.join(t.OUT, `installer-fenetre-${tag}.png`) });

        // « Plus tard » : fermée, le bouton de l'accueil reste
        await p.locator('text=Plus tard >> visible=true').first().click();
        await t.sleep(800);
        if (tag === 'telephone') await btn.first().scrollIntoViewIfNeeded().catch(() => {});
        c.check(`${tag} : « Plus tard » ferme la fenêtre, le bouton reste sur l'accueil`, (await popup.count()) === 0 && (await btn.count()) === 1);
        await p.screenshot({ path: path.join(t.OUT, `installer-${tag}.png`) });

        // Revenir le lendemain : pas de fenêtre (moins de 3 jours)
        await p.evaluate((d) => localStorage.setItem('installPromptAt', String(Date.now() - d)), DAY);
        await p.reload();
        await t.sleep(4000);
        await fakePrompt(p);
        await t.sleep(2000);
        c.check(`${tag} : pas de nouvelle fenêtre avant 3 jours`, (await popup.count()) === 0 && (await btn.count()) === 1);

        // 3 jours après : la fenêtre revient ; « Installer » ouvre l'installation du navigateur, puis tout disparaît
        await p.evaluate((d) => localStorage.setItem('installPromptAt', String(Date.now() - d)), 3 * DAY + 60000);
        await p.reload();
        await t.sleep(4000);
        await fakePrompt(p);
        await t.sleep(2000);
        c.check(`${tag} : la fenêtre revient au bout de 3 jours`, (await popup.count()) === 1);
        await popup.locator('text=Installer >> visible=true').first().click();
        await t.sleep(1000);
        c.check(`${tag} : « Installer » ouvre l'installation du navigateur, fenêtre et bouton disparaissent`,
            (await p.evaluate(() => !!window.__prompted)) && (await popup.count()) === 0 && (await btn.count()) === 0);
        await ctx.close();
    }

    // iPhone (Safari) : pas d'installation par un site, la fenêtre montre les 3 gestes
    const pi = await t.page(await t.context({ token: reg.token, width: 390, height: 844, userAgent: IPHONE }));
    await pi.goto(t.url);
    await t.sleep(5000);
    const ti = await t.text(pi);
    c.check('iPhone : la fenêtre explique Partager → écran d\'accueil → Ajouter', /Installe L'Carta/.test(ti) && /Partager/.test(ti) && /Ajouter/.test(ti) && /J'ai compris/.test(ti));
    await pi.screenshot({ path: path.join(t.OUT, 'installer-fenetre-iphone.png') });
    await pi.locator("text=J'ai compris >> visible=true").first().click();
    await t.sleep(800);
    c.check('iPhone : « J\'ai compris » ferme la fenêtre', !/Touche « Ajouter »/.test(await t.text(pi)));

    // Dans Discord : jamais de fenêtre d'installation
    const pd = await t.page(await t.context({ token: reg.token, userAgent: IPHONE }));
    await pd.goto(t.discordUrl);
    await t.sleep(5000);
    c.check('Discord : pas de fenêtre d\'installation', !/Installe L'Carta/.test(await t.text(pd)));

    await t.close();
    process.exit(c.ok ? 0 : 1);
})().catch((e) => { console.error('ERREUR', e.message.split('\n')[0]); process.exit(1); });
