import React, { useState } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { theme } from './ui';
import { useCosmetics, feltFor } from '../utils/cosmetics';

// Ambiance par jeu : couleur de la vignette (bords de l'écran)
const MOOD = { hezz2: '#0B1A0E', ronda: '#1A0406', kdoub: '#1F0D04', sota: '#05030F' };

/**
 * Une table par jeu (images générées par IA, préparées par scripts/build-tables.py), vues du dessus.
 * Les tables ovales ont une version tournée pour les écrans plus hauts que larges.
 * felt : zone du tapis (fractions de l'image en paysage), pour la teinte choisie dans Personnaliser.
 *   rect : x0, y0, x1, y1 et r (arrondi, fraction du petit côté) ; circle : cx, cy, r (fraction de la largeur)
 */
const TABLES = {
    hezz2: {
        src: require('../../assets/tables/menthe.jpg'), w: 1254, h: 1254,
        felt: { circle: true, cx: 0.496, cy: 0.488, r: 0.376 },
    },
    ronda: {
        src: require('../../assets/tables/velours.jpg'), w: 1536, h: 1024,
        portrait: require('../../assets/tables/velours-portrait.jpg'),
        felt: { x0: 0.117, y0: 0.176, x1: 0.879, y1: 0.818, r: 0.18 },
    },
    kdoub: {
        src: require('../../assets/tables/cuivre.jpg'), w: 1254, h: 1254,
        felt: { circle: true, cx: 0.5, cy: 0.5, r: 0.365 },
    },
    sota: {
        src: require('../../assets/tables/neon.jpg'), w: 1600, h: 900,
        portrait: require('../../assets/tables/neon-portrait.jpg'),
        felt: { x0: 0.096, y0: 0.117, x1: 0.906, y1: 0.882, r: 0.5 },
    },
};

// Quart de tour dans le sens horaire : (x, y) -> (1 - y, x)
function rotateFelt(f) {
    if (f.circle) return { circle: true, cx: 1 - f.cy, cy: f.cx, r: f.r };
    return { x0: 1 - f.y1, x1: 1 - f.y0, y0: f.x0, y1: f.x1, r: f.r };
}

/**
 * Table de jeu commune à tous les jeux : image « cover » + teinte du tapis + vignette.
 * onSize reçoit la taille réelle du plateau (pour les mises en page portrait / paysage).
 */
export default function TableBackground({ children, onSize, tint, game = 'hezz2', feltOverride }) {
    const [size, setSize] = useState(null);
    const cos = useCosmetics();
    const felt = feltOverride || feltFor(game, cos);
    const mood = MOOD[game] || '#000';
    const table = TABLES[game] || TABLES.hezz2;

    let img = null;
    let zone = null;
    if (size) {
        const portrait = size.h > size.w * 1.1 && !!table.portrait;
        const iw = portrait ? table.h : table.w;
        const ih = portrait ? table.w : table.h;
        const scale = Math.max(size.w / iw, size.h / ih);
        const w = iw * scale;
        const h = ih * scale;
        img = { source: portrait ? table.portrait : table.src, width: w, height: h, left: (size.w - w) / 2, top: (size.h - h) / 2 };
        // Zone du tapis à l'écran (pour la teinte)
        const f = portrait ? rotateFelt(table.felt) : table.felt;
        if (f.circle) {
            const r = f.r * w;
            zone = { left: img.left + f.cx * w - r, top: img.top + f.cy * h - r, width: 2 * r, height: 2 * r, borderRadius: r };
        } else {
            const zw = (f.x1 - f.x0) * w;
            const zh = (f.y1 - f.y0) * h;
            zone = { left: img.left + f.x0 * w, top: img.top + f.y0 * h, width: zw, height: zh, borderRadius: f.r * Math.min(zw, zh) };
        }
    }
    // Tapis par défaut : la table telle quelle ; sinon, teinte appliquée au seul tapis
    const tinted = felt && felt.id !== 'default';

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
                {img && <Image source={img.source} style={{ position: 'absolute', width: img.width, height: img.height, left: img.left, top: img.top }} resizeMode="stretch" />}
                {tinted && zone && (
                    <View style={{ position: 'absolute', ...zone, backgroundColor: felt.color, opacity: felt.strength, mixBlendMode: 'color' }} />
                )}
                {tint ? <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} /> : null}
            </View>
            <Svg style={StyleSheet.absoluteFill} pointerEvents="none" width="100%" height="100%">
                <Defs>
                    <RadialGradient id="vignette" cx="50%" cy="50%" rx="75%" ry="70%">
                        <Stop offset="0.55" stopColor="#000" stopOpacity="0" />
                        <Stop offset="1" stopColor={mood} stopOpacity="0.65" />
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
