import { Platform } from 'react-native';

/**
 * Plein écran sur téléphone (version web) : cache la barre d'adresse du navigateur.
 * - Android (Chrome, Samsung, Edge…) : API plein écran + blocage de l'orientation (paysage pour la Ronda).
 * - iPhone : Safari ne permet pas le plein écran d'une page ; seule l'appli installée
 *   (écran d'accueil) s'ouvre sans barre. On ne fait rien dans ce cas.
 * Le navigateur n'accepte le plein écran que juste après un geste du joueur (toucher un bouton).
 */
const web = Platform.OS === 'web' && typeof document !== 'undefined';

export function isPhoneWeb() {
    if (!web) return false;
    const touch = (navigator.maxTouchPoints || 0) > 0;
    const small = Math.min(window.screen?.width || 9999, window.screen?.height || 9999) < 600;
    return touch && small;
}

export function isStandalone() {
    if (!web) return false;
    return window.matchMedia?.('(display-mode: standalone)').matches
        || window.matchMedia?.('(display-mode: fullscreen)').matches
        || window.navigator.standalone === true;
}

export function canFullscreen() {
    return web && isPhoneWeb() && !!document.documentElement.requestFullscreen;
}

export function isFullscreen() {
    return web && !!document.fullscreenElement;
}

let wanted = null; // 'landscape' | 'any'

function lockOrientation() {
    if (!web || !window.screen?.orientation?.lock) return;
    if (wanted === 'landscape') window.screen.orientation.lock('landscape').catch(() => {});
    else window.screen.orientation.unlock?.();
}

/** À appeler dans un geste du joueur (bouton « Jouer »…). */
export function enterFullscreen(orientation = 'any') {
    wanted = orientation;
    if (!canFullscreen()) return;
    if (isFullscreen()) { lockOrientation(); return; }
    try {
        const p = document.documentElement.requestFullscreen({ navigationUI: 'hide' });
        if (p && p.then) p.then(lockOrientation).catch(() => {});
    } catch (_) { /* refusé : pas grave */ }
}

/** Orientation voulue par l'écran de jeu (sans geste : ne marche que si on est déjà en plein écran). */
export function setGameOrientation(orientation) {
    wanted = orientation;
    if (isFullscreen()) lockOrientation();
}

/**
 * Filet de sécurité pour les écrans de jeu (ex. invité d'un salon : la partie démarre sans
 * qu'il ait touché de bouton) : le premier toucher passe en plein écran.
 * Renvoie une fonction de nettoyage.
 */
export function armFullscreenOnTouch(orientation = 'any') {
    if (!canFullscreen()) return () => {};
    const onTouch = () => {
        if (!isFullscreen()) enterFullscreen(orientation);
    };
    document.addEventListener('pointerup', onTouch, { once: true, capture: true });
    return () => document.removeEventListener('pointerup', onTouch, { capture: true });
}
