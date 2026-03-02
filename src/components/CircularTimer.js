import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import Animated, {
    useSharedValue,
    useAnimatedProps,
    withTiming,
    Easing,
} from 'react-native-reanimated';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function CircularTimer({ timeLeft, maxTime = 15, size = 60 }) {
    const strokeWidth = 6;
    const center = size / 2;
    const radius = center - strokeWidth / 2;
    const circumference = 2 * Math.PI * radius;

    const progress = useSharedValue(timeLeft / maxTime);

    // Animates the progress bar whenever timeLeft changes
    useEffect(() => {
        progress.value = withTiming(timeLeft / maxTime, {
            duration: 1000,
            easing: Easing.linear,
        });
    }, [timeLeft, maxTime]);

    const animatedProps = useAnimatedProps(() => {
        const strokeDashoffset = circumference - circumference * progress.value;
        return {
            strokeDashoffset,
        };
    });

    // Color logic
    let strokeColor = '#10B981'; // Green
    if (timeLeft <= 5) strokeColor = '#EF4444'; // Red
    else if (timeLeft <= 10) strokeColor = '#F59E0B'; // Yellow

    return (
        <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
            <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <G rotation="-90" origin={`${center}, ${center}`}>
                    <Circle
                        cx={center}
                        cy={center}
                        r={radius}
                        stroke="#1C2E4A"
                        strokeWidth={strokeWidth}
                        fill="transparent"
                    />
                    <AnimatedCircle
                        cx={center}
                        cy={center}
                        r={radius}
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        fill="transparent"
                        strokeDasharray={circumference}
                        animatedProps={animatedProps}
                        strokeLinecap="round"
                    />
                </G>
            </Svg>
            <View style={StyleSheet.absoluteFillObject}>
                <View style={[styles.textContainer, { width: size, height: size }]}>
                    <Text style={[styles.timerText, { color: strokeColor }]}>{Math.max(0, timeLeft)}</Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    textContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    timerText: {
        fontSize: 18,
        fontWeight: 'bold',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
    }
});
