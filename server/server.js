const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

// Configurer Socket.io pour accepter les connexions métier
const io = new Server(server, {
    cors: {
        origin: "*", // En dev, on accepte tout. À sécuriser en prod.
        methods: ["GET", "POST"]
    }
});

const { initializeGame, playCard, drawCards } = require('./GameEngine');

// === STATE DE L'APPLICATION === 
// Structure d'une room : { id: string, hostId: string, activePlayers: [{id, name}], spectators: [{id, name}], gameState: object | null }
const rooms = {};

// Fonction utilitaire pour générer un code de room à 4-5 lettres
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
}

// === ABSTRACTION DE LA LOGIQUE DE JEU ===

// Helper to safely emit room without NodeJS Timeout circular references
function broadcastRoomUpdate(roomId, roomObj) {
    if (!roomObj) return;
    const cleanRoom = { ...roomObj };
    if (cleanRoom.timerInterval) {
        delete cleanRoom.timerInterval;
    }
    io.to(roomId).emit('room_updated', cleanRoom);
}

function processPlayCard(roomId, playerIndex, cardIndex, newSuitFor7) {
    const room = rooms[roomId];
    if (!room || !room.gameState) return;

    const prevState = room.gameState;
    const newState = playCard(prevState, playerIndex, cardIndex, newSuitFor7);

    if (newState !== prevState) {
        room.gameState = newState;

        // Si la manche est terminée, on nettoie tout
        if (newState.mancheTerminee) {
            const loserPlayer = room.activePlayers[newState.loserIndex];

            // Injecter le nom du perdant dans les logs si pas déjà fait
            const khassarMsg = `💀 Manche terminée ! Le Khasser (Grand Perdant) est ${loserPlayer?.name || '?'}.`;
            if (!newState.log.includes(khassarMsg)) {
                newState.log.push(khassarMsg);
            }

            // Rotation spectateur si applicable
            if (room.spectators.length > 0 && newState.loserIndex !== null) {
                const newActivePlayer = room.spectators.shift();
                room.activePlayers.splice(newState.loserIndex, 1, newActivePlayer);
                room.spectators.push(loserPlayer);
                newState.log.push(`🔄 Rotation : ${newActivePlayer.name} entre en jeu.`);
            }

            if (room.timerInterval) clearInterval(room.timerInterval);
        }

        // Injection des joueurs actifs pour l'identification côté client
        newState.players = room.activePlayers;

        io.to(roomId).emit('game_state_update', room.gameState);

        if (!newState.mancheTerminee) {
            resetTimer(roomId);
        } else {
            broadcastRoomUpdate(roomId, room);
        }
    }
}

function processDrawCard(roomId, playerIndex) {
    const room = rooms[roomId];
    if (!room || !room.gameState) return;

    const prevState = room.gameState;
    const newState = drawCards(prevState, playerIndex);

    if (newState !== prevState) {
        room.gameState = newState;
        io.to(roomId).emit('game_state_update', room.gameState);
        resetTimer(roomId);
    }
}

// Fonction pour (re)démarrer le chrono d'une salle
function resetTimer(roomId) {
    const room = rooms[roomId];
    if (!room) return;

    if (room.timerInterval) {
        clearInterval(room.timerInterval);
    }

    if (room.gameState && room.gameState.mancheTerminee) {
        return; // Ne pas démarrer de timer si le jeu est fini
    }

    room.timeLeft = 15;
    io.to(roomId).emit('timer_tick', { timeLeft: room.timeLeft });

    room.timerInterval = setInterval(() => {
        room.timeLeft -= 1;
        io.to(roomId).emit('timer_tick', { timeLeft: room.timeLeft });

        if (room.timeLeft <= 0) {
            clearInterval(room.timerInterval);

            if (room.gameState) {
                const turnIndex = room.gameState.turn;
                console.log(`[Room ${roomId}] Temps écoulé pour le joueur ${turnIndex}. Pioche forcée.`);
                processDrawCard(roomId, turnIndex);
            }
        }
    }, 1000);

    // -- BOT EMULATOR --
    if (room.isBotMatch && room.gameState && !room.gameState.mancheTerminee) {
        const turnIndex = room.gameState.turn;
        const player = room.activePlayers[turnIndex];

        if (player && player.isBot) {
            setTimeout(() => {
                // S'assurer que le jeu n'est pas terminé et que c'est toujours à son tour
                const currentState = rooms[roomId]?.gameState;
                if (!currentState || currentState.mancheTerminee || currentState.turn !== turnIndex) return;
                // Si le bot a déjà fini (GG), ne rien faire
                if (currentState.finishedPlayers && currentState.finishedPlayers.includes(turnIndex)) return;

                const hand = currentState.hands[turnIndex];

                // Logique du bot : trouver la première carte jouable
                const botCanPlay = (card) => {
                    if (currentState.drawPenalty > 0) return card.value === 2;
                    if (card.value === 7) return true; // Le 7 est toujours jouable
                    if (currentState.activeSuitOverride) return card.suit === currentState.activeSuitOverride;
                    const topCard = currentState.middlePile[currentState.middlePile.length - 1];
                    return card.suit === topCard.suit || card.value === topCard.value;
                };

                let cardToPlayIndex = -1;
                for (let i = 0; i < hand.length; i++) {
                    if (botCanPlay(hand[i])) {
                        cardToPlayIndex = i;
                        break;
                    }
                }

                if (cardToPlayIndex !== -1) {
                    const card = hand[cardToPlayIndex];
                    const suits = ['Oros', 'Copas', 'Espadas', 'Bastos'];
                    const newSuit = card.value === 7 ? suits[Math.floor(Math.random() * suits.length)] : null;
                    processPlayCard(roomId, turnIndex, cardToPlayIndex, newSuit);
                } else {
                    processDrawCard(roomId, turnIndex);
                }
            }, 2500); // Le bot réfléchit 2.5 secondes
        }
    }
}

io.on('connection', (socket) => {
    console.log(`Nouvel utilisateur connecté: ${socket.id}`);

    // --- CRÉATION DE SALON ---
    socket.on('create_room', (data, callback) => {
        const { playerName } = data || { playerName: "Hôte" };
        const roomId = generateRoomCode();

        rooms[roomId] = {
            id: roomId,
            hostId: socket.id,
            activePlayers: [{ id: socket.id, name: playerName }],
            spectators: [],
            gameState: null
        };

        socket.join(roomId);
        console.log(`${playerName} (${socket.id}) a créé la room ${roomId}`);

        if (callback) callback({ success: true, roomId, roomData: rooms[roomId] });
    });

    // --- CREATION MATCH BOT ---
    socket.on('create_bot_room', (data, callback) => {
        const { playerName, botCount } = data || { playerName: "Hôte", botCount: 4 };
        const roomId = generateRoomCode();

        const activePlayers = [{ id: socket.id, name: playerName }];
        const botNames = ["Bot Hassan", "Bot Fatima", "Bot Yassine"];

        for (let i = 1; i < botCount; i++) {
            activePlayers.push({ id: `bot_${roomId}_${i}`, name: botNames[i - 1], isBot: true });
        }

        rooms[roomId] = {
            id: roomId,
            hostId: socket.id,
            activePlayers: activePlayers,
            spectators: [],
            gameState: null,
            isBotMatch: true // Tag to trigger AI on their turn
        };

        socket.join(roomId);
        console.log(`${playerName} a créé la room BOT ${roomId} avec ${botCount} joueurs.`);

        const numPlayers = rooms[roomId].activePlayers.length;
        rooms[roomId].gameState = initializeGame(numPlayers);
        rooms[roomId].gameState.players = rooms[roomId].activePlayers; // Injected for client ID mapping

        if (callback) callback({ success: true, roomId, gameState: rooms[roomId].gameState });

        io.to(roomId).emit('game_started', rooms[roomId].gameState);
        broadcastRoomUpdate(roomId, rooms[roomId]);
        resetTimer(roomId);
    });

    // --- REJOINDRE UN SALON ---
    socket.on('join_room', (data, callback) => {
        const { roomId, playerName } = data;

        if (!rooms[roomId]) {
            if (callback) callback({ success: false, message: "Salon introuvable" });
            return;
        }

        const room = rooms[roomId];
        const newPlayer = { id: socket.id, name: playerName || `Joueur ${socket.id.substring(0, 4)}` };

        if (room.activePlayers.length < 4) {
            room.activePlayers.push(newPlayer);
        } else if (room.spectators.length < 2) {
            room.spectators.push(newPlayer);
        } else {
            if (callback) callback({ success: false, message: "Le salon est plein (6 joueurs max)." });
            return;
        }

        socket.join(roomId);
        console.log(`${newPlayer.name} a rejoint la room ${roomId}`);

        broadcastRoomUpdate(roomId, room);

        if (callback) {
            // Also clean up timer interval for the callback data
            const safeRoomData = { ...room };
            delete safeRoomData.timerInterval;
            callback({ success: true, roomData: safeRoomData });
        }
    });

    // --- CHAT DE JEU ---
    socket.on('send_chat', (data) => {
        const { roomId, message } = data;
        const room = rooms[roomId];
        if (!room) return;

        let playerName = "Unknown";
        const activePlayer = room.activePlayers.find(p => p.id === socket.id);
        const spectator = room.spectators.find(p => p.id === socket.id);

        if (activePlayer) playerName = activePlayer.name;
        else if (spectator) playerName = spectator.name;

        io.to(roomId).emit('chat_message', {
            id: Math.random().toString(36).substr(2, 9),
            playerName,
            message,
            timestamp: Date.now()
        });
    });

    // --- LOGIQUE DE JEU ---

    // Démarrer la partie
    socket.on('start_game', (data) => {
        const { roomId } = data;
        const room = rooms[roomId];
        if (!room) return;

        // Seul l'hôte (ou un dev test) peut démarrer, mais on sécurise au moins que la room existe
        // Initialize state based on active players
        const numPlayers = room.activePlayers.length;
        if (numPlayers < 2) {
            socket.emit('game_error', { message: "Il faut au moins 2 joueurs actifs pour démarrer." });
            return;
        }

        room.gameState = initializeGame(numPlayers);
        room.gameState.players = room.activePlayers; // Injected for client ID mapping

        io.to(roomId).emit('game_started', room.gameState);
        broadcastRoomUpdate(roomId, room); // Met à jour le fait qu'une partie est en cours

        // Démarrer le chronomètre
        resetTimer(roomId);
    });

    // --- REJOUER LA MANCHE ---
    socket.on('play_again', (data) => {
        const { roomId } = data;
        const room = rooms[roomId];
        if (!room || !room.gameState) return;

        // Seul l'hôte peut relancer la partie
        if (room.hostId !== socket.id) return;

        const numPlayers = room.activePlayers.length;
        if (numPlayers < 2) {
            socket.emit('game_error', { message: "Il faut au moins 2 joueurs actifs pour rejouer." });
            return;
        }

        // Récupérer les anciens scores pour ne pas les perdre
        const previousScores = room.gameState.scores;

        // Relancer une nouvelle partie avec les anciens scores
        room.gameState = initializeGame(numPlayers, previousScores);
        room.gameState.players = room.activePlayers;

        io.to(roomId).emit('game_started', room.gameState);
        broadcastRoomUpdate(roomId, room);

        resetTimer(roomId);
    });

    // Jouer une carte
    socket.on('play_card', (data) => {
        const { roomId, cardIndex, newSuitFor7 } = data;
        const room = rooms[roomId];
        if (!room) return;

        const playerIndex = room.activePlayers.findIndex(p => p.id === socket.id);
        if (playerIndex === -1) return;

        processPlayCard(roomId, playerIndex, cardIndex, newSuitFor7);
    });

    // Piocher une carte
    socket.on('draw_card', (data) => {
        const { roomId } = data;
        const room = rooms[roomId];
        if (!room) return;

        const playerIndex = room.activePlayers.findIndex(p => p.id === socket.id);
        if (playerIndex === -1) return;

        processDrawCard(roomId, playerIndex);
    });

    // --- GESTION DE LA DÉCONNEXION ---
    socket.on('disconnect', () => {
        console.log(`Utilisateur déconnecté: ${socket.id}`);
        // Retirer l'utilisateur de toutes les rooms où il était
        for (const roomId in rooms) {
            let room = rooms[roomId];
            const isActive = room.activePlayers.findIndex(p => p.id === socket.id);
            const isSpectator = room.spectators.findIndex(p => p.id === socket.id);

            if (isActive !== -1) {
                room.activePlayers.splice(isActive, 1);
            }
            if (isSpectator !== -1) {
                room.spectators.splice(isSpectator, 1);
            }

            if (room.activePlayers.length === 0 && room.spectators.length === 0) {
                console.log(`Room ${roomId} supprimée (vide)`);
                if (room.timerInterval) clearInterval(room.timerInterval);
                delete rooms[roomId];
            } else {
                if (room.hostId === socket.id) {
                    if (room.activePlayers.length > 0) {
                        room.hostId = room.activePlayers[0].id;
                    } else if (room.spectators.length > 0) {
                        room.hostId = room.spectators[0].id;
                    }
                }
                broadcastRoomUpdate(roomId, room);
            }
        }
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`🚀 Serveur Jeben Gere3 Multiplayer démarré sur le port ${PORT}`);
});
