/**
 * Navigation principale des menus : Accueil, Collection, Récompenses, Missions, Profil.
 * - portrait : barre en bas de l'écran (l'onglet ouvert est en relief rouge) ;
 * - paysage (« side ») : colonne à gauche, avec le Classement en plus.
 * Pastilles rouges : tour de roue gratuit (Récompenses), mission ou défi du jour pas fini (Missions).
 */
import React, { useContext } from 'react';
import { View, Text, StyleSheet, Image, useWindowDimensions } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { PressableScale } from './ui';
import Gradient from './Gradient';
import { useAccount } from '../network/accountService';
import { useFriends } from '../network/friendsService';

const GOLD = '#E8B84A';

export const NAV_TABS = [
    { key: 'home', route: 'Home', label: 'Accueil', icon: require('../../assets/ui/nav_accueil.webp') },
    { key: 'collection', route: 'Shop', label: 'Collection', icon: require('../../assets/ui/nav_collection.webp') },
    { key: 'rewards', route: 'Wheel', label: 'Récompenses', icon: require('../../assets/ui/nav_recompenses.webp') },
    { key: 'missions', route: 'Missions', label: 'Missions', icon: require('../../assets/ui/nav_missions.webp') },
    { key: 'rank', route: 'Leaderboard', label: 'Classement', icon: require('../../assets/ui/tile_classement.webp'), sideOnly: true },
    { key: 'friends', route: 'Friends', label: 'Amis', icon: require('../../assets/ui/mode_salon.webp'), sideOnly: true },
    { key: 'profile', route: 'Profile', label: 'Profil', icon: require('../../assets/ui/nav_profil.webp') },
];

/** Écran large tenu en paysage (tablette, ordinateur, téléphone tourné) : mise en page en colonnes. */
export function useLandscape() {
    const { width, height } = useWindowDimensions();
    return width > height && width >= 700;
}

function badges(profile) {
    if (!profile) return {};
    const missionsLeft = (profile.binga?.missions || []).some((m) => !m.done) || (profile.daily?.list || []).some((c) => !c.done);
    return { rewards: !!profile.wheel?.available, missions: missionsLeft };
}

export default function AppNav({ navigation, current, side = false, style }) {
    const insets = useContext(SafeAreaInsetsContext) || { bottom: 0 }; // (pas d'erreur sans fournisseur)
    const { profile } = useAccount();
    const fr = useFriends();
    const dots = { ...badges(profile), friends: fr.incoming.length > 0 };
    const go = (tab) => {
        if (tab.key === current) return;
        if (tab.route === 'Home') navigation.popToTop();
        else navigation.navigate(tab.route);
    };
    const tabs = NAV_TABS.filter((t) => side || !t.sideOnly);

    if (side) {
        return (
            <View style={[styles.side, style]}>
                <Gradient colors={['#17264A', '#0A1430']} />
                {tabs.map((t) => {
                    const on = t.key === current;
                    return (
                        <PressableScale key={t.key} onPress={() => go(t)} style={[styles.sideItem, on && styles.sideOn]} accessibilityLabel={t.label} accessibilityState={{ selected: on }} scaleTo={0.95}>
                            {on && <Gradient colors={['#B3202E', '#5A0A13']} />}
                            <Image source={t.icon} style={styles.sideIcon} resizeMode="contain" />
                            <Text style={[styles.sideLabel, on && { color: '#FFF3D6' }]} numberOfLines={1}>{t.label}</Text>
                            {dots[t.key] ? <View style={styles.dotSide} /> : null}
                        </PressableScale>
                    );
                })}
            </View>
        );
    }

    return (
        <View style={[styles.bar, { paddingBottom: Math.max(6, insets.bottom) }, style]}>
            <Gradient colors={['#16244A', '#08112A']} />
            {tabs.map((t) => {
                const on = t.key === current;
                return (
                    <PressableScale key={t.key} onPress={() => go(t)} style={[styles.tab, on && styles.tabOn]} accessibilityLabel={t.label} accessibilityState={{ selected: on }} scaleTo={0.9}>
                        {on && <Gradient colors={['#C42634', '#5E0B15']} />}
                        <Image source={t.icon} style={[styles.icon, on && styles.iconOn]} resizeMode="contain" />
                        <Text style={[styles.label, on && styles.labelOn]} numberOfLines={1}>{t.label}</Text>
                        {dots[t.key] ? <View style={styles.dot} /> : null}
                    </PressableScale>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    bar: { flexDirection: 'row', alignItems: 'flex-end', paddingTop: 6, paddingHorizontal: 4, borderTopWidth: 1.5, borderTopColor: GOLD, overflow: 'visible' },
    tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 5, marginHorizontal: 2, borderRadius: 14, overflow: 'hidden' },
    tabOn: { borderWidth: 1.5, borderColor: '#FFE08A', marginTop: -14, paddingVertical: 8 },
    icon: { width: 28, height: 26 },
    iconOn: { width: 32, height: 30 },
    label: { color: '#C9D0E2', fontWeight: '800', fontSize: 10, marginTop: 2 },
    labelOn: { color: '#FFF3D6', fontWeight: '900' },
    dot: { position: 'absolute', top: 3, right: '24%', width: 10, height: 10, borderRadius: 5, backgroundColor: '#E5262E', borderWidth: 1.5, borderColor: '#FFD5A0' },
    side: { borderRadius: 18, borderWidth: 1.5, borderColor: GOLD, overflow: 'hidden', paddingVertical: 6, paddingHorizontal: 6, gap: 2 },
    sideItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 14, overflow: 'hidden' },
    sideOn: { borderWidth: 1.5, borderColor: '#FFE08A' },
    sideIcon: { width: 30, height: 28 },
    sideLabel: { color: '#E9DFC6', fontWeight: '900', fontSize: 14, flexShrink: 1 },
    dotSide: { position: 'absolute', top: 6, left: 32, width: 10, height: 10, borderRadius: 5, backgroundColor: '#E5262E', borderWidth: 1.5, borderColor: '#FFD5A0' },
});
