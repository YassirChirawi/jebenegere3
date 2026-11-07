import { io } from 'socket.io-client';

// Replace with the computer's actual local IPv4 address so your phone can reach it on the Wi-Fi
// Serveur de prod sur render.com ; surcharge possible avec EXPO_PUBLIC_SOCKET_URL (ex : http://192.168.1.10:3000)
const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'https://jebenegere3.onrender.com/';

class SocketService {
    socket;

    connect() {
        // Une seule instance : si l'écran d'accueil est remonté, on réutilise le socket existant
        if (this.socket) {
            if (!this.socket.connected) this.socket.connect();
            return;
        }
        this.socket = io(SOCKET_URL);

        this.socket.on('connect', () => {
            console.log('Connecté au serveur Socket.io avec ID:', this.socket.id);
        });

        this.socket.on('disconnect', () => {
            console.log('Déconnecté du serveur.');
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }

    // Quitter une partie/salon : le serveur nous retire de la room à la déconnexion,
    // puis on se reconnecte aussitôt pour que l'accueil reste utilisable.
    leaveRoom() {
        if (!this.socket) return;
        this.offAll();
        this.socket.disconnect();
        setTimeout(() => this.socket && this.socket.connect(), 150);
    }

    // -- ROOM ACTIONS --
    createRoom(playerName, gameType, callback) {
        this.socket.emit('create_room', { playerName, gameType }, callback);
    }

    createBotRoom(playerName, botCount, gameType, callback) {
        this.socket.emit('create_bot_room', { playerName, botCount, gameType }, callback);
    }

    joinRoom(roomId, playerName, callback) {
        this.socket.emit('join_room', { roomId, playerName }, callback);
    }

    // -- MATCHMAKING ACTIONS --
    findMatch(playerName, targetSize, gameType, callback) {
        this.socket.emit('find_match', { playerName, targetSize, gameType }, callback);
    }

    cancelMatch() {
        this.socket.emit('cancel_match');
    }

    // -- IN-GAME ACTIONS --
    startGame(roomId) {
        this.socket.emit('start_game', { roomId });
    }

    playAgain(roomId) {
        this.socket.emit('play_again', { roomId });
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
