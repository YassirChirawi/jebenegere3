import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, StatusBar, useWindowDimensions, Image, Pressable } from 'react-native';
import Animated, {
    ZoomIn,
    FadeIn,
    FadeOut,
    SlideInDown,
    useSharedValue,
    useAnimatedStyle,
    withSequence,
    withTiming,
    withSpring,
    withDelay,
    withRepeat,
    Easing,
    interpolate,
} from 'react-native-reanimated';

import MasterCard, { computeFan } from '../components/MasterCard';
import PlayerAvatar from '../components/PlayerAvatar';
import CircularTimer from '../components/CircularTimer';
import OpponentSeat from '../components/OpponentSeat';
import RondaEndOverlay from '../components/RondaEndOverlay';
import RulesModal from '../components/RulesModal';
import TableBackground from '../components/TableBackground';
import { CardFace, CardBack } from '../components/Card';
import { TurnBanner, ActionToast } from '../components/GameFx';
import { requestReplay, useRoomChat, TopBar, ChatBubbles, ReactionBar, ChatSheet, ReactionBubble } from '../components/GameChrome';
import { GameButton, PressableScale, haptic, theme } from '../components/ui';
import { dialog } from '../components/Dialog';
import socketService from '../network/socketService';
import audioService from '../network/audioService';
import { recordGame, addXp } from '../utils/stats';
import { GoldBurst } from '../components/Flights';
import { isPhoneWeb } from '../utils/fullscreen';

const MINT = require('../../assets/menthe-poivree-removebg-preview.png');
const ORDER = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
const nextVal = (v) => ORDER[ORDER.indexOf(v) + 1] ?? null;
const VALUE_LABEL = { 1: 'As', 10: 'Sota', 11: 'Cavalier', 12: 'Roi' };
const valueName = (v) => (VALUE_LABEL[v] ? `${v} (${VALUE_LABEL[v]})` : `${v}`);
const teamOf = (p) => p % 2;
const TABLE_W = 50;
const TABLE_H = 72;

const OFFSETS = {
    bottom: { x: 0, y: 260, r: -20 },
    top: { x: 0, y: -240, r: 160 },
    left: { x: -200, y: 0, r: -110 },
    right: { x: 200, y: 0, r: 110 },
    none: { x: 0, y: -30, r: 0 },
};

// Carte posée sur la table : arrive depuis le siège du joueur
function TableCard({ card, from, highlight, w, h }) {
    const p = useSharedValue(0);
    const hl = useSharedValue(0);
    const o = OFFSETS[from] || OFFSETS.none;
    useEffect(() => {
        p.value = withSpring(1, { damping: 14, stiffness: 140 });
    }, []);
    useEffect(() => {
        hl.value = withTiming(highlight ? 1 : 0, { duration: 180 });
    }, [highlight]);
    const style = useAnimatedStyle(() => ({
        transform: [
            { translateX: o.x * (1 - p.value) },
            { translateY: o.y * (1 - p.value) - hl.value * 6 },
            { rotateZ: `${o.r * (1 - p.value)}deg` },
            { scale: interpolate(p.value, [0, 0.7, 1], [0.8, 1.12, 1]) * (1 + hl.value * 0.08) },
        ],
    }));
    const ring = useAnimatedStyle(() => ({ opacity: hl.value }));
    return (
        <Animated.View style={[styles.tableCard, style]}>
            <Animated.View pointerEvents="none" style={[styles.tableHl, ring]} />
            <CardFace card={card} width={w} height={h} />
        </Animated.View>
    );
}

// Cartes ramassées qui s'envolent vers le camp qui les prend
function CaptureFly({ fly }) {
    const t = useSharedValue(0);
    useEffect(() => {
        t.value = 0;
        t.value = withDelay(250, withTiming(1, { duration: 650, easing: Easing.in(Easing.cubic) }));
    }, [fly.id]);
    const dir = fly.mine ? 1 : -1;
    return (
        <View pointerEvents="none" style={styles.flyLayer}>
            {fly.cards.map((c, i) => (
                <FlyCard key={`${fly.id}-${c.id}`} card={c} i={i} n={fly.cards.length} dir={dir} t={t} />
            ))}
        </View>
    );
}
// Après une Darba (ou un Hbel) : les cartes restent 2,5 s au centre, en léger zoom,
// le temps de voir si l'adversaire suivant va faire Hbel (ou Boug)
const SPOT_MS = 2500;
function ChainSpotlight({ spot, w, h }) {
    const z = useSharedValue(0.6);
    const bar = useSharedValue(1);
    useEffect(() => {
        z.value = withSequence(
            withTiming(1.18, { duration: 380, easing: Easing.out(Easing.back(2)) }),
            withRepeat(withSequence(withTiming(1.1, { duration: 450 }), withTiming(1.18, { duration: 450 })), 2, false),
            withTiming(1.12, { duration: 300 }),
        );
        bar.value = withTiming(0, { duration: SPOT_MS, easing: Easing.linear });
    }, [spot.id]);
    const zoom = useAnimatedStyle(() => ({ transform: [{ scale: z.value }] }));
    const barStyle = useAnimatedStyle(() => ({ width: `${bar.value * 100}%` }));
    return (
        <View pointerEvents="none" style={styles.spotLayer}>
            <Animated.View entering={FadeIn.duration(200)} style={[styles.spotBox, { borderColor: spot.color }]}>
                <Animated.View style={[styles.spotCards, zoom]}>
                    {spot.cards.map((c, i) => (
                        <View key={c.id} style={{ marginLeft: i ? -w * 0.45 : 0, transform: [{ rotateZ: `${(i - (spot.cards.length - 1) / 2) * 8}deg` }] }}>
                            <CardFace card={c} width={w} height={h} />
                        </View>
                    ))}
                </Animated.View>
                <Text style={[styles.spotTitle, { color: spot.color }]}>{spot.title}</Text>
                {spot.next ? <Text style={styles.spotNext}>{spot.next}</Text> : null}
                <View style={styles.spotTrack}><Animated.View style={[styles.spotBar, { backgroundColor: spot.color }, barStyle]} /></View>
            </Animated.View>
        </View>
    );
}

function FlyCard({ card, i, n, dir, t }) {
    const spread = (i - (n - 1) / 2) * 26;
    const style = useAnimatedStyle(() => ({
        opacity: t.value > 0.92 ? (1 - t.value) / 0.08 : 1,
        transform: [
            { translateX: spread * (1 - t.value) },
            { translateY: dir * t.value * 300 },
            { rotateZ: `${(i - n / 2) * 6 + t.value * dir * 40}deg` },
            { scale: 1 - t.value * 0.5 },
        ],
    }));
    return (
        <Animated.View style={[styles.flyCard, style]}>
            <CardFace card={card} width={TABLE_W} height={TABLE_H} />
        </Animated.View>
    );
}

// Tas de cartes ramassées d'un camp
function CapturePile({ label, count, top, mine, points, compact }) {
    const bump = useSharedValue(1);
    useEffect(() => {
        bump.value = withSequence(withTiming(1.25, { duration: 120 }), withSpring(1, { damping: 7 }));
    }, [count]);
    const s = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }));
    if (compact) {
        // Paysage : petit tas + nombre de cartes, sans cadre
        return (
            <View style={styles.pileCompact}>
                <View style={{ width: 28, height: 40 }}>
                    {count > 0 ? (
                        <>
                            <View style={{ position: 'absolute', left: 2, top: 2 }}><CardBack width={26} height={38} /></View>
                            {top ? <CardFace card={top} width={26} height={38} /> : <CardBack width={26} height={38} />}
                        </>
                    ) : (
                        <View style={[styles.pileEmpty, { width: 26, height: 38 }]} />
                    )}
                </View>
                <Text style={[styles.pileLabel, mine && { color: theme.goldLight }, { marginTop: 3 }]}>{label}</Text>
                <Animated.Text style={[styles.pileCountCompact, s]}>{count}</Animated.Text>
            </View>
        );
    }
    return (
        <View style={styles.pile}>
            <View style={{ width: 34, height: 48 }}>
                {count > 0 ? (
                    <>
                        <View style={{ position: 'absolute', left: 3, top: 3 }}><CardBack width={30} height={44} /></View>
                        {top ? <CardFace card={top} width={30} height={44} /> : <CardBack width={30} height={44} />}
                    </>
                ) : (
                    <View style={styles.pileEmpty} />
                )}
            </View>
            <View style={{ marginLeft: 6 }}>
                <Text style={[styles.pileLabel, mine && { color: theme.goldLight }]}>{label}{points !== undefined ? ` · ${points} pts` : ''}</Text>
                <Animated.Text style={[styles.pileCount, s]}>{count} <Text style={styles.pileUnit}>cartes</Text></Animated.Text>
            </View>
        </View>
    );
}

// Prévisualisation côté client (le serveur reste seul juge)
function previewCapture(state, me, card) {
    if (!state || me < 0) return { ids: new Set(), kind: null };
    const n = state.numPlayers;
    const prev = (me - 1 + n) % n;
    if (state.chain && state.lastPlay && state.lastPlay.player === prev && state.chain.value === card.value && state.chain.team !== teamOf(me)) {
        return { ids: new Set(), kind: state.chain.cards.length === 2 ? 'hbel' : 'bachra' };
    }
    const ids = new Set();
    const first = state.table.find((c) => c.value === card.value);
    if (!first) return { ids, kind: null };
    ids.add(first.id);
    let v = nextVal(card.value);
    while (v !== null) {
        const c = state.table.find((x) => x.value === v);
        if (!c) break;
        ids.add(c.id);
        v = nextVal(v);
    }
    const darba = state.lastPlay && state.lastPlay.player === prev && !state.lastPlay.captured && state.lastPlay.card.id === first.id;
    return { ids, kind: darba ? 'darba' : 'capture' };
}

function comboOf(hand) {
    const counts = {};
    hand.forEach((c) => { counts[c.value] = (counts[c.value] || 0) + 1; });
    let best = null;
    Object.entries(counts).forEach(([v, k]) => {
        if (k < 2) return;
        const c = { type: k >= 3 ? 'tringa' : 'ronda', value: Number(v) };
        if (!best || (c.type !== best.type ? c.type === 'tringa' : ORDER.indexOf(c.value) > ORDER.indexOf(best.value))) best = c;
    });
    return best;
}

export default function RondaScreen({ route, navigation }) {
    const { roomId, playerName, initialGameState } = route.params || {};
    const { width: winW, height: winH } = useWindowDimensions();
    const [board, setBoard] = useState(null);
    const stageW = board?.w ?? Math.min(winW, 500);
    const stageH = board?.h ?? winH;
    const land = stageW > stageH * 1.2;

    const [state, setState] = useState(initialGameState);
    const [timeLeft, setTimeLeft] = useState(15);
    const [selectedId, setSelectedId] = useState(null);
    const [banner, setBanner] = useState(null);
    const [toast, setToast] = useState(null);
    const [moods, setMoods] = useState({});
    const react = (i, type) => { if (i !== null && i !== undefined && i >= 0) setMoods((m) => ({ ...m, [i]: { id: Date.now() + Math.random(), type } })); };
    const [fly, setFly] = useState(null);
    const [spot, setSpot] = useState(null);
    // Téléphone tenu en portrait : on propose de le tourner (une fois, refermable)
    const [rotateDismissed, setRotateDismissed] = useState(false);
    const showRotate = !rotateDismissed && isPhoneWeb();
    useEffect(() => {
        if (!showRotate) return undefined;
        const t = setTimeout(() => setRotateDismissed(true), 7000);
        return () => clearTimeout(t);
    }, [showRotate]);
    const [burst, setBurst] = useState(null);
    const goldBurst = (color, size) => setBurst({ id: Date.now() + Math.random(), color, size });
    const [showEnd, setShowEnd] = useState(false);
    const [showRules, setShowRules] = useState(false);
    const [denounceOpen, setDenounceOpen] = useState(false);
    const [denounceTarget, setDenounceTarget] = useState(null);
    const [isMuted, setIsMuted] = useState(audioService.muted);
    const [xpEarned, setXpEarned] = useState(0);

    const { chatMessages, activeReactions, showChat, setShowChat, sendChat, sendReaction } = useRoomChat(roomId);

    const seenEvents = useRef(new Set());
    const bannerQueue = useRef([]);
    const bannerBusy = useRef(false);
    const timers = useRef([]);
    const toastTimer = useRef(null);
    const prevTurn = useRef(null);

    const later = (fn, ms) => {
        const t = setTimeout(fn, ms);
        timers.current.push(t);
    };

    const me = state?.myIndex ?? -1;
    const n = state?.numPlayers || 2;
    const myTeam = me >= 0 ? teamOf(me) : null;
    const isMyTurn = me >= 0 && state?.turn === me && !state?.mancheTerminee;

    const seatOf = (i) => {
        const pivot = me >= 0 ? me : 0;
        const rel = (i - pivot + n) % n;
        if (rel === 0) return 'bottom';
        if (n === 2) return 'top';
        return ['right', 'top', 'left'][rel - 1];
    };
    const nameOf = (i) => (i === me ? 'Toi' : state?.players?.[i]?.name || `Joueur ${i + 1}`);
    const teamNames = myTeam === null ? ['Camp A', 'Camp B'] : myTeam === 0 ? ['NOUS', 'EUX'] : ['EUX', 'NOUS'];
    const teamWord = (t) => (myTeam === null ? teamNames[t] : t === myTeam ? 'nous' : 'eux');

    // --- Secousse ---
    const shakeX = useSharedValue(0);
    const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));
    const shake = (amp = 8) => {
        shakeX.value = withSequence(
            withTiming(amp, { duration: 45 }),
            withTiming(-amp, { duration: 45 }),
            withTiming(amp * 0.6, { duration: 45 }),
            withTiming(0, { duration: 45 })
        );
    };

    const showToast = (text, color) => {
        clearTimeout(toastTimer.current);
        setToast({ id: Date.now() + Math.random(), text, color });
        toastTimer.current = setTimeout(() => setToast(null), 3400);
    };

    // File de bannières : chaque coup spécial a sa bannière, son son et sa vibration
    const pump = () => {
        if (bannerBusy.current) return;
        const b = bannerQueue.current.shift();
        if (!b) return;
        bannerBusy.current = true;
        b.onShow && b.onShow();
        const duration = b.duration || 2300;
        setBanner({ ...b, hold: duration - 600, id: Date.now() + Math.random() });
        setTimeout(() => {
            bannerBusy.current = false;
            pump();
        }, duration + 250);
    };
    const pushBanner = (b) => {
        bannerQueue.current.push(b);
        pump();
    };

    // --- Réseau ---
    useEffect(() => {
        audioService.setMusicMode('game');
        const unsubs = [
            socketService.onGameStateUpdate((s) => setState(s)),
            socketService.onGameStarted((s) => {
                setShowEnd(false);
                setXpEarned(0);
                setSelectedId(null);
                setState(s);
            }),
            socketService.onTimerTick((d) => setTimeLeft(d.timeLeft)),
            socketService.onGameError((err) => {
                audioService.playSound('error');
                showToast(`⚠️ ${err?.message || 'Action impossible'}`, theme.redLight);
            }),
            socketService.onActionRejected(() => {
                audioService.playSound('error');
            }),
        ];
        const unsubAudio = audioService.subscribe(({ muted }) => setIsMuted(muted));
        return () => {
            unsubs.forEach((u) => u && u());
            unsubAudio();
            timers.current.forEach(clearTimeout);
            clearTimeout(toastTimer.current);
            audioService.stopTickTock();
            audioService.setMusicMode('menu');
        };
    }, []);

    // --- Événements du serveur → animations, sons, vibrations, bannières ---
    useEffect(() => {
        if (!state) return;
        const events = state.events || [];
        events.forEach((e) => {
            if (seenEvents.current.has(e.id)) return;
            seenEvents.current.add(e.id);
            handleEvent(e, state);
        });

        // C'est mon tour
        if (isMyTurn && prevTurn.current !== me) {
            later(() => {
                // Pas de bannière ici : les tours s'enchaînent vite en Ronda, on garde la table visible
                audioService.playSound('your_turn');
                haptic('medium');
            }, 350);
        }
        prevTurn.current = state.turn;
        if (!isMyTurn) setSelectedId(null);
    }, [state]);

    // Musique : plus tendue quand une équipe approche des 42 points
    useEffect(() => {
        if (!state?.scores || state.mancheTerminee) { audioService.setMusicIntensity(0); return; }
        audioService.setMusicIntensity((Math.max(...state.scores) - 20) / 21);
    }, [state?.scores?.[0], state?.scores?.[1], state?.mancheTerminee]);

    const handleEvent = (e, s) => {
        const who = e.player !== undefined ? nameOf(e.player) : '';
        const mine = e.team !== undefined && e.team === myTeam;
        switch (e.type) {
            case 'deal':
                audioService.playDeal(Math.min(e.size * n, 10), 80);
                showToast(`🃏 Distribution ${e.index}/${e.total} : ${e.size} cartes chacun`, theme.gold);
                break;
            case 'place':
                audioService.playSound('card_play');
                react(e.player, 'play');
                break;
            case 'capture': {
                audioService.playSound('card_play');
                react(e.player, 'play');
                later(() => audioService.playSound('card_draw'), 220);
                haptic(e.player === me ? 'medium' : 'light');
                const flight = { id: e.id, cards: [...e.taken, e.card], mine: e.team === myTeam };
                // Darba : les cartes restent d'abord au centre (zoom), puis partent vers le tas
                if ((s.events || []).some((x) => x.type === 'darba' && x.player === e.player)) later(() => setFly(flight), SPOT_MS);
                else setFly(flight);
                break;
            }
            case 'darba': {
                react(e.player, 'proud');
                const pair = s.chain?.cards?.length === 2 ? s.chain.cards : [e.card];
                setSpot({ id: e.id, cards: pair, color: '#FB923C', title: 'DARBA', next: s.chain ? 'Hbel ?…' : null });
                later(() => setSpot((sp) => (sp && sp.id === e.id ? null : sp)), SPOT_MS);
                pushBanner({
                    text: 'DARBA !', sub: `${who} prend la carte posée · +${e.points} ${teamWord(e.team)}`, color: '#EA580C', textColor: '#fff', duration: 2800, top: '13%',
                    onShow: () => { audioService.playSound('darba'); haptic('heavy'); shake(9); goldBurst('#FDBA74', 200); },
                });
                break;
            }
            case 'hbel': {
                react(e.player, 'proud');
                const three = s.chain?.cards?.length === 3 ? s.chain.cards : [e.card];
                setSpot({ id: e.id, cards: three, color: '#C4B5FD', title: 'HBEL', next: s.chain ? 'Boug ?…' : null });
                later(() => setSpot((sp) => (sp && sp.id === e.id ? null : sp)), SPOT_MS);
                pushBanner({
                    text: 'HBEL !', sub: `${who} reprend ${e.count} cartes · +${e.points} ${teamWord(e.team)}`, color: '#7C3AED', textColor: '#fff', duration: 2800, top: '13%',
                    onShow: () => { audioService.playSound('hbel'); haptic('double'); shake(14); goldBurst('#C4B5FD', 240); },
                });
                later(() => setFly({ id: e.id, cards: [e.card], mine: e.team === myTeam }), SPOT_MS);
                break;
            }
            case 'bachra':
                setSpot(null);
                react(e.player, 'proud');
                pushBanner({
                    text: 'BOUG !!', sub: `${who} rafle les 4 · +${e.points} ${teamWord(e.team)}`, color: '#B91C1C', textColor: '#FFE08A', duration: 3000,
                    onShow: () => { audioService.playSound('bachra'); haptic('long'); shake(18); goldBurst('#FFE08A', 300); },
                });
                setFly({ id: e.id, cards: [e.card], mine: e.team === myTeam });
                break;
            case 'missa':
                react(e.player, 'proud');
                pushBanner({
                    text: 'MISSA !', sub: `${who} vide la table · +${e.points} ${teamWord(e.team)}`, color: '#0F766E', textColor: '#fff',
                    onShow: () => { audioService.playSound('missa'); haptic('success'); goldBurst('#5EEAD4', 260); },
                });
                break;
            case 'announce':
                audioService.playSound('announce');
                haptic('light');
                showToast(`📣 ${who} annonce une ${e.combo === 'tringa' ? 'TRINGA' : 'RONDA'} !`, theme.goldLight);
                break;
            case 'announce_win':
                pushBanner({
                    text: e.combo === 'tringa' ? 'TRINGA !' : 'RONDA !',
                    sub: `${who} · ${e.combo} de ${valueName(e.value)} · +${e.points} ${teamWord(e.team)}`,
                    color: e.combo === 'tringa' ? '#9333EA' : theme.gold, textColor: e.combo === 'tringa' ? '#fff' : theme.bg,
                    onShow: () => { audioService.playSound('announce'); haptic('medium'); },
                });
                break;
            case 'ronda_tie':
                showToast(`⚖️ Égalité de rondas de ${valueName(e.value)} : celui qui mange avec un ${e.value} laisse le point`, theme.goldLight);
                break;
            case 'ronda_tie_resolved':
                pushBanner({ text: 'RONDA !', sub: `${nameOf(e.eater)} a mangé avec un ${e.value} · +${e.points} ${teamWord(e.team)}`, color: theme.gold, onShow: () => audioService.playSound('announce') });
                break;
            case 'ronda_tie_void':
                showToast(`⚖️ Égalité de rondas : personne n'a mangé, pas de point`, theme.textDim);
                break;
            case 'denounce_ok':
                pushBanner({
                    text: 'IL EST RONDÉ !',
                    sub: e.warning
                        ? `${nameOf(e.target)} cachait une ${e.combo} de ${e.value} · Avertissement`
                        : `${nameOf(e.target)} cachait une ${e.combo} de ${e.value} · +${e.points} ${teamWord(e.team)}`,
                    color: '#DC2626', textColor: '#fff', duration: 2700,
                    onShow: () => { audioService.playSound('reveal'); haptic('heavy'); shake(10); },
                });
                break;
            case 'denounce_false':
                pushBanner({
                    text: e.warning ? 'AVERTISSEMENT' : 'FAUSSE DÉNONCIATION',
                    sub: e.warning ? `${who} s'est trompé (${nameOf(e.target)} n'a pas de ${e.value})` : `${who} s'est trompé · -1 ${teamWord(e.team)}`,
                    color: '#F59E0B', textColor: theme.bg,
                    onShow: () => { audioService.playSound('warning'); haptic('warning'); },
                });
                break;
            case 'dealer_last':
                pushBanner({
                    text: 'DERNIÈRE CARTE !',
                    sub: e.player === me ? 'Tu es le donneur : mange avec ta dernière carte !' : `${nameOf(e.player)} (donneur) doit manger`,
                    color: '#1E3A8A', textColor: '#fff', duration: 2600,
                    onShow: () => { audioService.playSound('warning'); haptic('warning'); },
                });
                break;
            case 'rey':
                pushBanner({ text: '9A3A REY !', sub: `${who} mange avec un Roi · +5 ${teamWord(e.team)}`, color: theme.gold, onShow: () => { audioService.playSound('victory'); haptic('success'); goldBurst('#F5D77A', 240); } });
                break;
            case 'as':
                pushBanner({
                    text: '9A3A AS !',
                    sub: `${e.missed ? `${who} n'a rien mangé` : `${who} a mangé avec un As`} · +5 ${teamWord(e.team)}`,
                    color: '#475569', textColor: '#fff',
                    onShow: () => { audioService.playSound('penalty'); haptic('heavy'); },
                });
                break;
            case 'table_rest':
                showToast(`🧺 Le reste de la table (${e.count}) va à ${teamWord(e.team)}`, theme.goldLight);
                break;
            case 'forfeit':
                pushBanner({
                    text: 'ADVERSAIRE PARTI',
                    sub: e.team === myTeam ? 'Victoire par forfait !' : 'Partie terminée',
                    color: '#0F766E', textColor: '#fff',
                    onShow: () => { audioService.playSound('warning'); haptic('warning'); },
                });
                break;
            case 'target_reached':
                setSpot(null);
                pushBanner({
                    text: `${e.score} POINTS !`, sub: `${teamWord(e.team) === 'nous' ? 'Vous gagnez' : `${teamNames[e.team]} gagnent`} : la partie s'arrête`,
                    color: theme.gold, textColor: theme.bg, duration: 2600,
                    onShow: () => { audioService.playSound(e.team === myTeam ? 'victory' : 'defeat'); haptic('long'); },
                });
                break;
            case 'manche_end':
                audioService.stopTickTock();
                onMancheEnd(s);
                break;
            default:
                break;
        }
    };

    const onMancheEnd = (s) => {
        if (myTeam !== null) {
            const gain = [0, 1].map((t) => s.summary.cardPoints[t] + s.summary.bonus[t]);
            let xp = gain[myTeam] > gain[1 - myTeam] ? 30 : 10;
            if (s.winnerTeam !== null) {
                const won = s.winnerTeam === myTeam;
                if (won) xp += 100;
                recordGame({
                    game: 'ronda',
                    won,
                    result: `${won ? 'Victoire 🎉' : 'Défaite 💀'} ${s.scores[myTeam]}-${s.scores[1 - myTeam]}`,
                    opponents: s.players.filter((_, i) => teamOf(i) !== myTeam).map((p) => p.name).join(', '),
                });
                later(() => audioService.playSound(won ? 'victory' : 'defeat'), 900);
            }
            setXpEarned(xp);
            addXp(xp);
        }
        later(() => {
            audioService.playSound('whoosh');
            setShowEnd(true);
        }, 1800);
    };

    // --- Tic-tac pendant mon tour ---
    useEffect(() => {
        if (isMyTurn && timeLeft <= 5 && timeLeft > 0) audioService.startTickTock();
        else audioService.stopTickTock();
    }, [timeLeft, isMyTurn]);

    // --- Actions ---
    const leave = () => {
        audioService.stopTickTock();
        socketService.leaveRoom(roomId);
        navigation.popToTop();
    };
    const handleQuit = () => {
        dialog.alert('Quitter la partie ?', 'Un bot prendra ta place.', [
            { text: 'Rester', style: 'cancel' },
            { text: 'Quitter', style: 'destructive', onPress: leave },
        ]);
    };

    const myHand = me >= 0 ? state?.hands?.[me] || [] : [];
    const playCard = (idx) => {
        if (!isMyTurn) return;
        setSelectedId(null);
        socketService.sendAction(roomId, { type: 'play', cardIndex: idx });
    };

    const deal = state?.deal;
    const myCombo = useMemo(() => comboOf(myHand), [myHand]);
    // Annonce possible tant que les cartes de la ronda sont toutes en main (jusqu'à la fin de la distribution)
    const canAnnounce = me >= 0 && deal && !state.mancheTerminee && !deal.resolved && !deal.announced[me] && myCombo;

    const denounceTargets = useMemo(() => {
        if (me < 0 || !deal || state.mancheTerminee || deal.denounceUsed[me]) return [];
        return (state.players || [])
            .map((_, i) => i)
            .filter((i) => teamOf(i) !== myTeam && deal.playedCount[i] >= 1 && !deal.announced[i] && !deal.denounced[i]);
    }, [state]);

    const announce = () => {
        haptic('medium');
        socketService.sendAction(roomId, { type: 'announce' });
    };
    const openDenounce = () => {
        setDenounceTarget(denounceTargets.length === 1 ? denounceTargets[0] : null);
        setDenounceOpen(true);
        audioService.playSound('whoosh');
    };
    // Toucher un adversaire pour dire qu'il est rondé
    const tapSeat = (i) => {
        if (!denounceTargets.includes(i)) return;
        setDenounceTarget(i);
        setDenounceOpen(true);
        audioService.playSound('whoosh');
    };
    const sendDenounce = () => {
        setDenounceOpen(false);
        if (denounceTarget === null) return;
        haptic('heavy');
        socketService.sendAction(roomId, { type: 'denounce', target: denounceTarget });
    };

    // --- Main (triée par valeur) ---
    const selectedCard = myHand.find((c) => c.id === selectedId);
    const preview = useMemo(() => (selectedCard ? previewCapture(state, me, selectedCard) : { ids: new Set(), kind: null }), [selectedCard, state]);
    const handLayout = useMemo(() => {
        const sorted = myHand.map((card, idx) => ({ card, idx })).sort((a, b) => ORDER.indexOf(a.card.value) - ORDER.indexOf(b.card.value) || a.card.suit.localeCompare(b.card.suit));
        return computeFan(sorted, stageW, land);
    }, [myHand, stageW, land]);
    const capturable = useMemo(() => {
        const set = new Set();
        if (!isMyTurn) return set;
        myHand.forEach((c) => { if (previewCapture(state, me, c).kind) set.add(c.id); });
        return set;
    }, [state, isMyTurn]);

    if (!state) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;

    const seats = { top: null, left: null, right: null };
    (state.players || []).forEach((_, i) => {
        const s = seatOf(i);
        if (s !== 'bottom') seats[s] = i;
    });
    const renderSeat = (pos) => {
        const i = seats[pos];
        if (i === null || i === undefined) return null;
        const partner = myTeam !== null && teamOf(i) === myTeam;
        return (
            <Pressable onPress={() => tapSeat(i)} disabled={!denounceTargets.includes(i)}>
            <OpponentSeat
                mood={moods[i]}
                player={state.players[i]}
                isBot={state.players[i]?.isBot}
                handSize={state.hands[i].length}
                active={state.turn === i && !state.mancheTerminee}
                reaction={activeReactions[i]}
                position={pos}
                compact={land && pos === 'top'}
                badge={n === 4 ? (partner ? 'PARTENAIRE' : 'ADVERSAIRE') : i === state.dealer ? 'DONNEUR' : undefined}
                badgeColor={n === 4 ? (partner ? theme.mint : '#F87171') : undefined}
                isInitialDeal={false}
            />
            </Pressable>
        );
    };

    // Paysage : cartes de la table à la taille de l'écran
    const tableH = land ? Math.round(Math.max(60, Math.min(86, stageH * 0.21))) : TABLE_H;
    const tableW = land ? Math.round(tableH * 0.7) : TABLE_W;
    const canReplay = state.hostId && state.hostId === socketService.socket?.id;
    const myDealerLast = isMyTurn && me === state.dealer && state.dealIndex === state.totalDeals && myHand.length === 1;
    const scorePill = (
        <View style={styles.scorePill}>
            <Text style={[styles.scoreTeam, myTeam === 0 && styles.scoreMine]}>{teamNames[0]} {state.scores[0]}</Text>
            <Text style={styles.scoreTarget}>/ {state.target}</Text>
            <Text style={[styles.scoreTeam, myTeam === 1 && styles.scoreMine]}>{state.scores[1]} {teamNames[1]}</Text>
        </View>
    );

    return (
        <TableBackground onSize={setBoard} game="ronda">
            <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
            <Animated.View style={[styles.board, shakeStyle]}>
                <TopBar
                    roomId={roomId}
                    land={land}
                    isMuted={isMuted}
                    onQuit={handleQuit}
                    onChat={() => setShowChat(true)}
                    onMute={async () => setIsMuted(await audioService.toggleMute())}
                    onRules={() => setShowRules(true)}
                    center={land ? null : scorePill}
                />

                <View style={[styles.topArea, land && styles.topAreaLand]}>{renderSeat('top')}</View>

                <View style={styles.middleArea}>
                    <View style={styles.sideArea}>{renderSeat('left')}</View>

                    <View style={styles.center}>
                        <View style={[styles.toastSlot, land && styles.toastSlotLand]} pointerEvents="none">
                            <ActionToast toast={toast} />
                        </View>

                        <View style={land ? styles.centerLand : styles.centerCol}>
                        <View style={land ? { flex: 1, alignItems: 'center' } : styles.centerCol}>
                        <View style={[styles.tableZone, land && styles.tableZoneLand]}>
                            {state.table.length === 0 ? (
                                <Text style={styles.emptyTable}>Table vide</Text>
                            ) : (
                                <View style={styles.tableGrid}>
                                    {state.table.map((c) => (
                                        <TableCard
                                            key={c.id}
                                            card={c}
                                            w={tableW}
                                            h={tableH}
                                            from={state.lastPlay?.card?.id === c.id ? seatOf(state.lastPlay.player) : 'none'}
                                            highlight={preview.ids.has(c.id)}
                                        />
                                    ))}
                                </View>
                            )}
                            {fly && <CaptureFly key={fly.id} fly={fly} />}
                            {spot && <ChainSpotlight key={spot.id} spot={spot} w={tableW} h={tableH} />}
                            {burst && <GoldBurst key={burst.id} burst={burst} />}
                        </View>

                        {preview.kind && (
                            <Animated.Text entering={FadeIn} style={[styles.previewText, preview.kind !== 'capture' && { color: '#FDBA74' }]}>
                                {preview.kind === 'capture' && `Tu manges ${preview.ids.size} carte${preview.ids.size > 1 ? 's' : ''}`}
                                {preview.kind === 'darba' && `DARBA ! Tu manges ${preview.ids.size} carte${preview.ids.size > 1 ? 's' : ''} (+1)`}
                                {preview.kind === 'hbel' && 'HBEL ! Tu reprends 3 cartes (+5)'}
                                {preview.kind === 'bachra' && 'BOUG ! Tu reprends 4 cartes (+10)'}
                            </Animated.Text>
                        )}
                        </View>

                        {land ? (
                        <View style={styles.sideInfoLand}>
                            {scorePill}
                            <View style={styles.pilesLand}>
                                <CapturePile compact label={teamNames[myTeam ?? 0]} count={state.captured[myTeam ?? 0]} top={state.topCaptured[myTeam ?? 0]} mine />
                                <CapturePile compact label={teamNames[myTeam === null ? 1 : 1 - myTeam]} count={state.captured[myTeam === null ? 1 : 1 - myTeam]} top={state.topCaptured[myTeam === null ? 1 : 1 - myTeam]} />
                            </View>
                            <Text style={styles.dealLand}>Distrib. {state.dealIndex}/{state.totalDeals} · Paquet {state.deckCount ?? 0}</Text>
                            {!state.mancheTerminee && (
                                <View style={[styles.turnChip, styles.turnChipLand, isMyTurn && styles.turnChipMine]}>
                                    <CircularTimer timeLeft={timeLeft} maxTime={15} size={28} />
                                    <Text style={[styles.turnNameLand, isMyTurn && { color: theme.bg }]} numberOfLines={1}>
                                        {isMyTurn ? 'À TOI' : nameOf(state.turn)}
                                    </Text>
                                </View>
                            )}
                        </View>
                        ) : (
                        <View style={styles.centerCol}>
                        <View style={styles.infoRow}>
                            <CapturePile label={teamNames[myTeam ?? 0]} count={state.captured[myTeam ?? 0]} top={state.topCaptured[myTeam ?? 0]} mine points={land ? state.scores[myTeam ?? 0] : undefined} />
                            {!land && (
                                <View style={styles.deckInfo}>
                                    <CardBack width={26} height={38} />
                                    <Text style={styles.deckText}>{state.deckCount ?? 0}</Text>
                                </View>
                            )}
                            <CapturePile label={teamNames[myTeam === null ? 1 : 1 - myTeam]} count={state.captured[myTeam === null ? 1 : 1 - myTeam]} top={state.topCaptured[myTeam === null ? 1 : 1 - myTeam]} points={land ? state.scores[myTeam === null ? 1 : 1 - myTeam] : undefined} />
                        </View>

                        {!state.mancheTerminee && (
                            <View style={[styles.turnChip, isMyTurn && styles.turnChipMine]}>
                                <CircularTimer timeLeft={timeLeft} maxTime={15} size={36} />
                                <View style={{ marginLeft: 8, flexShrink: 1 }}>
                                    <Text style={[styles.turnLabel, isMyTurn && { color: theme.bg }]}>
                                        DISTRIB. {state.dealIndex}/{state.totalDeals}{land ? ` · PAQUET ${state.deckCount ?? 0}` : ''} · TOUR DE
                                    </Text>
                                    <Text style={[styles.turnName, isMyTurn && { color: theme.bg }]} numberOfLines={1}>
                                        {isMyTurn ? 'TOI' : nameOf(state.turn)}
                                    </Text>
                                </View>
                            </View>
                        )}
                        </View>
                        )}
                        </View>
                    </View>

                    <View style={styles.sideArea}>{renderSeat('right')}</View>
                </View>

                <ChatBubbles messages={chatMessages} top={land ? 56 : 130} />

                {!land && showRotate && (
                    <Animated.View entering={FadeIn.delay(600)} exiting={FadeOut} style={styles.rotateHint}>
                        <Pressable onPress={() => setRotateDismissed(true)} style={styles.rotateInner}>
                            <Text style={styles.rotateIcon}>🔄</Text>
                            <Text style={styles.rotateText}>Tourne ton téléphone : la Ronda se joue mieux en paysage</Text>
                            <Text style={styles.rotateClose}>✕</Text>
                        </Pressable>
                    </Animated.View>
                )}

                <View style={[styles.playerArea, land && styles.playerAreaLand]}>
                    {me < 0 ? (
                        <View style={styles.spectatorBox}>
                            <Text style={styles.spectatorText}>👀 Tu es spectateur</Text>
                        </View>
                    ) : (
                        <>
                            <View style={[styles.actionRow, land && styles.actionRowLand]} pointerEvents="box-none">
                                {canAnnounce && (
                                    <Animated.View entering={ZoomIn.springify()} exiting={FadeOut}>
                                        <GameButton small title={myCombo.type === 'tringa' ? 'TRINGA ! +5' : 'RONDA ! +1'} icon="📣" variant="gold" onPress={announce} />
                                    </Animated.View>
                                )}
                                {deal?.announced?.[me] && !deal.resolved && (
                                    <Text style={styles.announcedText}>✓ {deal.announced[me].type} annoncée</Text>
                                )}
                                {denounceTargets.length > 0 && (
                                    <Animated.View entering={ZoomIn.springify()} exiting={FadeOut}>
                                        <GameButton small title="Il est rondé ?" icon="🕵️" variant="red" onPress={openDenounce} />
                                    </Animated.View>
                                )}
                                {myDealerLast && (
                                    <Animated.Text entering={FadeIn} style={styles.lastCardHint}>⚠️ Dernière carte : il faut manger !</Animated.Text>
                                )}
                            </View>

                            <View style={[styles.meRow, land && styles.meRowLand]} pointerEvents="box-none">
                                <View style={styles.meInfo}>
                                    <View>
                                        <PlayerAvatar name={playerName || 'Toi'} size={38} active={isMyTurn} mood={moods[me]} />
                                        <ReactionBubble emoji={activeReactions[me]} />
                                    </View>
                                    <View style={[styles.mePill, isMyTurn && styles.mePillActive]}>
                                        <Text style={[styles.meName, isMyTurn && { color: theme.bg }]}>
                                            Toi{me === state.dealer ? ' · donneur' : ''}
                                        </Text>
                                    </View>
                                    {isMyTurn && <Image source={MINT} style={styles.mint} />}
                                </View>
                                <ReactionBar land={land} onSend={sendReaction} />
                            </View>

                            <View style={[styles.hand, land && styles.handLand]}>
                                {handLayout.map(({ card, idx, x, angle, arcY }, i) => (
                                    <MasterCard
                                        key={card.id}
                                        card={card}
                                        index={i}
                                        x={x}
                                        angle={angle}
                                        arcY={arcY}
                                        isMyTurn={isMyTurn}
                                        isPlayable={isMyTurn}
                                        glow={capturable.has(card.id)}
                                        selectMode
                                        selected={selectedId === card.id}
                                        onSelect={() => setSelectedId(card.id)}
                                        onPlay={() => playCard(idx)}
                                        isInitialDeal
                                    />
                                ))}
                            </View>
                        </>
                    )}
                </View>
            </Animated.View>

            <TurnBanner banner={banner} />

            {denounceOpen && (
                <Animated.View entering={FadeIn.duration(150)} style={styles.sheetOverlay}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={() => setDenounceOpen(false)} />
                    <Animated.View entering={SlideInDown.springify().damping(16)} style={styles.sheet}>
                        <Text style={styles.sheetTitle}>🕵️ Il est rondé !</Text>
                        <Text style={styles.sheetSub}>Il a posé une carte de sa ronda sans l'annoncer ? Juste : tu prends ses points. Faux : avertissement, puis -1.</Text>
                        {denounceTargets.length > 1 && (
                            <View style={styles.targetRow}>
                                {denounceTargets.map((t) => (
                                    <PressableScale key={t} onPress={() => setDenounceTarget(t)} style={[styles.targetBtn, denounceTarget === t && styles.targetBtnOn]}>
                                        <PlayerAvatar name={state.players[t]?.name} size={28} />
                                        <Text style={styles.targetName}>{nameOf(t)}</Text>
                                    </PressableScale>
                                ))}
                            </View>
                        )}
                        <Text style={styles.sheetLabel}>
                            {denounceTarget === null ? 'Choisis le joueur' : `${nameOf(denounceTarget)} est rondé ?`}
                        </Text>
                        <GameButton title={denounceTarget === null ? 'Choisis le joueur' : `OUI, ${nameOf(denounceTarget).toUpperCase()} EST RONDÉ !`} icon="🕵️" variant="red" disabled={denounceTarget === null} onPress={sendDenounce} />
                        <PressableScale onPress={() => setDenounceOpen(false)} style={{ alignSelf: 'center', padding: 10 }}>
                            <Text style={{ color: theme.textDim, fontWeight: '800' }}>Annuler</Text>
                        </PressableScale>
                    </Animated.View>
                </Animated.View>
            )}

            <ChatSheet visible={showChat} onClose={() => setShowChat(false)} onSend={sendChat} />

            {showEnd && state.mancheTerminee && state.summary && (
                <RondaEndOverlay
                    state={state}
                    myTeam={myTeam}
                    teamNames={teamNames}
                    xpEarned={xpEarned}
                    canReplay={canReplay}
                    onReplay={() => requestReplay(roomId)}
                    onQuit={state.players?.some((p) => p.isBot) ? leave : handleQuit}
                />
            )}

            <RulesModal visible={showRules} onClose={() => setShowRules(false)} gameType="ronda" />
        </TableBackground>
    );
}

const styles = StyleSheet.create({
    spotLayer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 60, elevation: 60 },
    spotBox: { alignItems: 'center', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 10, borderRadius: 18, borderWidth: 2, backgroundColor: 'rgba(12,6,8,0.82)' },
    spotCards: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    spotTitle: { fontWeight: '900', fontSize: 18, letterSpacing: 3 },
    spotNext: { color: theme.cream, fontWeight: '800', fontSize: 12, fontStyle: 'italic', marginTop: 2 },
    spotTrack: { width: 120, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', marginTop: 8, overflow: 'hidden' },
    spotBar: { height: 4, borderRadius: 2 },
    board: {
        flex: 1,
        paddingTop: 10,
        paddingBottom: 6,
    },
    scorePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.5)',
    },
    scoreTeam: {
        color: theme.cream,
        fontWeight: '900',
        fontSize: 13,
    },
    scoreMine: {
        color: theme.goldLight,
    },
    scoreTarget: {
        color: theme.textDim,
        fontSize: 10,
        fontWeight: '800',
    },
    topArea: {
        height: 112,
        justifyContent: 'center',
        alignItems: 'center',
    },
    topAreaLand: {
        height: 62,
        marginTop: 2,
    },
    middleArea: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    sideArea: {
        width: 84,
        alignItems: 'center',
        justifyContent: 'center',
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    toastSlot: {
        height: 32,
        width: '100%',
        justifyContent: 'center',
        marginBottom: 2,
        zIndex: 50,
    },
    centerCol: {
        width: '100%',
        alignItems: 'center',
    },
    centerLand: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        gap: 10,
    },
    sideInfoLand: {
        alignItems: 'center',
        width: 150,
        gap: 6,
    },
    pilesLand: {
        flexDirection: 'row',
        gap: 14,
    },
    pileCompact: {
        alignItems: 'center',
    },
    pileCountCompact: {
        color: theme.cream,
        fontSize: 15,
        fontWeight: '900',
    },
    dealLand: {
        color: theme.textDim,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    turnChipLand: {
        paddingVertical: 4,
        paddingLeft: 4,
        paddingRight: 12,
        maxWidth: 150,
    },
    turnNameLand: {
        color: theme.cream,
        fontSize: 13,
        fontWeight: '900',
        marginLeft: 6,
        flexShrink: 1,
    },
    rotateHint: {
        position: 'absolute',
        top: 58,
        left: 12,
        right: 12,
        zIndex: 80,
        elevation: 80,
        alignItems: 'center',
    },
    rotateInner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 14,
        backgroundColor: 'rgba(12,6,8,0.9)',
        borderWidth: 1,
        borderColor: theme.gold,
    },
    rotateIcon: { fontSize: 20 },
    rotateText: { color: theme.cream, fontSize: 12, fontWeight: '800', flexShrink: 1 },
    rotateClose: { color: theme.gold, fontSize: 14, fontWeight: '900', marginLeft: 4 },
    infoRowLand: {
        flexDirection: 'column',
        gap: 6,
        marginTop: 0,
    },
    toastSlotLand: {
        position: 'absolute',
        top: -2,
        left: 0,
        right: 0,
        height: 30,
        marginBottom: 0,
    },
    tableZoneLand: {
        minHeight: 0,
        height: 168,
        paddingVertical: 4,
    },
    tableZone: {
        width: '100%',
        minHeight: 170,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 18,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: 'rgba(245,215,122,0.3)',
        backgroundColor: 'rgba(0,0,0,0.15)',
        paddingVertical: 8,
    },
    tableGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 6,
    },
    tableCard: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.45,
        shadowRadius: 4,
        elevation: 5,
        borderRadius: 6,
    },
    tableHl: {
        position: 'absolute',
        top: -4,
        left: -4,
        right: -4,
        bottom: -4,
        borderRadius: 9,
        borderWidth: 3,
        borderColor: '#FFD966',
        backgroundColor: 'rgba(255,200,60,0.2)',
    },
    emptyTable: {
        color: 'rgba(245,215,122,0.55)',
        fontWeight: '800',
        letterSpacing: 2,
        fontSize: 12,
    },
    flyLayer: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
    },
    flyCard: {
        position: 'absolute',
    },
    previewText: {
        marginTop: 6,
        color: theme.goldLight,
        fontWeight: '900',
        fontSize: 13,
        textShadowColor: '#000',
        textShadowRadius: 4,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        marginTop: 8,
    },
    pile: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.45)',
        borderRadius: 12,
        paddingVertical: 4,
        paddingHorizontal: 6,
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.3)',
    },
    pileEmpty: {
        width: 30,
        height: 44,
        borderRadius: 4,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: 'rgba(255,255,255,0.3)',
    },
    pileLabel: {
        color: theme.cream,
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1,
    },
    pileCount: {
        color: theme.cream,
        fontSize: 16,
        fontWeight: '900',
    },
    pileUnit: {
        fontSize: 10,
        color: theme.textDim,
    },
    deckInfo: {
        alignItems: 'center',
    },
    deckText: {
        color: theme.goldLight,
        fontSize: 11,
        fontWeight: '900',
        marginTop: 2,
    },
    turnChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(12,5,7,0.78)',
        borderRadius: 24,
        paddingVertical: 3,
        paddingLeft: 3,
        paddingRight: 14,
        marginTop: 8,
        borderWidth: 1.5,
        borderColor: 'rgba(212,175,55,0.45)',
        maxWidth: '100%',
    },
    turnChipMine: {
        backgroundColor: theme.gold,
        borderColor: theme.goldLight,
    },
    turnLabel: {
        color: theme.textDim,
        fontSize: 8,
        fontWeight: '900',
        letterSpacing: 1.2,
    },
    turnName: {
        color: theme.cream,
        fontSize: 14,
        fontWeight: '900',
    },
    playerArea: {
        height: 200,
        justifyContent: 'flex-end',
    },
    playerAreaLand: {
        height: 128,
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        minHeight: 4,
        paddingHorizontal: 12,
        marginBottom: 4,
        zIndex: 700,
        flexWrap: 'wrap',
    },
    actionRowLand: {
        position: 'absolute',
        top: -46,
        left: 0,
        right: 0,
    },
    announcedText: {
        color: theme.mint,
        fontWeight: '900',
        fontSize: 12,
    },
    lastCardHint: {
        color: '#FCA5A5',
        fontWeight: '900',
        fontSize: 12,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    meRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        zIndex: 600,
    },
    meRowLand: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 10,
        alignItems: 'flex-end',
    },
    meInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    mePill: {
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 10,
        backgroundColor: 'rgba(10,4,6,0.7)',
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.35)',
    },
    mePillActive: {
        backgroundColor: theme.gold,
        borderColor: theme.goldLight,
    },
    meName: {
        color: theme.cream,
        fontWeight: '900',
        fontSize: 13,
    },
    mint: {
        width: 28,
        height: 28,
        resizeMode: 'contain',
    },
    hand: {
        height: 140,
        width: '100%',
    },
    handLand: {
        height: 128,
    },
    spectatorBox: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
    },
    spectatorText: {
        color: theme.goldLight,
        fontSize: 18,
        fontWeight: '900',
    },
    sheetOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.65)',
        justifyContent: 'flex-end',
        zIndex: 9000,
        elevation: 9000,
    },
    sheet: {
        backgroundColor: theme.panelSolid,
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        borderWidth: 2,
        borderBottomWidth: 0,
        borderColor: '#DC2626',
        padding: 18,
    },
    sheetTitle: {
        color: '#FCA5A5',
        fontSize: 20,
        fontWeight: '900',
        textAlign: 'center',
    },
    sheetSub: {
        color: theme.textDim,
        fontSize: 12,
        textAlign: 'center',
        marginTop: 2,
        marginBottom: 10,
    },
    sheetLabel: {
        color: theme.cream,
        fontWeight: '800',
        textAlign: 'center',
        marginVertical: 8,
    },
    targetRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
    },
    targetBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: 'rgba(212,175,55,0.3)',
    },
    targetBtnOn: {
        borderColor: '#FCA5A5',
        backgroundColor: 'rgba(220,38,38,0.25)',
    },
    targetName: {
        color: theme.cream,
        fontWeight: '800',
    },
    valueGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 8,
    },
    valueBtn: {
        alignItems: 'center',
        padding: 4,
        borderRadius: 8,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    valueText: {
        color: theme.goldLight,
        fontWeight: '900',
        fontSize: 12,
        marginTop: 2,
    },
});
