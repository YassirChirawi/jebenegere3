import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text } from 'react-native';
import { PressableScale, theme } from './ui';
import { dialog } from './Dialog';

// « Installer l'appli » (version web uniquement, caché si déjà installée)
// - Android / Chrome / Edge : vraie fenêtre d'installation du navigateur.
// - iPhone / iPad : Safari n'a pas de bouton automatique, on explique la manip.
const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';

function isInstalled() {
    if (!isWeb) return true;
    return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIOS() {
    if (!isWeb) return false;
    const ua = window.navigator.userAgent || '';
    return /iPhone|iPad|iPod/i.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

export default function InstallAppButton({ style }) {
    const [canPrompt, setCanPrompt] = useState(isWeb && !!window.__installPrompt);
    const [installed, setInstalled] = useState(isInstalled());

    useEffect(() => {
        if (!isWeb) return undefined;
        const onReady = () => setCanPrompt(true);
        const onDone = () => { setInstalled(true); setCanPrompt(false); };
        window.addEventListener('jg3-installable', onReady);
        window.addEventListener('jg3-installed', onDone);
        return () => {
            window.removeEventListener('jg3-installable', onReady);
            window.removeEventListener('jg3-installed', onDone);
        };
    }, []);

    if (installed || (!canPrompt && !isIOS())) return null;

    const onPress = async () => {
        const prompt = window.__installPrompt;
        if (prompt) {
            prompt.prompt();
            const { outcome } = await prompt.userChoice.catch(() => ({}));
            if (outcome === 'accepted') setInstalled(true);
            window.__installPrompt = null;
            setCanPrompt(false);
            return;
        }
        dialog.alert(
            "Installer Jeben Gere3",
            "Sur iPhone, dans Safari :\n\n1. Touche le bouton Partager (le carré avec la flèche ⬆️)\n2. Choisis « Sur l'écran d'accueil »\n3. Touche « Ajouter »\n\nL'appli s'ouvrira en plein écran, comme une vraie appli.",
            [{ text: 'OK' }],
        );
    };

    return (
        <PressableScale onPress={onPress} style={[styles.btn, style]}>
            <Text style={styles.text}>📲 Installer l'appli</Text>
        </PressableScale>
    );
}

const styles = StyleSheet.create({
    btn: {
        alignSelf: 'center',
        marginTop: 14,
        paddingVertical: 9,
        paddingHorizontal: 18,
        borderRadius: 22,
        borderWidth: 1.5,
        borderColor: theme.gold,
        backgroundColor: 'rgba(212, 175, 55, 0.12)',
    },
    text: { color: theme.gold, fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
});
