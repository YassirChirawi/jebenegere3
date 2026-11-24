import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { isStandalone } from './fullscreen';
import { inDiscord } from './discord';

/**
 * Installer le jeu depuis le site (sans les stores), version web seulement.
 * - Android / Chrome / Edge : le navigateur propose l'installation (beforeinstallprompt, gardé par public/register-sw.js
 *   dans window.__installPrompt). Le joueur touche notre bouton, puis confirme dans la fenêtre du navigateur.
 * - iPhone / iPad : Safari n'a pas d'installation lancée par un site, on explique les 3 gestes.
 * Aucun site ne peut s'installer sans geste du joueur : c'est une règle des navigateurs.
 */
export const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';

export function isIOS() {
    if (!isWeb) return false;
    const ua = window.navigator.userAgent || '';
    return /iPhone|iPad|iPod/i.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

/** { canPrompt, installed, available } ; available : on peut proposer l'installation ici. */
export function useInstallState() {
    const [canPrompt, setCanPrompt] = useState(isWeb && !!window.__installPrompt);
    const [installed, setInstalled] = useState(!isWeb || isStandalone());

    useEffect(() => {
        if (!isWeb) return undefined;
        const onReady = () => setCanPrompt(true);
        const onDone = () => { setInstalled(true); setCanPrompt(false); };
        const onUsed = () => setCanPrompt(!!window.__installPrompt);
        window.addEventListener('jg3-installable', onReady);
        window.addEventListener('jg3-installed', onDone);
        window.addEventListener('jg3-prompt-used', onUsed);
        return () => {
            window.removeEventListener('jg3-installable', onReady);
            window.removeEventListener('jg3-installed', onDone);
            window.removeEventListener('jg3-prompt-used', onUsed);
        };
    }, []);

    const available = isWeb && !inDiscord && !installed && (canPrompt || isIOS());
    return { canPrompt, installed, available };
}

/** Ouvre la fenêtre d'installation du navigateur. Renvoie 'accepted', 'dismissed' ou null (rien à proposer). */
export async function promptInstall() {
    const prompt = isWeb && window.__installPrompt;
    if (!prompt) return null;
    prompt.prompt();
    const { outcome } = await prompt.userChoice.catch(() => ({}));
    // Le navigateur n'accepte qu'un seul appel : on l'oublie, il en reproposera un plus tard
    window.__installPrompt = null;
    window.dispatchEvent(new Event('jg3-prompt-used'));
    if (outcome === 'accepted') window.dispatchEvent(new Event('jg3-installed'));
    return outcome || 'dismissed';
}
