import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, ZoomIn, FadeInRight } from 'react-native-reanimated';
import PlayerAvatar from './PlayerAvatar';
import { Confetti } from './GameFx';
import { GameButton, theme } from './ui';
import audioService from '../network/audioService';
import XpCounter from './XpCounter';

const MEDALS = ['🥇', '🥈', '🥉'];

/**
 * Fin de partie avec classement (Kdoub, Sota Ghamla).
 * rows : [{ player, name, isMe, detail, loser }] dans l'ordre du classement.
 * hero : élément optionnel affiché sous le titre (ex : la Sota en grand).
 */
export default function RankingEndOverlay({ emoji, title, subtitle, rows, won, lost, hero, xpEarned, canReplay, onReplay, onQuit, onChangeGame }) {
    const { height } = useWindowDimensions();
    const compact = height < 520;

    // Le classement apparaît ligne par ligne, avec un petit son à chaque ligne
    useEffect(() => {
        const ts = Array.from({ length: rows.length }).map((_, i) => setTimeout(() => audioService.playSound('pop', { volume: 0.5, rate: 0.9 + i * 0.08 }), 450 + i * 380));
        return () => ts.forEach(clearTimeout);
    }, []);

    return (
        <Animated.View entering={FadeIn.duration(300)} style={styles.overlay}>
            {won && <Confetti />}
            <Animated.View entering={ZoomIn.springify().damping(13).delay(150)} style={[styles.panel, lost && styles.panelLost, compact && styles.panelCompact]}>
                <ScrollView style={{ width: '100%' }} contentContainerStyle={{ alignItems: 'center' }} showsVerticalScrollIndicator={false}>
                    {!compact && emoji ? <Text style={styles.emoji}>{emoji}</Text> : null}
                    <Text style={[styles.title, lost && { color: '#F87171' }, compact && { fontSize: 22 }]}>{title}</Text>
                    {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
                    {hero}
                    <View style={styles.table}>
                        {rows.map((r, rank) => (
                            <Animated.View
                                key={r.player}
                                entering={FadeInRight.delay(450 + rank * 380).springify().damping(14)}
                                style={[styles.row, r.isMe && styles.rowMe, r.loser && styles.rowLoser, compact && { paddingVertical: 3 }]}
                            >
                                <Text style={styles.medal}>{r.loser ? '💀' : MEDALS[rank] ?? `${rank + 1}.`}</Text>
                                <PlayerAvatar name={r.name} size={28} />
                                <Text style={[styles.name, r.isMe && { color: theme.goldLight }]} numberOfLines={1}>
                                    {r.isMe ? 'Toi' : r.name}
                                </Text>
                                <Text style={[styles.detail, r.loser && { color: '#F87171' }]}>{r.detail}</Text>
                            </Animated.View>
                        ))}
                    </View>
                    <XpCounter xp={xpEarned} delay={650 + rows.length * 380} compact={compact} />
                </ScrollView>
                <View style={[styles.actions, compact && { marginTop: 8 }]}>
                    {canReplay ? (
                        <GameButton small title="Rejouer" icon="🔄" variant="gold" onPress={onReplay} style={{ flex: 1 }} />
                    ) : (
                        <View style={styles.waiting}>
                            <Text style={styles.waitingText}>En attente de l'hôte…</Text>
                        </View>
                    )}
                    <GameButton small title="Quitter" icon="🚪" variant="red" onPress={onQuit} style={{ flex: 1 }} />
                </View>
                {onChangeGame && (
                    <GameButton small title="Changer de jeu" icon="🎲" variant="outline" onPress={onChangeGame} style={{ marginTop: 8, width: '100%' }} />
                )}
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
        maxWidth: 400,
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
        shadowColor: '#EF4444',
    },
    panelCompact: {
        maxWidth: 540,
        paddingVertical: 10,
    },
    emoji: { fontSize: 46 },
    title: {
        color: theme.goldLight,
        fontSize: 28,
        fontWeight: '900',
        letterSpacing: 3,
        textAlign: 'center',
    },
    subtitle: {
        color: theme.text,
        fontSize: 14,
        marginTop: 2,
        marginBottom: 10,
        textAlign: 'center',
    },
    table: {
        width: '100%',
        gap: 6,
        marginTop: 6,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.35)',
        borderRadius: 12,
        paddingVertical: 6,
        paddingHorizontal: 10,
        gap: 8,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    rowMe: {
        borderColor: theme.gold,
        backgroundColor: 'rgba(212,175,55,0.14)',
    },
    rowLoser: {
        backgroundColor: 'rgba(185,28,28,0.22)',
    },
    medal: { fontSize: 20, width: 28, textAlign: 'center' },
    name: {
        flex: 1,
        color: theme.cream,
        fontWeight: '800',
        fontSize: 14,
    },
    detail: {
        color: theme.mint,
        fontWeight: '900',
        fontSize: 13,
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
    xpText: { color: '#ECFDF5', fontWeight: '900', fontSize: 16 },
    actions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 16,
        width: '100%',
    },
    waiting: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    waitingText: { color: theme.textDim, fontStyle: 'italic' },
});
