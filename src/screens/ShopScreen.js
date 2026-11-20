/**
 * Ma Collection (Boutique) : cosmétiques achetés avec des binga gagnés en jouant, ou avec des diamants (achetés en euros).
 * Chaque onglet montre où en est la collection (objets possédés / total).
 * Visuels seulement : aucun avantage en partie. Les légendaires ne s'achètent pas (coffre Or).
 */
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Platform, Linking, ActivityIndicator } from 'react-native';
import PlayerAvatar from '../components/PlayerAvatar';
import AppNav from '../components/AppNav';
import { LUXE, Gradient, LuxePanel, XpBar, LuxeBackdrop, ScreenHeader, BingaPill, SectionHead } from '../components/Luxe';
import { BingaIcon, DECOR } from '../components/Decor';
import Animated, { FadeIn } from 'react-native-reanimated';
import { CardBack } from '../components/Card';
import { WinEffect } from '../components/WinEffects';
import ReactionGlyph from '../components/ReactionGlyph';
import ChestOpening, { ChestArt } from '../components/ChestOpening';
import { GameButton, PressableScale, theme, haptic } from '../components/ui';
import { dialog } from '../components/Dialog';
import accountService, { useAccount } from '../network/accountService';
import audioService from '../network/audioService';
import { BACKS, EFFECTS, FELTS, TABLE_SKINS, itemUnlocked, useCosmetics, setBack, setEffect, setFelt, setTable } from '../utils/cosmetics';
import { COSMETICS, RARITIES, CHESTS, priceOf, diamondPriceOf, DIAMOND_PRICE } from '../../server/progress/defs';
import { inDiscord } from '../utils/discord';
import { t } from '../i18n';


const TABS = [
    ['chest', 'Coffres'],
    ['back', 'Dos'],
    ['table', 'Tables'],
    ['effect', 'Effets'],
    ['emote', 'Réac.'],
    ['avatar', 'Portraits'],
    ['diamonds', 'Diamants'],
];
const GEM = require('../../assets/ui/diamant.webp');
export function GemIcon({ size = 18 }) {
    return <Image source={GEM} style={{ width: size, height: size * 0.85 }} resizeMode="contain" />;
}
const euros = (cents) => `${(cents / 100).toFixed(2).replace('.', ',')} €`;
// Nom complet de chaque collection
const TAB_TITLES = { back: 'Dos de cartes', table: 'Tables et tapis', effect: 'Effets de victoire', emote: 'Réactions', avatar: 'Portraits' };
const NAV_CARDS = require('../../assets/ui/nav_collection.webp');

// Petite icône de chaque onglet
function TabIcon({ k }) {
    switch (k) {
        case 'chest': return <ChestArt chest="or" size={30} />;
        case 'back': return <Image source={NAV_CARDS} style={{ width: 30, height: 26 }} resizeMode="contain" />;
        case 'table': return <Image source={Object.values(TABLE_SKINS)[0]?.src} style={{ width: 34, height: 22, borderRadius: 4 }} resizeMode="cover" />;
        case 'effect': return <Text style={{ fontSize: 22 }}>✨</Text>;
        case 'emote': return <Text style={{ fontSize: 22 }}>😂</Text>;
        case 'avatar': return <PlayerAvatar name="?" variant={29} size={28} />;
        case 'diamonds': return <GemIcon size={28} />;
        default: return null;
    }
}
const EFFECT_ICONS = { drapeau: '🎊', confettis: '🎉', etoiles: '⭐', menthe: '🌿', feu: '🔥', tonnerre: '⚡', or: '💰' };

// Visuel offert, affiché en tête de liste (pas dans le catalogue)
const FREE = {
    back: [{ id: 'back:classic', kind: 'back', label: 'Classique', rarity: 'commun', free: true }],
    effect: [{ id: 'effect:drapeau', kind: 'effect', label: 'Drapeau', rarity: 'commun', free: true }],
    table: [{ id: 'table:jeu', kind: 'table', label: 'Table du jeu', rarity: 'commun', free: true }],
};

const keyOf = (item) => item.id.split(':').pop();

function Preview({ item, onPreviewEffect }) {
    switch (item.kind) {
        case 'back':
            return <CardBack width={58} height={84} palette={BACKS[keyOf(item)]} />;
        case 'effect':
            return (
                <Pressable onPress={() => onPreviewEffect(keyOf(item))} style={styles.effectIcon} accessibilityLabel={t("Voir l'effet {p0}", { p0: item.label })}>
                    <Text style={{ fontSize: 34 }}>{EFFECT_ICONS[keyOf(item)]}</Text>
                    <Text style={styles.seeText}>{t("▶ Voir")}</Text>
                </Pressable>
            );
        case 'table': {
            const k = keyOf(item);
            return TABLE_SKINS[k]
                ? <Image source={TABLE_SKINS[k].src} style={styles.tableThumb} resizeMode="cover" />
                : <View style={[styles.tableThumb, styles.tableDefault]}><Text style={styles.tableDefaultText}>{t("Table de chaque jeu")}</Text></View>;
        }
        case 'avatar':
            return <PlayerAvatar name="?" variant={Number(keyOf(item))} size={70} />;
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

export default function ShopScreen({ navigation, route }) {
    const account = useAccount();
    const cos = useCosmetics();
    const profile = account.profile;
    const [tab, setTab] = useState(route?.params?.tab || 'chest');
    const [opening, setOpening] = useState(null);
    const [busy, setBusy] = useState(null);
    const [fx, setFx] = useState(null);
    const balance = profile?.binga?.balance ?? 0;
    const diamonds = profile?.diamonds?.balance ?? 0;
    const [packs, setPacks] = useState(null); // { enabled, packs }
    const [paying, setPaying] = useState(null);
    useEffect(() => { if (tab === 'diamonds' && !packs) accountService.diamondPacks().then(setPacks); }, [tab]);
    // Achats en euros : sur le site seulement (pas dans Discord, pas dans les applis des stores)
    const payBlocked = inDiscord
        ? t("Les diamants ne s'achètent pas dans Discord. Achète-les sur jebengere3.fun avec le même compte.")
        : Platform.OS !== 'web' ? t('Les diamants s\'achètent sur le site jebengere3.fun, avec le même compte.') : null;
    const buyPack = (pack) => {
        if (!profile) { buy({ price: 0 }); return; }
        dialog.alert(`${pack.label} · ${euros(pack.cents)}`,
            `${pack.bonus ? t('{n} diamants (dont {b} offerts)', { n: pack.diamonds + pack.bonus, b: pack.bonus }) : t('{n} diamants', { n: pack.diamonds })}${t(', pour des cosmétiques seulement : aucun avantage en partie.')}\n\n${t("En payant, tu acceptes que les diamants soient livrés tout de suite et tu renonces au droit de rétractation de 14 jours (contenu numérique). Tu as moins de 18 ans ? Demande d'abord l'accord d'un parent.")}`, [
                { text: t('Annuler'), style: 'cancel' },
                {
                    text: `Payer ${euros(pack.cents)}`,
                    onPress: async () => {
                        setPaying(pack.id);
                        const r = await accountService.checkout(pack.id);
                        setPaying(null);
                        if (r.error || !r.url) { audioService.playSound('error'); dialog.alert(t('Paiement impossible'), r.error || t('Réessaie dans un instant.')); return; }
                        if (Platform.OS === 'web') window.location.assign(r.url); else Linking.openURL(r.url);
                    },
                },
            ]);
    };

    const owned = (item) => {
        if (item.free) return true;
        if (item.kind === 'emote' || item.kind === 'table' || item.kind === 'avatar') return (cos.unlocks || []).includes(item.id);
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
        if (item.kind === 'table') return (cos.table || 'jeu') === k;
        if (item.kind === 'avatar') return accountService.myAvatar() === Number(k);
        return false;
    };
    const use = (item) => {
        const k = keyOf(item);
        if (item.kind === 'avatar') { accountService.setAvatar(Number(k)); audioService.playSound('coin'); haptic('light'); return; }
        const ok = item.kind === 'back' ? setBack(k) : item.kind === 'effect' ? setEffect(k) : item.kind === 'felt' ? setFelt(item.game, k)
            : item.kind === 'table' ? setTable(k === 'jeu' ? null : k) : false;
        audioService.playSound(ok ? 'coin' : 'error');
        haptic(ok ? 'light' : 'warning');
    };
    const previewEffect = (k) => {
        setFx({ k, id: Date.now() });
        setTimeout(() => setFx((f) => (f && f.k === k ? null : f)), 2800);
    };

    const buy = (item, currency = 'binga') => {
        const gems = currency === 'diamonds';
        const price = gems ? diamondPriceOf(item) : priceOf(item);
        const have = gems ? diamonds : balance;
        const unit = gems ? 'diamants' : 'binga';
        if (!profile) {
            dialog.alert(t('Crée ton compte'), t('Les binga sont gardés avec ton compte. Crée-le dans ton Profil pour acheter avec tes binga.'), [
                { text: t('Plus tard'), style: 'cancel' },
                { text: t('Aller au Profil'), onPress: () => navigation.navigate('Profile') },
            ]);
            return;
        }
        if (have < price) {
            audioService.playSound('error');
            if (gems) {
                dialog.alert(t('Pas assez de diamants'), t("Il te manque {p0} diamants.", { p0: price - have }), [
                    { text: t('Plus tard'), style: 'cancel' },
                    { text: t('Voir les diamants'), onPress: () => setTab('diamonds') },
                ]);
            } else {
                dialog.alert(t('Pas assez de binga'), t("Il te manque {p0} binga. Joue des parties (même perdues), fais les missions du jour et reviens !", { p0: price - have }));
            }
            return;
        }
        dialog.alert(t("Acheter « {p0} » ?", { p0: item.label }), t("{p0} {p1} seront retirés de ton solde ({p2} {p3}). Il est à toi pour toujours, même après une réinstallation.", { p0: price, p1: unit, p2: have, p3: unit }), [
            { text: t('Annuler'), style: 'cancel' },
            {
                text: t("Acheter · {p0} {p1}", { p0: price, p1: unit }),
                onPress: async () => {
                    setBusy(item.id);
                    const r = await accountService.buy(item.id, currency);
                    setBusy(null);
                    if (r.error || !r.success) {
                        audioService.playSound('error');
                        dialog.alert(t('Achat impossible'), r.error || t('Réessaie dans un instant.'));
                        return;
                    }
                    audioService.playSound('coins');
                    haptic('success');
                    if (item.kind !== 'emote') use(item);
                    dialog.alert(t('C\'est à toi ! 🎉'), item.kind === 'emote'
                        ? t("« {p0} » est dans tes réactions : en partie, touche ✨ à côté des réactions.", { p0: item.label })
                        : t("« {p0} » est maintenant utilisé. Tu peux changer quand tu veux, ici ou dans Profil → Style.", { p0: item.label }));
                },
            },
        ]);
    };

    const action = (item) => {
        if (owned(item)) {
            if (item.kind === 'emote') return <Text style={[styles.status, { color: theme.mint }]}>{t("✓ À toi · ✨ en partie")}</Text>;
            if (inUse(item)) return <Text style={[styles.status, { color: theme.mint }]}>{t("✓ Utilisé")}</Text>;
            return <GameButton small title={t("Utiliser")} variant="outline" onPress={() => use(item)} />;
        }
        if (item.source === 'tournament') return <Text style={styles.status}>{t("🏅 Gagne un tournoi")}</Text>;
        if (item.source === 'binga_tournament') return <Text style={styles.status}>{t("🏆 Gagne un tournoi à entrée en binga")}</Text>;
        const price = priceOf(item);
        if (price === null) return <Text style={[styles.status, { color: RARITIES.legendaire.color }]}>{t("🎁 Coffre Or seulement")}</Text>;
        const dprice = diamondPriceOf(item);
        return (
            <View style={{ gap: 5, alignItems: 'stretch' }}>
                <GameButton small title={busy === item.id ? '…' : `💰 ${price}`} onPress={() => buy(item)} disabled={!!busy} variant={profile && balance >= price ? 'gold' : 'outline'} />
                {dprice !== null && (
                    <PressableScale onPress={() => buy(item, 'diamonds')} disabled={!!busy} style={[styles.gemBtn, profile && diamonds >= dprice && styles.gemBtnOn]} accessibilityLabel={t("Acheter pour {p0} diamants", { p0: dprice })}>
                        <GemIcon size={14} /><Text style={styles.gemBtnText}>{dprice}</Text>
                    </PressableScale>
                )}
            </View>
        );
    };

    const openChest = (id) => {
        const chest = CHESTS[id];
        if (!profile) { buy({ price: 0 }); return; }
        if (balance < chest.price) {
            audioService.playSound('error');
            dialog.alert(t('Pas assez de binga'), t("Il te manque {p0} binga. Joue des parties (même perdues), fais les missions du jour et reviens !", { p0: chest.price - balance }));
            return;
        }
        setOpening(id);
    };
    const pityText = (id) => {
        const left = profile?.chests?.pityLeft?.[id];
        const p = CHESTS[id].pity;
        if (!p || !left) return null;
        const what = RARITIES[p.rarity].label;
        return left === 1 ? t("Le prochain donne un {p0} garanti", { p0: what }) : t("Plus que {p0} coffres avant un {p1} garanti", { p0: left, p1: what });
    };

    // Onglet Tables : les tables, puis les couleurs de tapis des défis du jour
    const list = tab === 'chest' || tab === 'diamonds' ? [] : [...(FREE[tab] || []), ...COSMETICS.filter((c) => c.kind === tab || (tab === 'table' && c.kind === 'felt'))];

    return (
        <View style={styles.container}>
            <LuxeBackdrop />
            <ScreenHeader
                title={t("Ma Collection")}
                onBack={() => navigation.goBack()}
                right={<BingaPill icon={<BingaIcon size={20} />} amount={profile ? balance.toLocaleString('fr-FR') : '—'} />}
            />
            <View style={styles.wallet}>
                <PressableScale onPress={() => setTab('diamonds')} style={styles.walletGem} accessibilityLabel={t("Diamants : {p0}", { p0: diamonds })}>
                    <GemIcon size={20} />
                    <Text style={styles.walletText}>{profile ? diamonds.toLocaleString('fr-FR') : '—'}</Text>
                    <View style={styles.walletPlus}><Text style={styles.walletPlusText}>+</Text></View>
                </PressableScale>
            </View>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.info}>
                    Les objets s'achètent avec des binga gagnés en jouant, ou avec des diamants. Ce sont des visuels : aucun avantage en partie. Un objet acheté est à toi pour toujours.
                </Text>
                {!profile && (
                    <Pressable onPress={() => navigation.navigate('Profile')} style={styles.guest}>
                        <Text style={styles.guestText}>{t("🔐 Crée ton compte pour gagner des binga et acheter ici. Toucher pour aller au Profil.")}</Text>
                    </Pressable>
                )}
                <View style={styles.rarities}>
                    {Object.entries(RARITIES).map(([k, r]) => (
                        <Text key={k} style={[styles.rarityPill, { borderColor: r.color, color: r.color }]}>{r.label} · {r.price ? t("{p0} binga ou {p1} 💎", { p0: r.price, p1: DIAMOND_PRICE[k] }) : t('coffre Or')}</Text>
                    ))}
                </View>

                <View style={styles.tabs}>
                    {TABS.map(([k, label]) => {
                        const on = tab === k;
                        return (
                            <PressableScale key={k} onPress={() => setTab(k)} style={[styles.tab, on && styles.tabOn]} accessibilityLabel={label} accessibilityState={{ selected: on }} scaleTo={0.93}>
                                <Gradient colors={on ? ['#C42634', '#5E0B15'] : ['#1D2C55', '#0C1632']} />
                                <View style={styles.tabIcon}><TabIcon k={k} /></View>
                                <Text style={[styles.tabText, on && styles.tabTextOn]} numberOfLines={1}>{label}</Text>
                            </PressableScale>
                        );
                    })}
                </View>

                {/* Où en est la collection de cet onglet */}
                {tab !== 'chest' && tab !== 'diamonds' && (() => {
                    const have = list.filter(owned).length;
                    const complete = have === list.length;
                    return (
                        <LuxePanel style={styles.progressBox} inner={false}>
                            <SectionHead title={`${t(TAB_TITLES[tab])} (${list.length})`} right={<Text style={[styles.progressCount, complete && { color: '#7CF29A' }]}>{complete ? '✓ ' : ''}{have} / {list.length}</Text>} />
                            <View style={{ padding: 10 }}>
                                <XpBar progress={list.length ? have / list.length : 0} height={10} />
                                {complete && <Text style={styles.complete}>{t("👑 Collection complète !")}</Text>}
                            </View>
                        </LuxePanel>
                    );
                })()}

                {tab === 'table' && <Text style={styles.soon}>{t("Une table de la boutique remplace la table de chaque jeu, pour les 4 jeux. Les couleurs de tapis (Tadelakt, Safran…) teintent le tapis d'une table de jeu.")}</Text>}
                {tab === 'avatar' && <Text style={styles.soon}>{t("24 portraits en plus des 12 offerts, dont 8 premium (Épique et Légendaire). Les autres joueurs voient ton portrait dans les salons et en partie.")}</Text>}
                {tab === 'emote' && <Text style={styles.soon}>{t("Les réactions 😂 😡 😱 👏 restent offertes. Celles d'ici s'ajoutent avec ✨ en partie.")}</Text>}

                {tab === 'diamonds' && (
                    <>
                        <Text style={styles.soon}>{t("Les diamants s'achètent en euros et servent seulement à acheter des cosmétiques (communs, rares, épiques), sans hasard. Ils ne donnent aucun avantage en partie et ne s'échangent pas contre des binga. Les coffres s'ouvrent toujours en binga, et les légendaires restent dans le coffre Or.")}</Text>
                        {payBlocked && <Text style={[styles.soon, { color: LUXE.goldLight }]}>{payBlocked}</Text>}
                        {!packs ? <ActivityIndicator color={LUXE.gold} style={{ margin: 20 }} /> : packs.packs.map((p, i) => (
                            <LuxePanel key={p.id} style={styles.pack} colors={i === packs.packs.length - 1 ? ['#6A1222', '#2A0710'] : undefined}>
                                <View style={styles.packGems}>
                                    {Array.from({ length: Math.min(5, i + 1) }).map((_, k) => <View key={k} style={{ marginLeft: k ? -10 : 0 }}><GemIcon size={26} /></View>)}
                                </View>
                                <View style={{ flex: 1, marginHorizontal: 10 }}>
                                    <Text style={styles.packName}>{p.label}</Text>
                                    <Text style={styles.packAmount}>{(p.diamonds + p.bonus).toLocaleString('fr-FR')} diamants{p.bonus ? <Text style={styles.packBonus}>  {t("dont")} {p.bonus} {t("offerts")}</Text> : null}</Text>
                                </View>
                                <GameButton small title={paying === p.id ? '…' : euros(p.cents)} onPress={() => buyPack(p)} disabled={!packs.enabled || !!payBlocked || !!paying} />
                            </LuxePanel>
                        ))}
                        {packs && !packs.enabled && !payBlocked && <Text style={styles.soon}>{t("Le paiement sera bientôt activé.")}</Text>}
                        <Text style={styles.soon}>{t("Paiement sécurisé par Stripe (carte, Apple Pay, Google Pay). L'Carta ne voit jamais ta carte. Prix TTC.")}</Text>
                    </>
                )}

                {tab === 'chest' && (
                    <>
                        <View style={styles.chestBanner}>
                            <Image source={DECOR.coffres} style={StyleSheet.absoluteFill} resizeMode="cover" />
                            <Gradient colors={['rgba(6,12,24,0)', 'rgba(6,12,24,0.85)']} />
                            <View style={styles.chestBannerShade}>
                                <Text style={styles.chestBannerTitle}>{t("Coffres et roue du jour")}</Text>
                                <GameButton small title={t("🎡 Roue du jour (gratuite)")} onPress={() => navigation.navigate('Wheel')} />
                            </View>
                        </View>
                        <Text style={styles.soon}>{t("Chaque coffre contient 1 cosmétique, tiré au sort par le serveur avec les chances affichées. Si tu l'as déjà, tu récupères 20 % de sa valeur en binga. Les coffres s'ouvrent seulement avec des binga gagnés en jouant : aucun argent réel.")}</Text>
                        {Object.entries(CHESTS).map(([id, c]) => (
                            <LuxePanel key={id} style={[styles.chestCard, { borderColor: c.color }]}>
                                <View style={styles.chestLeft}>
                                    <ChestArt chest={id} size={92} />
                                    <Text style={[styles.chestName, { color: c.color }]}>{c.label}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.oddsTitle}>{t("Chances")}</Text>
                                    {Object.entries(c.odds).map(([r, pct]) => (
                                        <View key={r} style={styles.oddsRow}>
                                            <Text style={[styles.oddsLabel, { color: RARITIES[r].color }]}>{RARITIES[r].label}</Text>
                                            <View style={styles.oddsTrack}><View style={[styles.oddsFill, { width: `${pct}%`, backgroundColor: RARITIES[r].color }]} /></View>
                                            <Text style={styles.oddsPct}>{pct} %</Text>
                                        </View>
                                    ))}
                                    {pityText(id) && <Text style={styles.pity}>⭐ {pityText(id)}</Text>}
                                    <GameButton small title={t("Ouvrir · 💰 {p0}", { p0: c.price })} onPress={() => openChest(id)} variant={profile && balance >= c.price ? 'gold' : 'outline'} style={{ marginTop: 8, alignSelf: 'flex-start' }} />
                                </View>
                            </LuxePanel>
                        ))}
                    </>
                )}

                <View style={styles.grid}>
                    {list.map((item) => {
                        const r = RARITIES[item.rarity];
                        return (
                            <Animated.View key={item.id} entering={FadeIn.duration(200)} style={[styles.item, { borderColor: owned(item) ? '#5FE08A' : `${r.color}AA` }]}>
                                <Gradient colors={['#1A2A52', '#0A1430']} />
                                <View style={[styles.rarityBar, { backgroundColor: r.color }]} />
                                {owned(item) && <View style={styles.ownedDot}><Text style={styles.ownedDotText}>✓</Text></View>}
                                <View style={styles.previewBox}><Preview item={item} onPreviewEffect={previewEffect} /></View>
                                <Text style={styles.itemLabel} numberOfLines={1}>{t(item.label)}</Text>
                                <Text style={[styles.rarity, { color: r.color }]}>{item.free ? t('Offert') : r.label}</Text>
                                <View style={styles.actionBox}>{action(item)}</View>
                            </Animated.View>
                        );
                    })}
                </View>
            </ScrollView>
            <AppNav navigation={navigation} current="collection" />
            {fx && <WinEffect key={fx.id} effect={fx.k} />}
            {opening && (
                <ChestOpening
                    chest={opening}
                    request={() => accountService.openChest(opening)}
                    onClose={() => setOpening(null)}
                    onUse={(item) => use(item)}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    wallet: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 14, marginTop: -2 },
    walletGem: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingLeft: 8, paddingRight: 3, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: '#F17A86', backgroundColor: 'rgba(0,0,0,0.4)' },
    walletText: { color: LUXE.cream, fontWeight: '900', fontSize: 14 },
    walletPlus: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#D3263A', alignItems: 'center', justifyContent: 'center' },
    walletPlusText: { color: '#fff', fontWeight: '900', fontSize: 16, lineHeight: 18 },
    gemBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 5, borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(241,122,134,0.5)', backgroundColor: 'rgba(0,0,0,0.35)' },
    gemBtnOn: { borderColor: '#F17A86', backgroundColor: 'rgba(211,38,58,0.3)' },
    gemBtnText: { color: LUXE.cream, fontWeight: '900', fontSize: 13 },
    pack: { flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 10 },
    packGems: { flexDirection: 'row', width: 70, justifyContent: 'center' },
    packName: { color: LUXE.goldLight, fontWeight: '900', fontSize: 15 },
    packAmount: { color: LUXE.cream, fontWeight: '800', fontSize: 13, marginTop: 2 },
    packBonus: { color: '#7CF29A', fontWeight: '900', fontSize: 11 },
    tabIcon: { height: 30, justifyContent: 'center', alignItems: 'center' },
    progressBox: { marginBottom: 12 },
    progressCount: { color: LUXE.cream, fontWeight: '900', fontSize: 13 },
    complete: { color: LUXE.goldLight, fontWeight: '900', fontSize: 14, textAlign: 'center', marginTop: 8 },
    rarityBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
    ownedDot: { position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: 9, backgroundColor: '#22A447', borderWidth: 1.5, borderColor: '#BDF7CB', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
    ownedDotText: { color: '#fff', fontSize: 10, fontWeight: '900' },
    container: { flex: 1, backgroundColor: LUXE.night },
    scroll: { padding: 14, paddingBottom: 40, maxWidth: 560, width: '100%', alignSelf: 'center' },
    info: { color: LUXE.dim, fontSize: 12, fontWeight: '700', textAlign: 'center', paddingHorizontal: 6 },
    guest: { marginTop: 10, padding: 10, borderRadius: 14, borderWidth: 1.5, borderColor: LUXE.gold, backgroundColor: 'rgba(232,184,74,0.14)' },
    guestText: { color: theme.goldLight, fontWeight: '800', fontSize: 12, textAlign: 'center' },
    rarities: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 10 },
    rarityPill: { fontSize: 11, fontWeight: '900', borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: 'rgba(6,12,24,0.7)', overflow: 'hidden' },
    tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14, marginBottom: 12 },
    tab: { width: '31.8%', flexGrow: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(232,184,74,0.55)', overflow: 'hidden' },
    tabOn: { borderColor: '#FFE08A' },
    tabText: { color: LUXE.cream, fontWeight: '900', fontSize: 12, marginTop: 3 },
    tabTextOn: { color: '#FFF3D6' },
    soon: { color: LUXE.dim, fontSize: 12, fontWeight: '700', textAlign: 'center', marginBottom: 10, paddingHorizontal: 6 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    item: { width: '31.5%', alignItems: 'center', paddingTop: 12, paddingBottom: 10, paddingHorizontal: 4, marginBottom: 10, borderRadius: 16, borderWidth: 1.5, overflow: 'hidden' },
    previewBox: { height: 88, justifyContent: 'center', alignItems: 'center' },
    itemLabel: { color: LUXE.cream, fontWeight: '900', fontSize: 12, marginTop: 6, textAlign: 'center' },
    rarity: { fontSize: 10, fontWeight: '900', marginTop: 2 },
    actionBox: { marginTop: 8, minHeight: 34, justifyContent: 'center', alignItems: 'center' },
    status: { color: LUXE.dim, fontSize: 10, fontWeight: '800', textAlign: 'center' },
    effectIcon: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)' },
    seeText: { color: theme.goldLight, fontSize: 10, fontWeight: '900' },
    emoteBox: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
    chestBanner: { height: 130, marginBottom: 12, borderRadius: 18, overflow: 'hidden', borderWidth: 1.5, borderColor: LUXE.gold },
    chestBannerShade: { flex: 1, justifyContent: 'flex-end', alignItems: 'flex-start', padding: 10, gap: 6 },
    chestBannerTitle: { color: '#FFF7D6', fontWeight: '900', fontSize: 16, textShadowColor: '#000', textShadowRadius: 6 },
    chestCard: { flexDirection: 'row', gap: 12, padding: 12, marginBottom: 12 },
    chestLeft: { alignItems: 'center', width: 104 },
    chestName: { fontWeight: '900', fontSize: 13, marginTop: 4, textAlign: 'center' },
    oddsTitle: { color: LUXE.cream, fontWeight: '900', fontSize: 12, marginBottom: 4 },
    oddsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
    oddsLabel: { width: 70, fontSize: 11, fontWeight: '900' },
    oddsTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
    oddsFill: { height: '100%' },
    oddsPct: { width: 34, textAlign: 'right', color: theme.cream, fontSize: 11, fontWeight: '800' },
    pity: { color: theme.goldLight, fontSize: 11, fontWeight: '800', marginTop: 4 },
    tableThumb: { width: 104, height: 36, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(212,175,55,0.5)' },
    tableDefault: { backgroundColor: '#0E5A2E', alignItems: 'center', justifyContent: 'center' },
    tableDefaultText: { color: theme.cream, fontSize: 9, fontWeight: '800' },
    swatch: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: '#C9A23A', overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
    swatchPattern: { width: 30, height: 30, borderWidth: 1.5, borderColor: 'rgba(245,215,122,0.55)', transform: [{ rotate: '45deg' }] },
});
