import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ImageBackground, ScrollView } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition, ZoomIn, useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import socketService from '../network/socketService';
import audioService from '../network/audioService';
import PlayerAvatar from '../components/PlayerAvatar';
import { GameButton, IconButton, theme } from '../components/ui';
import { dialog } from '../components/Dialog';
import { gameInfo } from '../games';

const BG = require('../../assets/Yellow and White Illustrative Ramadan Greeting Instagram Post.png');

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
            socketService.onGameError((error) => {
                audioService.playSound('error');
                dialog.alert('Oups', error.message);
            }),
        ];
        return () => unsubs.forEach((u) => u && u());
    }, []);

    const amHost = isHost || (room && room.hostId === socketService.socket?.id);

    const handleStartGame = () => {
        if (amHost) socketService.startGame(roomId);
        else dialog.alert('Action non permise', "Seul l'hôte du salon peut démarrer la partie.");
    };

    const handleLeave = () => {
        dialog.alert('Quitter le salon ?', '', [
            { text: 'Rester', style: 'cancel' },
            {
                text: 'Quitter',
                style: 'destructive',
                onPress: () => {
                    socketService.leaveRoom();
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
    const canStart = game.canStart(players.length);

    return (
        <ImageBackground source={BG} style={styles.container} resizeMode="cover">
            <View style={styles.dim} pointerEvents="none" />
            <View style={styles.header}>
                <IconButton icon="⬅️" onPress={handleLeave} label="Retour" size={42} />
                <Text style={styles.headerTitle}>Salon privé · {game.label}</Text>
                <View style={{ width: 42 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <Animated.View entering={ZoomIn.springify().damping(13)} style={styles.codeBox}>
                    <Text style={styles.codeLabel}>CODE DU SALON</Text>
                    <Text style={styles.code} selectable>{roomId}</Text>
                    <Text style={styles.codeHint}>Partage ce code à tes amis pour qu'ils te rejoignent</Text>
                </Animated.View>

                <View style={styles.panel}>
                    <Text style={styles.sectionTitle}>JOUEURS · {players.length}/{MAX_PLAYERS}</Text>
                    {players.map((item, i) => (
                        <Animated.View
                            key={item.id}
                            entering={FadeInDown.delay(i * 60).springify().damping(15)}
                            exiting={FadeOut}
                            layout={LinearTransition.springify()}
                            style={[styles.playerRow, item.id === socketService.socket?.id && styles.playerRowMe]}
                        >
                            <PlayerAvatar name={item.name} size={38} />
                            <Text style={[styles.playerName, item.id === room?.hostId && { color: theme.goldLight }]} numberOfLines={1}>
                                {item.name}{item.id === socketService.socket?.id ? ' (vous)' : ''}
                            </Text>
                            {item.isBot ? (
                                <Text style={styles.badge}>🤖 BOT</Text>
                            ) : item.id === room?.hostId ? (
                                <Text style={styles.badge}>👑 HÔTE</Text>
                            ) : null}
                        </Animated.View>
                    ))}
                    {Array.from({ length: emptySeats }).map((_, i) => (
                        <View key={`empty-${i}`} style={styles.emptySeat}>
                            <View style={styles.emptyAvatar}><Text style={{ color: theme.textDim }}>?</Text></View>
                            <Text style={styles.emptyText}>En attente</Text>
                            <WaitingDots />
                        </View>
                    ))}

                    {spectators.length > 0 && (
                        <>
                            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>SPECTATEURS · {spectators.length}</Text>
                            {spectators.map((item) => (
                                <Animated.View key={item.id} entering={FadeInDown.springify()} style={styles.spectatorRow}>
                                    <PlayerAvatar name={item.name} size={28} />
                                    <Text style={styles.spectatorName}>{item.name}</Text>
                                    <Text>👁️</Text>
                                </Animated.View>
                            ))}
                        </>
                    )}
                </View>
            </ScrollView>

            <View style={styles.footer}>
                {amHost ? (
                    <GameButton
                        title={canStart ? `DÉMARRER · ${game.label.toUpperCase()}` : game.startHint.toUpperCase()}
                        icon="🃏"
                        variant="gold"
                        onPress={handleStartGame}
                        disabled={!canStart}
                    />
                ) : (
                    <View style={styles.waitingBox}>
                        <Text style={styles.waitingText}>
                            {room?.inGame
                                ? 'Partie en cours, tu joueras à la prochaine manche'
                                : "En attente du lancement par l'hôte"}
                        </Text>
                        <WaitingDots />
                    </View>
                )}
            </View>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    dim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(18,6,9,0.55)' },
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
    codeHint: {
        color: theme.text,
        fontSize: 12,
        textAlign: 'center',
        paddingHorizontal: 16,
    },
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
