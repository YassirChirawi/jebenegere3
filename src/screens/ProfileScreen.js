import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ImageBackground, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PlayerAvatar from '../components/PlayerAvatar';
import { getRankInfo } from '../utils/stats';

export default function ProfileScreen({ navigation }) {
    const [stats, setStats] = useState({
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        xp: 0,
        playerName: 'Joueur'
    });
    const [history, setHistory] = useState([]);
    const [rankInfo, setRankInfo] = useState(null);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const savedName = await AsyncStorage.getItem('playerName');
            const gamesPlayed = await AsyncStorage.getItem('gamesPlayed');
            const wins = await AsyncStorage.getItem('wins');
            const losses = await AsyncStorage.getItem('losses');
            const xpStr = await AsyncStorage.getItem('playerXP');
            const historyStr = await AsyncStorage.getItem('matchHistory');

            const xp = parseInt(xpStr || '0', 10);

            setStats({
                playerName: savedName || 'Joueur',
                gamesPlayed: parseInt(gamesPlayed || '0', 10),
                wins: parseInt(wins || '0', 10),
                losses: parseInt(losses || '0', 10),
                xp: xp
            });

            setRankInfo(getRankInfo(xp));

            if (historyStr) {
                setHistory(JSON.parse(historyStr));
            }
        } catch (error) {
            console.error('Erreur lors du chargement des stats:', error);
        }
    };

    const winRate = stats.gamesPlayed > 0
        ? Math.round((stats.wins / stats.gamesPlayed) * 100)
        : 0;

    return (
        <ImageBackground
            source={require('../../assets/Yellow and White Illustrative Ramadan Greeting Instagram Post.png')}
            style={styles.container}
            resizeMode="cover"
        >
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Text style={styles.backBtnText}>⬅️ Retour</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Mon Profil</Text>
                <View style={{ width: 60 }} />
            </View>

            {/* Profile Info & XP */}
            <View style={styles.profileCard}>
                <PlayerAvatar name={stats.playerName} size={90} />
                <Text style={styles.playerName}>{stats.playerName}</Text>

                {rankInfo && (
                    <View style={styles.rankContainer}>
                        <Text style={styles.rankTitle}>{rankInfo.emoji} {rankInfo.name}</Text>

                        <View style={styles.xpBox}>
                            <Text style={styles.xpTextTotal}>{stats.xp} XP</Text>

                            {/* Barre de Progression */}
                            <View style={styles.progressTrack}>
                                <View style={[styles.progressFill, { width: `${Math.max(5, rankInfo.levelProgress * 100)}%` }]} />
                            </View>

                            {rankInfo.nextXP && (
                                <Text style={styles.xpNextText}>Prochain rang : {rankInfo.maxXP} XP</Text>
                            )}
                        </View>
                    </View>
                )}
            </View>

            {/* Statistics Grid */}
            <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                    <Text style={styles.statValue}>{stats.gamesPlayed}</Text>
                    <Text style={styles.statLabel}>Parties Jouées</Text>
                </View>
                <View style={styles.statBox}>
                    <Text style={[styles.statValue, { color: '#10B981' }]}>{stats.wins}</Text>
                    <Text style={styles.statLabel}>Victoires</Text>
                </View>
                <View style={styles.statBox}>
                    <Text style={[styles.statValue, { color: '#EF4444' }]}>{stats.losses}</Text>
                    <Text style={styles.statLabel}>Défaites</Text>
                </View>
                <View style={styles.statBox}>
                    <Text style={[styles.statValue, { color: '#FCD34D' }]}>{winRate}%</Text>
                    <Text style={styles.statLabel}>Taux Victoire</Text>
                </View>
            </View>

            {/* History Section */}
            <View style={styles.historyContainer}>
                <Text style={styles.historyTitle}>Dernières Parties</Text>
                <ScrollView style={styles.historyScroll}>
                    {history.length === 0 ? (
                        <Text style={styles.emptyHistory}>Aucune partie jouée pour l'instant.</Text>
                    ) : (
                        history.map((match) => (
                            <View key={match.id} style={styles.historyCard}>
                                <Text style={styles.historyDate}>{match.date}</Text>
                                <Text style={styles.historyOpponents}>Contre : {match.opponents}</Text>
                                <Text style={[styles.historyResult, { color: match.result.includes('Victoire') ? '#10B981' : '#EF4444' }]}>
                                    {match.result}
                                </Text>
                            </View>
                        ))
                    )}
                </ScrollView>
            </View>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1C0F13',
    },
    header: {
        flexDirection: 'row',
        paddingTop: 60,
        paddingBottom: 20,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    backBtn: {
        padding: 5,
    },
    backBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    title: {
        color: '#D4AF37',
        fontSize: 22,
        fontWeight: 'bold',
    },
    profileCard: {
        alignItems: 'center',
        marginTop: 40,
        marginBottom: 30,
    },
    playerName: {
        color: '#fff',
        fontSize: 28,
        fontWeight: '900',
        marginTop: 15,
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
    },
    rankContainer: {
        width: '80%',
        alignItems: 'center',
        marginTop: 15,
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        padding: 15,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: '#D4AF37',
    },
    rankTitle: {
        color: '#FFD700',
        fontSize: 22,
        fontWeight: '900',
        marginBottom: 10,
    },
    xpBox: {
        width: '100%',
        alignItems: 'center',
    },
    xpTextTotal: {
        color: '#F8FAFC',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    progressTrack: {
        width: '100%',
        height: 12,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 6,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#334155',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#10B981', // Vert émeraude
        borderRadius: 6,
    },
    xpNextText: {
        color: '#9CA3AF',
        fontSize: 12,
        marginTop: 6,
        fontStyle: 'italic',
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 15,
        paddingHorizontal: 20,
    },
    statBox: {
        backgroundColor: 'rgba(28, 46, 74, 0.8)',
        width: '45%',
        paddingVertical: 25,
        borderRadius: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
    },
    statValue: {
        fontSize: 36,
        fontWeight: '900',
        color: '#fff',
        marginBottom: 5,
    },
    statLabel: {
        fontSize: 14,
        color: '#9CA3AF',
        fontWeight: 'bold',
    },
    historyContainer: {
        flex: 1,
        marginTop: 30,
        backgroundColor: 'rgba(28, 46, 74, 0.9)',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        borderTopWidth: 2,
        borderColor: '#D4AF37',
    },
    historyTitle: {
        color: '#D4AF37',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 15,
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
    },
    historyCard: {
        backgroundColor: '#1C0F13',
        padding: 15,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#B8860B',
    },
    historyDate: {
        color: '#9CA3AF',
        fontSize: 12,
        marginBottom: 4,
    },
    historyOpponents: {
        color: '#E5E7EB',
        fontSize: 14,
        fontWeight: 'bold',
    },
    historyResult: {
        fontSize: 16,
        fontWeight: '900',
        marginTop: 8,
    },
    emptyHistory: {
        color: '#9CA3AF',
        textAlign: 'center',
        marginTop: 20,
        fontStyle: 'italic',
    }
});
