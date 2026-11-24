import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, Image, ScrollView, Platform, Pressable, Modal, useWindowDimensions } from 'react-native';
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
import InstallPrompt from '../components/InstallPrompt';
import { useIsFocused } from '@react-navigation/native';
import InviteJoinSheet from '../components/InviteJoinSheet';
import { initialInvite, clearInviteFromUrl, onInviteLink, initialTournament, onTournamentLink } from '../utils/invite';
import { remember as rememberTournament, claimPendingRewards, GAME_LABEL } from '../utils/tournaments';
import { enterFullscreen } from '../utils/fullscreen';
import PlayerAvatar from '../components/PlayerAvatar';
import { BingaIcon, Chip } from '../components/Decor';
import DailyPopups from '../components/DailyPopups';
import Onboarding from '../components/Onboarding';
import { inDiscord, discordInstanceId } from '../utils/discord';
import AppNav, { useLandscape } from '../components/AppNav';
import { useFriends } from '../network/friendsService';
import InboxBell from '../components/InboxBell';
import { useWideFrameWhile } from '../components/MenuShell';
import { ChestArt } from '../components/ChestOpening';
import { SEASON_MS } from '../../server/progress/defs';
import { LUXE, LUXE_IMG, MODE_COLORS, Gradient, Glow, LuxePanel, LevelBadge, XpBar, LaurelPortrait, QuickTile, ModeCard, RibbonTitle, GoldSquare } from '../components/Luxe';

const UI = {
    collection: require('../../assets/ui/tile_collection.webp'),
    rewards: require('../../assets/ui/tile_recompenses.webp'),
    rank: require('../../assets/ui/tile_classement.webp'),
    online: require('../../assets/ui/mode_enligne.webp'),
    solo: require('../../assets/ui/mode_ordi.webp'),
    tournament: require('../../assets/ui/mode_tournoi.webp'),
    friends: require('../../assets/ui/mode_salon.webp'),
    sParties: require('../../assets/ui/stat_parties.webp'),
    sWins: require('../../assets/ui/stat_victoires.webp'),
    sStreak: require('../../assets/ui/stat_serie.webp'),
    sRate: require('../../assets/ui/stat_taux.webp'),
};

// Discord Activities : on entre une seule fois tout seul dans le salon de la partie Discord
let discordAutoJoined = false;
import { CardFace, CardBack } from '../components/Card';
import { GameButton, IconButton, PressableScale, OrnamentDivider, theme } from '../components/ui';
import { dialog } from '../components/Dialog';
import { getRankInfo } from '../utils/stats';
import accountService, { useAccount } from '../network/accountService';
import { GAMES, GAME_ORDER, gameInfo } from '../games';
import { t } from '../i18n';


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
            <Text style={styles.loaderTitle}>{t("Réveil du serveur…")}</Text>
            <Text style={styles.loaderSubtitle}>{t("La première connexion peut prendre jusqu'à 30 secondes")}</Text>
        </Animated.View>
    );
}

export default function HomeScreen({ navigation, route }) {
    const [name, setName] = useState('');
    const [nameReady, setNameReady] = useState(false); // pseudo enregistré relu
    // Invitation : code reçu par un lien, fenêtre « rejoindre » (pseudo / lien collé)
    const [inviteCode, setInviteCode] = useState(null);
    const [showInvite, setShowInvite] = useState(false);
    const [joining, setJoining] = useState(false);
    const [lastChampion, setLastChampion] = useState(null); // palmarès : dernier tournoi gagné
    const [showRules, setShowRules] = useState(false);
    const [showOnboarding, setShowOnboarding] = useState(false); // premier lancement
    const [installOpen, setInstallOpen] = useState(false); // grande fenêtre « Installe L'Carta » (site seulement)
    const focused = useIsFocused();
    const [menu, setMenu] = useState(null); // 'online' | 'bot' | null
    const view = 'home'; // accueil sur un seul écran (carte du joueur, raccourcis, modes de jeu)
    const [game, setGame] = useState('hezz2');
    const selected = gameInfo(game);
    const [isMuted, setIsMuted] = useState(audioService.muted);
    const [musicOn, setMusicOn] = useState(audioService.musicOn);
    const [isConnected, setIsConnected] = useState(false);
    const [wakeSeconds, setWakeSeconds] = useState(0);
    const [hasConnected, setHasConnected] = useState(false);
    const [rankInfo, setRankInfo] = useState(null);
    const [localStats, setLocalStats] = useState({ played: 0, wins: 0 }); // invité : statistiques de l'appareil
    const { width: winW, height: winH } = useWindowDimensions();
    const landscape = useLandscape(); // écran large en paysage : colonnes (navigation, modes, saison et récompenses)
    useWideFrameWhile(navigation, landscape); // en paysage, toute la largeur de la fenêtre (comme les autres menus)
    const account = useAccount();
    const profile = account.profile;
    const friends = useFriends();
    // Invitation d'un ami acceptée (carte « X t'invite ») : on rejoint son salon
    useEffect(() => {
        if (route?.params?.invite) setInviteCode(route.params.invite);
    }, [route?.params?.inviteAt]);
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
                // Premier lancement : présentation guidée (elle remplace l'ouverture automatique des règles)
                // (un joueur qui avait déjà vu les règles n'est pas un nouveau joueur : pas de présentation)
                const onboarded = (await AsyncStorage.getItem('onboarded')) || (await AsyncStorage.getItem('rulesSeen'));
                if (!onboarded && !inDiscord) setShowOnboarding(true); // dans Discord : direct au salon
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

    // Retour de la page de paiement Stripe (?paiement=ok|annule) ; diamants crédités par le serveur (webhook)
    useEffect(() => {
        let poll = null;
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            const m = (window.location.search || '').match(/[?&]paiement=(ok|annule)/);
            if (m) {
                window.history.replaceState(null, '', '/');
                if (m[1] === 'annule') {
                    dialog.alert(t('Paiement annulé'), t("Aucun montant n'a été débité."));
                } else {
                    dialog.alert(t('Merci ! 💎'), t('Paiement confirmé. Tes diamants arrivent dans quelques secondes (Collection → Diamants).'));
                    let n = 0;
                    poll = setInterval(() => { accountService.refresh(); n += 1; if (n >= 6) clearInterval(poll); }, 3000);
                }
            }
        }
        const onGems = () => accountService.refresh();
        const attach = setInterval(() => {
            if (!socketService.socket) return;
            clearInterval(attach);
            socketService.socket.on('diamonds', onGems);
        }, 500);
        return () => { clearInterval(poll); clearInterval(attach); socketService.socket?.off('diamonds', onGems); };
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
                const [gp, w] = await Promise.all(['gamesPlayed', 'wins'].map((k) => AsyncStorage.getItem(k)));
                setLocalStats({ played: parseInt(gp || '0', 10), wins: parseInt(w || '0', 10) });
            } catch (e) { /* ignore */ }
        };
        loadXp();
        return navigation.addListener('focus', () => { loadXp(); accountService.refresh(); });
    }, [navigation]);

    const requireName = () => {
        if (!name.trim()) {
            audioService.playSound('error');
            dialog.alert(t('Pseudo manquant'), t('Entre un pseudo avant de jouer.'));
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
            t('Serveur pas à jour'),
            t("Le serveur en ligne ne connaît pas encore {p0} : il lancerait une partie de Hezz2 à la place. Il faut redéployer le serveur (Render).", { p0: selected.label })
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
                dialog.alert(t('Erreur'), response?.message || t('Impossible de créer le salon.'));
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
                dialog.alert(t('Impossible de rejoindre'), response?.message === 'Salon introuvable'
                    ? t("Ce salon n'existe plus (la partie est peut-être terminée). Demande un nouveau lien à ton ami.")
                    : response?.message || t('Salon introuvable.'));
            }
        });
    };

    // Discord Activities : salon commun à tous les joueurs de la partie Discord (le premier en est l'hôte)
    const joinDiscordRoom = async () => {
        const instanceId = await discordInstanceId();
        const playerName = (profile?.name || name).trim();
        if (!instanceId || !playerName) return;
        setJoining(true);
        socketService.discordRoom(instanceId, playerName, game, (response) => {
            setJoining(false);
            if (response?.success) {
                setShowRules(false);
                if (response.gameState) {
                    navigation.navigate('Game', { roomId: response.roomId, playerName, initialGameState: response.gameState, isHost: false });
                } else {
                    navigation.navigate('Lobby', { roomId: response.roomId, playerName, isHost: !!response.isHost, initialRoom: response.roomData });
                }
            } else {
                audioService.playSound('error');
                dialog.alert(t('Salon Discord'), response?.message || t('Impossible de rejoindre le salon de la partie.'));
            }
        });
    };
    useEffect(() => {
        if (!inDiscord || discordAutoJoined || !isConnected || !profile?.name) return;
        discordAutoJoined = true;
        joinDiscordRoom();
    }, [isConnected, profile?.name]);

    // Arrivée par un lien : on rejoint dès que le serveur est joignable (pseudo demandé s'il manque)
    useEffect(() => {
        if (!inviteCode || !nameReady || !isConnected || joining) return;
        // Connecté à un compte sur un appareil neuf : on attend le pseudo du compte (chargé juste après
        // le démarrage) au lieu de le demander, puis on rejoint
        if (account.token && !profile?.name) return;
        const playerName = (profile?.name || name).trim();
        if (playerName) joinByCode(inviteCode, playerName);
        else setShowInvite(true);
    }, [inviteCode, nameReady, isConnected, profile?.name, account.token]);

    const handleCreateBotRoom = (count) => {
        if (!requireName() || !requireGameSupport()) return;
        enterFullscreen(game === 'ronda' ? 'landscape' : 'any');
        socketService.createBotRoom(name.trim(), count, game, (response) => {
            if (response?.success) {
                setMenu(null);
                navigation.navigate('Game', { roomId: response.roomId, playerName: name.trim(), initialGameState: response.gameState, isHost: true });
            } else {
                dialog.alert(t('Erreur'), response?.message || t("Impossible de créer la partie contre l'ordinateur."));
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
                dialog.alert(t('Matchmaking indisponible'), res.message);
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

    const finishOnboarding = () => {
        setShowOnboarding(false);
        AsyncStorage.multiSet([['onboarded', '1'], ['rulesSeen', '1']]).catch(() => {});
    };

    // Première partie contre l'ordinateur, lancée depuis la présentation (taille la plus petite du jeu)
    const startFirstGame = (g, playerName) => {
        const n = (profile?.name || playerName || '').trim();
        if (!n) return;
        finishOnboarding();
        setName(n);
        setGame(g);
        AsyncStorage.multiSet([['playerName', n], ['selectedGame', g]]).catch(() => {});
        enterFullscreen(g === 'ronda' ? 'landscape' : 'any');
        socketService.createBotRoom(n, gameInfo(g).sizes[0], g, (response) => {
            if (response?.success) {
                navigation.navigate('Game', { roomId: response.roomId, playerName: n, initialGameState: response.gameState, isHost: true });
            } else {
                dialog.alert(t('Erreur'), response?.message || t("Impossible de créer la partie contre l'ordinateur."));
            }
        });
    };

    const closeRules = () => {
        setShowRules(false);
        AsyncStorage.setItem('rulesSeen', '1').catch(() => {});
    };

    const toggleMenu = (m) => setMenu((cur) => (cur === m ? null : m));

    // Joueurs qui cherchent une partie de ce jeu et de cette taille en ce moment
    const searchingFor = (n) => online?.searching?.[`${game}:${n}`] || 0;
    const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;

    // Choix du nombre de joueurs (dans la fenêtre ouverte par « En ligne » ou « Solo »)
    const SizePicker = ({ onPick, colors, showSearching }) => (
        <Animated.View entering={FadeInDown.springify().damping(15)}>
            <Text style={styles.lxSizeHint}>{t("Choisis le nombre de joueurs")}</Text>
            <View style={styles.lxSizes}>
                {selected.sizes.map((n) => (
                    <PressableScale key={n} onPress={() => onPick(n)} style={styles.lxSize} scaleTo={0.92} accessibilityLabel={game === 'ronda' ? (n === 2 ? t('1 contre 1') : t('2 contre 2')) : t('{n} joueurs', { n })}>
                        <Gradient colors={colors} />
                        <View style={styles.lxSizeShine} />
                        <Text style={styles.lxSizeNum}>{game === 'ronda' ? (n === 2 ? '1v1' : '2v2') : n}</Text>
                        <Text style={styles.lxSizeSub} numberOfLines={1}>{game === 'ronda' ? t(selected.sizeLabel(n)) : t('joueurs')}</Text>
                        {showSearching && searchingFor(n) > 0 && (
                            <Text style={styles.sizeSearching} numberOfLines={1} accessibilityLabel={t("{p0} en recherche", { p0: searchingFor(n) })}>{searchingFor(n)}</Text>
                        )}
                    </PressableScale>
                ))}
            </View>
            {showSearching && selected.sizes.some((n) => searchingFor(n) > 0) && (
                <Text style={styles.sizeLegend}>🟢 = joueurs qui attendent déjà : choisis cette taille pour jouer tout de suite</Text>
            )}
            <GameButton small title={t("Annuler")} variant="outline" onPress={() => setMenu(null)} style={{ alignSelf: 'center', marginTop: 14 }} />
        </Animated.View>
    );

    // Statistiques de la carte du joueur : compte (toutes les parties) ou appareil (invité)
    const allStats = profile?.stats ? Object.values(profile.stats) : null;
    const played = allStats ? allStats.reduce((n, x) => n + (x.played || 0), 0) : localStats.played;
    const wins = allStats ? allStats.reduce((n, x) => n + (x.wins || 0), 0) : localStats.wins;
    const best = allStats ? Math.max(0, ...allStats.map((x) => x.best || 0)) : null;
    const rate = played ? Math.round((wins / played) * 100) : 0;
    const level = (rankInfo?.index ?? 0) + 1;
    const pageW = Math.min(winW, 520);
    const modeW = Math.floor((pageW - 36 - 24 - 3 * 8) / 4); // 4 cartes par ligne dans le panneau
    const modesInRow = modeW >= 64;
    const cardW = modesInRow ? modeW : Math.floor((pageW - 36 - 24 - 12) / 2);
    const wheelReady = !!profile?.wheel?.available;
    // Panneau des modes : onglets de jeu, phrase du jeu, puis les 4 cartes (ou la recherche en cours)
    const renderModes = (cw, inRow) => (
        <>
                                <View style={styles.lxGames}>
                                    {GAME_ORDER.filter((k) => GAMES[k].available).map((k) => {
                                        const on = k === game;
                                        return (
                                            <PressableScale
                                                key={k}
                                                onPress={() => { setGame(k); setMenu(null); AsyncStorage.setItem('selectedGame', k).catch(() => {}); }}
                                                style={[styles.lxGame, on && styles.lxGameOn]}
                                                accessibilityLabel={GAMES[k].label}
                                                accessibilityState={{ selected: on }}
                                            >
                                                {pageW >= 380 && <CardFace card={GAMES[k].card} width={20} height={29} />}
                                                <Text style={[styles.lxGameText, on && { color: LUXE.goldLight }]} numberOfLines={1}>{GAMES[k].label.split(' ')[0]}</Text>
                                            </PressableScale>
                                        );
                                    })}
                                </View>
                                <Text style={styles.lxTagline} numberOfLines={2}>{t(selected.tagline)}</Text>
                                {isSearching ? (
                                    <Animated.View entering={ZoomIn.springify()} style={styles.searchBox}>
                                        <SearchSpinner />
                                        <Text style={[styles.searchTitle, searchStatus && { color: theme.mint }]}>
                                            {searchStatus === 'found' ? t('Adversaires trouvés !') : t("Recherche d'adversaires…")}
                                        </Text>
                                        <Text style={styles.searchSub}>{selected.label} · partie à {searchingSize} joueurs · {Math.floor(searchSeconds / 60)}:{String(searchSeconds % 60).padStart(2, '0')}</Text>
                                        <Text style={styles.searchHint}>{t("La partie démarre dans quelques secondes")}</Text>
                                        <GameButton small title={t("Annuler")} icon="✖" variant="outline" onPress={handleCancelSearch} style={{ marginTop: 12, alignSelf: 'stretch' }} />
                                    </Animated.View>
                                ) : (
                                    <View style={[styles.lxModeGrid, !inRow && { flexWrap: 'wrap', rowGap: 12 }]}>
                                        <ModeCard width={cw} icon={UI.online} label={t("En ligne")} sub={online ? t("{p0} en ligne", { p0: online.online }) : t('vs joueurs')} colors={MODE_COLORS.red} disabled={!isConnected || outdated} onPress={() => startMode('online')} />
                                        <ModeCard width={cw} icon={UI.solo} label={t("Solo")} sub={t("vs ordinateur")} colors={MODE_COLORS.blue} disabled={!isConnected} onPress={() => startMode('bot')} />
                                        <ModeCard width={cw} icon={UI.tournament} label={t("Tournois")} sub={lastChampion ? `👑 ${lastChampion.champion}` : t('élimination')} colors={MODE_COLORS.purple} disabled={!isConnected} onPress={() => navigation.navigate('Tournaments')} />
                                        <ModeCard width={cw} icon={UI.friends} label={t("Entre amis")} sub={inDiscord ? t('salon Discord') : t('salon privé')} colors={MODE_COLORS.green} disabled={!isConnected || (inDiscord && !profile?.name)} onPress={() => { if (!requireName()) return; if (inDiscord) joinDiscordRoom(); else handleCreateRoom(); }} />
                                    </View>
                                )}
        </>
    );
    // ------------------------------------------------------------ paysage
    const renderLandscape = () => {
        const sideW = winW >= 1100 ? 210 : 176;
        const rightW = winW >= 1000 ? 240 : 0; // colonne de droite seulement sur grand écran
        const centerW = winW - sideW - rightW - 16 * 2 - (rightW ? 24 : 12);
        const lsCard = Math.max(70, Math.min(170, Math.floor((centerW - 24 - 3 * 10) / 4), Math.floor((winH - (winH < 520 ? 240 : 250)) / 1.24)));
        const season = profile?.season;
        const seasonPct = season ? Math.max(0, Math.min(1, 1 - (season.end - Date.now()) / SEASON_MS)) : 0;
        const short = winH < 520; // téléphone tenu en paysage : haut d'écran plus compact
        const logoW = Math.min(300, (short ? winH * 0.24 : 130) / 0.433);
        const portrait = short ? 62 : 78;
        const missionsDone = profile?.binga ? profile.binga.missions.filter((m) => m.done).length : 0;
        const sidePanel = (icon, title, sub, button, onPress, extra) => (
            <PressableScale onPress={onPress} style={{ marginBottom: 10 }} accessibilityLabel={title} scaleTo={0.97}>
                <LuxePanel style={styles.lsBox}>
                    <View style={styles.lsBoxRow}>
                        {icon}
                        <View style={{ flex: 1, marginLeft: 8 }}>
                            <Text style={styles.lsBoxTitle} numberOfLines={1}>{title}</Text>
                            {sub ? <Text style={styles.lsBoxSub} numberOfLines={2}>{sub}</Text> : null}
                        </View>
                    </View>
                    {extra}
                    {button ? <View style={styles.lsBoxBtn}><Gradient colors={['#FFE795', '#EDBE4E', '#A8761A']} /><Text style={styles.lsBoxBtnText}>{button}</Text></View> : null}
                </LuxePanel>
            </PressableScale>
        );
        return (
            <View style={{ flex: 1 }}>
                <Image source={LUXE_IMG.scene} style={[styles.lsScene, { width: winW, height: winW * 0.328 }]} pointerEvents="none" />
                <Image source={LUXE_IMG.arch} style={[styles.archL, { width: 170, height: 154 }]} pointerEvents="none" />
                <Image source={LUXE_IMG.arch} style={[styles.archR, { width: 170, height: 154 }]} pointerEvents="none" />

                {/* Haut : joueur, logo, binga et son */}
                <View style={styles.lsTop}>
                    <Pressable onPress={() => navigation.navigate('Profile')} style={[styles.lsPlayer, { width: sideW + 90 }]} accessibilityLabel={t("Mon profil")}>
                        <LaurelPortrait size={portrait}>
                            <PlayerAvatar name={name || t('Joueur')} variant={profile ? (profile.avatar || 0) : (account.guestAvatar || 0)} size={portrait * 0.74} />
                        </LaurelPortrait>
                        <View style={{ flex: 1, marginLeft: 6 }}>
                            {profile ? (
                                <Text style={styles.lsName} numberOfLines={1}>{profile.name}</Text>
                            ) : (
                                <TextInput style={[styles.lxInput, { paddingVertical: 4, fontSize: 14 }]} placeholder={t("Ton pseudo…")} placeholderTextColor={LUXE.dim} value={name} onChangeText={setName} maxLength={16} accessibilityLabel={t("Ton pseudo")} />
                            )}
                            <Text style={styles.lsLevel}>{t("Niveau")} <Text style={{ color: LUXE.goldLight }}>{level}</Text>{rankInfo ? `  ·  ${t(rankInfo.name)}` : ''}</Text>
                            {rankInfo && <XpBar progress={rankInfo.levelProgress || 0} height={12} style={{ marginTop: 3 }} />}
                            {rankInfo && <Text style={styles.lsXp}>{rankInfo.currentXP}{rankInfo.next ? ` / ${rankInfo.next.min}` : ''} {t("XP")}</Text>}
                        </View>
                    </Pressable>
                    <Animated.View style={[{ flex: 1, alignItems: 'center' }, titleStyle]}>
                        <Image source={LUXE_IMG.logo} style={{ width: logoW, height: logoW * 0.433 }} accessibilityLabel={t("L'Carta")} />
                    </Animated.View>
                    <View style={[styles.lsRight, { width: Math.max(rightW, 190) }]}>
                        <PressableScale onPress={() => navigation.navigate(profile?.binga ? 'Shop' : 'Profile')} style={styles.lxCoins} accessibilityLabel={t("Binga")}>
                            <Gradient colors={['#2A1A0E', '#120904']} />
                            <BingaIcon size={24} />
                            <Text style={styles.lxCoinsText}>{profile?.binga ? profile.binga.balance.toLocaleString('fr-FR') : '—'}</Text>
                            <View style={styles.lxPlus}><Text style={styles.lxPlusText}>+</Text></View>
                        </PressableScale>
                        <InboxBell navigation={navigation} onJoinRoom={(code) => setInviteCode(code)} />
                        <GoldSquare onPress={() => audioService.toggleMusic()} label={t("Musique")} style={!musicOn && { opacity: 0.55 }}><Text style={styles.lxSqIcon}>{musicOn ? '🎵' : '🎶'}</Text></GoldSquare>
                        <GoldSquare onPress={() => audioService.toggleMute()} label={t("Son")}><Text style={styles.lxSqIcon}>{isMuted ? '🔇' : '🔊'}</Text></GoldSquare>
                    </View>
                </View>

                <View style={styles.lsBody}>
                    {/* Gauche : navigation */}
                    <ScrollView style={{ width: sideW, flexGrow: 0 }} showsVerticalScrollIndicator={false}>
                        <AppNav navigation={navigation} current="home" side />
                        <View style={[styles.lxLinks, { flexDirection: 'column', alignItems: 'stretch', gap: 6 }]}>
                            <PressableScale onPress={() => setShowRules(true)} style={styles.lxLink}><Text style={styles.lxLinkText}>{t("📜 Règles")}</Text></PressableScale>
                            {isConnected && (
                                <PressableScale onPress={() => { setInviteCode(null); setShowInvite(true); }} style={styles.lxLink}><Text style={styles.lxLinkText}>{t("🔗 Lien d'invitation")}</Text></PressableScale>
                            )}
                        </View>
                        {/* Ordinateur (Chrome, Edge) : installer le jeu comme une appli */}
                        <InstallAppButton style={{ alignSelf: 'flex-start', marginTop: 8, paddingVertical: 6, paddingHorizontal: 14 }} />
                    </ScrollView>

                    {/* Centre : modes de jeu, tournois */}
                    <ScrollView style={{ flex: 1, marginHorizontal: 12 }} contentContainerStyle={{ paddingTop: 20, paddingBottom: 24 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        {outdated && isConnected && (
                            <View style={[styles.reconnect, styles.outdated]}><Text style={styles.reconnectText}>{t("⚠️ Le serveur en ligne n'est pas à jour : matchmaking, Rejouer et nouveaux jeux indisponibles.")}</Text></View>
                        )}
                        {!isConnected && (
                            <View style={styles.reconnect}>
                                <Text style={styles.reconnectText}>{wakeSeconds < 4 ? t('⏳ Connexion au serveur…') : t("⏳ Le serveur se réveille… {p0} s", { p0: wakeSeconds })}</Text>
                            </View>
                        )}
                        <View>
                            <LuxePanel style={styles.lxModes} colors={['#5C1020', '#2B0710']}>
                                {renderModes(lsCard, true)}
                            </LuxePanel>
                            <RibbonTitle title={t("Modes de jeu")} style={styles.lxRibbon} />
                        </View>
                        <PressableScale onPress={() => navigation.navigate('Tournaments')} disabled={!isConnected} style={{ marginTop: 14 }} accessibilityLabel={t("Voir les tournois")} scaleTo={0.98}>
                            <LuxePanel style={styles.lsTour} colors={['#4A1460', '#5C1020']}>
                                <Image source={UI.tournament} style={{ width: 92, height: 64 }} resizeMode="contain" />
                                <View style={{ flex: 1, marginHorizontal: 10 }}>
                                    <Text style={styles.lsTourTitle}>{t("Tournois")}</Text>
                                    <Text style={styles.lsTourSub} numberOfLines={2}>{lastChampion ? t("Dernier champion : {p0} ({p1})", { p0: lastChampion.champion, p1: GAME_LABEL[lastChampion.gameType] }) : t('Élimination directe : inscris-toi et décroche le titre de champion.')}</Text>
                                </View>
                                <View style={styles.lsTourBtn}><Gradient colors={['#EA4A45', '#8E121B']} /><Text style={styles.lsTourBtnText}>{t("Voir ›")}</Text></View>
                            </LuxePanel>
                        </PressableScale>
                    </ScrollView>

                    {/* Droite : saison, roue, coffres, missions */}
                    {rightW > 0 && (
                        <ScrollView style={{ width: rightW, flexGrow: 0 }} showsVerticalScrollIndicator={false}>
                            {sidePanel(
                                <Image source={UI.sStreak} style={{ width: 40, height: 28 }} resizeMode="contain" />,
                                season ? `Saison ${season.id}` : t('Saison'),
                                season ? `${season.xp} XP · fin le ${new Date(season.end).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}` : t('Crée ton compte pour le classement de la saison.'),
                                null,
                                () => navigation.navigate('Leaderboard'),
                                season ? <XpBar progress={seasonPct} height={10} style={{ marginTop: 8 }} /> : null,
                            )}
                            {sidePanel(
                                <Image source={UI.rewards} style={{ width: 44, height: 38 }} resizeMode="contain" />,
                                'Roue du jour',
                                wheelReady ? t('1 tour gratuit t\'attend') : profile ? t('Prochain tour demain') : t('Gratuite chaque jour'),
                                wheelReady || !profile ? t('Tourner') : null,
                                () => navigation.navigate('Wheel'),
                            )}
                            {sidePanel(
                                <ChestArt chest="or" size={50} />,
                                'Coffres',
                                'Bronze, argent, or : chances affichées',
                                'Ouvrir',
                                () => navigation.navigate('Shop'),
                            )}
                            {sidePanel(
                                <Image source={UI.collection} style={{ width: 44, height: 30 }} resizeMode="contain" />,
                                'Missions',
                                profile?.binga ? t("{p0}/{p1} faites aujourd'hui", { p0: missionsDone, p1: profile.binga.missions.length }) : t('Avec un compte'),
                                null,
                                () => navigation.navigate('Missions'),
                            )}
                        </ScrollView>
                    )}
                </View>
            </View>
        );
    };

    const startMode = (m) => {
        if (!requireName()) return;
        if (m === 'online' && outdated) { audioService.playSound('error'); return; }
        setMenu(m);
    };

    return (
        <View style={styles.container}>
            <Gradient colors={['#12234A', LUXE.night, '#060C18']} />
            <Glow color="#2A4D9C" style={{ height: 560 }} />

            {!hasConnected ? (
                <View style={styles.center}>
                    <ServerLoader />
                </View>
            ) : landscape ? (
                renderLandscape()
            ) : (
                <ScrollView style={{ width: '100%' }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    <View style={styles.page}>
                        {/* Arches marocaines et lanternes, aux deux coins */}
                        <Image source={LUXE_IMG.arch} style={styles.archL} pointerEvents="none" />
                        <Image source={LUXE_IMG.arch} style={styles.archR} pointerEvents="none" />

                        {/* En-tête : binga, musique, son */}
                        <View style={styles.lxTop}>
                            <PressableScale onPress={() => navigation.navigate(profile?.binga ? 'Shop' : 'Profile')} style={styles.lxCoins} accessibilityLabel={t("Binga")}>
                                <Gradient colors={['#2A1A0E', '#120904']} />
                                <BingaIcon size={24} />
                                <Text style={styles.lxCoinsText}>{profile?.binga ? profile.binga.balance.toLocaleString('fr-FR') : '—'}</Text>
                                <View style={styles.lxPlus}><Text style={styles.lxPlusText}>+</Text></View>
                            </PressableScale>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <InboxBell navigation={navigation} onJoinRoom={(code) => setInviteCode(code)} />
                        <GoldSquare onPress={() => audioService.toggleMusic()} label={t("Musique")} style={!musicOn && { opacity: 0.55 }}><Text style={styles.lxSqIcon}>{musicOn ? '🎵' : '🎶'}</Text></GoldSquare>
                                <GoldSquare onPress={() => audioService.toggleMute()} label={t("Son")}><Text style={styles.lxSqIcon}>{isMuted ? '🔇' : '🔊'}</Text></GoldSquare>
                            </View>
                        </View>

                        {/* Logo */}
                        <Animated.View entering={ZoomIn.springify().damping(12)} style={[{ alignItems: 'center', marginTop: -8 }, titleStyle]}>
                            <Image source={LUXE_IMG.logo} style={{ width: Math.min(300, pageW - 110), height: Math.min(300, pageW - 110) * 0.433 }} accessibilityLabel={t("L'Carta")} />
                        </Animated.View>

                        {outdated && isConnected && (
                            <Animated.View entering={FadeIn} style={[styles.reconnect, styles.outdated]}>
                                <Text style={styles.reconnectText}>{t("⚠️ Le serveur en ligne n'est pas à jour : matchmaking, Rejouer et nouveaux jeux indisponibles. Il faut le redéployer.")}</Text>
                            </Animated.View>
                        )}
                        {TEST_MODE && (
                            <View style={[styles.reconnect, { backgroundColor: 'rgba(124,58,237,0.7)' }]}>
                                <Text style={styles.reconnectText}>{TEST_MODE === 'big' ? t("🧪 Mode test : contre l'IA (Hezz2), ta main commence avec 20 cartes") : t("🧪 Mode test : contre l'IA (Hezz2), ta main commence avec des 1, 2 et 7")}</Text>
                            </View>
                        )}
                        {!isConnected && (
                            <Animated.View entering={FadeIn} style={styles.reconnect}>
                                <Text style={styles.reconnectText}>
                                    {wakeSeconds < 4 ? t('⏳ Connexion au serveur…') : t("⏳ Le serveur se réveille… {p0} s (jusqu'à 1 min après une pause)", { p0: wakeSeconds })}
                                </Text>
                            </Animated.View>
                        )}

                        {/* Carte du joueur : portrait, pseudo, niveau, XP, rang, statistiques */}
                        <Animated.View entering={FadeInUp.delay(120).springify().damping(16)}>
                            <LuxePanel style={styles.lxCard}>
                                <View style={styles.lxCardRow}>
                                    <Pressable onPress={() => navigation.navigate('Profile')} accessibilityLabel={t("Mon profil")}>
                                        <LaurelPortrait size={pageW < 380 ? 96 : 108}>
                                            <PlayerAvatar name={name || t('Joueur')} variant={profile ? (profile.avatar || 0) : (account.guestAvatar || 0)} size={(pageW < 380 ? 96 : 108) * 0.74} />
                                        </LaurelPortrait>
                                    </Pressable>
                                    <View style={{ flex: 1, marginLeft: 8 }}>
                                        {profile ? (
                                            <Pressable onPress={() => navigation.navigate('Profile')} style={styles.lxNameRow} accessibilityLabel={t("Modifier mon profil")}>
                                                <Text style={styles.lxName} numberOfLines={1}>{profile.name}</Text>
                                                <View style={styles.lxEdit}><Text style={{ fontSize: 12 }}>✏️</Text></View>
                                            </Pressable>
                                        ) : (
                                            <TextInput
                                                style={styles.lxInput}
                                                placeholder={t("Ton pseudo…")}
                                                placeholderTextColor={LUXE.dim}
                                                value={name}
                                                onChangeText={setName}
                                                maxLength={16}
                                                accessibilityLabel={t("Ton pseudo")}
                                            />
                                        )}
                                        {rankInfo && (
                                            <View style={styles.lxLevelRow}>
                                                <LevelBadge level={level} size={40} />
                                                <View style={{ flex: 1, marginLeft: 6 }}>
                                                    <XpBar progress={rankInfo.levelProgress || 0} />
                                                    <Text style={styles.lxXpText}>{rankInfo.currentXP}{rankInfo.next ? ` / ${rankInfo.next.min}` : ''} {t("XP")}</Text>
                                                </View>
                                            </View>
                                        )}
                                        {rankInfo && (
                                            <Pressable onPress={() => navigation.navigate('Leaderboard')} style={styles.lxRank} accessibilityLabel={t("Classement")}>
                                                <Image source={LUXE_IMG.trophy} style={{ width: 34, height: 21 }} />
                                                <Text style={styles.lxRankText} numberOfLines={1}>{t(rankInfo.name)}</Text>
                                            </Pressable>
                                        )}
                                    </View>
                                </View>
                                {!profile && (
                                    <PressableScale onPress={() => navigation.navigate('Profile')} style={styles.lxGuestCta}>
                                        <BingaIcon size={18} />
                                        <Text style={styles.lxGuestCtaText}>{t("Crée ton compte : binga, coffres, classement")}</Text>
                                    </PressableScale>
                                )}
                                <View style={styles.lxStats}>
                                    {[
                                        [UI.sParties, played, 'Parties'],
                                        [UI.sWins, wins, 'Victoires'],
                                        [UI.sStreak, best ?? '—', 'Série max'],
                                        [UI.sRate, `${rate}%`, 'Victoires %'],
                                    ].map(([icon, value, label], i) => (
                                        <View key={label} style={[styles.lxStat, i > 0 && styles.lxStatSep]} accessibilityLabel={`${label} : ${value}`}>
                                            <Image source={icon} style={styles.lxStatIcon} resizeMode="contain" />
                                            <Text style={styles.lxStatValue} numberOfLines={1}>{value}</Text>
                                        </View>
                                    ))}
                                </View>
                            </LuxePanel>
                        </Animated.View>

                        {/* Raccourcis */}
                        <Animated.View entering={FadeInUp.delay(200).springify().damping(16)} style={styles.lxTiles}>
                            <QuickTile compact={pageW < 380} icon={UI.collection} label={t("Collection")} onPress={() => navigation.navigate('Shop')} />
                            <QuickTile compact={pageW < 380} icon={UI.rewards} label={t("Cadeaux")} badge={wheelReady} onPress={() => navigation.navigate('Wheel')} />
                            <QuickTile compact={pageW < 380} icon={UI.rank} label={t("Classement")} onPress={() => navigation.navigate('Leaderboard')} />
                            <QuickTile compact={pageW < 380} icon={UI.friends} label={t("Amis")} badge={friends.incoming.length > 0} onPress={() => navigation.navigate('Friends')} />
                        </Animated.View>

                        {/* Modes de jeu */}
                        <Animated.View entering={FadeInUp.delay(280).springify().damping(16)} style={{ marginTop: 26 }}>
                            <LuxePanel style={styles.lxModes} colors={['#5C1020', '#2B0710']}>
                                {renderModes(cardW, modesInRow)}
                            </LuxePanel>
                            <RibbonTitle title={t("Modes de jeu")} style={styles.lxRibbon} />
                        </Animated.View>

                        <View style={styles.lxLinks}>
                            <PressableScale onPress={() => setShowRules(true)} style={styles.lxLink}>
                                <Text style={styles.lxLinkText}>{t("📜 Règles")}</Text>
                            </PressableScale>
                            {isConnected && (
                                <PressableScale onPress={() => { setInviteCode(null); setShowInvite(true); }} style={styles.lxLink}>
                                    <Text style={styles.lxLinkText}>{t("🔗 J'ai un lien d'invitation")}</Text>
                                </PressableScale>
                            )}
                        </View>
                        <InstallAppButton />

                        {/* Marrakech au coucher du soleil, pièces, cartes et thé */}
                        <Image source={LUXE_IMG.scene} style={{ width: pageW, height: pageW * 0.328, marginTop: 8, alignSelf: 'center' }} pointerEvents="none" />
                        <View style={styles.legalRow}>
                            <Text style={styles.legalLink} onPress={() => navigation.navigate('Legal', { doc: 'privacy' })}>{t("Confidentialité")}</Text>
                            <Text style={styles.legalDot}>·</Text>
                            <Text style={styles.legalLink} onPress={() => navigation.navigate('Legal', { doc: 'terms' })}>{t("Conditions d'utilisation")}</Text>
                        </View>
                    </View>
                </ScrollView>
            )}
            {hasConnected && !landscape && <AppNav navigation={navigation} current="home" />}

            {/* Choix du nombre de joueurs (en ligne ou contre l'ordinateur) */}
            <Modal visible={!!menu} transparent animationType="fade" onRequestClose={() => setMenu(null)}>
                <Pressable style={styles.lxSheetBg} onPress={() => setMenu(null)}>
                    <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 420 }}>
                        <LuxePanel style={{ padding: 16 }}>
                            <Text style={styles.lxSheetTitle}>{selected.label} · {menu === 'online' ? t('En ligne') : t("Contre l'ordinateur")}</Text>
                            {menu === 'online' && <SizePicker onPick={handleSearchMatch} colors={MODE_COLORS.red} showSearching />}
                            {menu === 'bot' && <SizePicker onPick={handleCreateBotRoom} colors={MODE_COLORS.blue} />}
                        </LuxePanel>
                    </Pressable>
                </Pressable>
            </Modal>

            <RulesModal visible={showRules && !inviteCode} onClose={closeRules} gameType={game} />
            <Onboarding
                visible={showOnboarding && nameReady && !inviteCode && !showInvite}
                name={name}
                hasAccount={!!profile}
                connected={isConnected}
                onPlay={startFirstGame}
                onClose={finishOnboarding}
            />
            <InstallPrompt
                ready={nameReady && focused && view === 'home' && !showRules && !showOnboarding && !showInvite && !inviteCode && !isSearching}
                onOpenChange={setInstallOpen}
                onLegal={(doc) => navigation.navigate('Legal', { doc })}
            />
            <DailyPopups
                profile={profile}
                isGuest={!account.token && !account.loading}
                ready={hasConnected && view === 'home' && !showRules && !showOnboarding && !showInvite && !inviteCode && !isSearching && !installOpen}
                navigation={navigation}
            />
            <InviteJoinSheet
                visible={showInvite}
                code={inviteCode}
                name={name}
                onChangeName={setName}
                busy={joining}
                onJoin={(code, n) => joinByCode(code, n)}
                onClose={() => { setShowInvite(false); setInviteCode(null); }}
            />
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
        backgroundColor: LUXE.night,
    },
    page: { width: '100%', maxWidth: 520, alignSelf: 'center' },
    archL: { position: 'absolute', top: -18, left: -18, width: 132, height: 120 },
    archR: { position: 'absolute', top: -18, right: -18, width: 132, height: 120, transform: [{ scaleX: -1 }] },
    lxTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 26, zIndex: 2 },
    lxCoins: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 6, paddingRight: 4, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: LUXE.gold, overflow: 'hidden' },
    lxCoinsText: { color: LUXE.cream, fontWeight: '900', fontSize: 16, minWidth: 28 },
    lxPlus: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#E2A92E', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: LUXE.goldLight },
    lxPlusText: { color: '#3A1A05', fontWeight: '900', fontSize: 17, lineHeight: 19 },
    lxSqIcon: { fontSize: 18 },
    lxCard: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 10, marginTop: 6 },
    lxCardRow: { flexDirection: 'row', alignItems: 'center' },
    lxNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    lxName: { color: LUXE.cream, fontSize: 22, fontWeight: '900', flexShrink: 1, textShadowColor: '#000', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
    lxEdit: { width: 26, height: 26, borderRadius: 8, borderWidth: 1.5, borderColor: LUXE.gold, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
    lxInput: { backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1.5, borderColor: LUXE.gold, borderRadius: 10, color: LUXE.cream, paddingHorizontal: 10, paddingVertical: 7, fontWeight: '800', fontSize: 16 },
    lxLevelRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
    lxXpText: { color: LUXE.dim, fontWeight: '800', fontSize: 11, marginTop: 3, textAlign: 'right' },
    lxRank: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, marginTop: 4, paddingRight: 10, paddingLeft: 2, paddingVertical: 2, borderRadius: 10, backgroundColor: 'rgba(142,18,27,0.75)', borderWidth: 1, borderColor: LUXE.gold },
    lxRankText: { color: LUXE.goldLight, fontWeight: '900', fontSize: 12 },
    lxGuestCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8, paddingVertical: 7, borderRadius: 12, backgroundColor: 'rgba(232,184,74,0.15)', borderWidth: 1, borderColor: 'rgba(232,184,74,0.6)' },
    lxGuestCtaText: { color: LUXE.goldLight, fontWeight: '800', fontSize: 12 },
    lxStats: { flexDirection: 'row', marginTop: 10, paddingVertical: 8, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(232,184,74,0.45)', backgroundColor: 'rgba(0,0,0,0.3)' },
    lxStat: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
    lxStatSep: { borderLeftWidth: 1, borderLeftColor: 'rgba(232,184,74,0.3)' },
    lxStatIcon: { width: 22, height: 22 },
    lxStatValue: { color: LUXE.cream, fontWeight: '900', fontSize: 15 },
    lxTiles: { flexDirection: 'row', gap: 8, marginTop: 14 },
    lxModes: { paddingHorizontal: 12, paddingTop: 30, paddingBottom: 16 },
    lxRibbon: { position: 'absolute', top: -18, left: 0, right: 0 },
    lxGames: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
    lxGame: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 5, paddingHorizontal: 4, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(232,184,74,0.3)', backgroundColor: 'rgba(0,0,0,0.3)' },
    lxGameOn: { borderColor: LUXE.goldLight, backgroundColor: 'rgba(232,184,74,0.22)' },
    lxGameText: { color: LUXE.cream, fontWeight: '900', fontSize: 12.5, flexShrink: 1 },
    lxTagline: { color: LUXE.dim, fontWeight: '700', fontSize: 11, textAlign: 'center', marginTop: 6, marginBottom: 10 },
    lxModeGrid: { flexDirection: 'row', justifyContent: 'space-between' },
    lxLinks: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' },
    lxLink: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(232,184,74,0.45)', backgroundColor: 'rgba(10,21,39,0.75)' },
    lxLinkText: { color: LUXE.goldLight, fontWeight: '800', fontSize: 12 },
    lsScene: { position: 'absolute', bottom: 0, left: 0, opacity: 0.6 },
    lsTop: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8 },
    lsPlayer: { flexDirection: 'row', alignItems: 'center' },
    lsName: { color: LUXE.cream, fontWeight: '900', fontSize: 19, textShadowColor: '#000', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
    lsLevel: { color: LUXE.cream, fontWeight: '800', fontSize: 12 },
    lsXp: { color: LUXE.dim, fontWeight: '800', fontSize: 10, marginTop: 2 },
    lsRight: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
    lsBody: { flex: 1, flexDirection: 'row', paddingHorizontal: 16, paddingTop: 4 },
    lsBox: { padding: 12 },
    lsBoxRow: { flexDirection: 'row', alignItems: 'center' },
    lsBoxTitle: { color: LUXE.goldLight, fontWeight: '900', fontSize: 15 },
    lsBoxSub: { color: LUXE.cream, fontWeight: '700', fontSize: 11, marginTop: 2 },
    lsBoxBtn: { alignSelf: 'flex-end', marginTop: 8, paddingHorizontal: 16, paddingVertical: 5, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#FFE9A8' },
    lsBoxBtnText: { color: '#3A1A05', fontWeight: '900', fontSize: 13 },
    lsTour: { flexDirection: 'row', alignItems: 'center', padding: 12 },
    lsTourTitle: { color: LUXE.goldLight, fontWeight: '900', fontSize: 19, textShadowColor: '#000', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
    lsTourSub: { color: LUXE.cream, fontWeight: '700', fontSize: 12, marginTop: 2 },
    lsTourBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 18, overflow: 'hidden', borderWidth: 1.5, borderColor: LUXE.goldLight },
    lsTourBtnText: { color: '#fff', fontWeight: '900', fontSize: 15, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 2 },
    lxSheetBg: { flex: 1, backgroundColor: 'rgba(4,8,18,0.82)', justifyContent: 'center', alignItems: 'center', padding: 16 },
    lxSizeHint: { color: LUXE.dim, fontWeight: '800', fontSize: 13, textAlign: 'center', marginTop: 4 },
    lxSizes: { flexDirection: 'row', gap: 10, justifyContent: 'center', marginTop: 12 },
    lxSize: { flex: 1, maxWidth: 110, aspectRatio: 0.9, borderRadius: 18, borderWidth: 2, borderColor: LUXE.goldLight, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    lxSizeShine: { position: 'absolute', top: 3, left: 8, right: 8, height: '36%', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.09)' },
    lxSizeNum: { color: '#fff', fontWeight: '900', fontSize: 34, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 2 } },
    lxSizeSub: { color: LUXE.goldLight, fontWeight: '800', fontSize: 12 },
    lxSheetTitle: { color: LUXE.goldLight, fontWeight: '900', fontSize: 17, textAlign: 'center', marginBottom: 4 },
    dim: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(6,12,28,0.45)',
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
    topBar: { flexDirection: 'row', alignItems: 'center', width: '100%', maxWidth: 560, gap: 8, padding: 8, borderRadius: 18, borderWidth: 1.5, borderColor: theme.gold, backgroundColor: 'rgba(14,26,56,0.92)' },
    topProfile: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
    topAvatar: { padding: 2, borderRadius: 30, borderWidth: 2, borderColor: '#F5D77A' },
    levelBadge: { position: 'absolute', right: -6, bottom: -4, minWidth: 22, height: 22, paddingHorizontal: 4, borderRadius: 11, backgroundColor: '#C9971E', borderWidth: 2, borderColor: '#FFE9A0', alignItems: 'center', justifyContent: 'center' },
    levelText: { color: '#3B1D06', fontSize: 11, fontWeight: '900' },
    topName: { color: theme.cream, fontSize: 15, fontWeight: '900' },
    topRank: { color: theme.goldLight, fontSize: 11, fontWeight: '800', marginTop: 1 },
    topXpRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    topXpBar: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.5)', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)' },
    topXpText: { color: theme.textDim, fontSize: 10, fontWeight: '800' },
    topRight: { alignItems: 'flex-end', gap: 6 },
    topCoins: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingLeft: 5, paddingRight: 4, paddingVertical: 4, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.6)' },
    topCoinsText: { color: theme.goldLight, fontSize: 15, fontWeight: '900' },
    topPlus: { width: 20, height: 20, borderRadius: 10, backgroundColor: theme.gold, alignItems: 'center', justifyContent: 'center' },
    topPlusText: { color: theme.bg, fontSize: 14, fontWeight: '900', marginTop: -1 },
    topIcons: { flexDirection: 'row', gap: 4 },
    guestBox: { width: '100%', maxWidth: 440, marginTop: 6, padding: 14, borderRadius: 18, borderWidth: 1.5, borderColor: theme.gold, backgroundColor: 'rgba(14,26,56,0.92)' },
    guestCta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
    guestCtaText: { color: theme.goldLight, fontWeight: '800', fontSize: 12 },
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
    logoSmall: { width: 120, height: 120 },
    playerCard: { width: '100%', maxWidth: 440, marginTop: 6, padding: 16, borderRadius: 22, borderWidth: 2, borderColor: theme.gold, backgroundColor: 'rgba(14,26,56,0.92)', shadowColor: '#F5D77A', shadowOpacity: 0.25, shadowRadius: 18, elevation: 8 },
    cardTop: { flexDirection: 'row', alignItems: 'center' },
    cardAvatar: { padding: 3, borderRadius: 46, borderWidth: 2, borderColor: '#F5D77A', backgroundColor: 'rgba(212,175,55,0.15)' },
    cardName: { color: theme.cream, fontSize: 22, fontWeight: '900' },
    cardInput: { color: theme.cream, fontSize: 18, fontWeight: '800', borderBottomWidth: 1.5, borderBottomColor: theme.gold, paddingVertical: 4 },
    cardRank: { color: theme.goldLight, fontSize: 14, fontWeight: '900', marginTop: 4 },
    xpRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
    xpBar: { flex: 1, height: 10, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.5)', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)' },
    xpFill: { height: '100%', backgroundColor: theme.gold, borderRadius: 5 },
    xpText: { color: theme.cream, fontWeight: '800', fontSize: 12 },
    coinRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.5)' },
    coinText: { color: theme.goldLight, fontSize: 26, fontWeight: '900' },
    coinLabel: { color: theme.cream, fontSize: 13, fontWeight: '800' },
    coinPlus: { marginLeft: 'auto', width: 30, height: 30, borderRadius: 15, backgroundColor: theme.gold, alignItems: 'center', justifyContent: 'center' },
    coinPlusText: { color: theme.bg, fontSize: 20, fontWeight: '900', marginTop: -2 },
    playWrap: { width: '100%', maxWidth: 440, marginTop: 18 },
    playBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 20, borderRadius: 24, backgroundColor: '#C9971E', borderWidth: 3, borderColor: '#FFE9A0', shadowColor: '#F5D77A', shadowOpacity: 0.6, shadowRadius: 18, elevation: 10 },
    playIcon: { color: '#3B1D06', fontSize: 26, fontWeight: '900' },
    playText: { color: '#3B1D06', fontSize: 34, fontWeight: '900', letterSpacing: 4 },
    tiles: { flexDirection: 'row', gap: 8, width: '100%', maxWidth: 440, marginTop: 16 },
    tile: { flex: 1, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.45)', backgroundColor: 'rgba(14,26,56,0.9)' },
    tileOn: { borderColor: '#F5D77A', backgroundColor: 'rgba(212,175,55,0.22)' },
    tileIcon: { fontSize: 28 },
    tileLabel: { color: theme.goldLight, fontWeight: '900', fontSize: 12, marginTop: 4 },
    tileSub: { color: theme.textDim, fontSize: 10, fontWeight: '700', marginTop: 1 },
    tileBadge: { position: 'absolute', top: -6, right: -4, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFF' },
    tileBadgeText: { color: '#fff', fontSize: 11, fontWeight: '900' },
    playHeader: { width: '100%', maxWidth: 440, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    playTitle: { color: theme.goldLight, fontSize: 18, fontWeight: '900' },
    homeBack: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, backgroundColor: 'rgba(212,175,55,0.18)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.5)' },
    homeBackText: { color: theme.goldLight, fontWeight: '900', fontSize: 13 },
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
    wheelChipOn: { borderColor: '#F5D77A', backgroundColor: 'rgba(212,175,55,0.25)' },
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
    inviteLink: { alignSelf: 'center', marginTop: 14, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(212,175,55,0.5)', backgroundColor: 'rgba(8,15,34,0.6)' },
    inviteLinkText: { color: theme.goldLight, fontWeight: '800', fontSize: 13 },
    legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 8 },
    legalLink: { color: 'rgba(243,233,220,0.75)', fontSize: 12, textDecorationLine: 'underline' },
    legalDot: { color: 'rgba(243,233,220,0.5)', fontSize: 12 },
    rulesLink: {
        marginTop: 18,
        paddingVertical: 10,
        paddingHorizontal: 22,
        borderRadius: 22,
        backgroundColor: 'rgba(8,15,34,0.75)',
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
