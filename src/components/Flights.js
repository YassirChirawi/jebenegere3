import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
    useSharedValue, useAnimatedStyle, withTiming, withDelay, withSequence, Easing, interpolate,
} from 'react-native-reanimated';
import { CardBack, CardFace } from './Card';

// Décalage approximatif de chaque siège par rapport au centre de la table
export const DIR_OFF = {
    bottom: [0, 300],
    top: [0, -250],
    topLeft: [-130, -230],
    topRight: [130, -230],
    left: [-185, -10],
    right: [185, -10],
    center: [0, 0],
};

/**
 * Cartes qui volent d'un point à un autre (pioche → joueur, tas → perdant, siège → siège).
 * fly : { id, count, from, to, cards?, stagger? } ; from/to : clé de DIR_OFF (défaut : centre)
 */
export function FlyCards({ fly, w = 62, h = 90 }) {
    const n = fly.cards ? fly.cards.length : Math.max(1, Math.min(fly.count || 1, 6));
    return (
        <View pointerEvents="none" style={styles.layer}>
            {Array.from({ length: n }).map((_, i) => (
                <FlyOne key={`${fly.id}-${i}`} i={i} fly={fly} w={w} h={h} card={fly.cards?.[i]} />
            ))}
        </View>
    );
}

function FlyOne({ i, fly, w, h, card }) {
    const t = useSharedValue(0);
    const k = fly.scale || 1;
    const [fx, fy] = (DIR_OFF[fly.from || 'center'] || DIR_OFF.center).map((v) => v * k);
    const [tx, ty] = (DIR_OFF[fly.to || 'center'] || DIR_OFF.center).map((v) => v * k);
    const spin = useMemo(() => (Math.random() - 0.5) * 50, []);
    const toSeat = fly.to && fly.to !== 'center' && fly.to !== 'bottom';
    useEffect(() => {
        t.value = withDelay(i * (fly.stagger ?? 85), withTiming(1, { duration: fly.duration || 480, easing: Easing.inOut(Easing.cubic) }));
    }, []);
    const style = useAnimatedStyle(() => {
        const p = t.value;
        // petite courbe : la carte monte un peu en volant
        const arc = Math.sin(p * Math.PI) * -28;
        return {
            opacity: p === 0 ? 0 : p > 0.92 ? (1 - p) / 0.08 : 1,
            transform: [
                { translateX: fx + (tx - fx) * p + i * 2 },
                { translateY: fy + (ty - fy) * p + arc },
                { rotateZ: `${spin * (1 - p) + i * 4}deg` },
                { scale: interpolate(p, [0, 0.5, 1], [0.9, 1.08, toSeat ? 0.55 : 0.9]) },
            ],
        };
    });
    return (
        <Animated.View style={[styles.card, { width: w, height: h, marginLeft: -w / 2, marginTop: -h / 2 }, style]}>
            {card ? <CardFace card={card} width={w} height={h} /> : <CardBack width={w} height={h} />}
        </Animated.View>
    );
}

/**
 * Éclat doré pour les coups spéciaux : rayons qui tournent, anneau, étincelles.
 * burst : { id, color?, size? }
 */
export function GoldBurst({ burst }) {
    const t = useSharedValue(0);
    const color = burst.color || '#F5D77A';
    const size = burst.size || 260;
    useEffect(() => {
        t.value = withSequence(withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }));
    }, []);
    const rays = useAnimatedStyle(() => ({
        opacity: interpolate(t.value, [0, 0.15, 0.7, 1], [0, 0.85, 0.5, 0]),
        transform: [{ scale: interpolate(t.value, [0, 1], [0.3, 1.25]) }, { rotateZ: `${t.value * 70}deg` }],
    }));
    const ring = useAnimatedStyle(() => ({
        opacity: interpolate(t.value, [0, 0.1, 1], [0, 1, 0]),
        transform: [{ scale: interpolate(t.value, [0, 1], [0.2, 1.6]) }],
    }));
    const sparks = useMemo(() => Array.from({ length: 14 }).map((_, k) => ({
        a: (k / 14) * Math.PI * 2 + Math.random() * 0.3,
        d: size * (0.35 + Math.random() * 0.3),
        s: 4 + Math.random() * 5,
    })), []);
    return (
        <View pointerEvents="none" style={styles.layer}>
            <Animated.View style={[styles.center, { width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }, rays]}>
                {Array.from({ length: 12 }).map((_, k) => (
                    <View key={k} style={[StyleSheet.absoluteFill, { alignItems: 'center', transform: [{ rotateZ: `${k * 30}deg` }] }]}>
                        <View style={[styles.ray, { height: size * (k % 2 ? 0.3 : 0.42), marginTop: size * (k % 2 ? 0.16 : 0.04), backgroundColor: color }]} />
                    </View>
                ))}
            </Animated.View>
            <Animated.View style={[styles.center, styles.ring, { borderColor: color, width: size * 0.5, height: size * 0.5, borderRadius: size * 0.25, marginLeft: -size * 0.25, marginTop: -size * 0.25 }, ring]} />
            {sparks.map((sp, k) => <Spark key={k} sp={sp} t={t} color={color} />)}
        </View>
    );
}

function Spark({ sp, t, color }) {
    const style = useAnimatedStyle(() => ({
        opacity: interpolate(t.value, [0, 0.1, 0.8, 1], [0, 1, 0.8, 0]),
        transform: [
            { translateX: Math.cos(sp.a) * sp.d * t.value },
            { translateY: Math.sin(sp.a) * sp.d * t.value },
            { rotateZ: `${t.value * 180}deg` },
        ],
    }));
    return <Animated.View style={[styles.spark, { width: sp.s, height: sp.s, marginLeft: -sp.s / 2, marginTop: -sp.s / 2, backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
    layer: { position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, overflow: 'visible', zIndex: 2500, elevation: 2500 },
    card: { position: 'absolute', left: 0, top: 0 },
    center: { position: 'absolute', left: 0, top: 0, alignItems: 'center', justifyContent: 'center' },
    ray: { width: 6, borderRadius: 3, opacity: 0.55 },
    ring: { borderWidth: 3 },
    spark: { position: 'absolute', left: 0, top: 0, transform: [{ rotate: '45deg' }], borderRadius: 1 },
});
