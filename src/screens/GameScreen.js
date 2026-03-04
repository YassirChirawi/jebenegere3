import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ImageBackground, Image, TextInput, StatusBar } from 'react-native';
import Animated, {
    LinearTransition,
    FadeIn,
    FadeInDown,
    FadeInUp,
    useSharedValue,
    useAnimatedStyle,
    withSequence,
    withTiming
} from 'react-native-reanimated';
import Card from '../components/Card';
import MasterCard from '../components/MasterCard';
import PlayerAvatar from '../components/PlayerAvatar';
import CircularTimer from '../components/CircularTimer';
import socketService from '../network/socketService';
import audioService from '../network/audioService';
import RulesModal from '../components/RulesModal';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRankInfo } from '../utils/stats';

export const SUITS = ['Oros', 'Copas', 'Espadas', 'Bastos'];
const TABLE_BG = require('../../assets/table.png');
const GAME_LOGO_BACK = require('../../assets/icon.png');

export default function GameScreen({ route, navigation }) {
    const { roomId, playerName, initialGameState, isHost } = route.params || {};

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
    const prevGameStateRef = useRef(initialGameState);
    const hasAllocatedXP = useRef(false);

    const handleQuit = () => {
        Alert.alert(
            'Quitter la partie',
            'Êtes-vous sûr de vouloir quitter ?',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Quitter', style: 'destructive',
                    onPress: () => {
                        audioService.stopTickTock();
                        socketService.disconnect();
                        navigation.navigate('Home');
                    },
                },
            ]
        );
    };

    const handleForceQuit = () => {
        const isBotMatch = gameState?.players?.some(p => p.isBot);

        if (isBotMatch) {
            audioService.stopTickTock();
            socketService.disconnect();
            navigation.navigate('Home');
        } else {
            // Demande de confirmation si c'est une vraie partie en ligne
            Alert.alert(
                'Quitter le salon ?',
                'Êtes-vous sûr de vouloir quitter le salon multijoueur ?',
                [
                    { text: 'Rester', style: 'cancel' },
                    {
                        text: 'Quitter', style: 'destructive',
                        onPress: () => {
                            audioService.stopTickTock();
                            socketService.disconnect();
                            navigation.navigate('Home');
                        },
                    },
                ]
            );
        }
    };

    const handleToggleMute = async () => {
        const newMuted = await audioService.toggleMute();
        setIsMuted(newMuted);
    };

    // --- Screen Shake Animation Value ---
    const shakeOffset = useSharedValue(0);

    const shakeAnimatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateX: shakeOffset.value }]
        };
    });

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsInitialDeal(false);
        }, 2500);
        return () => clearTimeout(timer);
    }, []);

    // Identify the index of the local player in hands based on socket id
    const localPlayerId = socketService.socket ? socketService.socket.id : null;
    let localPlayerIndex = -1;
    let isSpectator = false;

    if (gameState && localPlayerId) {
        // Room activePlayers and spectators lists are not in gameState directly.
        // But hands is an array of size N. We need to know which hand belongs to us.
        // Simple approach: The server sends gameState.hands as an array, but wait!
        // The server needs to send the player index mapping in gameState, or we just rely on roomData.

        // As a fix for now, we will add 'players' array to GameEngine.js initializeGame, but since we didn't, 
        // we will fetch our index from a custom 'playerMappping' if we had one.
        // Actually, the server can append { players: room.activePlayers } before emitting game_state_update.
    }

    useEffect(() => {
        socketService.onGameStateUpdate((newState) => {
            setGameState(newState);
        });

        socketService.onGameStarted((newState) => {
            setGameState(newState);
            setIsInitialDeal(true);
            setXpEarnedThisRound(0);
            hasAllocatedXP.current = false;
            const timer = setTimeout(() => {
                setIsInitialDeal(false);
            }, 2500);
            return () => clearTimeout(timer);
        });

        socketService.onTimerTick((data) => {
            setTimeLeft(data.timeLeft);
        });

        socketService.onChatMessage((data) => {
            setChatMessages(prev => [...prev, data]);
            // Optional: Auto-hide message after 3 seconds
            setTimeout(() => {
                setChatMessages(prev => prev.filter(msg => msg.id !== data.id));
            }, 3000);
        });

        socketService.onPlayerReaction((data) => {
            const { playerIndex, reactionType } = data;
            setActiveReactions(prev => ({ ...prev, [playerIndex]: reactionType }));

            // Clear reaction after 2 seconds
            setTimeout(() => {
                setActiveReactions(prev => {
                    const newState = { ...prev };
                    delete newState[playerIndex];
                    return newState;
                });
            }, 2500);
        });

        return () => {
            audioService.stopTickTock();
            socketService.offAll(); // Ensure we clean up listeners
        };
    }, []);

    // Effets sonores basés sur l'évolution de la partie
    useEffect(() => {
        const prevState = prevGameStateRef.current;
        if (!prevState || !gameState) return;

        // GESTION MANCHE TERMINEE (XP)
        if (!prevState.mancheTerminee && gameState.mancheTerminee && gameState.players && gameState.scores) {
            audioService.playEndRound();

            if (!hasAllocatedXP.current) {
                hasAllocatedXP.current = true;

                // Calculer le classement du joueur local
                let rank = 1;
                const myScore = gameState.scores[localPlayerIndex];

                gameState.scores.forEach(score => {
                    if (score < myScore) {
                        rank++;
                    }
                });

                // Calcul XP : 1er(100), 2ème(50), 3ème(20), Dernier(10)
                let xpToGive = 10;
                if (rank === 1) xpToGive = 100;
                else if (rank === 2) xpToGive = 50;
                else if (rank === 3) xpToGive = 20;

                setXpEarnedThisRound(xpToGive);

                // Sauvegarder dans AsyncStorage
                AsyncStorage.getItem('playerXP').then(currentXp => {
                    const newXp = parseInt(currentXx || '0', 10) + xpToGive;
                    AsyncStorage.setItem('playerXP', newXp.toString());
                });
            }
        }

        // Si le tour a changé et que la manche n'est pas finie
        if (prevState.turn !== gameState.turn && !gameState.mancheTerminee) {
            // Déterminer quelle carte vient d'être jouée en comparant le milieu
            const prevTop = prevState.middlePile[prevState.middlePile.length - 1];
            const newTop = gameState.middlePile[gameState.middlePile.length - 1];
            const cardWasPlayed = newTop && prevTop && newTop.id !== prevTop.id;

            if (cardWasPlayed) {
                if (newTop.value === 2) {
                    audioService.playSound('plus_two'); // Zid Jouj !
                } else if (newTop.value === 1) {
                    audioService.playSound('skip');
                } else if (newTop.value === 7) {
                    audioService.playSound('change_suit');
                } else {
                    audioService.playSound('turn'); // Son flipcard normal
                }
            } else {
                // Tour passé sans jouer de carte (pioche automatique)
                audioService.playSound('turn');
            }
        }

        // Helper pour l'historique
        const saveMatchHistory = async (result) => {
            try {
                const historyStr = await AsyncStorage.getItem('matchHistory');
                let history = historyStr ? JSON.parse(historyStr) : [];
                const opponents = gameState.players?.filter((p, idx) => idx !== localPlayerIndex).map(p => p.name).join(', ') || 'Inconnus';

                const newMatch = {
                    id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
                    date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
                    result,
                    opponents
                };

                history.unshift(newMatch);
                if (history.length > 10) history = history.slice(0, 10);

                await AsyncStorage.setItem('matchHistory', JSON.stringify(history));
            } catch (e) {
                console.error("Failed to save history", e);
            }
        };

        // Le joueur a fini ses cartes (Victoire)
        const localFinishedBefore = prevState?.finishedPlayers?.includes(localPlayerIndex);
        const localFinishedNow = gameState?.finishedPlayers?.includes(localPlayerIndex);

        if (!localFinishedBefore && localFinishedNow) {
            audioService.stopTickTock();
            audioService.playSound('win');

            if (!isSpectator) {
                const processWinStats = async () => {
                    try {
                        const gamesPlayedStr = await AsyncStorage.getItem('gamesPlayed');
                        const winsStr = await AsyncStorage.getItem('wins');
                        let gamesPlayed = parseInt(gamesPlayedStr || '0', 10);
                        let wins = parseInt(winsStr || '0', 10);

                        gamesPlayed += 1;
                        wins += 1;

                        await AsyncStorage.setItem('gamesPlayed', gamesPlayed.toString());
                        await AsyncStorage.setItem('wins', wins.toString());
                        await saveMatchHistory('Victoire 🎉');
                    } catch (error) {
                        console.error("Failed to update win stats", error);
                    }
                };
                processWinStats();
            }
        }

        // Fin de manche globale (Pour détecter si on a perdu)
        if (!prevState.mancheTerminee && gameState.mancheTerminee) {
            audioService.stopTickTock();

            // Si le joueur est le Khasser
            if (gameState.loserIndex === localPlayerIndex) {
                audioService.playSound('lose');
                if (!isSpectator) {
                    const processLoseStats = async () => {
                        try {
                            const gamesPlayedStr = await AsyncStorage.getItem('gamesPlayed');
                            const lossesStr = await AsyncStorage.getItem('losses');
                            let gamesPlayed = parseInt(gamesPlayedStr || '0', 10);
                            let losses = parseInt(lossesStr || '0', 10);

                            gamesPlayed += 1;
                            losses += 1;

                            await AsyncStorage.setItem('gamesPlayed', gamesPlayed.toString());
                            await AsyncStorage.setItem('losses', losses.toString());
                            await saveMatchHistory('Défaite 💀');
                        } catch (error) {
                            console.error("Failed to update lose stats", error);
                        }
                    };
                    processLoseStats();
                }
            }
        }

        prevGameStateRef.current = gameState;
    }, [gameState]);

    // Horloge Tick-Tock (les 5 dernières secondes)
    useEffect(() => {
        if (timeLeft <= 5 && timeLeft > 0 && !gameState?.mancheTerminee) {
            audioService.startTickTock();
        } else {
            audioService.stopTickTock();
        }

        // Cleanup on unmount securely
        return () => {
            audioService.stopTickTock();
        };
    }, [timeLeft, gameState?.mancheTerminee]);

    // Helper: Find my index
    const myPlayerEntry = gameState?.players?.findIndex(p => p.id === localPlayerId);
    if (myPlayerEntry !== undefined && myPlayerEntry !== -1) {
        localPlayerIndex = myPlayerEntry;
    } else if (gameState?.spectators?.find(s => s.id === localPlayerId)) {
        isSpectator = true;
    }

    // Helper: Local logic for playable check just for UI opacity (server re-validates)
    const canPlayCardLocal = (card, state) => {
        const currentMiddleCard = state.middlePile[state.middlePile.length - 1];
        if (state.pendingAction && state.pendingAction.type === 'skip_response') {
            return card.value === 1;
        }
        if (state.drawPenalty > 0) return card.value === 2;
        if (state.activeSuitOverride) return card.suit === state.activeSuitOverride || card.value === 7;
        return card.suit === currentMiddleCard.suit || card.value === currentMiddleCard.value || card.value === 7;
    };

    const handlePlayerPlayCard = (cardIndex) => {
        if (gameState.turn !== localPlayerIndex || isSpectator) return;

        const card = gameState.hands[localPlayerIndex][cardIndex];
        if (!canPlayCardLocal(card, gameState)) {
            Alert.alert("Action impossible", "Vous ne pouvez pas jouer cette carte.");
            return;
        }

        // Trigger Haptic & Shake if special card
        if (['1', '2', '7'].includes(card.value?.toString())) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

            // Screen shake effect
            shakeOffset.value = withSequence(
                withTiming(15, { duration: 50 }),
                withTiming(-15, { duration: 50 }),
                withTiming(15, { duration: 50 }),
                withTiming(0, { duration: 50 })
            );
        } else {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }

        if (card.value === 7) {
            setPendingCardIndex(cardIndex);
            setShowSuitSelector(true);
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

    const handlePlayerDraw = () => {
        if (gameState.turn !== localPlayerIndex || isSpectator) return;
        if (gameState.pendingAction) return; // Cannot draw during penalty response
        socketService.drawCard(roomId);
    };

    const handleSendChat = (message) => {
        socketService.sendChat(roomId, message);
        setShowChatMenu(false);
    };

    const handleSendReaction = (reaction) => {
        socketService.sendReaction(roomId, reaction);
        setShowChatMenu(false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    if (!gameState) {
        return <View style={styles.container}><Text>Chargement...</Text></View>;
    }

    const topCard = gameState.middlePile[gameState.middlePile.length - 1];

    // Determine opponents (everyone else in the active players list)
    const opponentIndices = [];
    if (gameState && gameState.players) {
        for (let i = 0; i < gameState.hands.length; i++) {
            if (i !== localPlayerIndex) opponentIndices.push(i);
        }
    }

    const getOpponentInfo = (relativeIndex) => {
        if (!gameState || !gameState.players) return null;
        if (opponentIndices.length <= relativeIndex) return null;
        const oIndex = opponentIndices[relativeIndex];
        return {
            index: oIndex,
            player: gameState.players[oIndex],
            handSize: gameState.hands[oIndex].length
        };
    };

    const oppTop = getOpponentInfo(1);
    const oppLeft = getOpponentInfo(0);
    const oppRight = getOpponentInfo(2);

    return (
        <ImageBackground
            source={TABLE_BG}
            style={styles.container}
            resizeMode="stretch"
        >
            <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
            <Animated.View style={[styles.boardOverlay, shakeAnimatedStyle]}>

                {/* Top-left: Quit + Chat */}
                <View style={styles.topLeftBtns}>
                    <TouchableOpacity style={styles.headerBtn} onPress={handleQuit}>
                        <Text style={styles.headerBtnText}>🚪</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.headerBtn} onPress={() => setShowChatMenu(true)}>
                        <Text style={styles.headerBtnText}>💬</Text>
                    </TouchableOpacity>
                </View>

                {/* Top-right: Mute + Info */}
                <View style={styles.topRightBtns}>
                    <TouchableOpacity style={styles.headerBtn} onPress={handleToggleMute}>
                        <Text style={styles.headerBtnText}>{isMuted ? '🔇' : '🔊'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.headerBtn} onPress={() => setShowRules(true)}>
                        <Text style={styles.headerBtnText}>ℹ️</Text>
                    </TouchableOpacity>
                </View>

                {/* Floating Chat Messages Overlay */}
                <View style={styles.chatMessagesOverlay} pointerEvents="none">
                    {chatMessages.map((msg) => (
                        <Animated.View
                            key={msg.id}
                            style={styles.floatingChatMsg}
                            entering={FadeIn.duration(300)}
                            layout={LinearTransition.springify()}
                        >
                            <Text style={styles.chatBubbleText}>
                                <Text style={styles.chatBubbleName}>{msg.playerName} : </Text>
                                {msg.message}
                            </Text>
                        </Animated.View>
                    ))}
                </View>

                {/* Top Area: Opponent 2 (En face) */}
                <View style={styles.topArea}>
                    {oppTop && (
                        <View style={styles.opponentHandContainer}>
                            <View style={styles.playerNameRow}>
                                <View>
                                    <PlayerAvatar name={oppTop.player.name} size={40} active={gameState.turn === oppTop.index} />
                                    {activeReactions[oppTop.index] && (
                                        <Animated.View entering={ZoomIn.springify()} exiting={FadeOut} style={styles.reactionTextTop}>
                                            <Text style={{ fontSize: 32 }}>{activeReactions[oppTop.index]}</Text>
                                        </Animated.View>
                                    )}
                                </View>
                                <Text style={[styles.playerName, gameState.turn === oppTop.index && styles.activePlayer]}>
                                    {oppTop.player.name} ({oppTop.handSize})
                                </Text>
                                {gameState.turn === oppTop.index && <Image source={require('../../assets/menthe-poivree-removebg-preview.png')} style={styles.mintIcon} />}
                            </View>
                            <Animated.View style={styles.compactHandHorizontal} layout={LinearTransition.springify().damping(14)}>
                                {Array(oppTop.handSize).fill(0).map((_, idx) => (
                                    <Animated.View key={`oppTop-${idx}`} entering={isInitialDeal ? FadeInDown.delay(idx * 150).springify() : undefined} style={styles.compactCardH}>
                                        <Image source={GAME_LOGO_BACK} style={styles.compactCardLogo} resizeMode="contain" />
                                    </Animated.View>
                                ))}
                            </Animated.View>
                        </View>
                    )}
                </View>

                {/* Middle Area: Left Opponent, Board, Right Opponent */}
                <View style={styles.middleArea}>
                    {/* Left Opponent */}
                    <View style={styles.sideArea}>
                        {oppLeft && (
                            <View style={styles.opponentHandContainer}>
                                <View style={styles.playerNameRow}>
                                    <View>
                                        <PlayerAvatar name={oppLeft.player.name} size={40} active={gameState.turn === oppLeft.index} />
                                        {activeReactions[oppLeft.index] && (
                                            <Animated.View entering={ZoomIn.springify()} exiting={FadeOut} style={styles.reactionTextSide}>
                                                <Text style={{ fontSize: 32 }}>{activeReactions[oppLeft.index]}</Text>
                                            </Animated.View>
                                        )}
                                    </View>
                                    <Text style={[styles.playerName, gameState.turn === oppLeft.index && styles.activePlayer]}>
                                        {oppLeft.player.name}
                                    </Text>
                                    {gameState.turn === oppLeft.index && <Image source={require('../../assets/menthe-poivree-removebg-preview.png')} style={styles.mintIcon} />}
                                </View>
                                <Text style={styles.cardCountText}>{oppLeft.handSize} cartes</Text>
                                <Animated.View style={styles.compactHandVertical} layout={LinearTransition.springify().damping(14)}>
                                    {Array(oppLeft.handSize).fill(0).map((_, idx) => (
                                        <Animated.View key={`oppLeft-${idx}`} entering={isInitialDeal ? FadeIn.delay(idx * 150).springify() : undefined} style={styles.compactCardV}>
                                            <Image source={GAME_LOGO_BACK} style={styles.compactCardLogo} resizeMode="contain" />
                                        </Animated.View>
                                    ))}
                                </Animated.View>
                            </View>
                        )}
                    </View>

                    {/* The Board / Table */}
                    <View style={styles.boardArea}>

                        <View style={styles.middlePileRow}>
                            {/* Deck pile — face-down card with logo */}
                            <TouchableOpacity
                                style={styles.deckPile}
                                onPress={handlePlayerDraw}
                                disabled={gameState.turn !== localPlayerIndex || isSpectator}
                            >
                                <Image source={GAME_LOGO_BACK} style={styles.deckLogoImg} resizeMode="contain" />
                                {/* Inner golden border */}
                                <View style={styles.deckInnerBorder} />
                                {/* Card count badge */}
                                {gameState.deck.length > 0 && (
                                    <View style={styles.deckBadge}>
                                        <Text style={styles.deckBadgeText}>{gameState.deck.length}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>

                            <View style={styles.middlePile}>
                                {topCard ? (
                                    <Animated.View key={`pile-${gameState.middlePile.length}`} entering={FadeIn.springify()} layout={LinearTransition.springify()}>
                                        <Card card={topCard} disabled={true} />
                                    </Animated.View>
                                ) : (
                                    <Text style={{ color: '#fff' }}>Vide</Text>
                                )}
                            </View>
                        </View>

                        {gameState.activeSuitOverride && (
                            <Text style={styles.overrideText}>Famille demandée : {gameState.activeSuitOverride}</Text>
                        )}
                        {gameState.drawPenalty > 0 && (
                            <Text style={styles.penaltyText}>+ {gameState.drawPenalty}</Text>
                        )}

                        {/* Turn/Log Info */}
                        <View style={styles.infoArea}>
                            {gameState.mancheTerminee ? (
                                <View style={{ alignItems: 'center', width: '100%' }}>
                                    <Text style={styles.roundOverTitle}>
                                        {gameState.loserIndex === localPlayerIndex ? '😢 Vous avez perdu !' : `💀 ${gameState?.players?.[gameState.loserIndex]?.name || 'Un joueur'} a perdu !`}
                                    </Text>

                                    {/* Tableau de scores trié */}
                                    <View style={styles.scoreTable}>
                                        <Text style={styles.scoreTableTitle}>🏆 Classement de la manche</Text>
                                        {gameState.players
                                            ?.map((p, idx) => ({ name: p.name, score: gameState.scores?.[idx] ?? 0, isMe: idx === localPlayerIndex }))
                                            .sort((a, b) => a.score - b.score)
                                            .map((entry, rank) => {
                                                const medals = ['🥇', '🥈', '🥉'];
                                                return (
                                                    <View key={entry.name} style={[styles.scoreRow, entry.isMe && styles.scoreRowMe]}>
                                                        <Text style={styles.scoreMedal}>{medals[rank] ?? `${rank + 1}.`}</Text>
                                                        <Text style={[styles.scoreName, entry.isMe && { color: '#FCD34D' }]}>{entry.name}</Text>
                                                        <View style={{ alignItems: 'flex-end' }}>
                                                            <Text style={styles.scoreVal}>{entry.score} pts</Text>
                                                            {entry.isMe && xpEarnedThisRound > 0 && (
                                                                <Animated.Text entering={FadeInUp.delay(800)} style={{ color: '#10B981', fontWeight: 'bold', fontSize: 14 }}>
                                                                    +{xpEarnedThisRound} XP
                                                                </Animated.Text>
                                                            )}
                                                        </View>
                                                    </View>
                                                );
                                            })
                                        }
                                        <Text style={styles.scoreLegend}>
                                            📌 Points = valeur des cartes restantes en main{`\n`}As=1 · 2→7=valeur · Valet=11 · Cavalier=10 · Roi=12
                                        </Text>
                                    </View>

                                    {/* Boutons Rejouer + Quitter */}
                                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                                        {isHost ? (
                                            <TouchableOpacity style={styles.replayBtn} onPress={() => socketService.playAgain(roomId)}>
                                                <Text style={styles.replayBtnText}>🔄 Rejouer</Text>
                                            </TouchableOpacity>
                                        ) : (
                                            <Text style={{ color: '#9CA3AF', fontSize: 12, textAlign: 'center' }}>
                                                En attente de l'hôte...
                                            </Text>
                                        )}
                                        <TouchableOpacity style={styles.quitBtn} onPress={handleForceQuit}>
                                            <Text style={styles.quitBtnText}>🚪 Quitter</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : (
                                <>
                                    {gameState.pendingAction && gameState.pendingAction.type === 'skip_response' ? (
                                        <Text style={[styles.turnText, { color: '#EF4444', textShadowColor: '#000', textShadowRadius: 2, fontSize: 16 }]}>
                                            {gameState.turn === localPlayerIndex ? `VITE ! JOUEZ UN 1 POUR VOUS DÉFENDRE !` : `${gameState?.players?.[gameState.turn]?.name} sous attaque !`}
                                        </Text>
                                    ) : (
                                        <Text style={styles.turnText}>
                                            Tour de : {gameState.turn === localPlayerIndex ? 'VOUS' : gameState?.players?.[gameState.turn]?.name}
                                        </Text>
                                    )}
                                    <View style={{ marginTop: 5 }}>
                                        <CircularTimer timeLeft={timeLeft} maxTime={gameState.pendingAction ? 3 : 15} size={50} />
                                    </View>
                                </>
                            )}
                        </View>
                    </View>

                    {/* Right Opponent */}
                    <View style={styles.sideArea}>
                        {oppRight && (
                            <View style={styles.opponentHandContainer}>
                                <View style={styles.playerNameRow}>
                                    <View>
                                        <PlayerAvatar name={oppRight.player.name} size={40} active={gameState.turn === oppRight.index} />
                                        {activeReactions[oppRight.index] && (
                                            <Animated.View entering={ZoomIn.springify()} exiting={FadeOut} style={styles.reactionTextSide}>
                                                <Text style={{ fontSize: 32 }}>{activeReactions[oppRight.index]}</Text>
                                            </Animated.View>
                                        )}
                                    </View>
                                    <Text style={[styles.playerName, gameState.turn === oppRight.index && styles.activePlayer]}>
                                        {oppRight.player.name}
                                    </Text>
                                    {gameState.turn === oppRight.index && <Image source={require('../../assets/menthe-poivree-removebg-preview.png')} style={styles.mintIcon} />}
                                </View>
                                <Text style={styles.cardCountText}>{oppRight.handSize} cartes</Text>
                                <Animated.View style={styles.compactHandVertical} layout={LinearTransition.springify().damping(14)}>
                                    {Array(oppRight.handSize).fill(0).map((_, idx) => (
                                        <Animated.View key={`oppRight-${idx}`} entering={isInitialDeal ? FadeIn.delay(idx * 150).springify() : undefined} style={styles.compactCardV}>
                                            <Image source={GAME_LOGO_BACK} style={styles.compactCardLogo} resizeMode="contain" />
                                        </Animated.View>
                                    ))}
                                </Animated.View>
                            </View>
                        )}
                    </View>
                </View>

                {/* Bottom Area: Player Hand */}
                <View style={styles.playerArea}>
                    {isSpectator ? (
                        <Text style={[styles.playerName, { fontSize: 20 }]}>👀 Vous êtes en attente (Spectateur)</Text>
                    ) : (
                        <>
                            <View style={styles.playerNameRow}>
                                <View>
                                    <PlayerAvatar name="Vous" size={40} active={gameState.turn === localPlayerIndex} />
                                    {activeReactions[localPlayerIndex] && (
                                        <Animated.View entering={ZoomIn.springify()} exiting={FadeOut} style={styles.reactionTextSelf}>
                                            <Text style={{ fontSize: 32, textShadowColor: '#FFD700', textShadowRadius: 10 }}>{activeReactions[localPlayerIndex]}</Text>
                                        </Animated.View>
                                    )}
                                </View>
                                <Text style={[styles.playerName, gameState.turn === localPlayerIndex && styles.activePlayer, { fontSize: 18 }]}>Vous</Text>
                                {gameState.turn === localPlayerIndex && <Image source={require('../../assets/menthe-poivree-removebg-preview.png')} style={[styles.mintIcon, { width: 34, height: 34 }]} />}
                            </View>

                            {/* Bar de reactions rapide — juste au dessus des cartes */}
                            <View style={[styles.reactionBar, { marginBottom: 15 }]}>
                                {['😂', '😡', '😱', '👏'].map(emoji => (
                                    <TouchableOpacity key={emoji} style={styles.reactionBtn} onPress={() => handleSendReaction(emoji)}>
                                        <Text style={styles.reactionBtnText}>{emoji}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <View style={styles.masterHandContainer}>
                                {localPlayerIndex !== -1 && gameState.hands[localPlayerIndex].map((card, idx) => {
                                    const isPlayable = gameState.turn === localPlayerIndex && canPlayCardLocal(card, gameState);
                                    return (
                                        <MasterCard
                                            key={card.id}
                                            card={card}
                                            isPlayable={isPlayable}
                                            onPlay={() => handlePlayerPlayCard(idx)}
                                            index={idx}
                                            totalCards={gameState.hands[localPlayerIndex].length}
                                            isInitialDeal={isInitialDeal}
                                        />
                                    );
                                })}
                            </View>
                        </>
                    )}
                </View>

                {/* Suit Selector Modal / Overlay */}
                {showSuitSelector && (
                    <View style={styles.suitSelectorOverlay}>
                        <View style={styles.suitSelectorModal}>
                            <Text style={styles.suitSelectorTitle}>🃏 Quelle famille tu veux ?</Text>
                            <View style={styles.suitButtons}>
                                {[
                                    { suit: 'Oros', moroccan: 'الفلوس (Flouss)', emoji: '💰' },
                                    { suit: 'Copas', moroccan: 'الجبابن (Jbaben)', emoji: '🏆' },
                                    { suit: 'Bastos', moroccan: 'الگرعة (Gere3)', emoji: '🏏' },
                                    { suit: 'Espadas', moroccan: 'السيوف (Syouf)', emoji: '🗡️' },
                                ].map(({ suit, moroccan, emoji }) => (
                                    <TouchableOpacity key={suit} style={styles.suitBtn} onPress={() => handleSuitSelected(suit)}>
                                        <Text style={styles.suitEmoji}>{emoji}</Text>
                                        <Card card={{ suit, value: 3, id: `${suit}-preview` }} disabled={true} />
                                        <Text style={styles.suitBtnText}>{moroccan}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </View>
                )}

                {/* Chat Menu Modal / Overlay */}
                {showChatMenu && (
                    <View style={styles.suitSelectorOverlay}>
                        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setShowChatMenu(false)} />
                        <View style={styles.suitSelectorModal}>
                            <Text style={styles.suitSelectorTitle}>💬 Message Rapide</Text>

                            <View style={styles.customChatRow}>
                                <TextInput
                                    style={styles.customChatInput}
                                    placeholder="Message personnalisé..."
                                    placeholderTextColor="#9CA3AF"
                                    value={customMsg}
                                    onChangeText={setCustomMsg}
                                    onSubmitEditing={() => {
                                        if (customMsg.trim().length > 0) {
                                            handleSendChat(customMsg);
                                            setCustomMsg('');
                                        }
                                    }}
                                />
                                <TouchableOpacity
                                    style={styles.customChatBtn}
                                    onPress={() => {
                                        if (customMsg.trim().length > 0) {
                                            handleSendChat(customMsg);
                                            setCustomMsg('');
                                        }
                                    }}
                                >
                                    <Text style={styles.customChatBtnText}>Envoyer</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.suitButtons}>
                                {[
                                    "L3eb a zmagri !",
                                    "Zid Jouj !",
                                    "Hezz !",
                                    "Zrebti 3lina...",
                                    "Wry9a wa7da 😉",
                                    "Saaaaaaaafi 😡"
                                ].map((msg, index) => (
                                    <TouchableOpacity key={index} style={[styles.suitBtn, { width: '100%', marginBottom: 8, padding: 10 }]} onPress={() => handleSendChat(msg)}>
                                        <Text style={[styles.suitBtnText, { fontSize: 14, marginTop: 0 }]}>{msg}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </View>
                )}

                {/* Rules Modal */}
                <RulesModal visible={showRules} onClose={() => setShowRules(false)} />
            </Animated.View>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1C0F13',
    },
    boardOverlay: {
        flex: 1,
        paddingTop: 50,
        paddingBottom: 8,
    },
    // ---- REACTIONS STYLES ----
    reactionBar: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 15,
        marginBottom: 8,
    },
    reactionBtn: {
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#D4AF37',
    },
    reactionBtnText: {
        fontSize: 22,
    },
    reactionTextSelf: {
        position: 'absolute',
        top: -30,
        alignSelf: 'center',
        zIndex: 50,
    },
    reactionTextTop: {
        position: 'absolute',
        bottom: -30,
        alignSelf: 'center',
        zIndex: 50,
    },
    reactionTextSide: {
        position: 'absolute',
        top: -25,
        alignSelf: 'center',
        zIndex: 50,
    },
    // ---- HEADER BUTTONS ----
    topLeftBtns: {
        position: 'absolute',
        top: 8,
        left: 12,
        flexDirection: 'row',
        gap: 8,
        zIndex: 10,
    },
    topRightBtns: {
        position: 'absolute',
        top: 8,
        right: 12,
        flexDirection: 'row',
        gap: 8,
        zIndex: 10,
    },
    headerBtn: {
        backgroundColor: 'rgba(0,0,0,0.55)',
        width: 38,
        height: 38,
        borderRadius: 19,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.35)',
    },
    headerBtnText: {
        fontSize: 18,
    },
    chatMessagesOverlay: {
        position: 'absolute',
        top: 100,
        left: 20,
        right: 20,
        zIndex: 20,
        alignItems: 'center',
    },
    floatingChatMsg: {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 5,
    },
    chatBubbleText: {
        fontSize: 14,
        color: '#1C2E4A',
        fontWeight: 'bold',
    },
    chatBubbleName: {
        color: '#EF4444',
        fontWeight: '900',
    },
    topArea: {
        height: 105,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 6,
    },
    middleArea: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
        zIndex: 50,
        elevation: 50,
    },
    sideArea: {
        width: 100,
        justifyContent: 'center',
        alignItems: 'center',
    },
    playerArea: {
        height: 170,
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
        paddingBottom: 6,
        zIndex: 10,
        elevation: 10,
    },
    boardArea: {
        flex: 1,
        marginHorizontal: 10,
        borderRadius: 24,
        padding: 10,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
        position: 'relative',
    },

    middlePileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    deckPile: {
        width: 70,
        height: 100,
        backgroundColor: '#1C0F13',
        borderRadius: 8,
        borderWidth: 2,
        borderColor: '#B8860B',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 4,
        elevation: 6,
    },
    deckLogoImg: {
        width: '80%',
        height: '80%',
    },
    deckInnerBorder: {
        position: 'absolute',
        top: 4,
        left: 4,
        right: 4,
        bottom: 4,
        borderRadius: 5,
        borderWidth: 1.5,
        borderColor: 'rgba(212, 175, 55, 0.6)',
    },
    deckBadge: {
        position: 'absolute',
        bottom: 5,
        right: 5,
        backgroundColor: '#D4AF37',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    deckBadgeText: {
        color: '#1C0F13',
        fontWeight: '900',
        fontSize: 11,
    },
    middlePile: {
        alignItems: 'center',
        width: 70,
        height: 100,
        justifyContent: 'center',
    },
    infoArea: {
        marginTop: 15,
        alignItems: 'center',
        padding: 8,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 12,
        width: '100%',
        zIndex: 100,
        elevation: 100,
    },
    playerName: {
        color: '#D4AF37',
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 5,
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 2,
    },
    playerNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 4,
    },
    mintIcon: {
        width: 24,
        height: 24,
        resizeMode: 'contain',
        marginLeft: -4, // pull closer to name
    },
    activePlayer: {
        color: '#FCD34D',
        fontSize: 16,
        textDecorationLine: 'underline',
    },
    cardCountText: {
        color: '#FFF',
        fontSize: 10,
        marginBottom: 5,
    },
    opponentHandContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    compactHandHorizontal: {
        flexDirection: 'row',
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    compactHandVertical: {
        width: 40,
        height: 120,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    compactCardH: {
        width: 25,
        height: 40,
        backgroundColor: '#1C0F13',
        borderWidth: 1,
        borderColor: '#B8860B',
        borderRadius: 4,
        marginLeft: -15,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    compactCardV: {
        width: 40,
        height: 25,
        backgroundColor: '#1C0F13',
        borderWidth: 1,
        borderColor: '#B8860B',
        borderRadius: 4,
        marginBottom: -15,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    compactCardLogo: {
        width: '90%',
        height: '90%',
    },
    handScroll: {
        width: '100%',
    },
    handContainer: {
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    masterHandContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: 120,
        paddingHorizontal: 10,
    },
    overrideText: {
        color: '#FCD34D',
        marginTop: 8,
        fontWeight: 'bold',
        fontSize: 14,
        backgroundColor: 'rgba(0,0,0,0.4)',
        paddingHorizontal: 8,
        borderRadius: 4,
    },
    penaltyText: {
        color: '#EF4444',
        marginTop: 4,
        fontWeight: '900',
        fontSize: 18,
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
    },
    turnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    timerText: {
        color: '#D4AF37',
        fontSize: 16,
        fontWeight: '900',
        marginTop: 4,
    },
    timerDanger: {
        color: '#EF4444', // Rouge quand <= 5s
    },
    suitSelectorOverlay: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
        elevation: 9999,
    },
    suitSelectorModal: {
        backgroundColor: '#fff',
        padding: 24,
        borderRadius: 12,
        width: '80%',
    },
    suitSelectorTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
        textAlign: 'center',
    },
    suitButtons: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 12,
    },
    suitBtn: {
        backgroundColor: '#1C2E4A',
        padding: 12,
        borderRadius: 12,
        width: '45%',
        alignItems: 'center',
        marginBottom: 10,
        borderWidth: 2,
        borderColor: '#D4AF37',
    },
    suitEmoji: {
        fontSize: 24,
        marginBottom: 6,
    },
    suitBtnText: {
        fontWeight: 'bold',
        color: '#D4AF37',
        fontSize: 13,
        marginTop: 6,
        textAlign: 'center',
    },
    customChatRow: {
        flexDirection: 'row',
        marginBottom: 15,
        gap: 8,
    },
    customChatInput: {
        flex: 1,
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        color: '#111827',
        borderWidth: 1,
        borderColor: '#D1D5DB',
    },
    customChatBtn: {
        backgroundColor: '#10B981',
        paddingHorizontal: 12,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    customChatBtnText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    // ---- END OF ROUND ----
    roundOverTitle: {
        color: '#FCD34D',
        fontWeight: '900',
        fontSize: 18,
        textAlign: 'center',
        marginBottom: 10,
        textShadowColor: '#000',
        textShadowRadius: 4,
    },
    scoreTable: {
        width: '100%',
        backgroundColor: 'rgba(0,0,0,0.55)',
        borderRadius: 12,
        padding: 10,
        marginBottom: 6,
    },
    scoreTableTitle: {
        color: '#D4AF37',
        fontWeight: 'bold',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 8,
    },
    scoreRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        paddingHorizontal: 6,
        borderRadius: 8,
        marginBottom: 2,
    },
    scoreRowMe: {
        backgroundColor: 'rgba(212,175,55,0.15)',
    },
    scoreMedal: {
        fontSize: 18,
        width: 28,
    },
    scoreName: {
        flex: 1,
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 13,
    },
    scoreVal: {
        color: '#D4AF37',
        fontWeight: '900',
        fontSize: 14,
    },
    scoreLegend: {
        color: '#9CA3AF',
        fontSize: 10,
        marginTop: 8,
        textAlign: 'center',
        lineHeight: 15,
    },
    replayBtn: {
        backgroundColor: '#D4AF37',
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: 'center',
    },
    replayBtnText: {
        color: '#1C0F13',
        fontWeight: '900',
        fontSize: 14,
    },
    quitBtn: {
        backgroundColor: 'rgba(239,68,68,0.2)',
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#EF4444',
        alignItems: 'center',
    },
    quitBtnText: {
        color: '#EF4444',
        fontWeight: '900',
        fontSize: 14,
    },
});
