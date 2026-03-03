import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ImageBackground, Alert, ScrollView } from 'react-native';
import socketService from '../network/socketService';
import audioService from '../network/audioService';
import RulesModal from '../components/RulesModal';
import PlayerAvatar from '../components/PlayerAvatar';
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
                        <View style={styles.nameHeaderRow}>
                            <Text style={styles.label}>Votre Pseudo</Text>
                            {name.trim() !== '' && <PlayerAvatar name={name} size={30} />}
                        </View>
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
        fontSize: 52,
        fontWeight: '900',
        color: '#FFD700',
        marginBottom: 5,
        textShadowColor: 'rgba(255, 215, 0, 0.4)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 20,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 18,
        color: '#E2E8F0',
        marginBottom: 40,
        fontWeight: '600',
        letterSpacing: 2,
    },
    inputContainer: {
        width: '100%',
        marginBottom: 20,
    },
    nameHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 5,
    },
    label: {
        color: '#D4AF37',
        fontWeight: 'bold',
        fontSize: 16,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    input: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        borderWidth: 2,
        borderColor: '#B8860B',
        color: '#FFD700',
        padding: 15,
        borderRadius: 12,
        fontSize: 18,
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
    },
    codeInput: {
        textAlign: 'center',
        fontWeight: 'bold',
        letterSpacing: 2,
    },
    btnPrimary: {
        backgroundColor: '#FFD700',
        width: '100%',
        padding: 18,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 15,
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 6,
    },
    btnSecondary: {
        backgroundColor: '#1E293B',
        borderWidth: 2,
        borderColor: '#FFD700',
        width: '100%',
        padding: 18,
        borderRadius: 12,
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
