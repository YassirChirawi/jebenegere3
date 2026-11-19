/**
 * Habillage « premium » des menus (bleu nuit, or, velours) : dégradés, panneaux dorés,
 * badge de niveau, barre d'XP, raccourcis et cartes de modes de jeu.
 * Tout est dessiné en SVG (react-native-svg) : net à toutes les tailles, rien à télécharger.
 */
import React, { useId } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect, Path, Polygon } from 'react-native-svg';
import { PressableScale } from './ui';
import Gradient from './Gradient';

export { Gradient };

export const LUXE = {
    night: '#0A1527',
    nightLight: '#16254A',
    nightDeep: '#060D1A',
    gold: '#E8B84A',
    goldLight: '#FFE08A',
    goldDark: '#9A6B16',
    cream: '#FFF3D6',
    dim: '#AFB8CF',
    velvet: '#7A1420',
    velvetDark: '#3E0A12',
};

// Couleurs des cartes de modes (haut, bas)
export const MODE_COLORS = {
    red: ['#C3283A', '#5E0B16'],
    blue: ['#2D5BC8', '#0E2463'],
    purple: ['#8A3BC9', '#3A1166'],
    green: ['#1F9A55', '#0A4A26'],
};

const ICONS = {
    laurel: require('../../assets/ui/laurel_frame.webp'),
    trophy: require('../../assets/ui/trophy.webp'),
    logo: require('../../assets/ui/logo_banner.webp'),
    arch: require('../../assets/ui/arch_corner.webp'),
    scene: require('../../assets/ui/scene_bottom.webp'),
};
export const LUXE_IMG = ICONS;

const cleanId = (id) => String(id).replace(/[^a-zA-Z0-9_-]/g, '');

/** Lueur douce (halo radial), pour le fond de la page. */
export function Glow({ color = '#2B4C9A', style }) {
    const id = `r${cleanId(useId())}`;
    return (
        <Svg style={[StyleSheet.absoluteFill, style]} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100" pointerEvents="none">
            <Defs>
                <RadialGradient id={id} cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
                    <Stop offset="0" stopColor={color} stopOpacity="0.55" />
                    <Stop offset="1" stopColor={color} stopOpacity="0" />
                </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100" height="100" fill={`url(#${id})`} />
        </Svg>
    );
}

/** Panneau bleu nuit à double filet doré. */
export function LuxePanel({ children, style, colors = ['#18264A', '#0B1530'], inner = true }) {
    return (
        <View style={[styles.panel, style]}>
            <Gradient colors={colors} />
            {inner && <View style={styles.panelInner} pointerEvents="none" />}
            {children}
        </View>
    );
}

/** Badge de niveau hexagonal (or, fond rouge). */
export function LevelBadge({ level, size = 46 }) {
    const id = `h${cleanId(useId())}`;
    return (
        <View style={{ width: size, height: size * 1.1, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={size} height={size * 1.1} viewBox="0 0 100 110" style={StyleSheet.absoluteFill}>
                <Defs>
                    <LinearGradient id={`${id}o`} x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={LUXE.goldLight} />
                        <Stop offset="0.5" stopColor={LUXE.gold} />
                        <Stop offset="1" stopColor={LUXE.goldDark} />
                    </LinearGradient>
                    <LinearGradient id={`${id}r`} x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor="#A3202E" />
                        <Stop offset="1" stopColor="#4A0911" />
                    </LinearGradient>
                </Defs>
                <Polygon points="50,2 96,28 96,82 50,108 4,82 4,28" fill={`url(#${id}o)`} />
                <Polygon points="50,11 88,33 88,77 50,99 12,77 12,33" fill={`url(#${id}r)`} />
            </Svg>
            <Text style={[styles.lvSmall, { fontSize: size * 0.2 }]}>Niv.</Text>
            <Text style={[styles.lvNum, { fontSize: size * (String(level).length > 2 ? 0.3 : 0.38) }]}>{level}</Text>
        </View>
    );
}

/** Barre d'XP dorée. */
export function XpBar({ progress = 0, height = 14, style }) {
    const p = Math.max(0, Math.min(1, progress));
    return (
        <View style={[styles.xpTrack, { height, borderRadius: height / 2 }, style]}>
            <View style={{ width: `${Math.round(p * 100)}%`, height: '100%', borderRadius: height / 2, overflow: 'hidden' }}>
                <Gradient colors={['#FFE89A', '#F2B63A', '#C98A12']} />
                <View style={styles.xpShine} />
            </View>
        </View>
    );
}

/** Portrait dans le cadre de lauriers (couronne en haut, médaille marocaine en bas). */
export function LaurelPortrait({ children, size = 120 }) {
    // Le trou du cadre fait 74 % de la largeur ; le portrait est centré un peu au-dessus du milieu
    const hole = size * 0.74;
    return (
        <View style={{ width: size, height: size * 1.017 }}>
            <View style={{ position: 'absolute', left: (size - hole) / 2, top: size * 0.5 - hole / 2 - size * 0.006, width: hole, height: hole, borderRadius: hole / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: LUXE.nightDeep }}>
                {children}
            </View>
            <Image source={ICONS.laurel} style={{ position: 'absolute', width: size, height: size * 1.017 }} pointerEvents="none" />
        </View>
    );
}

/** Raccourci carré (icône + libellé), pastille rouge si quelque chose attend le joueur. */
export function QuickTile({ icon, label, sub, onPress, badge, disabled, compact }) {
    return (
        <PressableScale onPress={onPress} disabled={disabled} style={styles.tile} accessibilityLabel={label}>
            <Gradient colors={['#1D2C55', '#0C1632']} />
            <View style={styles.tileInner} pointerEvents="none" />
            <Image source={icon} style={styles.tileIcon} resizeMode="contain" />
            <Text style={[styles.tileLabel, compact && { fontSize: 10.5 }]} numberOfLines={1}>{label}</Text>
            {sub ? <Text style={styles.tileSub} numberOfLines={1}>{sub}</Text> : null}
            {badge ? <View style={styles.dot} /> : null}
        </PressableScale>
    );
}

// Bouclier hexagonal (coins du haut coupés, pointe en bas) : viewBox 100 x 124
const SHIELD = 'M14,2 H86 L98,16 V96 L50,122 L2,96 V16 Z';
const SHIELD_IN = 'M16,7 H84 L93,18 V93 L50,116 L7,93 V18 Z';

/** Carte de mode de jeu (bouclier coloré, icône, nom, bouton ▶). */
export function ModeCard({ icon, label, sub, colors, onPress, disabled, width }) {
    const id = `m${cleanId(useId())}`;
    const h = width * 1.24;
    return (
        <PressableScale onPress={onPress} disabled={disabled} style={{ width, height: h, alignItems: 'center' }} accessibilityLabel={label} scaleTo={0.93}>
            <Svg width={width} height={h} viewBox="0 0 100 124" style={StyleSheet.absoluteFill}>
                <Defs>
                    <LinearGradient id={`${id}o`} x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={LUXE.goldLight} />
                        <Stop offset="0.45" stopColor={LUXE.gold} />
                        <Stop offset="1" stopColor={LUXE.goldDark} />
                    </LinearGradient>
                    <LinearGradient id={`${id}c`} x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={colors[0]} />
                        <Stop offset="1" stopColor={colors[1]} />
                    </LinearGradient>
                    <RadialGradient id={`${id}l`} cx="50" cy="38" r="46" gradientUnits="userSpaceOnUse">
                        <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.28" />
                        <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
                    </RadialGradient>
                </Defs>
                <Path d={SHIELD} fill={`url(#${id}o)`} />
                <Path d={SHIELD_IN} fill={`url(#${id}c)`} />
                <Path d={SHIELD_IN} fill={`url(#${id}l)`} />
            </Svg>
            <Image source={icon} style={{ width: width * 0.78, height: width * 0.5, marginTop: width * 0.09 }} resizeMode="contain" />
            <Text style={[styles.modeLabel, { fontSize: Math.max(11, Math.min(16, width * 0.14)) }]} numberOfLines={1}>{label}</Text>
            {sub ? <Text style={[styles.modeSub, { fontSize: Math.max(9, Math.min(12, width * 0.1)) }]} numberOfLines={1}>{sub}</Text> : null}
            {/* bouton ▶ posé sur la pointe du bouclier */}
            <View style={[styles.playPill, { position: 'absolute', top: h * 0.79, width: width * 0.44, height: width * 0.2, borderRadius: width * 0.1 }]}>
                <Gradient colors={['#F0524B', '#8E121B']} />
                {/* (dans une View : sur le web, un SVG seul passerait sous le dégradé) */}
                <View style={{ marginLeft: 2 }}>
                    <Svg width={Math.max(9, width * 0.1)} height={Math.max(10, width * 0.11)} viewBox="0 0 10 11"><Path d="M1,0.5 L9.5,5.5 L1,10.5 Z" fill={LUXE.goldLight} /></Svg>
                </View>
            </View>
        </PressableScale>
    );
}

/** Titre en ruban doré (« Modes de jeu »). */
export function RibbonTitle({ title, style }) {
    return (
        <View style={[styles.ribbonRow, style]}>
            <View style={styles.ribbonDiamond} />
            <View style={styles.ribbon}>
                <Gradient colors={['#5A1A14', '#2A0A08']} />
                <Text style={styles.ribbonText}>{title}</Text>
            </View>
            <View style={styles.ribbonDiamond} />
        </View>
    );
}

/** Bouton carré doré de l'en-tête (son, musique…). */
export function GoldSquare({ children, onPress, label, style, badge }) {
    return (
        <PressableScale onPress={onPress} style={[styles.square, style]} accessibilityLabel={label} scaleTo={0.88}>
            <Gradient colors={['#3B1A12', '#1A0906']} />
            {children}
            {badge ? <View style={[styles.dot, { top: 2, right: 2, width: 11, height: 11 }]} /> : null}
        </PressableScale>
    );
}

/** Fond des écrans de menu : dégradé bleu nuit et halo. */
export function LuxeBackdrop() {
    return (
        <>
            <Gradient colors={['#12234A', LUXE.night, '#060C18']} />
            <Glow color="#2A4D9C" style={{ height: 420 }} />
        </>
    );
}

/** En-tête d'écran : bouton retour, titre doré, élément à droite (solde de binga…). */
export function ScreenHeader({ title, onBack, right }) {
    return (
        <View style={styles.sh}>
            {onBack ? (
                <PressableScale onPress={onBack} style={styles.shBack} accessibilityLabel="Retour">
                    <Text style={styles.shBackText}>‹</Text>
                </PressableScale>
            ) : <View style={{ width: 40 }} />}
            <Text style={styles.shTitle} numberOfLines={1}>{title}</Text>
            {right || <View style={{ width: 40 }} />}
        </View>
    );
}

/** Solde de binga (pastille dorée). */
export function BingaPill({ amount, icon }) {
    return (
        <View style={styles.pill}>
            {icon}
            <Text style={styles.pillText}>{amount}</Text>
        </View>
    );
}

/** Bandeau rouge en tête d'une section (icône, titre, texte à droite). */
export function SectionHead({ icon, emoji, title, right }) {
    return (
        <View style={styles.head}>
            <Gradient colors={['#8E1624', '#4A0912']} horizontal />
            {icon ? <Image source={icon} style={styles.headIcon} resizeMode="contain" /> : null}
            {emoji ? <Text style={styles.headEmoji}>{emoji}</Text> : null}
            <Text style={styles.headTitle} numberOfLines={1}>{title}</Text>
            {right ? (typeof right === 'string' ? <Text style={styles.headRight}>{right}</Text> : right) : null}
        </View>
    );
}

const goldEdge = { borderWidth: 1.5, borderColor: LUXE.gold };

const styles = StyleSheet.create({
    panel: { ...goldEdge, borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
    panelInner: { position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(232,184,74,0.28)' },
    lvSmall: { color: LUXE.goldLight, fontWeight: '800', marginBottom: -3 },
    lvNum: { color: LUXE.cream, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
    xpTrack: { backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1.5, borderColor: 'rgba(232,184,74,0.7)', overflow: 'hidden', padding: 1.5 },
    xpShine: { position: 'absolute', top: 1, left: 4, right: 4, height: '35%', borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.45)' },
    tile: { flex: 1, aspectRatio: 0.98, borderRadius: 18, ...goldEdge, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
    tileInner: { position: 'absolute', top: 3, left: 3, right: 3, bottom: 3, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(232,184,74,0.25)' },
    tileIcon: { width: '74%', height: '50%' },
    tileLabel: { color: LUXE.cream, fontWeight: '900', fontSize: 12, marginTop: 4, textShadowColor: '#000', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
    tileSub: { color: LUXE.goldLight, fontWeight: '700', fontSize: 10, marginTop: 1 },
    dot: { position: 'absolute', top: 6, right: 6, width: 14, height: 14, borderRadius: 7, backgroundColor: '#E5262E', borderWidth: 2, borderColor: '#FFD5A0' },
    modeLabel: { color: '#FFFFFF', fontWeight: '900', marginTop: 2, textShadowColor: 'rgba(0,0,0,0.75)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 2 } },
    modeSub: { color: LUXE.goldLight, fontWeight: '800' },
    playPill: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1.5, borderColor: LUXE.goldLight },
    ribbonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
    ribbon: { paddingHorizontal: 26, paddingVertical: 6, borderRadius: 22, overflow: 'hidden', borderWidth: 2, borderColor: LUXE.gold, marginHorizontal: 6 },
    ribbonText: { color: LUXE.goldLight, fontWeight: '900', fontSize: 19, letterSpacing: 0.5, textShadowColor: '#000', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
    ribbonDiamond: { width: 10, height: 10, backgroundColor: '#D0283A', borderWidth: 1.5, borderColor: LUXE.goldLight, transform: [{ rotate: '45deg' }] },
    sh: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 14, paddingBottom: 6, gap: 8 },
    shBack: { width: 40, height: 40, borderRadius: 12, borderWidth: 1.5, borderColor: LUXE.gold, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
    shBackText: { color: LUXE.goldLight, fontSize: 28, fontWeight: '900', marginTop: -4 },
    shTitle: { flex: 1, textAlign: 'center', color: LUXE.goldLight, fontSize: 24, fontWeight: '900', textShadowColor: '#000', textShadowRadius: 4, textShadowOffset: { width: 0, height: 2 } },
    pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: LUXE.gold, backgroundColor: 'rgba(0,0,0,0.4)' },
    pillText: { color: LUXE.cream, fontWeight: '900', fontSize: 15 },
    head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 8, borderBottomWidth: 1.5, borderBottomColor: LUXE.gold, overflow: 'hidden' },
    headIcon: { width: 30, height: 28 },
    headEmoji: { fontSize: 20 },
    headTitle: { color: LUXE.goldLight, fontWeight: '900', fontSize: 17, flex: 1, textShadowColor: '#000', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
    headRight: { color: LUXE.cream, fontWeight: '800', fontSize: 11 },
    square: { width: 42, height: 42, borderRadius: 12, ...goldEdge, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});
