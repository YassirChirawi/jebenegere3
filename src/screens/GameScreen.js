import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, StatusBar, useWindowDimensions, Image, Pressable } from 'react-native';
import Animated, {
    FadeIn,
    FadeOut,
    ZoomIn,
    LinearTransition,
    SlideInDown,
    useSharedValue,
    useAnimatedStyle,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';

import MasterCard, { HAND_CARD_W } from '../components/MasterCard';
import PlayerAvatar from '../components/PlayerAvatar';
import CircularTimer from '../components/CircularTimer';
import OpponentSeat from '../components/OpponentSeat';
import EndRoundOverlay from '../components/EndRoundOverlay';
import RulesModal from '../components/RulesModal';
import { DiscardPile, DeckPile } from '../components/TableCenter';
import { TurnBanner, ActionToast, SuitBadge, PenaltyBadge, SuitSelector, SUIT_INFO } from '../components/GameFx';
import { IconButton, PressableScale, haptic, theme } from '../components/ui';
import { dialog } from '../components/Dialog';
import socketService from '../network/socketService';
import audioService from '../network/audioService';

export const SUITS = ['Oros', 'Copas', 'Espadas', 'Bastos'];
const TABLE_BG = require('../../assets/table.png');
const MINT = require('../../assets/menthe-poivree-removebg-preview.png');

const QUICK_MESSAGES = ['L3eb a zmagri !', 'Zid Jouj !', 'Hezz !', 'Zrebti 3lina...', 'Wry9a wa7da 😉', 'Saaaaaaaafi 😡'];
const REACTIONS = ['😂', '😡', '😱', '👏'];
const VALUE_NAMES = { 1: 'un 1', 2: 'un 2', 7: 'un 7', 10: 'une Sota', 11: 'un Cavalier', 12: 'un Roi' };
const suitSort = { Oros: 0, Copas: 1, Espadas: 2, Bastos: 3 };

const getLocalIndex = (state) => {
    const id = socketService.socket?.id;
    if (!state?.players || !id) return -1;
    return state.players.findIndex((p) => p.id === id);
};

// Validation locale (pour l'affichage uniquement, le serveur revalide)
const canPlayCardLocal = (card, state) => {
    const top = state.middlePile[state.middlePile.length - 1];
    if (state.pendingAction && state.pendingAction.type === 'skip_response') return card.value === 1;
    if (state.drawPenalty > 0) return card.value === 2;
    if (state.activeSuitOverride) return card.suit === state.activeSuitOverride || card.value === 7;
    return card.suit === top.suit || card.value === top.value || card.value === 7;
};

// Fond : cadré sur le tapis de la table (on coupe la fontaine en haut de l'image)
const TABLE_SRC = { w: 1211, h: 1536, feltTop: 400 };
function TableBackground({ children }) {
    const [size, setSize] = useState(null);
    let img = null;
    if (size) {
        const visibleH = TABLE_SRC.h - TABLE_SRC.feltTop;
        const scale = Math.max(size.h / visibleH, size.w / TABLE_SRC.w);
        const w = TABLE_SRC.w * scale;
        const h = TABLE_SRC.h * scale;
        img = { width: w, height: h, left: (size.w - w) / 2, top: size.h - h };
    }
    return (
        <View style={styles.container} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
            {img && <Image source={TABLE_BG} style={[{ position: 'absolute' }, img]} resizeMode="stretch" />}
            {children}
        </View>
    );
}

export default function GameScreen({ route, navigation }) {
    const { roomId, playerName, initialGameState, isHost } = route.params || {};
    const { width: winW } = useWindowDimensions();
    const stageW = Math.min(winW, 500);

    const [gameState, setGameState] = useState(initialGameState);
    const [showSuitSelector, setShowSuitSelector] = useState(false);
    const [pendingCardIndex, setPendingCardIndex] = useState(null);
    const [timeLeft, setTimeLeft] = useState(15);
    const [showRules, setShowRules] = useState(false);
    const [showChatMenu, setShowChatMenu] = useState(false);
    const [chatMessages, setChatMessages] = useState([]);
    const [activeReactions, setActiveReactions] = useState({});
    const [customMsg, setCustomMsg] = useState('');
    const [isInitialDeal, setIsInitialDeal] = useState(true);
    const [isMuted, setIsMuted] = useState(audioService.muted);
    const [xpEarnedThisRound, setXpEarnedThisRound] = useState(0);
    const [showEnd, setShowEnd] = useState(false);
    const [banner, setBanner] = useState(null);
    const [toast, setToast] = useState(null);
    const [lastFrom, setLastFrom] = useState('none');

    const prevGameStateRef = useRef(initialGameState);
    const hasAllocatedXP = useRef(false);
    const timers = useRef([]);
    const toastTimer = useRef(null);

    const later = (fn, ms) => {
        const t = setTimeout(fn, ms);
        timers.current.push(t);
        return t;
    };

    // --- Indices / sièges ---
    const localPlayerIndex = getLocalIndex(gameState);
    const isSpectator = localPlayerIndex === -1;
    const n = gameState?.hands?.length || 0;
    const pivot = isSpectator ? 0 : localPlayerIndex;

    const seatOf = useCallback((i) => {
        const rel = (i - pivot + n) % n;
        if (rel === 0) return 'bottom';
        const k = n - 1;
        if (k === 1) return 'top';
        if (k === 2) return rel === 1 ? 'left' : 'right';
        return ['left', 'top', 'right'][rel - 1] || 'top';
    }, [pivot, n]);

    const nameOf = (i, state = gameState) => (i === localPlayerIndex ? 'Vous' : state?.players?.[i]?.name || `Joueur ${i + 1}`);

    // --- Feedback visuel ---
    const shakeOffset = useSharedValue(0);
    const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeOffset.value }] }));
    const shake = (amp = 8) => {
        shakeOffset.value = withSequence(
            withTiming(amp, { duration: 45 }),
            withTiming(-amp, { duration: 45 }),
            withTiming(amp * 0.6, { duration: 45 }),
            withTiming(0, { duration: 45 })
        );
    };

    const showToast = (text, color) => {
        clearTimeout(toastTimer.current);
        setToast({ id: Date.now() + Math.random(), text, color });
        toastTimer.current = setTimeout(() => setToast(null), 2200);
    };

    const showBanner = (b) => setBanner({ ...b, id: Date.now() + Math.random() });

    const startDeal = (state) => {
        setIsInitialDeal(true);
        const me = getLocalIndex(state);
        const count = me >= 0 ? state.hands[me].length : 5;
        later(() => audioService.playDeal(Math.min(count + 2, 9), 95), 120);
        later(() => setIsInitialDeal(false), 1800);
        // Si je commence, on l'annonce une fois la distribution terminée
        if (me >= 0 && state.turn === me && !state.mancheTerminee) {
            later(() => {
                audioService.playSound('your_turn');
                showBanner({ text: 'À TOI DE JOUER !', color: theme.gold });
            }, 1500);
        }
    };

    // --- Montage : listeners réseau + musique en mode jeu ---
    useEffect(() => {
        audioService.setMusicMode('game');
        startDeal(initialGameState);

        const unsubs = [
            socketService.onGameStateUpdate((s) => setGameState(s)),
            socketService.onGameStarted((s) => {
                prevGameStateRef.current = null; // nouvelle manche : pas de diff avec l'ancienne
                hasAllocatedXP.current = false;
                setXpEarnedThisRound(0);
                setShowEnd(false);
                setGameState(s);
                startDeal(s);
            }),
            socketService.onTimerTick((d) => setTimeLeft(d.timeLeft)),
            socketService.onChatMessage((data) => {
                audioService.playSound('pop');
                setChatMessages((prev) => [...prev.slice(-3), data]);
                setTimeout(() => setChatMessages((prev) => prev.filter((m) => m.id !== data.id)), 3500);
            }),
            socketService.onPlayerReaction(({ playerIndex, reactionType }) => {
                audioService.playSound('pop', { rate: 1.15 });
                setActiveReactions((prev) => ({ ...prev, [playerIndex]: reactionType }));
                setTimeout(() => {
                    setActiveReactions((prev) => {
                        const next = { ...prev };
                        delete next[playerIndex];
                        return next;
                    });
                }, 2500);
            }),
            socketService.onGameError((err) => {
                audioService.playSound('error');
                showToast(`⚠️ ${err?.message || 'Action impossible'}`, theme.redLight);
            }),
        ];

        const unsubAudio = audioService.subscribe(({ muted }) => setIsMuted(muted));

        return () => {
            unsubs.forEach((u) => u && u());
            unsubAudio();
            timers.current.forEach(clearTimeout);
            clearTimeout(toastTimer.current);
            audioService.stopTickTock();
            audioService.setMusicMode('menu');
        };
    }, []);

    // --- Statistiques / historique ---
    const saveMatchHistory = async (result, state) => {
        try {
            const historyStr = await AsyncStorage.getItem('matchHistory');
            let history = historyStr ? JSON.parse(historyStr) : [];
            const me = getLocalIndex(state);
            const opponents = state.players?.filter((_, idx) => idx !== me).map((p) => p.name).join(', ') || 'Inconnus';
            history.unshift({
                id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
                date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
                result,
                opponents,
            });
            await AsyncStorage.setItem('matchHistory', JSON.stringify(history.slice(0, 10)));
        } catch (e) {
            console.error('Failed to save history', e);
        }
    };

    const incrementStat = async (key) => {
        try {
            const [gp, v] = await Promise.all([AsyncStorage.getItem('gamesPlayed'), AsyncStorage.getItem(key)]);
            await AsyncStorage.setItem('gamesPlayed', String(parseInt(gp || '0', 10) + 1));
            await AsyncStorage.setItem(key, String(parseInt(v || '0', 10) + 1));
        } catch (e) {
            console.error('Failed to update stats', e);
        }
    };

    // --- Réaction aux changements d'état : sons, annonces, animations ---
    useEffect(() => {
        const prev = prevGameStateRef.current;
        prevGameStateRef.current = gameState;
        if (!prev || !gameState) return;

        const me = getLocalIndex(gameState);
        const player = me !== -1;

        // 1) Une carte a été jouée
        const prevTop = prev.middlePile[prev.middlePile.length - 1];
        const newTop = gameState.middlePile[gameState.middlePile.length - 1];
        if (newTop && prevTop && newTop.id !== prevTop.id) {
            const by = prev.turn;
            setLastFrom(seatOf(by));
            audioService.playSound('card_play');
            const who = nameOf(by);
            if (newTop.value === 2) {
                later(() => audioService.playSound('plus_two'), 120);
                shake(10);
                haptic('heavy');
                if (by !== me) showToast(`${who} joue un 2 ! +${gameState.drawPenalty || 2} 🔥`, '#F87171');
            } else if (newTop.value === 1) {
                later(() => audioService.playSound('skip'), 120);
                shake(8);
                if (by !== me) showToast(`${who} joue un 1 ! ⛔`, '#60A5FA');
            } else if (newTop.value === 7) {
                later(() => audioService.playSound('change_suit'), 120);
                const info = SUIT_INFO[gameState.activeSuitOverride];
                if (by !== me && info) showToast(`${who} demande ${info.emoji} ${info.label}`, info.color);
            }
        }

        // 2) Pioches
        gameState.hands.forEach((hand, i) => {
            const diff = hand.length - (prev.hands[i]?.length ?? hand.length);
            if (diff <= 0) return;
            if (i === me) {
                if (diff >= 2) {
                    audioService.playSound('penalty');
                    showToast(`Tu pioches ${diff} cartes 😬`, '#F87171');
                }
            } else {
                for (let k = 0; k < Math.min(diff, 4); k++) {
                    later(() => audioService.playSound('card_draw', { volume: 0.35 }), k * 110);
                }
                if (diff >= 2) showToast(`${nameOf(i)} pioche ${diff} cartes 😂`, '#FCD34D');
            }
        });

        // 3) Joueurs sortis
        const prevFinished = prev.finishedPlayers || [];
        (gameState.finishedPlayers || []).forEach((i) => {
            if (prevFinished.includes(i)) return;
            if (i === me) {
                later(() => audioService.playSound('victory'), 250);
                audioService.stopTickTock();
                incrementStat('wins').then(() => saveMatchHistory('Victoire 🎉', gameState));
            } else if (!gameState.mancheTerminee) {
                later(() => audioService.playSound('player_out'), 250);
                showToast(`${nameOf(i)} a fini ses cartes ! 🏁`, theme.mint);
            }
        });

        // 4) Fin de manche
        if (!prev.mancheTerminee && gameState.mancheTerminee) {
            audioService.stopTickTock();
            const loser = gameState.loserIndex;

            if (player && !hasAllocatedXP.current) {
                hasAllocatedXP.current = true;
                // Place = ordre de sortie (le perdant est dernier)
                const order = gameState.finishedPlayers.filter((i) => i !== loser);
                const place = me === loser ? gameState.hands.length : order.indexOf(me) + 1;
                const xp = me === loser ? 10 : place === 1 ? 100 : place === 2 ? 50 : 20;
                setXpEarnedThisRound(xp);
                AsyncStorage.getItem('playerXP')
                    .then((cur) => AsyncStorage.setItem('playerXP', String(parseInt(cur || '0', 10) + xp)))
                    .catch(() => {});
            }

            if (player && loser === me) {
                later(() => audioService.playSound('game_over'), 300);
                later(() => audioService.playSound('laugh', { volume: 0.5 }), 1700);
                incrementStat('losses').then(() => saveMatchHistory('Défaite 💀', gameState));
            } else {
                later(() => audioService.playSound('laugh'), 500);
            }
            later(() => {
                audioService.playSound('whoosh');
                setShowEnd(true);
            }, 1100);
        }

        // 5) C'est à moi de jouer
        if (player && !gameState.mancheTerminee && gameState.turn === me && (prev.turn !== me || (!prev.pendingAction && gameState.pendingAction))) {
            const delay = isInitialDeal ? 1300 : 250;
            later(() => {
                haptic('medium');
                if (gameState.pendingAction?.type === 'skip_response') {
                    audioService.playSound('penalty');
                    showBanner({ text: 'DÉFENDS-TOI !', sub: 'Joue un 1 vite, sinon tu sautes ton tour', color: '#B91C1C', textColor: '#fff' });
                } else if (gameState.drawPenalty > 0) {
                    audioService.playSound('your_turn');
                    showBanner({ text: `+${gameState.drawPenalty} POUR TOI !`, sub: 'Contre avec un 2 ou pioche', color: '#EA580C', textColor: '#fff' });
                } else {
                    audioService.playSound('your_turn');
                    showBanner({ text: 'À TOI DE JOUER !', color: theme.gold });
                }
            }, delay);
        }
    }, [gameState]);

    // --- Tic-tac : uniquement pendant MON tour, dans les dernières secondes ---
    const isMyTurn = !isSpectator && gameState?.turn === localPlayerIndex && !gameState?.mancheTerminee;
    useEffect(() => {
        if (isMyTurn && timeLeft <= 5 && timeLeft > 0) audioService.startTickTock();
        else audioService.stopTickTock();
    }, [timeLeft, isMyTurn]);

    // --- Actions ---
    const leave = () => {
        audioService.stopTickTock();
        socketService.leaveRoom();
        navigation.popToTop();
    };

    const handleQuit = () => {
        dialog.alert('Quitter la partie ?', 'Tu vas abandonner la manche en cours.', [
            { text: 'Rester', style: 'cancel' },
            { text: 'Quitter', style: 'destructive', onPress: leave },
        ]);
    };

    const handleEndQuit = () => {
        if (gameState?.players?.some((p) => p.isBot)) return leave();
        dialog.alert('Quitter le salon ?', 'Les autres joueurs continueront sans toi.', [
            { text: 'Rester', style: 'cancel' },
            { text: 'Quitter', style: 'destructive', onPress: leave },
        ]);
    };

    const handleToggleMute = async () => {
        const m = await audioService.toggleMute();
        setIsMuted(m);
    };

    const handlePlayerPlayCard = (cardIndex) => {
        if (!isMyTurn) return;
        const card = gameState.hands[localPlayerIndex][cardIndex];
        if (!card || !canPlayCardLocal(card, gameState)) return;
        if (card.value === 7) {
            setPendingCardIndex(cardIndex);
            setShowSuitSelector(true);
            audioService.playSound('whoosh');
        } else {
            socketService.playCard(roomId, cardIndex, null);
        }
    };

    const handleSuitSelected = (suit) => {
        setShowSuitSelector(false);
        if (pendingCardIndex !== null) {
            socketService.playCard(roomId, pendingCardIndex, suit);
            setPendingCardIndex(null);
        }
    };

    const canDraw = isMyTurn && !gameState?.pendingAction;
    const handlePlayerDraw = () => {
        if (!canDraw) return;
        haptic('light');
        socketService.drawCard(roomId);
    };

    const handleSendChat = (message) => {
        socketService.sendChat(roomId, message);
        setShowChatMenu(false);
    };

    const handleSendReaction = (reaction) => {
        socketService.sendReaction(roomId, reaction);
        setShowChatMenu(false);
    };

    // --- Main du joueur : tri par famille puis valeur, en gardant l'index serveur ---
    const myHand = !isSpectator ? gameState?.hands?.[localPlayerIndex] || [] : [];
    const handLayout = useMemo(() => {
        const sorted = myHand
            .map((card, idx) => ({ card, idx }))
            .sort((a, b) => (suitSort[a.card.suit] - suitSort[b.card.suit]) || (a.card.value - b.card.value));
        const count = sorted.length;
        const avail = stageW - 28;
        const step = count > 1 ? Math.min(HAND_CARD_W * 0.78, (avail - HAND_CARD_W) / (count - 1)) : 0;
        const totalW = step * (count - 1) + HAND_CARD_W;
        const startX = (stageW - totalW) / 2;
        const angleStep = count > 1 ? Math.min(6, 40 / count) : 0;
        const mid = (count - 1) / 2;
        return sorted.map((entry, i) => {
            const off = i - mid;
            const angle = off * angleStep;
            const arcY = (1 - Math.cos((angle * Math.PI) / 180)) * 420;
            return { ...entry, x: startX + i * step, angle, arcY };
        });
    }, [myHand, stageW]);

    if (!gameState) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: theme.gold }}>Chargement...</Text>
            </View>
        );
    }

    const opponents = gameState.players
        ? gameState.hands.map((h, i) => i).filter((i) => i !== pivot)
        : [];
    const seatPlayers = { top: null, left: null, right: null };
    opponents.forEach((i) => {
        const s = seatOf(i);
        if (s !== 'bottom') seatPlayers[s] = i;
    });

    const renderSeat = (pos) => {
        const i = seatPlayers[pos];
        if (i === null || i === undefined) return null;
        return (
            <OpponentSeat
                player={gameState.players[i]}
                isBot={gameState.players[i]?.isBot}
                handSize={gameState.hands[i].length}
                active={gameState.turn === i && !gameState.mancheTerminee}
                reaction={activeReactions[i]}
                position={pos}
                finished={gameState.finishedPlayers?.includes(i)}
                isInitialDeal={isInitialDeal}
            />
        );
    };

    const turnName = gameState.turn === localPlayerIndex ? 'VOUS' : gameState.players?.[gameState.turn]?.name;
    const underAttack = gameState.pendingAction?.type === 'skip_response';
    const canReplay = isHost || gameState.players?.[0]?.id === socketService.socket?.id;

    return (
        <TableBackground>
            <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

            {/* Vignette pour faire ressortir le centre de la table */}
            <Svg style={StyleSheet.absoluteFill} pointerEvents="none" width="100%" height="100%">
                <Defs>
                    <RadialGradient id="vignette" cx="50%" cy="55%" rx="75%" ry="65%">
                        <Stop offset="0.45" stopColor="#000" stopOpacity="0" />
                        <Stop offset="1" stopColor="#000" stopOpacity="0.75" />
                    </RadialGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#vignette)" />
            </Svg>

            <Animated.View style={[styles.board, shakeStyle]}>
                {/* Barre du haut */}
                <View style={styles.topBar}>
                    <View style={styles.topBtns}>
                        <IconButton icon="🚪" onPress={handleQuit} label="Quitter" size={38} />
                        <IconButton icon="💬" onPress={() => setShowChatMenu(true)} label="Chat" size={38} />
                    </View>
                    {roomId ? (
                        <View style={styles.roomPill}>
                            <Text style={styles.roomPillText}>SALON {roomId}</Text>
                        </View>
                    ) : null}
                    <View style={styles.topBtns}>
                        <IconButton icon={isMuted ? '🔇' : '🔊'} onPress={handleToggleMute} label="Son" size={38} />
                        <IconButton icon="📜" onPress={() => setShowRules(true)} label="Règles" size={38} />
                    </View>
                </View>

                {/* Adversaire en face */}
                <View style={styles.topArea}>{renderSeat('top')}</View>

                {/* Zone centrale */}
                <View style={styles.middleArea}>
                    <View style={styles.sideArea}>{renderSeat('left')}</View>

                    <View style={styles.center}>
                        <View style={styles.toastSlot}>
                            <ActionToast toast={toast} />
                        </View>

                        <View style={styles.pilesRow}>
                            <DeckPile count={gameState.deck.length} canDraw={canDraw} onDraw={handlePlayerDraw} />
                            <DiscardPile pile={gameState.middlePile} from={lastFrom} />
                        </View>

                        <View style={styles.statusRow}>
                            {gameState.activeSuitOverride ? <SuitBadge suit={gameState.activeSuitOverride} /> : null}
                            {gameState.drawPenalty > 0 ? <PenaltyBadge amount={gameState.drawPenalty} /> : null}
                        </View>

                        {!gameState.mancheTerminee && (
                            <View style={[styles.turnChip, isMyTurn && styles.turnChipMine, underAttack && styles.turnChipDanger]}>
                                <CircularTimer timeLeft={timeLeft} maxTime={gameState.pendingAction ? 3 : 15} size={40} />
                                <View style={{ marginLeft: 8, flexShrink: 1 }}>
                                    <Text style={[styles.turnLabel, isMyTurn && { color: theme.bg }]}>
                                        {underAttack ? 'ATTAQUE !' : 'TOUR DE'}
                                    </Text>
                                    <Text style={[styles.turnName, isMyTurn && { color: theme.bg }]} numberOfLines={1}>
                                        {underAttack && isMyTurn ? 'Joue un 1 !' : turnName}
                                    </Text>
                                </View>
                            </View>
                        )}
                    </View>

                    <View style={styles.sideArea}>{renderSeat('right')}</View>
                </View>

                {/* Messages de chat flottants */}
                <View style={styles.chatOverlay} pointerEvents="none">
                    {chatMessages.map((msg) => (
                        <Animated.View
                            key={msg.id}
                            style={styles.chatBubble}
                            entering={ZoomIn.springify().damping(12)}
                            exiting={FadeOut}
                            layout={LinearTransition.springify()}
                        >
                            <Text style={styles.chatText}>
                                <Text style={styles.chatName}>{msg.playerName} : </Text>
                                {msg.message}
                            </Text>
                        </Animated.View>
                    ))}
                </View>

                {/* Joueur local */}
                <View style={styles.playerArea}>
                    {isSpectator ? (
                        <View style={styles.spectatorBox}>
                            <Text style={styles.spectatorText}>👀 Vous êtes spectateur</Text>
                        </View>
                    ) : (
                        <>
                            <View style={styles.meRow}>
                                <View style={styles.meInfo}>
                                    <View>
                                        <PlayerAvatar name={playerName || 'Vous'} size={38} active={isMyTurn} />
                                        {activeReactions[localPlayerIndex] && (
                                            <Animated.View entering={ZoomIn.springify().damping(9)} exiting={FadeOut} style={styles.meReaction}>
                                                <Text style={{ fontSize: 26 }}>{activeReactions[localPlayerIndex]}</Text>
                                            </Animated.View>
                                        )}
                                    </View>
                                    <View style={[styles.mePill, isMyTurn && styles.mePillActive]}>
                                        <Text style={[styles.meName, isMyTurn && { color: theme.bg }]}>Vous · {myHand.length}</Text>
                                    </View>
                                    {isMyTurn && <Image source={MINT} style={styles.mint} />}
                                </View>
                                <View style={styles.reactionBar}>
                                    {REACTIONS.map((emoji) => (
                                        <PressableScale key={emoji} sound={null} scaleTo={0.8} style={styles.reactionBtn} onPress={() => handleSendReaction(emoji)}>
                                            <Text style={styles.reactionBtnText}>{emoji}</Text>
                                        </PressableScale>
                                    ))}
                                </View>
                            </View>

                            <View style={styles.hand}>
                                {handLayout.map(({ card, idx, x, angle, arcY }, i) => (
                                    <MasterCard
                                        key={card.id}
                                        card={card}
                                        index={i}
                                        x={x}
                                        angle={angle}
                                        arcY={arcY}
                                        isMyTurn={isMyTurn}
                                        isPlayable={isMyTurn && canPlayCardLocal(card, gameState)}
                                        onPlay={() => handlePlayerPlayCard(idx)}
                                        isInitialDeal={isInitialDeal}
                                    />
                                ))}
                                {gameState.finishedPlayers?.includes(localPlayerIndex) && !gameState.mancheTerminee && (
                                    <Animated.View entering={ZoomIn.springify()} style={styles.doneBox}>
                                        <Text style={styles.doneText}>🏁 Tu as fini ! Regarde les autres se battre…</Text>
                                    </Animated.View>
                                )}
                            </View>
                        </>
                    )}
                </View>
            </Animated.View>

            <TurnBanner banner={banner} />

            {showSuitSelector && (
                <SuitSelector
                    onSelect={handleSuitSelected}
                    onCancel={() => {
                        setShowSuitSelector(false);
                        setPendingCardIndex(null);
                    }}
                />
            )}

            {showChatMenu && (
                <Animated.View entering={FadeIn.duration(150)} style={styles.sheetOverlay}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowChatMenu(false)} />
                    <Animated.View entering={SlideInDown.springify().damping(16)} style={styles.sheet}>
                        <View style={styles.sheetHandle} />
                        <Text style={styles.sheetTitle}>💬 Message rapide</Text>
                        <View style={styles.customRow}>
                            <TextInput
                                style={styles.customInput}
                                placeholder="Message personnalisé..."
                                placeholderTextColor={theme.textDim}
                                value={customMsg}
                                onChangeText={setCustomMsg}
                                maxLength={60}
                                onSubmitEditing={() => {
                                    if (customMsg.trim()) {
                                        handleSendChat(customMsg.trim());
                                        setCustomMsg('');
                                    }
                                }}
                            />
                            <PressableScale
                                style={styles.sendBtn}
                                onPress={() => {
                                    if (customMsg.trim()) {
                                        handleSendChat(customMsg.trim());
                                        setCustomMsg('');
                                    }
                                }}
                            >
                                <Text style={styles.sendText}>➤</Text>
                            </PressableScale>
                        </View>
                        <View style={styles.quickGrid}>
                            {QUICK_MESSAGES.map((msg) => (
                                <PressableScale key={msg} style={styles.quickBtn} onPress={() => handleSendChat(msg)}>
                                    <Text style={styles.quickText}>{msg}</Text>
                                </PressableScale>
                            ))}
                        </View>
                    </Animated.View>
                </Animated.View>
            )}

            {showEnd && gameState.mancheTerminee && (
                <EndRoundOverlay
                    gameState={gameState}
                    localPlayerIndex={localPlayerIndex}
                    xpEarned={xpEarnedThisRound}
                    canReplay={canReplay}
                    onReplay={() => socketService.playAgain(roomId)}
                    onQuit={handleEndQuit}
                />
            )}

            <RulesModal visible={showRules} onClose={() => setShowRules(false)} />
        </TableBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.bg,
    },
    board: {
        flex: 1,
        paddingTop: 10,
        paddingBottom: 6,
    },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 12,
        zIndex: 20,
    },
    topBtns: {
        flexDirection: 'row',
        gap: 8,
    },
    roomPill: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.35)',
    },
    roomPillText: {
        color: theme.goldLight,
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1.5,
    },
    topArea: {
        height: 118,
        justifyContent: 'center',
        alignItems: 'center',
    },
    middleArea: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    sideArea: {
        width: 84,
        alignItems: 'center',
        justifyContent: 'center',
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    toastSlot: {
        height: 34,
        width: '100%',
        justifyContent: 'center',
        marginBottom: 4,
    },
    pilesRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        minHeight: 46,
        marginTop: 6,
    },
    turnChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(12,5,7,0.78)',
        borderRadius: 26,
        paddingVertical: 4,
        paddingLeft: 4,
        paddingRight: 14,
        borderWidth: 1.5,
        borderColor: 'rgba(212,175,55,0.45)',
        maxWidth: '100%',
    },
    turnChipMine: {
        backgroundColor: theme.gold,
        borderColor: theme.goldLight,
    },
    turnChipDanger: {
        borderColor: '#EF4444',
    },
    turnLabel: {
        color: theme.textDim,
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 1.5,
    },
    turnName: {
        color: theme.cream,
        fontSize: 15,
        fontWeight: '900',
    },
    chatOverlay: {
        position: 'absolute',
        top: 130,
        left: 16,
        right: 16,
        alignItems: 'center',
        zIndex: 40,
    },
    chatBubble: {
        backgroundColor: '#FFF8E7',
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 16,
        borderBottomLeftRadius: 4,
        marginBottom: 6,
        borderWidth: 1.5,
        borderColor: theme.gold,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.35,
        shadowRadius: 4,
        elevation: 8,
    },
    chatText: {
        fontSize: 14,
        color: '#2A1419',
        fontWeight: '700',
    },
    chatName: {
        color: '#B91C1C',
        fontWeight: '900',
    },
    playerArea: {
        height: 190,
        justifyContent: 'flex-end',
    },
    meRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        zIndex: 600,
    },
    meInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    mePill: {
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 10,
        backgroundColor: 'rgba(10,4,6,0.7)',
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.35)',
    },
    mePillActive: {
        backgroundColor: theme.gold,
        borderColor: theme.goldLight,
    },
    meName: {
        color: theme.cream,
        fontWeight: '900',
        fontSize: 13,
    },
    mint: {
        width: 28,
        height: 28,
        resizeMode: 'contain',
    },
    meReaction: {
        position: 'absolute',
        top: -36,
        left: -4,
        backgroundColor: '#fff',
        borderRadius: 16,
        paddingHorizontal: 4,
        zIndex: 50,
    },
    reactionBar: {
        flexDirection: 'row',
        gap: 6,
    },
    reactionBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(10,4,6,0.6)',
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.45)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    reactionBtnText: {
        fontSize: 18,
    },
    hand: {
        height: 140,
        width: '100%',
    },
    doneBox: {
        position: 'absolute',
        left: 20,
        right: 20,
        top: 40,
        backgroundColor: 'rgba(6,95,70,0.85)',
        borderColor: theme.mint,
        borderWidth: 1.5,
        borderRadius: 14,
        padding: 12,
        alignItems: 'center',
    },
    doneText: {
        color: '#ECFDF5',
        fontWeight: '800',
        textAlign: 'center',
    },
    spectatorBox: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
    },
    spectatorText: {
        color: theme.goldLight,
        fontSize: 18,
        fontWeight: '900',
    },
    sheetOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
        zIndex: 9000,
        elevation: 9000,
    },
    sheet: {
        backgroundColor: theme.panelSolid,
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        borderWidth: 2,
        borderBottomWidth: 0,
        borderColor: theme.gold,
        padding: 18,
        paddingBottom: 28,
    },
    sheetHandle: {
        alignSelf: 'center',
        width: 44,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(212,175,55,0.5)',
        marginBottom: 12,
    },
    sheetTitle: {
        color: theme.goldLight,
        fontSize: 18,
        fontWeight: '900',
        marginBottom: 12,
        textAlign: 'center',
    },
    customRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 14,
    },
    customInput: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: 'rgba(212,175,55,0.5)',
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: theme.cream,
        fontSize: 15,
    },
    sendBtn: {
        width: 46,
        borderRadius: 12,
        backgroundColor: theme.gold,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendText: {
        color: theme.bg,
        fontSize: 18,
        fontWeight: '900',
    },
    quickGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    quickBtn: {
        width: '48.5%',
        paddingVertical: 11,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.35)',
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.45)',
        alignItems: 'center',
    },
    quickText: {
        color: theme.cream,
        fontWeight: '800',
        fontSize: 14,
    },
});
