const SUITS = ['Oros', 'Copas', 'Espadas', 'Bastos'];
const VALUES = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

function generateDeck() {
    const deck = [];
    for (const suit of SUITS) {
        for (const value of VALUES) {
            deck.push({ id: `${suit}-${value}`, suit, value });
        }
    }
    return deck;
}

function shuffleDeck(deck) {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function initializeGame(numPlayers = 2) {
    let deck = shuffleDeck(generateDeck());
    const hands = Array(numPlayers).fill([]).map(() => []);

    for (let round = 0; round < 4; round++) {
        for (let player = 0; player < numPlayers; player++) {
            hands[player].push(deck.pop());
        }
    }

    // La carte initiale ne peut pas être une carte spéciale (1, 2, ou 7)
    let startingCard = deck.pop();
    while (startingCard.value === 1 || startingCard.value === 2 || startingCard.value === 7) {
        deck.unshift(startingCard);
        deck = shuffleDeck(deck);
        startingCard = deck.pop();
    }
    const middlePile = [startingCard];

    return {
        deck,
        middlePile,
        hands,           // hands[i] = [] means player i has finished (GG)
        finishedPlayers: [], // Indices des joueurs ayant vidé leurs cartes (classés 1er, 2ème...)
        turn: 0,
        drawPenalty: 0,
        activeSuitOverride: null,
        mancheTerminee: false,
        loserIndex: null,
        log: ['Jeu commencé.']
    };
}

/**
 * Finds the next turn index, skipping players who have already finished (empty hand).
 */
function nextActiveTurn(currentIndex, hands, finishedPlayers) {
    const numPlayers = hands.length;
    let next = (currentIndex + 1) % numPlayers;
    let tries = 0;
    while (finishedPlayers.includes(next) && tries < numPlayers) {
        next = (next + 1) % numPlayers;
        tries++;
    }
    return next;
}

function canPlayCard(cardToPlay, state) {
    const currentMiddleCard = state.middlePile[state.middlePile.length - 1];

    // Sous pénalité +2, seul un autre 2 peut être joué pour surenchérir
    if (state.drawPenalty > 0) {
        return cardToPlay.value === 2;
    }

    // Si un 7 a imposé une famille, il faut jouer cette famille OU un autre 7 (même valeur)
    if (state.activeSuitOverride) {
        return cardToPlay.suit === state.activeSuitOverride || cardToPlay.value === 7;
    }

    // Règles normales : même famille OU même valeur
    // Les cartes 1, 2, 7 obéissent aux mêmes règles que n'importe quelle carte
    return (
        cardToPlay.suit === currentMiddleCard.suit ||
        cardToPlay.value === currentMiddleCard.value
    );
}



function playCard(state, playerIndex, cardIndex, newSuitFor7 = null) {
    // Bloquer si: mauvais tour, partie terminée, ou joueur déjà fini
    if (state.turn !== playerIndex || state.mancheTerminee) return state;
    if (state.finishedPlayers.includes(playerIndex)) return state;

    const card = state.hands[playerIndex][cardIndex];
    if (!card || !canPlayCard(card, state)) return state;

    const newState = { ...state };
    newState.hands = state.hands.map(hand => [...hand]);
    newState.middlePile = [...state.middlePile];
    newState.log = [...state.log];
    newState.finishedPlayers = [...state.finishedPlayers];

    // Retirer la carte de la main et la mettre au milieu
    newState.hands[playerIndex].splice(cardIndex, 1);
    newState.middlePile.push(card);
    newState.activeSuitOverride = null;
    newState.log.push(`Joueur a joué ${card.value} de ${card.suit}.`);

    // === CAS SPÉCIAL : Le joueur vide sa main → GG ! ===
    if (newState.hands[playerIndex].length === 0) {
        newState.finishedPlayers.push(playerIndex);
        newState.log.push(`🏆 GG ! Joueur ${playerIndex} a vidé sa main !`);

        // Compter les joueurs encore actifs (avec des cartes)
        const activePlayers = newState.hands.filter((h, i) => !newState.finishedPlayers.includes(i));

        if (activePlayers.length === 1) {
            // Il ne reste qu'un joueur → c'est le Grand Perdant (Khasser)
            const loserIndex = newState.hands.findIndex((h, i) => !newState.finishedPlayers.includes(i));
            newState.mancheTerminee = true;
            newState.loserIndex = loserIndex;
            newState.log.push(`💀 ${loserIndex} est le Grand Perdant (Khasser) !`);
        } else {
            // La partie continue, c'est au joueur suivant (actif) de jouer
            newState.turn = nextActiveTurn(playerIndex, newState.hands, newState.finishedPlayers);
        }

        return newState;
    }

    // === Effets des cartes spéciales ===
    let nextTurnOffset = 1;

    if (card.value === 1) {
        newState.log.push('Le prochain joueur saute son tour !');
        // Sauter le prochain joueur actif
        const skipped = nextActiveTurn(playerIndex, newState.hands, newState.finishedPlayers);
        newState.turn = nextActiveTurn(skipped, newState.hands, newState.finishedPlayers);
        return newState;
    } else if (card.value === 2) {
        newState.drawPenalty += 2;
        newState.log.push(`Pénalité +2 cumulée. Total à piocher : ${newState.drawPenalty} cartes.`);
    } else if (card.value === 7) {
        if (newSuitFor7 && SUITS.includes(newSuitFor7)) {
            newState.activeSuitOverride = newSuitFor7;
            newState.log.push(`La famille demandée est maintenant : ${newSuitFor7}.`);
        } else {
            newState.activeSuitOverride = card.suit;
        }
    }

    // Prochain tour : joueur actif suivant
    newState.turn = nextActiveTurn(playerIndex, newState.hands, newState.finishedPlayers);

    return newState;
}

function drawCards(state, playerIndex) {
    if (state.turn !== playerIndex || state.mancheTerminee) return state;
    if (state.finishedPlayers.includes(playerIndex)) return state;

    const newState = { ...state };
    newState.hands = state.hands.map(hand => [...hand]);
    newState.deck = [...state.deck];
    newState.middlePile = [...state.middlePile];
    newState.log = [...state.log];
    newState.finishedPlayers = [...state.finishedPlayers];

    let cardsToDrawCount = 1;
    if (newState.drawPenalty > 0) {
        cardsToDrawCount = newState.drawPenalty;
        newState.drawPenalty = 0;
        newState.log.push(`Un joueur a pioché ${cardsToDrawCount} cartes de pénalité.`);
    } else {
        newState.log.push(`Un joueur a pioché 1 carte.`);
    }

    for (let i = 0; i < cardsToDrawCount; i++) {
        if (newState.deck.length === 0) {
            if (newState.middlePile.length <= 1) break;
            const topCard = newState.middlePile.pop();
            newState.deck = shuffleDeck(newState.middlePile);
            newState.middlePile = [topCard];
            newState.log.push(`La défausse a été remélangée.`);
        }
        newState.hands[playerIndex].push(newState.deck.pop());
    }

    // Le tour passe au prochain joueur actif
    newState.turn = nextActiveTurn(playerIndex, newState.hands, newState.finishedPlayers);

    return newState;
}

module.exports = {
    SUITS,
    VALUES,
    generateDeck,
    shuffleDeck,
    initializeGame,
    canPlayCard,
    playCard,
    drawCards
};
