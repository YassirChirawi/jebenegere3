import { Platform, Share, Linking } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { t } from '../i18n';

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
export const tournamentUrl = (code) => `${base()}/tournoi/${encodeURIComponent(code)}`;

/** Code de tournoi à partir d'un lien (…/tournoi/CODE, jebengere3://tournoi/CODE). */
export function parseTournament(text) {
    const m = String(text || '').match(/tournoi[/=]([A-Za-z0-9]{6})\b/i);
    return m ? m[1].toUpperCase() : null;
}

export async function initialTournament() {
    if (web) return parseTournament(window.location.pathname + window.location.search);
    try {
        return parseTournament(await Linking.getInitialURL());
    } catch (e) {
        return null;
    }
}

export function onTournamentLink(callback) {
    if (web) return () => {};
    const sub = Linking.addEventListener('url', ({ url }) => {
        const code = parseTournament(url);
        if (code) callback(code);
    });
    return () => sub.remove();
}

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
    if (web && /\/(salon|tournoi)\//.test(window.location.pathname)) window.history.replaceState(null, '', '/');
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

export async function copyInvite(code, url = inviteUrl(code)) {
    try {
        if (web && navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
        else await Clipboard.setStringAsync(url);
        return true;
    } catch (e) {
        return false;
    }
}

/** Partage du téléphone (WhatsApp, SMS…) ; sur ordinateur sans partage : copie du lien. Renvoie 'shared' | 'copied' | 'failed'. */
export async function shareInvite(code, gameLabel, opts = {}) {
    const url = opts.url || inviteUrl(code);
    const message = opts.message || `Viens jouer au ${gameLabel} avec moi sur L'Carta : ${url}`;
    try {
        if (web) {
            if (navigator.share) {
                await navigator.share({ title: "L'Carta", text: message, url });
                return 'shared';
            }
            return (await copyInvite(code, url)) ? 'copied' : 'failed';
        }
        await Share.share({ message });
        return 'shared';
    } catch (e) {
        // Partage annulé par le joueur : pas une erreur
        return e?.name === 'AbortError' ? 'shared' : 'failed';
    }
}

/** Message d'invitation à un salon, avec le lien direct. */
export const inviteMessage = (code, gameLabel) => t("Viens jouer au {p0} avec moi sur L'Carta 🃏 Clique ici et tu es dans ma partie : {p1}", { p0: gameLabel, p1: inviteUrl(code) });

/**
 * Ouvre WhatsApp avec le message déjà rempli (le joueur choisit juste à qui l'envoyer).
 * wa.me marche partout : appli WhatsApp sur téléphone, WhatsApp Web ou l'appli de bureau sur ordinateur.
 */
export async function openWhatsApp(message) {
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    try {
        if (web) {
            const w = window.open(url, '_blank', 'noopener');
            if (!w) window.location.href = url; // fenêtre bloquée : on y va dans l'onglet
            return true;
        }
        await Linking.openURL(url);
        return true;
    } catch (e) {
        return false;
    }
}
