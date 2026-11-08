import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, Pressable, Switch } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { CardBack } from './Card';
import { theme, haptic } from './ui';
import audioService from '../network/audioService';
import { GAMES, GAME_ORDER } from '../games';
import {
    BACKS, FELTS, UNLOCK, isUnlocked, useCosmetics, refreshXp,
    setBack, setFelt, setVibration, backPalette,
} from '../utils/cosmetics';

/**
 * Personnalisation : dos de cartes, tapis par jeu, vibrations.
 * Les éléments verrouillés indiquent le rang nécessaire.
 */
export default function CustomizeSheet({ visible, onClose }) {
    const cos = useCosmetics();
    const [tab, setTab] = useState('backs');
    const [feltGame, setFeltGame] = useState('hezz2');

    useEffect(() => { if (visible) refreshXp(); }, [visible]);

    const choose = (ok) => {
        if (ok) { audioService.playSound('coin'); haptic('light'); }
        else { audioService.playSound('error'); haptic('warning'); }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Animated.View entering={FadeIn.duration(150)} style={styles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <Animated.View entering={FadeInDown.springify().damping(16)} style={styles.sheet}>
                    <View style={styles.header}>
                        <Text style={styles.title}>🎨 Personnaliser</Text>
                        <Pressable onPress={onClose} hitSlop={10}><Text style={styles.close}>✕</Text></Pressable>
                    </View>
                    <Text style={styles.xp}>{cos.xp} XP · les rangs débloquent de nouveaux dos et tapis</Text>

                    <View style={styles.tabs}>
                        {[['backs', 'Dos de cartes'], ['felts', 'Tapis'], ['settings', 'Réglages']].map(([k, label]) => (
                            <Pressable key={k} onPress={() => setTab(k)} style={[styles.tab, tab === k && styles.tabOn]}>
                                <Text style={[styles.tabText, tab === k && styles.tabTextOn]}>{label}</Text>
                            </Pressable>
                        ))}
                    </View>

                    <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ paddingBottom: 8 }}>
                        {tab === 'backs' && (
                            <View style={styles.grid}>
                                {Object.entries(BACKS).map(([id, b]) => {
                                    const open = isUnlocked(b.unlock, cos.xp);
                                    const on = cos.back === id;
                                    return (
                                        <Pressable key={id} onPress={() => choose(setBack(id))} style={[styles.item, on && styles.itemOn, !open && styles.itemLocked]}>
                                            <CardBack width={54} height={78} palette={backPalette({ ...cos, back: id }, cos.game)} />
                                            <Text style={styles.itemLabel}>{b.label}</Text>
                                            <Text style={[styles.itemSub, on && { color: theme.mint }]}>{on ? '✓ Choisi' : open ? 'Disponible' : `🔒 ${UNLOCK[b.unlock].label}`}</Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        )}

                        {tab === 'felts' && (
                            <>
                                <View style={styles.gameRow}>
                                    {GAME_ORDER.map((g) => (
                                        <Pressable key={g} onPress={() => setFeltGame(g)} style={[styles.gameChip, feltGame === g && { borderColor: GAMES[g].color, backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                                            <Text style={[styles.gameChipText, feltGame === g && { color: theme.cream }]}>{GAMES[g].label}</Text>
                                        </Pressable>
                                    ))}
                                </View>
                                <View style={styles.grid}>
                                    {(FELTS[feltGame] || []).map((f, i) => {
                                        const open = isUnlocked(f.unlock, cos.xp);
                                        const on = (cos.felts[feltGame] || 'default') === f.id;
                                        return (
                                            <Pressable key={f.id} onPress={() => choose(setFelt(feltGame, f.id))} style={[styles.item, on && styles.itemOn, !open && styles.itemLocked]}>
                                                <View style={[styles.swatch, { backgroundColor: f.color }]}>
                                                    <View style={styles.swatchPattern} />
                                                </View>
                                                <Text style={styles.itemLabel}>{f.label}</Text>
                                                <Text style={[styles.itemSub, on && { color: theme.mint }]}>
                                                    {on ? '✓ Choisi' : open ? (i === 0 ? 'Par défaut' : 'Disponible') : `🔒 ${UNLOCK[f.unlock].label}`}
                                                </Text>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            </>
                        )}

                        {tab === 'settings' && (
                            <View style={styles.settingRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.itemLabel}>📳 Vibrations</Text>
                                    <Text style={styles.itemSub}>Courte pour une pose, longue pour un KDOUB, double pour une victoire. Le bouton muet coupe aussi les vibrations.</Text>
                                </View>
                                <Switch
                                    value={cos.vibration !== false}
                                    onValueChange={(v) => { setVibration(v); if (v) haptic('double'); }}
                                    trackColor={{ true: theme.goldDark, false: '#444' }}
                                    thumbColor={cos.vibration !== false ? theme.gold : '#999'}
                                />
                            </View>
                        )}
                    </ScrollView>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 16 },
    sheet: { width: '100%', maxWidth: 440, backgroundColor: theme.panelSolid, borderRadius: 20, borderWidth: 1.5, borderColor: theme.gold, padding: 16 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { color: theme.goldLight, fontSize: 20, fontWeight: '900' },
    close: { color: theme.textDim, fontSize: 20, fontWeight: '900' },
    xp: { color: theme.textDim, fontSize: 12, marginTop: 4, marginBottom: 10 },
    tabs: { flexDirection: 'row', marginBottom: 12, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 3 },
    tab: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
    tabOn: { backgroundColor: theme.gold },
    tabText: { color: theme.textDim, fontWeight: '800', fontSize: 12 },
    tabTextOn: { color: theme.bg },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    item: { width: '31%', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, marginBottom: 10, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.25)', backgroundColor: 'rgba(0,0,0,0.25)' },
    itemOn: { borderColor: theme.mint, backgroundColor: 'rgba(52,211,153,0.1)' },
    itemLocked: { opacity: 0.45 },
    itemLabel: { color: theme.cream, fontWeight: '800', fontSize: 12, marginTop: 6, textAlign: 'center' },
    itemSub: { color: theme.textDim, fontSize: 10, marginTop: 2, textAlign: 'center' },
    swatch: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: '#C9A23A', overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
    swatchPattern: { width: 30, height: 30, borderWidth: 1.5, borderColor: 'rgba(245,215,122,0.55)', transform: [{ rotate: '45deg' }] },
    gameRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
    gameChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.25)', marginRight: 6, marginBottom: 6 },
    gameChipText: { color: theme.textDim, fontWeight: '800', fontSize: 12 },
    settingRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.25)' },
});
