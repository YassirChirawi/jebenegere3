import { io } from 'socket.io-client';

// Replace with the computer's actual local IPv4 address so your phone can reach it on the Wi-Fi
const SOCKET_URL = 'https://jebenegere3.onrender.com/'; // Production backend on render.com

class SocketService {
    socket;

    connect() {
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

    // -- ROOM ACTIONS --
    createRoom(playerName, callback) {
        this.socket.emit('create_room', { playerName }, callback);
    }

    createBotRoom(playerName, botCount, callback) {
        this.socket.emit('create_bot_room', { playerName, botCount }, callback);
    }

    joinRoom(roomId, playerName, callback) {
        this.socket.emit('join_room', { roomId, playerName }, callback);
    }

    // -- IN-GAME ACTIONS --
    startGame(roomId) {
        this.socket.emit('start_game', { roomId });
    }

    playCard(roomId, cardIndex, newSuitFor7) {
        this.socket.emit('play_card', { roomId, cardIndex, newSuitFor7 });
    }

    drawCard(roomId) {
        this.socket.emit('draw_card', { roomId });
    }

    sendChat(roomId, message) {
        this.socket.emit('send_chat', { roomId, message });
    }

    // -- LISTENERS --
    onRoomUpdated(callback) {
        this.socket.on('room_updated', callback);
    }

    onGameStarted(callback) {
        this.socket.on('game_started', callback);
    }

    onGameStateUpdate(callback) {
        this.socket.on('game_state_update', callback);
    }

    onChatMessage(callback) {
        this.socket.on('chat_message', callback);
    }

    onGameError(callback) {
        this.socket.on('game_error', callback);
    }

    onTimerTick(callback) {
        this.socket.on('timer_tick', callback);
    }

    offAll() {
        if (this.socket) {
            this.socket.off('room_updated');
            this.socket.off('game_started');
            this.socket.off('game_state_update');
            this.socket.off('game_error');
            this.socket.off('timer_tick');
            this.socket.off('chat_message');
        }
    }
}

const socketService = new SocketService();
export default socketService;
