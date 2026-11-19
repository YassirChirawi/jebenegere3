import React, { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import socketService from '../network/socketService';
import audioService from '../network/audioService';
import { theme } from './ui';

/** Annonce visible quand un joueur quitte la partie (remplacé par un bot, ou victoire par forfait). */
export default function PlayerLeftBanner() {
    const [info, setInfo] = useState(null);
    const timer = useRef(null);
    useEffect(() => {
        const off = socketService.onPlayerLeft((d) => {
            audioService.playSound('warning');
            setInfo({ ...d, id: Date.now() });
            clearTimeout(timer.current);
            timer.current = setTimeout(() => setInfo(null), 4500);
        });
        return () => { off(); clearTimeout(timer.current); };
    }, []);
    if (!info) return null;
    return (
        <Animated.View key={info.id} entering={FadeInDown.springify().damping(14)} exiting={FadeOut} style={styles.banner} pointerEvents="none">
            <Text style={styles.text}>
                🔌 {info.name} a quitté la partie{info.replacedByBot ? ' : un bot prend sa place' : ''}
            </Text>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    banner: {
        position: 'absolute',
        top: 64,
        left: 16,
        right: 16,
        alignItems: 'center',
        zIndex: 8000,
    },
    text: {
        backgroundColor: 'rgba(14,26,56,0.95)',
        color: theme.cream,
        fontWeight: '800',
        fontSize: 14,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#F59E0B',
        overflow: 'hidden',
        textAlign: 'center',
    },
});
