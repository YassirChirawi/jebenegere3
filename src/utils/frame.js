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
