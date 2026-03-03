import React from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    useDerivedValue,
    withSpring,
    withTiming,
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

// Shadow canvas is larger than the card so blur doesn't clip at the edges
const SHADOW_CANVAS_W = CARD_W + 80;
const SHADOW_CANVAS_H = CARD_H + 80;
const SHADOW_PAD = 40; // half of the extra canvas space

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
    // ---- Shared Values ----
    const gestureX = useSharedValue(0);
    const gestureY = useSharedValue(0);
    const cardX = useSharedValue(0);
    const cardY = useSharedValue(0);
    const velocityX = useSharedValue(0);
    const velocityY = useSharedValue(0);
    const scaleXv = useSharedValue(1);
    const scaleYv = useSharedValue(1);
    const isDragging = useSharedValue(0); // animated float 0 → 1

    // ---- Haptics (called on JS thread only) ----
    const lightHaptic = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const medHaptic = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // ---- Pan Gesture ----
    const panGesture = Gesture.Pan()
        .enabled(isPlayable)
        .onStart((e) => {
            isDragging.value = withTiming(1, { duration: 150 });
            gestureX.value = e.translationX;
            gestureY.value = e.translationY;
            runOnJS(lightHaptic)();
        })
        .onUpdate((e) => {
            gestureX.value = e.translationX;
            gestureY.value = e.translationY;
            velocityX.value = e.velocityX;
            velocityY.value = e.velocityY;

            // Inertial card follow (slight lag behind finger)
            cardX.value = withSpring(e.translationX, { damping: 12, stiffness: 150 });
            cardY.value = withSpring(e.translationY, { damping: 12, stiffness: 150 });

            // Squish & Stretch based on speed
            const mag = Math.sqrt(e.velocityX ** 2 + e.velocityY ** 2);
            if (mag > 500) {
                const stretch = Math.min(1.15, 1 + mag / 5000);
                const squish = Math.max(0.85, 1 - mag / 5000);
                if (Math.abs(e.velocityY) > Math.abs(e.velocityX)) {
                    scaleYv.value = withSpring(stretch);
                    scaleXv.value = withSpring(squish);
                } else {
                    scaleXv.value = withSpring(stretch);
                    scaleYv.value = withSpring(squish);
                }
            } else {
                scaleXv.value = withSpring(1);
                scaleYv.value = withSpring(1);
            }
        })
        .onEnd((e) => {
            isDragging.value = withTiming(0, { duration: 250 });

            if (e.translationY < -150 && isPlayable) {
                // Fast throw upward → play the card
                cardY.value = withSpring(-SCREEN_HEIGHT, { velocity: e.velocityY });
                cardX.value = withSpring(0);
                if (onCardPlayed) setTimeout(() => onCardPlayed(), 300);
            } else {
                // Soft release → return to hand
                gestureX.value = withSpring(0, { damping: 15 });
                gestureY.value = withSpring(0, { damping: 15 });
                cardX.value = withSpring(0, { damping: 15 });
                cardY.value = withSpring(0, { damping: 15 });
                scaleXv.value = withSpring(1);
                scaleYv.value = withSpring(1);
                velocityX.value = withTiming(0);
                velocityY.value = withTiming(0);
                runOnJS(medHaptic)();
            }
        });

    // ---- Derived values for Skia (computed on UI thread) ----
    const shadowBlur = useDerivedValue(() => {
        const speedBlur = Math.min(Math.abs(velocityY.value) / 80, 25);
        const liftBlur = interpolate(isDragging.value, [0, 1], [3, 15]);
        return liftBlur + speedBlur;
    });

    const shadowDY = useDerivedValue(() => {
        const speedOffset = Math.min(Math.abs(velocityY.value) / 60, 30);
        const liftOffset = interpolate(isDragging.value, [0, 1], [4, 20]);
        return liftOffset + speedOffset;
    });

    const shadowAlpha = useDerivedValue(() =>
        interpolate(isDragging.value, [0, 1], [0.22, 0.55])
    );

    // ---- Animated Styles (Reanimated) ----

    // Card wrapper: translate + 3-D tilt + scale + squish
    const cardAnimatedStyle = useAnimatedStyle(() => {
        const rx = interpolate(velocityY.value, [-2000, 2000], [22, -22], Extrapolate.CLAMP);
        const ry = interpolate(velocityX.value, [-2000, 2000], [-22, 22], Extrapolate.CLAMP);
        const sc = interpolate(isDragging.value, [0, 1], [1, 1.1]);
        return {
            transform: [
                { translateX: cardX.value },
                { translateY: cardY.value },
                { scale: sc },
                { scaleX: scaleXv.value },
                { scaleY: scaleYv.value },
                { perspective: 800 },
                { rotateX: `${rx}deg` },
                { rotateY: `${ry}deg` },
            ],
            zIndex: isDragging.value > 0.5 ? 100 : 1,
        };
    });

    // Shadow canvas: follows card but shifted down by dynamic offset
    const shadowCanvasStyle = useAnimatedStyle(() => ({
        position: 'absolute',
        left: -SHADOW_PAD,
        top: -SHADOW_PAD,
        transform: [
            { translateX: cardX.value },
            { translateY: cardY.value + shadowDY.value },
        ],
        zIndex: 0,
    }));

    return (
        <GestureDetector gesture={panGesture}>
            <Animated.View style={styles.container}>

                {/* 1. Dynamic Skia drop-shadow — blurs and drifts down as speed increases */}
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

                {/* 2. The card visuals with all physics transforms */}
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
