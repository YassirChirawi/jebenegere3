/**
 * Discord Activities : le jeu lancé dans un salon vocal Discord.
 *
 * Tout ce qui suit ne s'active que dans Discord (page servie par <client_id>.discordsays.com) :
 * le SDK Discord est chargé à la demande (import dynamique), jamais sur le site ni dans l'appli.
 * Dans Discord, la page ne peut joindre que les adresses déclarées dans le Developer Portal
 * (« URL Mappings ») : « / » → le site, « /server » → le serveur de jeu.
 */
import { Platform } from 'react-native';

export const DISCORD_CLIENT_ID = '1572975413687226451';

export const inDiscord = Platform.OS === 'web'
    && typeof window !== 'undefined'
    && /\.discordsays\.com$/i.test(window.location?.hostname || '');

// Préfixe du serveur de jeu dans Discord (URL mapping « /server »)
export const DISCORD_SERVER_PREFIX = '/server';

let ready = null;

/** SDK prêt (ou null hors de Discord / en cas d'échec). */
export function discordSdk() {
    if (!inDiscord) return Promise.resolve(null);
    if (!ready) {
        ready = import('@discord/embedded-app-sdk')
            .then(async ({ DiscordSDK }) => {
                const sdk = new DiscordSDK(DISCORD_CLIENT_ID, { disableConsoleLogOverride: true });
                await sdk.ready();
                return sdk;
            })
            .catch((e) => {
                console.warn('[discord] SDK indisponible', e?.message || e);
                return null;
            });
    }
    return ready;
}

/** Code d'autorisation Discord (silencieux après le premier accord du joueur), ou null. */
export async function discordAuthCode() {
    const sdk = await discordSdk();
    if (!sdk) return null;
    try {
        const { code } = await sdk.commands.authorize({
            client_id: DISCORD_CLIENT_ID,
            response_type: 'code',
            state: '',
            prompt: 'none',
            scope: ['identify'],
        });
        return code || null;
    } catch (e) {
        console.warn('[discord] autorisation refusée', e?.message || e);
        return null;
    }
}

/** Identifiant de la partie Discord : le même pour tous les joueurs de l'Activity. */
export async function discordInstanceId() {
    const sdk = await discordSdk();
    return sdk?.instanceId || null;
}

/** Fenêtre d'invitation de Discord (inviter des amis dans l'Activity). */
export async function discordInvite() {
    const sdk = await discordSdk();
    if (!sdk) return false;
    try { await sdk.commands.openInviteDialog(); return true; } catch (e) { return false; }
}
