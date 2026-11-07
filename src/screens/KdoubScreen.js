import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, StatusBar, useWindowDimensions, Image } from 'react-native';
import Animated, {
    ZoomIn,
    FadeIn,
    FadeOut,
    FadeInDown,
    useSharedValue,
    useAnimatedStyle,
    withSequence,
    withTiming,
    withSpring,
    withRepeat,
    withDelay,
    Easing,
    cancelAnimation,
} from 'react-native-reanimated';

import MasterCard, { computeFan } from '../components/MasterCard';
import PlayerAvatar from '../components/PlayerAvatar';
import CircularTimer from '../components/CircularTimer';
import OpponentSeat from '../components/OpponentSeat';
import RankingEndOverlay from '../components/RankingEndOverlay';
import RulesModal from '../components/RulesModal';
import TableBackground from '../components/TableBackground';
import { CardFace, CardBack } from '../components/Card';
import { ActionToast } from '../components/GameFx';
import { seatMap, TopRow } from '../components/SeatRing';
import { useRoomChat, TopBar, ChatBubbles, ReactionBar, ChatSheet, ReactionBubble } from '../components/GameChrome';
import { GameButton, PressableScale, haptic, theme } from '../components/ui';
import { dialog } from '../components/Dialog';
import socketService from '../network/socketService';
import audioService from '../network/audioService';
import { recordGame, addXp } from '../utils/stats';

const MINT = require('../../assets/menthe-poivree-removebg-preview.png');
const ORDER = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
const NAMES = { 1: 'As', 10: 'Sota', 11: 'Cavalier', 12: 'Roi' };
const valueLabel = (v) => (NAMES[v] ? `${v} · ${NAMES[v]}` : `${v}`);
const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;

// Tas central face cachée : épaisseur + petites rotations
function Pile({ count, bumpKey }) {
    const bump = useSharedValue(1);
    useEffect(() => {
        bump.value = withSequence(withTiming(1.12, { duration: 120 }), withSpring(1, { damping: 7 }));
    }, [bumpKey]);
    const style = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }));
    const layers = Math.min(7, Math.ceil(count / 3));
    return (
        <Animated.View style={[styles.pile, style]}>
            {count === 0 ? (
                <View style={styles.pileEmpty}><Text style={styles.pileEmptyText}>Tas vide</Text></View>
            ) : (
                Array.from({ length: layers }).map((_, i) => (
                    <View key={i} style={{ position: 'absolute', transform: [{ rotate: `${(i * 37) % 21 - 10}deg` }, { translateY: -i * 1.5 }] }}>
                        <CardBack width={62} height={90} />
                    </View>
                ))
            )}
            {count > 0 && (
                <View style={styles.pileBadge}>
                    <Text style={styles.pileBadgeText}>{count}</Text>
                </View>
            )}
        </Animated.View>
    );
}

// Cartes posées qui volent du siège vers le tas
const OFF = { bottom: [0, 260], top: [0, -220], topLeft: [-120, -200], topRight: [120, -200], left: [-200, 0], right: [200, 0] };
function PoseFly({ fly }) {
    return (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {Array.from({ length: fly.count }).map((_, i) => <FlyBack key={`${fly.id}-${i}`} i={i} from={fly.from} />)}
        </View>
    );
}
function FlyBack({ i, from }) {
    const t = useSharedValue(0);
    const [ox, oy] = OFF[from] || [0, -100];
    useEffect(() => {
        t.value = withDelay(i * 90, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }));
    }, []);
    const style = useAnimatedStyle(() => ({
        opacity: t.value < 0.98 ? 1 : 0,
        transform: [{ translateX: ox * (1 - t.value) }, { translateY: oy * (1 - t.value) }, { rotateZ: `${(1 - t.value) * 200 + i * 6}deg` }],
    }));
    return (
        <Animated.View style={[styles.flyCard, style]}>
            <CardBack width={62} height={90} />
        </Animated.View>
    );
}

// Révélation après un KDOUB : les cartes se retournent puis le verdict tombe
function Reveal({ reveal, nameOf }) {
    const flip = useSharedValue(0);
    const verdict = useSharedValue(0);
    useEffect(() => {
        flip.value = withDelay(500, withTiming(1, { duration: 450 }));
        verdict.value = withDelay(1050, withSpring(1, { damping: 9 }));
    }, []);
    const backStyle = useAnimatedStyle(() => ({ opacity: flip.value < 0.5 ? 1 : 0, transform: [{ perspective: 600 }, { rotateY: `${flip.value * 180}deg` }] }));
    const faceStyle = useAnimatedStyle(() => ({ opacity: flip.value >= 0.5 ? 1 : 0, transform: [{ perspective: 600 }, { rotateY: `${flip.value * 180 - 180}deg` }] }));
    const verdictStyle = useAnimatedStyle(() => ({ opacity: verdict.value, transform: [{ scale: 0.5 + verdict.value * 0.5 }, { rotateZ: `${(1 - verdict.value) * -12}deg` }] }));
    const liar = !reveal.truthful;
    return (
        <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(250)} style={styles.revealOverlay} pointerEvents="none">
            <Text style={styles.revealCall}>{nameOf(reveal.by)} crie KDOUB !</Text>
            <Text style={styles.revealClaim}>{nameOf(reveal.target)} avait annoncé {plural(reveal.revealed.length, '×')} {reveal.value}</Text>
            <View style={styles.revealCards}>
                {reveal.revealed.map((c) => {
                    const bad = c.value !== reveal.value;
                    return (
                        <View key={c.id} style={{ width: 70, height: 100 }}>
                            <Animated.View style={[StyleSheet.absoluteFill, backStyle]}><CardBack width={70} height={100} /></Animated.View>
                            <Animated.View style={[StyleSheet.absoluteFill, faceStyle]}>
                                <CardFace card={c} width={70} height={100} />
                                {bad && <View style={styles.badMark}><Text style={styles.badMarkText}>✗</Text></View>}
                            </Animated.View>
                        </View>
                    );
                })}
            </View>
            <Animated.View style={[styles.verdict, { backgroundColor: liar ? '#B91C1C' : '#047857' }, verdictStyle]}>
                <Text style={styles.verdictText}>{liar ? 'MENTEUR !' : "C'ÉTAIT VRAI !"}</Text>
                <Text style={styles.verdictSub}>{nameOf(reveal.loser)} ramasse {plural(reveal.taken, 'carte')}</Text>
            </Animated.View>
        </Animated.View>
    );
}

// Bouton KDOUB qui pulse pendant la fenêtre
function KdoubButton({ onPress }) {
    const pulse = useSharedValue(1);
    useEffect(() => {
        pulse.value = withRepeat(withSequence(withTiming(1.08, { duration: 300 }), withTiming(1, { duration: 300 })), -1, true);
        return () => cancelAnimation(pulse);
    }, []);
    const style = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
    return (
        <Animated.View entering={ZoomIn.springify().damping(10)} exiting={FadeOut} style={style}>
            <PressableScale onPress={onPress} sound={null} scaleTo={0.9} style={styles.kdoubBtn}>
                <Text style={styles.kdoubText}>KDOUB !</Text>
                <Text style={styles.kdoubSub}>il ment ?</Text>
            </PressableScale>
        </Animated.View>
    );
}

export default function KdoubScreen({ route, navigation }) {
    const { roomId, playerName, initialGameState } = route.params || {};
    const { width: winW, height: winH } = useWindowDimensions();
    const [board, setBoard] = useState(null);
    const stageW = board?.w ?? Math.min(winW, 500);
    const stageH = board?.h ?? winH;
    const land = stageW > stageH * 1.2;

    const [state, setState] = useState(initialGameState);
    const [timeLeft, setTimeLeft] = useState(40);
    const [selected, setSelected] = useState([]);
    const [toast, setToast] = useState(null);
    const [fly, setFly] = useState(null);
    const [reveal, setReveal] = useState(null);
    const [showEnd, setShowEnd] = useState(false);
    const [showRules, setShowRules] = useState(false);
    const [isMuted, setIsMuted] = useState(audioService.muted);
    const [xpEarned, setXpEarned] = useState(0);
    const [accused, setAccused] = useState(false);

    const { chatMessages, activeReactions, showChat, setShowChat, sendChat, sendReaction } = useRoomChat(roomId);
    const seen = useRef(new Set());
    const timers = useRef([]);
    const toastTimer = useRef(null);
    const prevTurn = useRef(null);
    const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };

    const me = state?.myIndex ?? -1;
    const n = state?.numPlayers || 3;
    const seats = useMemo(() => seatMap(n, me >= 0 ? me : 0), [n, me]);
    const nameOf = (i) => (i === me ? 'Toi' : state?.players?.[i]?.name || `Joueur ${i + 1}`);
    const isMyTurn = me >= 0 && state?.phase === 'play' && state.turn === me;
    const inWindow = state?.phase === 'window';
    const canAccuse = inWindow && me >= 0 && state.lastPose && state.lastPose.player !== me && !accused;

    const shakeX = useSharedValue(0);
    const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));
    const shake = (a = 10) => {
        shakeX.value = withSequence(withTiming(a, { duration: 45 }), withTiming(-a, { duration: 45 }), withTiming(a * 0.6, { duration: 45 }), withTiming(0, { duration: 45 }));
    };
    const showToast = (text, color) => {
        clearTimeout(toastTimer.current);
        setToast({ id: Date.now() + Math.random(), text, color });
        toastTimer.current = setTimeout(() => setToast(null), 2400);
    };

    useEffect(() => {
        audioService.setMusicMode('game');
        const unsubs = [
            socketService.onGameStateUpdate((s) => setState(s)),
            socketService.onGameStarted((s) => {
                setShowEnd(false);
                setXpEarned(0);
                setSelected([]);
                setState(s);
            }),
            socketService.onTimerTick((d) => setTimeLeft(d.timeLeft)),
            socketService.onGameError((err) => {
                audioService.playSound('error');
                showToast(`⚠️ ${err?.message || 'Action impossible'}`, theme.redLight);
            }),
            socketService.onActionRejected(() => audioService.playSound('error')),
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

    useEffect(() => {
        if (!state) return;
        (state.events || []).forEach((e) => {
            if (seen.current.has(e.id)) return;
            seen.current.add(e.id);
            handleEvent(e, state);
        });
        if (state.phase !== 'window') setAccused(false);
        if (isMyTurn && prevTurn.current !== me) {
            later(() => { audioService.playSound('your_turn'); haptic('medium'); }, 250);
        }
        prevTurn.current = state.phase === 'play' ? state.turn : null;
        if (!isMyTurn) setSelected([]);
    }, [state]);

    const handleEvent = (e, s) => {
        switch (e.type) {
            case 'deal':
                audioService.playDeal(10, 70);
                showToast(`🃏 Toutes les cartes sont distribuées. On commence par l'As !`, theme.gold);
                break;
            case 'pose':
                setFly({ id: e.id, count: e.count, from: seats[e.player] || 'top' });
                for (let k = 0; k < e.count; k++) later(() => audioService.playSound('card_play', { volume: 0.6, rate: 0.95 + k * 0.05 }), k * 90);
                haptic('light');
                if (e.last) {
                    later(() => { audioService.playSound('warning'); haptic('warning'); }, 400);
                    showToast(`😱 ${nameOf(e.player)} pose ses dernières cartes ! KDOUB ?`, '#FCA5A5');
                }
                break;
            case 'kdoub':
                audioService.playSound('reveal');
                haptic('heavy');
                setReveal(e);
                later(() => {
                    shake(e.truthful ? 6 : 14);
                    haptic(e.truthful ? 'success' : 'heavy');
                    audioService.playSound(e.truthful ? 'coin' : 'penalty');
                }, 1100);
                later(() => {
                    setReveal(null);
                    audioService.playSound('card_draw');
                    if (e.loser === me) showToast(`Tu ramasses ${plural(e.taken, 'carte')} 😬`, '#F87171');
                }, 2700);
                break;
            case 'auto_pose':
                showToast(`⏱️ Temps écoulé : ${nameOf(e.player)} pose une carte au hasard`, theme.textDim);
                break;
            case 'game_over':
                audioService.stopTickTock();
                onGameOver(s);
                break;
            default:
                break;
        }
    };

    const onGameOver = (s) => {
        const won = s.winner === me;
        if (me >= 0) {
            const place = s.ranking.findIndex((r) => r.player === me);
            const xp = place === 0 ? 100 : place === 1 ? 50 : place === 2 ? 20 : 10;
            setXpEarned(xp);
            addXp(xp);
            recordGame({
                game: 'kdoub',
                won,
                result: won ? 'Victoire 🎉' : `${place + 1}e place`,
                opponents: s.players.filter((_, i) => i !== me).map((p) => p.name).join(', '),
            });
            later(() => audioService.playSound(won ? 'victory' : 'defeat'), 800);
        }
        later(() => { audioService.playSound('whoosh'); setShowEnd(true); }, 2900);
    };

    // Tic-tac pendant mon tour (dernières secondes) et pendant la fenêtre d'accusation
    useEffect(() => {
        if ((isMyTurn && timeLeft <= 5 && timeLeft > 0) || (canAccuse && timeLeft <= 3 && timeLeft > 0)) audioService.startTickTock();
        else audioService.stopTickTock();
    }, [timeLeft, isMyTurn, canAccuse]);

    const leave = () => {
        audioService.stopTickTock();
        socketService.leaveRoom();
        navigation.popToTop();
    };
    const handleQuit = () => dialog.alert('Quitter la partie ?', 'Un bot prendra ta place.', [
        { text: 'Rester', style: 'cancel' },
        { text: 'Quitter', style: 'destructive', onPress: leave },
    ]);

    const myHand = me >= 0 ? state?.hands?.[me] || [] : [];
    const toggle = (id) => {
        setSelected((cur) => {
            if (cur.includes(id)) return cur.filter((x) => x !== id);
            if (cur.length >= 4) {
                audioService.playSound('error');
                return cur;
            }
            return [...cur, id];
        });
    };
    const poseSelected = () => {
        const idx = selected.map((id) => myHand.findIndex((c) => c.id === id)).filter((i) => i >= 0);
        if (!idx.length) return;
        haptic('medium');
        socketService.sendAction(roomId, { type: 'pose', cardIndexes: idx });
        setSelected([]);
    };
    const accuse = () => {
        setAccused(true);
        haptic('heavy');
        audioService.playSound('darba');
        socketService.sendAction(roomId, { type: 'accuse' });
    };

    const handLayout = useMemo(() => {
        const sorted = myHand.map((card, idx) => ({ card, idx })).sort((a, b) => ORDER.indexOf(a.card.value) - ORDER.indexOf(b.card.value));
        return computeFan(sorted, stageW, land);
    }, [myHand, stageW, land]);

    if (!state) return <View style={{ flex: 1, backgroundColor: theme.bg }} />;

    const positions = Object.values(seats);
    const playerAt = (pos) => Number(Object.keys(seats).find((k) => seats[k] === pos));
    const renderSeat = (pos) => {
        const i = playerAt(pos);
        if (Number.isNaN(i)) return null;
        return (
            <OpponentSeat
                player={state.players[i]}
                isBot={state.players[i]?.isBot}
                handSize={state.hands[i].length}
                active={(state.phase === 'play' && state.turn === i) || (inWindow && state.lastPose?.player === i)}
                reaction={activeReactions[i]}
                position={pos === 'left' || pos === 'right' ? pos : 'top'}
                compact={land && pos.startsWith('top')}
                isInitialDeal={false}
            />
        );
    };

    const canReplay = state.hostId && state.hostId === socketService.socket?.id;
    const lp = state.lastPose;
    const history = (state.history || []).slice(-4, -1).reverse();
    const nextExpected = state.expected;

    // Dernière annonce, historique et puce de tour (sous le tas en portrait, à droite en paysage)
    const claimInfo = (
        <>
        {lp && (
            <Animated.View key={`${lp.player}-${state.history?.length}`} entering={FadeInDown.springify().damping(14)} style={styles.claim}>
                <Text style={styles.claimWho}>{nameOf(lp.player)}</Text>
                <Text style={styles.claimText}>{lp.count} × {lp.value}</Text>
            </Animated.View>
        )}

        {history.length > 0 && !land && (
            <View style={styles.history}>
                {history.map((h, k) => (
                    <Text key={k} style={styles.historyText}>{nameOf(h.player)} : {h.count} × {h.value}</Text>
                ))}
            </View>
        )}

        {state.phase !== 'over' && (
            <View style={[styles.turnChip, (isMyTurn || canAccuse) && styles.turnChipMine, inWindow && styles.turnChipWindow]}>
                <CircularTimer timeLeft={timeLeft} maxTime={inWindow ? 5 : 40} size={36} />
                <View style={{ marginLeft: 8, flexShrink: 1 }}>
                    <Text style={[styles.turnLabel, (isMyTurn || canAccuse) && { color: theme.bg }]}>
                        {inWindow ? 'FENÊTRE KDOUB' : 'TOUR DE'}
                    </Text>
                    <Text style={[styles.turnName, (isMyTurn || canAccuse) && { color: theme.bg }]} numberOfLines={1}>
                        {inWindow ? (lp?.player === me ? 'On te croit ?' : 'Il ment ?') : isMyTurn ? 'TOI' : nameOf(state.turn)}
                    </Text>
                </View>
            </View>
        )}
        </>
    );

    return (
        <TableBackground onSize={setBoard} tint="rgba(40, 10, 60, 0.22)">
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
                />

                <TopRow renderSeat={renderSeat} positions={positions} height={land ? 64 : 112} />

                <View style={styles.middleArea}>
                    <View style={styles.sideArea}>{renderSeat('left')}</View>

                    <View style={styles.center}>
                        <View style={[styles.toastSlot, land && styles.toastSlotLand]} pointerEvents="none">
                            <ActionToast toast={toast} />
                        </View>

                        <View style={[styles.centerRow, land && { gap: 18 }]}>
                            <View style={styles.expectedBox}>
                                <Text style={styles.expectedLabel}>{inWindow ? 'ANNONCÉ' : 'À ANNONCER'}</Text>
                                <CardFace card={{ suit: 'Oros', value: inWindow && lp ? lp.value : nextExpected }} width={land ? 40 : 48} height={land ? 58 : 70} />
                                <Text style={styles.expectedValue}>{valueLabel(inWindow && lp ? lp.value : nextExpected)}</Text>
                            </View>

                            <View style={styles.pileWrap}>
                                <Pile count={state.pileCount || 0} bumpKey={state.pileCount} />
                                {fly && <PoseFly key={fly.id} fly={fly} />}
                            </View>
                            {land && (
                                <View style={{ alignItems: 'center' }}>
                                    {claimInfo}
                                </View>
                            )}
                        </View>

                        {!land && (
                            <>
                                {claimInfo}
                            </>
                        )}
                    </View>

                    <View style={styles.sideArea}>{renderSeat('right')}</View>
                </View>

                <ChatBubbles messages={chatMessages} top={land ? 56 : 130} />

                <View style={[styles.playerArea, land && styles.playerAreaLand]}>
                    {me < 0 ? (
                        <View style={styles.spectatorBox}><Text style={styles.spectatorText}>👀 Tu es spectateur</Text></View>
                    ) : (
                        <>
                            <View style={[styles.actionRow, land && styles.actionRowLand]} pointerEvents="box-none">
                                {canAccuse && <KdoubButton onPress={accuse} />}
                                {isMyTurn && (
                                    <Animated.View entering={ZoomIn.springify()} exiting={FadeOut}>
                                        <GameButton
                                            small
                                            title={selected.length ? `POSER ${selected.length} × ${nextExpected}` : `Choisis 1 à 4 cartes (${nextExpected})`}
                                            icon="🂠"
                                            variant={selected.length ? 'gold' : 'outline'}
                                            disabled={!selected.length}
                                            onPress={poseSelected}
                                        />
                                    </Animated.View>
                                )}
                            </View>

                            <View style={[styles.meRow, land && styles.meRowLand]} pointerEvents="box-none">
                                <View style={styles.meInfo}>
                                    <View>
                                        <PlayerAvatar name={playerName || 'Toi'} size={38} active={isMyTurn} />
                                        <ReactionBubble emoji={activeReactions[me]} />
                                    </View>
                                    <View style={[styles.mePill, isMyTurn && styles.mePillActive]}>
                                        <Text style={[styles.meName, isMyTurn && { color: theme.bg }]}>Toi · {myHand.length}</Text>
                                    </View>
                                    {isMyTurn && <Image source={MINT} style={styles.mint} />}
                                </View>
                                <ReactionBar land={land} onSend={sendReaction} />
                            </View>

                            <View style={[styles.hand, land && styles.handLand]}>
                                {handLayout.map(({ card, x, angle, arcY }, i) => (
                                    <MasterCard
                                        key={card.id}
                                        card={card}
                                        index={i}
                                        x={x}
                                        angle={angle}
                                        arcY={arcY}
                                        isMyTurn={false}
                                        isPlayable={isMyTurn}
                                        glow={isMyTurn && card.value === nextExpected}
                                        toggleMode
                                        selected={selected.includes(card.id)}
                                        onSelect={() => toggle(card.id)}
                                        isInitialDeal
                                    />
                                ))}
                            </View>
                        </>
                    )}
                </View>
            </Animated.View>

            {reveal && <Reveal key={reveal.id} reveal={reveal} nameOf={nameOf} />}

            <ChatSheet visible={showChat} onClose={() => setShowChat(false)} onSend={sendChat} />

            {showEnd && state.phase === 'over' && state.ranking && (
                <RankingEndOverlay
                    emoji={state.winner === me ? '🏆' : '🃏'}
                    title={state.winner === me ? 'VICTOIRE !' : `${nameOf(state.winner).toUpperCase()} GAGNE`}
                    subtitle={state.winner === me ? 'Tu as vidé ta main en premier' : 'Classement au nombre de cartes restantes'}
                    rows={state.ranking.map((r, k) => ({
                        player: r.player,
                        name: state.players[r.player]?.name,
                        isMe: r.player === me,
                        detail: k === 0 ? '0 carte 🏆' : plural(r.cards, 'carte'),
                    }))}
                    won={state.winner === me}
                    lost={me >= 0 && state.winner !== me && state.ranking[state.ranking.length - 1]?.player === me}
                    xpEarned={xpEarned}
                    canReplay={canReplay}
                    onReplay={() => socketService.playAgain(roomId)}
                    onQuit={state.players?.some((p) => p.isBot) ? leave : handleQuit}
                />
            )}

            <RulesModal visible={showRules} onClose={() => setShowRules(false)} gameType="kdoub" />
        </TableBackground>
    );
}

const styles = StyleSheet.create({
    board: { flex: 1, paddingTop: 10, paddingBottom: 6 },
    middleArea: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
    sideArea: { width: 84, alignItems: 'center', justifyContent: 'center' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    toastSlot: { height: 32, width: '100%', justifyContent: 'center', marginBottom: 2, zIndex: 50 },
    toastSlotLand: { position: 'absolute', top: -2, left: 0, right: 0, height: 30, marginBottom: 0 },
    centerRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    expectedBox: {
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: 'rgba(212,175,55,0.5)',
        paddingVertical: 6,
        paddingHorizontal: 10,
    },
    expectedLabel: { color: theme.textDim, fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginBottom: 4 },
    expectedValue: { color: theme.goldLight, fontSize: 14, fontWeight: '900', marginTop: 4 },
    pileWrap: { width: 110, height: 120, alignItems: 'center', justifyContent: 'center' },
    pile: { width: 90, height: 110, alignItems: 'center', justifyContent: 'center' },
    pileEmpty: {
        width: 62,
        height: 90,
        borderRadius: 8,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: 'rgba(245,215,122,0.4)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    pileEmptyText: { color: 'rgba(245,215,122,0.6)', fontSize: 10, fontWeight: '800' },
    pileBadge: {
        position: 'absolute',
        top: 0,
        right: 2,
        minWidth: 26,
        height: 26,
        borderRadius: 13,
        paddingHorizontal: 5,
        backgroundColor: theme.gold,
        borderWidth: 1.5,
        borderColor: '#FFF3C4',
        alignItems: 'center',
        justifyContent: 'center',
    },
    pileBadgeText: { color: theme.bg, fontWeight: '900', fontSize: 12 },
    flyCard: { position: 'absolute', left: 24, top: 15 },
    claim: {
        marginTop: 6,
        alignItems: 'center',
        backgroundColor: 'rgba(124,58,237,0.85)',
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 4,
        borderWidth: 1.5,
        borderColor: '#C4B5FD',
    },
    claimWho: { color: '#EDE9FE', fontSize: 11, fontWeight: '800' },
    claimText: { color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: 1 },
    history: { marginTop: 4, alignItems: 'center' },
    historyText: { color: 'rgba(243,233,220,0.6)', fontSize: 11, fontWeight: '700' },
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
    },
    turnChipMine: { backgroundColor: theme.gold, borderColor: theme.goldLight },
    turnChipWindow: { borderColor: '#C4B5FD' },
    turnLabel: { color: theme.textDim, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
    turnName: { color: theme.cream, fontSize: 14, fontWeight: '900' },
    playerArea: { height: 200, justifyContent: 'flex-end' },
    playerAreaLand: { height: 128 },
    actionRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingHorizontal: 12, marginBottom: 6, zIndex: 700 },
    actionRowLand: { position: 'absolute', left: 10, bottom: 60, justifyContent: 'flex-start', flexDirection: 'column', alignItems: 'flex-start' },
    kdoubBtn: {
        backgroundColor: '#DC2626',
        borderRadius: 40,
        paddingHorizontal: 30,
        paddingVertical: 10,
        borderWidth: 3,
        borderColor: '#FECACA',
        alignItems: 'center',
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 14,
        elevation: 14,
    },
    kdoubText: { color: '#fff', fontWeight: '900', fontSize: 26, letterSpacing: 3 },
    kdoubSub: { color: '#FECACA', fontWeight: '800', fontSize: 11 },
    meRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, zIndex: 600 },
    meRowLand: { position: 'absolute', left: 0, right: 0, bottom: 10, alignItems: 'flex-end' },
    meInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    mePill: {
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 10,
        backgroundColor: 'rgba(10,4,6,0.7)',
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.35)',
    },
    mePillActive: { backgroundColor: theme.gold, borderColor: theme.goldLight },
    meName: { color: theme.cream, fontWeight: '900', fontSize: 13 },
    mint: { width: 28, height: 28, resizeMode: 'contain' },
    hand: { height: 140, width: '100%' },
    handLand: { height: 128 },
    spectatorBox: { alignItems: 'center', justifyContent: 'center', flex: 1 },
    spectatorText: { color: theme.goldLight, fontSize: 18, fontWeight: '900' },
    revealOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.78)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 4000,
        elevation: 4000,
        padding: 20,
    },
    revealCall: { color: '#FCA5A5', fontSize: 26, fontWeight: '900', letterSpacing: 2 },
    revealClaim: { color: theme.cream, fontSize: 14, fontWeight: '700', marginTop: 4, marginBottom: 16 },
    revealCards: { flexDirection: 'row', gap: 10, marginBottom: 18 },
    badMark: {
        position: 'absolute',
        top: -8,
        right: -8,
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#DC2626',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },
    badMarkText: { color: '#fff', fontWeight: '900' },
    verdict: { borderRadius: 16, paddingHorizontal: 26, paddingVertical: 10, alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)' },
    verdictText: { color: '#fff', fontSize: 30, fontWeight: '900', letterSpacing: 2 },
    verdictSub: { color: '#fff', fontSize: 14, fontWeight: '800', marginTop: 2 },
});
