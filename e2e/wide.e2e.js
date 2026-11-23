// Ordinateur et tablette : chaque écran de menu prend toute la largeur, navigation dans la colonne de gauche.
// Captures dans e2e/.shots (large-*.png, tablette-*.png)
const path = require('path');
const { setup, createChecker } = require('./helpers');

(async () => {
    const t = await setup();
    const c = createChecker('grand écran');
    const reg = await t.app.progress.register({ name: 'Yassir', password: 'secret12' });

    // Ordinateur 1440 x 900 : on passe d'un écran à l'autre par la colonne de gauche
    const p = await t.page(await t.context({ token: reg.token, width: 1440, height: 900 }));
    const shot = (n) => p.screenshot({ path: path.join(t.OUT, `large-${n}.png`) });
    // Cadre de l'appli sur toute la fenêtre (pas le « téléphone » de 500 px centré) : le bouton Retour est collé à gauche
    const frameW = () => p.evaluate(() => {
        const b = document.querySelector('[aria-label="Retour"]');
        return b ? window.innerWidth - 2 * b.getBoundingClientRect().left : 0;
    });
    await p.goto(t.url);
    await t.sleep(4500);
    for (const [label, re, name] of [
        ['Collection', /Ma Collection/, 'collection'],
        ['Récompenses', /Chances de chaque lot/, 'roue'],
        ['Missions', /Défis du jour/, 'missions'],
        ['Classement', /Top 10/, 'classement'],
        ['Amis', /Ajouter un ami/, 'amis'],
        ['Profil', /Mon Profil/, 'profil'],
    ]) {
        await p.locator(`[aria-label="${label}"] >> visible=true`).first().click({ force: true });
        await t.sleep(1800);
        const txt = await t.text(p);
        const fw = await frameW();
        // La colonne de gauche reste là (Accueil, Classement, Amis) sur chaque écran
        const side = await p.locator('[aria-label="Accueil"]').count();
        c.check(`${name} : écran large avec la colonne de navigation`, re.test(txt) && fw > 1300 && side > 0);
        await shot(name);
    }
    // Collection : les objets sur plusieurs lignes de 5 ou plus
    await p.locator('[aria-label="Collection"] >> visible=true').first().click({ force: true });
    await t.sleep(1500);
    await p.locator('[aria-label="Dos"] >> visible=true').first().click({ force: true }).catch(() => {});
    await t.sleep(1200);
    await shot('collection-dos');
    // Retour à l'accueil par la colonne
    await p.locator('[aria-label="Accueil"] >> visible=true').first().click({ force: true });
    await t.sleep(1500);
    c.check('accueil depuis la colonne', /Modes de jeu/.test(await t.text(p)));
    // Pages légales et tournois (hors navigation) : aussi en large
    await p.locator('[aria-label="Tournois"] >> visible=true').first().click({ force: true }).catch(() => {});
    await t.sleep(1800);
    c.check('tournois : en large', /MES TOURNOIS/.test(await t.text(p)) && (await frameW()) > 1300);
    await shot('tournois');

    // Tablette en paysage (1024 x 768) et en portrait (768 x 1024)
    const tl = await t.page(await t.context({ token: reg.token, width: 1024, height: 768 }));
    await tl.goto(t.url);
    await t.sleep(4500);
    await tl.locator('[aria-label="Missions"] >> visible=true').first().click({ force: true });
    await t.sleep(1800);
    c.check('tablette paysage : missions avec la colonne', /Défis du jour/.test(await t.text(tl)) && (await tl.locator('[aria-label="Classement"]').count()) > 0);
    await tl.screenshot({ path: path.join(t.OUT, 'tablette-paysage-missions.png') });
    const tp = await t.page(await t.context({ token: reg.token, width: 768, height: 1024 }));
    await tp.goto(t.url);
    await t.sleep(4500);
    const right = await tp.evaluate(() => Math.max(...[...document.querySelectorAll('[aria-label="Profil"]')].map((e) => e.getBoundingClientRect().right)));
    c.check('tablette portrait : toute la largeur', right > 700);
    await tp.screenshot({ path: path.join(t.OUT, 'tablette-portrait-accueil.png') });

    await t.close();
    process.exit(c.ok ? 0 : 1);
})().catch((e) => { console.error('ERREUR', e.message.split('\n')[0]); process.exit(1); });
