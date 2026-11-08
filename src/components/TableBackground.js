import React, { useState } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { theme } from './ui';
import { useCosmetics, feltFor } from '../utils/cosmetics';

// Ambiance par jeu : couleur de la vignette (bords de l'écran)
const MOOD = { hezz2: '#2A1206', ronda: '#020817', kdoub: '#1F0204', sota: '#0E0220' };

const TABLE_BG = require('../../assets/table.png');
// Fond cadré sur le tapis de la table (on coupe la fontaine en haut de l'image)
const TABLE_SRC = { w: 1211, h: 1536, feltTop: 400 };
// Coffret de cartes décoratif (coordonnées dans l'image) : gardé dans ses couleurs d'origine
const BOX = { x: 335, y: 495, w: 515, h: 220 };

/**
 * Table de jeu commune à tous les jeux : image cadrée sur le tapis + vignette.
 * onSize reçoit la taille réelle du plateau (pour les mises en page portrait / paysage).
 */
export default function TableBackground({ children, onSize, tint, game = 'hezz2', feltOverride }) {
    const [size, setSize] = useState(null);
    const cos = useCosmetics();
    const felt = feltOverride || feltFor(game, cos);
    const mood = MOOD[game] || '#000';
    let img = null;
    if (size) {
        const visibleH = TABLE_SRC.h - TABLE_SRC.feltTop;
        const scale = Math.max(size.h / visibleH, size.w / TABLE_SRC.w);
        const w = TABLE_SRC.w * scale;
        const h = TABLE_SRC.h * scale;
        img = { width: w, height: h, left: (size.w - w) / 2, top: size.h - h, scale };
    }
    return (
        <View
            style={styles.container}
            onLayout={(e) => {
                const next = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height };
                setSize(next);
                onSize && onSize(next);
            }}
        >
            {/* L'image déborde volontairement : on la clippe dans son propre calque pour que
                le plateau ne devienne jamais "défilable" sur le web */}
            <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents="none">
                {img && <Image source={TABLE_BG} style={{ position: 'absolute', width: img.width, height: img.height, left: img.left, top: img.top }} resizeMode="stretch" />}
                {/* Tapis du jeu : on recolore la table en gardant ses motifs (fusion "color") */}
                {felt && <View style={[StyleSheet.absoluteFill, { backgroundColor: felt.color, opacity: felt.strength, mixBlendMode: 'color' }]} />}
                {tint ? <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} /> : null}
                {img && felt && (
                    <View style={{ position: 'absolute', overflow: 'hidden', left: img.left + BOX.x * img.scale, top: img.top + BOX.y * img.scale, width: BOX.w * img.scale, height: BOX.h * img.scale }}>
                        <Image source={TABLE_BG} style={{ position: 'absolute', width: img.width, height: img.height, left: -BOX.x * img.scale, top: -BOX.y * img.scale }} resizeMode="stretch" />
                    </View>
                )}
            </View>
            <Svg style={StyleSheet.absoluteFill} pointerEvents="none" width="100%" height="100%">
                <Defs>
                    <RadialGradient id="vignette" cx="50%" cy="55%" rx="75%" ry="65%">
                        <Stop offset="0.45" stopColor="#000" stopOpacity="0" />
                        <Stop offset="1" stopColor={mood} stopOpacity="0.8" />
                    </RadialGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#vignette)" />
            </Svg>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.bg,
        overflow: 'hidden',
    },
});
