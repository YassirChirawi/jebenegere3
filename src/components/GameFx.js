import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withDelay,
    withSequence,
    withSpring,
    withRepeat,
    Easing,
    FadeInDown,
    FadeOutUp,
    ZoomIn,
} from 'react-native-reanimated';
import { CardFace } from './Card';
import { PressableScale, theme } from './ui';


export const SUIT_INFO = {
    Oros: { label: 'Flouss', arabic: 'الفلوس', color: '#E6B422', emoji: '💰' },
    Copas: { label: 'Jbaben', arabic: 'الجبابن', color: '#E05252', emoji: '🏆' },
    Espadas: { label: 'Syouf', arabic: 'السيوف', color: '#4A90D9', emoji: '🗡️' },
    Bastos: { label: 'Gere3', arabic: 'الگرعة', color: '#3DBE6E', emoji: '🏏' },
};

/* ------------------------------------------------------------------ */
/* Bannière qui traverse l'écran ("À TOI DE JOUER !")                  */
/* ------------------------------------------------------------------ */
export function TurnBanner({ banner }) {
    const { width: STAGE_W } = useWindowDimensions();
    const x = useSharedValue(-STAGE_W);
    useEffect(() => {
        if (!banner) return;
        x.value = -STAGE_W;
        x.value = withSequence(
            withSpring(0, { damping: 16, stiffness: 160 }),
            withDelay(750, withTiming(STAGE_W, { duration: 300, easing: Easing.in(Easing.cubic) }))
        );
    }, [banner?.id]);

    const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { skewX: '-8deg' }] }));
    if (!banner) return null;

    return (
        <View pointerEvents="none" style={styles.bannerWrap}>
            <Animated.View style={[styles.banner, { backgroundColor: banner.color || theme.gold }, style]}>
                <View style={styles.bannerStripe} />
                <Text style={[styles.bannerText, { color: banner.textColor || theme.bg }]}>{banner.text}</Text>
                {banner.sub ? <Text style={[styles.bannerSub, { color: banner.textColor || theme.bg }]}>{banner.sub}</Text> : null}
            </Animated.View>
        </View>
    );
}

/* ------------------------------------------------------------------ */
/* Annonce d'action (ex : "Bot Hassan joue un 7 → Copas")               */
/* ------------------------------------------------------------------ */
export function ActionToast({ toast }) {
    if (!toast) return null;
    return (
        <Animated.View
            key={toast.id}
            pointerEvents="none"
            entering={FadeInDown.springify().damping(14)}
            exiting={FadeOutUp.duration(200)}
            style={[styles.toast, { borderColor: toast.color || theme.gold }]}
        >
            <Text style={styles.toastText}>{toast.text}</Text>
        </Animated.View>
    );
}

/* ------------------------------------------------------------------ */
/* Confettis (couleurs du drapeau + or)                                 */
/* ------------------------------------------------------------------ */
const CONFETTI_COLORS = ['#C1272D', '#006233', '#D4AF37', '#F5D77A', '#FFFFFF', '#E05252'];

function ConfettiPiece({ i, STAGE_W, H }) {
    const cfg = useMemo(() => ({
        x: Math.random() * STAGE_W,
        drift: (Math.random() - 0.5) * 140,
        delay: Math.random() * 500,
        dur: 1900 + Math.random() * 1300,
        size: 6 + Math.random() * 7,
        spin: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 720),
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        round: Math.random() > 0.7,
    }), []);
    const t = useSharedValue(0);
    useEffect(() => {
        t.value = withDelay(cfg.delay, withTiming(1, { duration: cfg.dur, easing: Easing.out(Easing.quad) }));
    }, []);
    const style = useAnimatedStyle(() => ({
        opacity: t.value > 0.85 ? (1 - t.value) / 0.15 : 1,
        transform: [
            { translateX: cfg.x + cfg.drift * t.value },
            { translateY: -30 + t.value * (H + 60) },
            { rotateZ: `${cfg.spin * t.value}deg` },
            { rotateX: `${cfg.spin * 0.7 * t.value}deg` },
        ],
    }));
    return (
        <Animated.View
            style={[
                styles.confetti,
                { width: cfg.size, height: cfg.round ? cfg.size : cfg.size * 0.45, backgroundColor: cfg.color, borderRadius: cfg.round ? cfg.size : 1 },
                style,
            ]}
        />
    );
}

export function Confetti({ count = 60 }) {
    const { width, height } = useWindowDimensions();
    return (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
            {Array.from({ length: count }).map((_, i) => <ConfettiPiece key={i} i={i} STAGE_W={width} H={height} />)}
        </View>
    );
}

/* ------------------------------------------------------------------ */
/* Badge de la famille demandée (après un 7)                            */
/* ------------------------------------------------------------------ */
export function SuitBadge({ suit }) {
    const info = SUIT_INFO[suit];
    const pulse = useSharedValue(1);
    useEffect(() => {
        pulse.value = withSequence(withTiming(1.25, { duration: 160 }), withSpring(1, { damping: 7 }));
    }, [suit]);
    const style = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
    if (!info) return null;
    return (
        <Animated.View style={[styles.suitBadge, { borderColor: info.color }, style]}>
            <CardFace card={{ suit, value: 1 }} width={22} height={32} />
            <View style={{ marginLeft: 6 }}>
                <Text style={styles.suitBadgeSmall}>FAMILLE</Text>
                <Text style={[styles.suitBadgeText, { color: info.color }]}>{info.label}</Text>
            </View>
        </Animated.View>
    );
}

/* ------------------------------------------------------------------ */
/* Badge de pénalité (+2, +4…)                                          */
/* ------------------------------------------------------------------ */
export function PenaltyBadge({ amount }) {
    const s = useSharedValue(0);
    useEffect(() => {
        s.value = withSequence(withTiming(1.5, { duration: 150 }), withSpring(1, { damping: 6 }));
    }, [amount]);
    const wob = useSharedValue(0);
    useEffect(() => {
        wob.value = withRepeat(withSequence(withTiming(1, { duration: 500 }), withTiming(0, { duration: 500 })), -1, true);
    }, []);
    const style = useAnimatedStyle(() => ({
        transform: [{ scale: s.value * (1 + wob.value * 0.06) }, { rotateZ: `${(wob.value - 0.5) * 6}deg` }],
    }));
    return (
        <Animated.View style={[styles.penalty, style]}>
            <Text style={styles.penaltyText}>+{amount}</Text>
        </Animated.View>
    );
}

/* ------------------------------------------------------------------ */
/* Sélecteur de famille pour le 7                                       */
/* ------------------------------------------------------------------ */
export function SuitSelector({ onSelect, onCancel }) {
    const { width, height } = useWindowDimensions();
    const land = width > height * 1.2;
    return (
        <Animated.View entering={FadeInDown.duration(200)} style={styles.overlay}>
            <Animated.View entering={ZoomIn.springify().damping(13)} style={[styles.sheet, land && { maxWidth: 560, paddingVertical: 12 }]}>
                <Text style={[styles.sheetTitle, land && { marginBottom: 10, fontSize: 18 }]}>Quelle famille tu veux ?</Text>
                {!land && <Text style={styles.sheetSub}>Le 7 change la couleur du jeu</Text>}
                <View style={styles.suitGrid}>
                    {Object.entries(SUIT_INFO).map(([suit, info], i) => (
                        <Animated.View key={suit} entering={ZoomIn.delay(80 * i).springify()} style={[styles.suitCell, land && { width: '22%' }]}>
                            <PressableScale
                                sound="click"
                                onPress={() => onSelect(suit)}
                                style={[styles.suitBtn, { borderColor: info.color }]}
                            >
                                <CardFace card={{ suit, value: 1 }} width={land ? 46 : 58} height={land ? 66 : 84} />
                                <Text style={[styles.suitName, { color: info.color }]}>{info.label}</Text>
                                <Text style={styles.suitArabic}>{info.arabic}</Text>
                            </PressableScale>
                        </Animated.View>
                    ))}
                </View>
                <PressableScale onPress={onCancel} style={[styles.cancelBtn, land && { marginTop: 6, paddingVertical: 4 }]}>
                    <Text style={styles.cancelText}>Annuler</Text>
                </PressableScale>
            </Animated.View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    bannerWrap: {
        position: 'absolute',
        top: '40%',
        left: 0,
        right: 0,
        alignItems: 'center',
        overflow: 'hidden',
        paddingVertical: 12,
        zIndex: 3000,
        elevation: 3000,
    },
    banner: {
        paddingVertical: 12,
        paddingHorizontal: 40,
        minWidth: '85%',
        alignItems: 'center',
        borderTopWidth: 2,
        borderBottomWidth: 2,
        borderColor: 'rgba(255,255,255,0.6)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 20,
        overflow: 'hidden',
    },
    bannerStripe: {
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: '45%',
        backgroundColor: 'rgba(255,255,255,0.18)',
    },
    bannerText: {
        fontSize: 26,
        fontWeight: '900',
        letterSpacing: 2,
        transform: [{ skewX: '8deg' }],
    },
    bannerSub: {
        fontSize: 13,
        fontWeight: '800',
        marginTop: 2,
        transform: [{ skewX: '8deg' }],
    },
    toast: {
        alignSelf: 'center',
        backgroundColor: 'rgba(12, 5, 7, 0.85)',
        borderWidth: 1.5,
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 6,
        maxWidth: '92%',
    },
    toastText: {
        color: theme.cream,
        fontWeight: '800',
        fontSize: 13,
        textAlign: 'center',
    },
    confetti: {
        position: 'absolute',
        top: 0,
        left: 0,
    },
    suitBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(12,5,7,0.8)',
        borderWidth: 2,
        borderRadius: 12,
        paddingVertical: 4,
        paddingHorizontal: 8,
    },
    suitBadgeSmall: {
        color: theme.textDim,
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 1.5,
    },
    suitBadgeText: {
        fontSize: 15,
        fontWeight: '900',
    },
    penalty: {
        backgroundColor: '#B91C1C',
        borderWidth: 2,
        borderColor: '#FCA5A5',
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 3,
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 10,
        elevation: 10,
    },
    penaltyText: {
        color: '#fff',
        fontWeight: '900',
        fontSize: 20,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.78)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
        elevation: 9999,
        padding: 20,
    },
    sheet: {
        width: '100%',
        maxWidth: 380,
        backgroundColor: theme.panelSolid,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: theme.gold,
        padding: 20,
        alignItems: 'center',
    },
    sheetTitle: {
        color: theme.goldLight,
        fontSize: 21,
        fontWeight: '900',
    },
    sheetSub: {
        color: theme.textDim,
        fontSize: 13,
        marginTop: 2,
        marginBottom: 14,
    },
    suitGrid: {
        width: '100%',
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 12,
    },
    suitCell: {
        width: '46%',
    },
    suitBtn: {
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.35)',
        borderRadius: 14,
        borderWidth: 2,
        paddingVertical: 10,
    },
    suitName: {
        fontSize: 16,
        fontWeight: '900',
        marginTop: 6,
    },
    suitArabic: {
        color: theme.text,
        fontSize: 13,
        marginTop: 1,
    },
    cancelBtn: {
        marginTop: 14,
        paddingVertical: 8,
        paddingHorizontal: 24,
    },
    cancelText: {
        color: theme.textDim,
        fontWeight: '800',
        fontSize: 14,
    },
});
