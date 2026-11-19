/**
 * Roue du jour : 1 tour gratuit par jour (avec un compte), jamais payant, toujours un lot.
 * Le serveur tire la case (chances affichées) ; la roue tourne jusqu'à elle en moins de 3 secondes.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, useWindowDimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, ZoomIn, runOnJS } from 'react-native-reanimated';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { GameButton, PressableScale, theme, haptic } from '../components/ui';
import { dialog } from '../components/Dialog';
import { DECOR, BingaIcon, Chip } from '../components/Decor';
import { ChestArt } from '../components/ChestOpening';
import accountService, { useAccount } from '../network/accountService';
import socketService from '../network/socketService';
import audioService from '../network/audioService';
import { WHEEL, RARITIES, CHESTS } from '../../server/progress/defs';

const N = WHEEL.segments.length;
const STEP = 360 / N;
const COLORS = ['#7A0E1C', '#14306B'];

function untilTomorrow() {
    const now = new Date(Date.now() + 3600 * 1000); // heure du Maroc (UTC+1)
    const left = 24 * 60 - (now.getUTCHours() * 60 + now.getUTCMinutes());
    return `${Math.floor(left / 60)} h ${String(left % 60).padStart(2, '0')}`;
}

// Part de camembert (degrés, 0 = en haut, sens horaire)
function slice(cx, cy, r, a0, a1) {
    const p = (a) => [cx + r * Math.sin((a * Math.PI) / 180), cy - r * Math.cos((a * Math.PI) / 180)];
    const [x0, y0] = p(a0);
    const [x1, y1] = p(a1);
    return `M${cx},${cy} L${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 0 1 ${x1.toFixed(2)},${y1.toFixed(2)} Z`;
}

function SegmentIcon({ seg, size }) {
    if (seg.chest) return <ChestArt chest={seg.chest} size={size * 1.1} />;
    if (seg.chip === 'cadeau') return <Text style={{ fontSize: size * 0.8 }}>🎁</Text>;
    return <Chip name={seg.chip} size={size} />;
}

function Wheel({ size, rotation }) {
    const r = size / 2;
    const style = useAnimatedStyle(() => ({ transform: [{ rotateZ: `${rotation.value}deg` }] }));
    return (
        <View style={{ width: size, height: size }}>
            <Animated.View style={[{ width: size, height: size }, style]}>
                <Svg width={size} height={size}>
                    <Circle cx={r} cy={r} r={r - 2} fill="#B8892B" />
                    {WHEEL.segments.map((s, i) => (
                        <Path key={s.id} d={slice(r, r, r - 10, i * STEP, (i + 1) * STEP)} fill={COLORS[i % 2]} stroke="#F5D77A" strokeWidth={2} />
                    ))}
                    <G>
                        {Array.from({ length: N * 2 }).map((_, i) => {
                            const a = (i * 180) / N;
                            const x = r + (r - 5) * Math.sin((a * Math.PI) / 180);
                            const y = r - (r - 5) * Math.cos((a * Math.PI) / 180);
                            return <Circle key={i} cx={x} cy={y} r={3.2} fill={i % 2 ? '#FFF3B0' : '#FDE68A'} />;
                        })}
                    </G>
                </Svg>
                {/* Lots : icône et texte, tournés avec leur case */}
                {WHEEL.segments.map((s, i) => {
                    const a = i * STEP + STEP / 2;
                    return (
                        <View key={s.id} pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', transform: [{ rotateZ: `${a}deg` }] }]}>
                            <View style={{ marginTop: size * 0.07, alignItems: 'center' }}>
                                <SegmentIcon seg={s} size={size * 0.13} />
                                <Text style={[styles.segText, { fontSize: Math.max(9, size * 0.034) }]} numberOfLines={2}>{s.binga ? `${s.binga}` : s.label.replace('Cosmétique ', '')}</Text>
                            </View>
                        </View>
                    );
                })}
            </Animated.View>
            {/* Moyeu et aiguille */}
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                <View style={[styles.hub, { width: size * 0.2, height: size * 0.2, borderRadius: size * 0.1 }]}>
                    <BingaIcon size={size * 0.17} />
                </View>
            </View>
            <View pointerEvents="none" style={[styles.pointerWrap, { left: r - 16 }]}>
                <Svg width={32} height={36}><Path d="M2 2 H30 L16 34 Z" fill="#F5D77A" stroke="#7A4A1C" strokeWidth={2} /></Svg>
            </View>
        </View>
    );
}

function Prize({ result }) {
    if (result.chest) {
        const it = result.chest.item;
        const rar = RARITIES[it.rarity];
        return (
            <>
                <ChestArt chest={result.chest.chest} size={90} open />
                <Text style={styles.prizeTitle}>{CHESTS[result.chest.chest].label} offert !</Text>
                <Text style={[styles.prizeRarity, { color: rar.color }]}>{rar.label}</Text>
                <Text style={styles.prizeItem}>{it.label}</Text>
                <Text style={styles.prizeSub}>{result.chest.duplicate ? `Tu l'avais déjà : +${result.chest.refund} binga` : 'Ajouté à ton Profil, pour toujours'}</Text>
            </>
        );
    }
    if (result.item) {
        const rar = RARITIES[result.item.rarity];
        return (
            <>
                <Text style={{ fontSize: 56 }}>🎁</Text>
                <Text style={styles.prizeTitle}>Cosmétique offert !</Text>
                <Text style={[styles.prizeRarity, { color: rar.color }]}>{rar.label}</Text>
                <Text style={styles.prizeItem}>{result.item.label}</Text>
                <Text style={styles.prizeSub}>Ajouté à ton Profil, pour toujours</Text>
            </>
        );
    }
    return (
        <>
            <BingaIcon size={72} />
            <Text style={styles.prizeTitle}>+{result.binga} binga</Text>
            <Text style={styles.prizeSub}>{result.duplicate ? 'Tu avais déjà tous les cosmétiques communs : voici des binga.' : 'Ajoutés à ton solde'}</Text>
        </>
    );
}

export default function WheelScreen({ navigation }) {
    const account = useAccount();
    const profile = account.profile;
    const { width, height } = useWindowDimensions();
    // Fond « cover » calculé ici (l'image fait 800 x 450)
    const k = Math.max(width / 800, height / 450);
    const size = Math.min(width - 48, 340);
    const rotation = useSharedValue(0);
    const [spinning, setSpinning] = useState(false);
    const [result, setResult] = useState(null);
    const available = !!profile?.wheel?.available;

    const ticks = React.useRef(null);
    const stopTicks = () => { if (ticks.current) clearTimeout(ticks.current); ticks.current = null; };
    // Un « tic » par case qui passe sous l'aiguille : rapide au début, de plus en plus lent
    const startTicks = (duration) => {
        stopTicks();
        const t0 = Date.now();
        const loop = () => {
            const k = (Date.now() - t0) / duration;
            if (k >= 1) return;
            audioService.playSound('wheel_tick');
            ticks.current = setTimeout(loop, 45 + 380 * k * k);
        };
        loop();
    };
    React.useEffect(() => stopTicks, []);

    const done = (r) => {
        stopTicks();
        setSpinning(false);
        setResult(r.result);
        audioService.playSound('wheel_win');
        setTimeout(() => audioService.playSound(r.result.chest ? 'chest_open' : r.result.item ? 'victory' : 'coins'), 350);
        haptic('success');
        accountService.applyProgress({ profile: r.profile });
    };

    const spin = async () => {
        if (!profile) {
            dialog.alert('Crée ton compte', 'La roue du jour est réservée aux comptes : tes lots sont gardés avec ton compte.', [
                { text: 'Plus tard', style: 'cancel' },
                { text: 'Aller au Profil', onPress: () => navigation.navigate('Profile') },
            ]);
            return;
        }
        if (socketService.serverInfo && !socketService.supports('wheel')) {
            dialog.alert('Bientôt', "Le serveur n'est pas encore à jour : la roue n'est pas disponible pour l'instant.");
            return;
        }
        if (spinning) return;
        setSpinning(true);
        setResult(null);
        audioService.playSound('card_draw');
        const r = await accountService.spinWheel();
        if (!r || r.error || !r.result) {
            setSpinning(false);
            audioService.playSound('error');
            dialog.alert('Roue du jour', r?.error || 'Réessaie dans un instant.');
            return;
        }
        // La case gagnante s'arrête sous l'aiguille (en haut), après 5 tours
        const target = 360 - (r.result.segment * STEP + STEP / 2) + (Math.random() - 0.5) * STEP * 0.6;
        const base = rotation.value - (rotation.value % 360);
        startTicks(2500);
        rotation.value = withTiming(base + 360 * 5 + target, { duration: 2600, easing: Easing.out(Easing.cubic) }, (fin) => {
            if (fin) runOnJS(done)(r);
        });
    };

    return (
        <View style={styles.container}>
            <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents="none">
                <Image source={DECOR.fondRoue} style={{ position: 'absolute', width: 800 * k, height: 450 * k, left: (width - 800 * k) / 2, top: (height - 450 * k) / 2 }} />
            </View>
            <View style={styles.dim} />
            <View style={styles.header}>
                <PressableScale style={styles.headBtn} onPress={() => navigation.goBack()}>
                    <Text style={styles.headBtnText}>⬅️ Retour</Text>
                </PressableScale>
                <Text style={styles.title}>🎡 Roue du jour</Text>
                <View style={styles.balance}>
                    <BingaIcon size={16} />
                    <Text style={styles.balanceText}>{profile ? (profile.binga?.balance ?? 0).toLocaleString('fr-FR') : '—'}</Text>
                </View>
            </View>
            <ScrollView contentContainerStyle={styles.scroll}>
                <Text style={styles.intro}>Un tour gratuit par jour, toujours un lot. La roue ne se paie jamais, ni en binga ni en argent.</Text>
                <View style={{ alignItems: 'center', marginVertical: 12 }}>
                    <Wheel size={size} rotation={rotation} />
                </View>
                {result ? (
                    <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.prize}>
                        <Prize result={result} />
                        <GameButton small title="Super !" onPress={() => setResult(null)} style={{ marginTop: 10 }} />
                    </Animated.View>
                ) : (
                    <View style={{ alignItems: 'center' }}>
                        <GameButton
                            title={spinning ? 'ÇA TOURNE…' : available || !profile ? 'TOURNER LA ROUE' : `PROCHAIN TOUR DANS ${untilTomorrow()}`}
                            icon="🎡"
                            onPress={spin}
                            disabled={spinning || (!!profile && !available)}
                        />
                        {!profile && <Text style={styles.note}>🔐 Crée ton compte pour tourner la roue chaque jour.</Text>}
                    </View>
                )}

                <View style={styles.odds}>
                    <Text style={styles.oddsTitle}>Chances de chaque lot</Text>
                    {WHEEL.segments.map((s) => (
                        <View key={s.id} style={styles.oddsRow}>
                            <View style={{ width: 30, alignItems: 'center' }}><SegmentIcon seg={s} size={22} /></View>
                            <Text style={styles.oddsLabel}>{s.label}</Text>
                            <View style={styles.oddsTrack}><View style={[styles.oddsFill, { width: `${s.odds * 4}%` }]} /></View>
                            <Text style={styles.oddsPct}>{s.odds} %</Text>
                        </View>
                    ))}
                    <Text style={styles.note}>Un coffre gagné s'ouvre tout de suite, gratuitement, avec ses propres chances (affichées dans la Boutique). Cosmétique déjà tous possédés : 20 binga.</Text>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    dim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,4,8,0.55)' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 44, paddingHorizontal: 14, paddingBottom: 8, backgroundColor: 'rgba(18,8,11,0.85)' },
    headBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, backgroundColor: 'rgba(212,175,55,0.15)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)' },
    headBtnText: { color: theme.goldLight, fontWeight: '800', fontSize: 13 },
    title: { color: theme.goldLight, fontSize: 20, fontWeight: '900' },
    balance: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: theme.gold },
    balanceText: { color: theme.goldLight, fontWeight: '900', fontSize: 13 },
    scroll: { padding: 14, paddingBottom: 40, maxWidth: 560, width: '100%', alignSelf: 'center' },
    intro: { color: theme.cream, fontSize: 12, fontWeight: '700', textAlign: 'center', backgroundColor: 'rgba(28,15,19,0.85)', borderRadius: 14, padding: 10 },
    segText: { color: '#FFF7D6', fontWeight: '900', textAlign: 'center', textShadowColor: '#000', textShadowRadius: 3, marginTop: 2, maxWidth: 70 },
    hub: { backgroundColor: '#5B2E12', borderWidth: 3, borderColor: '#F5D77A', alignItems: 'center', justifyContent: 'center' },
    pointerWrap: { position: 'absolute', top: -14 },
    prize: { alignItems: 'center', backgroundColor: 'rgba(28,15,19,0.95)', borderRadius: 18, borderWidth: 2, borderColor: theme.gold, padding: 16 },
    prizeTitle: { color: theme.goldLight, fontWeight: '900', fontSize: 22, marginTop: 6 },
    prizeRarity: { fontWeight: '900', fontSize: 13, textTransform: 'uppercase', marginTop: 4 },
    prizeItem: { color: theme.cream, fontWeight: '900', fontSize: 18 },
    prizeSub: { color: theme.mint, fontWeight: '800', fontSize: 12, marginTop: 4, textAlign: 'center' },
    note: { color: theme.textDim, fontSize: 11, marginTop: 8, textAlign: 'center' },
    odds: { marginTop: 16, backgroundColor: 'rgba(28,15,19,0.92)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', padding: 12 },
    oddsTitle: { color: theme.goldLight, fontWeight: '900', fontSize: 14, marginBottom: 6 },
    oddsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
    oddsLabel: { color: theme.cream, fontWeight: '800', fontSize: 12, width: 128 },
    oddsTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
    oddsFill: { height: '100%', backgroundColor: theme.gold },
    oddsPct: { width: 36, textAlign: 'right', color: theme.cream, fontWeight: '800', fontSize: 12 },
});
