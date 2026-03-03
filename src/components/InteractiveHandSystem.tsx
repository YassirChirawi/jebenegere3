import React from 'react';
import { StyleSheet, Dimensions, Platform } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    useDerivedValue,
    withSpring,
    withTiming,
    withSequence,
    interpolate,
    Extrapolate,
    runOnJS,
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { Canvas, RoundedRect, BlurMask } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const CARD_W = 75;
const CARD_H = 105;
const SHADOW_CANVAS_W = CARD_W + 80;
const SHADOW_CANVAS_H = CARD_H + 80;
const SHADOW_PAD = 40;

type Props = {
    children: React.ReactNode;
    onCardPlayed?: () => void;
    isPlayable?: boolean;
};

export default function InteractiveHandSystem({
    children,
    onCardPlayed,
    isPlayable = true,
}: Props) {
    const cardY = useSharedValue(0);
    const liftProg = useSharedValue(0);

    // JS-thread helpers (called via runOnJS from the gesture worklet)
    const triggerHaptic = () =>
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Delay matches the fly-out animation so the card is gone before the game updates
    const notifyPlayed = () => {
        if (onCardPlayed) setTimeout(onCardPlayed, 380);
    };

    // ---- Tap Gesture (runs on UI thread) ----
    const tapGesture = Gesture.Tap()
        .enabled(isPlayable)
        .onEnd((_e, success) => {
            'worklet';
            if (!success) return;

            runOnJS(triggerHaptic)();

            // 1. Hover up with spring
            // 2. Fly off screen
            liftProg.value = withTiming(1, { duration: 150 });
            cardY.value = withSequence(
                withSpring(-30, { damping: 10, stiffness: 220 }),
                withTiming(-SCREEN_HEIGHT, { duration: 330 })
            );

            // Notify the game after the fly-out delay
            runOnJS(notifyPlayed)();
        });

    // ---- Skia shadow (derived from liftProg) ----
    const shadowBlur = useDerivedValue(() =>
        interpolate(liftProg.value, [0, 1], [3, 22])
    );
    const shadowDY = useDerivedValue(() =>
        interpolate(liftProg.value, [0, 1], [4, 22])
    );
    const shadowAlpha = useDerivedValue(() =>
        interpolate(liftProg.value, [0, 1], [0.22, 0.55])
    );

    // ---- Animated styles ----
    const cardAnimatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateY: cardY.value },
            { scale: interpolate(liftProg.value, [0, 1], [1, 1.08], Extrapolate.CLAMP) },
        ],
        zIndex: liftProg.value > 0 ? 100 : 1,
    }));

    const shadowCanvasStyle = useAnimatedStyle(() => ({
        position: 'absolute',
        left: -SHADOW_PAD,
        top: -SHADOW_PAD,
        transform: [{ translateY: cardY.value + shadowDY.value }],
        zIndex: 0,
    }));

    return (
        <GestureDetector gesture={tapGesture}>
            <Animated.View style={styles.container}>

                {/* Dynamic Skia drop-shadow (Disabled on Web to prevent CanvasKit WASM crash) */}
                {Platform.OS !== 'web' && (
                    <Animated.View style={shadowCanvasStyle}>
                        <Canvas style={{ width: SHADOW_CANVAS_W, height: SHADOW_CANVAS_H }}>
                            <RoundedRect
                                x={SHADOW_PAD}
                                y={SHADOW_PAD}
                                width={CARD_W}
                                height={CARD_H}
                                r={10}
                                color={`rgba(0,0,0,${shadowAlpha.value})`}
                            >
                                <BlurMask blur={shadowBlur.value} style="normal" />
                            </RoundedRect>
                        </Canvas>
                    </Animated.View>
                )}

                {/* Card with hover + fly animation */}
                <Animated.View style={cardAnimatedStyle}>
                    {children}
                </Animated.View>

            </Animated.View>
        </GestureDetector>
    );
}

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
    },
});
