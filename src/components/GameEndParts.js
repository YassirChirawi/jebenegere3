/**
 * Morceaux communs aux écrans de fin de partie (Hezz2, Ronda, Kdoub, Sota Ghamla) :
 * - GameHighlights : les temps forts de la partie (envoyés par le serveur, server/progress/highlights.js) ;
 * - EndActions : « Rejouer » en grand, « Quitter » et « Changer de jeu » en dessous.
 * Affichage seulement : rien ne change les règles.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInUp, ZoomIn } from 'react-native-reanimated';
import PlayerAvatar from './PlayerAvatar';
import { GameButton, theme } from './ui';
import { t as tr } from '../i18n';

// kind -> [icône, libellé (avec {n})]. Les mots du jeu restent en darija.
const LABELS = {
    boug: ['⚡', 'Boug'],
    hbel: ['🔥', 'Hbel'],
    tringa: ['🎴', 'Tringa'],
    ronda: ['🎴', 'Ronda'],
    rey: ['👑', '9A3A REY'],
    missa: ['🧹', 'Missa'],
    darba: ['💥', 'Darba'],
    two: ['✌️', 'Le plus de 2 joués'],
    one: ['☝️', 'Le plus de 1 joués'],
    catch: ['🤥', 'Menteur démasqué'],
    pairs: ['🃏', 'Le plus de paires'],
};
const PILE = { hezz2: 'Grosse pioche', kdoub: 'Gros tas ramassé' };

// chips : version courte en pastilles (Ronda, au-dessus du long tableau des points)
export function GameHighlights({ items, players, me, gameType, delay = 0, compact, chips }) {
    // « Premier sorti » est déjà dans le classement
    const list = (items || []).filter((h) => h.kind !== 'first' && (LABELS[h.kind] || h.kind === 'pile'));
    if (!list.length) return null;
    const nameOf = (h) => (h.player === me ? tr('Toi') : players?.[h.player]?.name || '?');
    if (chips) {
        return (
            <Animated.View entering={FadeInUp.delay(delay).springify().damping(15)} style={styles.chips} accessibilityLabel={tr('Temps forts')}>
                {list.map((h, i) => (
                    <Animated.View key={`${h.kind}-${h.player}`} entering={ZoomIn.delay(delay + 120 + i * 120).springify().damping(13)} style={[styles.chip, h.player === me && styles.chipMe]}>
                        <Text style={styles.chipText} numberOfLines={1}>
                            {LABELS[h.kind][0]} {tr(LABELS[h.kind][1])}{h.n > 1 ? ` ×${h.n}` : ''} <Text style={styles.chipWho}>· {nameOf(h)}</Text>
                        </Text>
                    </Animated.View>
                ))}
            </Animated.View>
        );
    }
    return (
        <Animated.View entering={FadeInUp.delay(delay).springify().damping(15)} style={[styles.box, compact && { marginTop: 8, paddingVertical: 6 }]} accessibilityLabel={tr('Temps forts')}>
            <Text style={styles.title}>{tr('✨ TEMPS FORTS')}</Text>
            {list.map((h, i) => {
                const [icon, label] = h.kind === 'pile' ? ['🃏', PILE[gameType] || 'Plus grosse pioche'] : LABELS[h.kind];
                const p = players?.[h.player];
                const isMe = h.player === me;
                const count = h.kind === 'pile' ? tr('{n} cartes', { n: h.n }) : h.n > 1 ? `×${h.n}` : '';
                return (
                    <Animated.View key={`${h.kind}-${h.player}`} entering={ZoomIn.delay(delay + 120 + i * 140).springify().damping(13)} style={[styles.row, isMe && styles.rowMe]}>
                        <Text style={styles.icon}>{icon}</Text>
                        <Text style={styles.label} numberOfLines={1}>{tr(label)}</Text>
                        {count ? <Text style={styles.count}>{count}</Text> : null}
                        <PlayerAvatar name={p?.name} variant={p?.avatar || 0} size={22} />
                        <Text style={[styles.who, isMe && { color: theme.goldLight }]} numberOfLines={1}>{nameOf(h)}</Text>
                    </Animated.View>
                );
            })}
        </Animated.View>
    );
}

/** Rejouer (ou Continuer en Ronda) en grand, puis Quitter et Changer de jeu. */
export function EndActions({ canReplay, replayTitle, replayIcon = '🔄', onReplay, onQuit, onChangeGame, compact }) {
    return (
        <View style={[styles.actions, compact && { marginTop: 8 }]}>
            {canReplay ? (
                <GameButton small={compact} title={replayTitle || tr('Rejouer')} icon={replayIcon} variant="gold" onPress={onReplay} style={styles.replay} />
            ) : (
                <View style={styles.waiting}>
                    <Text style={styles.waitingText}>{tr("En attente de l'hôte…")}</Text>
                </View>
            )}
            <View style={styles.secondary}>
                <GameButton small title={tr('Quitter')} icon="🚪" variant="red" onPress={onQuit} style={onChangeGame ? { flex: 1 } : { minWidth: 150 }} />
                {onChangeGame && <GameButton small title={tr('Changer de jeu')} icon="🎲" variant="outline" onPress={onChangeGame} style={{ flex: 1.4 }} />}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    box: { width: '100%', marginTop: 12, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(232,184,74,0.35)', paddingHorizontal: 10, paddingVertical: 8, gap: 4 },
    title: { color: theme.gold, fontWeight: '900', fontSize: 11, letterSpacing: 1.2, marginBottom: 2 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3, paddingHorizontal: 4, borderRadius: 8 },
    rowMe: { backgroundColor: 'rgba(232,184,74,0.14)' },
    icon: { fontSize: 16, width: 22, textAlign: 'center' },
    label: { flex: 1, color: theme.cream, fontWeight: '800', fontSize: 13 },
    count: { color: theme.goldLight, fontWeight: '900', fontSize: 13, marginRight: 4 },
    who: { maxWidth: 110, color: theme.cream, fontWeight: '700', fontSize: 12 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginBottom: 10, width: '100%' },
    chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1, borderColor: 'rgba(232,184,74,0.45)' },
    chipMe: { backgroundColor: 'rgba(232,184,74,0.2)', borderColor: theme.gold },
    chipText: { color: theme.cream, fontWeight: '800', fontSize: 12 },
    chipWho: { color: theme.goldLight, fontWeight: '700' },
    actions: { width: '100%', marginTop: 16, gap: 8 },
    replay: { alignSelf: 'stretch' },
    secondary: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
    waiting: { alignItems: 'center', paddingVertical: 10 },
    waitingText: { color: theme.textDim, fontStyle: 'italic' },
});
