/**
 * Paiements Stripe (achat de diamants sur le site).
 *
 * - STRIPE_SECRET_KEY : clé secrète du compte Stripe de Yassir (dans Render, jamais dans le dépôt).
 * - STRIPE_WEBHOOK_SECRET : secret de signature du webhook (Stripe → Développeurs → Webhooks).
 *
 * Le joueur paie sur la page Stripe (Checkout). Les diamants sont crédités seulement quand Stripe
 * confirme le paiement par un webhook signé (jamais sur la parole de l'appli).
 * Pas de SDK : deux appels REST et la vérification HMAC de la signature.
 */
const crypto = require('crypto');

const API = 'https://api.stripe.com/v1';
let fetchImpl = (...args) => fetch(...args);
function setFetch(fn) { fetchImpl = fn || ((...args) => fetch(...args)); }

const configured = () => !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET;

// Corps « application/x-www-form-urlencoded » à la manière de Stripe (clés imbriquées : a[b][c])
function form(obj, prefix = '', out = new URLSearchParams()) {
    for (const [k, v] of Object.entries(obj)) {
        const key = prefix ? `${prefix}[${k}]` : k;
        if (v === undefined || v === null) continue;
        if (typeof v === 'object') form(v, key, out);
        else out.append(key, String(v));
    }
    return out;
}

async function stripe(path, { method = 'GET', body } = {}) {
    const res = await fetchImpl(`${API}${path}`, {
        method,
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body ? form(body).toString() : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || `Stripe ${res.status}`);
    return data;
}

/** Page de paiement Stripe pour un pack ; renvoie { url } ou { error }. */
async function createCheckout({ user, pack, origin }) {
    if (!configured()) return { error: 'Le paiement n\'est pas encore activé.', status: 503 };
    try {
        const s = await stripe('/checkout/sessions', {
            method: 'POST',
            body: {
                mode: 'payment',
                client_reference_id: user.id,
                success_url: `${origin}/?paiement=ok`,
                cancel_url: `${origin}/?paiement=annule`,
                locale: 'auto',
                metadata: { userId: user.id, pack: pack.id },
                payment_intent_data: { metadata: { userId: user.id, pack: pack.id } },
                line_items: {
                    0: {
                        quantity: 1,
                        price_data: {
                            currency: 'eur',
                            unit_amount: pack.cents,
                            product_data: { name: `${pack.label} (${pack.diamonds + pack.bonus} diamants)`, description: "Diamants L'Carta : cosmétiques seulement, aucun avantage en partie." },
                        },
                    },
                },
            },
        });
        return { url: s.url, id: s.id };
    } catch (e) {
        console.error('[paiement] Checkout', e.message);
        return { error: 'Le paiement est indisponible pour l\'instant. Réessaie plus tard.', status: 502 };
    }
}

/** Vérifie l'en-tête Stripe-Signature (t=…,v1=…) sur le corps brut ; renvoie l'événement ou null. */
function verifyWebhook(rawBody, header, { secret = process.env.STRIPE_WEBHOOK_SECRET, tolerance = 300, now = Date.now() } = {}) {
    if (!secret || !header || !rawBody) return null;
    let t = 0;
    const sigs = [];
    for (const kv of String(header).split(',')) {
        const [k, v] = kv.split('=').map((x) => (x || '').trim());
        if (k === 't') t = Number(v);
        else if (k === 'v1' && v) sigs.push(v);
    }
    if (!t || !sigs.length || Math.abs(now / 1000 - t) > tolerance) return null;
    const expected = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
    const ok = sigs.some((s) => s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
    if (!ok) return null;
    try { return JSON.parse(String(rawBody)); } catch (e) { return null; }
}

/** Métadonnées (joueur, pack) d'un paiement, pour un remboursement. */
async function paymentIntentMeta(id) {
    const pi = await stripe(`/payment_intents/${encodeURIComponent(id)}`);
    return pi.metadata || {};
}

module.exports = { configured, createCheckout, verifyWebhook, paymentIntentMeta, setFetch, form };
