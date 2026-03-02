import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert } from 'react-native';
import socketService from '../network/socketService';

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
                            <Text style={styles.playerName}>
                                {item.name} {item.id === room.hostId ? '👑' : ''}
                            </Text>
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
                                <Text style={styles.spectatorName}>{item.name} 👁️</Text>
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
        backgroundColor: '#2F1218', // Inner table color
        borderRadius: 16,
        padding: 20,
        borderWidth: 2,
        borderColor: '#B8860B',
    },
    sectionTitle: {
        color: '#D4AF37',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#4A0E1A',
        paddingBottom: 5,
    },
    playerRow: {
        backgroundColor: '#4A0E1A',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
    },
    playerName: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    spectatorRow: {
        backgroundColor: '#1E293B',
        padding: 10,
        borderRadius: 8,
        marginBottom: 8,
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: '#64748B',
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
        backgroundColor: '#D4AF37',
        padding: 18,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 20,
    },
    btnDisabled: {
        opacity: 0.5,
    },
    btnStartText: {
        color: '#1C0F13',
        fontWeight: '900',
        fontSize: 18,
    },
    waitingText: {
        color: '#D4AF37',
        textAlign: 'center',
        marginTop: 20,
        fontStyle: 'italic',
    },
});
