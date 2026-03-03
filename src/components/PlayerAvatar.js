import React, { useEffect } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';

const COLORS = [
    '#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6366f1', '#14b8a6'
];

export default function PlayerAvatar({ name, size = 40, active = false }) {
    const colorIndex = name?.length > 0 ? name.charCodeAt(0) % COLORS.length : 0;
    const bgColor = COLORS[colorIndex];
    const avatarUrl = `https://api.dicebear.com/7.x/adventurer/png?seed=${encodeURIComponent(name || 'Player')}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffdfbf,ffd5dc`;

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
    activeAvatar: {
        borderColor: '#FFD700',
        borderWidth: 3,
    },
});
