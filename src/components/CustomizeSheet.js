import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, Pressable, Switch, Image } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { CardBack } from './Card';
import { theme, haptic } from './ui';
import audioService from '../network/audioService';
import { GAMES, GAME_ORDER } from '../games';
import {
    BACKS, FELTS, EFFECTS, TABLE_SKINS, UNLOCK, itemUnlocked, useCosmetics, refreshXp,
    setBack, setFelt, setEffect, setTable, setVibration, backPalette,
} from '../utils/cosmetics';
import { t } from '../i18n';
import LanguagePicker from './LanguagePicker';

const EFFECT_ICONS = { drapeau: '🎊', confettis: '🎉', etoiles: '⭐', menthe: '🌿', feu: '🔥', tonnerre: '⚡', or: '💰' };
const lockLabel = (item) => `🔒 ${UNLOCK[item.unlock].label}${item.alsoShop ? t(' ou boutique') : ''}`;

/**
 * Personnalisation : dos de cartes, tapis par jeu, vibrations.
 * Les éléments verrouillés indiquent le rang nécessaire.
 */
export default function CustomizeSheet({ visible, onClose, onOpenLegal }) {
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
                        <Text style={styles.title}>{t("🎨 Personnaliser")}</Text>
                        <Pressable onPress={onClose} hitSlop={10}><Text style={styles.close}>✕</Text></Pressable>
                    </View>
                    <Text style={styles.xp}>{cos.xp} {t("XP · les rangs, les défis du jour, les saisons et la boutique (en binga) débloquent de nouveaux dos, tapis et effets")}</Text>

                    <View style={styles.tabs}>
                        {[['backs', 'Dos'], ['felts', 'Tapis'], ['effects', 'Effets'], ['settings', 'Réglages']].map(([k, label]) => (
                            <Pressable key={k} onPress={() => setTab(k)} style={[styles.tab, tab === k && styles.tabOn]}>
                                <Text style={[styles.tabText, tab === k && styles.tabTextOn]}>{t(label)}</Text>
                            </Pressable>
                        ))}
                    </View>

                    <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ paddingBottom: 8 }}>
                        {tab === 'backs' && (
                            <View style={styles.grid}>
                                {Object.entries(BACKS).map(([id, b]) => {
                                    const open = itemUnlocked(b, `back:${id}`, cos);
                                    const on = cos.back === id;
                                    return (
                                        <Pressable key={id} onPress={() => choose(setBack(id))} style={[styles.item, on && styles.itemOn, !open && styles.itemLocked]}>
                                            <CardBack width={54} height={78} palette={b.perGame ? backPalette({ ...cos, back: 'game' }, cos.game) : b} />
                                            <Text style={styles.itemLabel}>{b.label}</Text>
                                            <Text style={[styles.itemSub, on && { color: theme.mint }]}>{on ? t('✓ Choisi') : open ? t('Disponible') : lockLabel(b)}</Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        )}

                        {tab === 'felts' && (
                            <>
                                {/* Tables de la boutique possédées (remplacent la table de chaque jeu) */}
                                {Object.keys(TABLE_SKINS).some((k) => (cos.unlocks || []).includes(`table:${k}`)) && (
                                    <>
                                        <Text style={styles.itemLabel}>{t("Table (pour les 4 jeux)")}</Text>
                                        <View style={[styles.grid, { marginTop: 6 }]}>
                                            {[null, ...Object.keys(TABLE_SKINS).filter((k) => (cos.unlocks || []).includes(`table:${k}`))].map((k) => {
                                                const on = (cos.table || null) === k;
                                                return (
                                                    <Pressable key={k || 'jeu'} onPress={() => choose(setTable(k))} style={[styles.item, on && styles.itemOn]}>
                                                        {k ? <Image source={TABLE_SKINS[k].src} style={styles.tableThumb} resizeMode="cover" /> : <View style={[styles.tableThumb, { backgroundColor: '#0E5A2E' }]} />}
                                                        <Text style={styles.itemLabel}>{k ? TABLE_SKINS[k].label : t('Table du jeu')}</Text>
                                                        <Text style={[styles.itemSub, on && { color: theme.mint }]}>{on ? t('✓ Choisie') : t('Disponible')}</Text>
                                                    </Pressable>
                                                );
                                            })}
                                        </View>
                                        <Text style={[styles.itemSub, { marginBottom: 8 }]}>{t("Avec une table de la boutique, les couleurs de tapis ci-dessous ne s'appliquent pas.")}</Text>
                                    </>
                                )}
                                <View style={styles.gameRow}>
                                    {GAME_ORDER.map((g) => (
                                        <Pressable key={g} onPress={() => setFeltGame(g)} style={[styles.gameChip, feltGame === g && { borderColor: GAMES[g].color, backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                                            <Text style={[styles.gameChipText, feltGame === g && { color: theme.cream }]}>{GAMES[g].label}</Text>
                                        </Pressable>
                                    ))}
                                </View>
                                <View style={styles.grid}>
                                    {(FELTS[feltGame] || []).map((f, i) => {
                                        const open = itemUnlocked(f, `felt:${feltGame}:${f.id}`, cos);
                                        const on = (cos.felts[feltGame] || 'default') === f.id;
                                        return (
                                            <Pressable key={f.id} onPress={() => choose(setFelt(feltGame, f.id))} style={[styles.item, on && styles.itemOn, !open && styles.itemLocked]}>
                                                <View style={[styles.swatch, { backgroundColor: f.color }]}>
                                                    <View style={styles.swatchPattern} />
                                                </View>
                                                <Text style={styles.itemLabel}>{f.label}</Text>
                                                <Text style={[styles.itemSub, on && { color: theme.mint }]}>
                                                    {on ? t('✓ Choisi') : open ? (i === 0 ? t('Par défaut') : t('Disponible')) : lockLabel(f)}
                                                </Text>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            </>
                        )}

                        {tab === 'effects' && (
                            <View style={styles.grid}>
                                {Object.entries(EFFECTS).map(([id, e]) => {
                                    const open = itemUnlocked(e, `effect:${id}`, cos);
                                    const on = (cos.effect || 'drapeau') === id;
                                    return (
                                        <Pressable key={id} onPress={() => choose(setEffect(id))} style={[styles.item, on && styles.itemOn, !open && styles.itemLocked]}>
                                            <Text style={{ fontSize: 34 }}>{EFFECT_ICONS[id]}</Text>
                                            <Text style={styles.itemLabel}>{e.label}</Text>
                                            <Text style={[styles.itemSub, on && { color: theme.mint }]}>{on ? t('✓ Choisi') : open ? t('Disponible') : lockLabel(e)}</Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        )}

                        {tab === 'settings' && (
                            <View style={[styles.settingRow, { flexDirection: 'column', alignItems: 'stretch' }]}>
                                <Text style={styles.itemLabel}>{t("🌐 Langue")}</Text>
                                <LanguagePicker style={{ marginTop: 8, justifyContent: 'flex-start' }} />
                            </View>
                        )}
                        {tab === 'settings' && (
                            <View style={styles.settingRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.itemLabel}>{t("📳 Vibrations")}</Text>
                                    <Text style={styles.itemSub}>{t("Courte pour une pose, longue pour un KDOUB, double pour une victoire. Le bouton muet coupe aussi les vibrations.")}</Text>
                                </View>
                                <Switch
                                    value={cos.vibration !== false}
                                    onValueChange={(v) => { setVibration(v); if (v) haptic('double'); }}
                                    trackColor={{ true: theme.goldDark, false: '#444' }}
                                    thumbColor={cos.vibration !== false ? theme.gold : '#999'}
                                />
                            </View>
                        )}
                        {tab === 'settings' && onOpenLegal && (
                            <View style={styles.legalRow}>
                                <Text style={styles.legalLink} onPress={() => onOpenLegal('privacy')}>{t("📄 Confidentialité")}</Text>
                                <Text style={styles.legalLink} onPress={() => onOpenLegal('terms')}>{t("📄 Conditions d'utilisation")}</Text>
                            </View>
                        )}
                    </ScrollView>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    legalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 16, justifyContent: 'center' },
    legalLink: { color: theme.goldLight, fontSize: 13, fontWeight: '800', textDecorationLine: 'underline' },
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
    tableThumb: { width: 96, height: 33, borderRadius: 6 },
    swatch: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: '#C9A23A', overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
    swatchPattern: { width: 30, height: 30, borderWidth: 1.5, borderColor: 'rgba(245,215,122,0.55)', transform: [{ rotate: '45deg' }] },
    gameRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
    gameChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.25)', marginRight: 6, marginBottom: 6 },
    gameChipText: { color: theme.textDim, fontWeight: '800', fontSize: 12 },
    settingRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.25)' },
});
