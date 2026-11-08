import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import socketService from '../network/socketService';
import accountService from '../network/accountService';
import audioService from '../network/audioService';
import { haptic, theme } from './ui';
import { rankFor } from '../../server/progress/defs';

/**
 * Notifications de progression envoyées par le serveur en fin de partie :
 * défi relevé (+ récompense), nouveau titre, nouveau rang. Affichées l'une après l'autre.
 */
export default function ProgressToaster() {
    const [item, setItem] = useState(null);
    const queue = useRef([]);
    const busy = useRef(false);

    const pump = () => {
        if (busy.current) return;
        const next = queue.current.shift();
        if (!next) { setItem(null); return; }
        busy.current = true;
        setItem(next);
        audioService.playSound(next.sound || 'coin');
        haptic(next.haptic || 'success');
        setTimeout(() => { busy.current = false; pump(); }, 3200);
    };

    useEffect(() => socketService.onProgress((p) => {
        accountService.applyProgress(p);
        const items = [];
        (p.completed || []).forEach((c) => {
            items.push({ icon: '🎯', title: 'Défi relevé !', text: `${c.label} · +${c.xp} XP`, color: theme.mint });
            if (c.reward) items.push({ icon: '🎁', title: c.reward.kind === 'back' ? 'Nouveau dos de cartes' : 'Nouveau tapis', text: `${c.reward.label} · à choisir dans Profil → Style`, color: theme.goldLight, sound: 'victory' });
        });
        (p.titles || []).forEach((t) => items.push({ icon: '🏷️', title: 'Nouveau titre !', text: `« ${t.label} » · à afficher depuis ton Profil`, color: '#C4B5FD', sound: 'announce' }));
        if (p.profile && p.xpGained) {
            const before = rankFor(p.profile.xp - p.xpGained);
            const after = rankFor(p.profile.xp);
            if (after.index > before.index) items.push({ icon: after.emoji, title: 'Nouveau rang !', text: after.name, color: theme.gold, sound: 'victory', haptic: 'double' });
        }
        if (!items.length) return;
        // On laisse d'abord l'écran de fin de partie s'afficher
        setTimeout(() => { queue.current.push(...items); pump(); }, 3500);
    }), []);

    if (!item) return null;
    return (
        <View pointerEvents="none" style={styles.wrap}>
            <Animated.View key={item.title + item.text} entering={FadeInDown.springify().damping(14)} exiting={FadeOutUp.duration(200)} style={[styles.toast, { borderColor: item.color }]}>
                <Text style={styles.icon}>{item.icon}</Text>
                <View style={{ flexShrink: 1 }}>
                    <Text style={[styles.title, { color: item.color }]}>{item.title}</Text>
                    <Text style={styles.text}>{item.text}</Text>
                </View>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { position: 'absolute', top: 14, left: 0, right: 0, alignItems: 'center', zIndex: 9000, elevation: 9000 },
    toast: { flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: '92%', backgroundColor: 'rgba(18,8,11,0.96)', borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 10, elevation: 12 },
    icon: { fontSize: 26 },
    title: { fontWeight: '900', fontSize: 14 },
    text: { color: theme.cream, fontWeight: '700', fontSize: 12 },
});
