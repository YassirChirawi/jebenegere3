export const SUITS = ['Oros', 'Copas', 'Espadas', 'Bastos'];
export const VALUES = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

export function generateDeck() {
    const deck = [];
    for (const suit of SUITS) {
        for (const value of VALUES) {
            deck.push({ id: `${suit}-${value}`, suit, value });
        }
    }
    return deck;
}

export function shuffleDeck(deck) {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

export function initializeGame(numPlayers = 2) {
    let deck = shuffleDeck(generateDeck());
    const hands = Array(numPlayers).fill([]).map(() => []);

    for (let round = 0; round < 4; round++) {
        for (let player = 0; player < numPlayers; player++) {
            hands[player].push(deck.pop());
        }
    }

    const middlePile = [deck.pop()];

    return {
        deck,
        middlePile,
        hands,
        turn: 0,
        drawPenalty: 0, // Accumulateur pour les 2
        activeSuitOverride: null, // Si un 7 a été joué, indique la famille demandée
        winner: null,
        log: ['Jeu commencé.']
    };
}

export function canPlayCard(cardToPlay, state) {
    const currentMiddleCard = state.middlePile[state.middlePile.length - 1];

    // Si on est sous le coup d'une pénalité de pioche (+2, +4, ...), 
    // on ne peut jouer qu'un 2 pour surenchérir.
    if (state.drawPenalty > 0) {
        return cardToPlay.value === 2;
    }

    // Si un 7 a été joué, la famille est forcée
    if (state.activeSuitOverride) {
        return cardToPlay.suit === state.activeSuitOverride || cardToPlay.value === 7;
    }

    // Règles normales
    return (
        cardToPlay.suit === currentMiddleCard.suit ||
        cardToPlay.value === currentMiddleCard.value ||
        cardToPlay.value === 7
    );
}

export function playCard(state, playerIndex, cardIndex, newSuitFor7 = null) {
    if (state.turn !== playerIndex || state.winner !== null) return state;

    const card = state.hands[playerIndex][cardIndex];
    if (!canPlayCard(card, state)) return state;

    const newState = { ...state };
    // Deep copy for nested objects that change
    newState.hands = state.hands.map(hand => [...hand]);
    newState.middlePile = [...state.middlePile];
    newState.log = [...state.log];

    // Retirer la carte de la main et la mettre au milieu
    newState.hands[playerIndex].splice(cardIndex, 1);
    newState.middlePile.push(card);
    newState.activeSuitOverride = null; // Reset override unless it's a 7
    newState.log.push(`Joueur ${playerIndex} a joué ${card.value} de ${card.suit}.`);

    // Vérifier victoire
    if (newState.hands[playerIndex].length === 0) {
        newState.winner = playerIndex;
        newState.log.push(`Le joueur ${playerIndex} a gagné !`);
        return newState;
    }

    // Appliquer effets des cartes spéciales
    let skipNext = false;
    let turnHandled = false;

    if (card.value === 1) {
        skipNext = true;
        newState.log.push('Le prochain joueur passe son tour !');
    } else if (card.value === 2) {
        newState.drawPenalty += 2;
        newState.log.push(`Pénalité cumulée : +${newState.drawPenalty} cartes.`);

        let targetIndex = (playerIndex + 1) % newState.hands.length;
        const hasTwo = newState.hands[targetIndex].some(c => c.value === 2);

        if (hasTwo) {
            // Le joueur adverse a un +2, c'est à son tour de contrer
            newState.turn = targetIndex;
            newState.log.push(`Joueur ${targetIndex} peut contrer avec un 2 ou piocher !`);
        } else {
            // Le joueur adverse n'a pas de +2, il pioche directement !
            newState.log.push(`Joueur ${targetIndex} ne peut pas contrer et pioche directement ${newState.drawPenalty} cartes.`);

            for (let i = 0; i < newState.drawPenalty; i++) {
                if (newState.deck.length === 0) {
                    if (newState.middlePile.length <= 1) break;
                    const topCard = newState.middlePile.pop();
                    newState.deck = shuffleDeck(newState.middlePile);
                    newState.middlePile = [topCard];
                    newState.log.push(`La défausse a été remélangée.`);
                }
                newState.hands[targetIndex].push(newState.deck.pop());
            }
            newState.drawPenalty = 0; // Pénalité consommée

            // Le joueur qui a posé la carte (playerIndex) reprend le jeu
            newState.turn = playerIndex;
            newState.log.push(`Le joueur ${playerIndex} reprend la main !`);
        }
        turnHandled = true;

    } else if (card.value === 7) {
        if (newSuitFor7 && SUITS.includes(newSuitFor7)) {
            newState.activeSuitOverride = newSuitFor7;
            newState.log.push(`La famille demandée est maintenant : ${newSuitFor7}.`);
        } else {
            // Fallback or let UI handle it, assume newSuitFor7 is provided
            newState.activeSuitOverride = card.suit;
        }
    }

    // Calcul du prochain tour
    if (!turnHandled) {
        let nextTurn = (playerIndex + 1) % newState.hands.length;
        // Si skip, passe au suivant
        if (skipNext && newState.drawPenalty === 0) {
            nextTurn = (nextTurn + 1) % newState.hands.length;
        }
        newState.turn = nextTurn;
    }

    return newState;
}

export function drawCards(state, playerIndex) {
    if (state.turn !== playerIndex || state.winner !== null) return state;

    const newState = { ...state };
    newState.hands = state.hands.map(hand => [...hand]);
    newState.deck = [...state.deck];
    newState.middlePile = [...state.middlePile];
    newState.log = [...state.log];

    let cardsToDrawCount = 1;
    if (newState.drawPenalty > 0) {
        cardsToDrawCount = newState.drawPenalty;
        newState.drawPenalty = 0; // Penalty consumed
        newState.log.push(`Joueur ${playerIndex} a pioché ${cardsToDrawCount} cartes de pénalité et passe son tour.`);
    } else {
        newState.log.push(`Joueur ${playerIndex} a pioché 1 carte.`);
    }

    for (let i = 0; i < cardsToDrawCount; i++) {
        // Si la pioche est vide, on la remplit avec la défausse
        if (newState.deck.length === 0) {
            if (newState.middlePile.length <= 1) {
                // Plus aucune carte nulle part ! Situation rare, on arrête de piocher.
                break;
            }
            const topCard = newState.middlePile.pop();
            newState.deck = shuffleDeck(newState.middlePile);
            newState.middlePile = [topCard];
            newState.log.push(`La défausse a été remélangée pour refaire la pioche.`);
        }

        newState.hands[playerIndex].push(newState.deck.pop());
    }

    // Le tour passe AU JOUEUR SUIVANT dans TOUS les cas (pioche normale ou pénalité)
    newState.turn = (playerIndex + 1) % newState.hands.length;

    return newState;
}
