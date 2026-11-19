/**
 * Fenêtres du jour sur l'accueil (une fois par jour chacune, l'une après l'autre) :
 *   1. connexion du jour : calendrier des 7 jours et binga reçus ;
 *   2. roue du jour : « 1 tour gratuit t'attend » ;
 *   3. boutique : nouveautés (portraits premium, coffres).
 * Sans compte : une seule fenêtre pour inviter à créer un compte.
 * Chaque fenêtre se ferme d'un geste ; rien n'est obligatoire.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import Animated, { ZoomIn, FadeIn } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GameButton, theme, haptic } from './ui';
import { BingaIcon, Chip } from './Decor';
import PlayerAvatar from './PlayerAvatar';
import { ChestArt } from './ChestOpening';
import audioService from '../network/audioService';
import { BINGA, dayKey } from '../../server/progress/defs';

const KEY = 'dailyPopups';

async function seenToday() {
    try {
        const raw = JSON.parse((await AsyncStorage.getItem(KEY)) || '{}');
        return raw.day === dayKey() ? raw.seen || [] : [];
    } catch (e) {
        return [];
    }
}
async function markSeen(id) {
    const seen = await seenToday();
    AsyncStorage.setItem(KEY, JSON.stringify({ day: dayKey(), seen: [...new Set([...seen, id])] })).catch(() => {});
}

function LoginCalendar({ login }) {
    return (
        <>
            <Text style={styles.title}>Connexion du jour</Text>
            <View style={styles.amountRow}>
                <BingaIcon size={44} />
                <Text style={styles.amount}>+{login.amount}</Text>
            </View>
            <Text style={styles.text}>Jour {login.streak} sur {login.days} : reviens chaque jour, le 7ᵉ rapporte {BINGA.login[BINGA.login.length - 1]} binga !</Text>
            <View style={styles.days}>
                {BINGA.login.map((amount, i) => {
                    const day = i + 1;
                    const got = day < login.streak || (login.claimed && day === login.streak);
                    const today = day === login.streak;
                    return (
                        <View key={day} style={[styles.day, got && styles.dayGot, today && styles.dayToday, day === 7 && styles.daySeven]}>
                            <Text style={styles.dayN}>J{day}</Text>
                            {day === 7 ? <Chip name="couronne" size={22} /> : <BingaIcon size={18} />}
                            <Text style={styles.dayAmount}>{got ? '✓' : amount}</Text>
                        </View>
                    );
                })}
            </View>
            <Text style={styles.small}>Un jour manqué, et la série repart au jour 1.</Text>
        </>
    );
}

function WheelInvite() {
    return (
        <>
            <Text style={styles.title}>Ta roue du jour t'attend !</Text>
            <View style={styles.wheelArt}>
                <Chip name="pique" size={46} style={{ transform: [{ rotate: '-15deg' }] }} />
                <ChestArt chest="or" size={84} open />
                <Chip name="coeur" size={46} style={{ transform: [{ rotate: '15deg' }] }} />
            </View>
            <Text style={styles.text}>1 tour gratuit chaque 24 h : binga, coffres et cosmétiques à gagner. Toujours un lot !</Text>
        </>
    );
}

function ShopPromo() {
    return (
        <>
            <Text style={styles.title}>Nouveau dans la boutique</Text>
            <View style={styles.avatars}>
                {[29, 33, 36].map((v) => <PlayerAvatar key={v} name="?" variant={v} size={64} />)}
            </View>
            <Text style={styles.text}>Portraits premium, tables, dos de cartes, effets de victoire… et les coffres Bronze, Argent et Or, à ouvrir avec tes binga gagnés en jouant.</Text>
        </>
    );
}

function GuestInvite() {
    return (
        <>
            <Text style={styles.title}>Crée ton compte, c'est gratuit</Text>
            <View style={styles.amountRow}>
                <BingaIcon size={44} />
                <Text style={styles.amount}>+50</Text>
            </View>
            <Text style={styles.text}>Avec un compte : des binga à chaque partie (même perdue), une roue gratuite chaque jour, des coffres, la boutique, le classement… et tout est gardé sur tous tes appareils.</Text>
        </>
    );
}

/**
 * ready : l'accueil est affiché et rien d'autre n'est ouvert (règles, invitation, recherche).
 */
export default function DailyPopups({ profile, isGuest, ready, navigation }) {
    const [queue, setQueue] = useState(null);
    const [current, setCurrent] = useState(null);

    // Liste des fenêtres à montrer aujourd'hui (une seule fois)
    useEffect(() => {
        if (!ready || queue) return undefined;
        // Compte : on attend que le bonus du jour soit crédité (juste après l'ouverture de l'appli)
        if (!isGuest && !profile?.binga?.login?.claimed) return undefined;
        let alive = true;
        const t = setTimeout(async () => {
            const seen = await seenToday();
            const list = isGuest
                ? ['guest']
                : ['login', profile.wheel?.available && 'wheel', 'shop'].filter(Boolean);
            const todo = list.filter((id) => !seen.includes(id));
            if (alive) setQueue(todo);
        }, 1200);
        return () => { alive = false; clearTimeout(t); };
    }, [ready, isGuest, !!profile?.binga, profile?.binga?.login?.claimed]);

    useEffect(() => {
        if (!ready || current || !queue || !queue.length) return;
        const [next, ...rest] = queue;
        setQueue(rest);
        setCurrent(next);
        markSeen(next);
        audioService.playSound(next === 'login' ? 'coin' : 'pop');
        haptic('light');
    }, [queue, current, ready]);

    if (!current) return null;
    const close = () => setCurrent(null);
    const go = (screen) => { setCurrent(null); setQueue([]); navigation.navigate(screen); };

    let body = null;
    let actions = null;
    if (current === 'login') {
        body = <LoginCalendar login={profile.binga.login} />;
        actions = <GameButton title="Super !" onPress={close} />;
    } else if (current === 'wheel') {
        body = <WheelInvite />;
        actions = (
            <>
                <GameButton title="Tourner la roue" icon="🎡" onPress={() => go('Wheel')} />
                <Pressable onPress={close} style={styles.later}><Text style={styles.laterText}>Plus tard</Text></Pressable>
            </>
        );
    } else if (current === 'shop') {
        body = <ShopPromo />;
        actions = (
            <>
                <GameButton title="Voir la boutique" icon="🛍️" onPress={() => go('Shop')} />
                <Pressable onPress={close} style={styles.later}><Text style={styles.laterText}>Plus tard</Text></Pressable>
            </>
        );
    } else if (current === 'guest') {
        body = <GuestInvite />;
        actions = (
            <>
                <GameButton title="Créer mon compte" icon="🔐" onPress={() => go('Profile')} />
                <Pressable onPress={close} style={styles.later}><Text style={styles.laterText}>Jouer sans compte</Text></Pressable>
            </>
        );
    }

    return (
        <Modal visible transparent animationType="fade" onRequestClose={close}>
            <Animated.View entering={FadeIn.duration(150)} style={styles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={close} />
                <Animated.View key={current} entering={ZoomIn.springify().damping(13)} style={styles.box}>
                    <Pressable onPress={close} hitSlop={12} style={styles.close} accessibilityLabel="Fermer"><Text style={styles.closeText}>✕</Text></Pressable>
                    {body}
                    <View style={styles.actions}>{actions}</View>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 16 },
    box: { width: '100%', maxWidth: 380, alignItems: 'center', backgroundColor: theme.panelSolid, borderRadius: 22, borderWidth: 2, borderColor: theme.gold, paddingVertical: 20, paddingHorizontal: 16 },
    close: { position: 'absolute', top: 10, right: 14, zIndex: 2 },
    closeText: { color: theme.textDim, fontSize: 18, fontWeight: '900' },
    title: { color: theme.goldLight, fontSize: 20, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
    text: { color: theme.cream, fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 8 },
    small: { color: theme.textDim, fontSize: 11, textAlign: 'center', marginTop: 8 },
    amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    amount: { color: theme.goldLight, fontSize: 40, fontWeight: '900' },
    days: { flexDirection: 'row', gap: 4, marginTop: 12, alignSelf: 'stretch' },
    day: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)', gap: 2 },
    dayGot: { backgroundColor: 'rgba(52,211,153,0.15)', borderColor: theme.mint },
    dayToday: { borderColor: theme.gold, borderWidth: 2, backgroundColor: 'rgba(212,175,55,0.25)' },
    daySeven: { borderColor: '#F5D77A' },
    dayN: { color: theme.textDim, fontSize: 10, fontWeight: '900' },
    dayAmount: { color: theme.goldLight, fontSize: 11, fontWeight: '900' },
    wheelArt: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginVertical: 6 },
    avatars: { flexDirection: 'row', gap: 10, marginVertical: 8 },
    actions: { alignSelf: 'stretch', marginTop: 16, gap: 6, alignItems: 'stretch' },
    later: { alignSelf: 'center', padding: 8 },
    laterText: { color: theme.textDim, fontWeight: '800', fontSize: 13 },
});
