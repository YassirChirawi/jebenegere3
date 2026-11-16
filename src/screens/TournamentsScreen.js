import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ImageBackground, ScrollView, TextInput, Pressable, ActivityIndicator } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { PressableScale, GameButton, theme } from '../components/ui';
import { dialog } from '../components/Dialog';
import socketService from '../network/socketService';
import { myTournaments, remember, GAME_LABEL, formatWhen } from '../utils/tournaments';

const BG = require('../../assets/Yellow and White Illustrative Ramadan Greeting Instagram Post.png');
const DAY_MS = 86400000;
const STEP = 15; // minutes

// Prochain quart d'heure, au moins 30 minutes à l'avance
function defaultTime() {
    const d = new Date(Date.now() + 30 * 60000);
    d.setMinutes(Math.ceil(d.getMinutes() / STEP) * STEP, 0, 0);
    return d.getHours() * 60 + d.getMinutes();
}
const dayStart = (offset) => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() + offset * DAY_MS; };
const dayLabel = (offset) => {
    if (offset === 0) return "Aujourd'hui";
    if (offset === 1) return 'Demain';
    const d = new Date(dayStart(offset));
    return `${['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][d.getDay()]} ${d.getDate()}`;
};
const hhmm = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}h${String(min % 60).padStart(2, '0')}`;

function Chips({ options, value, onChange }) {
    return (
        <View style={styles.chips}>
            {options.map(([k, label]) => (
                <Pressable key={String(k)} onPress={() => onChange(k)} style={[styles.chip, value === k && styles.chipOn]}>
                    <Text style={[styles.chipText, value === k && { color: theme.bg }]}>{label}</Text>
                </Pressable>
            ))}
        </View>
    );
}

/** Tournois : en créer un, retrouver les siens, palmarès des champions. */
export default function TournamentsScreen({ navigation }) {
    const supported = socketService.supports('tournaments');
    const [showForm, setShowForm] = useState(false);
    const [name, setName] = useState('');
    const [gameType, setGameType] = useState('hezz2');
    const [mode, setMode] = useState('solo');
    const [size, setSize] = useState(4);
    const [day, setDay] = useState(0);
    const [minutes, setMinutes] = useState(defaultTime);
    const [busy, setBusy] = useState(false);
    const [mine, setMine] = useState([]);
    const [palmares, setPalmares] = useState(null);

    useFocusEffect(useCallback(() => {
        myTournaments().then(setMine);
        if (supported) socketService.tournamentPalmares((r) => setPalmares(r?.success ? r.list : []));
    }, [supported]));

    const startsAt = useMemo(() => dayStart(day) + minutes * 60000, [day, minutes]);
    const tooSoon = startsAt < Date.now() + 60000;

    const create = () => {
        if (name.trim().length < 3) { dialog.alert('Nom du tournoi', 'Donne un nom au tournoi (3 caractères au moins).'); return; }
        if (tooSoon) { dialog.alert('Heure passée', 'Choisis une heure à venir.'); return; }
        setBusy(true);
        socketService.tournamentCreate({ name: name.trim(), gameType, mode: gameType === 'ronda' ? mode : 'solo', size, startsAt }, async (r) => {
            setBusy(false);
            if (!r?.success) { dialog.alert('Oups', r?.message || 'Le serveur ne répond pas.'); return; }
            await remember(r.id, { hostToken: r.hostToken, name: r.tournament.name, gameType, startsAt: r.tournament.startsAt });
            setShowForm(false);
            setName('');
            navigation.navigate('Tournament', { id: r.id });
        });
    };

    return (
        <ImageBackground source={BG} style={styles.container} resizeMode="cover">
            <View style={styles.header}>
                <PressableScale style={styles.headBtn} onPress={() => navigation.goBack()}>
                    <Text style={styles.headBtnText}>⬅️ Retour</Text>
                </PressableScale>
                <Text style={styles.headTitle}>🏆 Tournois</Text>
                <View style={{ width: 70 }} />
            </View>

            <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
                {!supported ? (
                    <Text style={styles.empty}>⚠️ Le serveur en ligne n'est pas à jour : les tournois seront disponibles après son redéploiement.</Text>
                ) : (
                    <>
                        <Text style={styles.intro}>Élimination directe à 4 ou 8 joueurs, en Hezz2 ou en Ronda. Le champion gagne le dos de cartes « Champion » 👑 et le titre « Moul chi ».</Text>

                        {!showForm ? (
                            <GameButton title="CRÉER UN TOURNOI" icon="➕" onPress={() => setShowForm(true)} style={{ marginTop: 10 }} />
                        ) : (
                            <Animated.View entering={FadeInDown.springify().damping(16)} style={styles.card}>
                                <Text style={styles.cardTitle}>Nouveau tournoi</Text>
                                <Text style={styles.label}>NOM</Text>
                                <TextInput
                                    style={styles.input}
                                    value={name}
                                    onChangeText={setName}
                                    placeholder="Ex : Coupe du quartier"
                                    placeholderTextColor={theme.textDim}
                                    maxLength={40}
                                    accessibilityLabel="Nom du tournoi"
                                />
                                <Text style={styles.label}>JEU</Text>
                                <Chips options={[['hezz2', 'Hezz2'], ['ronda', 'Ronda']]} value={gameType} onChange={setGameType} />
                                {gameType === 'ronda' && (
                                    <>
                                        <Text style={styles.label}>FORMAT</Text>
                                        <Chips options={[['solo', '1 contre 1'], ['duo', '2 contre 2']]} value={mode} onChange={setMode} />
                                    </>
                                )}
                                <Text style={styles.label}>JOUEURS</Text>
                                <Chips options={[[4, '4 joueurs'], [8, '8 joueurs']]} value={size} onChange={setSize} />
                                <Text style={styles.label}>JOUR</Text>
                                <Chips options={[0, 1, 2, 3, 4, 5, 6].map((d) => [d, dayLabel(d)])} value={day} onChange={setDay} />
                                <Text style={styles.label}>HEURE</Text>
                                <View style={styles.timeRow}>
                                    <PressableScale style={styles.timeBtn} onPress={() => setMinutes((m) => (m - STEP + 1440) % 1440)}>
                                        <Text style={styles.timeBtnText}>−</Text>
                                    </PressableScale>
                                    <Text style={[styles.time, tooSoon && { color: '#F87171' }]}>{hhmm(minutes)}</Text>
                                    <PressableScale style={styles.timeBtn} onPress={() => setMinutes((m) => (m + STEP) % 1440)}>
                                        <Text style={styles.timeBtnText}>+</Text>
                                    </PressableScale>
                                </View>
                                <Text style={styles.hint}>
                                    {tooSoon ? 'Cette heure est déjà passée.' : `Début ${formatWhen(startsAt)}. Tu pourras aussi le lancer plus tôt, dès que tout le monde est inscrit.`}
                                </Text>
                                <Text style={styles.hint}>
                                    {gameType === 'ronda' && mode === 'duo'
                                        ? `${size} joueurs = ${size / 2} équipes de 2, formées au tirage au sort.`
                                        : `Matchs en 1 contre 1, ${size === 4 ? 'demi-finales puis finale' : 'quarts, demi-finales puis finale'}.`}
                                </Text>
                                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                                    <GameButton small title="Annuler" variant="outline" onPress={() => setShowForm(false)} style={{ flex: 1 }} />
                                    <GameButton small title={busy ? 'Création…' : 'Créer'} icon="🏆" onPress={create} disabled={busy} style={{ flex: 1 }} />
                                </View>
                            </Animated.View>
                        )}

                        <Text style={styles.section}>MES TOURNOIS</Text>
                        {mine.length === 0 && <Text style={styles.emptySmall}>Aucun pour l'instant. Crée un tournoi ou ouvre un lien d'inscription reçu d'un ami.</Text>}
                        {mine.map((t) => (
                            <PressableScale key={t.id} onPress={() => navigation.navigate('Tournament', { id: t.id })} style={styles.row}>
                                <Text style={styles.rowIcon}>{t.won ? '👑' : t.hostToken ? '🎙️' : '🎟️'}</Text>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.rowName} numberOfLines={1}>{t.name || t.id}</Text>
                                    <Text style={styles.rowSub}>{GAME_LABEL[t.gameType] || ''}{t.startsAt ? ` · ${formatWhen(t.startsAt)}` : ''}{t.hostToken ? ' · organisateur' : ''}</Text>
                                </View>
                                <Text style={styles.rowArrow}>›</Text>
                            </PressableScale>
                        ))}

                        <Text style={styles.section}>PALMARÈS</Text>
                        {palmares === null && <ActivityIndicator color={theme.gold} style={{ marginTop: 10 }} />}
                        {palmares && palmares.length === 0 && <Text style={styles.emptySmall}>Aucun champion pour l'instant. Le premier tournoi gagné apparaîtra ici.</Text>}
                        {(palmares || []).map((p) => (
                            <PressableScale key={p.id} onPress={() => navigation.navigate('Tournament', { id: p.id })} style={styles.row}>
                                <Text style={styles.rowIcon}>👑</Text>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.rowName} numberOfLines={1}>{p.champion}</Text>
                                    <Text style={styles.rowSub} numberOfLines={1}>{p.name} · {GAME_LABEL[p.gameType]}{p.mode === 'duo' ? ' 2c2' : ''} · {new Date(p.finishedAt).toLocaleDateString('fr-FR')}</Text>
                                </View>
                                <Text style={styles.rowArrow}>›</Text>
                            </PressableScale>
                        ))}
                    </>
                )}
            </ScrollView>
        </ImageBackground>
    );
}

export const tournamentStyles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 44, paddingHorizontal: 14, paddingBottom: 8, backgroundColor: 'rgba(18,8,11,0.85)' },
    headBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, backgroundColor: 'rgba(212,175,55,0.15)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)' },
    headBtnText: { color: theme.goldLight, fontWeight: '800', fontSize: 13 },
    headTitle: { color: theme.goldLight, fontSize: 20, fontWeight: '900', flexShrink: 1, textAlign: 'center' },
    list: { padding: 16, paddingBottom: 48, maxWidth: 560, width: '100%', alignSelf: 'center' },
    intro: { color: theme.cream, fontSize: 13, textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 12, lineHeight: 19 },
    card: { backgroundColor: 'rgba(28,15,19,0.95)', borderRadius: 16, padding: 14, marginTop: 12, borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)' },
    cardTitle: { color: theme.goldLight, fontWeight: '900', fontSize: 16, marginBottom: 4 },
    label: { color: theme.gold, fontWeight: '900', fontSize: 11, letterSpacing: 1, marginTop: 12, marginBottom: 6 },
    input: { backgroundColor: 'rgba(0,0,0,0.4)', color: theme.cream, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
    chipOn: { backgroundColor: theme.gold, borderColor: theme.goldLight },
    chipText: { color: theme.cream, fontWeight: '800', fontSize: 13 },
    timeRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    timeBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(212,175,55,0.18)', borderWidth: 1, borderColor: theme.gold, alignItems: 'center', justifyContent: 'center' },
    timeBtnText: { color: theme.goldLight, fontSize: 22, fontWeight: '900' },
    time: { color: theme.cream, fontSize: 26, fontWeight: '900', minWidth: 96, textAlign: 'center' },
    hint: { color: theme.textDim, fontSize: 12, marginTop: 8, lineHeight: 17 },
    section: { color: theme.gold, fontWeight: '900', fontSize: 12, letterSpacing: 1.5, marginTop: 22, marginBottom: 8, textShadowColor: '#000', textShadowRadius: 4 },
    row: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(28,15,19,0.92)', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 6, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)' },
    rowIcon: { fontSize: 20, width: 32 },
    rowName: { color: theme.cream, fontWeight: '800', fontSize: 14 },
    rowSub: { color: theme.textDim, fontSize: 11, marginTop: 2 },
    rowArrow: { color: theme.gold, fontSize: 22, fontWeight: '900', marginLeft: 6 },
    empty: { color: theme.cream, textAlign: 'center', marginTop: 16, backgroundColor: 'rgba(0,0,0,0.5)', padding: 12, borderRadius: 12 },
    emptySmall: { color: theme.textDim, fontSize: 12, backgroundColor: 'rgba(0,0,0,0.45)', padding: 10, borderRadius: 12 },
});
const styles = tournamentStyles;
