// Langues : choix dans les réglages (Profil → ⚙️), accueil en anglais puis en darija, choix gardé au rechargement
const path = require('path');
const { setup, createChecker } = require('./helpers');

(async () => {
    const t = await setup();
    const c = createChecker('langues');
    const reg = await t.app.progress.register({ name: 'Amal', password: 'secret12' });
    const p = await t.page(await t.context({ token: reg.token }));
    const home = async () => { await p.goto(t.url); await t.sleep(4000); };
    const pick = async (label) => {
        await p.locator('[aria-label="Profil"], [aria-label="Profile"], [aria-label="Profil dyali"]').last().click({ force: true });
        await t.sleep(1500);
        await p.locator('[aria-label="Style et réglages"], [aria-label="Style and settings"], [aria-label="Style w réglages"]').first().click({ force: true });
        await t.sleep(800);
        await p.locator('text=/Réglages|Settings|Réglages/').last().click().catch(() => {});
        await t.sleep(500);
        await p.locator(`[aria-label="${label}"]`).first().click({ force: true });
        await t.sleep(2500);
    };

    await home();
    c.check('français par défaut', /Modes de jeu/.test(await t.text(p)));
    await pick('English');
    await home();
    let txt = await t.text(p);
    c.check('anglais : accueil traduit', /Game modes/.test(txt) && /With friends/.test(txt) && !/Modes de jeu/.test(txt));
    await p.screenshot({ path: path.join(t.OUT, 'accueil-en.png') });
    await pick('Darija');
    await home();
    txt = await t.text(p);
    c.check('darija : accueil traduit', /Anwa3 l-l3ib/.test(txt) && /M3a s7ab/.test(txt));
    await p.screenshot({ path: path.join(t.OUT, 'accueil-dar.png') });
    await p.locator('[aria-label="Missions"]').last().click({ force: true });
    await t.sleep(1800);
    c.check('darija : missions traduites (y compris celles du serveur)', /Hdiya dyal kol nhar/.test(await t.text(p)) && /L3eb 3 parties/.test(await t.text(p)));
    await p.screenshot({ path: path.join(t.OUT, 'missions-dar.png') });
    await pick('Français');
    await home();
    c.check('retour au français', /Modes de jeu/.test(await t.text(p)));
    await t.close();
    process.exit(c.ok ? 0 : 1);
})().catch((e) => { console.error('ERREUR', e.message.split('\n')[0]); process.exit(1); });
