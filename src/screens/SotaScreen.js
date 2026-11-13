import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, StatusBar, useWindowDimensions, Image } from 'react-native';
import Animated, {
    ZoomIn,
    FadeIn,
    FadeOut,
    useSharedValue,
    useAnimatedStyle,
    withSequence,
    withTiming,
    withSpring,
    withDelay,
    withRepeat,
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
import { FlyCards, GoldBurst } from '../components/Flights';
import { CardFace, CardBack } from '../components/Card';
import { ActionToast, TurnBanner } from '../components/GameFx';
import { seatMap, TopRow } from '../components/SeatRing';
import { requestReplay, useRoomChat, TopBar, ChatBubbles, ReactionBar, ChatSheet, ReactionBubble, changeGameHandler } from '../components/GameChrome';
import { PressableScale, haptic, theme } from '../components/ui';
import { dialog } from '../components/Dialog';
import socketService from '../network/socketService';
import audioService from '../network/audioService';
import { recordGame, addXp } from '../utils/stats';

const MINT = require('../../assets/menthe-poivree-removebg-preview.png');
const ORDER = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;

// Une carte face cachée de la main cible, à toucher pour piocher
function PickCard({ i, n, w, h, onPick, enabled }) {
    const hover = useSharedValue(0);
    useEffect(() => {
        if (enabled) {
            hover.value = withDelay(i * 60, withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0, { duration: 700 })), -1, true));
        } else {
            cancelAnimation(hover);
            hover.value = withTiming(0);
        }
    }, [enabled]);
    const mid = (n - 1) / 2;
    const style = useAnimatedStyle(() => ({
        transform: [{ translateY: -hover.value * 5 + Math.abs(i - mid) * 2 }, { rotateZ: `${(i - mid) * Math.min(5, 30 / n)}deg` }],
    }));
    return (
        <Animated.View entering={ZoomIn.delay(i * 25)} style={[{ marginLeft: i === 0 ? 0 : -w * 0.45 }, style]}>
            <PressableScale disabled={!enabled} onPress={onPick} sound={null} scaleTo={0.9}>
                <CardBack width={w} height={h} />
            </PressableScale>
        </Animated.View>
    );
}

// Paire éliminée : les deux cartes apparaissent au centre puis filent vers le joueur
function PairFlash({ flash }) {
    const t = useSharedValue(0);
    useEffect(() => {
        t.value = withSequence(withSpring(1, { damping: 10 }), withDelay(700, withTiming(2, { duration: 400, easing: Easing.in(Easing.cubic) })));
    }, []);
    const style = useAnimatedStyle(() => ({
        opacity: t.value > 1.6 ? (2 - t.value) / 0.4 : Math.min(1, t.value),
        transform: [{ scale: t.value <= 1 ? 0.6 + t.value * 0.4 : 1 - (t.value - 1) * 0.5 }, { translateY: t.value > 1 ? (t.value - 1) * (flash.mine ? 220 : -200) : 0 }],
    }));
    return (
        <Animated.View pointerEvents="none" style={[styles.pairFlash, style]}>
            <Text style={styles.pairTitle}>PAIRE !</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
                {flash.pair.map((c) => <CardFace key={c.id} card={c} width={52} height={76} />)}
            </View>
            <Text style={styles.pairWho}>{flash.who}</Text>
        </Animated.View>
    );
}

// Révélation finale de la Sota
function SotaReveal({ reveal }) {
    const t = useSharedValue(0);
    useEffect(() => {
        t.value = withDelay(300, withSpring(1, { damping: 7, stiffness: 90 }));
    }, []);
    const style = useAnimatedStyle(() => ({ transform: [{ scale: 0.3 + t.value * 0.7 }, { rotateZ: `${(1 - t.value) * -30}deg` }], opacity: Math.min(1, t.value * 2) }));
    return (
        <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.revealOverlay} pointerEvents="none">
            <Text style={styles.revealTitle}>SOTA !</Text>
            <Animated.View style={style}>
                {reveal.sota ? <CardFace card={reveal.sota} width={130} height={186} /> : <CardBack width={130} height={186} />}
            </Animated.View>
            <Text style={styles.revealSub}>{reveal.text}</Text>
        </Animated.View>
    );
}

export default function SotaScreen({ route, navigation }) {
    const { roomId, playerName, initialGameState } = route.params || {};
    const { width: winW, height: winH } = useWindowDimensions();
    const [board, setBoard] = useState(null);
    const stageW = board?.w ?? Math.min(winW, 500);
    const stageH = board?.h ?? winH;
    const land = stageW > stageH * 1.2;

    const [state, setState] = useState(initialGameState);
    const [timeLeft, setTimeLeft] = useState(30);
    const [toast, setToast] = useState(null);
    const [moods, setMoods] = useState({});
    const react = (i, type) => { if (i !== null && i !== undefined && i >= 0) setMoods((m) => ({ ...m, [i]: { id: Date.now() + Math.random(), type } })); };
    const [banner, setBanner] = useState(null);
    const [pairFlash, setPairFlash] = useState(null);
    const [pickFly, setPickFly] = useState(null);
    const [burst, setBurst] = useState(null);
    const [reveal, setReveal] = useState(null);
    const [lastDrawn, setLastDrawn] = useState(null);
    const [showEnd, setShowEnd] = useState(false);
    const [showRules, setShowRules] = useState(false);
    const [isMuted, setIsMuted] = useState(audioService.muted);
    const [xpEarned, setXpEarned] = useState(0);
    const [picking, setPicking] = useState(false);

    const { chatMessages, activeReactions, showChat, setShowChat, sendChat, sendReaction } = useRoomChat(roomId);
    const seen = useRef(new Set());
    const timers = useRef([]);
    const toastTimer = useRef(null);
    const prevTurn = useRef(null);
    const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };

    const me = state?.myIndex ?? -1;
    const n = state?.numPlayers || 4;
    const seats = useMemo(() => seatMap(n, me >= 0 ? me : 0), [n, me]);
    const nameOf = (i) => (i === me ? 'Toi' : state?.players?.[i]?.name || `Joueur ${i + 1}`);
    const isMyTurn = me >= 0 && state?.phase === 'play' && state.turn === me;

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
            socketService.onGameStateUpdate((s) => { setPicking(false); setState(s); }),
            socketService.onGameStarted((s) => {
                setShowEnd(false);
                setXpEarned(0);
                setReveal(null);
                setLastDrawn(null);
                setState(s);
            }),
            socketService.onTimerTick((d) => setTimeLeft(d.timeLeft)),
            socketService.onGameError((err) => {
                audioService.playSound('error');
                showToast(`⚠️ ${err?.message || 'Action impossible'}`, theme.redLight);
            }),
            socketService.onActionRejected(() => { setPicking(false); audioService.playSound('error'); }),
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
        if (isMyTurn && prevTurn.current !== me) {
            later(() => { audioService.playSound('your_turn'); haptic('medium'); }, 300);
        }
        prevTurn.current = state.turn;
    }, [state]);

    // Musique : plus tendue à mesure que les joueurs sortent
    useEffect(() => {
        if (!state || state.phase === 'over') { audioService.setMusicIntensity(0); return; }
        audioService.setMusicIntensity((state.outOrder?.length || 0) / Math.max(1, state.numPlayers - 2));
    }, [state]);

    const handleEvent = (e, s) => {
        switch (e.type) {
            case 'deal':
                audioService.playDeal(10, 70);
                showToast('🃏 Distribution : chacun élimine ses paires', theme.gold);
                break;
            case 'initial_pairs':
                if (e.player === me) {
                    later(() => { audioService.playSound('coin'); haptic('light'); }, 600);
                    showToast(`✨ Tu élimines ${plural(e.pairs.length, 'paire')} au départ`, theme.mint);
                }
                break;
            case 'pick':
                audioService.playSound('card_draw');
                react(e.by, 'play');
                // La carte part de la main visée (au centre) vers celui qui pioche
                setPickFly({ id: e.id, count: 1, to: seats[e.by] || 'bottom', cards: e.card && (e.by === me) ? [e.card] : undefined, scale: land ? 0.5 : 0.85 });
                if (e.by === me && e.card) {
                    haptic('light');
                    setLastDrawn({ id: e.id, card: e.card });
                    later(() => setLastDrawn((d) => (d && d.id === e.id ? null : d)), 2200);
                } else if (e.from === me && e.card) {
                    showToast(`${nameOf(e.by)} t'a pris ${e.card.value === 10 ? 'la SOTA 😈' : `un ${e.card.value}`}`, e.card.value === 10 ? theme.mint : theme.cream);
                    if (e.card.value === 10) { audioService.playSound('laugh', { volume: 0.4 }); haptic('success'); }
                }
                break;
            case 'pair':
                later(() => {
                    audioService.playSound('coin');
                    if (e.player === me) haptic('success');
                    setPairFlash({ id: e.id, pair: e.pair, who: nameOf(e.player), mine: e.player === me });
                }, 350);
                later(() => setPairFlash((p) => (p && p.id === e.id ? null : p)), 1900);
                break;
            case 'out':
                react(e.player, 'win');
                if (e.player === me) {
                    audioService.playSound('victory');
                    haptic('success');
                    setBanner({ id: e.id, text: 'TU ES SORTI !', sub: 'Pas de Sota pour toi 😎', color: '#047857', textColor: '#fff' });
                } else {
                    audioService.playSound('player_out');
                    showToast(`🏁 ${nameOf(e.player)} est sorti !`, theme.mint);
                }
                break;
            case 'auto_pick':
                showToast(`⏱️ Temps écoulé : ${nameOf(e.player)} pioche au hasard`, theme.textDim);
                break;
            case 'forfeit':
                showToast(`🔌 ${state.players?.[e.player]?.name || 'Un joueur'} est parti`, theme.textDim);
                break;
            case 'game_over':
                audioService.stopTickTock();
                onGameOver(e, s);
                break;
            default:
                break;
        }
    };

    const onGameOver = (e, s) => {
        const iLost = e.loser === me;
        later(() => react(e.loser, 'khasser'), 1600);
        later(() => {
            audioService.playSound('sota');
            haptic('long');
            setBurst({ id: Date.now(), color: '#D8B4FE', size: 320 });
            setReveal({
                sota: e.sota,
                text: iLost ? 'Tu as la Sota : tu es le Ghamla !' : `Sota chez ${nameOf(e.loser)} : c'est le Ghamla !`,
            });
        }, 700);
        later(() => {
            shake(iLost ? 16 : 8);
            audioService.playSound(iLost ? 'defeat' : 'laugh');
            haptic(iLost ? 'error' : 'success');
        }, 1600);
        if (me >= 0) {
            const place = e.order.indexOf(me);
            const xp = iLost ? 10 : place === 0 ? 100 : 50;
            setXpEarned(xp);
            addXp(xp);
            recordGame({
                game: 'sota',
                won: !iLost,
                result: iLost ? 'Ghamla 💀 (Sota)' : place === 0 ? 'Sorti 1er 🎉' : `Sorti ${place + 1}e`,
                opponents: s.players.filter((_, i) => i !== me).map((p) => p.name).join(', '),
            });
        }
        later(() => { setReveal(null); audioService.playSound('whoosh'); setShowEnd(true); }, 3600);
    };

    useEffect(() => {
        if (isMyTurn && timeLeft <= 5 && timeLeft > 0) audioService.startTickTock();
        else audioService.stopTickTock();
    }, [timeLeft, isMyTurn]);

    const leave = () => {
        audioService.stopTickTock();
        socketService.leaveRoom(roomId);
        navigation.popToTop();
    };
    const handleQuit = () => dialog.alert('Quitter la partie ?', 'Un bot prendra ta place.', [
        { text: 'Rester', style: 'cancel' },
        { text: 'Quitter', style: 'destructive', onPress: leave },
    ]);

    const pick = (index) => {
        if (!isMyTurn || picking) return;
        setPicking(true);
        haptic('medium');
        audioService.playSound('click');
        socketService.sendAction(roomId, { type: 'pick', cardIndex: index });
    };

    const myHand = me >= 0 ? state?.hands?.[me] || [] : [];
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
        const out = state.outOrder?.includes(i);
        return (
            <OpponentSeat
                mood={moods[i]}
                player={state.players[i]}
                isBot={state.players[i]?.isBot}
                handSize={state.hands[i].length}
                active={state.phase === 'play' && (state.turn === i || state.target === i)}
                reaction={activeReactions[i]}
                position={pos === 'left' || pos === 'right' ? pos : 'top'}
                compact={land && pos.startsWith('top')}
                finished={out}
                badge={state.target === i && state.phase === 'play' ? (state.turn === me ? 'TU PIOCHES ICI' : 'CIBLE') : `${plural(state.pairs[i].length, 'paire')}`}
                badgeColor={state.target === i && state.phase === 'play' ? '#FCD34D' : undefined}
                isInitialDeal={false}
            />
        );
    };

    const target = state.target;
    const targetCount = target !== null && target !== undefined ? state.hands[target].length : 0;
    const pickW = land ? 46 : 54;
    const pickH = land ? 66 : 78;
    const canReplay = state.hostId && state.hostId === socketService.socket?.id;
    const myPairs = me >= 0 ? state.pairs[me].length : 0;

    return (
        <TableBackground onSize={setBoard} game="sota">
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

                <TopRow renderSeat={renderSeat} positions={positions} height={land ? 64 : 120} />

                <View style={styles.middleArea}>
                    <View style={styles.sideArea}>{renderSeat('left')}</View>

                    <View style={styles.center}>
                        <View style={[styles.toastSlot, land && styles.toastSlotLand]} pointerEvents="none">
                            <ActionToast toast={toast} />
                        </View>

                        {state.phase === 'play' && target !== null && (
                            <>
                                <Text style={styles.pickLabel}>
                                    {isMyTurn ? `Touche une carte de ${nameOf(target)}` : `${nameOf(state.turn)} pioche chez ${nameOf(target)}`}
                                </Text>
                                <View style={[styles.pickFan, isMyTurn && styles.pickFanMine]}>
                                    {Array.from({ length: targetCount }).map((_, i) => (
                                        <PickCard key={`${target}-${i}-${targetCount}`} i={i} n={targetCount} w={pickW} h={pickH} enabled={isMyTurn && !picking} onPick={() => pick(i)} />
                                    ))}
                                </View>
                            </>
                        )}

                        {lastDrawn && (
                            <Animated.View entering={ZoomIn.springify()} exiting={FadeOut} style={styles.drawn}>
                                <Text style={styles.drawnLabel}>Tu as pioché</Text>
                                <CardFace card={lastDrawn.card} width={44} height={64} />
                            </Animated.View>
                        )}

                        {state.phase === 'play' && (
                            <View style={[styles.turnChip, isMyTurn && styles.turnChipMine]}>
                                <CircularTimer timeLeft={timeLeft} maxTime={30} size={36} />
                                <View style={{ marginLeft: 8, flexShrink: 1 }}>
                                    <Text style={[styles.turnLabel, isMyTurn && { color: theme.bg }]}>TOUR DE</Text>
                                    <Text style={[styles.turnName, isMyTurn && { color: theme.bg }]} numberOfLines={1}>
                                        {isMyTurn ? 'TOI' : nameOf(state.turn)}
                                    </Text>
                                </View>
                            </View>
                        )}
                        {pairFlash && <PairFlash key={pairFlash.id} flash={pairFlash} />}
                        {pickFly && <FlyCards key={pickFly.id} fly={pickFly} w={46} h={66} />}
                        {burst && <GoldBurst key={burst.id} burst={burst} />}
                    </View>

                    <View style={styles.sideArea}>{renderSeat('right')}</View>
                </View>

                <ChatBubbles messages={chatMessages} top={land ? 56 : 130} />

                <View style={[styles.playerArea, land && styles.playerAreaLand]}>
                    {me < 0 ? (
                        <View style={styles.spectatorBox}><Text style={styles.spectatorText}>👀 Tu es spectateur</Text></View>
                    ) : (
                        <>
                            <View style={[styles.meRow, land && styles.meRowLand]} pointerEvents="box-none">
                                <View style={styles.meInfo}>
                                    <View>
                                        <PlayerAvatar name={playerName || 'Toi'} size={38} active={isMyTurn} mood={moods[me]} />
                                        <ReactionBubble emoji={activeReactions[me]} />
                                    </View>
                                    <View style={[styles.mePill, isMyTurn && styles.mePillActive]}>
                                        <Text style={[styles.meName, isMyTurn && { color: theme.bg }]}>
                                            Toi · {myHand.length} · {plural(myPairs, 'paire')}
                                        </Text>
                                    </View>
                                    {state.target === me && state.phase === 'play' && <Text style={styles.targetMe}>on pioche chez toi</Text>}
                                    {isMyTurn && <Image source={MINT} style={styles.mint} />}
                                </View>
                                <ReactionBar land={land} onSend={sendReaction} />
                            </View>

                            <View style={[styles.hand, land && styles.handLand]}>
                                {myHand.length === 0 && state.phase === 'play' ? (
                                    <View style={styles.outBox}><Text style={styles.outText}>🏁 Tu es sorti ! Regarde qui finira avec la Sota…</Text></View>
                                ) : (
                                    handLayout.map(({ card, x, angle, arcY }, i) => (
                                        <MasterCard key={card.id} card={card} index={i} x={x} angle={angle} arcY={arcY} isMyTurn={false} isPlayable={false} glow={card.value === 10} isInitialDeal />
                                    ))
                                )}
                            </View>
                        </>
                    )}
                </View>
            </Animated.View>

            <TurnBanner banner={banner} />
            {reveal && <SotaReveal reveal={reveal} />}

            <ChatSheet visible={showChat} onClose={() => setShowChat(false)} onSend={sendChat} />

            {showEnd && state.phase === 'over' && (
                <RankingEndOverlay
                    emoji={state.loser === me ? '💀' : '🎉'}
                    title={state.loser === me ? 'GHAMLA !' : 'BRAVO !'}
                    subtitle={state.forfeit ? 'Un joueur est parti' : state.loser === me ? 'Tu as fini avec la Sota' : `Sota chez ${nameOf(state.loser)}`}
                    hero={state.sota ? (
                        <View style={styles.heroSota}>
                            <CardFace card={state.sota} width={60} height={86} />
                            <Text style={styles.heroText}>La Sota</Text>
                        </View>
                    ) : null}
                    rows={[
                        ...state.outOrder.map((p, k) => ({ player: p, name: state.players[p]?.name, isMe: p === me, detail: k === 0 ? 'Sorti 1er 🏆' : `Sorti ${k + 1}e` })),
                        ...(state.loser !== null ? [{ player: state.loser, name: state.players[state.loser]?.name, isMe: state.loser === me, detail: 'Ghamla (Sota)', loser: true }] : []),
                    ]}
                    won={me >= 0 && state.loser !== me}
                    lost={state.loser === me}
                    xpEarned={xpEarned}
                    canReplay={canReplay}
                    onReplay={() => requestReplay(roomId)}
                    onQuit={state.players?.some((p) => p.isBot) ? leave : handleQuit}
                    onChangeGame={changeGameHandler(roomId, state)}
                />
            )}

            <RulesModal visible={showRules} onClose={() => setShowRules(false)} gameType="sota" />
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
    pickLabel: { color: theme.goldLight, fontWeight: '900', fontSize: 13, marginBottom: 8, textAlign: 'center', textShadowColor: '#000', textShadowRadius: 4 },
    pickFan: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 18,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: 'rgba(245,215,122,0.3)',
        backgroundColor: 'rgba(0,0,0,0.2)',
        minHeight: 100,
    },
    pickFanMine: { borderStyle: 'solid', borderColor: '#FCD34D', backgroundColor: 'rgba(252,211,77,0.12)' },
    drawn: {
        position: 'absolute',
        right: 4,
        top: 40,
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 12,
        padding: 6,
        borderWidth: 1,
        borderColor: theme.gold,
    },
    drawnLabel: { color: theme.goldLight, fontSize: 9, fontWeight: '900', marginBottom: 3 },
    turnChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(12,5,7,0.78)',
        borderRadius: 24,
        paddingVertical: 3,
        paddingLeft: 3,
        paddingRight: 14,
        marginTop: 12,
        borderWidth: 1.5,
        borderColor: 'rgba(212,175,55,0.45)',
    },
    turnChipMine: { backgroundColor: theme.gold, borderColor: theme.goldLight },
    turnLabel: { color: theme.textDim, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
    turnName: { color: theme.cream, fontSize: 14, fontWeight: '900' },
    pairFlash: {
        position: 'absolute',
        alignItems: 'center',
        backgroundColor: 'rgba(4,120,87,0.9)',
        borderRadius: 16,
        padding: 10,
        borderWidth: 2,
        borderColor: '#6EE7B7',
        zIndex: 300,
    },
    pairTitle: { color: '#fff', fontWeight: '900', fontSize: 20, letterSpacing: 2, marginBottom: 6 },
    pairWho: { color: '#D1FAE5', fontWeight: '800', fontSize: 12, marginTop: 4 },
    playerArea: { height: 200, justifyContent: 'flex-end' },
    playerAreaLand: { height: 128 },
    meRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, zIndex: 600 },
    meRowLand: { position: 'absolute', left: 0, right: 0, bottom: 10, alignItems: 'flex-end' },
    meInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
    mePill: {
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 10,
        backgroundColor: 'rgba(10,4,6,0.7)',
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.35)',
    },
    mePillActive: { backgroundColor: theme.gold, borderColor: theme.goldLight },
    meName: { color: theme.cream, fontWeight: '900', fontSize: 12 },
    targetMe: { color: '#FCD34D', fontSize: 10, fontWeight: '900' },
    mint: { width: 28, height: 28, resizeMode: 'contain' },
    hand: { height: 140, width: '100%' },
    handLand: { height: 128 },
    outBox: { marginHorizontal: 20, marginTop: 30, backgroundColor: 'rgba(6,95,70,0.85)', borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1.5, borderColor: theme.mint },
    outText: { color: '#ECFDF5', fontWeight: '800', textAlign: 'center' },
    spectatorBox: { alignItems: 'center', justifyContent: 'center', flex: 1 },
    spectatorText: { color: theme.goldLight, fontSize: 18, fontWeight: '900' },
    revealOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.82)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 4000,
        elevation: 4000,
        padding: 20,
    },
    revealTitle: { color: '#FCD34D', fontSize: 48, fontWeight: '900', letterSpacing: 6, marginBottom: 16, textShadowColor: '#B45309', textShadowRadius: 20 },
    revealSub: { color: theme.cream, fontSize: 17, fontWeight: '900', marginTop: 18, textAlign: 'center' },
    heroSota: { alignItems: 'center', marginBottom: 8 },
    heroText: { color: '#FCD34D', fontWeight: '900', fontSize: 12, marginTop: 4 },
});
