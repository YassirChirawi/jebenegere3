// Langues : choix dans les réglages (Profil → ⚙️), accueil et partie en anglais, mots du jeu gardés, retour au français
const path = require('path');
const { setup, createChecker } = require('./helpers');

(async () => {
    const t = await setup();
    const c = createChecker('langues');
    const reg = await t.app.progress.register({ name: 'Amal', password: 'secret12' });
    const p = await t.page(await t.context({ token: reg.token }));
    const home = async () => { await p.goto(t.url); await t.sleep(4000); };
    const pick = async (label) => {
        await p.locator('[aria-label="Profil"], [aria-label="Profile"]').last().click({ force: true });
        await t.sleep(1500);
        await p.locator('[aria-label="Style et réglages"], [aria-label="Style and settings"]').first().click({ force: true });
        await t.sleep(800);
        await p.locator('text=/Réglages|Settings/').last().click().catch(() => {});
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
    // Une partie en anglais : plateau et messages de jeu traduits
    await p.locator('[aria-label="Solo"]').first().click({ force: true });
    await t.sleep(1200);
    await p.locator('[aria-label="2 players"]').first().click({ force: true });
    await t.sleep(4500);
    const g = await t.text(p);
    c.check('anglais : partie traduite', /YOUR TURN|DRAW|Your turn|You ·|Draw/.test(g) && !/PIOCHER|À TOI DE JOUER/.test(g));
    await p.screenshot({ path: path.join(t.OUT, 'partie-en.png') });
    // Missions en anglais : les mots du jeu restent en darija (Ronda, Kdoub, Sota, binga)
    await home();
    await p.locator('[aria-label="Missions"] >> visible=true').last().click({ force: true });
    await t.sleep(1800);
    txt = await t.text(p);
    c.check('anglais : missions traduites, mots du jeu gardés', /Daily reward|Missions/.test(txt) && /Ronda|Kdoub|Sota/.test(txt) && !/Récompense quotidienne/.test(txt));
    await p.screenshot({ path: path.join(t.OUT, 'missions-en.png') });
    // Plus de darija dans le choix des langues
    await p.locator('[aria-label="Profile"] >> visible=true').last().click({ force: true });
    await t.sleep(1500);
    await p.locator('[aria-label="Style and settings"] >> visible=true').first().click({ force: true });
    await t.sleep(800);
    await p.locator('text=/Settings/').last().click().catch(() => {});
    await t.sleep(500);
    c.check('pas de choix « Darija »', (await p.locator('[aria-label="Darija"]').count()) === 0 && (await p.locator('[aria-label="Français"]').count()) > 0);
    await home();
    await pick('Français');
    await home();
    c.check('retour au français', /Modes de jeu/.test(await t.text(p)));
    await t.close();
    process.exit(c.ok ? 0 : 1);
})().catch((e) => { console.error('ERREUR', e.message.split('\n')[0]); process.exit(1); });
