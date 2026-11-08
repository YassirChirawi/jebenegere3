import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { ZoomIn, useSharedValue, useAnimatedStyle, withDelay, withTiming, Easing } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from './ui';
import audioService from '../network/audioService';
import { getRankInfo } from '../utils/stats';

/**
 * Fin de partie : les XP gagnées défilent (+0 → +N) puis la barre de rang se remplit.
 */
export default function XpCounter({ xp, delay = 1100, compact }) {
    const [shown, setShown] = useState(0);
    const [rank, setRank] = useState(null);
    const fill = useSharedValue(0);
    const timers = useRef([]);

    useEffect(() => {
        if (!xp) return undefined;
        let cancelled = false;
        // Total après la partie (l'XP est ajoutée juste avant l'affichage)
        const loadRank = setTimeout(async () => {
            let total = 0;
            try { total = parseInt((await AsyncStorage.getItem('playerXP')) || '0', 10); } catch (e) { /* ignore */ }
            if (cancelled) return;
            const before = getRankInfo(Math.max(0, total - xp));
            const after = getRankInfo(total);
            setRank({ after, rankUp: before.name !== after.name });
            fill.value = before.name === after.name ? before.levelProgress : 0;
            fill.value = withDelay(delay + 900, withTiming(after.levelProgress, { duration: 900, easing: Easing.out(Easing.cubic) }));
        }, 300);

        // Compteur : ~12 pas, petit son de pièce tous les 3 pas
        const steps = 12;
        for (let k = 1; k <= steps; k++) {
            timers.current.push(setTimeout(() => {
                setShown(Math.round((xp * k) / steps));
                if (k % 3 === 0) audioService.playSound('coin', { volume: 0.35, rate: 0.9 + k * 0.03 });
            }, delay + k * 65));
        }
        return () => {
            cancelled = true;
            clearTimeout(loadRank);
            timers.current.forEach(clearTimeout);
            timers.current = [];
        };
    }, [xp]);

    const barStyle = useAnimatedStyle(() => ({ width: `${Math.max(4, fill.value * 100)}%` }));
    if (!xp) return null;

    return (
        <Animated.View entering={ZoomIn.delay(delay).springify().damping(9)} style={[styles.wrap, compact && { marginTop: 6 }]}>
            <View style={styles.pill}>
                <Text style={styles.xpText}>+{shown} XP</Text>
            </View>
            {rank && (
                <View style={styles.rankRow}>
                    <Text style={styles.rankName}>{rank.after.emoji} {rank.after.name}{rank.rankUp ? '  · NOUVEAU RANG !' : ''}</Text>
                    <View style={styles.track}>
                        <Animated.View style={[styles.fill, barStyle]} />
                    </View>
                </View>
            )}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    wrap: { alignItems: 'center', marginTop: 12, width: '100%' },
    pill: {
        backgroundColor: 'rgba(212,175,55,0.15)',
        borderColor: theme.gold,
        borderWidth: 1.5,
        borderRadius: 20,
        paddingHorizontal: 18,
        paddingVertical: 6,
    },
    xpText: { color: theme.goldLight, fontWeight: '900', fontSize: 18, letterSpacing: 1 },
    rankRow: { width: '80%', marginTop: 8, alignItems: 'center' },
    rankName: { color: theme.textDim, fontWeight: '800', fontSize: 11, marginBottom: 4 },
    track: { width: '100%', height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 3, backgroundColor: theme.gold },
});
