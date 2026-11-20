/**
 * Missions : connexion du jour (7 jours), missions binga, défis du jour (XP), succès et badges (titres).
 * Tout vient du profil serveur : les binga des missions et de la connexion sont crédités
 * automatiquement par le serveur (rien à « récupérer »).
 */
import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import accountService, { useAccount } from '../network/accountService';
import audioService from '../network/audioService';
import { GameButton, PressableScale } from '../components/ui';
import { BingaIcon } from '../components/Decor';
import AppNav from '../components/AppNav';
import { LUXE, Gradient, LuxePanel, XpBar, LuxeBackdrop, ScreenHeader, BingaPill, SectionHead } from '../components/Luxe';
import { BINGA } from '../../server/progress/defs';
import { t } from '../i18n';

const IMG = {
    gift: require('../../assets/ui/nav_recompenses.webp'),
    target: require('../../assets/ui/nav_missions.webp'),
    crown: require('../../assets/ui/stat_serie.webp'),
    coins: require('../../assets/ui/daily_pieces.webp'),
    card: require('../../assets/ui/mission_carte.webp'),
    cards: require('../../assets/ui/mission_cartes.webp'),
};
const BADGES = {
    champion: require('../../assets/ui/badge_champion.webp'),
    ronda: require('../../assets/ui/badge_ronda.webp'),
    tringa: require('../../assets/ui/badge_tringa.webp'),
    serie: require('../../assets/ui/badge_serie.webp'),
    collection: require('../../assets/ui/badge_collection.webp'),
};
// Écusson de chaque titre
const TITLE_BADGE = {
    roi_ronda: 'ronda', menteur_chef: 'tringa', chasseur_sota: 'collection', jamais_khasser: 'serie',
    moul_missa: 'ronda', oeil_lynx: 'serie', champion: 'champion', sultan: 'champion',
};

// Temps restant avant les nouvelles missions (minuit au Maroc, UTC+1)
function untilTomorrow() {
    const now = Date.now() + 3600 * 1000;
    const next = Math.ceil(now / 86400000) * 86400000;
    const m = Math.round((next - now) / 60000);
    return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}

function Row({ icon, label, progress, target, done, reward }) {
    return (
        <View style={[styles.row, done && styles.rowDone]}>
            <Image source={icon} style={styles.rowIcon} resizeMode="contain" />
            <View style={{ flex: 1, marginHorizontal: 8 }}>
                <Text style={styles.rowLabel} numberOfLines={2}>{label}</Text>
                <View style={styles.rowBarLine}>
                    <View style={{ flex: 1 }}>
                        <View style={styles.track}>
                            <View style={[styles.fill, { width: `${Math.max(4, Math.min(1, progress / target) * 100)}%` }]}>
                                <Gradient colors={done ? ['#7CF29A', '#22A447'] : ['#7FC4FF', '#1E6FD9']} />
                            </View>
                        </View>
                    </View>
                    <Text style={styles.rowCount}>{Math.min(progress, target)} / {target}</Text>
                </View>
            </View>
            {done ? (
                <View style={[styles.chip, styles.chipDone]}>
                    <Gradient colors={['#3FCF6B', '#16803A']} />
                    <Text style={styles.chipDoneText}>{t("✓ Reçu")}</Text>
                </View>
            ) : (
                <View style={styles.chip}>{reward}</View>
            )}
        </View>
    );
}

export default function MissionsScreen({ navigation }) {
    const account = useAccount();
    const profile = account.profile;
    useFocusEffect(useCallback(() => { accountService.refresh(); }, []));

    const chooseTitle = async (t) => {
        if (!t.unlocked) { audioService.playSound('error'); return; }
        audioService.playSound('coin');
        await accountService.update({ title: profile.title === t.id ? null : t.id });
    };

    const login = profile?.binga?.login;
    return (
        <View style={styles.container}>
            <LuxeBackdrop />
            <ScreenHeader
                title={t("Missions")}
                onBack={() => navigation.goBack()}
                right={<BingaPill icon={<BingaIcon size={20} />} amount={profile?.binga ? profile.binga.balance.toLocaleString('fr-FR') : '—'} />}
            />

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                {!profile ? (
                    <LuxePanel style={styles.panel}>
                        <Text style={styles.guestTitle}>{t("Missions, bonus de connexion et badges")}</Text>
                        <Text style={styles.dim}>{t("Avec un compte gratuit : des binga chaque jour de connexion, 3 missions et 3 défis par jour, et des badges à débloquer. Pas besoin d'email.")}</Text>
                        <GameButton small title={t("Créer mon compte")} icon="🔐" onPress={() => navigation.navigate('Profile')} style={{ marginTop: 12, alignSelf: 'center' }} />
                    </LuxePanel>
                ) : (
                    <>
                        {/* Connexion du jour : 7 jours */}
                        {login && (
                            <Animated.View entering={FadeInDown.springify().damping(16)}>
                                <LuxePanel style={styles.panel} inner={false}>
                                    <SectionHead icon={IMG.gift} title={t("Récompense quotidienne")} right={t("Jour {p0}/{p1}", { p0: login.streak, p1: login.days })} />
                                    <View style={styles.days}>
                                        {BINGA.login.map((amount, i) => {
                                            const day = i + 1;
                                            const got = login.claimed ? day <= login.streak : day < login.streak;
                                            const today = day === login.streak;
                                            const last = day === BINGA.login.length;
                                            return (
                                                <View key={day} style={[styles.day, got && styles.dayGot, today && styles.dayToday, last && !got && styles.dayLast]} accessibilityLabel={t("Jour {p0} : {p1} binga{p2}", { p0: day, p1: amount, p2: got ? t(', reçu') : '' })}>
                                                    <Text style={styles.dayN}>J{day}</Text>
                                                    <Image source={IMG.coins} style={[styles.dayIcon, last && { width: 34, height: 30 }]} resizeMode="contain" />
                                                    <Text style={styles.dayAmount}>{amount}</Text>
                                                    {got && <Text style={styles.dayCheck}>✓</Text>}
                                                </View>
                                            );
                                        })}
                                    </View>
                                    <Text style={styles.note}>
                                        {login.claimed
                                            ? t("Reçu aujourd'hui : +{p0} binga. Reviens demain pour continuer la série.", { p0: login.amount })
                                            : t("Bonus du jour : +{p0} binga.", { p0: login.amount })}
                                    </Text>
                                </LuxePanel>
                            </Animated.View>
                        )}

                        {/* Missions binga */}
                        {profile.binga && (
                            <Animated.View entering={FadeInDown.delay(80).springify().damping(16)}>
                                <LuxePanel style={styles.panel} inner={false}>
                                    <SectionHead icon={IMG.target} title={t("Missions")} right={t("Nouvelles dans {p0}", { p0: untilTomorrow() })} />
                                    {profile.binga.missions.map((m, i) => (
                                        <Row
                                            key={m.id}
                                            icon={i % 2 ? IMG.cards : IMG.card}
                                            label={t(m.label)}
                                            progress={m.progress}
                                            target={m.target}
                                            done={m.done}
                                            reward={<><BingaIcon size={18} /><Text style={styles.chipText}>{m.binga}</Text></>}
                                        />
                                    ))}
                                    <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
                                        <Text style={styles.small}>{t("Binga gagnés en jouant aujourd'hui :")} {profile.binga.playToday} / {profile.binga.playCap}</Text>
                                        <XpBar progress={profile.binga.playToday / profile.binga.playCap} height={10} style={{ marginTop: 4 }} />
                                    </View>
                                </LuxePanel>
                            </Animated.View>
                        )}

                        {/* Défis du jour : XP + dos de cartes ou tapis */}
                        <Animated.View entering={FadeInDown.delay(140).springify().damping(16)}>
                            <LuxePanel style={styles.panel} inner={false}>
                                <SectionHead icon={IMG.cards} title={t("Défis du jour")} right={`${profile.daily.list.filter((c) => c.done).length}/${profile.daily.list.length}`} />
                                {profile.daily.list.map((c, i) => (
                                    <Row
                                        key={c.id}
                                        icon={i % 2 ? IMG.card : IMG.cards}
                                        label={t(c.label)}
                                        progress={c.progress}
                                        target={c.target}
                                        done={c.done}
                                        reward={<Text style={styles.chipText}>+{c.xp} {t("XP")}</Text>}
                                    />
                                ))}
                                <View style={{ height: 8 }} />
                            </LuxePanel>
                        </Animated.View>

                        {/* Succès et badges : les titres */}
                        <Animated.View entering={FadeInDown.delay(200).springify().damping(16)}>
                            <LuxePanel style={styles.panel} inner={false}>
                                <SectionHead icon={IMG.crown} title={t("Succès et badges")} right={`${profile.titles.filter((t) => t.unlocked).length}/${profile.titles.length}`} />
                                <Text style={[styles.note, { marginTop: 8 }]}>{t("Touche un badge gagné pour l'afficher à côté de ton nom.")}</Text>
                                <View style={styles.badges}>
                                    {profile.titles.map((ti) => {
                                        const on = profile.title === ti.id;
                                        return (
                                            <Pressable key={ti.id} onPress={() => chooseTitle(ti)} style={[styles.badge, on && styles.badgeOn]} accessibilityLabel={`${t(ti.label)} : ${t(ti.desc)}`}>
                                                <Image source={BADGES[TITLE_BADGE[ti.id]] || BADGES.collection} style={[styles.badgeImg, !ti.unlocked && styles.badgeLocked]} resizeMode="contain" />
                                                <Text style={[styles.badgeLabel, !ti.unlocked && { color: LUXE.dim }]} numberOfLines={1}>{t(ti.label)}</Text>
                                                <Text style={styles.badgeDesc} numberOfLines={2}>{ti.unlocked ? (on ? t('✓ affiché') : t(ti.desc)) : `${ti.progress}/${ti.target} · ${t(ti.desc)}`}</Text>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            </LuxePanel>
                        </Animated.View>
                    </>
                )}
            </ScrollView>
            <AppNav navigation={navigation} current="missions" />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: LUXE.night },
    scroll: { padding: 14, paddingBottom: 24, gap: 14, width: '100%', maxWidth: 560, alignSelf: 'center' },
    panel: { paddingBottom: 4 },
    days: { flexDirection: 'row', gap: 4, paddingHorizontal: 8, paddingTop: 10 },
    day: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(232,184,74,0.35)', backgroundColor: 'rgba(14,26,58,0.85)' },
    dayGot: { borderColor: '#3FCF6B', backgroundColor: 'rgba(22,128,58,0.35)' },
    dayToday: { borderColor: LUXE.goldLight, backgroundColor: 'rgba(232,184,74,0.22)' },
    dayLast: { borderColor: LUXE.gold, backgroundColor: 'rgba(142,22,36,0.6)' },
    dayN: { color: LUXE.cream, fontWeight: '900', fontSize: 11 },
    dayIcon: { width: 28, height: 25, marginVertical: 3 },
    dayAmount: { color: LUXE.goldLight, fontWeight: '900', fontSize: 12 },
    dayCheck: { position: 'absolute', top: 2, right: 3, color: '#7CF29A', fontWeight: '900', fontSize: 12 },
    note: { color: LUXE.dim, fontWeight: '700', fontSize: 12, textAlign: 'center', paddingHorizontal: 12, paddingVertical: 10 },
    row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(232,184,74,0.18)' },
    rowDone: { backgroundColor: 'rgba(22,128,58,0.12)' },
    rowIcon: { width: 34, height: 32 },
    rowLabel: { color: LUXE.cream, fontWeight: '900', fontSize: 14 },
    rowBarLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
    track: { height: 10, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 5, overflow: 'hidden' },
    rowCount: { color: LUXE.cream, fontWeight: '800', fontSize: 12, minWidth: 38, textAlign: 'right' },
    chip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, minWidth: 80, height: 34, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(232,184,74,0.7)', backgroundColor: 'rgba(0,0,0,0.4)', overflow: 'hidden' },
    chipText: { color: LUXE.cream, fontWeight: '900', fontSize: 14 },
    chipDone: { borderColor: '#9BF5B0' },
    chipDoneText: { color: '#fff', fontWeight: '900', fontSize: 13, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 2 },
    small: { color: LUXE.dim, fontWeight: '700', fontSize: 11, marginTop: 10 },
    badges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, paddingHorizontal: 8, paddingBottom: 12 },
    badge: { width: '22.5%', minWidth: 74, alignItems: 'center', padding: 4, borderRadius: 12, borderWidth: 1.5, borderColor: 'transparent' },
    badgeOn: { borderColor: LUXE.goldLight, backgroundColor: 'rgba(232,184,74,0.15)' },
    badgeImg: { width: 58, height: 58 },
    badgeLocked: { opacity: 0.32 },
    badgeLabel: { color: LUXE.cream, fontWeight: '900', fontSize: 11, marginTop: 2 },
    badgeDesc: { color: LUXE.dim, fontWeight: '700', fontSize: 9, textAlign: 'center' },
    guestTitle: { color: LUXE.goldLight, fontWeight: '900', fontSize: 17, textAlign: 'center', marginBottom: 6 },
    dim: { color: LUXE.dim, fontWeight: '700', fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
