/**
 * Discord Activities : connexion du joueur par son compte Discord.
 *
 * L'appli (lancée dans Discord) reçoit un « code » du SDK Discord ; le serveur l'échange contre
 * un jeton d'accès avec le Client Secret (variable DISCORD_CLIENT_SECRET, jamais dans le dépôt),
 * puis lit l'identité du joueur (id, pseudo). Le Client ID est public.
 */
const CLIENT_ID = process.env.DISCORD_CLIENT_ID || '1572975413687226451';
const API = 'https://discord.com/api/v10';

// Remplaçable dans les tests (aucun appel réseau vers Discord)
let fetchImpl = (...args) => fetch(...args);
function setFetch(fn) { fetchImpl = fn || ((...args) => fetch(...args)); }

const configured = () => !!process.env.DISCORD_CLIENT_SECRET;

/** Code du SDK → { accessToken, user: { id, username, global_name } } ou { error }. */
async function exchangeCode(code) {
    if (!configured()) return { error: 'La connexion Discord n\'est pas encore configurée sur le serveur.', status: 503 };
    if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{6,128}$/.test(code)) return { error: 'Code Discord invalide.', status: 400 };
    try {
        const tokenRes = await fetchImpl(`${API}/oauth2/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: process.env.DISCORD_CLIENT_SECRET,
                grant_type: 'authorization_code',
                code,
            }).toString(),
        });
        const tok = await tokenRes.json().catch(() => ({}));
        if (!tokenRes.ok || !tok.access_token) return { error: 'Discord a refusé la connexion.', status: 401 };
        const meRes = await fetchImpl(`${API}/users/@me`, { headers: { Authorization: `Bearer ${tok.access_token}` } });
        const me = await meRes.json().catch(() => ({}));
        if (!meRes.ok || !/^\d{5,25}$/.test(String(me.id || ''))) return { error: 'Profil Discord illisible.', status: 401 };
        return {
            accessToken: tok.access_token,
            user: { id: String(me.id), username: String(me.username || ''), global_name: me.global_name ? String(me.global_name) : null },
        };
    } catch (e) {
        return { error: 'Discord ne répond pas. Réessaie dans un instant.', status: 502 };
    }
}

module.exports = { CLIENT_ID, exchangeCode, setFetch, configured };
