import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import socketService from '../network/socketService';
import accountService from '../network/accountService';
import audioService from '../network/audioService';
import { haptic, theme } from './ui';
import { rankFor } from '../../server/progress/defs';
import GameRecap from './GameRecap';

/**
 * Notifications de progression envoyées par le serveur en fin de partie :
 * défi relevé (+ récompense), nouveau titre, nouveau rang. Affichées l'une après l'autre.
 */
export default function ProgressToaster() {
    const [item, setItem] = useState(null);
    const [recap, setRecap] = useState(null); // bilan de fin de partie (partie entière finie)
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

    // Parties à mise et tournois à entrée en binga
    useEffect(() => {
        const show = (it) => { queue.current.push(it); pump(); };
        const offs = [
            socketService.onStakeUpdate((d) => {
                if (d.profile) accountService.applyProgress({ profile: d.profile });
                show(d.paid
                    ? { icon: '💰', title: `Mise de ${d.amount} binga`, text: 'Retirée de ton solde. Le gagnant prend le pot !', color: theme.goldLight, sound: 'coin' }
                    : { icon: '🆓', title: 'Partie gratuite pour toi', text: d.reason || 'Tu joues sans miser.', color: theme.mint, sound: 'pop' });
            }),
            socketService.onStakeResult((d) => {
                if (d.profile) accountService.applyProgress({ profile: d.profile });
                if (d.gain === undefined) return; // spectateur
                const text = d.refunded ? `Le gagnant n'avait pas misé : ta mise de ${d.amount} binga t'est rendue.`
                    : d.gain > 0 ? `+${d.gain} binga : tu prends le pot !` : `Pot gagné par ${d.winners.join(' et ')}. Tu gardes tes autres binga.`;
                setTimeout(() => show({ icon: d.gain > 0 ? '🏆' : '💸', title: d.gain > 0 && !d.refunded ? 'Pot gagné !' : 'Partie à mise', text, color: theme.goldLight, sound: d.gain > 0 ? 'victory' : 'pop' }), 1200); // avant les autres notifications de fin de partie
            }),
            socketService.onTournamentEntry((d) => {
                if (d.profile) accountService.applyProgress({ profile: d.profile });
                show(d.paid
                    ? { icon: '🏆', title: `Entrée du tournoi : ${d.amount} binga`, text: 'Gagne-le pour le dos exclusif Sultan !', color: theme.goldLight, sound: 'coin' }
                    : { icon: '🆓', title: 'Tournoi gratuit pour toi', text: d.reason || "Tu joues sans payer l'entrée.", color: theme.mint, sound: 'pop' });
            }),
        ];
        return () => offs.forEach((off) => off && off());
    }, []);

    // Connexion du jour : montrée par la fenêtre du calendrier sur l'accueil (DailyPopups)

    useEffect(() => socketService.onProgress((p) => {
        accountService.applyProgress(p);
        // Partie entière finie (binga de partie ou plafond) : écran de bilan, après l'écran de fin de partie
        const done = p.binga && (p.binga.game > 0 || p.binga.capped);
        if (done && p.profile) {
            const data = { won: !!p.binga.won, xpGained: p.xpGained || 0, xpAfter: p.profile.xp, binga: p.binga, completed: p.completed, titles: p.titles, reward: p.reward };
            setTimeout(() => setRecap(data), 2600);
            return;
        }
        const items = [];
        // Binga de la partie : toujours affichés, même en cas de défaite
        const b = p.binga;
        if (b && (b.game > 0 || b.capped)) {
            let text;
            if (b.game === 0) text = 'Plafond du jour atteint (500 binga en jouant). Les missions rapportent toujours, reviens demain !';
            else if (!b.won) text = `+${b.game} binga, même en perdant`;
            else text = `+${b.game} binga${b.vsBots ? " · victoire contre l'ordinateur" : ' · victoire'}`;
            if (b.game > 0 && b.capped) text += ' (plafond du jour atteint)';
            items.push({ icon: '💰', title: b.won ? 'Binga gagnés' : 'Partie finie', text, color: theme.goldLight, sound: 'coin' });
        }
        (b?.missions || []).forEach((m) => items.push({ icon: '💰', title: 'Mission du jour réussie', text: `${m.label} · +${m.binga} binga`, color: theme.mint }));
        (p.completed || []).forEach((c) => {
            items.push({ icon: '🎯', title: 'Défi relevé !', text: `${c.label} · +${c.xp} XP`, color: theme.mint });
            if (c.reward) items.push({ icon: '🎁', title: c.reward.kind === 'back' ? 'Nouveau dos de cartes' : 'Nouveau tapis', text: `${c.reward.label} · à choisir dans Profil → Style`, color: theme.goldLight, sound: 'victory' });
        });
        // Tournoi gagné : dos « Champion »
        if (p.reward) items.unshift({ icon: '👑', title: 'Champion du tournoi !', text: `Dos « ${p.reward.label} » · à choisir dans Profil → Style`, color: theme.goldLight, sound: 'victory', haptic: 'double' });
        (p.titles || []).forEach((t) => items.push({ icon: '🏷️', title: 'Nouveau titre !', text: `« ${t.label} » · à afficher depuis ton Profil`, color: '#C4B5FD', sound: 'announce' }));
        if (p.profile && p.xpGained) {
            const before = rankFor(p.profile.xp - p.xpGained);
            const after = rankFor(p.profile.xp);
            if (after.index > before.index) items.push({ icon: after.emoji, title: 'Nouveau rang !', text: `${after.name}${b?.rank ? ` · +${b.rank} binga` : ''}`, color: theme.gold, sound: 'victory', haptic: 'double' });
        }
        if (!items.length) return;
        // On laisse d'abord l'écran de fin de partie s'afficher
        setTimeout(() => { queue.current.push(...items); pump(); }, 3500);
    }), []);

    const recapView = recap ? <GameRecap recap={recap} onClose={() => setRecap(null)} /> : null;
    if (!item) return recapView;
    return (
        <>
        {recapView}
        <View pointerEvents="none" style={styles.wrap}>
            <Animated.View key={item.title + item.text} entering={FadeInDown.springify().damping(14)} exiting={FadeOutUp.duration(200)} style={[styles.toast, { borderColor: item.color }]}>
                <Text style={styles.icon}>{item.icon}</Text>
                <View style={{ flexShrink: 1 }}>
                    <Text style={[styles.title, { color: item.color }]}>{item.title}</Text>
                    <Text style={styles.text}>{item.text}</Text>
                </View>
            </Animated.View>
        </View>
        </>
    );
}

const styles = StyleSheet.create({
    wrap: { position: 'absolute', top: 14, left: 0, right: 0, alignItems: 'center', zIndex: 9000, elevation: 9000 },
    toast: { flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: '92%', backgroundColor: 'rgba(8,15,34,0.96)', borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 10, elevation: 12 },
    icon: { fontSize: 26 },
    title: { fontWeight: '900', fontSize: 14 },
    text: { color: theme.cream, fontWeight: '700', fontSize: 12 },
});
