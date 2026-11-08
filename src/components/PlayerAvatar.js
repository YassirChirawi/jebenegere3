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

const COLORS = [
    '#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6366f1', '#14b8a6'
];

export default function PlayerAvatar({ name, size = 40, active = false, mood, variant = 0 }) {
    const colorIndex = name?.length > 0 ? name.charCodeAt(0) % COLORS.length : 0;
    const bgColor = COLORS[colorIndex];
    // variant : avatar choisi dans le profil (0 = avatar d'origine, tiré du pseudo)
    const seed = variant ? `${name || 'Player'}-${variant}` : (name || 'Player');
    const avatarUrl = `https://api.dicebear.com/7.x/adventurer/png?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffdfbf,ffd5dc`;

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
            { width: size, height: size, borderRadius: size / 2, backgroundColor: bgColor },
            active && styles.activeAvatar,
        ]}>
            <Image
                source={{ uri: avatarUrl }}
                style={{ width: size * 0.9, height: size * 0.9, borderRadius: (size * 0.9) / 2 }}
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
        borderColor: '#1C2E4A',
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
