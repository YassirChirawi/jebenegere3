import { useEffect, useState } from 'react';

/**
 * Aide de jeu discrète : les cartes conseillées (jouables, qui mangent…) ne s'allument que si le
 * joueur n'a pas joué au bout de `delay` ms. `active` : c'est à moi de jouer ; `resetKey` change
 * à chaque nouvelle situation (nouveau tour, carte jouée…) et relance l'attente.
 */
export default function useHintDelay(active, resetKey, delay = 5000) {
    const [on, setOn] = useState(false);
    useEffect(() => {
        setOn(false);
        if (!active) return undefined;
        const t = setTimeout(() => setOn(true), delay);
        return () => clearTimeout(t);
    }, [active, resetKey, delay]);
    return on;
}
