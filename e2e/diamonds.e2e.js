// Diamants : packs, page de paiement (Stripe simulé), retour sur le site, crédit par webhook signé
process.env.STRIPE_SECRET_KEY = 'sk_test_e2e';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_e2e';
const crypto = require('crypto');
const path = require('path');
const { setup, createChecker } = require('./helpers');

(async () => {
    const t = await setup();
    const c = createChecker('diamants');
    const payments = require(path.join(__dirname, '..', 'server', 'payments'));
    // « Stripe » : la page de paiement renvoie directement sur le site, comme après un paiement réussi
    payments.setFetch(async () => ({ ok: true, json: async () => ({ id: 'cs_e2e', url: `${t.url}/?paiement=ok` }) }));
    const reg = await t.app.progress.register({ name: 'Sofia', password: 'secret12' });
    const userId = (await t.app.progress.userFromToken(reg.token)).id;
    const p = await t.page(await t.context({ token: reg.token }));
    await p.goto(t.url);
    await t.sleep(4000);
    await p.locator('[aria-label="Collection"]').last().click({ force: true });
    await t.sleep(1500);
    await p.locator('[aria-label="Diamants"]').first().click({ force: true });
    await t.sleep(1500);
    const txt = await t.text(p);
    c.check('packs de 0,99 € à 20,99 €', /0,99 €/.test(txt) && /20,99 €/.test(txt) && /Fortune du Sultan/.test(txt));
    await p.locator('text=/^0,99 €$/').first().click();
    await t.sleep(700);
    c.check('conditions avant de payer (rétractation, parents)', /renonces au droit de rétractation/.test(await t.text(p)) && /moins de 18 ans/.test(await t.text(p)));
    await p.locator('text=/^Payer 0,99 €$/').last().click();
    await t.sleep(4000);
    c.check('retour sur le site : merci', /Merci/.test(await t.text(p)));

    // Stripe confirme : webhook signé → 80 diamants, solde mis à jour en direct
    const body = JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: 'cs_e2e', payment_status: 'paid', amount_total: 99, payment_intent: 'pi_e2e', client_reference_id: userId, metadata: { userId, pack: 'poignee' } } } });
    const ts = Math.floor(Date.now() / 1000);
    const sig = crypto.createHmac('sha256', 'whsec_e2e').update(`${ts}.${body}`).digest('hex');
    const res = await fetch('http://localhost:3000/api/pay/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': `t=${ts},v1=${sig}` }, body });
    c.check('webhook accepté', res.status === 200);
    await t.sleep(1500);
    await p.locator('text=/^OK$/').last().click().catch(() => {});
    await t.sleep(800); // (la fenêtre se ferme en fondu)
    await p.locator('[aria-label="Collection"]').last().click({ force: true });
    await t.sleep(1800);
    c.check('solde : 80 diamants', (await p.locator('[aria-label="Diamants : 80"]').count()) > 0);
    await p.screenshot({ path: path.join(t.OUT, 'diamants.png') });
    await t.close();
    process.exit(c.ok ? 0 : 1);
})().catch((e) => { console.error('ERREUR', e.message.split('\n')[0]); process.exit(1); });
