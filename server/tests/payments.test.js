// Diamants : packs, paiement Stripe (page de paiement, webhook signé, remboursement), achats en diamants
process.env.STORE = 'memory';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const app = require('../server');
const payments = require('../payments');
const { COSMETICS, DIAMOND_PACKS } = require('../progress/defs');
const { createProgress } = require('../progress/progress');
const { memoryStore } = require('../progress/store');

let URL;
test.before(async () => { URL = `http://localhost:${await app.start(0)}`; });
test.after(async () => {
    payments.setFetch(null);
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    await app.stop();
});

const SECRET = 'whsec_test';
const sign = (body, t = Math.floor(Date.now() / 1000), secret = SECRET) => `t=${t},v1=${crypto.createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;
const hook = (body, sig) => fetch(`${URL}/api/pay/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': sig }, body });
const call = (path, token, body) => fetch(URL + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), Origin: 'https://www.jebengere3.fun' },
    body: body ? JSON.stringify(body) : undefined,
}).then(async (r) => ({ status: r.status, ...(await r.json()) }));

test('packs de 0,99 € à 20,99 € ; jamais de binga ni de coffre contre des diamants', () => {
    assert.equal(DIAMOND_PACKS[0].cents, 99);
    assert.equal(DIAMOND_PACKS[DIAMOND_PACKS.length - 1].cents, 2099);
    for (let i = 1; i < DIAMOND_PACKS.length; i++) assert.ok(DIAMOND_PACKS[i].cents > DIAMOND_PACKS[i - 1].cents);
});

test('signature du webhook : bonne, fausse, trop vieille', () => {
    const body = JSON.stringify({ id: 'evt_1' });
    assert.ok(payments.verifyWebhook(body, sign(body), { secret: SECRET }));
    assert.equal(payments.verifyWebhook(body, sign(body, undefined, 'autre'), { secret: SECRET }), null);
    assert.equal(payments.verifyWebhook(`${body} `, sign(body), { secret: SECRET }), null, 'corps modifié');
    assert.equal(payments.verifyWebhook(body, sign(body, Math.floor(Date.now() / 1000) - 3600), { secret: SECRET }), null, 'rejoué une heure plus tard');
    assert.equal(payments.form({ a: { b: { c: 1 } } }).toString(), 'a%5Bb%5D%5Bc%5D=1');
});

test('achat en diamants : prix par rareté, légendaires refusés, solde vérifié', async () => {
    const p = createProgress(memoryStore());
    const r = await p.register({ name: 'Rania', password: 'secret12' });
    const u = await p.userFromToken(r.token);
    await p.creditPurchase(u.id, { sessionId: 'cs_1', packId: 'bourse' });
    assert.equal((await p.profile(u)).diamonds.balance, 270);
    const epic = COSMETICS.find((c) => c.rarity === 'epique' && !c.source);
    const leg = COSMETICS.find((c) => c.rarity === 'legendaire');
    assert.ok((await p.buy(u, epic.id, Date.now(), 'diamonds')).success);
    const prof = await p.profile(u);
    assert.equal(prof.diamonds.balance, 70);
    assert.ok(prof.unlocks.includes(epic.id));
    assert.equal(prof.binga.balance, 0, 'le binga n\'a pas bougé');
    assert.match((await p.buy(u, leg.id, Date.now(), 'diamonds')).error, /coffre Or/);
    const rare = COSMETICS.find((c) => c.rarity === 'rare' && !c.source);
    assert.match((await p.buy(u, rare.id, Date.now(), 'diamonds')).error, /Il te manque 30 diamants/);
});

test('page de paiement : désactivée sans clés, puis Stripe appelé avec le bon pack', async () => {
    const r = await app.progress.register({ name: 'Walid', password: 'secret12' });
    assert.equal((await call('/api/pay/packs')).enabled, false);
    assert.equal((await call('/api/pay/checkout', r.token, { pack: 'tresor', acceptTerms: true })).status, 503);

    process.env.STRIPE_SECRET_KEY = 'sk_test_x';
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    const calls = [];
    payments.setFetch(async (url, opts) => {
        calls.push({ url, body: new URLSearchParams(opts.body || '') });
        return { ok: true, json: async () => ({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' }) };
    });
    assert.equal((await call('/api/pay/checkout', r.token, { pack: 'tresor' })).status, 400, 'conditions à accepter');
    assert.equal((await call('/api/pay/checkout', r.token, { pack: 'inconnu', acceptTerms: true })).status, 400);
    assert.equal((await call('/api/pay/checkout', null, { pack: 'tresor', acceptTerms: true })).status, 401);
    const ok = await call('/api/pay/checkout', r.token, { pack: 'tresor', acceptTerms: true });
    assert.equal(ok.url, 'https://checkout.stripe.com/c/pay/cs_test_1');
    const b = calls[0].body;
    assert.equal(b.get('line_items[0][price_data][unit_amount]'), '999');
    assert.equal(b.get('line_items[0][price_data][currency]'), 'eur');
    assert.equal(b.get('metadata[pack]'), 'tresor');
    assert.match(b.get('success_url'), /^https:\/\/www\.jebengere3\.fun\/\?paiement=ok/);
});

test('webhook : diamants crédités une seule fois, puis retirés au remboursement', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    const r = await app.progress.register({ name: 'Ilyas', password: 'secret12' });
    const userId = (await app.progress.userFromToken(r.token)).id;
    const event = JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: 'cs_live_9', payment_status: 'paid', amount_total: 499, payment_intent: 'pi_9', client_reference_id: userId, metadata: { userId, pack: 'coffret' } } } });

    assert.equal((await hook(event, 'faux')).status, 400);
    assert.equal((await hook(event, sign(event))).status, 200);
    assert.equal((await hook(event, sign(event))).status, 200, 'Stripe peut renvoyer le même événement');
    let me = await call('/api/me', r.token);
    assert.equal(me.profile.diamonds.balance, 500, '450 + 50 offerts, crédités une seule fois');

    payments.setFetch(async () => ({ ok: true, json: async () => ({ id: 'pi_9', metadata: { userId, pack: 'coffret' } }) }));
    const refund = JSON.stringify({ type: 'charge.refunded', data: { object: { payment_intent: 'pi_9', amount_refunded: 499 } } });
    assert.equal((await hook(refund, sign(refund))).status, 200);
    me = await call('/api/me', r.token);
    assert.equal(me.profile.diamonds.balance, 0);
});
