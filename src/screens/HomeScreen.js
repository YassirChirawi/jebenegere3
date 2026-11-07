import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, ImageBackground, ScrollView } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    withDelay,
    withSpring,
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
import PlayerAvatar from '../components/PlayerAvatar';
import { CardFace, CardBack } from '../components/Card';
import { GameButton, IconButton, PressableScale, OrnamentDivider, theme } from '../components/ui';
import { dialog } from '../components/Dialog';
import { getRankInfo } from '../utils/stats';
import { GAMES, GAME_ORDER, gameInfo } from '../games';

const BG = require('../../assets/Yellow and White Illustrative Ramadan Greeting Instagram Post.png');

// Logo : trois figures en éventail qui respirent doucement
function LogoCards() {
    const sway = useSharedValue(0);
    const enter = useSharedValue(0);
    useEffect(() => {
        enter.value = withDelay(150, withSpring(1, { damping: 12, stiffness: 90 }));
        sway.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true);
    }, []);
    const cards = [
        { card: { suit: 'Bastos', value: 12 }, base: -18, x: -42 },
        { card: { suit: 'Copas', value: 11 }, base: 0, x: 0 },
        { card: { suit: 'Oros', value: 10 }, base: 18, x: 42 },
    ];
    return (
        <View style={styles.logoCards}>
            {cards.map(({ card, base, x }, i) => (
                <FanCard key={i} card={card} base={base} x={x} sway={sway} enter={enter} i={i} />
            ))}
        </View>
    );
}

function FanCard({ card, base, x, sway, enter, i }) {
    const style = useAnimatedStyle(() => ({
        transform: [
            { translateX: x * enter.value },
            { translateY: (1 - enter.value) * 40 + Math.abs(base) * 0.5 - sway.value * (i === 1 ? 6 : 3) },
            { rotateZ: `${base * enter.value + (sway.value - 0.5) * 4}deg` },
        ],
        opacity: enter.value,
    }));
    return (
        <Animated.View style={[styles.logoCard, { zIndex: i === 1 ? 2 : 1 }, style]}>
            <CardFace card={card} width={62} height={90} />
        </Animated.View>
    );
}

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
    const [roomIdInput, setRoomIdInput] = useState('');
    const [showRules, setShowRules] = useState(false);
    const [menu, setMenu] = useState(null); // 'online' | 'bot' | null
    const [game, setGame] = useState('hezz2');
    const selected = gameInfo(game);
    const [isMuted, setIsMuted] = useState(audioService.muted);
    const [musicOn, setMusicOn] = useState(audioService.musicOn);
    const [isConnected, setIsConnected] = useState(false);
    const [hasConnected, setHasConnected] = useState(false);
    const [rankInfo, setRankInfo] = useState(null);

    // Matchmaking
    const [isSearching, setIsSearching] = useState(false);
    const [searchingSize, setSearchingSize] = useState(null);
    const [searchSeconds, setSearchSeconds] = useState(0);
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
        })();

        return () => {
            offConnect();
            offDisconnect();
            offAudio();
            stopSearchUi();
        };
    }, []);

    // Recharger l'XP à chaque retour sur l'accueil (après une partie)
    useEffect(() => {
        const loadXp = async () => {
            try {
                const xp = parseInt((await AsyncStorage.getItem('playerXP')) || '0', 10);
                setRankInfo(getRankInfo(xp));
            } catch (e) { /* ignore */ }
        };
        loadXp();
        return navigation.addListener('focus', loadXp);
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

    const handleCreateRoom = () => {
        if (!requireName()) return;
        socketService.createRoom(name.trim(), game, (response) => {
            if (response?.success) {
                navigation.navigate('Lobby', { roomId: response.roomId, playerName: name.trim(), isHost: true, initialRoom: response.roomData });
            } else {
                dialog.alert('Erreur', 'Impossible de créer le salon.');
            }
        });
    };

    const handleJoinRoom = () => {
        if (!requireName()) return;
        const roomCode = roomIdInput.trim().toUpperCase();
        if (!roomCode) {
            audioService.playSound('error');
            dialog.alert('Code manquant', 'Entre le code du salon de ton ami.');
            return;
        }
        socketService.joinRoom(roomCode, name.trim(), (response) => {
            if (response?.success) {
                navigation.navigate('Lobby', { roomId: roomCode, playerName: name.trim(), isHost: false, initialRoom: response.roomData });
            } else {
                dialog.alert('Impossible de rejoindre', response?.message || 'Salon introuvable.');
            }
        });
    };

    const handleCreateBotRoom = (count) => {
        if (!requireName()) return;
        socketService.createBotRoom(name.trim(), count, game, (response) => {
            if (response?.success) {
                navigation.navigate('Game', { roomId: response.roomId, playerName: name.trim(), initialGameState: response.gameState, isHost: true });
            } else {
                dialog.alert('Erreur', "Impossible de créer la partie contre l'ordinateur.");
            }
        });
    };

    const stopSearchUi = () => {
        if (matchUnsub.current) matchUnsub.current();
        matchUnsub.current = null;
        clearInterval(searchTimer.current);
    };

    const handleSearchMatch = (size) => {
        if (!requireName()) return;
        setIsSearching(true);
        setSearchingSize(size);
        setSearchSeconds(0);
        setMenu(null);
        clearInterval(searchTimer.current);
        searchTimer.current = setInterval(() => setSearchSeconds((s) => s + 1), 1000);

        if (matchUnsub.current) matchUnsub.current();
        matchUnsub.current = socketService.onMatchFound((data) => {
            stopSearchUi();
            setIsSearching(false);
            audioService.playSound('your_turn');
            navigation.navigate('Game', {
                roomId: data.roomId,
                playerName: name.trim(),
                initialGameState: data.gameState,
                isHost: data.roomData?.hostId === socketService.socket?.id,
            });
        });

        socketService.findMatch(name.trim(), size, game, (res) => {
            if (res && !res.success) {
                stopSearchUi();
                setIsSearching(false);
                dialog.alert('Matchmaking', res.message);
            }
        });
    };

    const handleCancelSearch = () => {
        socketService.cancelMatch();
        stopSearchUi();
        setIsSearching(false);
        setSearchingSize(null);
    };

    const closeRules = () => {
        setShowRules(false);
        AsyncStorage.setItem('rulesSeen', '1').catch(() => {});
    };

    const toggleMenu = (m) => setMenu((cur) => (cur === m ? null : m));

    const SizePicker = ({ onPick, color }) => (
        <Animated.View entering={FadeInDown.springify().damping(15)} style={[styles.sizeMenu, { borderColor: color }]}>
            <Text style={styles.sizeTitle}>Nombre de joueurs</Text>
            <View style={styles.sizeRow}>
                {selected.sizes.map((n) => (
                    <PressableScale key={n} onPress={() => onPick(n)} style={[styles.sizeBtn, { backgroundColor: color }]}>
                        <Text style={styles.sizeNum}>{game === 'ronda' ? (n === 2 ? '1v1' : '2v2') : n}</Text>
                        <Text style={styles.sizeIcons}>{game === 'ronda' ? selected.sizeLabel(n) : '👤'.repeat(n)}</Text>
                    </PressableScale>
                ))}
            </View>
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
                        <IconButton icon="👤" onPress={() => navigation.navigate('Profile')} label="Profil" size={44} />
                        <View style={styles.headerRight}>
                            <IconButton icon={musicOn ? '🎵' : '🎶'} onPress={() => audioService.toggleMusic()} label="Musique" size={44} style={!musicOn && styles.iconOff} />
                            <IconButton icon={isMuted ? '🔇' : '🔊'} onPress={() => audioService.toggleMute()} label="Son" size={44} />
                        </View>
                    </View>

                    {/* Logo */}
                    <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.logo}>
                        <Animated.View style={[{ alignItems: 'center' }, titleStyle]}>
                            <LogoCards />
                            <Text style={styles.titleText}>JEBEN</Text>
                            <Text style={styles.titleHighlight}>GERE3</Text>
                            <Text style={styles.tagline}>جبن گرعة · Le jeu de cartes marocain</Text>
                        </Animated.View>
                    </Animated.View>

                    {!isConnected && (
                        <Animated.View entering={FadeIn} style={styles.reconnect}>
                            <Text style={styles.reconnectText}>⏳ Reconnexion au serveur…</Text>
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
                            <PlayerAvatar name={name || 'Joueur'} size={52} />
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={styles.label}>TON PSEUDO</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Ex : Yassir…"
                                    placeholderTextColor={theme.textDim}
                                    value={name}
                                    onChangeText={setName}
                                    maxLength={15}
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

                        {isSearching ? (
                            <Animated.View entering={ZoomIn.springify()} style={styles.searchBox}>
                                <SearchSpinner />
                                <Text style={styles.searchTitle}>Recherche d'adversaires…</Text>
                                <Text style={styles.searchSub}>Partie à {searchingSize} joueurs · {Math.floor(searchSeconds / 60)}:{String(searchSeconds % 60).padStart(2, '0')}</Text>
                                <Text style={styles.searchHint}>Des bots compléteront la table si l'attente est trop longue</Text>
                                <GameButton small title="Annuler" icon="✖" variant="outline" onPress={handleCancelSearch} style={{ marginTop: 12, alignSelf: 'stretch' }} />
                            </Animated.View>
                        ) : (
                            <>
                                <GameButton title={`JOUER EN LIGNE · ${selected.label.toUpperCase()}`} icon="🌍" variant="gold" onPress={() => toggleMenu('online')} disabled={!isConnected} style={{ marginTop: 16 }} />
                                {menu === 'online' && <SizePicker onPick={handleSearchMatch} color="#B8860B" />}

                                <GameButton title="CONTRE L'ORDINATEUR" icon="🤖" variant="green" onPress={() => toggleMenu('bot')} disabled={!isConnected} style={{ marginTop: 12 }} />
                                {menu === 'bot' && <SizePicker onPick={handleCreateBotRoom} color={theme.green} />}

                                <GameButton title="CRÉER UN SALON PRIVÉ" icon="🔒" variant="blue" onPress={handleCreateRoom} disabled={!isConnected} style={{ marginTop: 12 }} />

                                <OrnamentDivider label="REJOINDRE UN AMI" />

                                <View style={styles.joinRow}>
                                    <TextInput
                                        style={[styles.input, styles.codeInput]}
                                        placeholder="CODE"
                                        placeholderTextColor={theme.textDim}
                                        value={roomIdInput}
                                        onChangeText={(t) => setRoomIdInput(t.toUpperCase())}
                                        autoCapitalize="characters"
                                        maxLength={5}
                                    />
                                    <GameButton small title="REJOINDRE" variant="outline" onPress={handleJoinRoom} disabled={!isConnected} />
                                </View>
                            </>
                        )}
                    </Animated.View>

                    <PressableScale onPress={() => setShowRules(true)} style={styles.rulesLink}>
                        <Text style={styles.rulesLinkText}>📜 Lire les règles</Text>
                    </PressableScale>
                </ScrollView>
            )}

            <RulesModal visible={showRules} onClose={closeRules} gameType={game} />
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
                            {on && <View style={[styles.pickerDot, { backgroundColor: g.color }]} />}
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
    logoCards: {
        height: 104,
        width: 200,
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginBottom: 6,
    },
    logoCard: {
        position: 'absolute',
        bottom: 0,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 6,
        elevation: 8,
    },
    titleText: {
        fontSize: 44,
        fontWeight: '900',
        color: theme.cream,
        letterSpacing: 8,
        lineHeight: 48,
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 0, height: 3 },
        textShadowRadius: 6,
    },
    titleHighlight: {
        fontSize: 52,
        fontWeight: '900',
        color: theme.goldLight,
        letterSpacing: 6,
        lineHeight: 56,
        textShadowColor: 'rgba(212,175,55,0.75)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 18,
    },
    tagline: {
        color: theme.cream,
        fontSize: 13,
        fontWeight: '700',
        marginTop: 4,
        opacity: 0.9,
        textShadowColor: '#000',
        textShadowRadius: 4,
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
    pickerDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
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
