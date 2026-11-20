import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import socketService from '../network/socketService';
import audioService from '../network/audioService';
import { theme } from './ui';
import { canFullscreen, enterFullscreen, isPhoneWeb } from '../utils/fullscreen';
import { t as tr } from '../i18n';

/**
 * Compte à rebours avant le premier coup (envoyé par le serveur : state.startIn en ms).
 * Laisse le temps de s'installer : on voit qui commence, et en Ronda on peut tourner l'écran.
 * Les coups sont refusés par le serveur pendant ce temps ; l'écran bloque aussi les touches.
 */
export default function StartCountdown({ initialState, gameType }) {
    const [info, setInfo] = useState(() => fromState(initialState));
    const [now, setNow] = useState(Date.now());
    const { width, height } = useWindowDimensions();

    useEffect(() => socketService.onGameStarted((s) => setInfo(fromState(s))), []);

    const left = info ? info.until - now : 0;
    useEffect(() => {
        if (!info || left <= 0) return undefined;
        const t = setTimeout(() => setNow(Date.now()), Math.min(250, left));
        return () => clearTimeout(t);
    }, [info, now]);

    const secs = Math.ceil(left / 1000);
    useEffect(() => {
        if (!info) return;
        if (secs > 0 && secs <= 3) audioService.playSound('card_flip', { volume: 0.6 });
    }, [secs]);

    if (!info || left <= 0) return null;

    const myId = socketService.socket?.id;
    const firstIsMe = info.firstId && info.firstId === myId;
    const ronda = gameType === 'ronda';
    const portrait = height > width;
    const askRotate = ronda && portrait && (isPhoneWeb() || width < 600);

    return (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(250)} style={styles.overlay}>
            <View style={styles.box}>
                <Text style={styles.label}>{tr("LA PARTIE COMMENCE DANS")}</Text>
                <Animated.Text key={secs} entering={ZoomIn.springify().damping(12)} style={styles.count}>{secs}</Animated.Text>
                {info.firstName ? (
                    <Text style={[styles.first, firstIsMe && { color: theme.mint }]}>
                        {firstIsMe ? tr('🎯 C’est toi qui commences !') : tr("🎯 {p0} commence", { p0: info.firstName })}
                    </Text>
                ) : null}
                {askRotate && (
                    canFullscreen() ? (
                        <Pressable onPress={() => enterFullscreen('landscape')} style={styles.rotateBtn}>
                            <Text style={styles.rotateText}>{tr("🔄 Tourner l'écran")}</Text>
                        </Pressable>
                    ) : (
                        <Text style={styles.rotateHint}>{tr("🔄 Tourne ton téléphone : la Ronda se joue en paysage")}</Text>
                    )
                )}
            </View>
        </Animated.View>
    );
}

function fromState(s) {
    if (!s || !(s.startIn > 0)) return null;
    const first = typeof s.turn === 'number' ? s.players?.[s.turn] : null;
    return { until: Date.now() + s.startIn, firstName: first?.name, firstId: first?.id };
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(6,12,28,0.62)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9000,
        elevation: 9000,
        padding: 16,
    },
    box: {
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 26,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: theme.gold,
        backgroundColor: 'rgba(14,26,56,0.92)',
        maxWidth: 360,
    },
    label: { color: theme.textDim, fontWeight: '900', fontSize: 12, letterSpacing: 2 },
    count: { color: theme.goldLight, fontWeight: '900', fontSize: 64, lineHeight: 74, marginVertical: 2 },
    first: { color: theme.gold, fontWeight: '800', fontSize: 16, textAlign: 'center' },
    rotateBtn: {
        marginTop: 14,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 22,
        backgroundColor: theme.gold,
    },
    rotateText: { color: theme.bg, fontWeight: '900', fontSize: 15 },
    rotateHint: { marginTop: 12, color: theme.text, fontSize: 13, textAlign: 'center' },
});
