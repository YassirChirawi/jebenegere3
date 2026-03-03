import React, { useEffect } from 'react';
import { View, StyleSheet, Image, Dimensions } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    withRepeat,
    withSequence,
    withDelay,
    runOnJS,
    interpolate,
    Extrapolation
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { Canvas, RoundedRect, SweepGradient, vec, BlurMask, Paint } from '@shopify/react-native-skia';

const { height } = Dimensions.get('window');

const img1 = require('../../assets/Galleria_01.jpg');
const img2 = require('../../assets/Galleria_02.jpg');
const img3 = require('../../assets/Galleria_03.jpg');
const img4 = require('../../assets/Galleria_04.jpg');
const ramadanBack = require('../../assets/Yellow and White Illustrative Ramadan Greeting Instagram Post.png'); // NOUVEAU DOS DE CARTE
const images = [img1, img2, img3, img4];

const suitOrder = { Oros: 0, Bastos: 1, Espadas: 2, Copas: 3 };
const valueOrder = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 10: 7, 11: 8, 12: 9 };

const CARD_WIDTH = 75; // Un peu plus large pour le style
const CARD_HEIGHT = 105;
const DROP_THRESHOLD = -120; // Glisser vers le haut pour jouer

export default function MasterCard({ card, isPlayable, onPlay, index, totalCards, isInitialDeal }) {
    // === Shared Values pour Reanimated ===
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const scale = useSharedValue(1);

    // Pour l'effet Squish & Stretch
    const scaleX = useSharedValue(1);
    const scaleY = useSharedValue(1);

    // Pour l'effet Tilt 3D
    const rotateX = useSharedValue(0);
    const rotateY = useSharedValue(0);

    // Z-Index local pendant le drag
    const zIndex = useSharedValue(index);

    // Glow Animation
    const glowRotation = useSharedValue(0);

    // Deal Animation (Intro)
    const flipRotation = useSharedValue(isInitialDeal ? 180 : 0);
    const dealTranslateY = useSharedValue(isInitialDeal ? -height : 0);
    const dealScale = useSharedValue(isInitialDeal ? 0.1 : 1);
    const dealRotateZ = useSharedValue(isInitialDeal ? -180 : 0);

    useEffect(() => {
        if (isInitialDeal) {
            const delay = index * 150; // 150ms per card for more dramatic dealt staggering

            // Complex entrance: Spin, scale up, slide down, and flip simultaneously
            dealScale.value = withDelay(delay, withSpring(1, { damping: 12, stiffness: 80 }));
            dealRotateZ.value = withDelay(delay, withSpring(0, { damping: 15, stiffness: 60 }));
            dealTranslateY.value = withDelay(delay, withSpring(0, { damping: 14, stiffness: 100 }));
            flipRotation.value = withDelay(delay, withSpring(0, { damping: 15, stiffness: 100 }));
        }
    }, [isInitialDeal]);

    useEffect(() => {
        if (isPlayable) {
            glowRotation.value = withRepeat(
                withTiming(360, { duration: 3000 }),
                -1,
                false
            );
        } else {
            glowRotation.value = 0;
        }
    }, [isPlayable]);

    // === GESTURE HANDLER ===
    const pan = Gesture.Pan()
        .enabled(isPlayable)
        .onStart(() => {
            scale.value = withSpring(1.2, { damping: 10, stiffness: 200 });
            zIndex.value = 100; // Passe au-dessus
        })
        .onUpdate((event) => {
            translateX.value = event.translationX;
            translateY.value = event.translationY;

            // Tilt 3D basé sur la translation (limité de -20deg à 20deg)
            rotateX.value = interpolate(event.translationY, [-200, 200], [20, -20], Extrapolation.CLAMP);
            rotateY.value = interpolate(event.translationX, [-200, 200], [-20, 20], Extrapolation.CLAMP);

            // Squish & Stretch basé sur la vélocité
            const velocityMagnitude = Math.sqrt(event.velocityX ** 2 + event.velocityY ** 2);
            if (velocityMagnitude > 500) {
                // S'étire dans le sens du mouvement
                const stretch = Math.min(1.15, 1 + velocityMagnitude / 5000);
                const squish = Math.max(0.85, 1 - velocityMagnitude / 5000);

                if (Math.abs(event.velocityY) > Math.abs(event.velocityX)) {
                    scaleY.value = withSpring(stretch);
                    scaleX.value = withSpring(squish);
                } else {
                    scaleX.value = withSpring(stretch);
                    scaleY.value = withSpring(squish);
                }
            } else {
                scaleX.value = withSpring(1);
                scaleY.value = withSpring(1);
            }
        })
        .onEnd((event) => {
            scale.value = withSpring(1);
            scaleX.value = withSpring(1);
            scaleY.value = withSpring(1);
            rotateX.value = withSpring(0);
            rotateY.value = withSpring(0);

            if (event.translationY < DROP_THRESHOLD) {
                // Jouer la carte !
                translateY.value = withSpring(-height / 2, { velocity: event.velocityY }, () => {
                    'worklet';
                    if (onPlay) {
                        runOnJS(onPlay)();
                    }
                });
            } else {
                // Revenir à la main
                translateX.value = withSpring(0, { damping: 14, stiffness: 150 });
                translateY.value = withSpring(0, { damping: 14, stiffness: 150 }, () => {
                    zIndex.value = index;
                });
            }
        });

    const tap = Gesture.Tap()
        .enabled(isPlayable)
        .onEnd(() => {
            if (onPlay) runOnJS(onPlay)();
        });

    const composed = Gesture.Simultaneous(pan, tap);

    // === ANIMATED STYLES ===

    // Distribution en éventail (Stagger initial)
    const centerIndex = (totalCards - 1) / 2;
    const offset = index - centerIndex;

    // Spacing plus écarté (Main plus espacée)
    const fanAngle = offset * 10; // Passe de 8 à 10 degrés
    const fanTranslateY = Math.abs(offset) * 5; // Courbure en Y plus accentuée (5 au lieu de 3)

    const animatedStyle = useAnimatedStyle(() => {
        const combinedRotateY = rotateY.value + flipRotation.value;
        const combinedRotateZ = fanAngle + dealRotateZ.value; // Combine fan angle with intro spin
        return {
            zIndex: zIndex.value,
            transform: [
                { translateX: translateX.value },
                { translateY: translateY.value - fanTranslateY + dealTranslateY.value },
                { rotateZ: `${combinedRotateZ}deg` },
                { scale: scale.value * dealScale.value },
                { scaleX: scaleX.value },
                { scaleY: scaleY.value },
                { perspective: 800 },
                { rotateX: `${rotateX.value}deg` },
                { rotateY: `${combinedRotateY}deg` }
            ]
        };
    });

    const frontOpacityStyle = useAnimatedStyle(() => ({
        opacity: Math.abs(flipRotation.value % 360) < 90 ? 1 : 0
    }));

    const backOpacityStyle = useAnimatedStyle(() => ({
        opacity: Math.abs(flipRotation.value % 360) >= 90 ? 1 : 0,
        transform: [{ rotateY: '180deg' }]
    }));

    // === Cacul d'image Sprite ===
    const sIdx = suitOrder[card.suit] !== undefined ? suitOrder[card.suit] : 0;
    const vIdx = valueOrder[card.value] !== undefined ? valueOrder[card.value] : 0;
    const absIdx = sIdx * 10 + vIdx;
    const imgIndex = Math.floor(absIdx / 12);
    const posInImg = absIdx % 12;
    const col = posInImg % 4;
    const row = Math.floor(posInImg / 4);
    const numRows = imgIndex === 3 ? 1 : 3;

    return (
        <GestureDetector gesture={composed}>
            <Animated.View style={[styles.container, animatedStyle]}>

                {/* Skia Glow Effect if Playable */}
                {isPlayable && (
                    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
                        <RoundedRect
                            x={-5} y={-5}
                            width={CARD_WIDTH + 10}
                            height={CARD_HEIGHT + 10}
                            r={12}
                        >
                            <SweepGradient
                                c={vec((CARD_WIDTH + 10) / 2, (CARD_HEIGHT + 10) / 2)}
                                colors={['#FFD700', '#FF8C00', '#FFD700']}
                                transform={[{ rotate: glowRotation.value * (Math.PI / 180) }]}
                            />
                            <BlurMask blur={8} style="normal" />
                        </RoundedRect>
                    </Canvas>
                )}

                {/* Front Face of the Card */}
                <Animated.View style={[styles.cardContainer, !isPlayable && styles.disabled, frontOpacityStyle, { position: 'absolute' }]}>
                    <View style={styles.spriteContainer}>
                        <Image
                            source={images[imgIndex]}
                            style={[
                                styles.spriteImage,
                                {
                                    width: CARD_WIDTH * 4,
                                    height: CARD_HEIGHT * numRows,
                                    transform: [
                                        { translateX: -col * CARD_WIDTH },
                                        { translateY: -row * CARD_HEIGHT }
                                    ]
                                }
                            ]}
                            resizeMode="stretch"
                        />
                    </View>
                </Animated.View>

                {/* Back Face of the Card (Sophisticated Deal dos) */}
                <Animated.View style={[styles.cardContainer, backOpacityStyle, { position: 'absolute', backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' }]}>
                    <Image
                        source={ramadanBack}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                    />
                    {/* Inner elegant border */}
                    <View style={styles.innerBorder} />
                </Animated.View>

            </Animated.View>
        </GestureDetector>
    );
}

const styles = StyleSheet.create({
    container: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        marginHorizontal: 0, // Plus aucune marge négative, laisse les cartes "respirer" en éventail
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardContainer: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 5,
        elevation: 6,
    },
    innerBorder: {
        position: 'absolute',
        width: CARD_WIDTH - 8,
        height: CARD_HEIGHT - 8,
        borderRadius: 6,
        borderWidth: 1.5,
        borderColor: 'rgba(212, 175, 55, 0.6)', // Golden border touch over the back Image
    },
    spriteContainer: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        overflow: 'hidden',
    },
    spriteImage: {
        position: 'absolute',
        top: 0,
        left: 0,
    },
    disabled: {
        opacity: 0.5,
    },
});
