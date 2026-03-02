import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ImageBackground, Image, TextInput } from 'react-native';
import Animated, { LinearTransition, FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import Card from '../components/Card';
import PlayerAvatar from '../components/PlayerAvatar';
import CircularTimer from '../components/CircularTimer';
import socketService from '../network/socketService';
import audioService from '../network/audioService';
import RulesModal from '../components/RulesModal';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SUITS = ['Oros', 'Copas', 'Espadas', 'Bastos'];

export default function GameScreen({ route, navigation }) {
    const { roomId, playerName, initialGameState, isHost } = route.params || {};

    const [gameState, setGameState] = useState(initialGameState);
    const [showSuitSelector, setShowSuitSelector] = useState(false);
    const [pendingCardIndex, setPendingCardIndex] = useState(null);
    const [timeLeft, setTimeLeft] = useState(15);
    const [showRules, setShowRules] = useState(false);
    const [showChatMenu, setShowChatMenu] = useState(false);
    const [chatMessages, setChatMessages] = useState([]); // {id, playerName, message, timestamp}
    const [customMsg, setCustomMsg] = useState('');
    const [isInitialDeal, setIsInitialDeal] = useState(true);
    const prevGameStateRef = useRef(initialGameState);

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

        return () => {
            audioService.stopTickTock();
            socketService.offAll(); // Ensure we clean up listeners
        };
    }, []);

    // Effets sonores basés sur l'évolution de la partie
    useEffect(() => {
        const prevState = prevGameStateRef.current;
        if (!prevState || !gameState) return;

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
        if (state.drawPenalty > 0) return card.value === 2;
        if (state.activeSuitOverride) return card.suit === state.activeSuitOverride || card.value === 7;
        return card.suit === currentMiddleCard.suit || card.value === currentMiddleCard.value;
    };

    const handlePlayerPlayCard = (cardIndex) => {
        if (gameState.turn !== localPlayerIndex || isSpectator) return;

        const card = gameState.hands[localPlayerIndex][cardIndex];
        if (!canPlayCardLocal(card, gameState)) {
            Alert.alert("Action impossible", "Vous ne pouvez pas jouer cette carte.");
            return;
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
        socketService.drawCard(roomId);
    };

    const handleSendChat = (message) => {
        socketService.sendChat(roomId, message);
        setShowChatMenu(false);
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
            source={require('../../assets/Yellow and White Illustrative Ramadan Greeting Instagram Post.png')}
            style={styles.container}
            resizeMode="cover"
        >
            {/* Info Button Top Right */}
            <TouchableOpacity style={styles.infoBtn} onPress={() => setShowRules(true)}>
                <Text style={styles.infoBtnText}>ℹ️</Text>
            </TouchableOpacity>

            {/* Chat Button Top Left */}
            <TouchableOpacity style={styles.chatBtn} onPress={() => setShowChatMenu(true)}>
                <Text style={styles.chatBtnText}>💬</Text>
            </TouchableOpacity>

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
                            <PlayerAvatar name={oppTop.player.name} size={30} active={gameState.turn === oppTop.index} />
                            <Text style={[styles.playerName, gameState.turn === oppTop.index && styles.activePlayer]}>
                                {oppTop.player.name} ({oppTop.handSize})
                            </Text>
                            {gameState.turn === oppTop.index && <Image source={require('../../assets/menthe-poivree-removebg-preview.png')} style={styles.mintIcon} />}
                        </View>
                        <Animated.View style={styles.compactHandHorizontal} layout={LinearTransition.springify().damping(14)}>
                            {Array(oppTop.handSize).fill(0).map((_, idx) => (
                                <Animated.View key={`oppTop-${idx}`} entering={isInitialDeal ? FadeInDown.delay(idx * 150).springify() : undefined} style={styles.compactCardH} />
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
                                <PlayerAvatar name={oppLeft.player.name} size={30} active={gameState.turn === oppLeft.index} />
                                <Text style={[styles.playerName, gameState.turn === oppLeft.index && styles.activePlayer]}>
                                    {oppLeft.player.name}
                                </Text>
                                {gameState.turn === oppLeft.index && <Image source={require('../../assets/menthe-poivree-removebg-preview.png')} style={styles.mintIcon} />}
                            </View>
                            <Text style={styles.cardCountText}>{oppLeft.handSize} cartes</Text>
                            <Animated.View style={styles.compactHandVertical} layout={LinearTransition.springify().damping(14)}>
                                {Array(oppLeft.handSize).fill(0).map((_, idx) => (
                                    <Animated.View key={`oppLeft-${idx}`} entering={isInitialDeal ? FadeIn.delay(idx * 150).springify() : undefined} style={styles.compactCardV} />
                                ))}
                            </Animated.View>
                        </View>
                    )}
                </View>

                {/* The Board / Table */}
                <View style={styles.boardArea}>

                    <View style={styles.middlePileRow}>
                        <TouchableOpacity style={styles.deckPile} onPress={handlePlayerDraw} disabled={gameState.turn !== localPlayerIndex || isSpectator}>
                            <Text style={styles.deckText}>Pioche{gameState.deck.length > 0 ? `\n(${gameState.deck.length})` : ''}</Text>
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
                            <View style={{ alignItems: 'center' }}>
                                <Text style={styles.turnText}>
                                    Manche terminée !
                                    {gameState.loserIndex === localPlayerIndex ? "VOUS AVEZ PERDU 😢" : `${gameState?.players?.[gameState.loserIndex]?.name || 'Un joueur'} a perdu !`}
                                </Text>

                                {/* Afficher les scores calculés par le serveur */}
                                <View style={{ marginTop: 15, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, width: '100%' }}>
                                    <Text style={{ color: '#D4AF37', fontWeight: 'bold', fontSize: 16, marginBottom: 5, textAlign: 'center' }}>Scores :</Text>
                                    {gameState.players?.map((p, idx) => (
                                        <Text key={p.id} style={{ color: '#fff', fontSize: 14, marginVertical: 2 }}>
                                            {p.name} : {gameState.scores?.[idx] || 0} pts
                                        </Text>
                                    ))}
                                </View>

                                {isHost ? (
                                    <TouchableOpacity
                                        style={{ marginTop: 15, backgroundColor: '#D4AF37', padding: 12, borderRadius: 8, width: 200, alignItems: 'center' }}
                                        onPress={() => socketService.playAgain(roomId)}
                                    >
                                        <Text style={{ color: '#000', fontWeight: 'bold' }}>REJOUER (Manche Suivante)</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <Text style={{ color: '#fff', fontSize: 13, marginTop: 15, textAlign: 'center' }}>
                                        Veuillez attendre que l'hôte relance la partie...
                                    </Text>
                                )}
                            </View>
                        ) : (
                            <>
                                <Text style={styles.turnText}>
                                    Tour de : {gameState.turn === localPlayerIndex ? 'VOUS' : gameState?.players?.[gameState.turn]?.name}
                                </Text>
                                <View style={{ marginTop: 5 }}>
                                    <CircularTimer timeLeft={timeLeft} maxTime={15} size={50} />
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
                                <PlayerAvatar name={oppRight.player.name} size={30} active={gameState.turn === oppRight.index} />
                                <Text style={[styles.playerName, gameState.turn === oppRight.index && styles.activePlayer]}>
                                    {oppRight.player.name}
                                </Text>
                                {gameState.turn === oppRight.index && <Image source={require('../../assets/menthe-poivree-removebg-preview.png')} style={styles.mintIcon} />}
                            </View>
                            <Text style={styles.cardCountText}>{oppRight.handSize} cartes</Text>
                            <Animated.View style={styles.compactHandVertical} layout={LinearTransition.springify().damping(14)}>
                                {Array(oppRight.handSize).fill(0).map((_, idx) => (
                                    <Animated.View key={`oppRight-${idx}`} entering={isInitialDeal ? FadeIn.delay(idx * 150).springify() : undefined} style={styles.compactCardV} />
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
                            <PlayerAvatar name="Vous" size={40} active={gameState.turn === localPlayerIndex} />
                            <Text style={[styles.playerName, gameState.turn === localPlayerIndex && styles.activePlayer, { fontSize: 18 }]}>Vous</Text>
                            {gameState.turn === localPlayerIndex && <Image source={require('../../assets/menthe-poivree-removebg-preview.png')} style={[styles.mintIcon, { width: 34, height: 34 }]} />}
                        </View>
                        <Animated.ScrollView horizontal style={styles.handScroll} contentContainerStyle={styles.handContainer} layout={LinearTransition.springify().damping(14)}>
                            {localPlayerIndex !== -1 && gameState.hands[localPlayerIndex].map((card, idx) => {
                                const isPlayable = gameState.turn === localPlayerIndex && canPlayCardLocal(card, gameState);
                                return (
                                    <Animated.View key={`player-${card.id}`} entering={isInitialDeal ? FadeInUp.delay(idx * 150).springify() : undefined} style={{ marginHorizontal: -5 }}>
                                        <Card
                                            card={card}
                                            onPress={() => handlePlayerPlayCard(idx)}
                                            disabled={!isPlayable && gameState.turn === localPlayerIndex}
                                        />
                                    </Animated.View>
                                );
                            })}
                        </Animated.ScrollView>
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
                                { suit: 'Oros', moroccan: 'الفلوس (Flouss)', emoji: '🪙' },
                                { suit: 'Copas', moroccan: 'الجبابن (Jbaben)', emoji: '🫖' },
                                { suit: 'Bastos', moroccan: 'الگرعة (Gere3)', emoji: '🪵' },
                                { suit: 'Espadas', moroccan: 'السيوف (Syouf)', emoji: '⚔️' },
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
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1C0F13', // Fond sombre
        paddingTop: 45,
        paddingBottom: 20,
    },
    infoBtn: {
        position: 'absolute',
        top: 45,
        right: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    infoBtnText: {
        fontSize: 20,
    },
    chatBtn: {
        position: 'absolute',
        top: 45,
        left: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    chatBtnText: {
        fontSize: 20,
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
        height: 80,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    middleArea: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
    },
    sideArea: {
        width: 100,
        justifyContent: 'center',
        alignItems: 'center',
    },
    playerArea: {
        height: 150,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
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
        backgroundColor: '#2F1218',
        borderRadius: 8,
        borderWidth: 2,
        borderColor: '#B8860B',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
        borderStyle: 'dashed',
    },
    deckText: {
        color: '#D4AF37',
        fontWeight: 'bold',
        textAlign: 'center',
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
        backgroundColor: '#D1D5DB',
        borderWidth: 1,
        borderColor: '#9CA3AF',
        borderRadius: 4,
        marginLeft: -15, // Overlap cards
    },
    compactCardV: {
        width: 40,
        height: 25,
        backgroundColor: '#D1D5DB',
        borderWidth: 1,
        borderColor: '#9CA3AF',
        borderRadius: 4,
        marginBottom: -15, // Overlap cards vertically
    },
    handScroll: {
        width: '100%',
    },
    handContainer: {
        paddingHorizontal: 20,
        alignItems: 'center',
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
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
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
});
