const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { getEngine, normalizeType, engines } = require('./engines');

// Version annoncée aux clients : permet à l'appli de détecter un serveur pas à jour
const SERVER_VERSION = 3;

const app = express();
app.use(cors());
app.get('/', (_req, res) => res.send('Jeben Gere3 server OK'));
app.get('/version', (_req, res) => res.json(serverInfo()));

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
});

/**
 * Room : {
 *   id, gameType, hostId, activePlayers: [{id, name, isBot?}], spectators: [],
 *   gameState, isBotMatch, version, timerInterval, timeLeft
 * }
 */
const rooms = {};

// Files de matchmaking par jeu et par taille : clé "ronda:2", "hezz2:4"...
const matchmakingQueues = {};
const MAX_QUEUE_WAIT_TIME = Number(process.env.MATCHMAKING_WAIT_MS) || 10000;
const BOT_NAMES = ['Bot Hassan', 'Bot Fatima', 'Bot Yassine', 'Bot Karim', 'Bot Salma'];

function serverInfo() {
    return { version: SERVER_VERSION, games: Object.keys(engines), features: ['matchmaking', 'play_again_ack', 'leave_room', 'forfeit'] };
}

function generateRoomCode() {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
}

// Ce que le client a le droit de voir d'une room (jamais l'état de jeu brut)
function publicRoom(room) {
    return {
        id: room.id,
        gameType: room.gameType,
        hostId: room.hostId,
        activePlayers: room.activePlayers,
        spectators: room.spectators,
        inGame: !!(room.gameState && !getEngine(room.gameType).isOver(room.gameState)),
        maxPlayers: getEngine(room.gameType).maxPlayers,
    };
}

function broadcastRoomUpdate(roomId) {
    const room = rooms[roomId];
    if (room) io.to(roomId).emit('room_updated', publicRoom(room));
}

// État enrichi (joueurs, hôte, type de jeu) puis éventuellement masqué pour un joueur donné
function stateFor(room, viewerIndex) {
    const engine = getEngine(room.gameType);
    const base = engine.viewFor ? engine.viewFor(room.gameState, viewerIndex) : room.gameState;
    return { ...base, gameType: room.gameType, players: room.activePlayers, hostId: room.hostId };
}

function emitState(roomId, event = 'game_state_update') {
    const room = rooms[roomId];
    if (!room || !room.gameState) return;
    const engine = getEngine(room.gameType);
    if (!engine.viewFor) {
        io.to(roomId).emit(event, stateFor(room, -1));
        return;
    }
    room.activePlayers.forEach((p, i) => {
        if (!p.isBot) io.to(p.id).emit(event, stateFor(room, i));
    });
    room.spectators.forEach((p) => io.to(p.id).emit(event, stateFor(room, -1)));
}

function startGame(roomId, prevState = null) {
    const room = rooms[roomId];
    const engine = getEngine(room.gameType);
    room.gameState = engine.init(room.activePlayers.length, prevState);
    if (room.debugHand === 'specials' && engine.rigSpecials) {
        const me = room.activePlayers.findIndex((p) => !p.isBot);
        if (me !== -1) room.gameState = engine.rigSpecials(room.gameState, me);
    }
    room.version = (room.version || 0) + 1;
    emitState(roomId, 'game_started');
    broadcastRoomUpdate(roomId);
    resetTimer(roomId);
}

// Applique une action (joueur ou bot). Renvoie true si l'état a changé.
function applyAction(roomId, playerIndex, action) {
    const room = rooms[roomId];
    if (!room || !room.gameState) return false;
    const engine = getEngine(room.gameType);
    const prev = room.gameState;
    const next = engine.apply(prev, playerIndex, action);
    if (next === prev) return false;
    commitState(roomId, prev, next);
    return true;
}

function commitState(roomId, prev, next) {
    const room = rooms[roomId];
    const engine = getEngine(room.gameType);
    room.gameState = next;
    room.version = (room.version || 0) + 1;

    if (engine.isOver(next)) {
        if (room.timerInterval) clearInterval(room.timerInterval);
        if (engine.rotateLoser) rotateLoser(room);
        emitState(roomId);
        broadcastRoomUpdate(roomId);
        return;
    }

    emitState(roomId);
    // Le chrono ne repart que si le tour (ou la phase) change ; sinon on replanifie juste les bots
    if (next.turn !== prev.turn || next.phase !== prev.phase || next.pendingAction !== prev.pendingAction || next.dealIndex !== prev.dealIndex) {
        resetTimer(roomId);
    } else {
        scheduleBots(roomId);
    }
}

// Hezz2 : le Khasser laisse sa place à un spectateur
function rotateLoser(room) {
    const s = room.gameState;
    const loser = room.activePlayers[s.loserIndex];
    if (room.spectators.length > 0 && s.loserIndex !== null && s.loserIndex !== undefined) {
        const incoming = room.spectators.shift();
        room.activePlayers.splice(s.loserIndex, 1, incoming);
        room.spectators.push(loser);
        s.log && s.log.push(`🔄 Rotation : ${incoming.name} entre en jeu.`);
    }
}

function resetTimer(roomId) {
    const room = rooms[roomId];
    if (!room) return;
    if (room.timerInterval) clearInterval(room.timerInterval);
    if (!room.gameState) return;

    const engine = getEngine(room.gameType);
    const seconds = engine.timerFor(room.gameState);
    if (seconds) {
        room.timeLeft = seconds;
        io.to(roomId).emit('timer_tick', { timeLeft: room.timeLeft });
        room.timerInterval = setInterval(() => {
            room.timeLeft -= 1;
            io.to(roomId).emit('timer_tick', { timeLeft: room.timeLeft });
            if (room.timeLeft <= 0) {
                clearInterval(room.timerInterval);
                const prev = room.gameState;
                const next = engine.onTimeout(prev);
                if (next !== prev) commitState(roomId, prev, next);
                else resetTimer(roomId);
            }
        }, 1000);
    }
    scheduleBots(roomId);
}

// Planifie les actions des bots ; une action périmée (l'état a changé entre-temps) est ignorée
function scheduleBots(roomId) {
    const room = rooms[roomId];
    if (!room || !room.gameState || !room.isBotMatch) return;
    const engine = getEngine(room.gameType);
    const version = room.version;
    const isBot = (i) => !!room.activePlayers[i]?.isBot;
    const actions = engine.botActions(room.gameState, isBot) || [];
    actions.forEach((a) => {
        setTimeout(() => {
            const r = rooms[roomId];
            if (!r || r.version !== version) return;
            if (a.reaction) {
                io.to(roomId).emit('player_reaction_broadcast', { playerIndex: a.player, reactionType: a.reaction });
                return;
            }
            applyAction(roomId, a.player, a.action);
        }, a.delay);
    });
}

function makeBots(roomId, count, startIndex = 0) {
    return Array.from({ length: count }, (_, i) => ({
        id: `bot_${roomId}_${startIndex + i}`,
        name: BOT_NAMES[(startIndex + i) % BOT_NAMES.length],
        isBot: true,
    }));
}

// === MATCHMAKING ===
const matchmakingTimer = setInterval(() => {
    const now = Date.now();
    for (const key in matchmakingQueues) {
        const queue = matchmakingQueues[key];
        if (!queue.length) continue;
        const [gameType, sizeStr] = key.split(':');
        const targetSize = parseInt(sizeStr, 10);
        if (queue.length >= targetSize) {
            createMatchmakingRoom(gameType, targetSize, queue.splice(0, targetSize));
        } else if (now - queue[0].joinedAt > MAX_QUEUE_WAIT_TIME) {
            createMatchmakingRoom(gameType, targetSize, queue.splice(0, queue.length));
        }
    }
}, 2000);

function createMatchmakingRoom(gameType, targetSize, realPlayers) {
    const roomId = generateRoomCode();
    const activePlayers = realPlayers.map((p) => ({ id: p.socketId, name: p.playerName }));
    realPlayers.forEach((p) => io.sockets.sockets.get(p.socketId)?.join(roomId));
    const botCount = targetSize - activePlayers.length;
    activePlayers.push(...makeBots(roomId, botCount));

    rooms[roomId] = {
        id: roomId,
        gameType,
        hostId: realPlayers[0].socketId,
        activePlayers,
        spectators: [],
        gameState: null,
        isBotMatch: botCount > 0,
    };
    console.log(`[MATCHMAKING] ${gameType} ${roomId} : ${realPlayers.length} réels, ${botCount} bots.`);

    const room = rooms[roomId];
    room.gameState = getEngine(gameType).init(targetSize, null);
    room.version = 1;
    realPlayers.forEach((p) => {
        const idx = activePlayers.findIndex((a) => a.id === p.socketId);
        io.to(p.socketId).emit('match_found', { roomId, roomData: publicRoom(room), gameState: stateFor(room, idx) });
    });
    emitState(roomId, 'game_started');
    broadcastRoomUpdate(roomId);
    resetTimer(roomId);
}

function playerIndexOf(room, socketId) {
    return room.activePlayers.findIndex((p) => p.id === socketId);
}

/**
 * Un joueur quitte une room (bouton Quitter ou déconnexion).
 * - Partie en cours à 2 joueurs : l'autre gagne par forfait (fin propre, timer arrêté).
 * - Partie en cours à 3+ joueurs : un bot reprend sa place, la partie continue.
 * - Plus aucun humain : la room est supprimée.
 */
function removePlayer(roomId, socketId) {
    const room = rooms[roomId];
    if (!room) return;
    const activeIdx = playerIndexOf(room, socketId);
    const spectatorIdx = room.spectators.findIndex((p) => p.id === socketId);
    if (activeIdx === -1 && spectatorIdx === -1) return;

    if (spectatorIdx !== -1) room.spectators.splice(spectatorIdx, 1);
    const engine = getEngine(room.gameType);
    const inGame = room.gameState && !engine.isOver(room.gameState);
    let forfeitState = null;

    if (activeIdx !== -1) {
        const leaver = room.activePlayers[activeIdx];
        if (inGame) {
            room.activePlayers[activeIdx] = {
                id: `bot_${roomId}_r${activeIdx}_${Date.now()}`,
                name: `${leaver.name} (parti)`,
                isBot: true,
                replaced: true,
            };
            room.isBotMatch = true;
            room.gameState.log && room.gameState.log.push(`🔌 ${leaver.name} a quitté la partie.`);
            const humansLeft = room.activePlayers.filter((p) => !p.isBot);
            if (room.activePlayers.length === 2 && humansLeft.length === 1 && engine.forfeit) {
                const winner = room.activePlayers.findIndex((p) => !p.isBot);
                forfeitState = engine.forfeit(room.gameState, activeIdx, winner);
            }
        } else {
            room.activePlayers.splice(activeIdx, 1);
        }
    }

    const humans = [...room.activePlayers, ...room.spectators].filter((p) => !p.isBot);
    if (humans.length === 0) {
        if (room.timerInterval) clearInterval(room.timerInterval);
        delete rooms[roomId];
        console.log(`Room ${roomId} supprimée (plus aucun humain)`);
        return;
    }
    if (room.hostId === socketId) room.hostId = humans[0].id;

    broadcastRoomUpdate(roomId);
    if (forfeitState) {
        console.log(`[${roomId}] Victoire par forfait.`);
        commitState(roomId, room.gameState, forfeitState);
    } else if (inGame && activeIdx !== -1) {
        room.version = (room.version || 0) + 1;
        emitState(roomId);
        scheduleBots(roomId);
    }
}

io.on('connection', (socket) => {
    console.log(`Nouvel utilisateur connecté: ${socket.id}`);
    socket.emit('server_info', serverInfo());

    // --- SALON PRIVÉ ---
    socket.on('create_room', (data, callback) => {
        const { playerName = 'Hôte', gameType } = data || {};
        const roomId = generateRoomCode();
        rooms[roomId] = {
            id: roomId,
            gameType: normalizeType(gameType),
            hostId: socket.id,
            activePlayers: [{ id: socket.id, name: playerName }],
            spectators: [],
            gameState: null,
        };
        socket.join(roomId);
        console.log(`${playerName} a créé la room ${roomId} (${rooms[roomId].gameType})`);
        callback && callback({ success: true, roomId, roomData: publicRoom(rooms[roomId]) });
    });

    // --- PARTIE CONTRE LES BOTS ---
    socket.on('create_bot_room', (data, callback) => {
        const { playerName = 'Hôte', botCount = 4, gameType } = data || {};
        const type = normalizeType(gameType);
        const engine = getEngine(type);
        const size = engine.sizes.includes(botCount) ? botCount : engine.sizes[engine.sizes.length - 1];
        const roomId = generateRoomCode();
        rooms[roomId] = {
            id: roomId,
            gameType: type,
            hostId: socket.id,
            activePlayers: [{ id: socket.id, name: playerName }, ...makeBots(roomId, size - 1, 1)],
            spectators: [],
            gameState: null,
            isBotMatch: true,
        };
        socket.join(roomId);
        console.log(`${playerName} a créé la room BOT ${roomId} (${type}, ${size} joueurs).`);

        const room = rooms[roomId];
        room.gameState = engine.init(size, null);
        // Mode test (parties contre bots uniquement) : main forcée avec des 1, 2 et 7
        if (data?.debugHand === 'specials' && engine.rigSpecials) {
            room.debugHand = 'specials';
            room.gameState = engine.rigSpecials(room.gameState, 0);
        }
        room.version = 1;
        callback && callback({ success: true, roomId, gameState: stateFor(room, 0) });
        emitState(roomId, 'game_started');
        broadcastRoomUpdate(roomId);
        resetTimer(roomId);
    });

    socket.on('join_room', (data, callback) => {
        const { roomId, playerName } = data || {};
        const room = rooms[roomId];
        if (!room) {
            callback && callback({ success: false, message: 'Salon introuvable' });
            return;
        }
        const engine = getEngine(room.gameType);
        const newPlayer = { id: socket.id, name: playerName || `Joueur ${socket.id.substring(0, 4)}` };
        const inGame = room.gameState && !engine.isOver(room.gameState);

        if (!inGame && room.activePlayers.length < engine.maxPlayers) {
            room.activePlayers.push(newPlayer);
        } else if (room.spectators.length < 2) {
            room.spectators.push(newPlayer);
        } else {
            callback && callback({ success: false, message: 'Le salon est plein.' });
            return;
        }
        socket.join(roomId);
        console.log(`${newPlayer.name} a rejoint la room ${roomId}`);
        broadcastRoomUpdate(roomId);
        callback && callback({ success: true, roomData: publicRoom(room) });
    });

    // --- MATCHMAKING ---
    socket.on('find_match', (data, callback) => {
        const { playerName = 'Joueur Anonyme', targetSize = 4, gameType } = data || {};
        const type = normalizeType(gameType);
        if (!getEngine(type).sizes.includes(targetSize)) {
            callback && callback({ success: false, message: `Taille ${targetSize} invalide pour ce jeu.` });
            return;
        }
        for (const key in matchmakingQueues) {
            matchmakingQueues[key] = matchmakingQueues[key].filter((p) => p.socketId !== socket.id);
        }
        const key = `${type}:${targetSize}`;
        (matchmakingQueues[key] = matchmakingQueues[key] || []).push({ socketId: socket.id, playerName, joinedAt: Date.now() });
        console.log(`[MATCHMAKING] ${playerName} cherche ${key}`);
        callback && callback({ success: true });
    });

    socket.on('cancel_match', () => {
        for (const key in matchmakingQueues) {
            matchmakingQueues[key] = matchmakingQueues[key].filter((p) => p.socketId !== socket.id);
        }
    });

    // --- DÉROULEMENT ---
    socket.on('start_game', (data) => {
        const room = rooms[data?.roomId];
        if (!room) return;
        if (room.hostId !== socket.id) return;
        const engine = getEngine(room.gameType);
        if (!engine.canStart(room.activePlayers.length)) {
            const msg = {
                ronda: 'La Ronda se joue à 2 (1 contre 1) ou à 4 (2 contre 2).',
                kdoub: 'Le Kdoub se joue de 3 à 6 joueurs.',
                sota: 'La Sota Ghamla se joue de 4 à 6 joueurs.',
            }[room.gameType] || 'Il faut au moins 2 joueurs actifs pour démarrer.';
            socket.emit('game_error', { message: msg });
            return;
        }
        startGame(room.id, null);
    });

    socket.on('play_again', (data, callback) => {
        const reply = (r) => callback && callback(r);
        const room = rooms[data?.roomId];
        if (!room || !room.gameState) return reply({ success: false, message: "Cette partie n'existe plus." });
        if (room.hostId !== socket.id) return reply({ success: false, message: "Seul l'hôte peut relancer la partie." });
        const engine = getEngine(room.gameType);
        if (!engine.isOver(room.gameState)) return reply({ success: false, message: 'La partie est encore en cours.' });
        if (!engine.canStart(room.activePlayers.length)) {
            return reply({ success: false, message: 'Pas assez de joueurs pour relancer.' });
        }
        startGame(room.id, room.gameState);
        reply({ success: true });
    });

    // Hezz2 (événements historiques)
    socket.on('play_card', (data) => {
        const room = rooms[data?.roomId];
        if (!room) return;
        applyAction(room.id, playerIndexOf(room, socket.id), { type: 'play', cardIndex: data.cardIndex, newSuitFor7: data.newSuitFor7 });
    });

    socket.on('draw_card', (data) => {
        const room = rooms[data?.roomId];
        if (!room) return;
        applyAction(room.id, playerIndexOf(room, socket.id), { type: 'draw' });
    });

    // Action générique (Ronda, et les prochains jeux)
    socket.on('game_action', (data) => {
        const room = rooms[data?.roomId];
        if (!room || !data.action || String(data.action.type).startsWith('_')) return; // actions internes réservées aux bots
        const idx = playerIndexOf(room, socket.id);
        if (idx === -1) return;
        if (!applyAction(room.id, idx, data.action)) {
            socket.emit('action_rejected', { action: data.action });
        }
    });

    // --- CHAT & RÉACTIONS ---
    socket.on('send_chat', (data) => {
        const room = rooms[data?.roomId];
        if (!room) return;
        const player = room.activePlayers.find((p) => p.id === socket.id) || room.spectators.find((p) => p.id === socket.id);
        if (!player) return;
        io.to(room.id).emit('chat_message', {
            id: Math.random().toString(36).substr(2, 9),
            playerName: player.name,
            message: String(data.message || '').slice(0, 120),
            timestamp: Date.now(),
        });
    });

    socket.on('player_reaction', (data) => {
        const room = rooms[data?.roomId];
        if (!room) return;
        const playerIndex = playerIndexOf(room, socket.id);
        if (playerIndex !== -1) {
            io.to(room.id).emit('player_reaction_broadcast', { playerIndex, reactionType: data.reactionType });
        }
    });

    // --- DÉCONNEXION ---
    socket.on('leave_room', (data) => {
        const roomId = data?.roomId;
        if (!roomId) return;
        removePlayer(roomId, socket.id);
        socket.leave(roomId);
    });

    socket.on('disconnect', () => {
        console.log(`Utilisateur déconnecté: ${socket.id}`);
        for (const key in matchmakingQueues) {
            matchmakingQueues[key] = matchmakingQueues[key].filter((p) => p.socketId !== socket.id);
        }
        Object.keys(rooms).forEach((roomId) => removePlayer(roomId, socket.id));
    });
});

function start(port = process.env.PORT || 3000) {
    return new Promise((resolve) => {
        server.listen(port, () => {
            console.log(`🚀 Serveur Jeben Gere3 Multiplayer démarré sur le port ${server.address().port}`);
            resolve(server.address().port);
        });
    });
}

function stop() {
    clearInterval(matchmakingTimer);
    Object.values(rooms).forEach((r) => r.timerInterval && clearInterval(r.timerInterval));
    io.close();
    return new Promise((resolve) => server.close(() => resolve()));
}

if (require.main === module) start();

module.exports = { rooms, start, stop, SERVER_VERSION };
