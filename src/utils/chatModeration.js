import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import socketService from '../network/socketService';
import audioService from '../network/audioService';
import { dialog } from '../components/Dialog';

/**
 * Modération du chat côté appli :
 * - identifiant anonyme de l'appareil (pour pouvoir être bloqué / bloquer sans compte) ;
 * - liste des joueurs bloqués (sur l'appareil, et dans le compte si on est connecté) ;
 * - derniers messages reçus (pour les signaler depuis la fenêtre du chat) ;
 * - menu « Signaler / Bloquer » d'un message.
 * Le serveur applique le blocage dans les deux sens ; l'appli filtre aussi de son côté.
 */
const K_DEVICE = 'deviceId';
const K_BLOCKED = 'blockedPlayers';
const LOG_MAX = 20;

const state = {
    myKey: null,
    deviceId: null,
    blocked: [], // [{ key, name, at }]
    hidden: new Set(), // messages signalés : masqués pour moi
    log: [], // derniers messages reçus
};
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn({ ...state }));

const save = () => AsyncStorage.setItem(K_BLOCKED, JSON.stringify(state.blocked)).catch(() => {});
const randomId = () => Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

let ready = null;
export function initChatModeration() {
    if (ready) return ready;
    ready = (async () => {
        try {
            state.deviceId = await AsyncStorage.getItem(K_DEVICE);
            if (!state.deviceId) {
                state.deviceId = randomId();
                await AsyncStorage.setItem(K_DEVICE, state.deviceId);
            }
            const raw = await AsyncStorage.getItem(K_BLOCKED);
            state.blocked = raw ? JSON.parse(raw) : [];
        } catch (e) { /* stockage indisponible : on continue en mémoire */ }
        if (!state.deviceId) state.deviceId = randomId();
        // À chaque connexion au serveur (server_info) et après connexion à un compte : on se présente
        socketService.onServerInfo(() => sync());
        socketService.onAuthed(() => sync());
        notify();
    })();
    return ready;
}

// Envoie l'identifiant de l'appareil et la liste des bloqués ; récupère celle du compte
async function sync() {
    await ready;
    if (!socketService.supports('chat_moderation') || !socketService.socket?.connected) return;
    socketService.socket.timeout(5000).emit('client_info', { deviceId: state.deviceId, blocked: state.blocked }, (err, r) => {
        if (err || !r?.success) return;
        state.myKey = r.key || null;
        if (Array.isArray(r.blocked)) {
            state.blocked = r.blocked;
            save();
        }
        notify();
    });
}

function pushBlocked() {
    save();
    notify();
    if (socketService.supports('chat_moderation') && socketService.socket?.connected) {
        socketService.socket.emit('set_blocked', { blocked: state.blocked });
    }
}

export const isBlockedKey = (key) => !!key && state.blocked.some((b) => b.key === key);
// Mes messages : reconnus par ma connexion (deux onglets d'un même navigateur restent deux joueurs)
export const isMine = (msg) => {
    if (!msg) return false;
    if (msg.sid) return msg.sid === socketService.socket?.id;
    return !!msg.from && msg.from === state.myKey;
};
// Même compte connecté ailleurs : on ne peut pas se bloquer soi-même
const isMyKey = (key) => !!key && key === state.myKey;
export const shouldHide = (msg) => !!msg && (state.hidden.has(msg.id) || isBlockedKey(msg.from));

// Nouveau message reçu (appelé par le chat de la partie)
export function logMessage(msg) {
    if (!msg?.id || shouldHide(msg)) return;
    state.log = [...state.log.filter((m) => m.id !== msg.id), msg].slice(-LOG_MAX);
    notify();
}

export function blockPlayer(key, name) {
    if (!key || isBlockedKey(key) || isMyKey(key)) return;
    state.blocked = [...state.blocked, { key, name: String(name || 'Joueur').slice(0, 24), at: Date.now() }];
    state.log = state.log.filter((m) => m.from !== key);
    pushBlocked();
}

export function unblockPlayer(key) {
    state.blocked = state.blocked.filter((b) => b.key !== key);
    pushBlocked();
}

function hideMessage(id) {
    state.hidden.add(id);
    state.log = state.log.filter((m) => m.id !== id);
    notify();
}

const REASONS = [
    { id: 'insulte', label: '🤬 Insulte' },
    { id: 'spam', label: '📢 Spam' },
    { id: 'triche', label: '🃏 Triche' },
    { id: 'autre', label: '❓ Autre' },
];

function report(msg, reason) {
    if (!socketService.supports('chat_moderation')) {
        dialog.alert('Signalement impossible', "Le serveur du jeu n'est pas encore à jour. Tu peux quand même bloquer ce joueur.");
        return;
    }
    socketService.socket.timeout(6000).emit('report_chat', { messageId: msg.id, reason }, (err, r) => {
        if (err || !r?.success) {
            audioService.playSound('error');
            dialog.alert('Signalement non envoyé', r?.message || 'Le serveur ne répond pas, réessaie.');
            return;
        }
        hideMessage(msg.id);
        dialog.alert('Merci 🙏', 'Signalement envoyé. Ce message est masqué pour toi.');
    });
}

function reportMenu(msg) {
    dialog.alert('Signaler ce message', 'Pour quelle raison ?', [
        ...REASONS.map((r) => ({ text: r.label, onPress: () => report(msg, r.id) })),
        { text: 'Annuler', style: 'cancel' },
    ]);
}

function confirmBlock(msg) {
    blockPlayer(msg.from, msg.playerName);
    dialog.alert(
        `${msg.playerName} est bloqué`,
        "Tu ne verras plus ses messages, et il ne verra plus les tiens, dans cette partie et les suivantes. Tu peux le débloquer depuis ton profil.",
    );
}

// Menu d'un message : Signaler / Bloquer le joueur
export function openMessageMenu(msg) {
    if (!msg || isMine(msg)) return;
    const buttons = [{ text: '🚩 Signaler', onPress: () => reportMenu(msg) }];
    if (msg.from && !isMyKey(msg.from)) buttons.push({ text: `🚫 Bloquer ${msg.playerName}`, style: 'destructive', onPress: () => confirmBlock(msg) });
    buttons.push({ text: 'Annuler', style: 'cancel' });
    dialog.alert(`Message de ${msg.playerName}`, `« ${msg.message} »`, buttons);
}

export function useChatModeration() {
    const [snap, setSnap] = useState({ ...state });
    useEffect(() => {
        listeners.add(setSnap);
        setSnap({ ...state });
        return () => listeners.delete(setSnap);
    }, []);
    return snap;
}

// Suppression du compte : on oublie aussi la liste locale des bloqués
export async function clearBlocked() {
    state.blocked = [];
    state.log = [];
    await AsyncStorage.removeItem(K_BLOCKED).catch(() => {});
    notify();
}
