import React, { useState } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { theme } from './ui';

const TABLE_BG = require('../../assets/table.png');
// Fond cadré sur le tapis de la table (on coupe la fontaine en haut de l'image)
const TABLE_SRC = { w: 1211, h: 1536, feltTop: 400 };

/**
 * Table de jeu commune à tous les jeux : image cadrée sur le tapis + vignette.
 * onSize reçoit la taille réelle du plateau (pour les mises en page portrait / paysage).
 */
export default function TableBackground({ children, onSize, tint }) {
    const [size, setSize] = useState(null);
    let img = null;
    if (size) {
        const visibleH = TABLE_SRC.h - TABLE_SRC.feltTop;
        const scale = Math.max(size.h / visibleH, size.w / TABLE_SRC.w);
        const w = TABLE_SRC.w * scale;
        const h = TABLE_SRC.h * scale;
        img = { width: w, height: h, left: (size.w - w) / 2, top: size.h - h };
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
                {img && <Image source={TABLE_BG} style={[{ position: 'absolute' }, img]} resizeMode="stretch" />}
                {tint ? <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} /> : null}
            </View>
            <Svg style={StyleSheet.absoluteFill} pointerEvents="none" width="100%" height="100%">
                <Defs>
                    <RadialGradient id="vignette" cx="50%" cy="55%" rx="75%" ry="65%">
                        <Stop offset="0.45" stopColor="#000" stopOpacity="0" />
                        <Stop offset="1" stopColor="#000" stopOpacity="0.75" />
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
