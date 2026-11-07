import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn, ZoomIn, FadeInRight, FadeInUp } from 'react-native-reanimated';
import PlayerAvatar from './PlayerAvatar';
import { Confetti } from './GameFx';
import { GameButton, theme } from './ui';
import audioService from '../network/audioService';

const MEDALS = ['🥇', '🥈', '🥉'];

/**
 * Fin de manche : classement par ordre de sortie, points gagnés, total, XP.
 */
export default function EndRoundOverlay({ gameState, localPlayerIndex, xpEarned, canReplay, onReplay, onQuit }) {
    const players = gameState.players || [];
    const total = gameState.hands.length;
    const finished = gameState.finishedPlayers || [];
    const loser = gameState.loserIndex;
    const iLost = loser === localPlayerIndex;
    const isPlayer = localPlayerIndex !== -1;

    // Ordre de sortie, puis le perdant en dernier
    const order = [...finished.filter((i) => i !== loser), ...(loser !== undefined && loser !== null ? [loser] : [])];

    useEffect(() => {
        if (xpEarned > 0) {
            const t = setTimeout(() => audioService.playSound('coin'), 1200);
            return () => clearTimeout(t);
        }
    }, [xpEarned]);

    const loserName = players[loser]?.name || 'Un joueur';

    return (
        <Animated.View entering={FadeIn.duration(300)} style={styles.overlay}>
            {isPlayer && !iLost && <Confetti />}
            <Animated.View entering={ZoomIn.springify().damping(13).delay(150)} style={[styles.panel, iLost && styles.panelLost]}>
                <Text style={styles.emoji}>{iLost ? '💀' : isPlayer ? '🎉' : '🏁'}</Text>
                <Text style={[styles.title, iLost && { color: '#F87171' }]}>
                    {iLost ? 'KHASSER !' : isPlayer ? 'BRAVO !' : 'MANCHE TERMINÉE'}
                </Text>
                <Text style={styles.subtitle}>
                    {iLost ? 'Tu es le dernier avec des cartes…' : `${loserName} est le Khasser !`}
                </Text>

                <View style={styles.table}>
                    {order.map((pIdx, rank) => {
                        const isMe = pIdx === localPlayerIndex;
                        const isLoser = pIdx === loser;
                        const earned = isLoser ? 0 : total - rank - 1;
                        return (
                            <Animated.View
                                key={pIdx}
                                entering={FadeInRight.delay(350 + rank * 120).springify().damping(15)}
                                style={[styles.row, isMe && styles.rowMe, isLoser && styles.rowLoser]}
                            >
                                <Text style={styles.medal}>{isLoser ? '💀' : MEDALS[rank] ?? `${rank + 1}.`}</Text>
                                <PlayerAvatar name={players[pIdx]?.name} size={30} />
                                <Text style={[styles.name, isMe && { color: theme.goldLight }]} numberOfLines={1}>
                                    {isMe ? 'Vous' : players[pIdx]?.name}
                                </Text>
                                <View style={styles.scoreCol}>
                                    <Text style={[styles.earned, isLoser && { color: '#F87171' }]}>+{earned}</Text>
                                    <Text style={styles.totalScore}>{gameState.scores?.[pIdx] ?? 0} pts</Text>
                                </View>
                            </Animated.View>
                        );
                    })}
                </View>

                {xpEarned > 0 && (
                    <Animated.View entering={ZoomIn.delay(1100).springify().damping(8)} style={styles.xpPill}>
                        <Text style={styles.xpText}>+{xpEarned} XP</Text>
                    </Animated.View>
                )}

                <Animated.Text entering={FadeInUp.delay(900)} style={styles.legend}>
                    Points : 1er = {total - 1} pts, puis -1 par place. Le Khasser ne marque rien.
                </Animated.Text>

                <View style={styles.actions}>
                    {canReplay ? (
                        <GameButton small title="Rejouer" icon="🔄" variant="gold" onPress={onReplay} style={{ flex: 1 }} />
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
        maxWidth: 400,
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
    emoji: {
        fontSize: 46,
    },
    title: {
        color: theme.goldLight,
        fontSize: 30,
        fontWeight: '900',
        letterSpacing: 3,
    },
    subtitle: {
        color: theme.text,
        fontSize: 14,
        marginTop: 2,
        marginBottom: 14,
        textAlign: 'center',
    },
    table: {
        width: '100%',
        gap: 6,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.35)',
        borderRadius: 12,
        paddingVertical: 7,
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
        backgroundColor: 'rgba(185,28,28,0.2)',
    },
    medal: {
        fontSize: 20,
        width: 28,
        textAlign: 'center',
    },
    name: {
        flex: 1,
        color: theme.cream,
        fontWeight: '800',
        fontSize: 14,
    },
    scoreCol: {
        alignItems: 'flex-end',
    },
    earned: {
        color: theme.mint,
        fontWeight: '900',
        fontSize: 15,
    },
    totalScore: {
        color: theme.textDim,
        fontSize: 11,
        fontWeight: '700',
    },
    xpPill: {
        marginTop: 14,
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
    legend: {
        color: theme.textDim,
        fontSize: 11,
        marginTop: 12,
        textAlign: 'center',
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
