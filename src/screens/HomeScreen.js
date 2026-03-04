import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ImageBackground, Alert, ScrollView, Image } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    Easing
} from 'react-native-reanimated';
import socketService from '../network/socketService';
import audioService from '../network/audioService';
import RulesModal from '../components/RulesModal';
import PlayerAvatar from '../components/PlayerAvatar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getRankInfo } from '../utils/stats';

const GAME_LOGO = require('../../assets/icon.png'); // Assuming this is the game logo

export default function HomeScreen({ navigation }) {
    const [name, setName] = useState('');
    const [roomIdInput, setRoomIdInput] = useState('');
    const [showRules, setShowRules] = useState(true);
    const [showBotMenu, setShowBotMenu] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [rankInfo, setRankInfo] = useState(null);

    // UI Matchmaking aléatoire
    const [isSearching, setIsSearching] = useState(false);
    const [searchingSize, setSearchingSize] = useState(null); // 2, 3 ou 4
    const [showMatchmakingMenu, setShowMatchmakingMenu] = useState(false);

    const rotation = useSharedValue(0);

    useEffect(() => {
        // Start spinning animation
        rotation.value = withRepeat(
            withTiming(360, { duration: 2000, easing: Easing.linear }),
            -1,
            false
        );

        // Init socket connection when app starts
        socketService.connect();

        socketService.onConnect(() => {
            setIsConnected(true);
        });

        socketService.onDisconnect(() => {
            setIsConnected(false);
        });

        return () => {
            // Unmount cleanup if needed (usually we keep socket alive for the session)
        };
    }, []);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ rotateY: `${rotation.value}deg` }]
        };
    });

    useEffect(() => {
        const loadName = async () => {
            try {
                const savedName = await AsyncStorage.getItem('playerName');
                if (savedName) setName(savedName);

                const xpStr = await AsyncStorage.getItem('playerXP');
                const xp = parseInt(xpStr || '0', 10);
                setRankInfo(getRankInfo(xp));

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

    // Placeholder for handleSearchMatch and handleCancelSearch
    const handleSearchMatch = (size) => {
        Alert.alert("Matchmaking", `Searching for a ${size}-player match... (Not implemented yet)`);
        setIsSearching(true);
        setSearchingSize(size);
        // Implement actual matchmaking logic here
    };

    const handleCancelSearch = () => {
        Alert.alert("Matchmaking", "Search cancelled. (Not implemented yet)");
        setIsSearching(false);
        setSearchingSize(null);
        // Implement actual cancellation logic here
    };

    if (!isConnected) {
        return (
            <ImageBackground
                source={require('../../assets/Yellow and White Illustrative Ramadan Greeting Instagram Post.png')}
                style={styles.container}
                resizeMode="cover"
            >
                <View style={styles.loaderContainer}>
                    <Animated.Image
                        source={require('../../assets/icon.png')}
                        style={[styles.loaderImage, animatedStyle]}
                        resizeMode="contain"
                    />
                    <Text style={styles.loaderTitle}>Réveil du serveur...</Text>
                    <Text style={styles.loaderSubtitle}>Veuillez patienter quelques secondes</Text>
                </View>
            </ImageBackground>
        );
    }

    return (
        <ImageBackground
            source={require('../../assets/Yellow and White Illustrative Ramadan Greeting Instagram Post.png')}
            style={styles.container}
            resizeMode="cover"
        >
            <ScrollView
                style={{ width: '100%' }}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.overlay}>
                    <View style={styles.header}>
                        {/* Botton Paramètres / Profil (Temporaire) */}
                        <TouchableOpacity style={styles.profileBtn} onPress={() => navigation.navigate('Profile')}>
                            <Text style={styles.profileBtnText}>👤</Text>
                        </TouchableOpacity>

                        {/* Titre Principal */}
                        <Animated.View style={[styles.titleContainer, animatedStyle]}>
                            <Image source={GAME_LOGO} style={styles.headerLogo} resizeMode="contain" />
                            <Text style={styles.titleText}>JEBAN</Text>
                            <Text style={styles.titleTextHighlight}>GERE3</Text>
                        </Animated.View>

                        {/* Soutien Audio */}
                        <TouchableOpacity style={styles.soundBtn} onPress={handleToggleSound}>
                            <Text style={styles.profileBtnText}>{isMuted ? '🔇' : '🔊'}</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Affichage du Rang du Joueur (si le nom est entré ou lu) */}
                    {rankInfo && name.trim().length > 0 && (
                        <View style={styles.homeRankContainer}>
                            <Text style={styles.homeRankText}>{rankInfo.emoji} {rankInfo.name}</Text>
                            <Text style={styles.homeXpText}>{rankInfo.currentXP} XP</Text>
                        </View>
                    )}

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

                    {/* SI LE JOUEUR CHERCHE UNE PARTIE */}
                    {isSearching ? (
                        <View style={styles.searchingContainer}>
                            <Animated.Image
                                source={require('../../assets/icon.png')}
                                style={[styles.searchingIcon, animatedStyle]}
                            />
                            <Text style={styles.searchingTitle}>Recherche d'adversaires...</Text>
                            <Text style={styles.searchingSubtitle}>Partie à {searchingSize} joueurs sélectionnée</Text>
                            <Text style={styles.searchingWaitInfo}>(Des bots rejoindront si l'attente est trop longue)</Text>

                            <TouchableOpacity style={styles.btnCancelSearch} onPress={handleCancelSearch}>
                                <Text style={styles.btnTextCancel}>❌ ANNULER LA RECHERCHE</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        // BOUTONS NORMAUX
                        <>
                            {/* BOUTON MATCHMAKING */}
                            <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: '#F59E0B' }]} onPress={() => setShowMatchmakingMenu(!showMatchmakingMenu)}>
                                <Text style={styles.btnText}>🌍 CHERCHER DES JOUEURS EN LIGNE</Text>
                            </TouchableOpacity>

                            {showMatchmakingMenu && (
                                <View style={styles.botMenu}>
                                    <Text style={styles.botMenuTitle}>Trouver une partie en ligne de :</Text>
                                    <View style={styles.botButtonsRow}>
                                        <TouchableOpacity style={styles.botBtn} onPress={() => handleSearchMatch(2)}><Text style={styles.btnText}>2</Text></TouchableOpacity>
                                        <TouchableOpacity style={styles.botBtn} onPress={() => handleSearchMatch(3)}><Text style={styles.btnText}>3</Text></TouchableOpacity>
                                        <TouchableOpacity style={styles.botBtn} onPress={() => handleSearchMatch(4)}><Text style={styles.btnText}>4</Text></TouchableOpacity>
                                    </View>
                                </View>
                            )}

                            <View style={styles.divider}>
                                <View style={styles.line} />
                                <Text style={styles.dividerText}>CRÉER OU REJOINDRE</Text>
                                <View style={styles.line} />
                            </View>

                            <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: '#3B82F6', marginTop: 10 }]} onPress={handleCreateRoom}>
                                <Text style={styles.btnText}>🔒 CRÉER UN SALON PRIVÉ</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: '#10B981', marginTop: 10 }]} onPress={() => setShowBotMenu(!showBotMenu)}>
                                <Text style={styles.btnText}>🤖 PRATIQUE CONTRE L'IA</Text>
                            </TouchableOpacity>

                            {showBotMenu && (
                                <View style={styles.botMenu}>
                                    <Text style={styles.botMenuTitle}>Créer un match IA avec joueurs :</Text>
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
                                <Text style={styles.label}>Code du Salon Privé</Text>
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
                        </>
                    )}

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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 20,
    },
    profileBtn: {
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
    loaderContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(28, 15, 19, 0.85)',
        padding: 40,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: '#D4AF37',
    },
    loaderImage: {
        width: 100,
        height: 140,
        marginBottom: 20,
    },
    loaderTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#FFD700',
        marginBottom: 10,
        textAlign: 'center',
    },
    loaderSubtitle: {
        fontSize: 16,
        color: '#E2E8F0',
        textAlign: 'center',
    },
});
