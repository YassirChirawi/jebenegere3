import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    withRepeat,
    withSequence,
    withDelay,
    Easing,
    cancelAnimation,
    interpolate,
} from 'react-native-reanimated';
import { CardFace, CardBack } from './Card';
import { theme } from './ui';

export const PILE_W = 74;
export const PILE_H = 106;

// Rotation pseudo-aléatoire stable par carte (effet "tas" naturel)
function jitter(id, amp) {
    let h = 0;
    const s = String(id);
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return ((Math.abs(h) % 1000) / 1000 - 0.5) * 2 * amp;
}

const FROM = {
    bottom: { x: 0, y: 300, r: -25 },
    top: { x: 0, y: -260, r: 160 },
    left: { x: -220, y: -20, r: -120 },
    right: { x: 220, y: -20, r: 120 },
    none: { x: 0, y: -40, r: 0 },
};

// Carte du dessus : arrive en volant depuis le siège du joueur
function TopCard({ card, from = 'none', special }) {
    const p = useSharedValue(0);
    const ring = useSharedValue(0);
    const o = FROM[from] || FROM.none;
    const finalRot = jitter(card.id, 8);

    useEffect(() => {
        p.value = withSpring(1, { damping: 14, stiffness: 140, mass: 0.9 });
        if (special) {
            ring.value = withDelay(180, withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) }));
        }
    }, []);

    const cardStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: o.x * (1 - p.value) },
            { translateY: o.y * (1 - p.value) },
            { rotateZ: `${finalRot + o.r * (1 - p.value)}deg` },
            { scale: interpolate(p.value, [0, 0.7, 1], [0.8, 1.18, 1]) },
        ],
    }));
    const ringStyle = useAnimatedStyle(() => ({
        opacity: ring.value === 0 ? 0 : 1 - ring.value,
        transform: [{ scale: 0.6 + ring.value * 1.6 }],
    }));

    return (
        <>
            {special && <Animated.View pointerEvents="none" style={[styles.ring, { borderColor: special }, ringStyle]} />}
            <Animated.View style={[styles.pileCard, cardStyle]}>
                <CardFace card={card} width={PILE_W} height={PILE_H} />
            </Animated.View>
        </>
    );
}

export function DiscardPile({ pile, from }) {
    const top = pile[pile.length - 1];
    const under = pile.slice(-4, -1);
    const special = top && ({ 1: '#60A5FA', 2: '#F87171', 7: '#FCD34D' })[top.value];

    return (
        <View style={styles.pileSlot}>
            <View style={styles.slotMark} />
            {under.map((c) => (
                <View
                    key={c.id}
                    style={[
                        styles.pileCard,
                        { transform: [{ rotateZ: `${jitter(c.id, 14)}deg` }, { translateX: jitter(c.id + 'x', 5) }] },
                    ]}
                >
                    <CardFace card={c} width={PILE_W} height={PILE_H} dimmed />
                </View>
            ))}
            {top && <TopCard key={top.id} card={top} from={from} special={special} />}
        </View>
    );
}

export function DeckPile({ count, canDraw, onDraw }) {
    const pulse = useSharedValue(0);
    const press = useSharedValue(1);

    useEffect(() => {
        if (canDraw) {
            pulse.value = withRepeat(
                withSequence(
                    withTiming(1, { duration: 700, easing: Easing.inOut(Easing.sin) }),
                    withTiming(0.2, { duration: 700, easing: Easing.inOut(Easing.sin) })
                ),
                -1,
                true
            );
        } else {
            cancelAnimation(pulse);
            pulse.value = withTiming(0, { duration: 200 });
        }
    }, [canDraw]);

    const glowStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));
    const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
    const layers = Math.min(5, Math.ceil(count / 6));

    return (
        <Pressable
            onPress={onDraw}
            disabled={!canDraw}
            onPressIn={() => { press.value = withSpring(0.93); }}
            onPressOut={() => { press.value = withSpring(1); }}
            style={styles.deckSlot}
        >
            <Animated.View style={[styles.deckGlow, glowStyle]} pointerEvents="none" />
            <Animated.View style={pressStyle}>
                {/* Épaisseur du paquet */}
                {Array.from({ length: layers }).map((_, i) => (
                    <View key={i} style={[styles.deckLayer, { top: (layers - i) * 1.6, left: (layers - i) * 1.2 }]}>
                        <CardBack width={PILE_W} height={PILE_H} />
                    </View>
                ))}
                {count > 0 ? (
                    <CardBack width={PILE_W} height={PILE_H} />
                ) : (
                    <View style={[styles.emptyDeck]}><Text style={styles.emptyText}>Vide</Text></View>
                )}
            </Animated.View>
            <View style={styles.deckBadge}>
                <Text style={styles.deckBadgeText}>{count}</Text>
            </View>
            {canDraw && <Text style={styles.drawHint}>PIOCHER</Text>}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    pileSlot: {
        width: PILE_W + 20,
        height: PILE_H + 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    slotMark: {
        position: 'absolute',
        width: PILE_W + 8,
        height: PILE_H + 8,
        borderRadius: 10,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: 'rgba(245, 215, 122, 0.35)',
    },
    pileCard: {
        position: 'absolute',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 5,
        elevation: 6,
        borderRadius: 8,
    },
    ring: {
        position: 'absolute',
        width: PILE_H + 10,
        height: PILE_H + 10,
        borderRadius: (PILE_H + 10) / 2,
        borderWidth: 4,
    },
    deckSlot: {
        width: PILE_W + 16,
        height: PILE_H + 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    deckLayer: {
        position: 'absolute',
    },
    deckGlow: {
        position: 'absolute',
        width: PILE_W + 14,
        height: PILE_H + 14,
        borderRadius: 12,
        borderWidth: 3,
        borderColor: '#FFD966',
        backgroundColor: 'rgba(255,200,60,0.15)',
        shadowColor: '#FFC83C',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 14,
    },
    emptyDeck: {
        width: PILE_W,
        height: PILE_H,
        borderRadius: 8,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: 'rgba(255,255,255,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
    },
    deckBadge: {
        position: 'absolute',
        top: 0,
        right: 0,
        minWidth: 24,
        height: 24,
        borderRadius: 12,
        paddingHorizontal: 5,
        backgroundColor: theme.gold,
        borderWidth: 1.5,
        borderColor: '#FFF3C4',
        alignItems: 'center',
        justifyContent: 'center',
    },
    deckBadgeText: {
        color: theme.bg,
        fontWeight: '900',
        fontSize: 11,
    },
    drawHint: {
        position: 'absolute',
        bottom: -8,
        color: theme.goldLight,
        fontWeight: '900',
        fontSize: 10,
        letterSpacing: 1.5,
        textShadowColor: '#000',
        textShadowRadius: 4,
    },
});
