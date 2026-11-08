import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ImageBackground, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import PlayerAvatar from '../components/PlayerAvatar';
import { PressableScale, theme } from '../components/ui';
import { GAMES, GAME_ORDER } from '../games';
import accountService, { useAccount } from '../network/accountService';

const BG = require('../../assets/Yellow and White Illustrative Ramadan Greeting Instagram Post.png');
const MEDALS = ['🥇', '🥈', '🥉'];

function daysLeft(end) {
    const d = Math.max(0, Math.ceil((end - Date.now()) / 86400000));
    return d <= 1 ? 'dernier jour' : `${d} jours restants`;
}

/** Classement de la saison (4 semaines) : général et par jeu, pseudo seulement. */
export default function LeaderboardScreen({ navigation }) {
    const account = useAccount();
    const [game, setGame] = useState('all');
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        let alive = true;
        setData(null);
        setError(null);
        accountService.leaderboard(game).then((r) => {
            if (!alive) return;
            if (r.error) setError(r.error);
            else setData(r);
        });
        return () => { alive = false; };
    }, [game, account.token]);

    const Row = ({ r, me, i = 0 }) => (
        <Animated.View entering={FadeInRight.delay(Math.min(i, 12) * 40)} style={[styles.row, me && styles.rowMe]}>
            <Text style={styles.pos}>{MEDALS[r.rank - 1] || r.rank}</Text>
            <PlayerAvatar name={r.name} variant={r.avatar} size={32} />
            <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={[styles.name, me && { color: theme.goldLight }]} numberOfLines={1}>{r.name}{me ? ' (toi)' : ''}</Text>
                {r.title ? <Text style={styles.title} numberOfLines={1}>{r.title}</Text> : null}
            </View>
            <Text style={styles.xp}>{r.xp} XP</Text>
        </Animated.View>
    );

    const meInTop = data?.me && data.top.some((r) => r.rank === data.me.rank);

    return (
        <ImageBackground source={BG} style={styles.container} resizeMode="cover">
            <View style={styles.header}>
                <PressableScale style={styles.headBtn} onPress={() => navigation.goBack()}>
                    <Text style={styles.headBtnText}>⬅️ Retour</Text>
                </PressableScale>
                <Text style={styles.headTitle}>🏆 Classement</Text>
                <View style={{ width: 70 }} />
            </View>

            <View style={styles.tabs}>
                {[['all', 'Général'], ...GAME_ORDER.map((g) => [g, GAMES[g].label])].map(([k, l]) => (
                    <Pressable key={k} onPress={() => setGame(k)} style={[styles.tab, game === k && styles.tabOn]}>
                        <Text style={[styles.tabText, game === k && { color: theme.bg }]} numberOfLines={1}>{l}</Text>
                    </Pressable>
                ))}
            </View>

            {data && (
                <Text style={styles.season}>
                    Saison {data.season.id} · {daysLeft(data.season.end)} · {data.players} joueur{data.players > 1 ? 's' : ''} classé{data.players > 1 ? 's' : ''}
                </Text>
            )}
            <Text style={styles.reward}>Top 10 en fin de saison : dos de cartes exclusif + badge 🏅</Text>

            {!data && !error && <ActivityIndicator color={theme.gold} style={{ marginTop: 30 }} />}
            {error && <Text style={styles.error}>{error}</Text>}

            {data && (
                <ScrollView contentContainerStyle={styles.list}>
                    {data.top.length === 0 && <Text style={styles.empty}>Personne n'est encore classé cette saison. À toi de jouer !</Text>}
                    {data.top.map((r, i) => <Row key={`${r.rank}-${r.name}`} r={r} i={i} me={data.me?.rank === r.rank && data.me?.name === r.name} />)}
                    {data.me && !meInTop && (
                        <>
                            <Text style={styles.dots}>…</Text>
                            <Row r={data.me} me />
                        </>
                    )}
                    {!account.profile && (
                        <Text style={styles.empty}>Crée ton compte dans le Profil pour apparaître au classement.</Text>
                    )}
                </ScrollView>
            )}
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 44, paddingHorizontal: 14, paddingBottom: 8, backgroundColor: 'rgba(18,8,11,0.85)' },
    headBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, backgroundColor: 'rgba(212,175,55,0.15)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)' },
    headBtnText: { color: theme.goldLight, fontWeight: '800', fontSize: 13 },
    headTitle: { color: theme.goldLight, fontSize: 20, fontWeight: '900' },
    tabs: { flexDirection: 'row', margin: 12, marginBottom: 6, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, padding: 3, maxWidth: 560, alignSelf: 'center', width: '94%' },
    tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
    tabOn: { backgroundColor: theme.gold },
    tabText: { color: theme.textDim, fontWeight: '800', fontSize: 11 },
    season: { color: theme.cream, textAlign: 'center', fontWeight: '800', fontSize: 12, backgroundColor: 'rgba(0,0,0,0.45)', alignSelf: 'center', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
    reward: { color: theme.goldLight, textAlign: 'center', fontSize: 11, marginTop: 4 },
    list: { padding: 12, paddingBottom: 40, maxWidth: 560, width: '100%', alignSelf: 'center' },
    row: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(28,15,19,0.92)', borderRadius: 14, paddingVertical: 8, paddingHorizontal: 10, marginBottom: 6, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)' },
    rowMe: { borderColor: theme.gold, backgroundColor: 'rgba(60,40,10,0.95)' },
    pos: { width: 32, textAlign: 'center', color: theme.cream, fontWeight: '900', fontSize: 15 },
    name: { color: theme.cream, fontWeight: '800' },
    title: { color: theme.mint, fontSize: 10, fontStyle: 'italic' },
    xp: { color: theme.goldLight, fontWeight: '900' },
    dots: { color: theme.textDim, textAlign: 'center', marginVertical: 2 },
    empty: { color: theme.cream, textAlign: 'center', marginTop: 16, backgroundColor: 'rgba(0,0,0,0.45)', padding: 10, borderRadius: 12 },
    error: { color: '#F87171', textAlign: 'center', marginTop: 20, fontWeight: '800' },
});
