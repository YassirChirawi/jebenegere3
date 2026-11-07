// Registre des moteurs de jeu : le serveur choisit le moteur selon room.gameType.
const engines = {
    hezz2: require('./hezz2'),
    ronda: require('./ronda'),
};

const DEFAULT_GAME = 'hezz2';

function getEngine(type) {
    return engines[type] || engines[DEFAULT_GAME];
}

function normalizeType(type) {
    return engines[type] ? type : DEFAULT_GAME;
}

module.exports = { engines, getEngine, normalizeType, DEFAULT_GAME };
