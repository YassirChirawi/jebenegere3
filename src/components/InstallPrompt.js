/**
 * Grande fenêtre « Installe L'Carta », sur le site seulement (jamais dans l'appli installée ni dans Discord).
 * Montrée au plus une fois tous les 3 jours ; le bouton « 📲 Installer l'appli » de l'accueil reste toujours là.
 * - Android / ordinateur (Chrome, Edge) : « Installer » ouvre la fenêtre d'installation du navigateur (une confirmation).
 * - iPhone / iPad : Safari ne permet pas l'installation par un site, on montre les 3 gestes.
 * ready : l'accueil est affiché et rien d'autre n'est ouvert.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Image, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GameButton, theme } from './ui';
import audioService from '../network/audioService';
import { t } from '../i18n';
import { useInstallState, promptInstall } from '../utils/install';

export const INSTALL_PROMPT_KEY = 'installPromptAt';
export const INSTALL_PROMPT_EVERY = 3 * 24 * 3600 * 1000; // 3 jours

const PERKS = [
    ['📱', 'Plein écran, sans la barre du navigateur'],
    ['⚡', 'Démarre plus vite, même avec un réseau faible'],
    ['🏠', "Une icône L'Carta sur ton écran d'accueil"],
];

export default function InstallPrompt({ ready, onOpenChange, onLegal }) {
    const { canPrompt, available } = useInstallState();
    const [open, setOpen] = useState(false);
    const { width, height } = useWindowDimensions();
    const wide = width >= 700;
    const short = height < (wide ? 640 : 720); // petit écran : pas de captures, la fenêtre tient sans défiler

    // Une fois par période de 3 jours, dès que l'installation est possible et que l'accueil est libre
    useEffect(() => {
        if (!ready || !available || open) return undefined;
        let alive = true;
        const timer = setTimeout(async () => {
            const last = parseInt((await AsyncStorage.getItem(INSTALL_PROMPT_KEY).catch(() => null)) || '0', 10);
            if (!alive || Date.now() - last < INSTALL_PROMPT_EVERY) return;
            AsyncStorage.setItem(INSTALL_PROMPT_KEY, String(Date.now())).catch(() => {});
            audioService.playSound('popup');
            setOpen(true);
        }, 900);
        return () => { alive = false; clearTimeout(timer); };
    }, [ready, available]);

    // Installé entre-temps (ou plus possible) : on ferme
    useEffect(() => { if (open && !available) setOpen(false); }, [available]);
    useEffect(() => { onOpenChange?.(open); }, [open]);

    if (!open) return null;
    const close = () => setOpen(false);
    const install = async () => {
        await promptInstall();
        close();
    };
    const ios = !canPrompt;
    const shots = short ? [] : wide ? ['pc-hezz2.webp'] : ['tel-partie.webp', 'tel-roue.webp'];

    return (
        <Modal visible transparent animationType="fade" onRequestClose={close}>
            <Animated.View entering={FadeIn.duration(150)} style={styles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={close} />
                <Animated.View entering={ZoomIn.springify().damping(13)} style={[styles.box, wide && styles.boxWide]} accessibilityLabel={t("Installe L'Carta")}>
                    <Pressable onPress={close} hitSlop={12} style={styles.close} accessibilityLabel={t('Fermer')}><Text style={styles.closeText}>✕</Text></Pressable>
                    <Text style={styles.title}>{t("📲 Installe L'Carta")}</Text>
                    <Text style={styles.sub}>{t('Pour une meilleure expérience de jeu')}</Text>
                    {shots.length ? <View style={styles.shots}>
                        {shots.map((s) => (
                            <Image key={s} source={{ uri: `/screenshots/${s}` }} resizeMode="cover"
                                style={wide ? styles.shotWide : styles.shotTel} />
                        ))}
                    </View> : null}
                    <View style={styles.perks}>
                        {PERKS.map(([icon, text]) => (
                            <View key={text} style={styles.perk}>
                                <Text style={styles.perkIcon}>{icon}</Text>
                                <Text style={styles.perkText}>{t(text)}</Text>
                            </View>
                        ))}
                    </View>
                    {ios ? (
                        <View style={styles.steps}>
                            <Text style={styles.stepsTitle}>{t('Sur iPhone, dans Safari :')}</Text>
                            <Text style={styles.step}>{t('1. Touche Partager ⬆️ en bas de l\'écran')}</Text>
                            <Text style={styles.step}>{t("2. Choisis « Sur l'écran d'accueil »")}</Text>
                            <Text style={styles.step}>{t('3. Touche « Ajouter »')}</Text>
                        </View>
                    ) : null}
                    <View style={styles.actions}>
                        {ios
                            ? <GameButton title={t("J'ai compris")} icon="👍" onPress={close} />
                            : <GameButton title={t('Installer')} icon="📲" onPress={install} />}
                        <Pressable onPress={close} style={styles.later}><Text style={styles.laterText}>{t('Plus tard')}</Text></Pressable>
                    </View>
                    <Text style={styles.legal}>
                        {t("En utilisant L'Carta, tu acceptes nos ")}
                        <Text style={styles.link} onPress={() => { close(); onLegal?.('terms'); }}>{t("Conditions d'utilisation")}</Text>
                        {t(' et notre ')}
                        <Text style={styles.link} onPress={() => { close(); onLegal?.('privacy'); }}>{t('Politique de confidentialité')}</Text>
                        .
                    </Text>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 16 },
    box: { width: '100%', maxWidth: 400, alignItems: 'center', backgroundColor: theme.panelSolid, borderRadius: 22, borderWidth: 2, borderColor: theme.gold, paddingVertical: 20, paddingHorizontal: 16 },
    boxWide: { maxWidth: 520 },
    close: { position: 'absolute', top: 10, right: 14, zIndex: 2 },
    closeText: { color: theme.textDim, fontSize: 18, fontWeight: '900' },
    title: { color: theme.goldLight, fontSize: 22, fontWeight: '900', textAlign: 'center' },
    sub: { color: theme.cream, fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 4 },
    shots: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 14 },
    shotTel: { width: 96, height: 208, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(232,184,74,0.6)', backgroundColor: '#000' },
    shotWide: { width: 440, maxWidth: '100%', aspectRatio: 1.6, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(232,184,74,0.6)', backgroundColor: '#000' },
    perks: { alignSelf: 'stretch', marginTop: 14, gap: 6 },
    perk: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    perkIcon: { fontSize: 16, width: 24, textAlign: 'center' },
    perkText: { flex: 1, color: theme.cream, fontSize: 13, fontWeight: '700' },
    steps: { alignSelf: 'stretch', marginTop: 12, padding: 10, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1, borderColor: 'rgba(232,184,74,0.35)', gap: 3 },
    stepsTitle: { color: theme.goldLight, fontWeight: '900', fontSize: 13 },
    step: { color: theme.cream, fontWeight: '700', fontSize: 13 },
    actions: { alignSelf: 'stretch', marginTop: 16, gap: 6, alignItems: 'stretch' },
    later: { alignSelf: 'center', padding: 8 },
    laterText: { color: theme.textDim, fontWeight: '800', fontSize: 13 },
    legal: { color: theme.textDim, fontSize: 11, textAlign: 'center', marginTop: 4 },
    link: { color: theme.goldLight, textDecorationLine: 'underline' },
});
