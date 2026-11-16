import AsyncStorage from '@react-native-async-storage/async-storage';
import socketService from '../network/socketService';

/**
 * Tournois côté appareil : on garde seulement ce qui permet de revenir à ses tournois
 * (code, nom, ticket d'inscription secret, jeton d'organisateur). Rien d'autre.
 */
const KEY = 'myTournaments';
let cache = null;

async function load() {
    if (cache) return cache;
    try { cache = JSON.parse((await AsyncStorage.getItem(KEY)) || '{}') || {}; } catch (e) { cache = {}; }
    return cache;
}
async function persist() {
    try { await AsyncStorage.setItem(KEY, JSON.stringify(cache || {})); } catch (e) { /* ignore */ }
}

export async function myTournaments() {
    const all = await load();
    return Object.entries(all).map(([id, v]) => ({ id, ...v })).sort((a, b) => (a.startsAt || 0) - (b.startsAt || 0));
}

export async function getMine(id) {
    return (await load())[id] || {};
}

export async function remember(id, patch) {
    const all = await load();
    all[id] = { ...(all[id] || {}), ...patch };
    // On ne garde pas éternellement les tournois finis
    const entries = Object.entries(all);
    if (entries.length > 30) entries.sort((a, b) => (b[1].startsAt || 0) - (a[1].startsAt || 0)).slice(30).forEach(([k]) => delete all[k]);
    await persist();
}

export async function forget(id) {
    const all = await load();
    delete all[id];
    await persist();
}

/** Champion sans compte : la récompense est réclamée dès qu'il est connecté à un compte. */
export async function claimPendingRewards() {
    if (!socketService.supports('tournaments')) return;
    const all = await load();
    Object.entries(all).forEach(([id, v]) => {
        if (!v.pendingClaim || !v.ticket) return;
        socketService.tournamentClaim(id, v.ticket, (r) => {
            if (r?.success) remember(id, { pendingClaim: false });
        });
    });
}

export const GAME_LABEL = { hezz2: 'Hezz2', ronda: 'Ronda' };

export function formatWhen(ms) {
    const d = new Date(ms);
    const today = new Date();
    const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
    const same = (a, b) => a.toDateString() === b.toDateString();
    const hh = `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
    if (same(d, today)) return `aujourd'hui à ${hh}`;
    if (same(d, tomorrow)) return `demain à ${hh}`;
    const days = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
    return `${days[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1} à ${hh}`;
}

export function formatCountdown(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d) return `${d} j ${h} h`;
    if (h) return `${h} h ${String(m).padStart(2, '0')}`;
    return `${m}:${String(s % 60).padStart(2, '0')}`;
}
