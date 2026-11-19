/**
 * Boutique : cosmétiques achetés avec des binga gagnés en jouant (jamais avec de l'argent).
 * Visuels seulement : aucun avantage en partie. Les légendaires ne s'achètent pas (coffre Or).
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, ImageBackground, ScrollView, Pressable } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { CardBack } from '../components/Card';
import { WinEffect } from '../components/WinEffects';
import ReactionGlyph from '../components/ReactionGlyph';
import { GameButton, PressableScale, theme, haptic } from '../components/ui';
import { dialog } from '../components/Dialog';
import accountService, { useAccount } from '../network/accountService';
import audioService from '../network/audioService';
import { BACKS, EFFECTS, FELTS, itemUnlocked, useCosmetics, setBack, setEffect, setFelt } from '../utils/cosmetics';
import { COSMETICS, RARITIES, priceOf } from '../../server/progress/defs';

const BG = require('../../assets/Yellow and White Illustrative Ramadan Greeting Instagram Post.png');

const TABS = [
    ['back', 'Dos'],
    ['effect', 'Effets'],
    ['emote', 'Réactions'],
    ['felt', 'Tapis'],
    ['avatar', 'Portraits'],
];
const EFFECT_ICONS = { drapeau: '🎊', confettis: '🎉', etoiles: '⭐', menthe: '🌿', feu: '🔥', tonnerre: '⚡', or: '💰' };

// Visuel offert, affiché en tête de liste (pas dans le catalogue)
const FREE = {
    back: [{ id: 'back:classic', kind: 'back', label: 'Classique', rarity: 'commun', free: true }],
    effect: [{ id: 'effect:drapeau', kind: 'effect', label: 'Drapeau', rarity: 'commun', free: true }],
};

const keyOf = (item) => item.id.split(':').pop();

function Preview({ item, onPreviewEffect }) {
    switch (item.kind) {
        case 'back':
            return <CardBack width={58} height={84} palette={BACKS[keyOf(item)]} />;
        case 'effect':
            return (
                <Pressable onPress={() => onPreviewEffect(keyOf(item))} style={styles.effectIcon} accessibilityLabel={`Voir l'effet ${item.label}`}>
                    <Text style={{ fontSize: 34 }}>{EFFECT_ICONS[keyOf(item)]}</Text>
                    <Text style={styles.seeText}>▶ Voir</Text>
                </Pressable>
            );
        case 'emote':
            return <View style={styles.emoteBox}><ReactionGlyph type={item.id} size={34} textColor={theme.cream} /></View>;
        case 'felt': {
            const f = (FELTS[item.game] || []).find((x) => x.id === keyOf(item));
            return <View style={[styles.swatch, { backgroundColor: f?.color || '#333' }]}><View style={styles.swatchPattern} /></View>;
        }
        default:
            return null;
    }
}

export default function ShopScreen({ navigation }) {
    const account = useAccount();
    const cos = useCosmetics();
    const profile = account.profile;
    const [tab, setTab] = useState('back');
    const [busy, setBusy] = useState(null);
    const [fx, setFx] = useState(null);
    const balance = profile?.binga?.balance ?? 0;

    const owned = (item) => {
        if (item.free) return true;
        if (item.kind === 'emote') return (cos.unlocks || []).includes(item.id);
        if (item.kind === 'back') return itemUnlocked(BACKS[keyOf(item)], item.id, cos);
        if (item.kind === 'effect') return itemUnlocked(EFFECTS[keyOf(item)], item.id, cos);
        if (item.kind === 'felt') {
            const f = (FELTS[item.game] || []).find((x) => x.id === keyOf(item));
            return !!f && itemUnlocked(f, item.id, cos);
        }
        return false;
    };
    const inUse = (item) => {
        const k = keyOf(item);
        if (item.kind === 'back') return cos.back === k;
        if (item.kind === 'effect') return (cos.effect || 'drapeau') === k;
        if (item.kind === 'felt') return cos.felts?.[item.game] === k;
        return false;
    };
    const use = (item) => {
        const k = keyOf(item);
        const ok = item.kind === 'back' ? setBack(k) : item.kind === 'effect' ? setEffect(k) : item.kind === 'felt' ? setFelt(item.game, k) : false;
        audioService.playSound(ok ? 'coin' : 'error');
        haptic(ok ? 'light' : 'warning');
    };
    const previewEffect = (k) => {
        setFx({ k, id: Date.now() });
        setTimeout(() => setFx((f) => (f && f.k === k ? null : f)), 2800);
    };

    const buy = (item) => {
        const price = priceOf(item);
        if (!profile) {
            dialog.alert('Crée ton compte', 'Les binga sont gardés avec ton compte. Crée-le dans ton Profil pour acheter avec tes binga.', [
                { text: 'Plus tard', style: 'cancel' },
                { text: 'Aller au Profil', onPress: () => navigation.navigate('Profile') },
            ]);
            return;
        }
        if (balance < price) {
            audioService.playSound('error');
            dialog.alert('Pas assez de binga', `Il te manque ${price - balance} binga. Joue des parties (même perdues), fais les missions du jour et reviens !`);
            return;
        }
        dialog.alert(`Acheter « ${item.label} » ?`, `${price} binga seront retirés de ton solde (${balance} binga). Il est à toi pour toujours, même après une réinstallation.`, [
            { text: 'Annuler', style: 'cancel' },
            {
                text: `Acheter · ${price} binga`,
                onPress: async () => {
                    setBusy(item.id);
                    const r = await accountService.buy(item.id);
                    setBusy(null);
                    if (r.error || !r.success) {
                        audioService.playSound('error');
                        dialog.alert('Achat impossible', r.error || 'Réessaie dans un instant.');
                        return;
                    }
                    audioService.playSound('victory');
                    haptic('success');
                    if (item.kind !== 'emote') use(item);
                    dialog.alert('C\'est à toi ! 🎉', item.kind === 'emote'
                        ? `« ${item.label} » est dans tes réactions : en partie, touche ✨ à côté des réactions.`
                        : `« ${item.label} » est maintenant utilisé. Tu peux changer quand tu veux, ici ou dans Profil → Style.`);
                },
            },
        ]);
    };

    const action = (item) => {
        if (owned(item)) {
            if (item.kind === 'emote') return <Text style={[styles.status, { color: theme.mint }]}>✓ À toi · ✨ en partie</Text>;
            if (inUse(item)) return <Text style={[styles.status, { color: theme.mint }]}>✓ Utilisé</Text>;
            return <GameButton small title="Utiliser" variant="outline" onPress={() => use(item)} />;
        }
        if (item.source === 'tournament') return <Text style={styles.status}>🏅 Gagne un tournoi</Text>;
        const price = priceOf(item);
        if (price === null) return <Text style={[styles.status, { color: RARITIES.legendaire.color }]}>🎁 Coffre Or seulement</Text>;
        return <GameButton small title={busy === item.id ? '…' : `💰 ${price}`} onPress={() => buy(item)} disabled={!!busy} variant={profile && balance >= price ? 'gold' : 'outline'} />;
    };

    const list = tab === 'avatar' ? [] : [...(FREE[tab] || []), ...COSMETICS.filter((c) => c.kind === tab)];

    return (
        <ImageBackground source={BG} style={styles.container} resizeMode="cover">
            <View style={styles.header}>
                <PressableScale style={styles.headBtn} onPress={() => navigation.goBack()}>
                    <Text style={styles.headBtnText}>⬅️ Retour</Text>
                </PressableScale>
                <Text style={styles.title}>🛍️ Boutique</Text>
                <View style={styles.balance}>
                    <Text style={styles.balanceText}>💰 {profile ? balance.toLocaleString('fr-FR') : '—'}</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.info}>
                    Tout s'achète avec des binga gagnés en jouant, jamais avec de l'argent. Ce sont des visuels : aucun avantage en partie. Un objet acheté est à toi pour toujours.
                </Text>
                {!profile && (
                    <Pressable onPress={() => navigation.navigate('Profile')} style={styles.guest}>
                        <Text style={styles.guestText}>🔐 Crée ton compte pour gagner des binga et acheter ici. Toucher pour aller au Profil.</Text>
                    </Pressable>
                )}
                <View style={styles.rarities}>
                    {Object.entries(RARITIES).map(([k, r]) => (
                        <Text key={k} style={[styles.rarityPill, { borderColor: r.color, color: r.color }]}>{r.label} · {r.price ? `${r.price} binga` : 'coffre Or'}</Text>
                    ))}
                </View>

                <View style={styles.tabs}>
                    {TABS.map(([k, label]) => (
                        <Pressable key={k} onPress={() => setTab(k)} style={[styles.tab, tab === k && styles.tabOn]}>
                            <Text style={[styles.tabText, tab === k && styles.tabTextOn]}>{label}</Text>
                        </Pressable>
                    ))}
                </View>

                {tab === 'felt' && <Text style={styles.soon}>Les tapis des défis du jour sont ici. De nouveaux tapis arrivent bientôt.</Text>}
                {tab === 'avatar' && <Text style={styles.soon}>6 nouveaux portraits arrivent bientôt, dans le même style que les 12 actuels (toujours offerts).</Text>}
                {tab === 'emote' && <Text style={styles.soon}>Les réactions 😂 😡 😱 👏 restent offertes. Celles d'ici s'ajoutent avec ✨ en partie.</Text>}

                <View style={styles.grid}>
                    {list.map((item) => {
                        const r = RARITIES[item.rarity];
                        return (
                            <Animated.View key={item.id} entering={FadeIn.duration(200)} style={[styles.item, { borderColor: owned(item) ? theme.mint : `${r.color}88` }]}>
                                <View style={styles.previewBox}><Preview item={item} onPreviewEffect={previewEffect} /></View>
                                <Text style={styles.itemLabel} numberOfLines={1}>{item.label}</Text>
                                <Text style={[styles.rarity, { color: r.color }]}>{item.free ? 'Offert' : r.label}</Text>
                                <View style={styles.actionBox}>{action(item)}</View>
                            </Animated.View>
                        );
                    })}
                </View>
            </ScrollView>
            {fx && <WinEffect key={fx.id} effect={fx.k} />}
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 44, paddingHorizontal: 14, paddingBottom: 8, backgroundColor: 'rgba(18,8,11,0.85)' },
    headBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, backgroundColor: 'rgba(212,175,55,0.15)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)' },
    headBtnText: { color: theme.goldLight, fontWeight: '800', fontSize: 13 },
    title: { color: theme.goldLight, fontSize: 20, fontWeight: '900' },
    balance: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: theme.gold },
    balanceText: { color: theme.goldLight, fontWeight: '900', fontSize: 13 },
    scroll: { padding: 14, paddingBottom: 40, maxWidth: 560, width: '100%', alignSelf: 'center' },
    info: { color: theme.cream, fontSize: 12, fontWeight: '700', textAlign: 'center', backgroundColor: 'rgba(28,15,19,0.85)', borderRadius: 14, padding: 10 },
    guest: { marginTop: 10, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: theme.gold, backgroundColor: 'rgba(212,175,55,0.15)' },
    guestText: { color: theme.goldLight, fontWeight: '800', fontSize: 12, textAlign: 'center' },
    rarities: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 10 },
    rarityPill: { fontSize: 11, fontWeight: '900', borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: 'rgba(0,0,0,0.5)', overflow: 'hidden' },
    tabs: { flexDirection: 'row', marginTop: 12, marginBottom: 10, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12, padding: 3 },
    tab: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
    tabOn: { backgroundColor: theme.gold },
    tabText: { color: theme.textDim, fontWeight: '800', fontSize: 11 },
    tabTextOn: { color: theme.bg },
    soon: { color: theme.cream, fontSize: 12, textAlign: 'center', marginBottom: 10, backgroundColor: 'rgba(28,15,19,0.85)', borderRadius: 12, padding: 8 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    item: { width: '31.5%', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, marginBottom: 10, borderRadius: 14, borderWidth: 1.5, backgroundColor: 'rgba(28,15,19,0.94)' },
    previewBox: { height: 88, justifyContent: 'center', alignItems: 'center' },
    itemLabel: { color: theme.cream, fontWeight: '900', fontSize: 12, marginTop: 6, textAlign: 'center' },
    rarity: { fontSize: 10, fontWeight: '900', marginTop: 2 },
    actionBox: { marginTop: 8, minHeight: 34, justifyContent: 'center', alignItems: 'center' },
    status: { color: theme.textDim, fontSize: 10, fontWeight: '800', textAlign: 'center' },
    effectIcon: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)' },
    seeText: { color: theme.goldLight, fontSize: 10, fontWeight: '900' },
    emoteBox: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
    swatch: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: '#C9A23A', overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
    swatchPattern: { width: 30, height: 30, borderWidth: 1.5, borderColor: 'rgba(245,215,122,0.55)', transform: [{ rotate: '45deg' }] },
});
