import { canPlayCard, SUITS } from './GameEngine';

export function getRobotAction(state, robotIndex) {
    const hand = state.hands[robotIndex];

    // Chercher une carte jouable
    let playableCards = [];
    for (let i = 0; i < hand.length; i++) {
        if (canPlayCard(hand[i], state)) {
            playableCards.push(i);
        }
    }

    if (playableCards.length > 0) {
        // Stratégie basique : on joue la première carte trouvée
        // Pourrait être amélioré : privilégier les +2 (valeur 2) ou les 7
        let chosenCardIndex = playableCards[0];
        const card = hand[chosenCardIndex];

        let newSuitFor7 = null;
        if (card.value === 7) {
            // Si on joue un 7, on choisit la famille la plus présente dans notre main
            const suitCounts = { 'Oros': 0, 'Copas': 0, 'Espadas': 0, 'Bastos': 0 };
            hand.forEach(c => {
                if (c.value !== 7) suitCounts[c.suit]++;
            });
            newSuitFor7 = Object.keys(suitCounts).reduce((a, b) => suitCounts[a] > suitCounts[b] ? a : b);
        }

        return { action: 'play', cardIndex: chosenCardIndex, newSuitFor7 };
    } else {
        // Aucune carte jouable, il faut piocher
        return { action: 'draw' };
    }
}
