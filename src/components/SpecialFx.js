/**
 * Effets spéciaux des jeux (icônes de Yassir, scripts/build-fx-icons.py) : une icône lumineuse apparaît au centre
 * de la table sur les coups marquants. Visuel seulement : les règles ne changent pas.
 *   Hezz2 : 1 (Restriction), 2 (+2), 7 (Choix ultime)
 *   Ronda : Ronda, Tringa, dernière carte avec le 12 (Effet Royal), dernière carte sans rien prendre (Effet Flop)
 *   Sota Ghamla : la Sota (10) arrive dans ta main, toi seul la vois (Effet 10 secret)
 *   Kdoub : menteur démasqué (Effet Pinocchio)
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import Animated, { ZoomIn, FadeOut, useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

const ICONS = {
    restriction: require('../../assets/fx/restriction.webp'),
    plus2: require('../../assets/fx/plus2.webp'),
    choix: require('../../assets/fx/choix.webp'),
    ronda: require('../../assets/fx/ronda.webp'),
    tringa: require('../../assets/fx/tringa.webp'),
    royal: require('../../assets/fx/royal.webp'),
    flop: require('../../assets/fx/flop.webp'),
    secret: require('../../assets/fx/secret.webp'),
    dix: require('../../assets/fx/dix.webp'),
    pinocchio: require('../../assets/fx/pinocchio.webp'),
};

export const FX = {
    restriction: { title: 'Restriction', color: '#FBBF24' },
    plus2: { title: 'Attaque +2', color: '#C084FC' },
    choix: { title: 'Choix ultime', color: '#4ADE80' },
    ronda: { title: 'Effet Ronda', color: '#FBBF24' },
    tringa: { title: 'Effet Tringa', color: '#FB923C' },
    royal: { title: 'Effet Royal', color: '#F5D77A' },
    flop: { title: 'Effet Flop', color: '#F87171' },
    dix: { title: '10 secret', color: '#FDE68A', badge: 'secret' },
    pinocchio: { title: 'Pinocchio !', color: '#F87171' },
};

/** [fx, show] : show('plus2', 'texte facultatif') affiche l'effet 1,8 s. */
export function useSpecialFx() {
    const [fx, setFx] = useState(null);
    const timer = useRef(null);
    useEffect(() => () => clearTimeout(timer.current), []);
    const show = (name, sub) => {
        if (!FX[name]) return;
        const id = Date.now() + Math.random();
        setFx({ name, sub, id });
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setFx((f) => (f && f.id === id ? null : f)), 1800);
    };
    return [fx, show];
}

export function SpecialFxOverlay({ fx, top = '26%' }) {
    const pulse = useSharedValue(1);
    useEffect(() => {
        if (fx) pulse.value = withRepeat(withSequence(withTiming(1.08, { duration: 260 }), withTiming(1, { duration: 260 })), 3, true);
    }, [fx?.id]);
    const style = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
    if (!fx) return null;
    const def = FX[fx.name];
    return (
        <View pointerEvents="none" style={[styles.wrap, { top }]}>
            <Animated.View key={fx.id} entering={ZoomIn.springify().damping(10)} exiting={FadeOut.duration(250)} style={styles.box}>
                <Animated.View style={style}>
                    <Image source={ICONS[fx.name]} style={styles.icon} />
                    {def.badge && <Image source={ICONS[def.badge]} style={styles.badge} />}
                </Animated.View>
                <View style={[styles.label, { borderColor: def.color }]}>
                    <Text style={[styles.title, { color: def.color }]}>{def.title}</Text>
                    {fx.sub ? <Text style={styles.sub}>{fx.sub}</Text> : null}
                </View>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 60, elevation: 60 },
    box: { alignItems: 'center' },
    icon: { width: 130, height: 130 },
    badge: { position: 'absolute', right: -18, bottom: -6, width: 62, height: 62 },
    label: { alignItems: 'center', marginTop: -8, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, borderWidth: 1.5, backgroundColor: 'rgba(10,4,8,0.88)' },
    title: { fontSize: 20, fontWeight: '900' },
    sub: { color: '#FFF7D6', fontSize: 12, fontWeight: '800', textShadowColor: '#000', textShadowRadius: 6, marginTop: 2, textAlign: 'center', maxWidth: 280 },
});
