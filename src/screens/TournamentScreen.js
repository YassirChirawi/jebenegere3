import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ImageBackground, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PressableScale, GameButton, theme } from '../components/ui';
import { dialog } from '../components/Dialog';
import socketService from '../network/socketService';
import audioService from '../network/audioService';
import { useAccount } from '../network/accountService';
import { getMine, remember, forget, GAME_LABEL, formatWhen, formatCountdown } from '../utils/tournaments';
import { tournamentUrl, copyInvite, shareInvite } from '../utils/invite';
import { tournamentStyles as base } from './TournamentsScreen';

const BG = require('../../assets/Yellow and White Illustrative Ramadan Greeting Instagram Post.png');
const STATUS = { open: 'Inscriptions ouvertes', running: 'En cours', done: 'Terminé', cancelled: 'Annulé' };

/** Un tournoi : inscription, inscrits, tableau (tours et finale), match à venir, champion. */
export default function TournamentScreen({ route, navigation }) {
    const id = String(route.params?.id || '').toUpperCase();
    const account = useAccount();
    const [t, setT] = useState(null);
    const [error, setError] = useState(null);
    const [mine, setMine] = useState({});
    const [me, setMe] = useState(null);
    const [isHost, setIsHost] = useState(false);
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState(false);
    const [open, setOpen] = useState(null); // match dont on lit le résumé
    const [now, setNow] = useState(Date.now());
    const skew = useRef(0); // décalage entre l'horloge du serveur et celle de l'appareil
    const nameRef = useRef('');
    nameRef.current = name;

    useEffect(() => {
        AsyncStorage.getItem('playerName').then((n) => { if (n) setName((x) => x || n); }).catch(() => {});
    }, []);
    useEffect(() => { if (account.profile?.name) setName(account.profile.name); }, [account.profile?.name]);
    useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);

    const apply = (view) => {
        if (!view) return;
        skew.current = view.serverNow ? view.serverNow - Date.now() : 0;
        setT(view);
    };

    // Page ouverte = présent pour son match ; la partie se lance toute seule
    useFocusEffect(useCallback(() => {
        let alive = true;
        const offUpdate = socketService.onTournamentUpdate((view) => { if (view.id === id) apply(view); });
        const offStart = socketService.onGameStarted((gameState) => {
            if (!gameState?.tournament || gameState.tournament.id !== id) return;
            audioService.playSound('victory');
            navigation.navigate('Game', { roomId: gameState.roomId, playerName: nameRef.current, initialGameState: gameState, isHost: false });
        });
        const watch = async () => {
            const m = await getMine(id);
            if (!alive) return;
            setMine(m);
            socketService.tournamentWatch(id, m.ticket, m.hostToken, (r) => {
                if (!alive) return;
                if (!r?.success) { setError(r?.message || 'Tournoi introuvable.'); return; }
                setError(null);
                apply(r.tournament);
                setMe(r.me);
                setIsHost(r.isHost);
                remember(id, { name: r.tournament.name, gameType: r.tournament.gameType, startsAt: r.tournament.startsAt, ...(r.me ? {} : { ticket: undefined }) });
            });
        };
        // Appelé tout de suite si déjà connecté, puis à chaque reconnexion (on se signale à nouveau)
        const offConnect = socketService.onConnect(watch);
        return () => {
            alive = false;
            offUpdate();
            offStart();
            offConnect && offConnect();
            socketService.tournamentUnwatch(id);
        };
    }, [id]));

    const register = () => {
        if (name.trim().length < 2) { dialog.alert('Pseudo', 'Choisis un pseudo pour t\'inscrire.'); return; }
        setBusy(true);
        AsyncStorage.setItem('playerName', name.trim()).catch(() => {});
        socketService.tournamentRegister(id, name.trim(), mine.ticket, async (r) => {
            setBusy(false);
            if (!r?.success) { dialog.alert('Inscription', r?.message || 'Le serveur ne répond pas.'); return; }
            audioService.playSound('coin');
            await remember(id, { ticket: r.ticket, name: r.tournament.name, gameType: r.tournament.gameType, startsAt: r.tournament.startsAt });
            setMine((m) => ({ ...m, ticket: r.ticket }));
            setMe(r.me);
            apply(r.tournament);
        });
    };

    const unregister = () => {
        dialog.alert('Se désinscrire ?', 'Ta place sera libérée pour quelqu\'un d\'autre.', [
            { text: 'Rester inscrit' },
            {
                text: 'Me désinscrire',
                style: 'destructive',
                onPress: () => socketService.tournamentUnregister(id, mine.ticket, async (r) => {
                    if (!r?.success) { dialog.alert('Oups', r?.message || 'Le serveur ne répond pas.'); return; }
                    await remember(id, { ticket: null });
                    if (!mine.hostToken) await forget(id);
                    setMine((m) => ({ ...m, ticket: null }));
                    setMe(null);
                    apply(r.tournament);
                }),
            },
        ]);
    };

    const startNow = () => {
        socketService.tournamentStartNow(id, mine.hostToken, (r) => {
            if (!r?.success) dialog.alert('Oups', r?.message || 'Le serveur ne répond pas.');
            else apply(r.tournament);
        });
    };

    const copy = async () => {
        const ok = await copyInvite(id, tournamentUrl(id));
        setCopied(ok);
        if (ok) setTimeout(() => setCopied(false), 2500);
    };
    const share = async () => {
        const res = await shareInvite(id, '', {
            url: tournamentUrl(id),
            message: `Inscris-toi au tournoi « ${t?.name} » (${GAME_LABEL[t?.gameType]}) sur Jeben Gere3 : ${tournamentUrl(id)}`,
        });
        if (res === 'copied') { setCopied(true); setTimeout(() => setCopied(false), 2500); }
    };

    if (error) {
        return (
            <ImageBackground source={BG} style={base.container} resizeMode="cover">
                <Header navigation={navigation} title="🏆 Tournoi" />
                <Text style={base.empty}>{error}</Text>
            </ImageBackground>
        );
    }
    if (!t) {
        return (
            <ImageBackground source={BG} style={base.container} resizeMode="cover">
                <Header navigation={navigation} title="🏆 Tournoi" />
                <ActivityIndicator color={theme.gold} style={{ marginTop: 40 }} />
            </ImageBackground>
        );
    }

    const serverNow = now + skew.current;
    const full = t.entrants.length >= t.size;
    const minUnits = t.mode === 'duo' ? 3 : 2;
    // Mon match du tour en cours
    const current = t.status === 'running' ? (t.rounds[t.round]?.matches || []) : [];
    const myMatch = me && current.find((m) => m.aMembers.includes(me) || m.bMembers.includes(me));
    const mySide = myMatch && (myMatch.aMembers.includes(me) ? 'a' : 'b');
    const eliminated = me && t.status !== 'open' && t.rounds.some((r) => r.matches.some((m) => m.status === 'done' && m.winner && ((m.winner === 'a' && m.bMembers.includes(me)) || (m.winner === 'b' && m.aMembers.includes(me)))));
    const iAmChampion = t.status === 'done' && me && t.champion && t.champion.names.includes(t.entrants.find((e) => e.id === me)?.name);

    return (
        <ImageBackground source={BG} style={base.container} resizeMode="cover">
            <Header navigation={navigation} title={`🏆 ${t.name}`} />
            <ScrollView contentContainerStyle={base.list} keyboardShouldPersistTaps="handled">
                <View style={styles.infoCard}>
                    <Text style={styles.infoGame}>{GAME_LABEL[t.gameType]}{t.mode === 'duo' ? ' · 2 contre 2' : ' · 1 contre 1'} · {t.size} joueurs · élimination directe</Text>
                    <Text style={styles.infoWhen}>
                        {t.status === 'open' ? `Début ${formatWhen(t.startsAt)}` : STATUS[t.status]}
                    </Text>
                    {t.status === 'open' && <Text style={styles.countdown}>dans {formatCountdown(t.startsAt - serverNow)}</Text>}
                    {t.status === 'cancelled' && <Text style={styles.warn}>{t.reason}</Text>}
                </View>

                {t.status === 'done' && t.champion && (
                    <Animated.View entering={FadeIn.duration(500)} style={styles.champion}>
                        <Text style={styles.championCrown}>👑</Text>
                        <Text style={styles.championLabel}>CHAMPION</Text>
                        <Text style={styles.championName}>{t.champion.name}</Text>
                        {iAmChampion && (
                            <Text style={styles.championHint}>
                                {account.profile ? 'Ton dos « Champion » et le titre « Moul chi » sont dans ton Profil.' : 'Connecte-toi à un compte (Profil) depuis cet appareil pour recevoir le dos « Champion » et le titre « Moul chi ».'}
                            </Text>
                        )}
                    </Animated.View>
                )}

                {/* Mon match */}
                {myMatch && myMatch.status !== 'done' && (
                    <Animated.View entering={FadeInDown.springify()} style={styles.myMatch}>
                        <Text style={styles.myMatchTitle}>{t.rounds[t.round].label} · ton match</Text>
                        <Text style={styles.myMatchVs}>{mySide === 'a' ? myMatch.b : myMatch.a}</Text>
                        <Text style={styles.myMatchHint}>
                            {myMatch.status === 'playing'
                                ? 'La partie est en cours.'
                                : `La partie se lance toute seule dès que ton adversaire est là. Garde cette page ouverte. Absent dans ${formatCountdown(myMatch.waitLeft - (Date.now() + skew.current - t.serverNow))} : forfait.`}
                        </Text>
                    </Animated.View>
                )}
                {eliminated && t.status === 'running' && !myMatch?.status?.match(/waiting|playing/) && (
                    <Text style={styles.out}>Tu es éliminé pour ce tournoi. Tu peux suivre la suite ici.</Text>
                )}

                {/* Inscription */}
                {t.status === 'open' && (
                    <View style={base.card}>
                        {me ? (
                            <>
                                <Text style={styles.registered}>✅ Inscription confirmée</Text>
                                <Text style={base.hint}>À l'heure du début, garde cette page ouverte : ton match se lance tout seul quand ton adversaire est là. Absent au bout de 3 minutes : forfait.</Text>
                                <GameButton small title="Me désinscrire" variant="outline" onPress={unregister} style={{ marginTop: 10 }} />
                            </>
                        ) : full ? (
                            <Text style={styles.registered}>Le tournoi est complet.</Text>
                        ) : (
                            <>
                                <Text style={base.label}>TON PSEUDO</Text>
                                <TextInput
                                    style={base.input}
                                    value={name}
                                    onChangeText={setName}
                                    editable={!account.profile}
                                    maxLength={16}
                                    placeholder="Ex : Yassir"
                                    placeholderTextColor={theme.textDim}
                                    accessibilityLabel="Ton pseudo"
                                />
                                <GameButton title={busy ? 'Inscription…' : "JE M'INSCRIS"} icon="🎟️" onPress={register} disabled={busy} style={{ marginTop: 12 }} />
                            </>
                        )}
                    </View>
                )}

                {/* Lien d'inscription */}
                {t.status === 'open' && (
                    <View style={base.card}>
                        <Text style={base.label}>INVITE DES JOUEURS</Text>
                        <Text style={styles.link} selectable numberOfLines={1}>{tournamentUrl(id)}</Text>
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                            <GameButton small title={copied ? 'Lien copié ✓' : 'Copier le lien'} icon="📋" variant="outline" onPress={copy} style={{ flex: 1 }} />
                            <GameButton small title="Partager" icon="📤" variant="blue" onPress={share} style={{ flex: 1 }} />
                        </View>
                        {isHost && (
                            <>
                                <GameButton
                                    small
                                    title="Lancer maintenant"
                                    icon="🚀"
                                    variant="green"
                                    onPress={startNow}
                                    disabled={(t.mode === 'duo' ? Math.ceil(t.entrants.length / 2) : t.entrants.length) < 2}
                                    style={{ marginTop: 10 }}
                                />
                                <Text style={base.hint}>Tu es l'organisateur : tu peux lancer sans attendre l'heure prévue (au moins {minUnits} inscrits). Les places vides font passer un joueur directement au tour suivant.</Text>
                            </>
                        )}
                    </View>
                )}

                <Text style={base.section}>INSCRITS · {t.entrants.length}/{t.size}</Text>
                <View style={styles.entrants}>
                    {t.entrants.length === 0 && <Text style={base.emptySmall}>Personne pour l'instant. Partage le lien !</Text>}
                    {t.entrants.map((e) => (
                        <View key={e.id} style={[styles.entrant, e.id === me && styles.entrantMe]}>
                            <Text style={styles.entrantText}>{e.name}{e.id === me ? ' (toi)' : ''}</Text>
                        </View>
                    ))}
                </View>

                {/* Tableau */}
                {t.rounds.length > 0 && (
                    <>
                        <Text style={base.section}>TABLEAU</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 6 }}>
                            {t.rounds.map((r, ri) => (
                                <View key={r.label} style={styles.round}>
                                    <Text style={[styles.roundLabel, ri === t.round && t.status === 'running' && { color: theme.mint }]}>{r.label}</Text>
                                    <View style={styles.roundMatches}>
                                        {r.matches.map((m) => (
                                            <MatchCard key={m.id} m={m} me={me} onPress={() => setOpen(open === m.id ? null : m.id)} expanded={open === m.id} />
                                        ))}
                                    </View>
                                </View>
                            ))}
                        </ScrollView>
                        <Text style={base.hint}>Touche un match terminé pour voir ses coups clés.</Text>
                    </>
                )}
                {t.status === 'open' && (
                    <Text style={[base.hint, { textAlign: 'center' }]}>Le tableau est tiré au sort au début du tournoi.</Text>
                )}
            </ScrollView>
        </ImageBackground>
    );
}

function Header({ navigation, title }) {
    return (
        <View style={base.header}>
            <PressableScale style={base.headBtn} onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.replace('Home'))}>
                <Text style={base.headBtnText}>⬅️ Retour</Text>
            </PressableScale>
            <Text style={base.headTitle} numberOfLines={1}>{title}</Text>
            <View style={{ width: 70 }} />
        </View>
    );
}

function MatchCard({ m, me, onPress, expanded }) {
    const status = m.bye
        ? "Qualifié d'office"
        : m.status === 'playing' ? '🎮 En cours'
            : m.status === 'waiting' ? '⏳ Attente des joueurs'
                : m.status === 'done' ? (m.forfeit ? '🏳️ Forfait' : m.score ? `Score ${m.score}` : 'Terminé')
                    : 'À venir';
    const line = (side) => {
        const nm = m[side];
        const members = side === 'a' ? m.aMembers : m.bMembers;
        const won = m.winner === side;
        const lost = m.winner && !won;
        return (
            <View style={[styles.side, won && styles.sideWon]}>
                <Text style={[styles.sideText, lost && styles.sideLost, members.includes(me) && { color: theme.goldLight }]} numberOfLines={1}>
                    {nm || (m.bye ? '—' : '…')}
                </Text>
                {won ? <Text style={styles.check}>✓</Text> : null}
            </View>
        );
    };
    return (
        <PressableScale onPress={onPress} disabled={m.status !== 'done' || !m.summary?.length} style={[styles.match, m.status === 'playing' && styles.matchLive]} scaleTo={0.98}>
            {line('a')}
            {line('b')}
            <Text style={styles.matchStatus}>{status}</Text>
            {expanded && m.summary?.length > 0 && (
                <View style={styles.summary}>
                    <Text style={styles.summaryTitle}>COUPS CLÉS</Text>
                    {m.summary.map((s, i) => <Text key={i} style={styles.summaryLine}>{s}</Text>)}
                </View>
            )}
        </PressableScale>
    );
}

const styles = StyleSheet.create({
    infoCard: { backgroundColor: 'rgba(28,15,19,0.95)', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)', alignItems: 'center' },
    infoGame: { color: theme.cream, fontWeight: '800', fontSize: 13, textAlign: 'center' },
    infoWhen: { color: theme.goldLight, fontWeight: '900', fontSize: 18, marginTop: 6, textAlign: 'center' },
    countdown: { color: theme.mint, fontWeight: '900', fontSize: 14, marginTop: 2 },
    warn: { color: '#FCA5A5', fontWeight: '800', marginTop: 6, textAlign: 'center' },
    champion: { marginTop: 12, alignItems: 'center', padding: 16, borderRadius: 18, backgroundColor: '#8E0E1C', borderWidth: 2, borderColor: theme.goldLight },
    championCrown: { fontSize: 40 },
    championLabel: { color: theme.goldLight, fontWeight: '900', letterSpacing: 3, fontSize: 12 },
    championName: { color: '#FFF7D6', fontWeight: '900', fontSize: 22, marginTop: 2, textAlign: 'center' },
    championHint: { color: theme.cream, fontSize: 12, marginTop: 8, textAlign: 'center' },
    myMatch: { marginTop: 12, padding: 14, borderRadius: 16, backgroundColor: 'rgba(16,80,50,0.95)', borderWidth: 1.5, borderColor: theme.mint, alignItems: 'center' },
    myMatchTitle: { color: theme.mint, fontWeight: '900', fontSize: 12, letterSpacing: 1 },
    myMatchVs: { color: '#fff', fontWeight: '900', fontSize: 20, marginTop: 4, textAlign: 'center' },
    myMatchHint: { color: theme.cream, fontSize: 12, marginTop: 6, textAlign: 'center', lineHeight: 17 },
    out: { color: theme.cream, textAlign: 'center', marginTop: 12, backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 12, fontSize: 12 },
    registered: { color: theme.mint, fontWeight: '900', fontSize: 15, textAlign: 'center' },
    link: { color: theme.goldLight, fontWeight: '700', fontSize: 13, backgroundColor: 'rgba(0,0,0,0.4)', padding: 10, borderRadius: 10 },
    entrants: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    entrant: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(28,15,19,0.92)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)' },
    entrantMe: { borderColor: theme.gold },
    entrantText: { color: theme.cream, fontWeight: '700', fontSize: 13 },
    round: { width: 190 },
    roundLabel: { color: theme.goldLight, fontWeight: '900', fontSize: 12, textAlign: 'center', marginBottom: 6, letterSpacing: 0.5 },
    roundMatches: { flex: 1, justifyContent: 'space-around', gap: 8 },
    match: { backgroundColor: 'rgba(28,15,19,0.95)', borderRadius: 12, padding: 8, borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)' },
    matchLive: { borderColor: theme.mint },
    side: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 6, borderRadius: 8 },
    sideWon: { backgroundColor: 'rgba(212,175,55,0.18)' },
    sideText: { flex: 1, color: theme.cream, fontWeight: '800', fontSize: 13 },
    sideLost: { color: theme.textDim, textDecorationLine: 'line-through' },
    check: { color: theme.goldLight, fontWeight: '900', marginLeft: 4 },
    matchStatus: { color: theme.textDim, fontSize: 10, marginTop: 4, textAlign: 'center' },
    summary: { marginTop: 6, borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.25)', paddingTop: 6 },
    summaryTitle: { color: theme.gold, fontWeight: '900', fontSize: 10, letterSpacing: 1, marginBottom: 2 },
    summaryLine: { color: theme.cream, fontSize: 11, marginTop: 2 },
});
