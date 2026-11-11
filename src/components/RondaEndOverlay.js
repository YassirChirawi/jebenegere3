import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, ZoomIn, FadeInUp } from 'react-native-reanimated';
import { Confetti } from './GameFx';
import { GameButton, theme } from './ui';
import audioService from '../network/audioService';
import XpCounter from './XpCounter';

/**
 * Fin de manche Ronda : le détail des points catégorie par catégorie
 * (Makla, Darba, Ronda, Hbel, Boug, Missa, 9a3a Rey, 9a3a AS…), puis le total / 41.
 */
// [clé, libellé, toujours affichée, explication]
const DETAIL_ROWS = [
    ['darba', 'Darba', true, 'prendre la carte posée'],
    ['ronda', 'Ronda / Tringa', true, 'annonces'],
    ['hbel', 'Hbel', false, '3e exemplaire'],
    ['boug', 'Boug', false, '4e exemplaire'],
    ['missa', 'Missa', false, 'table vidée'],
    ['rey', '9a3a Rey', true, 'dernière carte : 12 qui mange'],
    ['as', '9a3a AS', true, 'dernière carte ratée ou 1'],
    ['denonce', 'Il est rondé', false, 'dénonciations'],
];
const STEP = 180; // délai entre deux lignes du détail

export default function RondaEndOverlay({ state, myTeam, teamNames, xpEarned, canReplay, onReplay, onQuit }) {
    const { summary, winnerTeam, target, manche } = state;
    const { height } = useWindowDimensions();
    const compact = height < 520;
    const gameOver = winnerTeam !== null && winnerTeam !== undefined;
    const spectator = myTeam === null;
    const mancheGain = [0, 1].map((t) => summary.cardPoints[t] + summary.bonus[t]);
    const iWonGame = gameOver && winnerTeam === myTeam;
    const iWonManche = !spectator && mancheGain[myTeam] > mancheGain[1 - myTeam];

    // Le classement apparaît ligne par ligne, avec un petit son à chaque ligne
    useEffect(() => {
        const ts = Array.from({ length: rows.length }).map((_, i) => setTimeout(() => audioService.playSound('pop', { volume: 0.5, rate: 0.9 + i * 0.08 }), 450 + i * STEP));
        return () => ts.forEach(clearTimeout);
    }, []);

    const title = gameOver
        ? spectator ? `${teamNames[winnerTeam]} GAGNENT` : iWonGame ? 'VICTOIRE !' : 'DÉFAITE…'
        : `MANCHE ${manche}`;
    const emoji = gameOver ? (iWonGame ? '🏆' : spectator ? '🏁' : '😤') : iWonManche ? '🔥' : '🃏';

    const fmt = (v) => `${v > 0 ? '+' : ''}${v}`;
    const d = summary.detail;
    const rows = [
        { label: 'Makla', hint: 'cartes au-delà de 20', values: summary.cardPoints.map(fmt), subs: summary.captured.map((c) => `${c} cartes`) },
        ...(d
            ? DETAIL_ROWS
                .filter(([k, , always]) => always || d[k]?.[0] || d[k]?.[1])
                .map(([k, label, , hint]) => ({ label, hint, values: [0, 1].map((t) => fmt(d[k]?.[t] || 0)) }))
            : [{ label: 'Bonus', values: summary.bonus.map(fmt) }]), // ancien serveur : bonus groupés
    ];

    return (
        <Animated.View entering={FadeIn.duration(300)} style={styles.overlay}>
            {(iWonGame || (!gameOver && iWonManche)) && <Confetti count={gameOver ? 70 : 30} />}
            <Animated.View entering={ZoomIn.springify().damping(13).delay(150)} style={[styles.panel, gameOver && !iWonGame && !spectator && styles.panelLost, compact && styles.panelCompact]}>
                <ScrollView style={{ width: '100%' }} contentContainerStyle={{ alignItems: 'center' }} showsVerticalScrollIndicator={false}>
                    {!compact && <Text style={styles.emoji}>{emoji}</Text>}
                    <Text style={[styles.title, compact && { fontSize: 22 }]}>{title}</Text>
                    <Text style={styles.subtitle}>{state.forfeit ? 'Adversaire parti : victoire par forfait' : `Premier camp à ${target} points`}</Text>

                    <View style={styles.table}>
                        <View style={styles.headRow}>
                            <Text style={[styles.cell, styles.labelCell]} />
                            {[0, 1].map((t) => (
                                <Text key={t} style={[styles.cell, styles.headCell, t === myTeam && { color: theme.goldLight }]}>{teamNames[t]}</Text>
                            ))}
                        </View>
                        {rows.map((r, i) => (
                            <Animated.View key={r.label} entering={FadeInUp.delay(450 + i * STEP)} style={styles.row}>
                                <View style={styles.labelBox}>
                                    <Text style={styles.labelText}>{r.label}</Text>
                                    {r.hint && !compact ? <Text style={styles.hint}>{r.hint}</Text> : null}
                                </View>
                                {r.values.map((v, t) => (
                                    <View key={t} style={styles.valueCell}>
                                        <Text style={[styles.cell, v === '0' && styles.zero]}>{v}</Text>
                                        {r.subs ? <Text style={styles.hint}>{r.subs[t]}</Text> : null}
                                    </View>
                                ))}
                            </Animated.View>
                        ))}
                        <Animated.View entering={FadeInUp.delay(450 + rows.length * STEP)} style={[styles.row, styles.totalRow]}>
                            <Text style={[styles.cell, styles.labelCell, { color: theme.goldLight }]}>TOTAL</Text>
                            {summary.scores.map((v, t) => (
                                <Text key={t} style={[styles.cell, styles.totalCell, t === winnerTeam && { color: theme.mint }]}>
                                    {v}<Text style={styles.outOf}> / {target}</Text>
                                </Text>
                            ))}
                        </Animated.View>
                    </View>

                    <XpCounter xp={xpEarned} delay={800 + rows.length * STEP} compact={compact} />
                </ScrollView>

                <View style={[styles.actions, compact && { marginTop: 8 }]}>
                    {canReplay ? (
                        <GameButton small title={gameOver ? 'Rejouer' : 'Continuer'} icon={gameOver ? '🔄' : '▶️'} variant="gold" onPress={onReplay} style={{ flex: 1 }} />
                    ) : (
                        <View style={styles.waiting}>
                            <Text style={styles.waitingText}>En attente de l'hôte…</Text>
                        </View>
                    )}
                    <GameButton small title="Quitter" icon="🚪" variant="red" onPress={onQuit} style={{ flex: 1 }} />
                </View>
            </Animated.View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 18,
        zIndex: 5000,
        elevation: 5000,
    },
    panel: {
        width: '100%',
        maxWidth: 420,
        maxHeight: '96%',
        backgroundColor: theme.panelSolid,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: theme.gold,
        padding: 18,
        alignItems: 'center',
        shadowColor: theme.gold,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 24,
        elevation: 24,
    },
    panelLost: {
        borderColor: '#B91C1C',
    },
    panelCompact: {
        maxWidth: 560,
        paddingVertical: 10,
    },
    emoji: {
        fontSize: 46,
    },
    title: {
        color: theme.goldLight,
        fontSize: 28,
        fontWeight: '900',
        letterSpacing: 3,
    },
    subtitle: {
        color: theme.textDim,
        fontSize: 13,
        marginBottom: 12,
    },
    table: {
        width: '100%',
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 14,
        padding: 8,
    },
    headRow: {
        flexDirection: 'row',
        paddingBottom: 6,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(212,175,55,0.3)',
    },
    row: {
        flexDirection: 'row',
        paddingVertical: 4,
        alignItems: 'center',
    },
    labelBox: {
        flex: 1.6,
    },
    valueCell: {
        flex: 1,
        alignItems: 'center',
    },
    labelText: {
        color: theme.cream,
        fontWeight: '800',
        fontSize: 13,
    },
    hint: {
        color: theme.textDim,
        fontSize: 9,
    },
    zero: {
        color: theme.textDim,
        fontWeight: '600',
    },
    totalRow: {
        borderTopWidth: 1,
        borderTopColor: 'rgba(212,175,55,0.3)',
        marginTop: 4,
    },
    cell: {
        flex: 1,
        color: theme.cream,
        fontWeight: '800',
        fontSize: 15,
        textAlign: 'center',
    },
    labelCell: {
        flex: 1.6,
        textAlign: 'left',
        color: theme.textDim,
        fontSize: 12,
    },
    headCell: {
        fontSize: 13,
        letterSpacing: 1,
        color: theme.cream,
    },
    totalCell: {
        fontSize: 20,
        fontWeight: '900',
        color: theme.goldLight,
    },
    outOf: {
        fontSize: 11,
        color: theme.textDim,
    },
    xpPill: {
        marginTop: 12,
        backgroundColor: '#065F46',
        borderColor: theme.mint,
        borderWidth: 2,
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 4,
    },
    xpText: {
        color: '#ECFDF5',
        fontWeight: '900',
        fontSize: 16,
    },
    actions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 16,
        width: '100%',
    },
    waiting: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    waitingText: {
        color: theme.textDim,
        fontStyle: 'italic',
    },
});
