import React from 'react';
import { View, StyleSheet, Image } from 'react-native';

const COLORS = [
    '#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#6366f1', '#14b8a6'
];

export default function PlayerAvatar({ name, size = 40, active = false }) {
    // Determine background color based on name length/chars
    const colorIndex = name?.length > 0 ? name.charCodeAt(0) % COLORS.length : 0;
    const bgColor = COLORS[colorIndex];

    // Use DiceBear Adventurer API for unique, cool avatars based on the player's name seed
    // Using PNG format for React Native cross-compatibility
    const avatarUrl = `https://api.dicebear.com/7.x/adventurer/png?seed=${encodeURIComponent(name || 'Player')}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffdfbf,ffd5dc`;

    return (
        <View style={[
            styles.container,
            { width: size, height: size, borderRadius: size / 2, backgroundColor: bgColor },
            active && styles.activeAvatar
        ]}>
            <Image
                source={{ uri: avatarUrl }}
                style={{ width: size * 0.9, height: size * 0.9, borderRadius: (size * 0.9) / 2 }}
                resizeMode="cover"
            />
            {active && <View style={styles.activeGlow} />}
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
        transform: [{ scale: 1.1 }]
    },
    activeGlow: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        borderRadius: 100,
        backgroundColor: 'rgba(255, 215, 0, 0.2)',
    }
});
