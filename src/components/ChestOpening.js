/**
 * Coffres : dessin vectoriel (Bronze, Argent, Or) et animation d'ouverture.
 * L'animation dure moins de 3 secondes : le coffre tremble pendant que le serveur tire le lot,
 * puis s'ouvre et le cosmétique apparaît avec son nom et sa rareté.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, Image } from 'react-native';
import PlayerAvatar from './PlayerAvatar';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, withSpring, ZoomIn, FadeIn, cancelAnimation } from 'react-native-reanimated';
import Svg, { Path, Rect, Circle, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import { CardBack } from './Card';
import ReactionGlyph from './ReactionGlyph';
import { GameButton, theme, haptic } from './ui';
import audioService from '../network/audioService';
import { BACKS, FELTS, TABLE_SKINS } from '../utils/cosmetics';
import { CHESTS, RARITIES } from '../../server/progress/defs';
import { t } from '../i18n';

const EFFECT_ICONS = { confettis: '🎉', etoiles: '⭐', menthe: '🌿', feu: '🔥', tonnerre: '⚡', or: '💰' };
const DARK = { bronze: '#7A4A1C', argent: '#6B7280', or: '#A67C1A' };

export function ChestArt({ chest, size = 90, open = false }) {
    const c = CHESTS[chest]?.color || '#CD7F32';
    const d = DARK[chest] || '#555';
    const gid = `chest-${chest}`;
    return (
        <Svg width={size} height={size * 0.9} viewBox="0 0 100 90">
            <Defs>
                <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={c} />
                    <Stop offset="1" stopColor={d} />
                </LinearGradient>
            </Defs>
            {/* Corps */}
            <Rect x={10} y={42} width={80} height={44} rx={5} fill="#5B2E12" stroke={d} strokeWidth={2} />
            <Rect x={10} y={42} width={80} height={44} rx={5} fill={`url(#${gid})`} opacity={0.55} />
            <Rect x={22} y={42} width={8} height={44} fill={c} />
            <Rect x={70} y={42} width={8} height={44} fill={c} />
            <Rect x={10} y={56} width={80} height={5} fill={d} opacity={0.6} />
            {/* Couvercle : fermé, ou ouvert (basculé vers l'arrière) avec la lumière */}
            {open ? (
                <G>
                    <Path d="M14 40 L86 40 L80 14 L20 14 Z" fill="#2A1206" />
                    <Path d="M20 40 L80 40 L96 0 L4 0 Z" fill="#FFF3B0" opacity={0.35} />
                    <Path d="M12 18 Q 50 -2 88 18 L 86 26 L 14 26 Z" fill="#5B2E12" stroke={d} strokeWidth={2} />
                </G>
            ) : (
                <G>
                    <Path d="M10 44 L10 30 Q 50 6 90 30 L90 44 Z" fill="#5B2E12" stroke={d} strokeWidth={2} />
                    <Path d="M10 44 L10 30 Q 50 6 90 30 L90 44 Z" fill={`url(#${gid})`} opacity={0.6} />
                    <Path d="M22 44 L22 22 L30 19 L30 44 Z" fill={c} />
                    <Path d="M70 44 L70 19 L78 22 L78 44 Z" fill={c} />
                </G>
            )}
            {/* Serrure */}
            <Rect x={42} y={38} width={16} height={16} rx={3} fill={c} stroke={d} strokeWidth={1.5} />
            <Circle cx={50} cy={45} r={2.6} fill={d} />
            <Rect x={49} y={46} width={2} height={5} fill={d} />
        </Svg>
    );
}

function ItemVisual({ item }) {
    const k = item.id.split(':').pop();
    if (item.kind === 'back') return <CardBack width={74} height={108} palette={BACKS[k]} />;
    if (item.kind === 'emote') return <ReactionGlyph type={item.id} size={46} textColor={theme.cream} />;
    if (item.kind === 'effect') return <Text style={{ fontSize: 64 }}>{EFFECT_ICONS[k]}</Text>;
    if (item.kind === 'table') return <Image source={TABLE_SKINS[k]?.src} style={{ width: 210, height: 69, borderRadius: 10 }} resizeMode="cover" />;
    if (item.kind === 'avatar') return <PlayerAvatar name="?" variant={Number(k)} size={100} />;
    if (item.kind === 'felt') {
        const game = item.id.split(':')[1];
        const f = (FELTS[game] || []).find((x) => x.id === k);
        return <View style={[styles.swatch, { backgroundColor: f?.color || '#333' }]} />;
    }
    return null;
}

const KIND = { back: 'Dos de cartes', effect: 'Effet de victoire', emote: 'Réaction', felt: 'Couleur de tapis', table: 'Table', avatar: 'Portrait' };

/**
 * open : promesse qui renvoie la réponse du serveur ({ result, profile } ou { error }).
 * Le coffre tremble jusqu'à la réponse (au moins 0,9 s), puis s'ouvre.
 */
export default function ChestOpening({ chest, request, onClose, onUse }) {
    const [phase, setPhase] = useState('shake'); // shake → open → done
    const [res, setRes] = useState(null);
    const rot = useSharedValue(0);
    const scale = useSharedValue(1);

    useEffect(() => {
        if (!chest) return undefined;
        setPhase('shake');
        setRes(null);
        audioService.playSound('card_draw');
        rot.value = withRepeat(withSequence(withTiming(-7, { duration: 70 }), withTiming(7, { duration: 70 })), -1, true);
        const minWait = new Promise((r) => setTimeout(r, 900));
        let alive = true;
        Promise.all([request(), minWait]).then(([r]) => {
            if (!alive) return;
            cancelAnimation(rot);
            rot.value = withTiming(0, { duration: 80 });
            if (!r || r.error || !r.result) {
                setRes({ error: r?.error || t('Réessaie dans un instant.') });
                setPhase('done');
                audioService.playSound('error');
                return;
            }
            setRes(r);
            setPhase('open');
            scale.value = withSequence(withTiming(1.18, { duration: 120 }), withSpring(1));
            audioService.playSound('chest_open');
            if (r.result.item.rarity === 'legendaire' || r.result.item.rarity === 'epique') setTimeout(() => audioService.playSound('victory'), 450);
            else if (r.result.duplicate) setTimeout(() => audioService.playSound('coins'), 450);
            haptic(r.result.item.rarity === 'legendaire' ? 'double' : 'success');
            setTimeout(() => alive && setPhase('done'), 700);
        });
        return () => { alive = false; cancelAnimation(rot); };
    }, [chest]);

    const chestStyle = useAnimatedStyle(() => ({ transform: [{ rotateZ: `${rot.value}deg` }, { scale: scale.value }] }));
    if (!chest) return null;
    const item = res?.result?.item;
    const rarity = item ? RARITIES[item.rarity] : null;

    return (
        <Modal visible transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={[styles.box, rarity && { borderColor: rarity.color }]}>
                    <Text style={styles.title}>{CHESTS[chest].label}</Text>
                    <Animated.View style={chestStyle}>
                        <ChestArt chest={chest} size={130} open={phase !== 'shake' && !res?.error} />
                    </Animated.View>
                    {phase !== 'shake' && item && (
                        <Animated.View entering={ZoomIn.springify().damping(12)} style={[styles.reveal, { shadowColor: rarity.color }]}>
                            <View style={[styles.glow, { backgroundColor: `${rarity.color}33`, borderColor: rarity.color }]}>
                                <ItemVisual item={item} />
                            </View>
                            <Text style={[styles.rarity, { color: rarity.color }]}>{rarity.label}{res.result.pity ? t(' · garanti') : ''}</Text>
                            <Text style={styles.itemName}>{item.label}</Text>
                            <Text style={styles.kind}>{t(KIND[item.kind])}</Text>
                            {res.result.duplicate
                                ? <Text style={styles.dup}>{t("Tu l'avais déjà : +")}{res.result.refund} {t("binga (20 %)")}</Text>
                                : <Text style={styles.added}>{t("Ajouté à ton Profil, pour toujours")}</Text>}
                        </Animated.View>
                    )}
                    {phase === 'shake' && <Text style={styles.wait}>{t("Ouverture…")}</Text>}
                    {res?.error && <Text style={styles.error}>{res.error}</Text>}
                    {phase === 'done' && (
                        <Animated.View entering={FadeIn.duration(200)} style={styles.buttons}>
                            {item && !res.result.duplicate && ['back', 'effect', 'felt', 'table', 'avatar'].includes(item.kind) && onUse && (
                                <GameButton small title={t("Utiliser")} variant="outline" onPress={() => { onUse(item); onClose(); }} />
                            )}
                            <GameButton small title={item ? t('Super !') : t('Fermer')} onPress={onClose} />
                        </Animated.View>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 16 },
    box: { width: '100%', maxWidth: 360, alignItems: 'center', backgroundColor: theme.panelSolid, borderRadius: 22, borderWidth: 2, borderColor: theme.gold, padding: 18 },
    title: { color: theme.goldLight, fontSize: 18, fontWeight: '900', marginBottom: 8 },
    reveal: { alignItems: 'center', marginTop: 6, shadowOpacity: 0.9, shadowRadius: 18 },
    glow: { padding: 12, borderRadius: 18, borderWidth: 2, minWidth: 120, minHeight: 120, alignItems: 'center', justifyContent: 'center' },
    rarity: { fontWeight: '900', fontSize: 14, marginTop: 8, textTransform: 'uppercase', letterSpacing: 1 },
    itemName: { color: theme.cream, fontWeight: '900', fontSize: 20, marginTop: 2 },
    kind: { color: theme.textDim, fontSize: 12 },
    added: { color: theme.mint, fontWeight: '800', fontSize: 12, marginTop: 6 },
    dup: { color: theme.goldLight, fontWeight: '800', fontSize: 12, marginTop: 6 },
    wait: { color: theme.textDim, marginTop: 10, fontWeight: '800' },
    error: { color: '#F87171', marginTop: 10, fontWeight: '800', textAlign: 'center' },
    buttons: { flexDirection: 'row', gap: 10, marginTop: 14 },
    swatch: { width: 90, height: 90, borderRadius: 45, borderWidth: 2, borderColor: '#C9A23A' },
});
