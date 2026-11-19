/**
 * Premier lancement : 4 écrans courts (bienvenue, binga, coffres et roue, première partie),
 * puis une première partie contre l'ordinateur en un geste. Montré une seule fois (clé « onboarded »).
 */
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Modal, Pressable, Image } from 'react-native';
import Animated, { FadeIn, SlideInRight } from 'react-native-reanimated';
import { GameButton, theme } from './ui';
import { CardFace } from './Card';
import { BingaIcon, Chip } from './Decor';
import { ChestArt } from './ChestOpening';
import PlayerAvatar from './PlayerAvatar';
import { GAMES, GAME_ORDER } from '../games';

const LOGO = require('../../assets/brand/logo.webp');

function Dots({ step, total }) {
    return (
        <View style={styles.dots}>
            {Array.from({ length: total }).map((_, i) => <View key={i} style={[styles.dot, i === step && styles.dotOn]} />)}
        </View>
    );
}

/**
 * onPlay(game, name) : lance la première partie contre l'ordinateur ; onClose : « Plus tard ».
 * hasAccount : le pseudo est celui du compte (pas de saisie). connected : serveur joignable.
 */
export default function Onboarding({ visible, onPlay, onClose, name: initialName, hasAccount, connected }) {
    const [step, setStep] = useState(0);
    const [name, setName] = useState(initialName || '');
    const [game, setGame] = useState('hezz2');
    if (!visible) return null;
    const TOTAL = 4;
    const next = () => setStep((s) => Math.min(TOTAL - 1, s + 1));

    let body;
    if (step === 0) {
        body = (
            <>
                <Image source={LOGO} style={styles.logo} />
                <Text style={styles.title}>Bienvenue sur L'Carta</Text>
                <Text style={styles.text}>Hezz2, Ronda, Kdoub et Sota Ghamla : les jeux de cartes marocains, en ligne avec tes amis ou contre l'ordinateur.</Text>
                <View style={styles.cards}>
                    {GAME_ORDER.map((k, i) => (
                        <View key={k} style={{ transform: [{ rotate: `${(i - 1.5) * 9}deg` }], marginHorizontal: -6 }}>
                            <CardFace card={GAMES[k].card} width={52} height={76} />
                        </View>
                    ))}
                </View>
            </>
        );
    } else if (step === 1) {
        body = (
            <>
                <BingaIcon size={84} />
                <Text style={styles.title}>Gagne des binga, même en perdant</Text>
                <Text style={styles.text}>+10 binga par partie finie, +25 en gagnant. Des missions chaque jour, et un bonus de connexion qui grimpe sur 7 jours.</Text>
                <View style={styles.row}>
                    <Text style={styles.pill}>Défaite +10</Text>
                    <Text style={styles.pill}>Victoire +25</Text>
                    <Text style={styles.pill}>7ᵉ jour +150</Text>
                </View>
            </>
        );
    } else if (step === 2) {
        body = (
            <>
                <View style={styles.row}>
                    <Chip name="pique" size={52} />
                    <ChestArt chest="or" size={96} open />
                    <Chip name="couronne" size={52} />
                </View>
                <Text style={styles.title}>Coffres, roue et boutique</Text>
                <Text style={styles.text}>Une roue gratuite chaque jour, des coffres et une boutique : portraits, tables, dos de cartes, effets de victoire. Tout se gagne en jouant, jamais avec de l'argent.</Text>
                <View style={styles.row}>
                    {[29, 33, 36].map((v) => <PlayerAvatar key={v} name="?" variant={v} size={52} />)}
                </View>
            </>
        );
    } else {
        body = (
            <>
                <Text style={styles.title}>À toi de jouer !</Text>
                <Text style={styles.text}>Une première partie contre l'ordinateur pour découvrir. Les règles sont dans le jeu (📜).</Text>
                {!hasAccount && (
                    <TextInput
                        style={styles.input}
                        placeholder="Ton pseudo…"
                        placeholderTextColor={theme.textDim}
                        value={name}
                        onChangeText={setName}
                        maxLength={16}
                        accessibilityLabel="Ton pseudo"
                    />
                )}
                <View style={styles.games}>
                    {GAME_ORDER.filter((k) => GAMES[k].available).map((k) => (
                        <Pressable key={k} onPress={() => setGame(k)} style={[styles.gameChip, game === k && { borderColor: GAMES[k].color, backgroundColor: 'rgba(212,175,55,0.2)' }]}>
                            <CardFace card={GAMES[k].card} width={26} height={38} />
                            <Text style={[styles.gameName, game === k && { color: theme.goldLight }]}>{GAMES[k].label}</Text>
                        </Pressable>
                    ))}
                </View>
            </>
        );
    }

    const canPlay = connected && (hasAccount || name.trim().length >= 2);
    return (
        <Modal visible transparent animationType="fade" onRequestClose={onClose}>
            <Animated.View entering={FadeIn.duration(200)} style={styles.overlay}>
                <View style={styles.box}>
                    <Pressable onPress={onClose} hitSlop={12} style={styles.skip} accessibilityLabel="Passer"><Text style={styles.skipText}>Passer</Text></Pressable>
                    <Animated.View key={step} entering={SlideInRight.springify().damping(18)} style={styles.body}>{body}</Animated.View>
                    <Dots step={step} total={TOTAL} />
                    {step < TOTAL - 1 ? (
                        <GameButton title="Suivant" onPress={next} style={styles.btn} />
                    ) : (
                        <>
                            <GameButton
                                title={!connected ? 'Connexion au serveur…' : `Jouer · ${GAMES[game].label}`}
                                icon="🤖"
                                onPress={() => onPlay(game, name.trim())}
                                disabled={!canPlay}
                                style={styles.btn}
                            />
                            <Pressable onPress={onClose} style={styles.later}><Text style={styles.laterText}>Plus tard</Text></Pressable>
                        </>
                    )}
                </View>
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(6,12,28,0.92)', justifyContent: 'center', alignItems: 'center', padding: 16 },
    box: { width: '100%', maxWidth: 400, alignItems: 'center', backgroundColor: theme.panelSolid, borderRadius: 24, borderWidth: 2, borderColor: theme.gold, paddingVertical: 22, paddingHorizontal: 18 },
    skip: { position: 'absolute', top: 12, right: 16, zIndex: 2 },
    skipText: { color: theme.textDim, fontWeight: '800', fontSize: 13 },
    body: { alignItems: 'center', alignSelf: 'stretch', minHeight: 330, justifyContent: 'center' },
    logo: { width: 130, height: 130 },
    title: { color: theme.goldLight, fontSize: 22, fontWeight: '900', textAlign: 'center', marginTop: 12 },
    text: { color: theme.cream, fontSize: 14, fontWeight: '700', textAlign: 'center', marginTop: 8, lineHeight: 20 },
    cards: { flexDirection: 'row', marginTop: 16 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap', justifyContent: 'center' },
    pill: { color: theme.goldLight, fontWeight: '900', fontSize: 12, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: theme.gold, backgroundColor: 'rgba(212,175,55,0.15)', overflow: 'hidden' },
    input: { alignSelf: 'stretch', marginTop: 14, backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1.5, borderColor: theme.gold, borderRadius: 12, color: theme.cream, paddingHorizontal: 12, paddingVertical: 10, fontWeight: '800', fontSize: 16 },
    games: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14, justifyContent: 'center' },
    gameChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.3)', backgroundColor: 'rgba(0,0,0,0.3)' },
    gameName: { color: theme.cream, fontWeight: '800', fontSize: 13 },
    dots: { flexDirection: 'row', gap: 6, marginTop: 14 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.2)' },
    dotOn: { width: 22, backgroundColor: theme.gold },
    btn: { alignSelf: 'stretch', marginTop: 16 },
    later: { padding: 10 },
    laterText: { color: theme.textDim, fontWeight: '800', fontSize: 13 },
});
