import { Platform, Share, Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';

/**
 * Invitation par lien : https://jebengere3.fun/salon/CODE
 * - sur le web, le lien ouvre le jeu directement dans le salon (réécriture /salon/* dans vercel.json) ;
 * - dans l'appli, le schéma jebengere3://salon/CODE est aussi compris ;
 * - un ancien code (5 caractères) ou un lien collé à la main marche toujours.
 */
export const SITE_URL = 'https://jebengere3.fun';
const web = Platform.OS === 'web' && typeof window !== 'undefined';

// Sur le web, le lien pointe vers le site qui sert la page (utile en local et en préproduction)
const base = () => (web && /^https?:/.test(window.location.origin) ? window.location.origin : SITE_URL);

export const inviteUrl = (code) => `${base()}/salon/${encodeURIComponent(code)}`;

/** Code de salon à partir d'un lien (…/salon/CODE, ?salon=CODE, jebengere3://salon/CODE) ou d'un code seul. */
export function parseInvite(text) {
    const t = String(text || '').trim();
    if (!t) return null;
    const m = t.match(/salon[/=]([A-Za-z0-9]{4,8})\b/i);
    if (m) return m[1].toUpperCase();
    if (/^[A-Za-z0-9]{4,8}$/.test(t)) return t.toUpperCase();
    return null;
}

/** Invitation contenue dans l'adresse d'ouverture (web) ou le lien qui a lancé l'appli. */
export async function initialInvite() {
    if (web) return parseInvite(window.location.pathname + window.location.search);
    try {
        return parseInvite(await Linking.getInitialURL());
    } catch (e) {
        return null;
    }
}

/** Une fois l'invitation prise en compte, on remet l'adresse sur l'accueil (pas de re-connexion au rechargement). */
export function clearInviteFromUrl() {
    if (web && /\/salon\//.test(window.location.pathname)) window.history.replaceState(null, '', '/');
}

/** Lien reçu alors que l'appli est déjà ouverte (mobile). */
export function onInviteLink(callback) {
    if (web) return () => {};
    const sub = Linking.addEventListener('url', ({ url }) => {
        const code = parseInvite(url);
        if (code) callback(code);
    });
    return () => sub.remove();
}

export async function copyInvite(code) {
    const url = inviteUrl(code);
    try {
        if (web && navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
        else await Clipboard.setStringAsync(url);
        return true;
    } catch (e) {
        return false;
    }
}

/** Partage du téléphone (WhatsApp, SMS…) ; sur ordinateur sans partage : copie du lien. Renvoie 'shared' | 'copied' | 'failed'. */
export async function shareInvite(code, gameLabel) {
    const url = inviteUrl(code);
    const message = `Viens jouer au ${gameLabel} avec moi sur Jeben Gere3 : ${url}`;
    try {
        if (web) {
            if (navigator.share) {
                await navigator.share({ title: 'Jeben Gere3', text: message, url });
                return 'shared';
            }
            return (await copyInvite(code)) ? 'copied' : 'failed';
        }
        await Share.share({ message });
        return 'shared';
    } catch (e) {
        // Partage annulé par le joueur : pas une erreur
        return e?.name === 'AbortError' ? 'shared' : 'failed';
    }
}
