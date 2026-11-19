import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Image, Text } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withSequence,
    withTiming,
    withSpring,
    ZoomIn,
    ZoomOut,
} from 'react-native-reanimated';

// Réactions d'avatar : petit saut quand on joue, émotions sur les moments forts
const MOOD_EMOJI = { lose: '😭', kdoub: '😤', khasser: '🤡', win: '😎', proud: '😎', shock: '😱' };

// Portraits dessinés pour le jeu (scripts/build-avatars.py), embarqués dans l'appli : rien n'est chargé d'un autre site.
// 1 à 12 : offerts ; 13 à 36 : boutique et coffres (planches suivantes)
export const FREE_AVATARS = 12;
export const AVATARS = [
    require('../../assets/avatars/avatar_00.webp'), require('../../assets/avatars/avatar_01.webp'),
    require('../../assets/avatars/avatar_02.webp'), require('../../assets/avatars/avatar_03.webp'),
    require('../../assets/avatars/avatar_04.webp'), require('../../assets/avatars/avatar_05.webp'),
    require('../../assets/avatars/avatar_06.webp'), require('../../assets/avatars/avatar_07.webp'),
    require('../../assets/avatars/avatar_08.webp'), require('../../assets/avatars/avatar_09.webp'),
    require('../../assets/avatars/avatar_10.webp'), require('../../assets/avatars/avatar_11.webp'),
    require('../../assets/avatars/avatar_12.webp'), require('../../assets/avatars/avatar_13.webp'),
    require('../../assets/avatars/avatar_14.webp'), require('../../assets/avatars/avatar_15.webp'),
    require('../../assets/avatars/avatar_16.webp'), require('../../assets/avatars/avatar_17.webp'),
    require('../../assets/avatars/avatar_18.webp'), require('../../assets/avatars/avatar_19.webp'),
    require('../../assets/avatars/avatar_20.webp'), require('../../assets/avatars/avatar_21.webp'),
    require('../../assets/avatars/avatar_22.webp'), require('../../assets/avatars/avatar_23.webp'),
    require('../../assets/avatars/avatar_24.webp'), require('../../assets/avatars/avatar_25.webp'),
    require('../../assets/avatars/avatar_26.webp'), require('../../assets/avatars/avatar_27.webp'),
    // 29 à 36 : portraits premium (scripts/build-avatars-premium.py)
    require('../../assets/avatars/avatar_28.webp'), require('../../assets/avatars/avatar_29.webp'),
    require('../../assets/avatars/avatar_30.webp'), require('../../assets/avatars/avatar_31.webp'),
    require('../../assets/avatars/avatar_32.webp'), require('../../assets/avatars/avatar_33.webp'),
    require('../../assets/avatars/avatar_34.webp'), require('../../assets/avatars/avatar_35.webp'),
];

/** Portrait d'un joueur : variant 1 à 36 = portrait choisi dans le Profil ; 0 = tiré du pseudo (parmi les 12 offerts). */
export function avatarIndex(name, variant = 0) {
    if (variant >= 1) return (variant - 1) % AVATARS.length;
    let h = 0;
    for (const c of String(name || 'Joueur')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return h % FREE_AVATARS; // inchangé : le portrait tiré du pseudo reste le même qu'avant
}

export default function PlayerAvatar({ name, size = 40, active = false, mood, variant = 0 }) {
    const source = AVATARS[avatarIndex(name, variant)];

    // Pulse ring animation
    const pulseScale = useSharedValue(1);
    const pulseOpacity = useSharedValue(0);

    useEffect(() => {
        if (active) {
            pulseScale.value = withRepeat(
                withSequence(
                    withTiming(1.6, { duration: 600 }),
                    withTiming(1.0, { duration: 600 })
                ),
                -1,
                false
            );
            pulseOpacity.value = withRepeat(
                withSequence(
                    withTiming(0.8, { duration: 600 }),
                    withTiming(0, { duration: 600 })
                ),
                -1,
                false
            );
        } else {
            pulseScale.value = withTiming(1, { duration: 200 });
            pulseOpacity.value = withTiming(0, { duration: 200 });
        }
    }, [active]);

    // Réaction : saut, secousse ou gonflement selon l'événement, avec un emoji qui apparaît
    const hop = useSharedValue(0);
    const wob = useSharedValue(0);
    const puff = useSharedValue(1);
    const [badge, setBadge] = useState(null);
    useEffect(() => {
        if (!mood) return undefined;
        const t = mood.type;
        if (t === 'play' || t === 'win' || t === 'proud') {
            hop.value = withSequence(withTiming(-8, { duration: 110 }), withSpring(0, { damping: 6 }));
        }
        if (t === 'lose' || t === 'khasser' || t === 'shock') {
            wob.value = withSequence(withTiming(-8, { duration: 60 }), withTiming(8, { duration: 60 }), withTiming(-6, { duration: 60 }), withTiming(6, { duration: 60 }), withTiming(0, { duration: 60 }));
        }
        if (t === 'kdoub') {
            puff.value = withSequence(withTiming(1.3, { duration: 140 }), withSpring(1, { damping: 5 }));
        }
        if (MOOD_EMOJI[t]) {
            setBadge({ id: mood.id, e: MOOD_EMOJI[t] });
            const h = setTimeout(() => setBadge((b) => (b && b.id === mood.id ? null : b)), t === 'khasser' ? 3500 : 1700);
            return () => clearTimeout(h);
        }
        return undefined;
    }, [mood?.id]);
    const moodStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: hop.value }, { rotateZ: `${wob.value}deg` }, { scale: puff.value }],
    }));

    const ringStyle = useAnimatedStyle(() => ({
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2.5,
        borderColor: '#FFD700',
        transform: [{ scale: pulseScale.value }],
        opacity: pulseOpacity.value,
    }));

    return (
        <Animated.View style={moodStyle}>
        <View style={[
            styles.container,
            { width: size, height: size, borderRadius: size / 2 },
            active && styles.activeAvatar,
        ]}>
            <Image
                source={source}
                style={{ width: size - 4, height: size - 4, borderRadius: (size - 4) / 2 }}
                resizeMode="cover"
            />
            {/* Animated golden pulse ring */}
            <Animated.View style={ringStyle} />
        </View>
        {badge && (
            <Animated.View key={badge.id} entering={ZoomIn.springify().damping(8)} exiting={ZoomOut.duration(150)} style={[styles.badge, { right: -size * 0.18, top: -size * 0.18 }]} pointerEvents="none">
                <Text style={{ fontSize: Math.max(14, size * 0.42) }}>{badge.e}</Text>
            </Animated.View>
        )}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#B8892B',
        backgroundColor: '#0B1A3A',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 5,
        elevation: 6,
        overflow: 'visible',
    },
    badge: {
        position: 'absolute',
        zIndex: 10,
    },
    activeAvatar: {
        borderColor: '#FFD700',
        borderWidth: 3,
    },
});
