import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const COLORS = [
    '#EF4444', // Red
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Yellow
    '#8B5CF6', // Purple
    '#EC4899', // Pink
];

export default function PlayerAvatar({ name, size = 40, active = false }) {
    // Generate a consistent color based on the name
    const colorIndex = name.length > 0 ? name.charCodeAt(0) % COLORS.length : 0;
    const bgColor = COLORS[colorIndex];

    // Get initial
    const initial = name.charAt(0).toUpperCase();

    return (
        <View style={[
            styles.container,
            { width: size, height: size, borderRadius: size / 2, backgroundColor: bgColor },
            active && styles.activeAvatar
        ]}>
            <Text style={[styles.text, { fontSize: size * 0.5 }]}>{initial}</Text>
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
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 4,
    },
    text: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    activeAvatar: {
        borderColor: '#FCD34D',
        borderWidth: 3,
    }
});
