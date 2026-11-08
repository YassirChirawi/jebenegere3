import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ImageBackground, ScrollView, TextInput, Pressable, ActivityIndicator } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import PlayerAvatar from '../components/PlayerAvatar';
import { getRankInfo, getGameStats } from '../utils/stats';
import { GAMES, GAME_ORDER, gameInfo } from '../games';
import CustomizeSheet from '../components/CustomizeSheet';
import { GameButton, PressableScale, theme, haptic } from '../components/ui';
import accountService, { useAccount } from '../network/accountService';
import audioService from '../network/audioService';
import { dialog } from '../components/Dialog';

const BG = require('../../assets/Yellow and White Illustrative Ramadan Greeting Instagram Post.png');

// Coups spéciaux affichés par jeu (compteurs du serveur)
const SPECIALS = {
    hezz2: [['hezz2_first', '1ʳᵉ place'], ['hezz2_safe_best', 'Série sans Khasser']],
    ronda: [['darba', 'Darba'], ['hbel', 'Hbel'], ['bachra', 'Boug'], ['missa', 'Missa']],
    kdoub: [['kdoub_call', 'KDOUB criés'], ['kdoub_catch', 'Menteurs démasqués']],
    sota: [['sota_safe', 'Sota évitée']],
};

const fmtDate = (at) => new Date(at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

// Temps restant avant les nouveaux défis (minuit au Maroc, UTC+1)
function untilTomorrow() {
    const now = Date.now() + 3600 * 1000;
    const next = Math.ceil(now / 86400000) * 86400000;
    const m = Math.round((next - now) / 60000);
    return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}

function Section({ title, right, children, delay = 0 }) {
    return (
        <Animated.View entering={FadeInDown.delay(delay).springify().damping(16)} style={styles.section}>
            <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>{title}</Text>
                {right}
            </View>
            {children}
        </Animated.View>
    );
}

function Bar({ value, color = theme.gold }) {
    return (
        <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.max(3, Math.min(1, value) * 100)}%`, backgroundColor: color }]} />
        </View>
    );
}

// Formulaire compte : création ou connexion (pseudo + mot de passe, sans email)
function AccountForm({ localXp }) {
    const [mode, setMode] = useState('register');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [keepXp, setKeepXp] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => { AsyncStorage.getItem('playerName').then((n) => n && setName(n)).catch(() => {}); }, []);

    const submit = async () => {
        setBusy(true);
        setError(null);
        const r = mode === 'register'
            ? await accountService.register(name.trim(), password, keepXp ? localXp : 0)
            : await accountService.login(name.trim(), password);
        setBusy(false);
        if (r.error) {
            setError(r.error);
            audioService.playSound('error');
            return;
        }
        audioService.playSound('victory');
        haptic('success');
    };

    return (
        <View>
            <Text style={styles.dim}>
                Crée ton compte pour garder tes XP, tes stats et tes récompenses sur tous tes appareils, et apparaître au classement de la saison. Pas besoin d'email.
            </Text>
            <View style={styles.modeRow}>
                {[['register', 'Créer un compte'], ['login', "J'ai déjà un compte"]].map(([k, l]) => (
                    <Pressable key={k} onPress={() => { setMode(k); setError(null); }} style={[styles.modeBtn, mode === k && styles.modeBtnOn]}>
                        <Text style={[styles.modeText, mode === k && { color: theme.bg }]}>{l}</Text>
                    </Pressable>
                ))}
            </View>
            <TextInput style={styles.input} placeholder="Pseudo (3 à 16 caractères)" placeholderTextColor={theme.textDim} value={name} onChangeText={setName} autoCapitalize="none" maxLength={16} />
            <TextInput style={styles.input} placeholder="Mot de passe (6 caractères minimum)" placeholderTextColor={theme.textDim} value={password} onChangeText={setPassword} secureTextEntry maxLength={64} onSubmitEditing={submit} />
            {mode === 'register' && localXp > 0 && (
                <Pressable onPress={() => setKeepXp(!keepXp)} style={styles.checkRow}>
                    <Text style={styles.check}>{keepXp ? '☑' : '☐'}</Text>
                    <Text style={styles.dim}>Reprendre mes {Math.min(localXp, 3000)} XP de cet appareil{localXp > 3000 ? ' (maximum 3000)' : ''}</Text>
                </Pressable>
            )}
            {error && <Text style={styles.error}>{error}</Text>}
            {busy ? (
                <ActivityIndicator color={theme.gold} style={{ marginTop: 10 }} />
            ) : (
                <GameButton small title={mode === 'register' ? 'Créer mon compte' : 'Se connecter'} icon="🔐" variant="gold" onPress={submit} style={{ marginTop: 10 }} />
            )}
        </View>
    );
}

export default function ProfileScreen({ navigation }) {
    const account = useAccount();
    const profile = account.profile;
    const [local, setLocal] = useState({ name: 'Joueur', xp: 0, perGame: {}, history: [] });
    const [customize, setCustomize] = useState(false);
    const [pickAvatar, setPickAvatar] = useState(false);

    const loadLocal = async () => {
        try {
            const [name, xp, hist] = await Promise.all(['playerName', 'playerXP', 'matchHistory'].map((k) => AsyncStorage.getItem(k)));
            const entries = await Promise.all(GAME_ORDER.map(async (g) => [g, await getGameStats(g)]));
            setLocal({ name: name || 'Joueur', xp: parseInt(xp || '0', 10), perGame: Object.fromEntries(entries), history: JSON.parse(hist || '[]') });
        } catch (e) { /* ignore */ }
    };

    useFocusEffect(useCallback(() => {
        loadLocal();
        accountService.refresh();
    }, []));

    const name = profile?.name || local.name;
    const xp = profile ? profile.xp : local.xp;
    const rank = getRankInfo(xp);
    const shownTitle = profile?.title ? profile.titles.find((t) => t.id === profile.title)?.label : null;

    const chooseTitle = async (t) => {
        if (!t.unlocked) { audioService.playSound('error'); return; }
        audioService.playSound('coin');
        await accountService.update({ title: profile.title === t.id ? null : t.id });
    };

    const logout = () => {
        dialog.alert('Se déconnecter ?', 'Ta progression reste sauvegardée sur le serveur.', [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Déconnexion', onPress: () => accountService.logout() },
        ]);
    };

    return (
        <ImageBackground source={BG} style={styles.container} resizeMode="cover">
            <View style={styles.header}>
                <PressableScale style={styles.headBtn} onPress={() => navigation.goBack()}>
                    <Text style={styles.headBtnText}>⬅️ Retour</Text>
                </PressableScale>
                <Text style={styles.title}>Mon Profil</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                    <PressableScale style={styles.headBtn} onPress={() => navigation.navigate('Leaderboard')}>
                        <Text style={styles.headBtnText}>🏆</Text>
                    </PressableScale>
                    <PressableScale style={styles.headBtn} onPress={() => setCustomize(true)}>
                        <Text style={styles.headBtnText}>🎨 Style</Text>
                    </PressableScale>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                {/* Carte joueur */}
                <Animated.View entering={FadeIn.duration(250)} style={styles.card}>
                    <Pressable onPress={() => profile && setPickAvatar(!pickAvatar)}>
                        <PlayerAvatar name={name} variant={profile?.avatar || 0} size={86} />
                        {profile && <Text style={styles.editAvatar}>✏️</Text>}
                    </Pressable>
                    {pickAvatar && profile && (
                        <View style={styles.avatarGrid}>
                            {Array.from({ length: 8 }).map((_, i) => (
                                <Pressable key={i} onPress={async () => { setPickAvatar(false); audioService.playSound('pop'); await accountService.update({ avatar: i }); }} style={[styles.avatarChoice, (profile.avatar || 0) === i && styles.avatarChoiceOn]}>
                                    <PlayerAvatar name={name} variant={i} size={40} />
                                </Pressable>
                            ))}
                        </View>
                    )}
                    <Text style={styles.name}>{name}</Text>
                    {shownTitle ? <Text style={styles.titleTag}>« {shownTitle} »</Text> : null}
                    <Text style={styles.rank}>{rank.emoji} {rank.name}</Text>
                    <Text style={styles.xp}>{xp} XP</Text>
                    <Bar value={rank.levelProgress} />
                    {rank.next && <Text style={styles.dim}>Prochain rang : {rank.next.emoji} {rank.next.name} à {rank.next.min} XP</Text>}
                    {profile && (
                        <Text style={[styles.dim, { marginTop: 4 }]}>Saison {profile.season.id} : {profile.season.xp} XP · fin le {new Date(profile.season.end).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</Text>
                    )}
                    {profile?.badges?.length > 0 && (
                        <View style={styles.badges}>
                            {profile.badges.map((b) => <Text key={b.id} style={styles.badge}>🏅 {b.label}</Text>)}
                        </View>
                    )}
                </Animated.View>

                {/* Compte */}
                <Section title="🔐 Compte" delay={60}>
                    {profile ? (
                        <View style={styles.rowBetween}>
                            <Text style={styles.text}>Connecté en tant que <Text style={{ color: theme.goldLight, fontWeight: '900' }}>{profile.name}</Text>. Ta progression est sauvegardée sur le serveur.</Text>
                            <GameButton small title="Déconnexion" variant="outline" onPress={logout} />
                        </View>
                    ) : account.loading && account.token ? (
                        <ActivityIndicator color={theme.gold} />
                    ) : (
                        <AccountForm localXp={local.xp} />
                    )}
                </Section>

                {/* Défis du jour */}
                <Section title="🎯 Défis du jour" right={profile ? <Text style={styles.dim}>Nouveaux dans {untilTomorrow()}</Text> : null} delay={120}>
                    {profile ? profile.daily.list.map((c) => (
                        <View key={c.id} style={[styles.challenge, c.done && styles.challengeDone]}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.text}>{c.done ? '✅ ' : ''}{c.label}</Text>
                                <Bar value={c.progress / c.target} color={c.done ? theme.mint : theme.gold} />
                            </View>
                            <View style={styles.challengeRight}>
                                <Text style={styles.challengeCount}>{c.progress}/{c.target}</Text>
                                <Text style={styles.challengeXp}>+{c.xp} XP 🎁</Text>
                            </View>
                        </View>
                    )) : (
                        <Text style={styles.dim}>Connecte-toi pour relever 3 défis par jour : chacun rapporte des XP et débloque un dos de cartes ou un tapis.</Text>
                    )}
                </Section>

                {/* Titres */}
                {profile && (
                    <Section title="🏷️ Titres" right={<Text style={styles.dim}>Touche un titre pour l'afficher</Text>} delay={180}>
                        {profile.titles.map((t) => (
                            <Pressable key={t.id} onPress={() => chooseTitle(t)} style={[styles.titleRow, !t.unlocked && { opacity: 0.55 }, profile.title === t.id && styles.titleRowOn]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.text}>{t.unlocked ? '🏷️' : '🔒'} {t.label}{profile.title === t.id ? '  · affiché' : ''}</Text>
                                    <Text style={styles.dim}>{t.desc}</Text>
                                </View>
                                {!t.unlocked && <Text style={styles.challengeCount}>{t.progress}/{t.target}</Text>}
                            </Pressable>
                        ))}
                    </Section>
                )}

                {/* Statistiques par jeu */}
                <Section title="📊 Statistiques" delay={240}>
                    {GAME_ORDER.filter((g) => GAMES[g].available).map((g) => {
                        const st = profile ? profile.stats[g] : { ...local.perGame[g], best: null };
                        const played = st?.played || 0;
                        const wins = st?.wins || 0;
                        return (
                            <View key={g} style={styles.statBlock}>
                                <View style={styles.rowBetween}>
                                    <Text style={[styles.gameName, { color: GAMES[g].color }]}>{GAMES[g].label}</Text>
                                    <Text style={styles.dim}>{played} partie{played > 1 ? 's' : ''}</Text>
                                </View>
                                <View style={styles.statLine}>
                                    <Text style={styles.stat}><Text style={{ color: theme.mint }}>{wins}</Text> V</Text>
                                    <Text style={styles.stat}><Text style={{ color: '#F87171' }}>{st?.losses || 0}</Text> D</Text>
                                    <Text style={styles.stat}>{played ? Math.round((wins / played) * 100) : 0}% victoires</Text>
                                    {profile && <Text style={styles.stat}>Série max {st.best || 0}</Text>}
                                </View>
                                {profile && (
                                    <View style={styles.statLine}>
                                        {SPECIALS[g].map(([k, label]) => (
                                            <Text key={k} style={styles.special}>{label} : <Text style={{ color: theme.goldLight }}>{profile.counters?.[k] || 0}</Text></Text>
                                        ))}
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </Section>

                {/* Historique */}
                <Section title="🕑 Dernières parties" delay={300}>
                    {(profile ? profile.history : local.history).length === 0 ? (
                        <Text style={styles.dim}>Aucune partie jouée pour l'instant.</Text>
                    ) : profile ? (
                        profile.history.map((h, i) => (
                            <View key={i} style={styles.histRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.text}><Text style={{ color: gameInfo(h.game).color, fontWeight: '900' }}>{gameInfo(h.game).label}</Text>  <Text style={{ color: h.won ? theme.mint : '#F87171' }}>{h.result}</Text></Text>
                                    <Text style={styles.dim} numberOfLines={1}>{fmtDate(h.at)} · contre {h.opponents || '—'}</Text>
                                </View>
                                <Text style={styles.histXp}>+{h.xp} XP</Text>
                            </View>
                        ))
                    ) : (
                        local.history.map((m) => (
                            <View key={m.id} style={styles.histRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.text}><Text style={{ color: gameInfo(m.game).color, fontWeight: '900' }}>{gameInfo(m.game).label}</Text>  <Text style={{ color: m.result.includes('Victoire') ? theme.mint : '#F87171' }}>{m.result}</Text></Text>
                                    <Text style={styles.dim} numberOfLines={1}>{m.date} · contre {m.opponents}</Text>
                                </View>
                            </View>
                        ))
                    )}
                </Section>
            </ScrollView>
            <CustomizeSheet visible={customize} onClose={() => setCustomize(false)} />
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 44, paddingHorizontal: 14, paddingBottom: 8, backgroundColor: 'rgba(18,8,11,0.85)' },
    headBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, backgroundColor: 'rgba(212,175,55,0.15)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)' },
    headBtnText: { color: theme.goldLight, fontWeight: '800', fontSize: 13 },
    title: { color: theme.goldLight, fontSize: 20, fontWeight: '900' },
    scroll: { padding: 14, paddingBottom: 40, maxWidth: 560, width: '100%', alignSelf: 'center' },
    card: { alignItems: 'center', backgroundColor: 'rgba(28,15,19,0.92)', borderRadius: 20, borderWidth: 1.5, borderColor: theme.gold, padding: 16, marginBottom: 12 },
    editAvatar: { position: 'absolute', right: -4, bottom: -2, fontSize: 16 },
    avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 10, gap: 6 },
    avatarChoice: { padding: 3, borderRadius: 24, borderWidth: 2, borderColor: 'transparent' },
    avatarChoiceOn: { borderColor: theme.gold },
    name: { color: theme.cream, fontSize: 22, fontWeight: '900', marginTop: 8 },
    titleTag: { color: theme.mint, fontWeight: '800', fontStyle: 'italic', marginTop: 2 },
    rank: { color: theme.goldLight, fontSize: 16, fontWeight: '900', marginTop: 6 },
    xp: { color: theme.cream, fontWeight: '800', marginBottom: 6 },
    badges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 8, gap: 6 },
    badge: { color: theme.goldLight, fontSize: 12, fontWeight: '800', backgroundColor: 'rgba(212,175,55,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    section: { backgroundColor: 'rgba(28,15,19,0.92)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)', padding: 14, marginBottom: 12 },
    sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    sectionTitle: { color: theme.goldLight, fontSize: 16, fontWeight: '900' },
    text: { color: theme.cream, fontSize: 13, fontWeight: '700', flexShrink: 1 },
    dim: { color: theme.textDim, fontSize: 11, flexShrink: 1 },
    error: { color: '#F87171', fontWeight: '800', marginTop: 6 },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    track: { width: '100%', height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden', marginVertical: 5 },
    fill: { height: '100%', borderRadius: 3 },
    modeRow: { flexDirection: 'row', marginVertical: 10, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 3 },
    modeBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
    modeBtnOn: { backgroundColor: theme.gold },
    modeText: { color: theme.textDim, fontWeight: '800', fontSize: 12 },
    input: { backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', borderRadius: 12, color: theme.cream, paddingHorizontal: 12, paddingVertical: 10, marginTop: 8, fontWeight: '700' },
    checkRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
    check: { color: theme.gold, fontSize: 18 },
    challenge: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', gap: 10 },
    challengeDone: { opacity: 0.75 },
    challengeRight: { alignItems: 'flex-end' },
    challengeCount: { color: theme.cream, fontWeight: '900' },
    challengeXp: { color: theme.goldLight, fontSize: 11, fontWeight: '800' },
    titleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 8, borderRadius: 12, marginBottom: 4 },
    titleRowOn: { backgroundColor: 'rgba(52,211,153,0.12)', borderWidth: 1, borderColor: theme.mint },
    statBlock: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
    gameName: { fontWeight: '900', fontSize: 14 },
    statLine: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
    stat: { color: theme.cream, fontWeight: '700', fontSize: 12 },
    special: { color: theme.textDim, fontSize: 11, fontWeight: '700' },
    histRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', gap: 8 },
    histXp: { color: theme.goldLight, fontWeight: '900', fontSize: 12 },
});
