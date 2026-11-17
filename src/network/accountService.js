/**
 * Compte joueur (phase 2) : inscription / connexion par pseudo + mot de passe, profil serveur,
 * classement de la saison. Le jeton est gardé dans AsyncStorage ; sans compte, l'appli
 * fonctionne comme avant (progression locale).
 */
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import socketService, { SOCKET_URL } from './socketService';
import { Platform } from 'react-native';
import { setUnlocks, loadCosmetics } from '../utils/cosmetics';
import { clearBlocked } from '../utils/chatModeration';

const OUTDATED = "Le serveur du jeu n'est pas encore à jour : la suppression du compte n'est pas disponible pour l'instant. Ton compte n'a pas été supprimé, réessaie plus tard.";

const BASE = SOCKET_URL.replace(/\/+$/, '');

let state = { token: null, profile: null, loading: true, error: null, guestAvatar: 0 };
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn(state));
const set = (patch) => {
    state = { ...state, ...patch };
    if (patch.profile !== undefined) syncLocal(state.profile);
    emit();
};

// Garde l'affichage local (rang de l'accueil, déblocages) aligné sur le profil serveur
function syncLocal(profile) {
    if (!profile) { setUnlocks([], null); return; }
    setUnlocks(profile.unlocks || [], profile.xp);
    AsyncStorage.setItem('playerXP', String(profile.xp)).catch(() => {});
    AsyncStorage.setItem('playerName', profile.name).catch(() => {});
}

async function request(path, { method = 'GET', body, token = state.token, timeout = 15000 } = {}) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = ctrl ? setTimeout(() => ctrl.abort(), timeout) : null;
    try {
        const res = await fetch(BASE + path, {
            method,
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: body ? JSON.stringify(body) : undefined,
            signal: ctrl?.signal,
        });
        let data = {};
        try { data = await res.json(); } catch (e) { /* réponse vide */ }
        if (res.status === 404) return { error: "Le serveur n'est pas à jour (comptes indisponibles)." };
        return { status: res.status, ...data };
    } catch (e) {
        return { error: 'Serveur injoignable. Réessaie dans un instant (il se réveille peut-être).' };
    } finally {
        if (t) clearTimeout(t);
    }
}

function authSocket() {
    socketService.setAuthToken(state.token);
}

const accountService = {
    get state() { return state; },

    /** Portrait du joueur : celui du compte, sinon celui choisi sur l'appareil. */
    myAvatar() {
        return state.profile ? (state.profile.avatar || 0) : (state.guestAvatar || 0);
    },

    /** Choix du portrait : enregistré dans le compte, ou sur l'appareil pour un invité. */
    async setAvatar(i) {
        if (state.profile) return accountService.update({ avatar: i });
        set({ guestAvatar: i });
        socketService.setGuestAvatar(i);
        try { await AsyncStorage.setItem('guestAvatar', String(i)); } catch (e) { /* ignore */ }
        return { success: true };
    },

    async init() {
        try {
            const guest = parseInt((await AsyncStorage.getItem('guestAvatar')) || '0', 10);
            socketService.guestAvatar = Number.isInteger(guest) && guest >= 0 && guest <= 12 ? guest : 0;
            set({ guestAvatar: socketService.guestAvatar });
            const token = await AsyncStorage.getItem('authToken');
            if (!token) { set({ loading: false }); authSocket(); return; }
            const cached = JSON.parse((await AsyncStorage.getItem('authProfile')) || 'null');
            set({ token, profile: cached, loading: true });
            authSocket();
            await accountService.refresh();
        } catch (e) {
            set({ loading: false });
        }
    },

    async refresh() {
        if (!state.token) return null;
        const r = await request('/api/me');
        if (r.status === 401) { await accountService.logout(true); return null; }
        if (r.profile) {
            set({ profile: r.profile, loading: false, error: null });
            AsyncStorage.setItem('authProfile', JSON.stringify(r.profile)).catch(() => {});
            return r.profile;
        }
        set({ loading: false });
        return state.profile;
    },

    async register(name, password, importXp) {
        const r = await request('/api/register', { method: 'POST', body: { name, password, importXp }, token: null });
        if (r.error) return r;
        await accountService._signedIn(r);
        return r;
    },

    async login(name, password) {
        const r = await request('/api/login', { method: 'POST', body: { name, password }, token: null });
        if (r.error) return r;
        await accountService._signedIn(r);
        return r;
    },

    async _signedIn({ token, profile }) {
        await AsyncStorage.setItem('authToken', token).catch(() => {});
        await AsyncStorage.setItem('authProfile', JSON.stringify(profile)).catch(() => {});
        set({ token, profile, loading: false, error: null });
        authSocket();
    },

    async logout(expired = false) {
        if (state.token && !expired) request('/api/logout', { method: 'POST' });
        await AsyncStorage.multiRemove(['authToken', 'authProfile']).catch(() => {});
        set({ token: null, profile: null, loading: false });
        authSocket();
    },

    async update(patch) {
        const r = await request('/api/me', { method: 'POST', body: patch });
        if (r.profile) {
            set({ profile: r.profile });
            AsyncStorage.setItem('authProfile', JSON.stringify(r.profile)).catch(() => {});
            authSocket(); // titre / avatar à jour dans les prochains salons
        }
        return r;
    },

    /**
     * Supprime définitivement le compte sur le serveur, puis efface toutes les données de l'appareil
     * (pseudo, XP, stats, historique, dos et tapis, joueurs bloqués, réglages) et déconnecte.
     */
    async deleteAccount() {
        if (!state.token) return { error: "Tu n'es pas connecté à un compte." };
        if (socketService.serverInfo && !socketService.supports('account_delete')) return { error: OUTDATED };
        const r = await request('/api/me', { method: 'DELETE' });
        if (r.status === 404 || (r.error && /pas à jour/.test(r.error))) return { error: OUTDATED };
        if (r.status === 401) return { error: 'Ta session a expiré : reconnecte-toi, puis recommence la suppression.' };
        if (!r.success) return { error: r.error || 'Erreur du serveur, ton compte n\'a pas été supprimé. Réessaie.' };
        await accountService.wipeLocal();
        return { success: true };
    },

    // Efface tout ce que l'appli garde sur l'appareil
    async wipeLocal() {
        await AsyncStorage.clear().catch(() => {});
        set({ token: null, profile: null, loading: false, error: null });
        authSocket();
        await clearBlocked();
        await loadCosmetics().catch(() => {});
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            // Repart d'une page propre (états en mémoire remis à zéro)
            setTimeout(() => window.location.replace('/'), 300);
        }
    },

    leaderboard(game = 'all') {
        return request(`/api/leaderboard?game=${encodeURIComponent(game)}`);
    },

    // Fin de partie : le serveur envoie le profil à jour
    applyProgress(p) {
        if (p?.profile && state.token) {
            set({ profile: p.profile });
            AsyncStorage.setItem('authProfile', JSON.stringify(p.profile)).catch(() => {});
        }
    },
};

export function useAccount() {
    const [s, setS] = useState(state);
    useEffect(() => {
        listeners.add(setS);
        setS(state);
        return () => listeners.delete(setS);
    }, []);
    return s;
}

export default accountService;
