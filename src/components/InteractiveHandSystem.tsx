import React from 'react';
import { TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
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
import { Canvas, RoundedRect, BlurMask } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const CARD_W = 75;
const CARD_H = 105;

// Shadow canvas is larger than the card so blur doesn't clip at the edges
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
    // ---- Shared Values ----
    const cardY = useSharedValue(0);
    const liftProg = useSharedValue(0); // 0 = resting, 1 = floating

    // ---- Haptics ----
    const medHaptic = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // ---- Tap handler ----
    const handlePress = () => {
        if (!isPlayable) return;

        runOnJS(medHaptic)();

        // 1. Float up slightly (lift phase)
        liftProg.value = withTiming(1, { duration: 180 });

        // 2. After brief hover, fly off screen, then notify game
        cardY.value = withSequence(
            // Slight lift first for a "hover" feel
            withSpring(-30, { damping: 10, stiffness: 200 }),
            // Then fly off
            withTiming(-SCREEN_HEIGHT, { duration: 350 }, (finished) => {
                'worklet';
                if (finished && onCardPlayed) runOnJS(onCardPlayed)();
            })
        );
    };

    // ---- Derived values for Skia shadow ----
    const shadowBlur = useDerivedValue(() =>
        interpolate(liftProg.value, [0, 1], [3, 22])
    );

    const shadowDY = useDerivedValue(() =>
        interpolate(liftProg.value, [0, 1], [4, 22])
    );

    const shadowAlpha = useDerivedValue(() =>
        interpolate(liftProg.value, [0, 1], [0.22, 0.55])
    );

    // ---- Animated Styles ----

    // Card: lift + scale on tap, then fly upward
    const cardAnimatedStyle = useAnimatedStyle(() => {
        const sc = interpolate(liftProg.value, [0, 1], [1, 1.08], Extrapolate.CLAMP);
        return {
            transform: [
                { translateY: cardY.value },
                { scale: sc },
            ],
            zIndex: liftProg.value > 0 ? 100 : 1,
        };
    });

    // Shadow follows card, offset downward by dynamic amount
    const shadowCanvasStyle = useAnimatedStyle(() => ({
        position: 'absolute',
        left: -SHADOW_PAD,
        top: -SHADOW_PAD,
        transform: [
            { translateY: cardY.value + shadowDY.value },
        ],
        zIndex: 0,
    }));

    return (
        <TouchableOpacity
            onPress={handlePress}
            disabled={!isPlayable}
            activeOpacity={0.85}
            style={styles.touchable}
        >
            <Animated.View style={styles.container}>

                {/* Dynamic Skia drop-shadow */}
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

                {/* Card visuals with float + fly transform */}
                <Animated.View style={cardAnimatedStyle}>
                    {children}
                </Animated.View>

            </Animated.View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    touchable: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        justifyContent: 'center',
        alignItems: 'center',
    },
});
