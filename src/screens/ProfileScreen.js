import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, Image } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import PlayerAvatar from '../components/PlayerAvatar';
import { BingaIcon } from '../components/Decor';
import { getRankInfo, getGameStats } from '../utils/stats';
import { GAMES, GAME_ORDER, gameInfo } from '../games';
import CustomizeSheet from '../components/CustomizeSheet';
import { GameButton, PressableScale, theme, haptic } from '../components/ui';
import accountService, { useAccount } from '../network/accountService';
import audioService from '../network/audioService';
import { dialog } from '../components/Dialog';
import { useChatModeration, unblockPlayer } from '../utils/chatModeration';
import AppNav from '../components/AppNav';
import { LUXE, LuxePanel, LevelBadge, XpBar, LaurelPortrait, LuxeBackdrop, ScreenHeader, SectionHead, GoldSquare, LUXE_IMG } from '../components/Luxe';

const STAT_ICONS = {
    wins: require('../../assets/ui/stat_victoires.webp'),
    best: require('../../assets/ui/stat_serie.webp'),
    rate: require('../../assets/ui/stat_parties.webp'),
    played: require('../../assets/ui/stat_taux.webp'),
};
import { CHESTS, RARITIES } from '../../server/progress/defs';


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
    const [emoji, ...rest] = title.split(' ');
    return (
        <Animated.View entering={FadeInDown.delay(delay).springify().damping(16)} style={{ marginBottom: 14 }}>
            <LuxePanel inner={false}>
                <SectionHead emoji={emoji} title={rest.join(' ')} right={right} />
                <View style={styles.sectionBody}>{children}</View>
            </LuxePanel>
        </Animated.View>
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

// Compte créé dans Discord : le relier à un compte L'Carta existant (sa progression y est ajoutée)
function DiscordLink() {
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const submit = () => {
        if (!name.trim() || !password) { setError("Entre le pseudo et le mot de passe de ton compte L'Carta."); return; }
        dialog.alert('Relier tes comptes ?', `Ta progression gagnée dans Discord (XP, binga, statistiques, objets) sera ajoutée au compte « ${name.trim()} ». Ensuite, Discord ouvrira directement ce compte. C'est définitif.`, [
            { text: 'Annuler', style: 'cancel' },
            {
                text: 'Relier',
                onPress: async () => {
                    setBusy(true);
                    setError(null);
                    const r = await accountService.linkDiscord(name.trim(), password);
                    setBusy(false);
                    if (r.error) { setError(r.error); audioService.playSound('error'); return; }
                    audioService.playSound('victory');
                    haptic('success');
                    dialog.alert('Comptes reliés 🎉', `Tu joues maintenant avec ton compte « ${r.profile.name} », sur le site comme dans Discord.`);
                },
            },
        ]);
    };
    return (
        <View>
            <Text style={styles.dim}>Tu as déjà un compte L'Carta sur le site ou l'appli ? Relie-le à Discord : ta progression d'ici y est ajoutée, et tu retrouves le même compte partout.</Text>
            <TextInput style={styles.input} placeholder="Pseudo de ton compte L'Carta" placeholderTextColor={theme.textDim} value={name} onChangeText={setName} autoCapitalize="none" maxLength={16} accessibilityLabel="Pseudo du compte L'Carta" />
            <TextInput style={styles.input} placeholder="Mot de passe" placeholderTextColor={theme.textDim} value={password} onChangeText={setPassword} secureTextEntry maxLength={64} onSubmitEditing={submit} accessibilityLabel="Mot de passe du compte L'Carta" />
            {error && <Text style={styles.error}>{error}</Text>}
            {busy ? <ActivityIndicator color={theme.gold} style={{ marginTop: 10 }} /> : (
                <GameButton small title="Relier mes comptes" icon="🔗" onPress={submit} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
            )}
        </View>
    );
}

export default function ProfileScreen({ navigation }) {
    const account = useAccount();
    const profile = account.profile;
    const [local, setLocal] = useState({ name: 'Joueur', xp: 0, perGame: {}, history: [] });
    const [customize, setCustomize] = useState(false);
    const mod = useChatModeration();
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
    const myAvatar = profile ? (profile.avatar || 0) : (account.guestAvatar || 0);
    const xp = profile ? profile.xp : local.xp;
    const rank = getRankInfo(xp);
    const shownTitle = profile?.title ? profile.titles.find((t) => t.id === profile.title)?.label : null;

    const [deleting, setDeleting] = useState(false);
    const deleteAccount = () => {
        dialog.alert(
            'Supprimer ton compte ?',
            "La suppression est définitive. Elle efface ton pseudo, ton XP, ton rang, tes stats, ton historique, tes défis, tes titres, les dos et tapis débloqués et ta liste de joueurs bloqués. Rien ne pourra être récupéré.",
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Supprimer définitivement',
                    style: 'destructive',
                    onPress: async () => {
                        setDeleting(true);
                        const r = await accountService.deleteAccount();
                        setDeleting(false);
                        if (r.error) {
                            audioService.playSound('error');
                            dialog.alert('Suppression impossible', r.error);
                            return;
                        }
                        dialog.alert('Compte supprimé', 'Toutes tes données ont été effacées. À bientôt peut-être !');
                        navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
                    },
                },
            ],
        );
    };

    const logout = () => {
        dialog.alert('Se déconnecter ?', 'Ta progression reste sauvegardée sur le serveur.', [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Déconnexion', onPress: () => accountService.logout() },
        ]);
    };

    return (
        <View style={styles.container}>
            <LuxeBackdrop />
            <ScreenHeader
                title="Mon Profil"
                onBack={() => navigation.goBack()}
                right={(
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                        <GoldSquare onPress={() => navigation.navigate('Leaderboard')} label="Classement"><Text style={{ fontSize: 18 }}>🏆</Text></GoldSquare>
                        <GoldSquare onPress={() => setCustomize(true)} label="Style et réglages"><Text style={{ fontSize: 18 }}>⚙️</Text></GoldSquare>
                    </View>
                )}
            />

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                {/* Carte joueur : lauriers, pseudo, niveau, XP, rang, puis 4 statistiques */}
                <Animated.View entering={FadeIn.duration(250)}>
                    <LuxePanel style={styles.card} colors={['#6A1222', '#2A0710']}>
                        <View style={styles.cardRow}>
                            <Pressable onPress={() => setPickAvatar(!pickAvatar)} accessibilityLabel="Changer de portrait">
                                <LaurelPortrait size={112}>
                                    <PlayerAvatar name={name} variant={myAvatar} size={112 * 0.74} />
                                </LaurelPortrait>
                            </Pressable>
                            <View style={{ flex: 1, marginLeft: 8 }}>
                                <Pressable onPress={() => setPickAvatar(!pickAvatar)} style={styles.nameRow}>
                                    <Text style={styles.name} numberOfLines={1}>{name}</Text>
                                    <View style={styles.editBtn}><Text style={{ fontSize: 12 }}>✏️</Text></View>
                                </Pressable>
                                {shownTitle ? <Text style={styles.titleTag}>« {shownTitle} »</Text> : null}
                                <View style={styles.levelRow}>
                                    <LevelBadge level={(rank.index ?? 0) + 1} size={40} />
                                    <View style={{ flex: 1, marginLeft: 6 }}>
                                        <XpBar progress={rank.levelProgress} />
                                        <Text style={styles.xpText}>{xp}{rank.next ? ` / ${rank.next.min}` : ''} XP</Text>
                                    </View>
                                </View>
                                <View style={styles.rankChip}>
                                    <Image source={LUXE_IMG.trophy} style={{ width: 32, height: 20 }} />
                                    <Text style={styles.rankText} numberOfLines={1}>{rank.emoji} {rank.name}</Text>
                                </View>
                            </View>
                        </View>
                        {!pickAvatar && <Text style={styles.avatarHint}>Touche ton portrait pour en choisir un autre</Text>}
                        {pickAvatar && (
                            <View style={styles.avatarGrid}>
                                {/* 12 portraits offerts, puis ceux débloqués (boutique, coffres) */}
                                {[...Array.from({ length: 12 }, (_, i) => i + 1), ...(profile?.unlocks || []).filter((k) => k.startsWith('avatar:')).map((k) => Number(k.split(':')[1])).sort((x, y) => x - y)].map((v) => (
                                    <Pressable key={v} onPress={async () => { setPickAvatar(false); audioService.playSound('pop'); await accountService.setAvatar(v); }} style={[styles.avatarChoice, myAvatar === v && styles.avatarChoiceOn]}>
                                        <PlayerAvatar name={name} variant={v} size={40} />
                                    </Pressable>
                                ))}
                                <Pressable onPress={() => { setPickAvatar(false); navigation.navigate('Shop'); }} style={styles.avatarMore}>
                                    <Text style={styles.avatarMoreText}>＋ Collection</Text>
                                </Pressable>
                            </View>
                        )}
                        {rank.next && <Text style={styles.cardDim}>Prochain rang : {rank.next.emoji} {rank.next.name} à {rank.next.min} XP</Text>}
                        {profile && (
                            <Text style={styles.cardDim}>Saison {profile.season.id} : {profile.season.xp} XP · fin le {new Date(profile.season.end).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</Text>
                        )}
                        {profile?.badges?.length > 0 && (
                            <View style={styles.badges}>
                                {profile.badges.map((b) => <Text key={b.id} style={styles.badge}>🏅 {b.label}</Text>)}
                            </View>
                        )}
                    </LuxePanel>
                </Animated.View>

                {/* 4 statistiques (toutes les parties) */}
                {(() => {
                    const all = GAME_ORDER.map((g) => (profile ? profile.stats[g] : local.perGame[g]) || {});
                    const played = all.reduce((n, x) => n + (x.played || 0), 0);
                    const wins = all.reduce((n, x) => n + (x.wins || 0), 0);
                    const best = profile ? Math.max(0, ...all.map((x) => x.best || 0)) : '—';
                    return (
                        <View style={styles.statTiles}>
                            {[[STAT_ICONS.wins, wins, 'Victoires'], [STAT_ICONS.best, best, 'Série max'], [STAT_ICONS.rate, `${played ? Math.round((wins / played) * 100) : 0}%`, 'Taux de victoire'], [STAT_ICONS.played, played, 'Parties jouées']].map(([icon, v, label]) => (
                                <LuxePanel key={label} style={styles.statTile}>
                                    <Image source={icon} style={{ width: 26, height: 24 }} resizeMode="contain" />
                                    <Text style={styles.statValue}>{v}</Text>
                                    <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
                                </LuxePanel>
                            ))}
                        </View>
                    );
                })()}

                {/* Discord : compte créé dans Discord, à relier à un compte L'Carta existant */}
                {profile?.discord === 'only' && (
                    <Section title="🔗 Relier à mon compte L'Carta" delay={40}>
                        <DiscordLink />
                    </Section>
                )}

                {/* Compte */}
                <Section title="🔐 Compte" delay={60}>
                    {profile ? (
                        <View style={styles.rowBetween}>
                            <Text style={styles.text}>Connecté en tant que <Text style={{ color: theme.goldLight, fontWeight: '900' }}>{profile.name}</Text>. Ta progression est sauvegardée sur le serveur.</Text>
                            <GameButton small title="Déconnexion" variant="outline" onPress={logout} />
                        </View>
                    ) : null}
                    {profile ? (
                        <View style={styles.deleteBox}>
                            <GameButton small title={deleting ? 'Suppression…' : 'Supprimer mon compte'} icon="🗑️" variant="red" onPress={deleteAccount} disabled={deleting} />
                            <Text style={styles.deleteHint}>Efface définitivement ton compte et toutes ses données.</Text>
                        </View>
                    ) : account.loading && account.token ? (
                        <ActivityIndicator color={theme.gold} />
                    ) : (
                        <AccountForm localXp={local.xp} />
                    )}
                </Section>

                {/* Binga : solde, connexion du jour, missions, derniers gains */}
                {profile?.binga ? (
                    <Section title="💰 Binga" right={<Text style={styles.dim}>Missions nouvelles dans {untilTomorrow()}</Text>} delay={90}>
                        <View style={styles.bingaRow}>
                            <BingaIcon size={40} />
                            <Text style={styles.bingaBalance}>{profile.binga.balance.toLocaleString('fr-FR')} binga</Text>
                        </View>
                        <View style={{ alignItems: 'center', marginBottom: 8 }}>
                            <GameButton small title="Ma collection : dos, effets, réactions" icon="🛍️" onPress={() => navigation.navigate('Shop')} />
                        </View>
                        <Text style={[styles.dim, { textAlign: 'center' }]}>Partie finie : +10 même en perdant, +25 en gagnant (+20 contre l'ordinateur). Les binga se gagnent en jouant : ils ne s'achètent pas et ne valent pas d'argent.</Text>

                        <GameButton small title="Missions et connexion du jour" icon="🎯" variant="red" onPress={() => navigation.navigate('Missions')} style={{ alignSelf: 'center', marginTop: 12 }} />

                        {profile.binga.log?.length > 0 && <Text style={styles.bingaSub}>Derniers gains et achats</Text>}
                        {(profile.binga.log || []).slice(0, 6).map((e, i) => (
                            <View key={`${e.at}-${i}`} style={styles.histRow}>
                                <Text style={[styles.text, { flex: 1 }]} numberOfLines={1}>{e.reason}</Text>
                                <Text style={[styles.histXp, e.amount < 0 && { color: '#FCA5A5' }]}>{e.amount > 0 ? '+' : ''}{e.amount}</Text>
                            </View>
                        ))}
                    </Section>
                ) : !profile && !(account.loading && account.token) ? (
                    <Section title="💰 Binga" delay={90}>
                        <Text style={styles.dim}>Crée ton compte pour gagner des binga à chaque partie, même en perdant, et les garder d'un appareil à l'autre.</Text>
                    </Section>
                ) : null}

                {/* Coffres ouverts */}
                {profile?.chests?.history?.length > 0 && (
                    <Section title="🎁 Coffres ouverts" right={<Text style={styles.dim}>{profile.chests.history.length} au total</Text>} delay={100}>
                        {profile.chests.history.slice(0, 15).map((h, i) => (
                            <View key={`${h.at}-${i}`} style={styles.histRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.text} numberOfLines={1}>
                                        <Text style={{ color: RARITIES[h.item.rarity]?.color, fontWeight: '900' }}>{h.item.label}</Text>
                                        <Text style={styles.dim}>  {RARITIES[h.item.rarity]?.label}{h.pity ? ' · garanti' : ''}</Text>
                                    </Text>
                                    <Text style={styles.dim}>{CHESTS[h.chest]?.label} · {new Date(h.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} {new Date(h.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Text>
                                </View>
                                <Text style={styles.histXp}>{h.duplicate ? `Doublon +${h.refund}` : 'Nouveau'}</Text>
                            </View>
                        ))}
                    </Section>
                )}

                {/* Défis du jour, missions, succès et badges : écran Missions */}
                {profile && (
                    <Section title="🎯 Défis, missions et badges" delay={120}>
                        <Text style={styles.dim}>
                            Défis du jour : {profile.daily.list.filter((c) => c.done).length}/{profile.daily.list.length}
                            {'  ·  '}Badges : {profile.titles.filter((t) => t.unlocked).length}/{profile.titles.length}
                            {shownTitle ? `  ·  affiché : « ${shownTitle} »` : ''}
                        </Text>
                        <GameButton small title="Voir les missions" icon="🎯" onPress={() => navigation.navigate('Missions')} style={{ alignSelf: 'flex-start', marginTop: 10 }} />
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

                {/* Joueurs bloqués dans le chat */}
                <Section title="🚫 Joueurs bloqués" delay={280}>
                    {mod.blocked.length === 0 ? (
                        <Text style={styles.dim}>Personne. Pour bloquer un joueur, touche un de ses messages dans le chat.</Text>
                    ) : mod.blocked.map((b) => (
                        <View key={b.key} style={styles.blockedRow}>
                            <Text style={[styles.text, { flex: 1 }]} numberOfLines={1}>{b.name || 'Joueur'}</Text>
                            <GameButton small title="Débloquer" variant="outline" onPress={() => unblockPlayer(b.key)} />
                        </View>
                    ))}
                </Section>

                {/* Confidentialité et conditions (accessibles sans compte) */}
                <Section title="📄 Confidentialité et conditions" delay={300}>
                    <View style={styles.legalBtns}>
                        <GameButton small title="Confidentialité" variant="outline" onPress={() => navigation.navigate('Legal', { doc: 'privacy' })} style={{ flex: 1 }} />
                        <GameButton small title="Conditions" variant="outline" onPress={() => navigation.navigate('Legal', { doc: 'terms' })} style={{ flex: 1 }} />
                    </View>
                </Section>
            </ScrollView>
            <AppNav navigation={navigation} current="profile" />
            <CustomizeSheet
                visible={customize}
                onClose={() => setCustomize(false)}
                onOpenLegal={(doc) => { setCustomize(false); navigation.navigate('Legal', { doc }); }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    sectionBody: { padding: 14 },
    cardRow: { flexDirection: 'row', alignItems: 'center' },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    editBtn: { width: 26, height: 26, borderRadius: 8, borderWidth: 1.5, borderColor: LUXE.gold, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
    levelRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
    xpText: { color: LUXE.cream, fontWeight: '800', fontSize: 11, marginTop: 3, textAlign: 'right' },
    rankChip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, marginTop: 6, paddingRight: 10, paddingLeft: 2, paddingVertical: 2, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1, borderColor: LUXE.gold },
    rankText: { color: LUXE.goldLight, fontWeight: '900', fontSize: 12 },
    cardDim: { color: '#E9D9C0', fontSize: 11, fontWeight: '700', textAlign: 'center', marginTop: 6 },
    statTiles: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    statTile: { flex: 1, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 2 },
    statValue: { color: LUXE.cream, fontWeight: '900', fontSize: 18, marginTop: 4 },
    statLabel: { color: LUXE.dim, fontWeight: '800', fontSize: 9.5, marginTop: 1 },
    legalBtns: { flexDirection: 'row', gap: 10 },
    deleteBox: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(248,113,113,0.3)', alignItems: 'flex-start', gap: 6 },
    deleteHint: { color: '#FCA5A5', fontSize: 11 },
    blockedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
    container: { flex: 1, backgroundColor: LUXE.night },
    scroll: { padding: 14, paddingBottom: 40, maxWidth: 560, width: '100%', alignSelf: 'center' },
    card: { padding: 14, marginBottom: 12 },
    avatarHint: { color: LUXE.dim, fontSize: 11, marginTop: 6, textAlign: 'center' },
    avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 10, gap: 6 },
    avatarChoice: { padding: 3, borderRadius: 24, borderWidth: 2, borderColor: 'transparent' },
    avatarChoiceOn: { borderColor: theme.gold },
    avatarMore: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderStyle: 'dashed', borderColor: theme.gold, alignItems: 'center', justifyContent: 'center', margin: 3 },
    avatarMoreText: { color: theme.goldLight, fontSize: 8, fontWeight: '900', textAlign: 'center' },
    name: { color: LUXE.cream, fontSize: 22, fontWeight: '900', flexShrink: 1, textShadowColor: '#000', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
    titleTag: { color: theme.mint, fontWeight: '800', fontStyle: 'italic', marginTop: 2 },
    badges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 8, gap: 6 },
    badge: { color: theme.goldLight, fontSize: 12, fontWeight: '800', backgroundColor: 'rgba(212,175,55,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    text: { color: theme.cream, fontSize: 13, fontWeight: '700', flexShrink: 1 },
    dim: { color: LUXE.dim, fontSize: 11, flexShrink: 1 },
    error: { color: '#F87171', fontWeight: '800', marginTop: 6 },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    modeRow: { flexDirection: 'row', marginVertical: 10, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: 3 },
    modeBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
    modeBtnOn: { backgroundColor: theme.gold },
    modeText: { color: theme.textDim, fontWeight: '800', fontSize: 12 },
    input: { backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', borderRadius: 12, color: theme.cream, paddingHorizontal: 12, paddingVertical: 10, marginTop: 8, fontWeight: '700' },
    checkRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
    check: { color: theme.gold, fontSize: 18 },
    statBlock: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
    gameName: { fontWeight: '900', fontSize: 14 },
    statLine: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
    stat: { color: theme.cream, fontWeight: '700', fontSize: 12 },
    special: { color: theme.textDim, fontSize: 11, fontWeight: '700' },
    histRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', gap: 8 },
    histXp: { color: theme.goldLight, fontWeight: '900', fontSize: 12 },
    bingaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    bingaBalance: { color: LUXE.goldLight, fontSize: 30, fontWeight: '900', textAlign: 'center', marginBottom: 4, textShadowColor: '#000', textShadowRadius: 4 },
    bingaSub: { color: theme.cream, fontWeight: '900', fontSize: 13, marginTop: 14, marginBottom: 4 },
});
