/**
 * Cadre commun des écrans de menu (Collection, Récompenses, Missions, Profil, Amis, Classement, Tournois…).
 * - Téléphone (portrait) : en-tête (retour, titre, right), contenu, barre de navigation en bas.
 * - Ordinateur, tablette ou téléphone tenu en paysage : l'écran prend toute la largeur de la fenêtre,
 *   barre du haut (retour, titre, wideRight, binga, diamants, cloche), navigation dans une colonne à gauche,
 *   contenu à droite. Les écrans lisent useMenuLayout() pour passer en colonnes ou en grille.
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, useWindowDimensions } from 'react-native';
import AppNav, { useLandscape } from './AppNav';
import { LUXE, LUXE_IMG, LuxeBackdrop, ScreenHeader } from './Luxe';
import { PressableScale } from './ui';
import Gradient from './Gradient';
import InboxBell from './InboxBell';
import { BingaIcon } from './Decor';
import { useAccount } from '../network/accountService';
import { setWideFrame } from '../utils/frame';
import { t } from '../i18n';

/**
 * { wide, contentW } : wide = mise en page large ; contentW = largeur utile du contenu (px).
 * Calculé depuis la fenêtre : utilisable dans l'écran lui-même (autour de MenuShell).
 */
export function useMenuLayout() {
    const wide = useLandscape();
    const { width: winW } = useWindowDimensions();
    if (!wide) return { wide, contentW: Math.min(winW, 560) - 28 };
    return { wide, contentW: Math.min(1180, winW - sideWidth(winW) - 16 * 2 - 12) - 28 };
}

/** Largeur de la colonne de navigation selon la fenêtre. */
export function sideWidth(winW) {
    return winW >= 1100 ? 210 : 176;
}

/** Tant que l'écran est affiché (et large), le cadre de l'appli prend toute la fenêtre. */
export function useWideFrameWhile(navigation, on) {
    useEffect(() => {
        const apply = () => setWideFrame(on);
        apply();
        const offFocus = navigation.addListener('focus', apply);
        const offBlur = navigation.addListener('blur', () => setWideFrame(false));
        return () => { offFocus(); offBlur(); setWideFrame(false); };
    }, [on, navigation]);
}

/** Colonnes côte à côte en mise en page large (flex : largeur relative de chaque colonne), à la suite sur téléphone. */
export function Cols({ children, flex, gap = 14, style }) {
    const { wide } = useMenuLayout();
    const items = React.Children.toArray(children).filter(Boolean);
    if (!wide) return <>{items}</>; // téléphone : rien ne change, les blocs restent à la suite
    return (
        <View style={[{ flexDirection: 'row', alignItems: 'flex-start', gap }, style]}>
            {items.map((c, i) => <View key={i} style={{ flex: flex?.[i] ?? 1, minWidth: 0, gap }}>{c}</View>)}
        </View>
    );
}

/** Nombre d'éléments par ligne et largeur de chacun, pour une grille qui remplit width. */
export function gridItem(width, minItem, gap = 10, max = 8) {
    const n = Math.max(1, Math.min(max, Math.floor((width + gap) / (minItem + gap))));
    return { n, w: Math.floor((width - gap * (n - 1)) / n) };
}

function Wallet() {
    const { profile } = useAccount();
    if (!profile) return null;
    return (
        <>
            <View style={styles.pill} accessibilityLabel={t('Binga')}>
                <BingaIcon size={22} />
                <Text style={styles.pillText}>{(profile.binga?.balance ?? 0).toLocaleString('fr-FR')}</Text>
            </View>
            <View style={[styles.pill, { borderColor: '#F17A86' }]} accessibilityLabel={t('Diamants')}>
                <Text style={{ fontSize: 16 }}>💎</Text>
                <Text style={styles.pillText}>{(profile.diamonds?.balance ?? 0).toLocaleString('fr-FR')}</Text>
            </View>
        </>
    );
}

export default function MenuShell({ navigation, current = null, title, onBack, right, wideRight, background, overlay, bottomNav = !!current, children }) {
    const wide = useLandscape();
    const { width: winW, height: winH } = useWindowDimensions();
    useWideFrameWhile(navigation, wide);
    const back = onBack || (() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home')));

    if (!wide) {
        return (
            <View style={styles.container}>
                {background || <LuxeBackdrop />}
                <ScreenHeader title={title} onBack={back} right={right} />
                <View style={{ flex: 1 }}>{children}</View>
                {bottomNav && <AppNav navigation={navigation} current={current} />}
                {overlay}
            </View>
        );
    }

    const sideW = sideWidth(winW);
    const short = winH < 520; // téléphone tenu en paysage
    return (
        <View style={styles.container}>
            {background || <LuxeBackdrop />}
            <Image source={LUXE_IMG.arch} style={[styles.arch, { left: -18 }]} pointerEvents="none" />
            <Image source={LUXE_IMG.arch} style={[styles.arch, { right: -18, transform: [{ scaleX: -1 }] }]} pointerEvents="none" />
            <View style={[styles.top, short && { paddingTop: 6, height: 52 }]}>
                <PressableScale onPress={back} style={styles.back} accessibilityLabel={t('Retour')} scaleTo={0.9}>
                    <Gradient colors={['#C42634', '#5E0B15']} />
                    <Text style={styles.backText}>‹</Text>
                </PressableScale>
                <Text style={[styles.title, short && { fontSize: 20 }]} numberOfLines={1}>{title}</Text>
                <View style={{ flex: 1 }} />
                <View style={styles.topRight}>
                    {wideRight}
                    <Wallet />
                    <InboxBell navigation={navigation} onJoinRoom={(code) => navigation.navigate('Home', { invite: code, inviteAt: Date.now() })} />
                </View>
            </View>
            <View style={styles.body}>
                <ScrollView style={{ width: sideW, flexGrow: 0 }} showsVerticalScrollIndicator={false}>
                    <AppNav navigation={navigation} current={current} side />
                </ScrollView>
                <View style={styles.content}>
                    {children}
                </View>
            </View>
            {overlay}
        </View>
    );
}

/** Style du contenu défilant : centré, 560 px sur téléphone, plus large sur grand écran. */
export function useScrollStyle(base) {
    const { wide } = useMenuLayout();
    return [base, wide && { maxWidth: 1180, paddingTop: 6 }];
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: LUXE.night },
    arch: { position: 'absolute', top: -18, width: 132, height: 120 },
    top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 12, height: 68 },
    back: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1.5, borderColor: '#FFE08A' },
    backText: { color: '#FFF3D6', fontSize: 30, fontWeight: '900', lineHeight: 32, marginTop: -3 },
    title: { color: LUXE.goldLight, fontSize: 26, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 6, flexShrink: 1 },
    topRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    pill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1.5, borderColor: LUXE.gold, backgroundColor: 'rgba(0,0,0,0.45)' },
    pillText: { color: LUXE.cream, fontWeight: '900', fontSize: 15 },
    body: { flex: 1, flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
    content: { flex: 1, minWidth: 0 },
});
