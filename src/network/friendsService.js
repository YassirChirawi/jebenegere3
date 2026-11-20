/**
 * Amis (avec un compte) : liste, demandes reçues et envoyées, invitations directes dans un salon.
 * La liste est rechargée quand le serveur prévient d'un changement (« friends_changed »).
 */
import { useEffect, useState } from 'react';
import socketService from './socketService';
import accountService, { useAccount } from './accountService';

let state = { friends: [], incoming: [], outgoing: [], loaded: false };
const listeners = new Set();
const set = (patch) => { state = { ...state, ...patch }; listeners.forEach((fn) => fn(state)); };

const friendsService = {
    get state() { return state; },

    async refresh() {
        if (!accountService.state.token) { set({ friends: [], incoming: [], outgoing: [], loaded: true }); return state; }
        const r = await accountService.request('/api/friends');
        if (r && Array.isArray(r.friends)) set({ friends: r.friends, incoming: r.incoming || [], outgoing: r.outgoing || [], loaded: true });
        return state;
    },
    async add(name) {
        const r = await accountService.request('/api/friends/request', { method: 'POST', body: { name } });
        if (!r.error) friendsService.refresh();
        return r;
    },
    async respond(id, accept) {
        const r = await accountService.request('/api/friends/respond', { method: 'POST', body: { id, accept } });
        friendsService.refresh();
        return r;
    },
    async remove(id) {
        const r = await accountService.request('/api/friends/remove', { method: 'POST', body: { id } });
        friendsService.refresh();
        return r;
    },
    /** Inviter un ami connecté dans le salon roomId. */
    invite(roomId, userId) {
        return new Promise((resolve) => {
            if (!socketService.socket?.connected) { resolve({ success: false, message: 'Pas de connexion au serveur.' }); return; }
            socketService.socket.timeout(5000).emit('friend_invite', { roomId, userId }, (err, r) => resolve(err ? { success: false, message: 'Le serveur ne répond pas.' } : r));
        });
    },
};

// Le serveur prévient : demande reçue, acceptée, ami retiré → on recharge
let wired = false;
function wire() {
    if (wired || !socketService.socket) return;
    wired = true;
    socketService.socket.on('friends_changed', () => friendsService.refresh());
    socketService.socket.on('connect', () => friendsService.refresh());
}

export function useFriends() {
    const [s, setS] = useState(state);
    const account = useAccount();
    useEffect(() => {
        listeners.add(setS);
        wire();
        return () => listeners.delete(setS);
    }, []);
    useEffect(() => { friendsService.refresh(); }, [account.token]);
    return s;
}

export default friendsService;
