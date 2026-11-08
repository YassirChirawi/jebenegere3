/**
 * Personnalisation : dos de cartes, tapis par jeu, réglage des vibrations.
 * Stockage local (AsyncStorage). Les déblocages dépendent de l'XP (rangs) ; la phase 2 ajoutera
 * les défis et la sauvegarde côté serveur.
 */
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setHapticsEnabled } from '../components/ui';

// Seuils d'XP = début des rangs existants (Zmagri 201, fchkel 501, chdid 1001)
export const UNLOCK = {
    free: { xp: 0, label: 'Disponible' },
    zmagri: { xp: 201, label: 'Rang Zmagri 🥉' },
    fchkel: { xp: 501, label: 'Rang fchkel 🥈' },
    chdid: { xp: 1001, label: 'Rang chdid 🥇' },
};

// Palettes de dos : fond, cadre, filets, médaillon, étoile
export const BACKS = {
    classic: { label: 'Classique', unlock: 'free', bg: '#7A1420', frame: '#8E1B28', border: '#C9A23A', line: 'rgba(245, 215, 122, 0.75)', lattice: 'rgba(245, 215, 122, 0.28)', medal: '#5E0F18', medalBorder: '#E3BF5A', star: '#D4AF37' },
    game: { label: 'Couleurs du jeu', unlock: 'free', perGame: true },
    gold: { label: 'Doré', unlock: 'free', bg: '#A67C1A', frame: '#C9A23A', border: '#FFF1B8', line: 'rgba(90, 50, 5, 0.6)', lattice: 'rgba(90, 50, 5, 0.25)', medal: '#5B3A0A', medalBorder: '#FFE08A', star: '#FFE08A' },
    zellige: { label: 'Zellige', unlock: 'fchkel', bg: '#0E4D5C', frame: '#11606F', border: '#F5D77A', line: 'rgba(255, 255, 255, 0.55)', lattice: 'rgba(110, 231, 183, 0.35)', medal: '#0A3540', medalBorder: '#6EE7B7', star: '#F5D77A' },
    nuit: { label: 'Nuit étoilée', unlock: 'chdid', bg: '#0F0A2A', frame: '#1A1340', border: '#E3BF5A', line: 'rgba(227, 191, 90, 0.7)', lattice: 'rgba(196, 181, 253, 0.3)', medal: '#2E1065', medalBorder: '#C4B5FD', star: '#FDE68A' },
};

// Dos "couleurs du jeu"
const GAME_BACKS = {
    hezz2: { bg: '#1F5A33', frame: '#246B3C', border: '#C9A23A', line: 'rgba(245, 215, 122, 0.7)', lattice: 'rgba(245, 215, 122, 0.25)', medal: '#123D22', medalBorder: '#E3BF5A', star: '#D4AF37' },
    ronda: { bg: '#13285C', frame: '#1A3270', border: '#C9A23A', line: 'rgba(191, 219, 254, 0.6)', lattice: 'rgba(191, 219, 254, 0.25)', medal: '#0B1A40', medalBorder: '#93C5FD', star: '#F5D77A' },
    kdoub: { bg: '#5B0E14', frame: '#701219', border: '#F59E0B', line: 'rgba(252, 165, 165, 0.6)', lattice: 'rgba(252, 165, 165, 0.25)', medal: '#3B070C', medalBorder: '#FCA5A5', star: '#F59E0B' },
    sota: { bg: '#3B0764', frame: '#4C0B80', border: '#C9A23A', line: 'rgba(233, 213, 255, 0.6)', lattice: 'rgba(233, 213, 255, 0.25)', medal: '#25043F', medalBorder: '#D8B4FE', star: '#F5D77A' },
};

// Tapis : couleur appliquée sur la table (mode "couleur" : garde les motifs, change la teinte)
export const FELTS = {
    hezz2: [
        { id: 'default', label: 'Vert café', unlock: 'free', color: '#0E5A2E', strength: 0.62 },
        { id: 'cuivre', label: 'Cuivre', unlock: 'zmagri', color: '#8A4513', strength: 0.6 },
        { id: 'majorelle', label: 'Bleu Majorelle', unlock: 'fchkel', color: '#1D3FD8', strength: 0.55 },
    ],
    ronda: [
        { id: 'default', label: 'Bleu nuit', unlock: 'free', color: '#0B2259', strength: 0.5 },
        { id: 'menthe', label: 'Vert menthe', unlock: 'zmagri', color: '#047857', strength: 0.6 },
        { id: 'sable', label: 'Sable du désert', unlock: 'fchkel', color: '#8B6A2B', strength: 0.6 },
    ],
    kdoub: [
        { id: 'default', label: 'Rouge sombre', unlock: 'free', color: '#6B0F18', strength: 0.66 },
        { id: 'epice', label: 'Épices', unlock: 'zmagri', color: '#9A3412', strength: 0.62 },
        { id: 'encre', label: 'Encre noire', unlock: 'fchkel', color: '#1F1A24', strength: 0.7 },
    ],
    sota: [
        { id: 'default', label: 'Violet nuit', unlock: 'free', color: '#3B0A6B', strength: 0.64 },
        { id: 'prune', label: 'Prune', unlock: 'zmagri', color: '#6B1D4F', strength: 0.62 },
        { id: 'indigo', label: 'Indigo', unlock: 'fchkel', color: '#1E1B5B', strength: 0.64 },
    ],
};

export const isUnlocked = (unlock, xp) => (xp || 0) >= (UNLOCK[unlock]?.xp ?? 0);

let state = { back: 'classic', felts: {}, xp: 0, game: 'hezz2', vibration: true, loaded: false };
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn(state));
const save = () => AsyncStorage.setItem('cosmetics', JSON.stringify({ back: state.back, felts: state.felts, vibration: state.vibration })).catch(() => {});

export async function loadCosmetics() {
    try {
        const [raw, xp] = await Promise.all([AsyncStorage.getItem('cosmetics'), AsyncStorage.getItem('playerXP')]);
        const saved = JSON.parse(raw || '{}') || {};
        state = { ...state, ...saved, felts: saved.felts || {}, xp: parseInt(xp || '0', 10), loaded: true };
    } catch (e) {
        state = { ...state, loaded: true };
    }
    setHapticsEnabled(state.vibration !== false);
    emit();
    return state;
}

export async function refreshXp() {
    try {
        state = { ...state, xp: parseInt((await AsyncStorage.getItem('playerXP')) || '0', 10) };
        emit();
    } catch (e) { /* ignore */ }
}

export function setBack(id) {
    if (!BACKS[id] || !isUnlocked(BACKS[id].unlock, state.xp)) return false;
    state = { ...state, back: id };
    save();
    emit();
    return true;
}

export function setFelt(game, id) {
    const f = (FELTS[game] || []).find((x) => x.id === id);
    if (!f || !isUnlocked(f.unlock, state.xp)) return false;
    state = { ...state, felts: { ...state.felts, [game]: id } };
    save();
    emit();
    return true;
}

export function setVibration(on) {
    state = { ...state, vibration: !!on };
    setHapticsEnabled(!!on);
    save();
    emit();
}

// Jeu en cours (pour le dos "couleurs du jeu")
export function setCurrentGame(game) {
    if (state.game === game) return;
    state = { ...state, game };
    emit();
}

export function backPalette(s = state, game = s.game) {
    let id = s.back;
    if (!BACKS[id] || !isUnlocked(BACKS[id].unlock, s.xp)) id = 'classic';
    if (BACKS[id].perGame) return GAME_BACKS[game] || GAME_BACKS.hezz2;
    return BACKS[id];
}

export function feltFor(game, s = state) {
    const list = FELTS[game] || FELTS.hezz2;
    const chosen = list.find((f) => f.id === s.felts?.[game]);
    return chosen && isUnlocked(chosen.unlock, s.xp) ? chosen : list[0];
}

export function useCosmetics() {
    const [s, set] = useState(state);
    useEffect(() => {
        listeners.add(set);
        set(state);
        return () => listeners.delete(set);
    }, []);
    return s;
}

export const getCosmetics = () => state;
