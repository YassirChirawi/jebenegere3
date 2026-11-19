/**
 * Effets de victoire et de coup spécial (cosmétiques, visuels seulement) :
 * Drapeau (offert, les confettis d'origine), Confettis, Étoiles, Menthe, Feu, Tonnerre, Or.
 * Chaque effet a son propre dessin et son propre mouvement ; tout tient en 3 secondes au plus.
 */
import React, { useEffect, useMemo } from 'react';
import { View, Text, Image, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withDelay, withTiming, withSequence, Easing } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { Confetti } from './GameFx';
import { useCosmetics, effectFor } from '../utils/cosmetics';

const MINT = require('../../assets/menthe.png');
const rnd = (a, b) => a + Math.random() * (b - a);

/**
 * Particule : va de (x0, y0) à (x1, y1) en suivant un arc (arc > 0 : monte d'abord),
 * tourne, grossit ou rétrécit, apparaît puis s'efface.
 */
function Particle({ cfg, children }) {
    const t = useSharedValue(0);
    useEffect(() => {
        t.value = withDelay(cfg.delay || 0, withTiming(1, { duration: cfg.dur, easing: cfg.ease || Easing.out(Easing.quad) }));
    }, []);
    const style = useAnimatedStyle(() => {
        const v = t.value;
        const fadeIn = cfg.fadeIn ?? 0.08;
        const fadeOut = cfg.fadeOut ?? 0.75;
        let opacity = v < fadeIn ? v / fadeIn : v > fadeOut ? Math.max(0, (1 - v) / (1 - fadeOut)) : 1;
        if (v === 0) opacity = 0;
        const s0 = cfg.s0 ?? 1;
        const s1 = cfg.s1 ?? 1;
        return {
            opacity,
            transform: [
                { translateX: cfg.x0 + (cfg.x1 - cfg.x0) * v },
                { translateY: cfg.y0 + (cfg.y1 - cfg.y0) * v - (cfg.arc || 0) * 4 * v * (1 - v) },
                { rotateZ: `${(cfg.rot || 0) * v}deg` },
                ...(cfg.flip ? [{ rotateY: `${cfg.flip * v}deg` }] : []),
                { scale: s0 + (s1 - s0) * v },
            ],
        };
    });
    return <Animated.View style={[styles.p, style]}>{children}</Animated.View>;
}

// Éclair (Tonnerre)
const BOLT = 'M14 0 L4 22 L12 22 L6 44 L24 16 L15 16 L22 0 Z';

function Flash({ delay = 0 }) {
    const o = useSharedValue(0);
    useEffect(() => {
        o.value = withDelay(delay, withSequence(withTiming(0.75, { duration: 70 }), withTiming(0.1, { duration: 120 }), withTiming(0.55, { duration: 60 }), withTiming(0, { duration: 420 })));
    }, []);
    const style = useAnimatedStyle(() => ({ opacity: o.value }));
    return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#E0F2FE' }, style]} />;
}

function build(effect, W, H, small) {
    const k = small ? 0.4 : 1;
    const n = (x) => Math.max(4, Math.round(x * k));
    const out = [];
    switch (effect) {
        case 'confettis': {
            // Deux canons dans les coins du bas : rubans et confettis multicolores
            const colors = ['#F43F5E', '#F59E0B', '#22C55E', '#3B82F6', '#A855F7', '#EC4899', '#FDE047', '#14B8A6'];
            for (let i = 0; i < n(70); i++) {
                const left = i % 2 === 0;
                const ribbon = i % 5 === 0;
                const w = ribbon ? 4 : rnd(6, 11);
                const h = ribbon ? rnd(18, 28) : rnd(4, 9);
                out.push({
                    key: i,
                    cfg: { x0: left ? 0 : W, y0: H, x1: left ? rnd(W * 0.15, W * 0.9) : rnd(W * 0.1, W * 0.85), y1: rnd(H * 0.35, H * 1.05), arc: rnd(H * 0.55, H * 0.95), rot: rnd(-900, 900), flip: rnd(360, 1080), delay: rnd(0, 350), dur: rnd(1700, 2500), ease: Easing.linear, fadeOut: 0.82 },
                    el: <View style={{ width: w, height: h, borderRadius: ribbon ? 2 : 1, backgroundColor: colors[i % colors.length] }} />,
                });
            }
            break;
        }
        case 'etoiles': {
            // Étoiles qui scintillent un peu partout et montent doucement
            for (let i = 0; i < n(36); i++) {
                const x = rnd(0, W);
                const y = rnd(H * 0.05, H * 0.9);
                const size = rnd(14, 34);
                out.push({
                    key: i,
                    cfg: { x0: x, y0: y, x1: x + rnd(-20, 20), y1: y - rnd(30, 90), rot: rnd(-180, 180), s0: 0.2, s1: 1.2, delay: rnd(0, 1100), dur: rnd(1100, 1700), fadeIn: 0.25, fadeOut: 0.6 },
                    el: <Text style={{ fontSize: size, color: i % 3 === 0 ? '#FFFFFF' : i % 3 === 1 ? '#FDE68A' : '#93C5FD', textShadowColor: '#FDE68A', textShadowRadius: 8 }}>{i % 4 === 0 ? '✦' : '★'}</Text>,
                });
            }
            break;
        }
        case 'menthe': {
            // Feuilles de menthe qui tombent en tournoyant
            for (let i = 0; i < n(30); i++) {
                const x = rnd(-10, W);
                const size = rnd(22, 40);
                out.push({
                    key: i,
                    cfg: { x0: x, y0: -50, x1: x + rnd(-90, 90), y1: H + 30, rot: rnd(-540, 540), delay: rnd(0, 900), dur: rnd(1900, 2600), ease: Easing.in(Easing.quad), fadeOut: 0.88 },
                    el: <Image source={MINT} style={{ width: size, height: size }} resizeMode="contain" />,
                });
            }
            break;
        }
        case 'feu': {
            // Braises qui montent depuis le bas, et flammes
            const colors = ['#FDE047', '#FB923C', '#F97316', '#EF4444', '#DC2626'];
            for (let i = 0; i < n(55); i++) {
                const x = rnd(0, W);
                const size = rnd(5, 14);
                out.push({
                    key: `e${i}`,
                    cfg: { x0: x, y0: H + 10, x1: x + rnd(-60, 60), y1: rnd(H * 0.15, H * 0.6), s0: 1, s1: 0.2, delay: rnd(0, 900), dur: rnd(1300, 2000), fadeOut: 0.6 },
                    el: <View style={{ width: size, height: size, borderRadius: size, backgroundColor: colors[i % colors.length], shadowColor: '#F97316', shadowOpacity: 0.9, shadowRadius: 6 }} />,
                });
            }
            for (let i = 0; i < n(9); i++) {
                const x = (W / 9) * i + rnd(-8, 8);
                out.push({
                    key: `f${i}`,
                    cfg: { x0: x, y0: H - 30, x1: x, y1: H - rnd(110, 200), s0: 0.6, s1: 1.6, delay: rnd(0, 500), dur: rnd(1200, 1700), fadeIn: 0.15, fadeOut: 0.55 },
                    el: <Text style={{ fontSize: 44 }}>🔥</Text>,
                });
            }
            break;
        }
        case 'tonnerre': {
            // Éclairs + étincelles bleues (l'éclair blanc de l'écran est ajouté à part)
            for (let i = 0; i < (small ? 2 : 4); i++) {
                const x = rnd(W * 0.1, W * 0.8);
                const y = rnd(H * 0.05, H * 0.45);
                const s = rnd(2.2, 3.6);
                out.push({
                    key: `b${i}`,
                    cfg: { x0: x, y0: y, x1: x, y1: y + 10, s0: s * 0.9, s1: s, delay: i * 260, dur: 650, fadeIn: 0.05, fadeOut: 0.35 },
                    el: (
                        <Svg width={26} height={44} viewBox="0 0 26 44">
                            <Path d={BOLT} fill="#FEF9C3" stroke="#60A5FA" strokeWidth={1.5} />
                        </Svg>
                    ),
                });
            }
            for (let i = 0; i < n(40); i++) {
                const x = rnd(0, W);
                const y = rnd(0, H * 0.6);
                out.push({
                    key: `s${i}`,
                    cfg: { x0: x, y0: y, x1: x + rnd(-80, 80), y1: y + rnd(40, 160), s0: 1, s1: 0.3, delay: rnd(0, 1100), dur: rnd(600, 1000), fadeOut: 0.5 },
                    el: <View style={{ width: 3, height: rnd(8, 16), borderRadius: 2, backgroundColor: i % 2 ? '#93C5FD' : '#FFFFFF' }} />,
                });
            }
            break;
        }
        case 'or': {
            // Pluie de pièces d'or qui tournent, et reflets
            for (let i = 0; i < n(42); i++) {
                const x = rnd(-10, W);
                const size = rnd(18, 30);
                out.push({
                    key: `c${i}`,
                    cfg: { x0: x, y0: -40, x1: x + rnd(-40, 40), y1: H + 30, flip: rnd(540, 1440), delay: rnd(0, 1000), dur: rnd(1500, 2200), ease: Easing.in(Easing.quad), fadeOut: 0.9 },
                    el: (
                        <View style={{ width: size, height: size, borderRadius: size, backgroundColor: '#F5C542', borderWidth: 2, borderColor: '#B7791F', alignItems: 'center', justifyContent: 'center' }}>
                            <View style={{ width: size * 0.55, height: size * 0.55, borderRadius: size, borderWidth: 1.5, borderColor: '#FFF3B0' }} />
                        </View>
                    ),
                });
            }
            for (let i = 0; i < n(18); i++) {
                const x = rnd(0, W);
                const y = rnd(0, H * 0.8);
                out.push({
                    key: `g${i}`,
                    cfg: { x0: x, y0: y, x1: x, y1: y - 20, s0: 0.2, s1: 1.4, rot: 90, delay: rnd(200, 1400), dur: 800, fadeIn: 0.3, fadeOut: 0.5 },
                    el: <Text style={{ fontSize: 26, color: '#FFF7CC' }}>✦</Text>,
                });
            }
            break;
        }
        default:
            break;
    }
    return out;
}

/**
 * Effet choisi par le joueur. small : version courte pour un coup spécial.
 * effect : pour forcer un effet (aperçu dans la boutique).
 */
export function WinEffect({ small = false, count, effect: forced }) {
    const cos = useCosmetics();
    const effect = forced || effectFor(cos);
    const { width, height } = useWindowDimensions();
    const parts = useMemo(() => build(effect, width, height, small), [effect, width, height, small]);
    if (effect === 'drapeau') return <Confetti count={count || (small ? 25 : 60)} />;
    return (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.wrap]}>
            {effect === 'tonnerre' && <Flash />}
            {effect === 'tonnerre' && !small && <Flash delay={520} />}
            {parts.map((p) => <Particle key={p.key} cfg={p.cfg}>{p.el}</Particle>)}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { overflow: 'hidden', zIndex: 50 },
    p: { position: 'absolute', left: 0, top: 0 },
});
