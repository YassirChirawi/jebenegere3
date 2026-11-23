/**
 * Langues de l'appli : français (texte d'origine) et anglais.
 * Les mots du jeu restent en darija dans les deux langues (Missa, Derba, Tringa, Hbel, Khasser, binga…).
 *
 * Le texte français sert de clé : t('Modes de jeu') → « Game modes » en anglais.
 * Un texte absent du dictionnaire reste en français (jamais de clé brute affichée).
 * Paramètres : t('{n} en ligne', { n: 3 }).
 *
 * Changer de langue remonte l'appli (App.js utilise la langue comme « key ») : tous les écrans
 * sont redessinés dans la nouvelle langue.
 */
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './en.json';

export const LANGS = [
    { id: 'fr', label: 'Français', short: 'FR' },
    { id: 'en', label: 'English', short: 'EN' },
];
const DICTS = { en };

// Langue de l'appareil au premier lancement : anglais si l'appareil est en anglais, sinon français
function deviceLang() {
    try {
        const l = (Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.language : Intl.DateTimeFormat().resolvedOptions().locale) || 'fr';
        return /^en/i.test(l) ? 'en' : 'fr';
    } catch (e) {
        return 'fr';
    }
}

let lang = deviceLang();
const listeners = new Set();

export function getLang() { return lang; }

export function t(fr, params) {
    let s = (lang !== 'fr' && DICTS[lang]?.[fr]) || fr;
    if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined && params[k] !== null ? String(params[k]) : m));
    return s;
}

export async function setLang(l) {
    if (!LANGS.some((x) => x.id === l) || l === lang) return;
    lang = l;
    try { await AsyncStorage.setItem('lang', l); } catch (e) { /* ignore */ }
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.documentElement.lang = l;
    listeners.forEach((fn) => fn(l));
}

/** Langue gardée sur l'appareil (au démarrage). */
export async function loadLang() {
    try {
        const saved = await AsyncStorage.getItem('lang');
        if (saved && saved !== lang) await setLang(saved);
    } catch (e) { /* ignore */ }
    return lang;
}

export function useLang() {
    const [l, setL] = useState(lang);
    useEffect(() => {
        listeners.add(setL);
        setL(lang);
        return () => listeners.delete(setL);
    }, []);
    return l;
}
