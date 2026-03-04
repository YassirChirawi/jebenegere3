import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert } from 'react-native';
import socketService from '../network/socketService';
import PlayerAvatar from '../components/PlayerAvatar';

export default function LobbyScreen({ route, navigation }) {
    const { roomId, playerName, isHost, initialRoom } = route.params;
    const [room, setRoom] = useState(initialRoom || null);

    useEffect(() => {
        // Listeners
        socketService.onRoomUpdated((updatedRoom) => {
            if (updatedRoom.id === roomId) {
                setRoom(updatedRoom);
            }
        });

        socketService.onGameStarted((gameState) => {
            navigation.replace('Game', { roomId, playerName, initialGameState: gameState, isHost });
        });

        socketService.onGameError((error) => {
            Alert.alert("Erreur du Jeu", error.message);
        });

        return () => {
            socketService.offAll();
        };
    }, []);

    const handleStartGame = () => {
        if (isHost || (room && room.hostId === socketService.socket.id)) {
            socketService.startGame(roomId);
        } else {
            Alert.alert("Action non permise", "Seul l'hôte du salon peut démarrer la partie.");
        }
    };

    if (!room) {
        return <View style={styles.container}><Text style={styles.title}>Connexion au salon...</Text></View>;
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Salon : {roomId}</Text>
                <Text style={styles.subtitle}>Attente des joueurs...</Text>
            </View>

            <View style={styles.listContainer}>
                <Text style={styles.sectionTitle}>Joueurs Actifs ({room.activePlayers.length}/4)</Text>
                <FlatList
                    data={room.activePlayers}
                    keyExtractor={item => item.id}
                    renderItem={({ item }) => (
                        <View style={styles.playerRow}>
                            <View style={styles.playerInfo}>
                                <PlayerAvatar name={item.name} size={36} active={item.id === room.hostId} />
                                <Text style={[styles.playerName, item.id === room.hostId && { color: '#FFD700' }]}>
                                    {item.name}
                                </Text>
                            </View>
                            {/* Afficher icône Robot pour les bots */}
                            {item.isBot ? (
                                <Text style={styles.hostBadge}>🤖 BOT</Text>
                            ) : item.id === room.hostId ? (
                                <Text style={styles.hostBadge}>👑 HÔTE</Text>
                            ) : null}
                        </View>
                    )}
                />

                <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Spectateurs ({room.spectators.length}/2)</Text>
                {room.spectators.length === 0 ? (
                    <Text style={styles.emptyText}>Aucun spectateur</Text>
                ) : (
                    <FlatList
                        data={room.spectators}
                        keyExtractor={item => item.id}
                        renderItem={({ item }) => (
                            <View style={styles.spectatorRow}>
                                <View style={styles.playerInfo}>
                                    <PlayerAvatar name={item.name} size={30} />
                                    <Text style={styles.spectatorName}>{item.name}</Text>
                                </View>
                                <Text style={{ fontSize: 18 }}>👁️</Text>
                            </View>
                        )}
                    />
                )}
            </View>

            {/* Seul l'hôte voit le bouton Démarrer */}
            {(isHost || room.hostId === socketService.socket.id) ? (
                <TouchableOpacity
                    style={[styles.btnStart, room.activePlayers.length < 2 && styles.btnDisabled]}
                    onPress={handleStartGame}
                    disabled={room.activePlayers.length < 2}
                >
                    <Text style={styles.btnStartText}>DÉMARRER LA PARTIE</Text>
                </TouchableOpacity>
            ) : (
                <Text style={styles.waitingText}>En attente du lancement par l'hôte...</Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1C0F13', // Moroccan Dark
        padding: 20,
    },
    header: {
        alignItems: 'center',
        marginVertical: 40,
    },
    title: {
        color: '#D4AF37', // Gold
        fontSize: 32,
        fontWeight: '900',
    },
    subtitle: {
        color: '#9CA3AF',
        fontSize: 16,
        marginTop: 5,
    },
    listContainer: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.7)', // Slate dark transparent
        borderRadius: 20,
        padding: 20,
        borderWidth: 2,
        borderColor: '#B8860B',
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.1,
        shadowRadius: 15,
        elevation: 5,
    },
    sectionTitle: {
        color: '#D4AF37',
        fontSize: 20,
        fontWeight: '900',
        marginBottom: 15,
        borderBottomWidth: 2,
        borderBottomColor: 'rgba(212, 175, 55, 0.3)',
        paddingBottom: 8,
        letterSpacing: 1,
    },
    playerRow: {
        backgroundColor: 'rgba(30, 41, 59, 0.8)',
        padding: 12,
        borderRadius: 12,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
    },
    playerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    playerName: {
        color: '#F8FAFC',
        fontSize: 18,
        fontWeight: '700',
    },
    hostBadge: {
        color: '#FFD700',
        fontWeight: '900',
        fontSize: 12,
        letterSpacing: 1,
        backgroundColor: 'rgba(255, 215, 0, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
        overflow: 'hidden',
    },
    spectatorRow: {
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        padding: 10,
        borderRadius: 12,
        marginBottom: 8,
        borderStyle: 'dashed',
        borderWidth: 1.5,
        borderColor: '#64748B',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    spectatorName: {
        color: '#CBD5E1',
        fontSize: 14,
        fontStyle: 'italic',
    },
    emptyText: {
        color: '#64748B',
        fontStyle: 'italic',
    },
    btnStart: {
        backgroundColor: '#FFD700',
        padding: 18,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 25,
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 6,
    },
    btnDisabled: {
        opacity: 0.5,
        backgroundColor: '#94A3B8',
        shadowOpacity: 0,
    },
    btnStartText: {
        color: '#1C0F13',
        fontWeight: '900',
        fontSize: 18,
        letterSpacing: 1,
    },
    waitingText: {
        color: '#D4AF37',
        textAlign: 'center',
        marginTop: 20,
        fontStyle: 'italic',
    },
});
