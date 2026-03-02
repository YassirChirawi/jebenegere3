import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ImageBackground, Alert, ScrollView } from 'react-native';
import socketService from '../network/socketService';
import audioService from '../network/audioService';
import RulesModal from '../components/RulesModal';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function HomeScreen({ navigation }) {
    const [name, setName] = useState('');
    const [roomIdInput, setRoomIdInput] = useState('');
    const [showRules, setShowRules] = useState(true);
    const [showBotMenu, setShowBotMenu] = useState(false);
    const [isMuted, setIsMuted] = useState(false);

    useEffect(() => {
        // Init socket connection when app starts
        socketService.connect();

        return () => {
            // Unmount cleanup if needed (usually we keep socket alive for the session)
        };
    }, []);

    useEffect(() => {
        const loadName = async () => {
            try {
                const savedName = await AsyncStorage.getItem('playerName');
                if (savedName) setName(savedName);

                // Synchroniser avec l'état actuel de l'audioService
                setIsMuted(audioService.muted);
            } catch (error) {
                console.error('Failed to load storage state', error);
            }
        };
        loadName();
    }, []);

    const handleToggleSound = async () => {
        const newMutedState = await audioService.toggleMute();
        setIsMuted(newMutedState);
    };

    const handleCreateRoom = async () => {
        if (!name.trim()) {
            Alert.alert("Erreur", "Veuillez entrer un pseudo.");
            return;
        }

        await AsyncStorage.setItem('playerName', name);
        socketService.createRoom(name, (response) => {
            if (response.success) {
                navigation.navigate('Lobby', { roomId: response.roomId, playerName: name, isHost: true, initialRoom: response.roomData });
            } else {
                Alert.alert("Erreur", "Impossible de créer le salon.");
            }
        });
    };

    const handleJoinRoom = async () => {
        if (!name.trim()) {
            Alert.alert("Erreur", "Veuillez entrer un pseudo.");
            return;
        }
        if (!roomIdInput.trim()) {
            Alert.alert("Erreur", "Veuillez entrer un code de salon.");
            return;
        }

        const roomCode = roomIdInput.trim().toUpperCase();
        await AsyncStorage.setItem('playerName', name);
        socketService.joinRoom(roomCode, name, (response) => {
            if (response.success) {
                navigation.navigate('Lobby', { roomId: roomCode, playerName: name, isHost: false, initialRoom: response.roomData });
            } else {
                Alert.alert("Erreur", response.message);
            }
        });
    };

    const handleCreateBotRoom = async (botCount) => {
        if (!name.trim()) {
            Alert.alert("Erreur", "Veuillez entrer un pseudo.");
            return;
        }

        await AsyncStorage.setItem('playerName', name);

        // Le compteur `botCount` inclut le joueur humain. Ex: 4 Joueurs = Vous + 3 Bots
        socketService.createBotRoom(name, botCount, (response) => {
            if (response.success) {
                // On va directement sur l'écran Game
                navigation.navigate('Game', { roomId: response.roomId, playerName: name, initialGameState: response.gameState });
            } else {
                Alert.alert("Erreur", "Impossible de créer la partie contre l'ordinateur.");
            }
        });
    };

    return (
        <ImageBackground
            source={require('../../assets/Yellow and White Illustrative Ramadan Greeting Instagram Post.png')}
            style={styles.container}
            resizeMode="cover"
        >
            {/* Sound Toggle Icon Top Left */}
            <TouchableOpacity
                style={styles.soundBtn}
                onPress={handleToggleSound}
            >
                <Text style={styles.profileBtnText}>{isMuted ? '🔇' : '🔊'}</Text>
            </TouchableOpacity>

            {/* Profile Icon Top Right */}
            <TouchableOpacity
                style={styles.profileBtn}
                onPress={() => navigation.navigate('Profile')}
            >
                <Text style={styles.profileBtnText}>👤</Text>
            </TouchableOpacity>

            <ScrollView
                style={{ width: '100%' }}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.overlay}>
                    <Text style={styles.title}>JEBEN GERE3</Text>
                    <Text style={styles.subtitle}>En Ligne (jusqu'à 6 joueurs)</Text>

                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Votre Pseudo</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Ex: Yassir..."
                            placeholderTextColor="#9CA3AF"
                            value={name}
                            onChangeText={setName}
                            maxLength={15}
                        />
                    </View>

                    <TouchableOpacity style={styles.btnPrimary} onPress={handleCreateRoom}>
                        <Text style={styles.btnText}>🌐 CRÉER UN SALON MULTI-JOUEUR</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: '#10B981', marginTop: 10 }]} onPress={() => setShowBotMenu(!showBotMenu)}>
                        <Text style={styles.btnText}>🤖 JOUER CONTRE L'IA</Text>
                    </TouchableOpacity>

                    {showBotMenu && (
                        <View style={styles.botMenu}>
                            <Text style={styles.botMenuTitle}>Nombre total de joueurs :</Text>
                            <View style={styles.botButtonsRow}>
                                <TouchableOpacity style={styles.botBtn} onPress={() => handleCreateBotRoom(2)}><Text style={styles.btnText}>2</Text></TouchableOpacity>
                                <TouchableOpacity style={styles.botBtn} onPress={() => handleCreateBotRoom(3)}><Text style={styles.btnText}>3</Text></TouchableOpacity>
                                <TouchableOpacity style={styles.botBtn} onPress={() => handleCreateBotRoom(4)}><Text style={styles.btnText}>4</Text></TouchableOpacity>
                            </View>
                        </View>
                    )}

                    <View style={styles.divider}>
                        <View style={styles.line} />
                        <Text style={styles.dividerText}>OU</Text>
                        <View style={styles.line} />
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Code du Salon</Text>
                        <TextInput
                            style={[styles.input, styles.codeInput]}
                            placeholder="ABCD..."
                            placeholderTextColor="#9CA3AF"
                            value={roomIdInput}
                            onChangeText={setRoomIdInput}
                            autoCapitalize="characters"
                            maxLength={5}
                        />
                    </View>

                    <TouchableOpacity style={styles.btnSecondary} onPress={handleJoinRoom}>
                        <Text style={styles.btnTextSecondary}>REJOINDRE LE SALON</Text>
                    </TouchableOpacity>

                    {/* Bouton Info pour rouvrir les règles du menu */}
                    <TouchableOpacity onPress={() => setShowRules(true)} style={styles.infoButton}>
                        <Text style={styles.infoButtonText}>ℹ️ Lire les Règles</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <RulesModal visible={showRules} onClose={() => setShowRules(false)} />
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    profileBtn: {
        position: 'absolute',
        top: 50,
        right: 20,
        backgroundColor: 'rgba(28, 46, 74, 0.8)',
        width: 45,
        height: 45,
        borderRadius: 22.5,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#D4AF37',
        zIndex: 10,
    },
    soundBtn: {
        position: 'absolute',
        top: 50,
        left: 20,
        backgroundColor: 'rgba(28, 46, 74, 0.8)',
        width: 45,
        height: 45,
        borderRadius: 22.5,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#D4AF37',
        zIndex: 10,
    },
    profileBtnText: {
        fontSize: 22,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 100,
    },
    overlay: {
        width: '85%',
        backgroundColor: 'rgba(28, 15, 19, 0.85)', // Dark rich background
        padding: 30,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: '#D4AF37', // Gold
        alignItems: 'center',
    },
    title: {
        fontSize: 48,
        fontWeight: '900',
        color: '#D4AF37',
        marginBottom: 5,
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: -1, height: 1 },
        textShadowRadius: 10,
    },
    subtitle: {
        fontSize: 16,
        color: '#fff',
        marginBottom: 30,
        fontWeight: '600',
    },
    inputContainer: {
        width: '100%',
        marginBottom: 15,
    },
    label: {
        color: '#D4AF37',
        marginBottom: 5,
        fontWeight: 'bold',
    },
    input: {
        backgroundColor: '#4A0E1A',
        borderWidth: 1,
        borderColor: '#B8860B',
        color: '#fff',
        padding: 12,
        borderRadius: 8,
        fontSize: 16,
    },
    codeInput: {
        textAlign: 'center',
        fontWeight: 'bold',
        letterSpacing: 2,
    },
    btnPrimary: {
        backgroundColor: '#D4AF37',
        width: '100%',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 10,
    },
    btnSecondary: {
        backgroundColor: '#1E293B',
        borderWidth: 2,
        borderColor: '#D4AF37',
        width: '100%',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 10,
    },
    btnText: {
        color: '#1C0F13',
        fontWeight: 'bold',
        fontSize: 16,
    },
    btnTextSecondary: {
        color: '#D4AF37',
        fontWeight: 'bold',
        fontSize: 16,
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        marginVertical: 20,
    },
    line: {
        flex: 1,
        height: 1,
        backgroundColor: '#D4AF37',
    },
    dividerText: {
        color: '#D4AF37',
        paddingHorizontal: 10,
        fontWeight: 'bold',
    },
    infoButton: {
        marginTop: 20,
        backgroundColor: '#4A0E1A',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 20,
        alignItems: 'center',
    },
    infoButtonText: {
        color: '#FCD34D',
        fontSize: 14,
        fontWeight: 'bold',
    },
    botMenu: {
        backgroundColor: '#1E293B',
        padding: 15,
        borderRadius: 12,
        marginTop: 10,
        width: '100%',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#10B981',
    },
    botMenuTitle: {
        color: '#fff',
        marginBottom: 10,
        fontWeight: 'bold',
    },
    botButtonsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 15,
    },
    botBtn: {
        backgroundColor: '#10B981',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
});
