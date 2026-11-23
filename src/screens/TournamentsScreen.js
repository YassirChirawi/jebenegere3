import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { PressableScale, GameButton, theme } from '../components/ui';
import { dialog } from '../components/Dialog';
import socketService from '../network/socketService';
import { BINGA } from '../../server/progress/defs';
import { myTournaments, remember, GAME_LABEL, formatWhen } from '../utils/tournaments';
import { LuxeBackdrop, ScreenHeader, BingaPill } from '../components/Luxe';
import MenuShell, { Cols, useMenuLayout } from '../components/MenuShell';
import { t } from '../i18n';

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
    const { wide } = useMenuLayout(); // grand écran : création à gauche, mes tournois et palmarès à droite
    const supported = socketService.supports('tournaments');
    const [showForm, setShowForm] = useState(false);
    const [name, setName] = useState('');
    const [gameType, setGameType] = useState('hezz2');
    const [mode, setMode] = useState('solo');
    const [size, setSize] = useState(4);
    const [entry, setEntry] = useState(false);
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
        if (name.trim().length < 3) { dialog.alert(t('Nom du tournoi'), t('Donne un nom au tournoi (3 caractères au moins).')); return; }
        if (tooSoon) { dialog.alert(t('Heure passée'), t('Choisis une heure à venir.')); return; }
        setBusy(true);
        socketService.tournamentCreate({ name: name.trim(), gameType, mode: gameType === 'ronda' ? mode : 'solo', size, startsAt, entry }, async (r) => {
            setBusy(false);
            if (!r?.success) { dialog.alert(t('Oups'), r?.message || t('Le serveur ne répond pas.')); return; }
            await remember(r.id, { hostToken: r.hostToken, name: r.tournament.name, gameType, startsAt: r.tournament.startsAt });
            setShowForm(false);
            setName('');
            navigation.navigate('Tournament', { id: r.id });
        });
    };

    return (
        <MenuShell navigation={navigation} title={t("Tournois")}>
            <ScrollView contentContainerStyle={[styles.list, wide && styles.listWide]} keyboardShouldPersistTaps="handled">
                {!supported ? (
                    <Text style={styles.empty}>{t("⚠️ Le serveur en ligne n'est pas à jour : les tournois seront disponibles après son redéploiement.")}</Text>
                ) : (
                    <Cols>
                    <>
                        <Text style={styles.intro}>{t("Élimination directe à 4 ou 8 joueurs, en Hezz2 ou en Ronda. Le champion gagne le dos de cartes « Champion » 👑 et le titre « Moul chi ».")}</Text>

                        {!showForm ? (
                            <GameButton title={t("CRÉER UN TOURNOI")} icon="➕" onPress={() => setShowForm(true)} style={{ marginTop: 10 }} />
                        ) : (
                            <Animated.View entering={FadeInDown.springify().damping(16)} style={styles.card}>
                                <Text style={styles.cardTitle}>{t("Nouveau tournoi")}</Text>
                                <Text style={styles.label}>{t("NOM")}</Text>
                                <TextInput
                                    style={styles.input}
                                    value={name}
                                    onChangeText={setName}
                                    placeholder={t("Ex : Coupe du quartier")}
                                    placeholderTextColor={theme.textDim}
                                    maxLength={40}
                                    accessibilityLabel={t("Nom du tournoi")}
                                />
                                <Text style={styles.label}>{t("JEU")}</Text>
                                <Chips options={[['hezz2', 'Hezz2'], ['ronda', 'Ronda']]} value={gameType} onChange={setGameType} />
                                {gameType === 'ronda' && (
                                    <>
                                        <Text style={styles.label}>{t("FORMAT")}</Text>
                                        <Chips options={[['solo', '1 contre 1'], ['duo', '2 contre 2']]} value={mode} onChange={setMode} />
                                    </>
                                )}
                                <Text style={styles.label}>{t("JOUEURS")}</Text>
                                <Chips options={[[4, '4 joueurs'], [8, '8 joueurs']]} value={size} onChange={setSize} />
                                {socketService.supports('stakes') && (
                                    <>
                                        <Text style={styles.label}>{t("ENTRÉE")}</Text>
                                        <Chips options={[[false, 'Gratuite'], [true, `${BINGA.tournamentEntry} binga`]]} value={entry} onChange={setEntry} />
                                        {entry && <Text style={styles.hint}>{t("L'entrée est retirée au début du tournoi. Le gagnant reçoit le dos exclusif « Sultan », un titre et le double d'XP. Sans compte ou sans assez de binga, on joue gratuitement.")}</Text>}
                                    </>
                                )}
                                <Text style={styles.label}>{t("JOUR")}</Text>
                                <Chips options={[0, 1, 2, 3, 4, 5, 6].map((d) => [d, dayLabel(d)])} value={day} onChange={setDay} />
                                <Text style={styles.label}>{t("HEURE")}</Text>
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
                                    {tooSoon ? t('Cette heure est déjà passée.') : t("Début {p0}. Tu pourras aussi le lancer plus tôt, dès que tout le monde est inscrit.", { p0: formatWhen(startsAt) })}
                                </Text>
                                <Text style={styles.hint}>
                                    {gameType === 'ronda' && mode === 'duo'
                                        ? t("{p0} joueurs = {p1} équipes de 2, formées au tirage au sort.", { p0: size, p1: size / 2 })
                                        : t("Matchs en 1 contre 1, {p0}.", { p0: size === 4 ? t('demi-finales puis finale') : t('quarts, demi-finales puis finale') })}
                                </Text>
                                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                                    <GameButton small title={t("Annuler")} variant="outline" onPress={() => setShowForm(false)} style={{ flex: 1 }} />
                                    <GameButton small title={busy ? t('Création…') : t('Créer')} icon="🏆" onPress={create} disabled={busy} style={{ flex: 1 }} />
                                </View>
                            </Animated.View>
                        )}
                    </>
                    <>
                        <Text style={[styles.section, wide && { marginTop: 0 }]}>{t("MES TOURNOIS")}</Text>
                        {mine.length === 0 && <Text style={styles.emptySmall}>{t("Aucun pour l'instant. Crée un tournoi ou ouvre un lien d'inscription reçu d'un ami.")}</Text>}
                        {mine.map((ti) => (
                            <PressableScale key={ti.id} onPress={() => navigation.navigate('Tournament', { id: ti.id })} style={styles.row}>
                                <Text style={styles.rowIcon}>{ti.won ? '👑' : ti.hostToken ? '🎙️' : '🎟️'}</Text>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.rowName} numberOfLines={1}>{ti.name || ti.id}</Text>
                                    <Text style={styles.rowSub}>{GAME_LABEL[ti.gameType] || ''}{ti.startsAt ? ` · ${formatWhen(ti.startsAt)}` : ''}{ti.hostToken ? t(' · organisateur') : ''}</Text>
                                </View>
                                <Text style={styles.rowArrow}>›</Text>
                            </PressableScale>
                        ))}

                        <Text style={styles.section}>{t("PALMARÈS")}</Text>
                        {palmares === null && <ActivityIndicator color={theme.gold} style={{ marginTop: 10 }} />}
                        {palmares && palmares.length === 0 && <Text style={styles.emptySmall}>{t("Aucun champion pour l'instant. Le premier tournoi gagné apparaîtra ici.")}</Text>}
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
                    </Cols>
                )}
            </ScrollView>
        </MenuShell>
    );
}

export const tournamentStyles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 44, paddingHorizontal: 14, paddingBottom: 8, backgroundColor: 'rgba(8,15,34,0.85)' },
    headBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, backgroundColor: 'rgba(212,175,55,0.15)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)' },
    headBtnText: { color: theme.goldLight, fontWeight: '800', fontSize: 13 },
    headTitle: { color: theme.goldLight, fontSize: 20, fontWeight: '900', flexShrink: 1, textAlign: 'center' },
    list: { padding: 16, paddingBottom: 48, maxWidth: 560, width: '100%', alignSelf: 'center' },
    listWide: { maxWidth: 1180, paddingTop: 6 },
    intro: { color: theme.cream, fontSize: 13, textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 12, lineHeight: 19 },
    card: { backgroundColor: 'rgba(14,26,56,0.95)', borderRadius: 16, padding: 14, marginTop: 12, borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)' },
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
    row: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(14,26,56,0.92)', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 6, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)' },
    rowIcon: { fontSize: 20, width: 32 },
    rowName: { color: theme.cream, fontWeight: '800', fontSize: 14 },
    rowSub: { color: theme.textDim, fontSize: 11, marginTop: 2 },
    rowArrow: { color: theme.gold, fontSize: 22, fontWeight: '900', marginLeft: 6 },
    empty: { color: theme.cream, textAlign: 'center', marginTop: 16, backgroundColor: 'rgba(0,0,0,0.5)', padding: 12, borderRadius: 12 },
    emptySmall: { color: theme.textDim, fontSize: 12, backgroundColor: 'rgba(0,0,0,0.45)', padding: 10, borderRadius: 12 },
});
const styles = tournamentStyles;
