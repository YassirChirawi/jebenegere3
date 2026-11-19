import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, Image, ImageBackground, ScrollView, Platform } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    Easing,
    FadeIn,
    FadeInDown,
    FadeInUp,
    ZoomIn,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import socketService from '../network/socketService';
import audioService from '../network/audioService';
import RulesModal from '../components/RulesModal';
import InstallAppButton from '../components/InstallAppButton';
import InviteJoinSheet from '../components/InviteJoinSheet';
import { initialInvite, clearInviteFromUrl, onInviteLink, initialTournament, onTournamentLink } from '../utils/invite';
import { remember as rememberTournament, claimPendingRewards, GAME_LABEL } from '../utils/tournaments';
import { enterFullscreen } from '../utils/fullscreen';
import PlayerAvatar from '../components/PlayerAvatar';
import { CardFace, CardBack } from '../components/Card';
import { GameButton, IconButton, PressableScale, OrnamentDivider, theme } from '../components/ui';
import { dialog } from '../components/Dialog';
import { getRankInfo } from '../utils/stats';
import accountService, { useAccount } from '../network/accountService';
import { GAMES, GAME_ORDER, gameInfo } from '../games';

const BG = require('../../assets/Yellow and White Illustrative Ramadan Greeting Instagram Post.png');
const LOGO = require('../../assets/brand/logo.webp');

// Mode test (web) : ajouter ?test=1 à l'adresse pour démarrer les parties Hezz2 contre l'IA avec des 1, 2 et 7
// ?test=1 : 1, 2 et 7 en main ; ?test=big : la main commence avec 20 cartes (vérification de l'éventail)
const TEST_PARAM = Platform.OS === 'web' && typeof window !== 'undefined' ? ((window.location?.search || '').match(/[?&]test=(1|big)(&|$)/) || [])[1] : null;
const TEST_MODE = TEST_PARAM ? (TEST_PARAM === 'big' ? 'big' : 'specials') : null;

// Écran d'attente du serveur (Render peut mettre ~30s à se réveiller)
function ServerLoader() {
    const spin = useSharedValue(0);
    useEffect(() => {
        spin.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.cubic) }), -1, false);
    }, []);
    const style = useAnimatedStyle(() => ({
        transform: [{ perspective: 600 }, { rotateY: `${spin.value * 360}deg` }],
    }));
    return (
        <Animated.View entering={FadeIn} style={styles.loaderBox}>
            <Animated.View style={style}>
                <CardBack width={70} height={100} />
            </Animated.View>
            <Text style={styles.loaderTitle}>Réveil du serveur…</Text>
            <Text style={styles.loaderSubtitle}>La première connexion peut prendre jusqu'à 30 secondes</Text>
        </Animated.View>
    );
}

export default function HomeScreen({ navigation }) {
    const [name, setName] = useState('');
    const [nameReady, setNameReady] = useState(false); // pseudo enregistré relu
    // Invitation : code reçu par un lien, fenêtre « rejoindre » (pseudo / lien collé)
    const [inviteCode, setInviteCode] = useState(null);
    const [showInvite, setShowInvite] = useState(false);
    const [joining, setJoining] = useState(false);
    const [lastChampion, setLastChampion] = useState(null); // palmarès : dernier tournoi gagné
    const [showRules, setShowRules] = useState(false);
    const [menu, setMenu] = useState(null); // 'online' | 'bot' | null
    const [game, setGame] = useState('hezz2');
    const selected = gameInfo(game);
    const [isMuted, setIsMuted] = useState(audioService.muted);
    const [musicOn, setMusicOn] = useState(audioService.musicOn);
    const [isConnected, setIsConnected] = useState(false);
    const [wakeSeconds, setWakeSeconds] = useState(0);
    const [hasConnected, setHasConnected] = useState(false);
    const [rankInfo, setRankInfo] = useState(null);
    const account = useAccount();
    const profile = account.profile;
    // Connecté : le pseudo est celui du compte
    useEffect(() => { if (profile?.name) setName(profile.name); }, [profile?.name]);
    useEffect(() => { if (profile) setRankInfo(getRankInfo(profile.xp)); }, [profile?.xp]);

    // Matchmaking
    const [isSearching, setIsSearching] = useState(false);
    const [searchingSize, setSearchingSize] = useState(null);
    const [searchSeconds, setSearchSeconds] = useState(0);
    const [searchStatus, setSearchStatus] = useState(null); // null | 'found' | 'bots'
    const [serverInfo, setServerInfo] = useState(socketService.serverInfo);
    const [online, setOnline] = useState(socketService.onlineStats || null);
    const [outdated, setOutdated] = useState(false);
    const matchUnsub = useRef(null);
    const searchTimer = useRef(null);

    // Titre qui flotte
    const float = useSharedValue(0);
    const titleStyle = useAnimatedStyle(() => ({ transform: [{ translateY: float.value * -4 }] }));

    useEffect(() => {
        float.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }), -1, true);

        socketService.connect();
        const offConnect = socketService.onConnect(() => {
            setIsConnected(true);
            setHasConnected(true);
        });
        const offDisconnect = socketService.onDisconnect(() => setIsConnected(false));
        const offOnline = socketService.onOnlineStats(setOnline);
        const offInfo = socketService.onServerInfo((info) => {
            setServerInfo(info);
            setOutdated(false);
        });
        const offAudio = audioService.subscribe(({ muted, musicOn: m }) => {
            setIsMuted(muted);
            setMusicOn(m);
        });

        (async () => {
            try {
                const savedName = await AsyncStorage.getItem('playerName');
                if (savedName) setName(savedName);
                const savedGame = await AsyncStorage.getItem('selectedGame');
                if (savedGame && GAMES[savedGame]?.available) setGame(savedGame);
                const seen = await AsyncStorage.getItem('rulesSeen');
                if (!seen) setShowRules(true);
            } catch (e) { /* ignore */ }
            setNameReady(true);
            // Ouvert depuis un lien d'invitation (…/salon/CODE)
            const code = await initialInvite();
            if (code) { setInviteCode(code); clearInviteFromUrl(); }
            // … ou d'un lien d'inscription à un tournoi (…/tournoi/CODE)
            const tid = await initialTournament();
            if (tid) { clearInviteFromUrl(); setShowRules(false); navigation.navigate('Tournament', { id: tid }); }
        })();
        const offLink = onInviteLink((code) => setInviteCode(code));
        const offTLink = onTournamentLink((tid) => navigation.navigate('Tournament', { id: tid }));
        // Tournoi gagné sans compte : la récompense sera réclamée dès la connexion à un compte
        const offWon = socketService.onTournamentWon((d) => rememberTournament(d.id, { won: true, pendingClaim: !!d.needsAccount }));
        const offAuthed = socketService.onAuthed(() => claimPendingRewards());

        return () => {
            offLink();
            offTLink();
            offWon();
            offAuthed && offAuthed();
            offConnect();
            offDisconnect();
            offInfo();
            offOnline();
            offAudio();
            stopSearchUi();
        };
    }, []);

    // Palmarès : dernier champion de tournoi, affiché sous le bouton Tournois
    useEffect(() => {
        if (!isConnected || !serverInfo?.features?.includes('tournaments')) return;
        socketService.tournamentPalmares((r) => setLastChampion(r?.success && r.list.length ? r.list[0] : null));
    }, [isConnected, serverInfo]);

    // Pendant le réveil du serveur gratuit (Render), on affiche le temps écoulé : l'accueil reste utilisable
    useEffect(() => {
        if (isConnected) { setWakeSeconds(0); return; }
        const t = setInterval(() => setWakeSeconds((x) => x + 1), 1000);
        return () => clearInterval(t);
    }, [isConnected]);

    // Serveur connecté mais muet sur sa version : c'est une ancienne version (pas de matchmaking, etc.)
    useEffect(() => {
        if (!isConnected || serverInfo) return;
        const t = setTimeout(() => { if (!socketService.serverInfo) setOutdated(true); }, 4000);
        return () => clearTimeout(t);
    }, [isConnected, serverInfo]);

    // Recharger l'XP à chaque retour sur l'accueil (après une partie)
    useEffect(() => {
        const loadXp = async () => {
            try {
                const xp = parseInt((await AsyncStorage.getItem('playerXP')) || '0', 10);
                setRankInfo(getRankInfo(xp));
            } catch (e) { /* ignore */ }
        };
        loadXp();
        return navigation.addListener('focus', () => { loadXp(); accountService.refresh(); });
    }, [navigation]);

    const requireName = () => {
        if (!name.trim()) {
            audioService.playSound('error');
            dialog.alert('Pseudo manquant', 'Entre un pseudo avant de jouer.');
            return false;
        }
        AsyncStorage.setItem('playerName', name.trim()).catch(() => {});
        return true;
    };

    // Un serveur ancien ignore le type de jeu et lance du Hezz2 : on bloque avant, avec un message clair
    const requireGameSupport = () => {
        if (socketService.supportsGame(game)) return true;
        audioService.playSound('error');
        dialog.alert(
            'Serveur pas à jour',
            `Le serveur en ligne ne connaît pas encore ${selected.label} : il lancerait une partie de Hezz2 à la place. Il faut redéployer le serveur (Render).`
        );
        return false;
    };

    const handleCreateRoom = () => {
        if (!requireName() || !requireGameSupport()) return;
        enterFullscreen();
        socketService.createRoom(name.trim(), game, (response) => {
            if (response?.success) {
                navigation.navigate('Lobby', { roomId: response.roomId, playerName: name.trim(), isHost: true, initialRoom: response.roomData });
            } else {
                dialog.alert('Erreur', response?.message || 'Impossible de créer le salon.');
            }
        });
    };

    // Rejoindre un salon par son code (venu d'un lien d'invitation ou d'un ancien code collé)
    const joinByCode = (roomCode, playerName = name.trim()) => {
        if (!playerName) { setShowInvite(true); return; }
        setName(playerName);
        AsyncStorage.setItem('playerName', playerName).catch(() => {});
        enterFullscreen();
        setJoining(true);
        socketService.joinRoom(roomCode, playerName, (response) => {
            setJoining(false);
            if (response?.success) {
                setShowInvite(false);
                setInviteCode(null);
                setShowRules(false); // pas de fenêtre des règles par-dessus la partie rejointe (📜 en jeu)
                const roomId = response.roomId || roomCode;
                if (response.gameState) {
                    // Partie déjà commencée : on la regarde en spectateur
                    navigation.navigate('Game', { roomId, playerName, initialGameState: response.gameState, isHost: false });
                } else {
                    navigation.navigate('Lobby', { roomId, playerName, isHost: false, initialRoom: response.roomData });
                }
            } else {
                audioService.playSound('error');
                setInviteCode(null);
                setShowInvite(false);
                dialog.alert('Impossible de rejoindre', response?.message === 'Salon introuvable'
                    ? "Ce salon n'existe plus (la partie est peut-être terminée). Demande un nouveau lien à ton ami."
                    : response?.message || 'Salon introuvable.');
            }
        });
    };

    // Arrivée par un lien : on rejoint dès que le serveur est joignable (pseudo demandé s'il manque)
    useEffect(() => {
        if (!inviteCode || !nameReady || !isConnected || joining) return;
        if (name.trim()) joinByCode(inviteCode);
        else setShowInvite(true);
    }, [inviteCode, nameReady, isConnected]);

    const handleCreateBotRoom = (count) => {
        if (!requireName() || !requireGameSupport()) return;
        enterFullscreen(game === 'ronda' ? 'landscape' : 'any');
        socketService.createBotRoom(name.trim(), count, game, (response) => {
            if (response?.success) {
                setMenu(null);
                navigation.navigate('Game', { roomId: response.roomId, playerName: name.trim(), initialGameState: response.gameState, isHost: true });
            } else {
                dialog.alert('Erreur', response?.message || "Impossible de créer la partie contre l'ordinateur.");
            }
        }, TEST_MODE && game === 'hezz2' ? { debugHand: TEST_MODE } : {});
    };

    const stopSearchUi = () => {
        if (matchUnsub.current) matchUnsub.current();
        matchUnsub.current = null;
        clearInterval(searchTimer.current);
    };

    const handleSearchMatch = (size) => {
        if (!requireName() || !requireGameSupport()) return;
        enterFullscreen(game === 'ronda' ? 'landscape' : 'any');
        setIsSearching(true);
        setSearchingSize(size);
        setSearchSeconds(0);
        setMenu(null);
        clearInterval(searchTimer.current);
        searchTimer.current = setInterval(() => setSearchSeconds((s) => s + 1), 1000);

        if (matchUnsub.current) matchUnsub.current();
        matchUnsub.current = socketService.onMatchFound((data) => {
            stopSearchUi();
            setSearchStatus('found');
            audioService.playSound('your_turn');
            // On laisse voir "Adversaires trouvés" un instant avant d'ouvrir la table
            setTimeout(() => {
                setIsSearching(false);
                setSearchStatus(null);
                navigation.navigate('Game', {
                    roomId: data.roomId,
                    playerName: name.trim(),
                    initialGameState: data.gameState,
                    isHost: data.roomData?.hostId === socketService.socket?.id,
                });
            }, 1100);
        });

        socketService.findMatch(name.trim(), size, game, (res) => {
            if (res && !res.success) {
                stopSearchUi();
                setIsSearching(false);
                if (res.timeout) setOutdated(true);
                dialog.alert('Matchmaking indisponible', res.message);
            }
        });
    };

    const handleCancelSearch = () => {
        socketService.cancelMatch();
        stopSearchUi();
        setIsSearching(false);
        setSearchingSize(null);
        setSearchStatus(null);
    };

    const closeRules = () => {
        setShowRules(false);
        AsyncStorage.setItem('rulesSeen', '1').catch(() => {});
    };

    const toggleMenu = (m) => setMenu((cur) => (cur === m ? null : m));

    // Joueurs qui cherchent une partie de ce jeu et de cette taille en ce moment
    const searchingFor = (n) => online?.searching?.[`${game}:${n}`] || 0;
    const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;

    const SizePicker = ({ onPick, color, showSearching }) => (
        <Animated.View entering={FadeInDown.springify().damping(15)} style={[styles.sizeMenu, { borderColor: color }]}>
            <View style={styles.sizeHeader}>
                <PressableScale onPress={() => setMenu(null)} style={styles.sizeBack} hitSlop={8}>
                    <Text style={styles.sizeBackText}>← Retour</Text>
                </PressableScale>
                <Text style={styles.sizeTitle}>Choisis le nombre de joueurs</Text>
            </View>
            <View style={styles.sizeRow}>
                {selected.sizes.map((n) => (
                    <PressableScale key={n} onPress={() => onPick(n)} style={[styles.sizeBtn, { backgroundColor: color }]}>
                        <Text style={styles.sizeNum}>{game === 'ronda' ? (n === 2 ? '1v1' : '2v2') : n}</Text>
                        <Text style={styles.sizeIcons}>{game === 'ronda' ? selected.sizeLabel(n) : '👤'.repeat(n)}</Text>
                        {showSearching && searchingFor(n) > 0 && (
                            <Text style={styles.sizeSearching} numberOfLines={1} accessibilityLabel={`${searchingFor(n)} en recherche`}>{searchingFor(n)}</Text>
                        )}
                    </PressableScale>
                ))}
            </View>
            {showSearching && selected.sizes.some((n) => searchingFor(n) > 0) && (
                <Text style={styles.sizeLegend}>🟢 = joueurs qui attendent déjà : choisis cette taille pour jouer tout de suite</Text>
            )}
        </Animated.View>
    );

    return (
        <ImageBackground source={BG} style={styles.container} resizeMode="cover">
            <View style={styles.dim} pointerEvents="none" />

            {!hasConnected ? (
                <View style={styles.center}>
                    <ServerLoader />
                </View>
            ) : (
                <ScrollView style={{ width: '100%' }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    {/* En-tête */}
                    <View style={styles.header}>
                        <View style={styles.headerRight}>
                            <IconButton icon="👤" onPress={() => navigation.navigate('Profile')} label="Profil" size={44} />
                            <IconButton icon="🏆" onPress={() => navigation.navigate('Leaderboard')} label="Classement" size={44} />
                        </View>
                        <View style={styles.headerRight}>
                            <IconButton icon={musicOn ? '🎵' : '🎶'} onPress={() => audioService.toggleMusic()} label="Musique" size={44} style={!musicOn && styles.iconOff} />
                            <IconButton icon={isMuted ? '🔇' : '🔊'} onPress={() => audioService.toggleMute()} label="Son" size={44} />
                        </View>
                    </View>

                    {/* Logo */}
                    <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.logo}>
                        <Animated.View style={[{ alignItems: 'center' }, titleStyle]}>
                            <Image source={LOGO} style={styles.logoImage} accessibilityLabel="L'Carta" />
                            <Text style={styles.tagline}>Le jeu de cartes marocain</Text>
                        </Animated.View>
                    </Animated.View>

                    {outdated && isConnected && (
                        <Animated.View entering={FadeIn} style={[styles.reconnect, styles.outdated]}>
                            <Text style={styles.reconnectText}>⚠️ Le serveur en ligne n'est pas à jour : matchmaking, Rejouer et nouveaux jeux indisponibles. Il faut le redéployer.</Text>
                        </Animated.View>
                    )}
                    {TEST_MODE && (
                        <View style={[styles.reconnect, { backgroundColor: 'rgba(124,58,237,0.7)' }]}>
                            <Text style={styles.reconnectText}>{TEST_MODE === 'big' ? "🧪 Mode test : contre l'IA (Hezz2), ta main commence avec 20 cartes" : "🧪 Mode test : contre l'IA (Hezz2), ta main commence avec des 1, 2 et 7"}</Text>
                        </View>
                    )}
                    {!isConnected && (
                        <Animated.View entering={FadeIn} style={styles.reconnect}>
                            <Text style={styles.reconnectText}>
                                {wakeSeconds < 4 ? '⏳ Connexion au serveur…' : `⏳ Le serveur se réveille… ${wakeSeconds} s (jusqu'à 1 min après une pause)`}
                            </Text>
                        </Animated.View>
                    )}

                    <Animated.View entering={FadeInUp.delay(200).springify().damping(16)} style={styles.panel}>
                        {/* Choix du jeu */}
                        <GamePicker
                            value={game}
                            onChange={(g) => {
                                setGame(g);
                                setMenu(null);
                                AsyncStorage.setItem('selectedGame', g).catch(() => {});
                            }}
                        />

                        {/* Pseudo + rang */}
                        <View style={styles.nameRow}>
                            <PlayerAvatar name={name || 'Joueur'} variant={profile ? (profile.avatar || 0) : (account.guestAvatar || 0)} size={52} />
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={styles.label}>{profile ? 'CONNECTÉ · TON COMPTE' : 'TON PSEUDO'}</Text>
                                <TextInput
                                    style={[styles.input, profile && { opacity: 0.8 }]}
                                    placeholder="Ex : Yassir…"
                                    placeholderTextColor={theme.textDim}
                                    value={name}
                                    onChangeText={setName}
                                    editable={!profile}
                                    maxLength={16}
                                />
                            </View>
                        </View>
                        {rankInfo && (
                            <PressableScale onPress={() => navigation.navigate('Profile')} style={styles.rankChip}>
                                <Text style={styles.rankText}>{rankInfo.emoji} {rankInfo.name}</Text>
                                <View style={styles.rankBar}>
                                    <View style={[styles.rankFill, { width: `${Math.round(Math.min(1, rankInfo.levelProgress || 0) * 100)}%` }]} />
                                </View>
                                <Text style={styles.rankXp}>{rankInfo.currentXP} XP</Text>
                            </PressableScale>
                        )}
                        {profile?.binga && (
                            <PressableScale onPress={() => navigation.navigate('Profile')} style={[styles.rankChip, { marginTop: 8 }]}>
                                <Text style={styles.rankText}>💰 {profile.binga.balance.toLocaleString('fr-FR')} binga</Text>
                                <Text style={[styles.rankXp, { flex: 1, textAlign: 'right' }]} numberOfLines={1}>
                                    Missions {profile.binga.missions.filter((m) => m.done).length}/{profile.binga.missions.length}
                                    {profile.binga.login.claimed ? '' : ` · bonus du jour +${profile.binga.login.amount}`}
                                </Text>
                            </PressableScale>
                        )}
                        <PressableScale onPress={() => navigation.navigate('Profile')} style={[styles.rankChip, { marginTop: 8 }]}>
                            {profile ? (
                                <Text style={styles.rankText}>
                                    🎯 Défis du jour : {profile.daily.list.filter((c) => c.done).length}/3
                                    <Text style={{ color: theme.textDim, fontWeight: '700' }}>
                                        {'  '}{(profile.daily.list.find((c) => !c.done) || {}).label || 'Tous relevés, bravo !'}
                                    </Text>
                                </Text>
                            ) : (
                                <Text style={styles.rankText}>🔐 Crée ton compte : binga, défis du jour, titres et classement</Text>
                            )}
                        </PressableScale>

                        {isSearching ? (
                            <Animated.View entering={ZoomIn.springify()} style={styles.searchBox}>
                                <SearchSpinner />
                                <Text style={[styles.searchTitle, searchStatus && { color: theme.mint }]}>
                                    {searchStatus === 'found' ? 'Adversaires trouvés !' : "Recherche d'adversaires…"}
                                </Text>
                                <Text style={styles.searchSub}>Partie à {searchingSize} joueurs · {Math.floor(searchSeconds / 60)}:{String(searchSeconds % 60).padStart(2, '0')}</Text>
                                <Text style={styles.searchHint}>La partie démarre dans quelques secondes</Text>
                                <GameButton small title="Annuler" icon="✖" variant="outline" onPress={handleCancelSearch} style={{ marginTop: 12, alignSelf: 'stretch' }} />
                            </Animated.View>
                        ) : (
                            <>
                                {isConnected && online && (
                                    <View style={styles.onlineRow} accessibilityLabel="Joueurs en ligne">
                                        <View style={styles.onlineDot} />
                                        <Text style={styles.onlineText}>
                                            {plural(online.online, 'joueur')} en ligne
                                            {online.games > 0 ? ` · ${plural(online.games, 'partie')} en cours` : ''}
                                        </Text>
                                    </View>
                                )}
                                <GameButton title={!isConnected ? '⏳ SERVEUR EN RÉVEIL…' : outdated ? 'EN LIGNE INDISPONIBLE' : `JOUER EN LIGNE · ${selected.label.toUpperCase()} ${menu === 'online' ? '▴' : '▾'}`} icon={isConnected ? '🌍' : undefined} variant="gold" onPress={() => toggleMenu('online')} disabled={!isConnected || outdated} style={{ marginTop: 16 }} />
                                {menu === 'online' && <SizePicker onPick={handleSearchMatch} color="#B8860B" showSearching />}

                                <GameButton title={isConnected ? `CONTRE L'ORDINATEUR ${menu === 'bot' ? '▴' : '▾'}` : '⏳ SERVEUR EN RÉVEIL…'} icon={isConnected ? '🤖' : undefined} variant="green" onPress={() => toggleMenu('bot')} disabled={!isConnected} style={{ marginTop: 12 }} />
                                {menu === 'bot' && <SizePicker onPick={handleCreateBotRoom} color={theme.green} />}

                                <GameButton title={isConnected ? 'CRÉER UN SALON PRIVÉ' : '⏳ SERVEUR EN RÉVEIL…'} icon={isConnected ? '🔒' : undefined} variant="blue" onPress={handleCreateRoom} disabled={!isConnected} style={{ marginTop: 12 }} />

                                <GameButton title="TOURNOIS" icon="🏆" variant="red" onPress={() => navigation.navigate('Tournaments')} disabled={!isConnected} style={{ marginTop: 12 }} />
                                {lastChampion && (
                                    <PressableScale onPress={() => navigation.navigate('Tournaments')} style={styles.championChip}>
                                        <Text style={styles.championChipText} numberOfLines={1}>
                                            👑 Dernier champion : {lastChampion.champion}
                                            <Text style={{ color: theme.textDim, fontWeight: '700' }}>{'  '}{lastChampion.name} · {GAME_LABEL[lastChampion.gameType]}</Text>
                                        </Text>
                                    </PressableScale>
                                )}


                            </>
                        )}
                    </Animated.View>

                    <PressableScale onPress={() => setShowRules(true)} style={styles.rulesLink}>
                        <Text style={styles.rulesLinkText}>📜 Lire les règles</Text>
                    </PressableScale>
                    {isConnected && (
                        <PressableScale onPress={() => { setInviteCode(null); setShowInvite(true); }} style={styles.inviteLink}>
                            <Text style={styles.inviteLinkText}>🔗 J'ai un lien d'invitation</Text>
                        </PressableScale>
                    )}
                    <InstallAppButton />
                    <View style={styles.legalRow}>
                        <Text style={styles.legalLink} onPress={() => navigation.navigate('Legal', { doc: 'privacy' })}>Confidentialité</Text>
                        <Text style={styles.legalDot}>·</Text>
                        <Text style={styles.legalLink} onPress={() => navigation.navigate('Legal', { doc: 'terms' })}>Conditions d'utilisation</Text>
                    </View>
                </ScrollView>
            )}

            <RulesModal visible={showRules && !inviteCode} onClose={closeRules} gameType={game} />
            <InviteJoinSheet
                visible={showInvite}
                code={inviteCode}
                name={name}
                onChangeName={setName}
                busy={joining}
                onJoin={(code, n) => joinByCode(code, n)}
                onClose={() => { setShowInvite(false); setInviteCode(null); }}
            />
        </ImageBackground>
    );
}

// Sélecteur de jeu : 4 cartes (les jeux pas encore prêts sont marqués "Bientôt")
function GamePicker({ value, onChange }) {
    return (
        <View style={styles.pickerGrid}>
            {GAME_ORDER.map((key, i) => {
                const g = GAMES[key];
                const on = key === value;
                return (
                    <Animated.View key={key} entering={FadeInDown.delay(60 * i).springify().damping(15)} style={styles.pickerCell}>
                        <PressableScale
                            onPress={() => {
                                if (!g.available) {
                                    audioService.playSound('error');
                                    dialog.alert(g.label, `${g.tagline}\n\nBientôt disponible !`);
                                    return;
                                }
                                onChange(key);
                            }}
                            style={[styles.pickerCard, on && { borderColor: g.color, backgroundColor: 'rgba(212,175,55,0.14)' }, !g.available && styles.pickerOff]}
                        >
                            <CardFace card={g.card} width={30} height={44} />
                            <View style={{ flex: 1, marginLeft: 8 }}>
                                <Text style={[styles.pickerName, on && { color: theme.goldLight }]} numberOfLines={1}>{g.label}</Text>
                                <Text style={styles.pickerPlayers} numberOfLines={1}>{g.available ? g.players : 'Bientôt'}</Text>
                            </View>
                            {on && <Text style={[styles.pickerCheck, { color: g.color }]}>✓</Text>}
                        </PressableScale>
                    </Animated.View>
                );
            })}
            <Text style={styles.pickerTagline}>{gameInfo(value).tagline}</Text>
        </View>
    );
}

function SearchSpinner() {
    const t = useSharedValue(0);
    useEffect(() => {
        t.value = withRepeat(withSequence(withTiming(1, { duration: 900 }), withTiming(0, { duration: 900 })), -1, false);
    }, []);
    const a = useAnimatedStyle(() => ({ transform: [{ rotateZ: `${-20 + t.value * 40}deg` }, { translateX: -14 + t.value * 28 }] }));
    const b = useAnimatedStyle(() => ({ transform: [{ rotateZ: `${20 - t.value * 40}deg` }, { translateX: 14 - t.value * 28 }] }));
    return (
        <View style={{ height: 64, width: 90, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View style={[{ position: 'absolute' }, a]}><CardBack width={40} height={58} /></Animated.View>
            <Animated.View style={[{ position: 'absolute' }, b]}><CardBack width={40} height={58} /></Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    championChip: { marginTop: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: 'rgba(142,14,28,0.55)', borderWidth: 1, borderColor: 'rgba(245,215,122,0.45)' },
    championChipText: { color: theme.goldLight, fontWeight: '800', fontSize: 12 },
    container: {
        flex: 1,
    },
    dim: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(18, 6, 9, 0.45)',
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    scrollContent: {
        flexGrow: 1,
        alignItems: 'center',
        paddingTop: 18,
        paddingBottom: 40,
        paddingHorizontal: 18,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
    },
    headerRight: {
        flexDirection: 'row',
        gap: 10,
    },
    iconOff: {
        opacity: 0.55,
    },
    logo: {
        alignItems: 'center',
        marginTop: 4,
        marginBottom: 14,
    },
    logoImage: {
        width: 210,
        height: 210,
    },
    tagline: {
        color: theme.cream,
        fontSize: 13,
        fontWeight: '700',
        marginTop: 2,
        opacity: 0.9,
        textShadowColor: '#000',
        textShadowRadius: 4,
    },
    outdated: {
        backgroundColor: 'rgba(185, 28, 28, 0.8)',
        maxWidth: 420,
    },
    sizeHeader: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    sizeBack: {
        position: 'absolute',
        left: 0,
    },
    sizeBackText: {
        color: theme.textDim,
        fontWeight: '800',
        fontSize: 12,
    },
    reconnect: {
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 6,
        marginBottom: 10,
    },
    reconnectText: {
        color: theme.goldLight,
        fontWeight: '700',
        fontSize: 13,
    },
    panel: {
        width: '100%',
        maxWidth: 420,
        backgroundColor: theme.panel,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: theme.gold,
        padding: 18,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 12,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    label: {
        color: theme.gold,
        fontWeight: '900',
        fontSize: 11,
        letterSpacing: 2,
        marginBottom: 4,
    },
    input: {
        backgroundColor: 'rgba(0,0,0,0.45)',
        borderWidth: 1.5,
        borderColor: 'rgba(212,175,55,0.6)',
        color: theme.goldLight,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        fontSize: 17,
        fontWeight: '700',
    },
    rankChip: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: 'rgba(212,175,55,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.35)',
        gap: 10,
    },
    rankText: {
        color: theme.goldLight,
        fontWeight: '900',
        fontSize: 13,
    },
    rankBar: {
        flex: 1,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(0,0,0,0.5)',
        overflow: 'hidden',
    },
    rankFill: {
        height: '100%',
        backgroundColor: theme.gold,
        borderRadius: 3,
    },
    rankXp: {
        color: theme.textDim,
        fontWeight: '800',
        fontSize: 12,
    },
    sizeMenu: {
        marginTop: 8,
        padding: 12,
        borderRadius: 14,
        borderWidth: 1.5,
        backgroundColor: 'rgba(0,0,0,0.35)',
        alignItems: 'center',
    },
    sizeTitle: {
        color: theme.text,
        fontWeight: '800',
        fontSize: 12,
        letterSpacing: 1,
        marginBottom: 8,
    },
    sizeSearching: { position: 'absolute', top: -8, right: -8, backgroundColor: '#22C55E', color: '#06260F', fontSize: 11, fontWeight: '900', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 9, overflow: 'hidden', borderWidth: 1.5, borderColor: '#FFF7D6' },
    sizeLegend: { color: theme.cream, fontSize: 11, opacity: 0.85, textAlign: 'center', marginTop: 8 },
    onlineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14, marginBottom: -6 },
    onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E', shadowColor: '#22C55E', shadowOpacity: 0.9, shadowRadius: 4 },
    onlineText: { color: theme.cream, fontSize: 12, fontWeight: '700', opacity: 0.9 },
    sizeRow: {
        flexDirection: 'row',
        gap: 10,
    },
    sizeBtn: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.35)',
    },
    sizeNum: {
        color: '#fff',
        fontWeight: '900',
        fontSize: 22,
    },
    sizeIcons: {
        fontSize: 9,
        marginTop: 1,
    },
    joinRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    codeInput: {
        flex: 1,
        minWidth: 0,
        textAlign: 'center',
        fontWeight: '900',
        letterSpacing: 6,
    },
    searchBox: {
        marginTop: 16,
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        backgroundColor: 'rgba(0,0,0,0.35)',
        borderWidth: 1.5,
        borderColor: 'rgba(212,175,55,0.45)',
    },
    searchTitle: {
        color: theme.goldLight,
        fontWeight: '900',
        fontSize: 17,
        marginTop: 6,
    },
    searchSub: {
        color: theme.text,
        fontWeight: '700',
        marginTop: 2,
    },
    searchHint: {
        color: theme.textDim,
        fontSize: 12,
        marginTop: 6,
        textAlign: 'center',
    },
    inviteLink: { alignSelf: 'center', marginTop: 14, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(212,175,55,0.5)', backgroundColor: 'rgba(18,8,11,0.6)' },
    inviteLinkText: { color: theme.goldLight, fontWeight: '800', fontSize: 13 },
    legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 8 },
    legalLink: { color: 'rgba(243,233,220,0.75)', fontSize: 12, textDecorationLine: 'underline' },
    legalDot: { color: 'rgba(243,233,220,0.5)', fontSize: 12 },
    rulesLink: {
        marginTop: 18,
        paddingVertical: 10,
        paddingHorizontal: 22,
        borderRadius: 22,
        backgroundColor: 'rgba(18,8,11,0.75)',
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.5)',
    },
    rulesLinkText: {
        color: theme.goldLight,
        fontWeight: '800',
        fontSize: 14,
    },
    pickerGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: 8,
        marginBottom: 14,
    },
    pickerCell: {
        width: '48.5%',
    },
    pickerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 7,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: 'rgba(212,175,55,0.25)',
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    pickerOff: {
        opacity: 0.5,
    },
    pickerName: {
        color: theme.cream,
        fontWeight: '900',
        fontSize: 14,
    },
    pickerPlayers: {
        color: theme.textDim,
        fontSize: 10,
        fontWeight: '700',
    },
    pickerCheck: {
        fontSize: 16,
        fontWeight: '900',
    },
    pickerTagline: {
        width: '100%',
        textAlign: 'center',
        color: theme.textDim,
        fontSize: 12,
        fontStyle: 'italic',
    },
    loaderBox: {
        alignItems: 'center',
        backgroundColor: theme.panel,
        padding: 30,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: theme.gold,
        maxWidth: 340,
    },
    loaderTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: theme.goldLight,
        marginTop: 20,
        textAlign: 'center',
    },
    loaderSubtitle: {
        fontSize: 14,
        color: theme.text,
        textAlign: 'center',
        marginTop: 6,
    },
});
