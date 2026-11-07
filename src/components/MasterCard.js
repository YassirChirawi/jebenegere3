import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    withRepeat,
    withSequence,
    withDelay,
    interpolate,
    Easing,
    runOnJS,
    cancelAnimation,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { CardFace, CardBack } from './Card';
import audioService from '../network/audioService';
import { haptic } from './ui';

export const HAND_CARD_W = 72;
export const HAND_CARD_H = 104;
const PLAY_DRAG_THRESHOLD = -70;

/**
 * Carte de la main du joueur.
 * - Placement en éventail calculé par le parent (x, angle, lift)
 * - Tap ou glisser vers le haut pour jouer
 * - Animation de distribution (vol depuis la pioche + retournement)
 */
export default function MasterCard({
    card,
    index,
    x,
    angle,
    arcY,
    isPlayable,
    isMyTurn,
    onPlay,
    isInitialDeal,
}) {
    // Position d'éventail animée (les cartes glissent quand la main change)
    const posX = useSharedValue(x);
    const rot = useSharedValue(angle);
    const baseY = useSharedValue(arcY);

    // Interaction
    const dragX = useSharedValue(0);
    const dragY = useSharedValue(0);
    const lift = useSharedValue(0);
    const flying = useSharedValue(0);
    const shake = useSharedValue(0);

    // Distribution
    const dealProg = useSharedValue(0); // 0 = dans la pioche, 1 = en main
    const flip = useSharedValue(180);

    // Halo des cartes jouables
    const glow = useSharedValue(0);

    const resetTimer = useRef(null);

    useEffect(() => {
        posX.value = withSpring(x, { damping: 16, stiffness: 140 });
        rot.value = withSpring(angle, { damping: 16, stiffness: 140 });
        baseY.value = withSpring(arcY, { damping: 16, stiffness: 140 });
    }, [x, angle, arcY]);

    // Animation d'entrée : distribution initiale (échelonnée) ou carte piochée
    useEffect(() => {
        const delay = isInitialDeal ? index * 95 + 150 : 60;
        dealProg.value = withDelay(delay, withSpring(1, { damping: 15, stiffness: 110, mass: 0.8 }));
        flip.value = withDelay(delay + 120, withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) }));
        if (!isInitialDeal) audioService.playSound('card_draw');
        return () => clearTimeout(resetTimer.current);
    }, []);

    useEffect(() => {
        if (isPlayable) {
            lift.value = withSpring(1, { damping: 12 });
            glow.value = withRepeat(
                withSequence(
                    withTiming(1, { duration: 750, easing: Easing.inOut(Easing.sin) }),
                    withTiming(0.35, { duration: 750, easing: Easing.inOut(Easing.sin) })
                ),
                -1,
                true
            );
        } else {
            lift.value = withSpring(0, { damping: 14 });
            cancelAnimation(glow);
            glow.value = withTiming(0, { duration: 200 });
        }
    }, [isPlayable]);

    // --- Callbacks JS ---
    const play = () => {
        haptic(['1', '2', '7'].includes(String(card.value)) ? 'heavy' : 'medium');
        onPlay && onPlay();
        // Si le serveur n'a pas retiré la carte (coup refusé / sélecteur annulé), elle revient en main
        clearTimeout(resetTimer.current);
        resetTimer.current = setTimeout(() => {
            flying.value = withSpring(0, { damping: 14 });
            dragX.value = withSpring(0);
            dragY.value = withSpring(0);
        }, 1600);
    };
    const refuse = () => {
        haptic('light');
        audioService.playSound('error');
    };

    // --- Gestes ---
    const tap = Gesture.Tap()
        .maxDuration(400)
        .onEnd((_e, success) => {
            'worklet';
            if (!success) return;
            if (isPlayable) {
                flying.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) });
                runOnJS(play)();
            } else if (isMyTurn) {
                shake.value = withSequence(
                    withTiming(-6, { duration: 45 }),
                    withTiming(6, { duration: 45 }),
                    withTiming(-4, { duration: 45 }),
                    withTiming(0, { duration: 45 })
                );
                runOnJS(refuse)();
            }
        });

    const pan = Gesture.Pan()
        .enabled(!!isPlayable)
        .minDistance(8)
        .onUpdate((e) => {
            'worklet';
            dragX.value = e.translationX;
            dragY.value = Math.min(20, e.translationY);
        })
        .onEnd((e) => {
            'worklet';
            if (e.translationY < PLAY_DRAG_THRESHOLD || e.velocityY < -900) {
                flying.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
                runOnJS(play)();
            } else {
                dragX.value = withSpring(0, { damping: 14 });
                dragY.value = withSpring(0, { damping: 14 });
            }
        });

    const gesture = Gesture.Race(pan, tap);

    // --- Styles animés ---
    const containerStyle = useAnimatedStyle(() => {
        const d = dealProg.value;
        const f = flying.value;
        const dragging = Math.abs(dragY.value) > 2 || Math.abs(dragX.value) > 2;
        return {
            zIndex: f > 0 || dragging ? 500 : index,
            opacity: interpolate(f, [0, 0.85, 1], [1, 1, 0]),
            transform: [
                { translateX: posX.value + dragX.value * (1 - f) + shake.value + (1 - d) * 20 },
                {
                    translateY:
                        baseY.value -
                        lift.value * 14 +
                        dragY.value * (1 - f) +
                        (1 - d) * -320 +
                        f * -260,
                },
                { rotateZ: `${rot.value * (1 - f) * (1 - Math.min(1, Math.abs(dragY.value) / 80)) + (1 - d) * -90}deg` },
                { scale: interpolate(d, [0, 1], [0.45, 1]) * (1 + lift.value * 0.04 + f * 0.1) },
            ],
        };
    });

    const frontStyle = useAnimatedStyle(() => ({
        opacity: flip.value < 90 ? 1 : 0,
        transform: [{ perspective: 700 }, { rotateY: `${flip.value}deg` }],
    }));
    const backStyle = useAnimatedStyle(() => ({
        opacity: flip.value >= 90 ? 1 : 0,
        transform: [{ perspective: 700 }, { rotateY: `${flip.value - 180}deg` }],
    }));
    const glowStyle = useAnimatedStyle(() => ({
        opacity: glow.value,
    }));

    return (
        <GestureDetector gesture={gesture}>
            <Animated.View style={[styles.container, containerStyle]}>
                <Animated.View style={[styles.glow, glowStyle]} pointerEvents="none" />
                <View style={styles.shadow}>
                    <Animated.View style={[styles.face, frontStyle]}>
                        <CardFace card={card} width={HAND_CARD_W} height={HAND_CARD_H} dimmed={isMyTurn && !isPlayable} />
                    </Animated.View>
                    <Animated.View style={[styles.face, backStyle]}>
                        <CardBack width={HAND_CARD_W} height={HAND_CARD_H} />
                    </Animated.View>
                </View>
            </Animated.View>
        </GestureDetector>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 0,
        bottom: 6,
        width: HAND_CARD_W,
        height: HAND_CARD_H,
    },
    shadow: {
        width: HAND_CARD_W,
        height: HAND_CARD_H,
        borderRadius: 8,
        backgroundColor: 'transparent',
        shadowColor: '#000',
        shadowOffset: { width: -2, height: 5 },
        shadowOpacity: 0.45,
        shadowRadius: 6,
        elevation: 8,
    },
    face: {
        position: 'absolute',
        top: 0,
        left: 0,
        backfaceVisibility: 'hidden',
    },
    glow: {
        position: 'absolute',
        top: -4,
        left: -4,
        right: -4,
        bottom: -4,
        borderRadius: 11,
        borderWidth: 3,
        borderColor: '#FFD966',
        backgroundColor: 'rgba(255, 200, 60, 0.25)',
        shadowColor: '#FFC83C',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 12,
        elevation: 12,
    },
});
