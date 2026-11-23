/**
 * Cadre de l'appli sur le web : par défaut un « téléphone » de 500 px de large au centre de l'écran.
 * Un écran qui a une mise en page paysage (l'accueil) demande toute la largeur tant qu'il est affiché.
 */
import { useEffect, useState } from 'react';

let wide = false;
const listeners = new Set();

export function setWideFrame(on) {
    if (wide === !!on) return;
    wide = !!on;
    listeners.forEach((fn) => fn(wide));
}

export function useWideFrame() {
    const [v, setV] = useState(wide);
    useEffect(() => {
        listeners.add(setV);
        setV(wide); // (l'écran a pu le demander avant cet abonnement : les effets des enfants passent d'abord)
        return () => listeners.delete(setV);
    }, []);
    return v;
}

/**
 * Agrandissement des parties sur grand écran (site) : la table est dessinée pour une fenêtre
 * d'environ 1100 x 720 puis agrandie d'un seul bloc. Les gestes (glisser une carte) divisent par ce facteur.
 */
let gameScale = 1;
export function setGameScale(k) { gameScale = k || 1; }
export function getGameScale() { return gameScale; }
export function gameScaleFor(width, height) {
    return Math.max(1, Math.min(1.6, width / 1100, height / 720));
}
