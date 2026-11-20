/**
 * Notifications du compte (la cloche) : demandes d'ami, amis acceptés, invitations à un salon.
 * Gardées par le serveur (même reçues hors ligne) ; les nouvelles arrivent en direct (« inbox »).
 */
import { useEffect, useState } from 'react';
import socketService from './socketService';
import accountService, { useAccount } from './accountService';

let state = { items: [], unread: 0, loaded: false };
const listeners = new Set();
const set = (patch) => { state = { ...state, ...patch }; listeners.forEach((fn) => fn(state)); };

const inboxService = {
    get state() { return state; },
    async refresh() {
        if (!accountService.state.token) { set({ items: [], unread: 0, loaded: true }); return state; }
        const r = await accountService.request('/api/inbox');
        if (r && Array.isArray(r.items)) set({ items: r.items, unread: r.unread || 0, loaded: true });
        return state;
    },
    async markAllRead() {
        if (!state.unread) return;
        set({ items: state.items.map((x) => ({ ...x, read: true })), unread: 0 });
        await accountService.request('/api/inbox/read', { method: 'POST', body: {} });
    },
};

let wired = false;
function wire() {
    if (wired) return;
    const attach = () => {
        if (!socketService.socket) { setTimeout(attach, 500); return; }
        wired = true;
        socketService.socket.on('inbox', (item) => {
            if (!item?.id || state.items.some((x) => x.id === item.id)) return;
            set({ items: [item, ...state.items].slice(0, 50), unread: state.unread + 1 });
        });
        socketService.socket.on('connect', () => inboxService.refresh());
    };
    attach();
}

export function useInbox() {
    const [s, setS] = useState(state);
    const account = useAccount();
    useEffect(() => {
        listeners.add(setS);
        wire();
        return () => listeners.delete(setS);
    }, []);
    useEffect(() => { inboxService.refresh(); }, [account.token]);
    return s;
}

export default inboxService;
