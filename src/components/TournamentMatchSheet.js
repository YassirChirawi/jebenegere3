import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import socketService from '../network/socketService';
import audioService from '../network/audioService';
import { GameButton, theme } from './ui';
import { t as tr } from '../i18n';

/**
 * Fin d'un match de tournoi, par-dessus l'écran de fin de partie :
 * vainqueur, score, coups clés (Darba, Hbel, B'achra, Missa, grosses pioches…), retour au tableau.
 */
export default function TournamentMatchSheet({ navigation, roomId }) {
    const [info, setInfo] = useState(null);
    const timer = useRef(null);

    useEffect(() => {
        const offOver = socketService.onTournamentMatchOver((d) => {
            clearTimeout(timer.current);
            // On laisse d'abord l'écran de fin de partie s'afficher
            timer.current = setTimeout(() => {
                audioService.playSound(d.final ? 'victory' : 'announce');
                setInfo(d);
            }, 2500);
        });
        return () => { offOver(); clearTimeout(timer.current); };
    }, []);

    if (!info) return null;
    const back = () => {
        socketService.leaveRoom(roomId);
        navigation.navigate('Tournament', { id: info.id });
    };

    return (
        <Animated.View entering={FadeIn} style={styles.backdrop}>
            <Animated.View entering={ZoomIn.springify().damping(14)} style={[styles.panel, info.final && styles.panelFinal]}>
                <Text style={styles.label}>{info.name} · {info.label}</Text>
                <Text style={styles.emoji}>{info.final ? '👑' : '🏆'}</Text>
                <Text style={styles.winner}>{info.winner}</Text>
                <Text style={styles.sub}>
                    {info.final ? tr('remporte le tournoi !') : tr('passe au tour suivant')}
                    {info.forfeit ? tr(' (par forfait)') : ''}
                </Text>
                {info.score ? <Text style={styles.score}>{tr("Score final")} {info.score}</Text> : null}
                {info.summary?.length > 0 && (
                    <View style={styles.summary}>
                        <Text style={styles.summaryTitle}>{tr("COUPS CLÉS")}</Text>
                        {info.summary.map((s, i) => <Text key={i} style={styles.line}>{s}</Text>)}
                    </View>
                )}
                <GameButton title={tr("Retour au tournoi")} icon="📋" onPress={back} style={{ marginTop: 16, alignSelf: 'stretch' }} />
            </Animated.View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 9000 },
    panel: { width: '100%', maxWidth: 380, backgroundColor: 'rgba(14,26,56,0.98)', borderRadius: 20, padding: 20, alignItems: 'center', borderWidth: 2, borderColor: theme.gold },
    panelFinal: { backgroundColor: '#5E0A12', borderColor: theme.goldLight },
    label: { color: theme.gold, fontWeight: '900', fontSize: 12, letterSpacing: 1, textAlign: 'center' },
    emoji: { fontSize: 44, marginTop: 6 },
    winner: { color: '#FFF7D6', fontWeight: '900', fontSize: 22, textAlign: 'center' },
    sub: { color: theme.cream, fontSize: 14, marginTop: 2, textAlign: 'center' },
    score: { color: theme.goldLight, fontWeight: '800', marginTop: 6 },
    summary: { marginTop: 14, alignSelf: 'stretch', backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 12, padding: 10 },
    summaryTitle: { color: theme.gold, fontWeight: '900', fontSize: 11, letterSpacing: 1, marginBottom: 4 },
    line: { color: theme.cream, fontSize: 13, marginTop: 3 },
});
