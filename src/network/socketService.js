import { io } from 'socket.io-client';

// Replace with the computer's actual local IPv4 address so your phone can reach it on the Wi-Fi
// Serveur de prod sur render.com ; surcharge possible avec EXPO_PUBLIC_SOCKET_URL (ex : http://192.168.1.10:3000)
export const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'https://jebenegere3.onrender.com/';

class SocketService {
    socket;

    connect() {
        // Une seule instance : si l'écran d'accueil est remonté, on réutilise le socket existant
        if (this.socket) {
            if (!this.socket.connected) this.socket.connect();
            return;
        }
        this.socket = io(SOCKET_URL);
        this.serverInfo = null;
        // Le serveur annonce sa version à chaque connexion (absent = serveur pas à jour)
        this.socket.on('server_info', (info) => {
            this.serverInfo = info;
            (this.infoListeners || []).forEach((fn) => fn(info));
        });

        this.socket.on('connect', () => {
            console.log('Connecté au serveur Socket.io avec ID:', this.socket.id);
            this._sendAuth(); // compte joueur : ré-authentification à chaque (re)connexion
        });
        // Progression envoyée par le serveur en fin de partie (XP, défis, titres)
        this.socket.on('progress', (p) => (this.progressListeners || []).forEach((fn) => fn(p)));

        this.socket.on('disconnect', () => {
            console.log('Déconnecté du serveur.');
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }

    // Quitter une partie/salon sans couper la connexion (pas d'attente de reconnexion).
    // Ancien serveur sans 'leave_room' : on se déconnecte puis on se reconnecte.
    leaveRoom(roomId) {
        if (!this.socket) return;
        this.offAll();
        if (roomId && this.supports('leave_room')) {
            this.socket.emit('leave_room', { roomId });
            return;
        }
        this.socket.disconnect();
        setTimeout(() => this.socket && this.socket.connect(), 150);
    }

    // --- Compte joueur ---
    setAuthToken(token) {
        this.authToken = token || null;
        this._sendAuth();
    }

    _sendAuth() {
        if (!this.socket?.connected || (this.serverInfo && !this.supports('accounts'))) {
            this.authReady = Promise.resolve();
            return;
        }
        this.authReady = new Promise((resolve) => {
            this.socket.timeout(4000).emit('auth', { token: this.authToken }, () => resolve());
        });
    }

    // Les actions qui créent un joueur attendent que le compte soit reconnu par le serveur
    _afterAuth(fn) {
        (this.authReady || Promise.resolve()).then(fn);
    }

    onProgress(callback) {
        this.progressListeners = [...(this.progressListeners || []), callback];
        return () => { this.progressListeners = (this.progressListeners || []).filter((f) => f !== callback); };
    }

    supports(feature) {
        return !!this.serverInfo?.features?.includes(feature);
    }

    supportsGame(game) {
        return game === 'hezz2' || !!this.serverInfo?.games?.includes(game);
    }

    onServerInfo(callback) {
        this.infoListeners = [...(this.infoListeners || []), callback];
        if (this.serverInfo) callback(this.serverInfo);
        return () => { this.infoListeners = (this.infoListeners || []).filter((f) => f !== callback); };
    }

    // emit avec accusé de réception et délai max : jamais d'attente silencieuse
    _emitAck(event, data, callback, timeoutMs, timeoutMessage) {
        if (!this.socket?.connected) {
            callback && callback({ success: false, message: "Pas de connexion au serveur." });
            return;
        }
        this.socket.timeout(timeoutMs).emit(event, data, (err, res) => {
            if (err) callback && callback({ success: false, timeout: true, message: timeoutMessage });
            else callback && callback(res || { success: true });
        });
    }

    // -- ROOM ACTIONS --
    createRoom(playerName, gameType, callback) {
        this._afterAuth(() => this.socket.emit('create_room', { playerName, gameType }, callback));
    }

    createBotRoom(playerName, botCount, gameType, callback, options = {}) {
        this._afterAuth(() => this._emitAck('create_bot_room', { playerName, botCount, gameType, ...options }, callback, 10000, 'Le serveur ne répond pas.'));
    }

    joinRoom(roomId, playerName, callback) {
        this._afterAuth(() => this.socket.emit('join_room', { roomId, playerName }, callback));
    }

    // Salon privé (hôte) : ajouter / retirer un bot, échanger deux places (équipes de la Ronda)
    addBot(roomId, callback) {
        this._emitAck('add_bot', { roomId }, callback, 6000, 'Le serveur ne répond pas.');
    }

    removeBot(roomId, playerId, callback) {
        this._emitAck('remove_bot', { roomId, playerId }, callback, 6000, 'Le serveur ne répond pas.');
    }

    swapSeats(roomId, a, b, callback) {
        this._emitAck('swap_seats', { roomId, a, b }, callback, 6000, 'Le serveur ne répond pas.');
    }

    // Salon privé (hôte) : choisir un autre jeu, ou ramener tout le monde au salon après une partie
    changeGame(roomId, gameType, callback) {
        this._emitAck('change_game', { roomId, gameType }, callback, 6000, 'Le serveur ne répond pas.');
    }

    backToLobby(roomId, callback) {
        this._emitAck('back_to_lobby', { roomId }, callback, 6000, 'Le serveur ne répond pas.');
    }

    // -- MATCHMAKING ACTIONS --
    findMatch(playerName, targetSize, gameType, callback) {
        this._afterAuth(() => this._emitAck('find_match', { playerName, targetSize, gameType }, callback, 6000,
            "Le serveur ne répond pas au matchmaking. Il n'est sans doute pas à jour (à redéployer)."));
    }

    cancelMatch() {
        this.socket.emit('cancel_match');
    }

    // -- IN-GAME ACTIONS --
    startGame(roomId) {
        this.socket.emit('start_game', { roomId });
    }

    playAgain(roomId, callback) {
        if (!this.supports('play_again_ack')) {
            // Ancien serveur : pas de réponse possible
            this.socket.emit('play_again', { roomId });
            return;
        }
        this._emitAck('play_again', { roomId }, callback, 6000, "Le serveur n'a pas répondu à Rejouer.");
    }

    playCard(roomId, cardIndex, newSuitFor7) {
        this.socket.emit('play_card', { roomId, cardIndex, newSuitFor7 });
    }

    drawCard(roomId) {
        this.socket.emit('draw_card', { roomId });
    }

    // Action générique (Ronda et jeux suivants), validée par le serveur
    sendAction(roomId, action) {
        this.socket.emit('game_action', { roomId, action });
    }

    sendChat(roomId, message) {
        this.socket.emit('send_chat', { roomId, message });
    }

    sendReaction(roomId, reactionType) {
        this.socket.emit('player_reaction', { roomId, reactionType });
    }

    // -- LISTENERS --
    onConnect(callback) {
        if (this.socket) {
            if (this.socket.connected) {
                callback();
            }
            this.socket.on('connect', callback);
        }
        return () => this.socket && this.socket.off('connect', callback);
    }

    onDisconnect(callback) {
        if (this.socket) {
            this.socket.on('disconnect', callback);
        }
        return () => this.socket && this.socket.off('disconnect', callback);
    }

    // Chaque on* renvoie une fonction de désinscription qui ne retire QUE ce callback
    // (évite qu'un écran qui se démonte coupe les écouteurs de l'écran suivant).
    _listen(event, callback) {
        if (!this.socket) return () => {};
        this.socket.on(event, callback);
        return () => this.socket && this.socket.off(event, callback);
    }

    onRoomUpdated(callback) { return this._listen('room_updated', callback); }
    onMatchFound(callback) { return this._listen('match_found', callback); }
    onGameStarted(callback) { return this._listen('game_started', callback); }
    onGameStateUpdate(callback) { return this._listen('game_state_update', callback); }
    onChatMessage(callback) { return this._listen('chat_message', callback); }
    onGameError(callback) { return this._listen('game_error', callback); }
    onTimerTick(callback) { return this._listen('timer_tick', callback); }
    onPlayerReaction(callback) { return this._listen('player_reaction_broadcast', callback); }
    onActionRejected(callback) { return this._listen('action_rejected', callback); }
    onBackToLobby(callback) { return this._listen('back_to_lobby', callback); }

    offAll() {
        if (this.socket) {
            this.socket.off('room_updated');
            this.socket.off('match_found');
            this.socket.off('game_started');
            this.socket.off('game_state_update');
            this.socket.off('game_error');
            this.socket.off('timer_tick');
            this.socket.off('chat_message');
            this.socket.off('player_reaction_broadcast');
        }
    }
}

const socketService = new SocketService();
export default socketService;
