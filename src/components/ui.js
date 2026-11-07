import React from 'react';
import { Pressable, Text, StyleSheet, View, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import audioService from '../network/audioService';

export const theme = {
    bg: '#1C0F13',
    bgDeep: '#12080B',
    panel: 'rgba(28, 15, 19, 0.88)',
    panelSolid: '#2A1419',
    gold: '#D4AF37',
    goldLight: '#F5D77A',
    goldDark: '#9C7A1E',
    cream: '#F8EBD0',
    text: '#F3E9DC',
    textDim: '#B8A99A',
    red: '#C0392B',
    redLight: '#EF4444',
    green: '#1E8C5A',
    greenLight: '#10B981',
    blue: '#1F4E8C',
    mint: '#34D399',
};

// Retour haptique sans erreur sur le web
export function haptic(style = 'light') {
    if (Platform.OS === 'web') return;
    const map = {
        light: Haptics.ImpactFeedbackStyle.Light,
        medium: Haptics.ImpactFeedbackStyle.Medium,
        heavy: Haptics.ImpactFeedbackStyle.Heavy,
    };
    if (style === 'success' || style === 'error' || style === 'warning') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType[style[0].toUpperCase() + style.slice(1)]).catch(() => {});
        return;
    }
    Haptics.impactAsync(map[style] || map.light).catch(() => {});
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Pressable avec effet de pression (scale) + son de clic
export function PressableScale({ onPress, disabled, style, children, sound = 'click', scaleTo = 0.95, hitSlop, ...rest }) {
    const s = useSharedValue(1);
    const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
    return (
        <AnimatedPressable
            {...rest}
            hitSlop={hitSlop}
            disabled={disabled}
            onPressIn={() => { s.value = withSpring(scaleTo, { damping: 15, stiffness: 400 }); }}
            onPressOut={() => { s.value = withSpring(1, { damping: 12, stiffness: 300 }); }}
            onPress={(e) => {
                if (sound) audioService.playSound(sound);
                haptic('light');
                onPress && onPress(e);
            }}
            style={[style, aStyle, disabled && { opacity: 0.45 }]}
        >
            {children}
        </AnimatedPressable>
    );
}

const VARIANTS = {
    gold:   { bg: theme.gold, border: theme.goldLight, text: theme.bg, shade: theme.goldDark },
    green:  { bg: theme.green, border: '#3FCB8A', text: '#fff', shade: '#11603C' },
    blue:   { bg: theme.blue, border: '#4F86C6', text: '#fff', shade: '#123665' },
    red:    { bg: '#8E1B22', border: '#D9534F', text: '#fff', shade: '#5A0F14' },
    outline:{ bg: 'rgba(0,0,0,0.35)', border: theme.gold, text: theme.gold, shade: 'rgba(0,0,0,0.5)' },
};

// Bouton principal : effet "3D" avec ombre basse colorée
export function GameButton({ title, icon, onPress, variant = 'gold', disabled, style, textStyle, small }) {
    const v = VARIANTS[variant] || VARIANTS.gold;
    return (
        <PressableScale
            onPress={onPress}
            disabled={disabled}
            style={[
                styles.btn,
                small && styles.btnSmall,
                { backgroundColor: v.bg, borderColor: v.border, borderBottomColor: v.shade },
                style,
            ]}
        >
            <View style={styles.btnShine} pointerEvents="none" />
            <Text style={[styles.btnText, small && styles.btnTextSmall, { color: v.text }, textStyle]} numberOfLines={1}>
                {icon ? `${icon}  ` : ''}{title}
            </Text>
        </PressableScale>
    );
}

export function IconButton({ icon, onPress, size = 40, style, label, sound = 'click' }) {
    return (
        <PressableScale
            onPress={onPress}
            sound={sound}
            scaleTo={0.88}
            accessibilityLabel={label}
            style={[styles.iconBtn, { width: size, height: size, borderRadius: size / 2 }, style]}
        >
            <Text style={{ fontSize: size * 0.45 }}>{icon}</Text>
        </PressableScale>
    );
}

// Séparateur doré avec losange central (motif marocain)
export function OrnamentDivider({ label, style }) {
    return (
        <View style={[styles.divider, style]}>
            <View style={styles.dividerLine} />
            <View style={styles.diamond} />
            {label ? <Text style={styles.dividerText}>{label}</Text> : null}
            {label ? <View style={styles.diamond} /> : null}
            <View style={styles.dividerLine} />
        </View>
    );
}

const styles = StyleSheet.create({
    btn: {
        width: '100%',
        paddingVertical: 15,
        paddingHorizontal: 16,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderBottomWidth: 5,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
        elevation: 6,
    },
    btnSmall: {
        width: 'auto',
        flexShrink: 0,
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderBottomWidth: 4,
        borderRadius: 12,
    },
    btnShine: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '45%',
        backgroundColor: 'rgba(255,255,255,0.14)',
    },
    btnText: {
        fontWeight: '900',
        fontSize: 15,
        letterSpacing: 1,
    },
    btnTextSmall: {
        fontSize: 14,
        letterSpacing: 0.5,
    },
    iconBtn: {
        backgroundColor: 'rgba(18, 8, 11, 0.7)',
        borderWidth: 1.5,
        borderColor: 'rgba(212,175,55,0.55)',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 4,
        elevation: 4,
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        marginVertical: 18,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(212,175,55,0.55)',
    },
    diamond: {
        width: 7,
        height: 7,
        backgroundColor: theme.gold,
        transform: [{ rotate: '45deg' }],
        marginHorizontal: 6,
    },
    dividerText: {
        color: theme.gold,
        fontWeight: '800',
        fontSize: 12,
        letterSpacing: 2,
    },
});
