import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { GameButton, theme } from './ui';
import audioService from '../network/audioService';

/**
 * Remplace Alert.alert (qui ne fait rien sur le web) par une boîte de dialogue
 * au style du jeu, utilisable partout :
 *
 *   dialog.alert('Titre', 'Message', [{ text: 'Annuler', style: 'cancel' }, { text: 'OK', onPress }])
 */
let listener = null;

export const dialog = {
    alert(title, message, buttons) {
        const payload = {
            title,
            message,
            buttons: buttons && buttons.length ? buttons : [{ text: 'OK' }],
        };
        if (listener) listener(payload);
        else console.warn('[dialog]', title, message);
    },
};

export function DialogHost() {
    const [current, setCurrent] = useState(null);

    useEffect(() => {
        listener = (payload) => {
            audioService.playSound('pop');
            setCurrent(payload);
        };
        return () => { listener = null; };
    }, []);

    if (!current) return null;

    const close = (btn) => {
        setCurrent(null);
        if (btn && btn.onPress) btn.onPress();
    };

    const cancelBtn = current.buttons.find((b) => b.style === 'cancel');

    return (
        <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={styles.overlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => cancelBtn && close(cancelBtn)} />
            <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.box}>
                <View style={styles.cornerTL} />
                <View style={styles.cornerBR} />
                <Text style={styles.title}>{current.title}</Text>
                {current.message ? <Text style={styles.message}>{current.message}</Text> : null}
                <View style={styles.row}>
                    {current.buttons.map((b, i) => (
                        <GameButton
                            key={i}
                            small
                            title={b.text}
                            variant={b.style === 'destructive' ? 'red' : b.style === 'cancel' ? 'outline' : 'gold'}
                            onPress={() => close(b)}
                            style={{ flex: 1 }}
                        />
                    ))}
                </View>
            </Animated.View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        zIndex: 100000,
        elevation: 100000,
    },
    box: {
        width: '100%',
        maxWidth: 360,
        backgroundColor: theme.panelSolid,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: theme.gold,
        paddingVertical: 22,
        paddingHorizontal: 20,
        alignItems: 'center',
        shadowColor: theme.gold,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 18,
        elevation: 20,
    },
    cornerTL: {
        position: 'absolute', top: 6, left: 6, width: 16, height: 16,
        borderTopWidth: 2, borderLeftWidth: 2, borderColor: theme.goldLight, borderTopLeftRadius: 8,
    },
    cornerBR: {
        position: 'absolute', bottom: 6, right: 6, width: 16, height: 16,
        borderBottomWidth: 2, borderRightWidth: 2, borderColor: theme.goldLight, borderBottomRightRadius: 8,
    },
    title: {
        color: theme.goldLight,
        fontSize: 20,
        fontWeight: '900',
        textAlign: 'center',
        marginBottom: 8,
    },
    message: {
        color: theme.text,
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 21,
        marginBottom: 6,
    },
    row: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 14,
        width: '100%',
    },
});
