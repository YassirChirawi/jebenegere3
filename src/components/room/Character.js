/**
 * Personnage d'un joueur assis à la table (2,5D) : son avatar du Profil en buste, posé derrière le bord de la table.
 * - Respiration (buste et tête), clignement des yeux, petit mouvement de tête quand c'est son tour.
 * - Joueur actif éclairé (halo doré), les autres légèrement assombris.
 * - Anneau du minuteur autour de la tête du joueur actif (CircularTimer).
 * Les dessins viennent de characterArt.js ; sans dessin, corps provisoire avec le portrait comme tête.
 * Tout tourne sur le fil d'animation (Reanimated) : aucun rendu React pendant les boucles.
 */
import React, { useEffect, useMemo } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient, RadialGradient, Stop, Ellipse } from 'react-native-svg';
import Animated, {
    useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, withDelay, Easing, cancelAnimation,
} from 'react-native-reanimated';
import PlayerAvatar, { avatarIndex } from '../PlayerAvatar';
import CircularTimer from '../CircularTimer';
import { CHARACTER_ART, DEFAULT_ANCHOR } from './characterArt';
import { ROBE_COLORS } from './robeColors';

// Petit décalage de rythme par joueur, pour que les personnages ne respirent pas tous ensemble
const phaseOf = (name) => {
    let h = 0;
    for (const c of String(name || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return h % 1000;
};

function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
    return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

/** Corps provisoire : robe à capuche, bras posés vers la table (remplacé par le dessin du personnage). */
function PlaceholderBody({ w, h, color }) {
    const id = `robe${color.slice(1)}`;
    const s = w / 100; // dessin sur une base de 100 de large
    return (
        <Svg width={w} height={h} viewBox={`0 0 100 ${h / s}`}>
            <Defs>
                <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={shade(color, 1.25)} />
                    <Stop offset="1" stopColor={shade(color, 0.6)} />
                </LinearGradient>
            </Defs>
            {/* Bras (manches), légèrement en avant */}
            <Path d="M14 58 C6 70 6 86 12 98 L28 98 C26 86 28 72 32 62 Z" fill={shade(color, 0.75)} />
            <Path d="M86 58 C94 70 94 86 88 98 L72 98 C74 86 72 72 68 62 Z" fill={shade(color, 0.75)} />
            {/* Buste et épaules */}
            <Path d="M20 56 C26 46 38 42 50 42 C62 42 74 46 80 56 C84 70 82 86 78 98 L22 98 C18 86 16 70 20 56 Z" fill={`url(#${id})`} />
            {/* Col et galon doré */}
            <Path d="M38 44 C42 54 58 54 62 44" stroke="#E8C26A" strokeWidth="2.2" fill="none" />
            <Path d="M50 52 L50 98" stroke="#E8C26A" strokeWidth="1.6" opacity="0.7" />
        </Svg>
    );
}

/** Ce joueur a-t-il un personnage dessiné (sinon corps provisoire, avec le portrait comme tête) ? */
export const hasCharacterArt = (player) => !!CHARACTER_ART[avatarIndex(player?.name, player?.avatar || 0)];

export default function Character({ player, size = 64, active, mood, timer, dimmed = true }) {
    const idx = avatarIndex(player?.name, player?.avatar || 0);
    const art = CHARACTER_ART[idx];
    const wholeBust = !!art?.body && !art?.head; // buste dessiné avec la tête : elle bouge avec le buste
    const a = { ...DEFAULT_ANCHOR, ...(art?.anchor || {}) };
    const W = size;
    const H = Math.round(size * 1.05);
    const head = Math.round(W * a.headSize);
    const phase = useMemo(() => phaseOf(player?.name), [player?.name]);

    // Respiration : boucle continue
    const breath = useSharedValue(0);
    useEffect(() => {
        breath.value = withDelay(phase, withRepeat(withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.sin) }), -1, true));
        return () => cancelAnimation(breath);
    }, []);

    // Clignement des yeux (seulement avec une tête dessinée « yeux fermés »)
    const blink = useSharedValue(0);
    useEffect(() => {
        if (!art?.headBlink) return undefined;
        blink.value = withDelay(phase * 2, withRepeat(withSequence(
            withDelay(2800, withTiming(1, { duration: 30 })),
            withDelay(120, withTiming(0, { duration: 30 })),
        ), -1, false));
        return () => cancelAnimation(blink);
    }, [!!art?.headBlink]);

    // Son tour : petit mouvement de tête, halo ; sinon un peu dans l'ombre
    const turn = useSharedValue(0);
    const lit = useSharedValue(active ? 1 : 0);
    useEffect(() => {
        lit.value = withTiming(active ? 1 : 0, { duration: 260 });
        if (active) {
            turn.value = withRepeat(withSequence(
                withTiming(-5, { duration: 260, easing: Easing.out(Easing.quad) }),
                withTiming(4, { duration: 380, easing: Easing.inOut(Easing.quad) }),
                withTiming(0, { duration: 260 }),
                withDelay(1300, withTiming(0, { duration: 1 })),
            ), -1, false);
        } else {
            cancelAnimation(turn);
            turn.value = withTiming(0, { duration: 200 });
        }
    }, [active]);

    const bodyStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: -breath.value * 0.9 }, { scaleY: 1 + breath.value * 0.025 }, { rotate: `${wholeBust ? turn.value * 0.5 : 0}deg` }],
    }));
    const headStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: -breath.value * 1.6 }, { rotate: `${turn.value}deg` }],
    }));
    const blinkStyle = useAnimatedStyle(() => ({ opacity: blink.value }));
    const rootStyle = useAnimatedStyle(() => ({ opacity: dimmed ? 0.8 + lit.value * 0.2 : 1 }));
    const glowStyle = useAnimatedStyle(() => ({ opacity: lit.value * (0.55 + breath.value * 0.3) }));

    // Boîte de la tête : dessin découpé (headBox), sinon portrait rond du corps provisoire.
    // Buste dessiné sans tête séparée : la tête fait partie du buste (on vise le haut du buste pour l'anneau).
    const hb = art?.head && art.headBox
        ? { left: art.headBox[0] * W, top: art.headBox[1] * H, width: art.headBox[2] * W, height: art.headBox[3] * H }
        : art?.body
            ? { left: W * 0.25, top: H * 0.02, width: W * 0.5, height: H * 0.5 }
            : { left: W * a.headX - head / 2, top: H * a.headY - head / 2, width: head, height: head };
    const ring = Math.round(Math.max(hb.width, hb.height) * (art ? 1.04 : 1) + (art ? 0 : 12));
    const ringLeft = hb.left + hb.width / 2 - ring / 2;
    const ringTop = hb.top + hb.height / 2 - ring / 2;

    return (
        <Animated.View style={[{ width: W, height: H }, rootStyle]} pointerEvents="none" accessibilityLabel="personnage">
            {/* Halo doré du joueur actif */}
            <Animated.View style={[StyleSheet.absoluteFill, glowStyle]}>
                <Svg width={W} height={H}>
                    <Defs>
                        <RadialGradient id="halo" cx="50%" cy="45%" rx="50%" ry="50%">
                            <Stop offset="0" stopColor="#FFD86B" stopOpacity="0.75" />
                            <Stop offset="1" stopColor="#FFD86B" stopOpacity="0" />
                        </RadialGradient>
                    </Defs>
                    <Ellipse cx={W / 2} cy={H * 0.48} rx={W * 0.62} ry={H * 0.55} fill="url(#halo)" />
                </Svg>
            </Animated.View>

            {/* Corps (respire) */}
            <Animated.View style={[styles.body, { transformOrigin: 'bottom' }, bodyStyle]}>
                {art?.body ? (
                    <Image source={art.body} style={{ width: W, height: H }} resizeMode="contain" />
                ) : (
                    <PlaceholderBody w={W} h={H} color={ROBE_COLORS[idx] || '#7A4A2A'} />
                )}
            </Animated.View>

            {/* Tête (respire, bouge à son tour en pivotant au cou, cligne) */}
            {wholeBust ? null : (
                <Animated.View style={[styles.abs, hb, { transformOrigin: 'bottom' }, headStyle]}>
                    {art?.head ? (
                        <>
                            <Image source={art.head} style={{ width: hb.width, height: hb.height }} resizeMode="stretch" />
                            {art.headBlink ? <Animated.Image source={art.headBlink} style={[StyleSheet.absoluteFill, { width: hb.width, height: hb.height }, blinkStyle]} resizeMode="stretch" /> : null}
                        </>
                    ) : (
                        <PlayerAvatar name={player?.name} variant={player?.avatar || 0} size={head} mood={mood} />
                    )}
                </Animated.View>
            )}

            {/* Minuteur : anneau autour de la tête, qui se vide */}
            {active && timer ? (
                <View style={[styles.abs, { left: ringLeft, top: ringTop }]}>
                    <CircularTimer timeLeft={timer.timeLeft} maxTime={timer.maxTime} size={ring} strokeWidth={4} showText={false} />
                </View>
            ) : null}

            {/* Bord de la table devant le buste (ombre douce) */}
            <View style={styles.tableEdge} />
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    abs: { position: 'absolute' },
    body: { ...StyleSheet.absoluteFillObject },
    tableEdge: { position: 'absolute', left: -6, right: -6, bottom: -2, height: 8, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.35)' },
});
