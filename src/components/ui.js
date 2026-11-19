import React from 'react';
import { Pressable, Text, StyleSheet, View, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import audioService from '../network/audioService';
import Gradient from './Gradient';

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

// Retour haptique : une vibration différente par type d'événement.
// Respecte le réglage "Vibrations" de l'appli et le bouton muet (coupe tout).
// Sur le web (Android), on utilise navigator.vibrate quand il existe.
let hapticsEnabled = true;
export function setHapticsEnabled(on) { hapticsEnabled = !!on; }

const WEB_PATTERNS = { light: 12, medium: 22, heavy: 40, success: [30, 60, 30], error: [60, 50, 60], warning: [25, 40, 25], double: [35, 90, 35], long: 220, tap: 8 };

export function haptic(style = 'light') {
    if (!hapticsEnabled || audioService.muted) return;
    if (Platform.OS === 'web') {
        try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(WEB_PATTERNS[style] ?? 15); } catch (e) { /* ignore */ }
        return;
    }
    const map = {
        tap: Haptics.ImpactFeedbackStyle.Light,
        light: Haptics.ImpactFeedbackStyle.Light,
        medium: Haptics.ImpactFeedbackStyle.Medium,
        heavy: Haptics.ImpactFeedbackStyle.Heavy,
    };
    if (style === 'success' || style === 'error' || style === 'warning') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType[style[0].toUpperCase() + style.slice(1)]).catch(() => {});
        return;
    }
    // Double (victoire) : deux impacts forts rapprochés
    if (style === 'double') {
        Haptics.impactAsync(map.heavy).catch(() => {});
        setTimeout(() => Haptics.impactAsync(map.heavy).catch(() => {}), 140);
        return;
    }
    // Longue (KDOUB, Sota finale) : rafale d'impacts forts
    if (style === 'long') {
        [0, 70, 140, 210].forEach((t) => setTimeout(() => Haptics.impactAsync(map.heavy).catch(() => {}), t));
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

// Boutons « premium » : dégradé, liseré doré, ombre basse (relief), reflet en haut
const VARIANTS = {
    gold:   { grad: ['#FFE795', '#EDBE4E', '#A8761A'], border: '#FFE9A8', text: '#3A1A05', shade: '#6E4A0C', glow: false },
    green:  { grad: ['#4FD38A', '#1E8C5A', '#0B5232'], border: '#F2CF72', text: '#fff', shade: '#063A22' },
    blue:   { grad: ['#5B8DEB', '#24529E', '#0D2A5C'], border: '#F2CF72', text: '#fff', shade: '#081B3E' },
    red:    { grad: ['#EA4A45', '#A61B25', '#5A0A13'], border: '#F2CF72', text: '#fff', shade: '#3A050B' },
    outline:{ grad: ['rgba(30,46,88,0.92)', 'rgba(9,17,36,0.92)'], border: theme.gold, text: '#F5D77A', shade: 'rgba(0,0,0,0.55)' },
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
                { borderColor: v.border, borderBottomColor: v.shade },
                style,
            ]}
        >
            <Gradient colors={v.grad} />
            <View style={styles.btnShine} pointerEvents="none" />
            <Text style={[styles.btnText, small && styles.btnTextSmall, { color: v.text }, v.text === '#fff' && styles.btnTextShadow, textStyle]} numberOfLines={1}>
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
        top: 2,
        left: 6,
        right: 6,
        height: '40%',
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    btnTextShadow: {
        textShadowColor: 'rgba(0,0,0,0.6)',
        textShadowRadius: 3,
        textShadowOffset: { width: 0, height: 1 },
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
