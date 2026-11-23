import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition, ZoomIn, useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import socketService from '../network/socketService';
import audioService from '../network/audioService';
import PlayerAvatar from '../components/PlayerAvatar';
import { Chip, STAKE_CHIP } from '../components/Decor';
import { GameButton, IconButton, theme } from '../components/ui';
import { dialog } from '../components/Dialog';
import { gameInfo, GAMES, GAME_ORDER } from '../games';
import { enterFullscreen } from '../utils/fullscreen';
import { inviteUrl, copyInvite, shareInvite } from '../utils/invite';
import { inDiscord, discordInvite } from '../utils/discord';
import friendsService, { useFriends } from '../network/friendsService';
import { useAccount } from '../network/accountService';
import { BINGA } from '../../server/progress/defs';
import { LuxeBackdrop, ScreenHeader, BingaPill } from '../components/Luxe';
import MenuShell, { Cols, useMenuLayout } from '../components/MenuShell';
import { t } from '../i18n';


function WaitingDots() {
    const t = useSharedValue(0);
    useEffect(() => {
        t.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.linear }), -1, false);
    }, []);
    const dot = (i) => useAnimatedStyle(() => {
        const phase = (t.value * 3 - i + 3) % 3;
        return { opacity: phase < 1 ? 1 : 0.3, transform: [{ translateY: phase < 1 ? -3 : 0 }] };
    });
    const s0 = dot(0), s1 = dot(1), s2 = dot(2);
    return (
        <View style={{ flexDirection: 'row', gap: 4, marginLeft: 6 }}>
            {[s0, s1, s2].map((s, i) => <Animated.View key={i} style={[styles.dot, s]} />)}
        </View>
    );
}

export default function LobbyScreen({ route, navigation }) {
    const { roomId, playerName, isHost, initialRoom } = route.params;
    const [room, setRoom] = useState(initialRoom || null);
    const { profile } = useAccount();
    const fr = useFriends();
    const { wide } = useMenuLayout(); // grand écran : invitation et réglages à gauche, joueurs à droite
    const [inviteSheet, setInviteSheet] = useState(false);
    const [invited, setInvited] = useState({}); // id de l'ami -> 'ok' | 'off' | message
    const inviteFriend = async (f) => {
        const r = await friendsService.invite(roomId, f.id);
        audioService.playSound(r.success ? 'pop' : 'error');
        setInvited((m) => ({ ...m, [f.id]: r.success ? (r.delivered ? 'ok' : 'off') : (r.message || t('Erreur')) }));
    };
    const [picked, setPicked] = useState(null); // place choisie par l'hôte pour un échange
    const [busy, setBusy] = useState(false);
    const prevCount = useRef(initialRoom?.activePlayers?.length || 0);

    useEffect(() => {
        const unsubs = [
            socketService.onRoomUpdated((updatedRoom) => {
                if (updatedRoom.id !== roomId) return;
                const count = updatedRoom.activePlayers.length + updatedRoom.spectators.length;
                if (count > prevCount.current) audioService.playSound('player_out');
                else if (count < prevCount.current) audioService.playSound('pop');
                prevCount.current = count;
                setRoom(updatedRoom);
            }),
            socketService.onGameStarted((gameState) => {
                const amHost = isHost || gameState?.players?.[0]?.id === socketService.socket?.id;
                navigation.replace('Game', { roomId, playerName, initialGameState: gameState, isHost: amHost });
            }),
            // Spectateur resté sur le salon alors que la partie tourne : on l'emmène voir la table
            socketService.onGameStateUpdate((gameState) => {
                if (!gameState?.players || gameState.mancheTerminee || gameState.gameOver) return;
                if (gameState.players.some((p) => p.id === socketService.socket?.id)) return;
                navigation.replace('Game', { roomId, playerName, initialGameState: gameState, isHost: false });
            }),
            socketService.onGameError((error) => {
                audioService.playSound('error');
                dialog.alert(t('Oups'), error.message);
            }),
        ];
        return () => unsubs.forEach((u) => u && u());
    }, []);

    const amHost = isHost || (room && room.hostId === socketService.socket?.id);

    const handleStartGame = () => {
        enterFullscreen((room?.gameType || initialRoom?.gameType) === 'ronda' ? 'landscape' : 'any');
        if (!amHost) { dialog.alert(t('Action non permise'), t("Seul l'hôte du salon peut démarrer la partie.")); return; }
        if (fillBots === 0) { socketService.startGame(roomId); return; }
        // Pas assez de joueurs (ex. Ronda à 3) : on complète avec des bots, puis on lance
        setBusy(true);
        const addNext = (left) => {
            if (left === 0) { setBusy(false); socketService.startGame(roomId); return; }
            socketService.addBot(roomId, (r) => {
                if (r && r.success === false) { setBusy(false); if (r.message) dialog.alert(t('Oups'), r.message); return; }
                addNext(left - 1);
            });
        };
        addNext(fillBots);
    };

    const [copied, setCopied] = useState(false);
    const copyLink = async () => {
        const ok = await copyInvite(roomId);
        if (ok) { setCopied(true); audioService.playSound('pop'); setTimeout(() => setCopied(false), 2500); }
        else dialog.alert(t('Copie impossible'), `Copie ce lien à la main :
${inviteUrl(roomId)}`);
    };
    const shareLink = async () => {
        const r = await shareInvite(roomId, gameInfo(room?.gameType || initialRoom?.gameType).label);
        if (r === 'copied') { setCopied(true); setTimeout(() => setCopied(false), 2500); }
        else if (r === 'failed') dialog.alert(t('Partage impossible'), `Envoie ce lien à tes amis :
${inviteUrl(roomId)}`);
    };

    const handleLeave = () => {
        dialog.alert(t('Quitter le salon ?'), '', [
            { text: t('Rester'), style: 'cancel' },
            {
                text: t('Quitter'),
                style: 'destructive',
                onPress: () => {
                    socketService.leaveRoom(roomId);
                    navigation.popToTop();
                },
            },
        ]);
    };

    const players = room?.activePlayers || [];
    const spectators = room?.spectators || [];
    const game = gameInfo(room?.gameType || initialRoom?.gameType);
    const MAX_PLAYERS = room?.maxPlayers || game.maxPlayers;
    const emptySeats = Math.max(0, MAX_PLAYERS - players.length);
    const gameType = room?.gameType || initialRoom?.gameType;
    const lobbyBots = amHost && !room?.inGame && socketService.supports('lobby_bots');
    // Bots à ajouter automatiquement au lancement si le nombre de joueurs ne suffit pas (ex. Ronda à 3 → +1 bot)
    let fillBots = 0;
    if (lobbyBots && players.length >= 2 && !game.canStart(players.length)) {
        for (let k = 1; players.length + k <= MAX_PLAYERS; k++) {
            if (game.canStart(players.length + k)) { fillBots = k; break; }
        }
    }
    const canStart = game.canStart(players.length) || fillBots > 0;
    const teams = gameType === 'ronda' && players.length >= 3; // Ronda à 4 : places 1+3 contre 2+4
    const TEAM_COLORS = ['#60A5FA', '#F87171'];
    // En Ronda, on affiche les joueurs regroupés par équipe
    const ordered = teams
        ? players.map((p, i) => ({ p, i })).sort((x, y) => (x.i % 2) - (y.i % 2) || x.i - y.i)
        : players.map((p, i) => ({ p, i }));

    const ack = (msg) => (r) => { setBusy(false); if (r && r.success === false && r.message) dialog.alert(t('Oups'), r.message); else if (msg) audioService.playSound(msg); };
    const addBot = () => { setBusy(true); socketService.addBot(roomId, ack('pop')); };

    // Partie à mise (option) : l'hôte choisit la mise, chacun choisit de miser ou non
    const account = useAccount();
    const myId = socketService.socket?.id;
    const stake = room?.stake || 0;
    const stakeIn = new Set(room?.stakeIn || []);
    const balance = account.profile?.binga?.balance ?? 0;
    const showStakes = socketService.supports('stakes') && room?.isPrivate !== false;
    const setStake = (v) => { if (v === stake || busy) return; setBusy(true); socketService.setStake(roomId, v, ack('coin')); };
    const toggleStake = () => { setBusy(true); socketService.stakeOpt(roomId, !stakeIn.has(myId), ack('coin')); };
    const lobbyGames = lobbyBots && socketService.supports('lobby_games') && room?.isPrivate !== false;
    const pickGame = (key) => {
        if (key === gameType || busy) return;
        setBusy(true);
        setPicked(null);
        socketService.changeGame(roomId, key, (r) => {
            setBusy(false);
            if (r && r.success === false) { if (r.message) dialog.alert(t('Oups'), r.message); return; }
            if (r?.roomData) setRoom(r.roomData);
            audioService.playSound('card_flip');
        });
    };
    const removeBot = (id) => { setPicked(null); socketService.removeBot(roomId, id, ack()); };
    const pickSeat = (id) => {
        if (!lobbyBots) return;
        if (!picked) { setPicked(id); audioService.playSound('pop', { volume: 0.4 }); return; }
        if (picked === id) { setPicked(null); return; }
        socketService.swapSeats(roomId, picked, id, ack('card_flip'));
        setPicked(null);
    };

    return (
        <MenuShell navigation={navigation} title={t("Salon privé · {p0}", { p0: game.label })} onBack={handleLeave} sideNav={false}>
            <Modal visible={inviteSheet} transparent animationType="fade" onRequestClose={() => setInviteSheet(false)}>
                <Pressable style={styles.sheetBg} onPress={() => setInviteSheet(false)}>
                    <Pressable onPress={() => {}} style={styles.sheet}>
                        <Text style={styles.sheetTitle}>{t("Inviter un ami")}</Text>
                        {fr.friends.length === 0 ? (
                            <Text style={styles.sheetDim}>{t("Pas encore d'amis. Ajoute-les dans « Amis » avec leur pseudo.")}</Text>
                        ) : fr.friends.map((f) => {
                            const st = invited[f.id];
                            return (
                                <View key={f.id} style={styles.sheetRow}>
                                    <PlayerAvatar name={f.name} variant={f.avatar || 0} size={38} />
                                    <View style={{ flex: 1, marginLeft: 10 }}>
                                        <Text style={styles.sheetName} numberOfLines={1}>{f.name}</Text>
                                        <Text style={[styles.sheetDim, { textAlign: 'left' }]}>{st === 'ok' ? t('✓ Invitation envoyée') : st === 'off' ? t('Pas connecté en ce moment') : st || (f.online ? t('🟢 en ligne') : t('hors ligne'))}</Text>
                                    </View>
                                    <GameButton small title={st === 'ok' ? t('Renvoyer') : t('Inviter')} variant={f.online ? 'gold' : 'outline'} disabled={!f.online} onPress={() => inviteFriend(f)} />
                                </View>
                            );
                        })}
                        <GameButton small title={t("Fermer")} variant="outline" onPress={() => setInviteSheet(false)} style={{ alignSelf: 'center', marginTop: 12 }} />
                    </Pressable>
                </Pressable>
            </Modal>

            <ScrollView contentContainerStyle={[styles.scroll, wide && { maxWidth: 1100, paddingTop: 6 }]} showsVerticalScrollIndicator={false}>
                <Cols flex={[1, 1.1]} gap={0} style={{ columnGap: 16 }}>
                {/* Gauche (grand écran) : invitation, jeu du salon, mise */}
                <>
                <Animated.View entering={ZoomIn.springify().damping(13)} style={styles.codeBox}>
                    <Text style={styles.codeLabel}>{t("INVITE TES AMIS")}</Text>
                    {profile && (
                        <View style={styles.inviteBtns}>
                            <GameButton small title={fr.friends.some((f) => f.online) ? t('Inviter un ami · {n} en ligne', { n: fr.friends.filter((f) => f.online).length }) : t('Inviter un ami')} icon="🤝" variant="green" onPress={() => { friendsService.refresh(); setInviteSheet(true); }} style={{ flex: 1 }} />
                        </View>
                    )}
                    {inDiscord ? (
                        <>
                            <View style={styles.inviteBtns}>
                                <GameButton small title={t("Inviter sur Discord")} icon="🎧" variant="gold" onPress={discordInvite} style={{ flex: 1 }} />
                            </View>
                            <Text style={styles.codeHint}>{t("Tes amis qui lancent L'Carta dans ce salon vocal arrivent directement ici. Les joueurs en plus regardent en spectateurs.")}</Text>
                        </>
                    ) : (
                        <>
                            <Text style={styles.link} selectable numberOfLines={1}>{inviteUrl(roomId).replace(/^https?:\/\//, '')}</Text>
                            <View style={styles.inviteBtns}>
                                <GameButton small title={copied ? t('Lien copié ✓') : t('Copier le lien')} icon="📋" variant="outline" onPress={copyLink} style={{ flex: 1 }} />
                                <GameButton small title={t("Partager")} icon="📤" variant="gold" onPress={shareLink} style={{ flex: 1 }} />
                            </View>
                            <Text style={styles.codeHint}>{t("Envoie le lien sur WhatsApp ou par SMS : un clic et ton ami est dans le salon. Les joueurs en plus regardent en spectateurs.")}</Text>
                        </>
                    )}
                </Animated.View>

                {lobbyGames && (
                    <View style={[styles.panel, { marginBottom: 14 }]}>
                        <Text style={styles.sectionTitle}>{t("JEU DU SALON")}</Text>
                        <View style={styles.gameChips}>
                            {GAME_ORDER.filter((k) => socketService.supportsGame(k)).map((k) => {
                                const g = GAMES[k];
                                const on = k === gameType;
                                return (
                                    <Pressable
                                        key={k}
                                        onPress={() => pickGame(k)}
                                        disabled={busy}
                                        style={[styles.gameChip, on && { backgroundColor: g.color, borderColor: theme.goldLight }]}
                                    >
                                        <Text style={[styles.gameChipText, on && { color: '#fff' }]}>{g.label}</Text>
                                        <Text style={[styles.gameChipSub, on && { color: 'rgba(255,255,255,0.85)' }]}>{t(g.players)}</Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>
                )}

                {showStakes && (amHost || stake > 0) && (
                    <View style={[styles.panel, { marginBottom: 14 }]}>
                        <Text style={styles.sectionTitle}>{t("MISE EN BINGA (OPTION)")}</Text>
                        {amHost ? (
                            <View style={styles.gameChips}>
                                {[0, ...BINGA.stakes].map((v) => (
                                    <Pressable key={v} onPress={() => setStake(v)} disabled={busy || room?.inGame} style={[styles.gameChip, styles.stakeChip, v === stake && { backgroundColor: theme.goldDark, borderColor: theme.goldLight }]}>
                                        {v ? <Chip name={STAKE_CHIP[v]} size={26} /> : null}
                                        <Text style={[styles.gameChipText, v === stake && { color: '#fff' }]}>{v ? `${v}` : t('Gratuit')}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        ) : (
                            <View style={styles.stakeChip}>
                                <Chip name={STAKE_CHIP[stake]} size={34} />
                                <Text style={styles.stakeBig}>{stake} {t("binga par joueur")}</Text>
                            </View>
                        )}
                        <Text style={styles.stakeHint}>
                            {stake === 0
                                ? t("Partie gratuite. Choisis une mise si vous voulez jouer pour des binga : chacun décide s'il mise.")
                                : t("Chaque joueur qui mise paie {p0} binga au début de la partie. Le gagnant prend le pot. Personne n'est obligé : sans miser, on joue gratuitement.", { p0: stake })}
                        </Text>
                        {stake > 0 && (
                            !account.profile ? (
                                <Text style={styles.stakeHint}>{t("🔐 Sans compte, tu joues gratuitement.")}</Text>
                            ) : (
                                <View style={styles.stakeRow}>
                                    <GameButton
                                        small
                                        title={stakeIn.has(myId) ? t("✓ Je mise {p0} binga", { p0: stake }) : t("Miser {p0} binga", { p0: stake })}
                                        variant={stakeIn.has(myId) ? 'gold' : 'outline'}
                                        onPress={toggleStake}
                                        disabled={busy || room?.inGame}
                                    />
                                    <Text style={[styles.stakeHint, { flex: 1 }]}>
                                        {balance < stake ? t("Ton solde ({p0}) ne suffit pas : tu joueras gratuitement.", { p0: balance }) : t("Ton solde : {p0} binga.{p1}", { p0: balance, p1: stakeIn.has(myId) ? t(' Touche pour jouer sans miser.') : '' })}
                                    </Text>
                                </View>
                            )
                        )}
                    </View>
                )}

                </>
                {/* Droite (grand écran) : joueurs et spectateurs */}
                <View style={styles.panel}>
                    <Text style={styles.sectionTitle}>{t("JOUEURS ·")} {players.length}/{MAX_PLAYERS}</Text>
                    {lobbyBots && players.length >= 2 && (
                        <Text style={styles.swapHint}>
                            {teams ? t('Équipes : touche deux joueurs pour échanger leurs places') : t('Touche deux joueurs pour échanger leurs places')}
                        </Text>
                    )}
                    {ordered.map(({ p: item, i: seat }, i) => (
                        <Animated.View
                            key={item.id}
                            entering={FadeInDown.delay(i * 60).springify().damping(15)}
                            exiting={FadeOut}
                            layout={LinearTransition.springify()}
                        >
                        <Pressable
                            onPress={() => pickSeat(item.id)}
                            disabled={!lobbyBots}
                            style={[
                                styles.playerRow,
                                item.id === socketService.socket?.id && styles.playerRowMe,
                                teams && { borderLeftWidth: 4, borderLeftColor: TEAM_COLORS[seat % 2] },
                                picked === item.id && styles.playerRowPicked,
                            ]}
                        >
                            <PlayerAvatar name={item.name} variant={item.avatar || 0} size={38} />
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.playerName, { flex: 0 }, item.id === room?.hostId && { color: theme.goldLight }]} numberOfLines={1}>
                                    {item.name}{item.id === socketService.socket?.id ? ' (vous)' : ''}
                                </Text>
                                {item.title ? <Text style={{ color: theme.mint, fontSize: 11, fontStyle: 'italic', marginLeft: 10 }} numberOfLines={1}>« {item.title} »</Text> : null}
                            </View>
                            {teams && <Text style={[styles.teamChip, { color: TEAM_COLORS[seat % 2], borderColor: TEAM_COLORS[seat % 2] }]}>{t("ÉQ.")} {seat % 2 + 1}</Text>}
                            {stake > 0 && stakeIn.has(item.id) && <Text style={styles.badge}>💰 {stake}</Text>}
                            {item.isBot ? (
                                <Text style={styles.badge}>{t("🤖 BOT")}</Text>
                            ) : item.id === room?.hostId ? (
                                <Text style={styles.badge}>{t("👑 HÔTE")}</Text>
                            ) : null}
                            {item.isBot && lobbyBots && (
                                <Pressable onPress={() => removeBot(item.id)} hitSlop={8} style={styles.removeBot}>
                                    <Text style={styles.removeBotText}>✕</Text>
                                </Pressable>
                            )}
                        </Pressable>
                        </Animated.View>
                    ))}
                    {lobbyBots && emptySeats > 0 && (
                        <Pressable onPress={addBot} disabled={busy} style={[styles.addBot, busy && { opacity: 0.5 }]}>
                            <Text style={styles.addBotText}>{t("🤖 ＋ Ajouter un bot")}</Text>
                        </Pressable>
                    )}
                    {Array.from({ length: emptySeats }).map((_, i) => (
                        <View key={`empty-${i}`} style={styles.emptySeat}>
                            <View style={styles.emptyAvatar}><Text style={{ color: theme.textDim }}>?</Text></View>
                            <Text style={styles.emptyText}>{t("En attente")}</Text>
                            <WaitingDots />
                        </View>
                    ))}

                    {spectators.length > 0 && (
                        <>
                            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>{t("SPECTATEURS ·")} {spectators.length}</Text>
                            {spectators.map((item) => (
                                <Animated.View key={item.id} entering={FadeInDown.springify()} style={styles.spectatorRow}>
                                    <PlayerAvatar name={item.name} variant={item.avatar || 0} size={28} />
                                    <Text style={styles.spectatorName}>{item.name}</Text>
                                    <Text>👁️</Text>
                                </Animated.View>
                            ))}
                        </>
                    )}
                </View>
                </Cols>
            </ScrollView>

            <View style={[styles.footer, wide && { width: '100%', maxWidth: 560, alignSelf: 'center' }]}>
                {amHost ? (
                    <GameButton
                        title={!canStart ? game.startHint.toUpperCase()
                            : fillBots > 0 ? t("DÉMARRER · +{p0} BOT{p1} 🤖", { p0: fillBots, p1: fillBots > 1 ? 'S' : '' })
                            : t("DÉMARRER · {p0}", { p0: game.label.toUpperCase() })}
                        icon="🃏"
                        variant="gold"
                        onPress={handleStartGame}
                        disabled={!canStart || busy}
                    />
                ) : (
                    <View style={styles.waitingBox}>
                        <Text style={styles.waitingText}>
                            {room?.inGame
                                ? t('Partie en cours, tu joueras à la prochaine manche')
                                : t("En attente du lancement par l'hôte")}
                        </Text>
                        <WaitingDots />
                    </View>
                )}
            </View>
        </MenuShell>
    );
}

const styles = StyleSheet.create({
    sheetBg: { flex: 1, backgroundColor: 'rgba(4,8,18,0.82)', justifyContent: 'center', alignItems: 'center', padding: 16 },
    sheet: { width: '100%', maxWidth: 420, maxHeight: '80%', backgroundColor: theme.panelSolid, borderRadius: 20, borderWidth: 1.5, borderColor: theme.gold, padding: 16 },
    sheetTitle: { color: theme.goldLight, fontWeight: '900', fontSize: 18, textAlign: 'center', marginBottom: 8 },
    sheetDim: { color: theme.textDim, fontWeight: '700', fontSize: 11, textAlign: 'center' },
    sheetRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(232,184,74,0.15)' },
    sheetName: { color: theme.cream, fontWeight: '900', fontSize: 14 },
    container: { flex: 1, backgroundColor: theme.bg },
    dim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,12,28,0.55)' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
    },
    headerTitle: {
        color: theme.goldLight,
        fontSize: 20,
        fontWeight: '900',
        letterSpacing: 1,
    },
    scroll: {
        padding: 16,
        paddingBottom: 30,
    },
    codeBox: {
        alignItems: 'center',
        backgroundColor: theme.panel,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: theme.gold,
        paddingVertical: 16,
        marginBottom: 14,
    },
    codeLabel: {
        color: theme.textDim,
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 2,
    },
    code: {
        color: theme.goldLight,
        fontSize: 42,
        fontWeight: '900',
        letterSpacing: 10,
        textShadowColor: 'rgba(212,175,55,0.6)',
        textShadowRadius: 14,
    },
    link: { color: theme.goldLight, fontSize: 15, fontWeight: '800', marginTop: 6, marginBottom: 10, paddingHorizontal: 12 },
    inviteBtns: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, alignSelf: 'stretch', marginBottom: 10 },
    codeHint: {
        color: theme.text,
        fontSize: 12,
        textAlign: 'center',
        paddingHorizontal: 16,
    },
    stakeChip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    stakeBig: { color: theme.goldLight, fontWeight: '900', fontSize: 18, marginVertical: 4 },
    stakeHint: { color: theme.textDim, fontSize: 12, marginTop: 6 },
    stakeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
    panel: {
        backgroundColor: theme.panel,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: 'rgba(212,175,55,0.6)',
        padding: 14,
    },
    sectionTitle: {
        color: theme.gold,
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 2,
        marginBottom: 10,
    },
    playerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: 'rgba(0,0,0,0.35)',
        padding: 10,
        borderRadius: 14,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.2)',
    },
    playerRowPicked: {
        borderColor: theme.mint,
        borderWidth: 2,
        backgroundColor: 'rgba(52,211,153,0.15)',
    },
    gameChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    gameChip: {
        flexGrow: 1,
        flexBasis: '45%',
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: 'rgba(212,175,55,0.35)',
        backgroundColor: 'rgba(0,0,0,0.25)',
        alignItems: 'center',
    },
    gameChipText: { color: theme.gold, fontWeight: '900', fontSize: 14 },
    gameChipSub: { color: theme.textDim, fontSize: 10, marginTop: 2 },
    swapHint: {
        color: theme.textDim,
        fontSize: 11,
        fontStyle: 'italic',
        marginTop: -4,
        marginBottom: 8,
    },
    teamChip: {
        fontSize: 10,
        fontWeight: '900',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 6,
        paddingVertical: 2,
        overflow: 'hidden',
    },
    removeBot: {
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(185,28,28,0.6)',
    },
    removeBotText: {
        color: '#fff',
        fontWeight: '900',
    },
    addBot: {
        alignItems: 'center',
        paddingVertical: 12,
        borderRadius: 14,
        marginBottom: 8,
        borderWidth: 1.5,
        borderColor: theme.gold,
        backgroundColor: 'rgba(212,175,55,0.15)',
    },
    addBotText: {
        color: theme.goldLight,
        fontWeight: '900',
    },
    playerRowMe: {
        borderColor: theme.gold,
        backgroundColor: 'rgba(212,175,55,0.12)',
    },
    playerName: {
        flex: 1,
        color: theme.cream,
        fontSize: 16,
        fontWeight: '800',
    },
    badge: {
        color: theme.goldLight,
        fontWeight: '900',
        fontSize: 11,
        letterSpacing: 1,
        backgroundColor: 'rgba(212,175,55,0.15)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
        overflow: 'hidden',
    },
    emptySeat: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 10,
        borderRadius: 14,
        marginBottom: 8,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: 'rgba(212,175,55,0.3)',
    },
    emptyAvatar: {
        width: 38,
        height: 38,
        borderRadius: 19,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: theme.textDim,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        color: theme.textDim,
        fontStyle: 'italic',
    },
    dot: {
        width: 5,
        height: 5,
        borderRadius: 3,
        backgroundColor: theme.gold,
    },
    spectatorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 8,
        borderRadius: 12,
        marginBottom: 6,
        backgroundColor: 'rgba(0,0,0,0.25)',
    },
    spectatorName: {
        flex: 1,
        color: theme.text,
        fontStyle: 'italic',
    },
    footer: {
        padding: 16,
        paddingBottom: 22,
    },
    waitingBox: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 14,
        borderRadius: 14,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    waitingText: {
        color: theme.goldLight,
        fontStyle: 'italic',
        fontWeight: '700',
    },
});
