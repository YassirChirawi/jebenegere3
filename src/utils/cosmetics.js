/**
 * Personnalisation : dos de cartes, tapis par jeu, réglage des vibrations.
 * Stockage local (AsyncStorage). Les déblocages dépendent de l'XP (rangs) ; la phase 2 ajoutera
 * les défis et la sauvegarde côté serveur.
 */
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setHapticsEnabled } from '../components/ui';

// Seuils d'XP = début des rangs existants (Hara o kan 201, fchkel 501, chdid 1001)
export const UNLOCK = {
    free: { xp: 0, label: 'Disponible' },
    zmagri: { xp: 201, label: 'Rang Hara o kan 🥉' },
    fchkel: { xp: 501, label: 'Rang fchkel 🥈' },
    chdid: { xp: 1001, label: 'Rang chdid 🥇' },
    // Récompenses de défis, de saison et de tournoi (liste "unlocks" du compte)
    challenge: { xp: Infinity, label: 'Défi du jour ou boutique' },
    season: { xp: Infinity, label: 'Top 10 saison ou coffre Or' },
    tournament: { xp: Infinity, label: 'Gagner un tournoi 🏅' },
    shop: { xp: Infinity, label: 'Boutique 💰' },
    bingaTournament: { xp: Infinity, label: 'Tournoi à entrée en binga 🏆' },
    chest: { xp: Infinity, label: 'Coffre Or' },
};

// Palettes de dos : fond, cadre, filets, médaillon, étoile
export const BACKS = {
    classic: { label: 'Classique', unlock: 'free', bg: '#7A1420', frame: '#8E1B28', border: '#C9A23A', line: 'rgba(245, 215, 122, 0.75)', lattice: 'rgba(245, 215, 122, 0.28)', medal: '#5E0F18', medalBorder: '#E3BF5A', star: '#D4AF37' },
    game: { label: 'Couleurs du jeu', unlock: 'free', perGame: true },
    gold: { label: 'Doré', unlock: 'free', bg: '#A67C1A', frame: '#C9A23A', border: '#FFF1B8', line: 'rgba(90, 50, 5, 0.6)', lattice: 'rgba(90, 50, 5, 0.25)', medal: '#5B3A0A', medalBorder: '#FFE08A', star: '#FFE08A' },
    zellige: { label: 'Zellige', unlock: 'fchkel', alsoShop: true, pattern: 'zellige', bg: '#0E4D5C', frame: '#11606F', border: '#F5D77A', line: 'rgba(255, 255, 255, 0.55)', lattice: 'rgba(110, 231, 183, 0.35)', medal: '#0A3540', medalBorder: '#6EE7B7', star: '#F5D77A' },
    nuit: { label: 'Nuit étoilée', unlock: 'chdid', bg: '#0F0A2A', frame: '#1A1340', border: '#E3BF5A', line: 'rgba(227, 191, 90, 0.7)', lattice: 'rgba(196, 181, 253, 0.3)', medal: '#2E1065', medalBorder: '#C4B5FD', star: '#FDE68A' },
    menthe: { label: 'Thé à la menthe', unlock: 'challenge', pattern: 'leaf', medalIcon: 'leaf', bg: '#0F5E3A', frame: '#13704A', border: '#E5E7EB', line: 'rgba(209, 250, 229, 0.7)', lattice: 'rgba(110, 231, 183, 0.35)', medal: '#C0C0C0', medalBorder: '#F9FAFB', star: '#0F5E3A' },
    cuivre: { label: 'Cuivre martelé', unlock: 'challenge', pattern: 'hammered', bg: '#7C3A12', frame: '#94481A', border: '#FCD9B6', line: 'rgba(252, 217, 182, 0.65)', lattice: 'rgba(252, 217, 182, 0.3)', medal: '#4A2008', medalBorder: '#F59E0B', star: '#FCD9B6' },
    rose: { label: 'Rose de Kelaa', unlock: 'challenge', bg: '#9D174D', frame: '#B01E5A', border: '#FBCFE8', line: 'rgba(251, 207, 232, 0.7)', lattice: 'rgba(251, 207, 232, 0.3)', medal: '#5B0B2C', medalBorder: '#F9A8D4', star: '#FDE68A' },
    saison: { label: 'Saison', unlock: 'season', pattern: 'sunburst', medalIcon: 'moon', bg: '#1E1B4B', frame: '#2E2A6B', border: '#FDE68A', line: 'rgba(253, 230, 138, 0.85)', lattice: 'rgba(253, 230, 138, 0.35)', medal: '#B45309', medalBorder: '#FDE68A', star: '#FFFBEB' },
    // Dos de la boutique (lot 2) : dessins propres à chacun
    velours: { label: 'Velours rouge', unlock: 'shop', pattern: 'velvet', bg: '#5C0A16', frame: '#7A0E1E', border: '#E8C26A', line: 'rgba(232, 194, 106, 0.8)', lattice: 'rgba(0, 0, 0, 0.35)', medal: '#3D0610', medalBorder: '#E8C26A', star: '#E8C26A' },
    sahara: { label: 'Sahara', unlock: 'shop', pattern: 'dunes', medalIcon: 'sun', bg: '#B8742C', frame: '#D08A3A', border: '#FFF1D6', line: 'rgba(255, 241, 214, 0.75)', lattice: '#9A5A1E', medal: '#7C3F12', medalBorder: '#FFE4B5', star: '#FFD27A' },
    ocean: { label: 'Océan', unlock: 'shop', pattern: 'waves', medalIcon: 'wave', bg: '#063B5C', frame: '#0A4F78', border: '#A5F3FC', line: 'rgba(165, 243, 252, 0.75)', lattice: 'rgba(103, 232, 249, 0.55)', medal: '#04263D', medalBorder: '#67E8F9', star: '#E0FBFF' },
    neon: { label: 'Néon', unlock: 'shop', pattern: 'neon', medalIcon: 'ring', bg: '#07030F', frame: '#0D0620', border: '#F0ABFC', line: 'rgba(240, 171, 252, 0.9)', lattice: '#22D3EE', medal: '#12062A', medalBorder: '#F472B6', star: '#22D3EE' },
    or: { label: 'Or', unlock: 'chest', pattern: 'arabesque', medalIcon: 'crown', bg: '#8A6410', frame: '#B8891E', border: '#FFF6C9', line: 'rgba(255, 246, 201, 0.9)', lattice: 'rgba(255, 236, 160, 0.75)', medal: '#5A3E06', medalBorder: '#FFF1A8', star: '#FFE9A0' },
    // Dos « Sultan » : réservé au gagnant d'un tournoi à entrée en binga
    sultan: { label: 'Sultan', unlock: 'bingaTournament', pattern: 'zellige', medalIcon: 'crown', bg: '#0B4D2C', frame: '#0E6238', border: '#F5D77A', line: 'rgba(245, 215, 122, 0.85)', lattice: 'rgba(245, 215, 122, 0.3)', medal: '#073B21', medalBorder: '#F5D77A', star: '#F5D77A' },
    // Dos « Champion » : rouge et or, couronne au centre (réservé aux vainqueurs de tournoi)
    tournoi: { label: 'Champion', unlock: 'tournament', pattern: 'sunburst', bg: '#8E0E1C', frame: '#A3132A', border: '#F5D77A', line: 'rgba(245, 215, 122, 0.9)', lattice: 'rgba(245, 215, 122, 0.32)', medal: '#5E0A12', medalBorder: '#FFE08A', star: '#F5D77A', crown: true },
};

// Tables de la boutique (images de Yassir, scripts/build-table-skins.py) : remplacent la table du jeu, pour les 4 jeux.
// Le tapis fait partie de l'image : pas de teinte par-dessus.
export const TABLE_SKINS = {
    vert: { label: 'Vert classique', src: require('../../assets/tables/skins/vert.jpg'), portrait: require('../../assets/tables/skins/vert-portrait.jpg') },
    velours: { label: 'Velours rouge', src: require('../../assets/tables/skins/velours.jpg'), portrait: require('../../assets/tables/skins/velours-portrait.jpg') },
    cuivre: { label: 'Cuivre sculpté', src: require('../../assets/tables/skins/cuivre.jpg'), portrait: require('../../assets/tables/skins/cuivre-portrait.jpg') },
    zellige: { label: 'Zellige', src: require('../../assets/tables/skins/zellige.jpg'), portrait: require('../../assets/tables/skins/zellige-portrait.jpg') },
    turquoise: { label: 'Turquoise', src: require('../../assets/tables/skins/turquoise.jpg'), portrait: require('../../assets/tables/skins/turquoise-portrait.jpg') },
    nuit: { label: 'Nuit (marbre noir)', src: require('../../assets/tables/skins/nuit.jpg'), portrait: require('../../assets/tables/skins/nuit-portrait.jpg') },
    sahara: { label: 'Sahara', src: require('../../assets/tables/skins/sahara.jpg'), portrait: require('../../assets/tables/skins/sahara-portrait.jpg') },
    pourpre: { label: 'Pourpre royal', src: require('../../assets/tables/skins/pourpre.jpg'), portrait: require('../../assets/tables/skins/pourpre-portrait.jpg') },
};
const SKIN_W = 760;
const SKIN_H = 248;

// Effets de victoire et de coup spécial (visuels seulement). « Drapeau » : les confettis d'origine, offerts.
export const EFFECTS = {
    drapeau: { label: 'Drapeau', unlock: 'free' },
    confettis: { label: 'Confettis', unlock: 'shop' },
    etoiles: { label: 'Étoiles', unlock: 'shop' },
    menthe: { label: 'Menthe', unlock: 'shop' },
    feu: { label: 'Feu', unlock: 'shop' },
    tonnerre: { label: 'Tonnerre', unlock: 'shop' },
    or: { label: 'Or', unlock: 'chest' },
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
        { id: 'tadelakt', label: 'Tadelakt', unlock: 'challenge', color: '#A0522D', strength: 0.5 },
    ],
    ronda: [
        { id: 'default', label: 'Bleu nuit', unlock: 'free', color: '#0B2259', strength: 0.5 },
        { id: 'menthe', label: 'Vert menthe', unlock: 'zmagri', color: '#047857', strength: 0.6 },
        { id: 'sable', label: 'Sable du désert', unlock: 'fchkel', color: '#8B6A2B', strength: 0.6 },
        { id: 'safran', label: 'Safran', unlock: 'challenge', color: '#C2410C', strength: 0.55 },
    ],
    kdoub: [
        { id: 'default', label: 'Rouge sombre', unlock: 'free', color: '#6B0F18', strength: 0.66 },
        { id: 'epice', label: 'Épices', unlock: 'zmagri', color: '#9A3412', strength: 0.62 },
        { id: 'encre', label: 'Encre noire', unlock: 'fchkel', color: '#1F1A24', strength: 0.7 },
        { id: 'braise', label: 'Braise', unlock: 'challenge', color: '#B91C1C', strength: 0.6 },
    ],
    sota: [
        { id: 'default', label: 'Violet nuit', unlock: 'free', color: '#3B0A6B', strength: 0.64 },
        { id: 'prune', label: 'Prune', unlock: 'zmagri', color: '#6B1D4F', strength: 0.62 },
        { id: 'indigo', label: 'Indigo', unlock: 'fchkel', color: '#1E1B5B', strength: 0.64 },
        { id: 'lavande', label: 'Lavande', unlock: 'challenge', color: '#7C3AED', strength: 0.55 },
    ],
};

export const isUnlocked = (unlock, xp) => (xp || 0) >= (UNLOCK[unlock]?.xp ?? 0);

// Un élément est disponible si le rang est atteint, ou s'il figure dans le compte (défi, saison, tournoi,
// boutique, coffre). key : 'back:menthe', 'effect:feu' ou 'felt:hezz2:tadelakt'
export const itemUnlocked = (item, key, s = state) => (s.unlocks || []).includes(key) || isUnlocked(item.unlock, s.xp);

let state = { back: 'classic', felts: {}, effect: 'drapeau', table: null, xp: 0, game: 'hezz2', vibration: true, loaded: false, unlocks: [] };
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn(state));
// Choix gardés aussi dans le compte (retrouvés après une réinstallation) : voir accountService
let syncHandler = null;
export function setSyncHandler(fn) { syncHandler = fn; }
const equipped = () => ({ back: state.back, effect: state.effect, felts: state.felts, ...(state.table ? { table: state.table } : {}) });
const save = (sync = true) => {
    AsyncStorage.setItem('cosmetics', JSON.stringify({ back: state.back, felts: state.felts, effect: state.effect, table: state.table, vibration: state.vibration })).catch(() => {});
    if (sync && syncHandler) syncHandler(equipped());
};
export const currentEquipped = equipped;

// Choix enregistrés dans le compte : appliqués à l'appareil (sans renvoyer au serveur)
export function applyEquipped(e) {
    if (!e) return;
    const next = { ...state };
    if (e.back && BACKS[e.back]) next.back = e.back;
    if (e.effect && EFFECTS[e.effect]) next.effect = e.effect;
    next.table = e.table && TABLE_SKINS[e.table] ? e.table : null;
    if (e.felts) next.felts = { ...next.felts, ...e.felts };
    state = next;
    save(false);
    emit();
}

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
        state = { ...state, xp: Math.max(state.xp || 0, parseInt((await AsyncStorage.getItem('playerXP')) || '0', 10)) };
        emit();
    } catch (e) { /* ignore */ }
}

// Profil serveur : récompenses débloquées et XP
export function setUnlocks(unlocks, xp) {
    state = { ...state, unlocks: unlocks || [], ...(xp !== null && xp !== undefined ? { xp } : {}) };
    emit();
}

export function setBack(id) {
    if (!BACKS[id] || !itemUnlocked(BACKS[id], `back:${id}`)) return false;
    state = { ...state, back: id };
    save();
    emit();
    return true;
}

export function setFelt(game, id) {
    const f = (FELTS[game] || []).find((x) => x.id === id);
    if (!f || !itemUnlocked(f, `felt:${game}:${id}`)) return false;
    state = { ...state, felts: { ...state.felts, [game]: id } };
    save();
    emit();
    return true;
}

// Table de la boutique (null = la table du jeu)
export function setTable(id) {
    if (id !== null && (!TABLE_SKINS[id] || !(state.unlocks || []).includes(`table:${id}`))) return false;
    state = { ...state, table: id };
    save();
    emit();
    return true;
}

// Table choisie (si elle est toujours possédée) : { src, portrait, w, h }, sinon null
export function tableFor(s = state) {
    const id = s.table;
    if (!id || !TABLE_SKINS[id] || !(s.unlocks || []).includes(`table:${id}`)) return null;
    return { ...TABLE_SKINS[id], w: SKIN_W, h: SKIN_H };
}

export function setEffect(id) {
    if (!EFFECTS[id] || !itemUnlocked(EFFECTS[id], `effect:${id}`)) return false;
    state = { ...state, effect: id };
    save();
    emit();
    return true;
}

// Effet choisi, s'il est toujours débloqué (sinon l'effet offert)
export function effectFor(s = state) {
    const id = s.effect;
    return EFFECTS[id] && itemUnlocked(EFFECTS[id], `effect:${id}`, s) ? id : 'drapeau';
}

export function setVibration(on) {
    state = { ...state, vibration: !!on };
    setHapticsEnabled(!!on);
    save(false);
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
    if (!BACKS[id] || !itemUnlocked(BACKS[id], `back:${id}`, s)) id = 'classic';
    if (BACKS[id].perGame) return GAME_BACKS[game] || GAME_BACKS.hezz2;
    return BACKS[id];
}

export function feltFor(game, s = state) {
    const list = FELTS[game] || FELTS.hezz2;
    const chosen = list.find((f) => f.id === s.felts?.[game]);
    return chosen && itemUnlocked(chosen, `felt:${game}:${chosen.id}`, s) ? chosen : list[0];
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
