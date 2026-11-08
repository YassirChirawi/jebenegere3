import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, StatusBar, useWindowDimensions, Image } from 'react-native';
import Animated, {
    ZoomIn,
    useSharedValue,
    useAnimatedStyle,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import { recordGame, addXp } from '../utils/stats';

import MasterCard, { computeFan } from '../components/MasterCard';
import PlayerAvatar from '../components/PlayerAvatar';
import CircularTimer from '../components/CircularTimer';
import OpponentSeat from '../components/OpponentSeat';
import EndRoundOverlay from '../components/EndRoundOverlay';
import RulesModal from '../components/RulesModal';
import { DiscardPile, DeckPile } from '../components/TableCenter';
import { TurnBanner, ActionToast, SuitBadge, PenaltyBadge, SuitSelector, SUIT_INFO } from '../components/GameFx';
import { haptic, theme } from '../components/ui';
import { dialog } from '../components/Dialog';
import TableBackground from '../components/TableBackground';
import { requestReplay, useRoomChat, TopBar, ChatBubbles, ReactionBar, ChatSheet, ReactionBubble } from '../components/GameChrome';
import socketService from '../network/socketService';
import audioService from '../network/audioService';

export const SUITS = ['Oros', 'Copas', 'Espadas', 'Bastos'];
const MINT = require('../../assets/menthe-poivree-removebg-preview.png');

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
    // Après un 7 : la famille demandée, ou un autre 7
    if (state.activeSuitOverride) return card.suit === state.activeSuitOverride || card.value === 7;
    // Règle normale (le 7 compris) : même famille ou même valeur
    return card.suit === top.suit || card.value === top.value;
};

export default function GameScreen({ route, navigation }) {
    const { roomId, playerName, initialGameState, isHost } = route.params || {};
    const { width: winW, height: winH } = useWindowDimensions();
    const [board, setBoard] = useState(null);
    const stageW = board?.w ?? Math.min(winW, 500);
    const stageH = board?.h ?? winH;
    // Paysage : la table est nettement plus large que haute
    const land = stageW > stageH * 1.2;

    const [gameState, setGameState] = useState(initialGameState);
    const [showSuitSelector, setShowSuitSelector] = useState(false);
    const [pendingCardIndex, setPendingCardIndex] = useState(null);
    const [timeLeft, setTimeLeft] = useState(15);
    const [showRules, setShowRules] = useState(false);
    const { chatMessages, activeReactions, showChat: showChatMenu, setShowChat: setShowChatMenu, sendChat: handleSendChat, sendReaction: handleSendReaction } = useRoomChat(roomId);
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
                showBanner({ text: 'À TOI DE JOUER !', color: theme.gold, top: land ? '1%' : '64%', hold: 650 });
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

    // --- Statistiques / historique (communs à tous les jeux) ---
    const opponentsOf = (state) => {
        const me = getLocalIndex(state);
        return state.players?.filter((_, idx) => idx !== me).map((p) => p.name).join(', ') || 'Inconnus';
    };

    // --- Réaction aux changements d'état : sons, annonces, animations ---
    useEffect(() => {
        const prev = prevGameStateRef.current;
        prevGameStateRef.current = gameState;
        if (!prev || !gameState) return;

        const me = getLocalIndex(gameState);
        const player = me !== -1;

        // 0) Un joueur a quitté et un bot l'a remplacé
        (gameState.players || []).forEach((p, i) => {
            const before = prev.players?.[i];
            if (before && p && before.id !== p.id && p.replaced) {
                audioService.playSound('pop');
                showToast(`🔌 ${before.name} a quitté, un bot le remplace`, theme.textDim);
            }
        });

        // 0 bis) L'adversaire est parti : victoire par forfait
        if (!prev.forfeit && gameState.forfeit) {
            audioService.playSound('warning');
            showToast(`🔌 ${prev.players?.[gameState.forfeit.player]?.name || 'Ton adversaire'} est parti : victoire par forfait`, theme.mint);
        }

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
                recordGame({ game: 'hezz2', won: true, opponents: opponentsOf(gameState) });
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
                addXp(xp);
            }

            if (player && loser === me) {
                later(() => audioService.playSound('game_over'), 300);
                later(() => audioService.playSound('laugh', { volume: 0.5 }), 1700);
                recordGame({ game: 'hezz2', won: false, opponents: opponentsOf(gameState) });
            } else {
                later(() => audioService.playSound('laugh'), 500);
            }
            later(() => {
                audioService.playSound('whoosh');
                setShowEnd(true);
            }, 1100);
        }

        // Anti-blocage : avertissement au 1er tour manqué, puis coup automatique
        if (me >= 0 && gameState.afk?.[me] === 1 && prev.afk?.[me] !== 1) {
            audioService.playSound('warning');
            haptic('warning');
            showToast("⏱️ Tu n'as pas joué. Au prochain oubli, ton coup sera joué automatiquement.", '#F59E0B');
        }
        // Anti-blocage : un joueur absent a joué automatiquement
        if (gameState.autoPlay && gameState.autoPlay.n !== prev.autoPlay?.n) {
            const who = gameState.autoPlay.player === me ? 'Tu ne joues pas' : `${gameState.players?.[gameState.autoPlay.player]?.name || 'Un joueur'} ne joue pas`;
            showToast(`⏱️ ${who} : coup joué automatiquement`, '#F59E0B');
        }

        // 5) C'est à moi de jouer
        if (player && !gameState.mancheTerminee && gameState.turn === me && (prev.turn !== me || (!prev.pendingAction && gameState.pendingAction))) {
            const delay = isInitialDeal ? 1300 : 250;
            later(() => {
                haptic('medium');
                if (gameState.pendingAction?.type === 'skip_response') {
                    audioService.playSound('penalty');
                    showBanner({ text: 'DÉFENDS-TOI !', sub: 'Joue un 1 vite, sinon tu sautes ton tour', color: '#B91C1C', textColor: '#fff', top: land ? '1%' : '64%', hold: 1000 });
                } else if (gameState.drawPenalty > 0) {
                    audioService.playSound('your_turn');
                    showBanner({ text: `+${gameState.drawPenalty} POUR TOI !`, sub: 'Contre avec un 2 ou pioche', color: '#EA580C', textColor: '#fff', top: land ? '1%' : '64%', hold: 900 });
                } else {
                    audioService.playSound('your_turn');
                    showBanner({ text: 'À TOI DE JOUER !', color: theme.gold, top: land ? '1%' : '64%', hold: 650 });
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
        socketService.leaveRoom(roomId);
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

    // --- Main du joueur : tri par famille puis valeur, en gardant l'index serveur ---
    const myHand = !isSpectator ? gameState?.hands?.[localPlayerIndex] || [] : [];
    const handLayout = useMemo(() => {
        const sorted = myHand
            .map((card, idx) => ({ card, idx }))
            .sort((a, b) => (suitSort[a.card.suit] - suitSort[b.card.suit]) || (a.card.value - b.card.value));
        return computeFan(sorted, stageW, land);
    }, [myHand, stageW, land]);

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
                compact={land && pos === 'top'}
                finished={gameState.finishedPlayers?.includes(i)}
                isInitialDeal={isInitialDeal}
            />
        );
    };

    const turnName = gameState.turn === localPlayerIndex ? 'VOUS' : gameState.players?.[gameState.turn]?.name;
    const underAttack = gameState.pendingAction?.type === 'skip_response';
    const myId = socketService.socket?.id;
    const canReplay = gameState.hostId ? gameState.hostId === myId : (isHost || gameState.players?.[0]?.id === myId);

    return (
        <TableBackground onSize={setBoard}>
            <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

            <Animated.View style={[styles.board, shakeStyle]}>
                <TopBar
                    roomId={roomId}
                    land={land}
                    isMuted={isMuted}
                    onQuit={handleQuit}
                    onChat={() => setShowChatMenu(true)}
                    onMute={handleToggleMute}
                    onRules={() => setShowRules(true)}
                />

                {/* Adversaire en face */}
                <View style={[styles.topArea, land && styles.topAreaLand]}>{renderSeat('top')}</View>

                {/* Zone centrale */}
                <View style={styles.middleArea}>
                    <View style={styles.sideArea}>{renderSeat('left')}</View>

                    <View style={styles.center}>
                        <View style={[styles.toastSlot, land && styles.toastSlotLand]} pointerEvents="none">
                            <ActionToast toast={toast} />
                        </View>

                        <View style={land ? styles.centerLand : styles.centerCol}>
                        <View style={styles.pilesRow}>
                            <DeckPile count={gameState.deck.length} canDraw={canDraw} onDraw={handlePlayerDraw} />
                            <DiscardPile pile={gameState.middlePile} from={lastFrom} />
                        </View>

                        <View style={styles.centerCol}>
                        <View style={[styles.statusRow, land && styles.statusRowLand]}>
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
                        </View>
                    </View>

                    <View style={styles.sideArea}>{renderSeat('right')}</View>
                </View>

                <ChatBubbles messages={chatMessages} top={land ? 56 : 130} />

                {/* Joueur local */}
                <View style={[styles.playerArea, land && styles.playerAreaLand]}>
                    {isSpectator ? (
                        <View style={styles.spectatorBox}>
                            <Text style={styles.spectatorText}>👀 Vous êtes spectateur</Text>
                        </View>
                    ) : (
                        <>
                            <View style={[styles.meRow, land && styles.meRowLand]} pointerEvents="box-none">
                                <View style={styles.meInfo}>
                                    <View>
                                        <PlayerAvatar name={playerName || 'Vous'} size={38} active={isMyTurn} />
                                        <ReactionBubble emoji={activeReactions[localPlayerIndex]} />
                                    </View>
                                    <View style={[styles.mePill, isMyTurn && styles.mePillActive]}>
                                        <Text style={[styles.meName, isMyTurn && { color: theme.bg }]}>Vous · {myHand.length}</Text>
                                    </View>
                                    {isMyTurn && <Image source={MINT} style={styles.mint} />}
                                </View>
                                <ReactionBar land={land} onSend={handleSendReaction} />
                            </View>

                            <View style={[styles.hand, land && styles.handLand]}>
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

            <ChatSheet visible={showChatMenu} onClose={() => setShowChatMenu(false)} onSend={handleSendChat} />

            {showEnd && gameState.mancheTerminee && (
                <EndRoundOverlay
                    gameState={gameState}
                    localPlayerIndex={localPlayerIndex}
                    xpEarned={xpEarnedThisRound}
                    canReplay={canReplay}
                    onReplay={() => requestReplay(roomId)}
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
        overflow: 'hidden',
    },
    board: {
        flex: 1,
        paddingTop: 10,
        paddingBottom: 6,
    },
    topAreaLand: {
        height: 66,
        marginTop: 2,
    },
    centerCol: {
        alignItems: 'center',
    },
    centerLand: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    toastSlotLand: {
        position: 'absolute',
        top: -6,
        left: 0,
        right: 0,
        height: 30,
        marginBottom: 0,
        zIndex: 50,
    },
    statusRowLand: {
        minHeight: 0,
        marginTop: 0,
        marginBottom: 6,
        flexDirection: 'column',
        gap: 6,
    },
    playerAreaLand: {
        height: 128,
    },
    meRowLand: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 10,
        alignItems: 'flex-end',
    },
    handLand: {
        height: 128,
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
});
