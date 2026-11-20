/**
 * Bilan de fin de partie (comptes) : XP qui remplit la barre du rang, binga qui défilent,
 * missions et défis réussis, nouveau rang, nouveau titre, récompense. Se ferme d'un geste.
 * Les chiffres viennent du serveur (événement « progress »).
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing, ZoomIn, FadeIn, FadeInDown, runOnJS } from 'react-native-reanimated';
import { GameButton, theme, haptic } from './ui';
import { BingaIcon } from './Decor';
import audioService from '../network/audioService';
import { rankFor } from '../../server/progress/defs';
import { t as tr } from '../i18n';

// Compteur qui défile de 0 à value
function CountUp({ value, delay = 0, duration = 900, style, prefix = '+' }) {
    const [n, setN] = useState(0);
    useEffect(() => {
        if (!value) { setN(0); return undefined; }
        let raf;
        const t0 = Date.now() + delay;
        const tick = () => {
            const k = Math.min(1, Math.max(0, (Date.now() - t0) / duration));
            setN(Math.round(value * (1 - (1 - k) ** 3)));
            if (k < 1) raf = setTimeout(tick, 30);
        };
        raf = setTimeout(tick, delay);
        return () => clearTimeout(raf);
    }, [value]);
    return <Text style={style}>{prefix}{n.toLocaleString('fr-FR')}</Text>;
}

// Barre d'XP : remplit depuis l'XP d'avant jusqu'à celle d'après (et passe au rang suivant si besoin)
function XpBar({ before, after, onRankUp }) {
    const rb = rankFor(before);
    const ra = rankFor(after);
    const up = ra.index > rb.index;
    const fill = useSharedValue(rb.levelProgress);
    const [label, setLabel] = useState(rb);
    useEffect(() => {
        const ease = Easing.out(Easing.cubic);
        if (!up) {
            fill.value = withDelay(400, withTiming(ra.levelProgress, { duration: 1100, easing: ease }));
            return;
        }
        const next = () => { setLabel(ra); onRankUp && onRankUp(); };
        fill.value = withDelay(400, withTiming(1, { duration: 800, easing: ease }, (done) => {
            if (!done) return;
            fill.value = 0;
            runOnJS(next)();
            fill.value = withTiming(ra.levelProgress, { duration: 700, easing: ease });
        }));
    }, []);
    const style = useAnimatedStyle(() => ({ width: `${Math.round(Math.min(1, fill.value) * 100)}%` }));
    return (
        <View style={{ alignSelf: 'stretch' }}>
            <View style={styles.rankRow}>
                <Text style={styles.rankName}>{label.emoji} {label.name}</Text>
                <Text style={styles.rankXp}>{after} XP{label.next ? ` / ${label.next.min}` : ''}</Text>
            </View>
            <View style={styles.bar}><Animated.View style={[styles.barFill, style]} /></View>
        </View>
    );
}

/**
 * recap : { won, xpGained, xpAfter, binga: { game, base, capped, won, vsBots, missions, rank, total },
 *           completed, titles, reward }
 */
export default function GameRecap({ recap, onClose }) {
    const [rankUp, setRankUp] = useState(false);
    useEffect(() => {
        if (!recap) return;
        setRankUp(false);
        audioService.playSound(recap.won ? 'victory' : 'coin');
        setTimeout(() => audioService.playSound('coins'), 700);
    }, [recap]);
    if (!recap) return null;
    const b = recap.binga || {};
    const before = Math.max(0, recap.xpAfter - recap.xpGained);
    const after = rankFor(recap.xpAfter);
    const lines = [];
    if (b.game > 0) lines.push({ label: b.won ? (b.vsBots ? tr("Victoire contre l'ordinateur") : tr('Victoire')) : tr('Partie finie, même en perdant'), amount: b.game });
    (b.missions || []).forEach((m) => lines.push({ label: tr("Mission : {p0}", { p0: m.label }), amount: m.binga }));
    if (b.rank) lines.push({ label: tr("Nouveau rang : {p0}", { p0: after.name }), amount: b.rank });

    return (
        <Modal visible transparent animationType="fade" onRequestClose={onClose}>
            <Animated.View entering={FadeIn.duration(200)} style={styles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <Animated.View entering={ZoomIn.springify().damping(14)} style={[styles.box, recap.won && styles.boxWon]}>
                    <Text style={[styles.title, recap.won && { color: '#F5D77A' }]}>{recap.won ? tr('🏆 Victoire !') : tr('Partie terminée')}</Text>
                    <ScrollView style={{ alignSelf: 'stretch', maxHeight: 460 }} contentContainerStyle={{ alignItems: 'center' }}>
                        {/* XP */}
                        <View style={styles.block}>
                            <View style={styles.gainRow}>
                                <Text style={styles.xpIcon}>⭐</Text>
                                <CountUp value={recap.xpGained} style={styles.xpGain} />
                                <Text style={styles.unit}>{tr("XP")}</Text>
                            </View>
                            <XpBar before={before} after={recap.xpAfter} onRankUp={() => { setRankUp(true); audioService.playSound('level_up'); haptic('double'); }} />
                            {rankUp && (
                                <Animated.View entering={ZoomIn.springify().damping(9)} style={styles.rankUp}>
                                    <Text style={styles.rankUpText}>{tr("Nouveau rang !")} {after.emoji} {after.name}</Text>
                                </Animated.View>
                            )}
                        </View>

                        {/* Binga */}
                        {(b.total > 0 || b.capped) && (
                            <View style={styles.block}>
                                <View style={styles.gainRow}>
                                    <BingaIcon size={38} />
                                    <CountUp value={b.total || 0} delay={500} style={styles.bingaGain} />
                                    <Text style={styles.unit}>{tr("binga")}</Text>
                                </View>
                                {lines.map((l, i) => (
                                    <Animated.View key={l.label} entering={FadeInDown.delay(700 + i * 180)} style={styles.line}>
                                        <Text style={styles.lineLabel} numberOfLines={1}>{l.label}</Text>
                                        <Text style={styles.lineAmount}>+{l.amount}</Text>
                                    </Animated.View>
                                ))}
                                {b.capped && <Text style={styles.note}>{tr("Plafond du jour atteint (500 binga en jouant) : missions et connexion rapportent toujours.")}</Text>}
                            </View>
                        )}

                        {/* Défis, titres, récompenses */}
                        {(recap.completed || []).map((c) => (
                            <Animated.View key={c.id} entering={FadeInDown.delay(1100)} style={styles.extra}>
                                <Text style={styles.extraText}>{tr("🎯 Défi relevé :")} {tr(c.label)} · +{c.xp} XP{c.reward ? ` · 🎁 ${tr(c.reward.label)}` : ''}</Text>
                            </Animated.View>
                        ))}
                        {(recap.titles || []).map((t) => (
                            <Animated.View key={t.id} entering={FadeInDown.delay(1200)} style={styles.extra}>
                                <Text style={styles.extraText}>{tr("🏷️ Nouveau titre : «")} {t.label} »</Text>
                            </Animated.View>
                        ))}
                        {recap.reward && (
                            <Animated.View entering={FadeInDown.delay(1200)} style={styles.extra}>
                                <Text style={styles.extraText}>{tr("👑 Récompense : dos «")} {recap.reward.label} »</Text>
                            </Animated.View>
                        )}
                    </ScrollView>
                    <GameButton title={tr("Continuer")} onPress={onClose} style={{ alignSelf: 'stretch', marginTop: 12 }} />
                </Animated.View>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', alignItems: 'center', padding: 16 },
    box: { width: '100%', maxWidth: 380, alignItems: 'center', backgroundColor: theme.panelSolid, borderRadius: 22, borderWidth: 2, borderColor: 'rgba(212,175,55,0.6)', padding: 18 },
    boxWon: { borderColor: '#F5D77A', shadowColor: '#F5D77A', shadowOpacity: 0.5, shadowRadius: 22, elevation: 14 },
    title: { color: theme.cream, fontSize: 24, fontWeight: '900', marginBottom: 8 },
    block: { alignSelf: 'stretch', alignItems: 'center', padding: 12, marginTop: 8, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
    gainRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    xpIcon: { fontSize: 30 },
    xpGain: { color: '#93C5FD', fontSize: 34, fontWeight: '900' },
    bingaGain: { color: theme.goldLight, fontSize: 34, fontWeight: '900' },
    unit: { color: theme.cream, fontSize: 15, fontWeight: '800' },
    rankRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    rankName: { color: theme.goldLight, fontWeight: '900', fontSize: 13 },
    rankXp: { color: theme.textDim, fontWeight: '800', fontSize: 12 },
    bar: { height: 12, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.5)', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)' },
    barFill: { height: '100%', backgroundColor: '#60A5FA', borderRadius: 6 },
    rankUp: { marginTop: 10, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(212,175,55,0.25)', borderWidth: 1.5, borderColor: '#F5D77A' },
    rankUpText: { color: '#F5D77A', fontWeight: '900', fontSize: 14 },
    line: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
    lineLabel: { color: theme.cream, fontSize: 12, fontWeight: '700', flex: 1, marginRight: 8 },
    lineAmount: { color: theme.goldLight, fontSize: 13, fontWeight: '900' },
    note: { color: theme.textDim, fontSize: 11, textAlign: 'center', marginTop: 6 },
    extra: { alignSelf: 'stretch', marginTop: 8, padding: 10, borderRadius: 12, backgroundColor: 'rgba(52,211,153,0.12)', borderWidth: 1, borderColor: 'rgba(52,211,153,0.5)' },
    extraText: { color: theme.cream, fontSize: 12, fontWeight: '800' },
});
