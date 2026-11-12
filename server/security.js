/**
 * Sécurité du serveur : origines autorisées, en-têtes HTTP, limite de messages par connexion.
 *
 * Origines autorisées :
 * - jebengere3.fun (et www), les déploiements Vercel, localhost (développement) ;
 * - pas d'origine du tout : appli installée sur téléphone, outils, tests ;
 * - ALLOWED_ORIGINS (variable d'environnement, séparées par des virgules) pour en ajouter.
 */
const DEFAULT_ORIGINS = ['https://jebengere3.fun', 'https://www.jebengere3.fun'];
const PATTERNS = [
    /^https:\/\/[a-z0-9-]+\.vercel\.app$/i,
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i,
    /^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/i, // téléphone sur le Wi-Fi local (Expo)
];

function allowedOrigins() {
    const extra = String(process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    return [...DEFAULT_ORIGINS, ...extra];
}

function isAllowedOrigin(origin) {
    if (!origin) return true;
    if (process.env.ALLOWED_ORIGINS === '*') return true;
    return allowedOrigins().includes(origin) || PATTERNS.some((re) => re.test(origin));
}

const corsOptions = {
    origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
    methods: ['GET', 'POST'],
};

function securityHeaders(_req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
    next();
}

/**
 * Limite le nombre de messages par connexion (anti-spam / anti-flood) :
 * au-delà de `max` messages en `windowMs`, les messages sont ignorés ;
 * au-delà de `kickAt` sur la même fenêtre, la connexion est coupée.
 */
function socketRateLimit({ windowMs = 1000, max = 25, kickAt = 120 } = {}) {
    return (socket) => {
        let start = Date.now();
        let count = 0;
        socket.use((_packet, next) => {
            const now = Date.now();
            if (now - start > windowMs) { start = now; count = 0; }
            count += 1;
            if (count > kickAt) { socket.disconnect(true); return; }
            if (count > max) return; // ignoré en silence
            next();
        });
    };
}

module.exports = { isAllowedOrigin, corsOptions, securityHeaders, socketRateLimit };
