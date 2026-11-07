import React from 'react';
import { View, StyleSheet, Image, Pressable } from 'react-native';

const images = [
    require('../../assets/Galleria_01.jpg'),
    require('../../assets/Galleria_02.jpg'),
    require('../../assets/Galleria_03.jpg'),
    require('../../assets/Galleria_04.jpg'),
];

const suitOrder = { Oros: 0, Bastos: 1, Espadas: 2, Copas: 3 };
const valueOrder = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 10: 7, 11: 8, 12: 9 };

export const CARD_WIDTH = 70;
export const CARD_HEIGHT = 100;

// Position de la carte dans les planches de sprites (4 colonnes x 3 lignes)
export function spriteFor(card) {
    const sIdx = suitOrder[card?.suit] ?? 0;
    const vIdx = valueOrder[card?.value] ?? 0;
    const absIdx = sIdx * 10 + vIdx;
    const imgIndex = Math.floor(absIdx / 12);
    const posInImg = absIdx % 12;
    return {
        source: images[imgIndex],
        col: posInImg % 4,
        row: Math.floor(posInImg / 4),
        rows: imgIndex === 3 ? 1 : 3,
    };
}

// Face d'une carte (sans interaction), à n'importe quelle taille
export function CardFace({ card, width = CARD_WIDTH, height = CARD_HEIGHT, style, dimmed }) {
    const { source, col, row, rows } = spriteFor(card);
    const radius = Math.max(4, width * 0.1);
    return (
        <View style={[styles.face, { width, height, borderRadius: radius }, style]}>
            <Image
                source={source}
                style={{
                    position: 'absolute',
                    width: width * 4,
                    height: height * rows,
                    left: -col * width,
                    top: -row * height,
                }}
                resizeMode="stretch"
            />
            {/* Léger reflet pour donner du volume */}
            <View style={[styles.gloss, { borderRadius: radius }]} pointerEvents="none" />
            {dimmed && <View style={[StyleSheet.absoluteFill, styles.dim]} pointerEvents="none" />}
        </View>
    );
}

// Dos de carte : bordeaux, double filet doré, losanges et médaillon central
export function CardBack({ width = CARD_WIDTH, height = CARD_HEIGHT, style }) {
    const radius = Math.max(3, width * 0.1);
    const tiny = width < 40;
    const inset = tiny ? 2 : Math.max(3, width * 0.06);
    const medal = Math.min(width, height) * 0.42;
    return (
        <View style={[styles.back, { width, height, borderRadius: radius }, style]}>
            <View style={[styles.backFrame, { top: inset, left: inset, right: inset, bottom: inset, borderRadius: radius * 0.6 }]}>
                {!tiny && (
                    <View style={styles.lattice} pointerEvents="none">
                        {Array.from({ length: 12 }).map((_, i) => (
                            <View
                                key={i}
                                style={[
                                    styles.latticeDiamond,
                                    {
                                        width: width * 0.16,
                                        height: width * 0.16,
                                        left: `${(i % 3) * 38 + 6}%`,
                                        top: `${Math.floor(i / 3) * 26 + 4}%`,
                                    },
                                ]}
                            />
                        ))}
                    </View>
                )}
                <View style={[styles.medal, { width: medal, height: medal, borderRadius: medal / 2 }]}>
                    <View style={[styles.medalStar, { width: medal * 0.5, height: medal * 0.5 }]} />
                    <View style={[styles.medalStar, { width: medal * 0.5, height: medal * 0.5, transform: [{ rotate: '45deg' }] }]} />
                </View>
            </View>
        </View>
    );
}

// Carte cliquable simple (utilisée pour les aperçus)
export default function Card({ card, onPress, disabled, hidden, width, height, style }) {
    const content = hidden
        ? <CardBack width={width} height={height} />
        : <CardFace card={card} width={width} height={height} />;
    if (!onPress) return <View style={[styles.shadow, style]}>{content}</View>;
    return (
        <Pressable onPress={onPress} disabled={disabled} style={[styles.shadow, style]}>
            {content}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    face: {
        backgroundColor: '#FFFDF7',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.18)',
    },
    gloss: {
        ...StyleSheet.absoluteFillObject,
        borderTopWidth: 1.5,
        borderLeftWidth: 1,
        borderColor: 'rgba(255,255,255,0.7)',
    },
    dim: {
        backgroundColor: 'rgba(20, 10, 12, 0.45)',
    },
    shadow: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.35,
        shadowRadius: 4,
        elevation: 5,
    },
    back: {
        backgroundColor: '#7A1420',
        borderWidth: 1,
        borderColor: '#C9A23A',
        overflow: 'hidden',
    },
    backFrame: {
        position: 'absolute',
        borderWidth: 1,
        borderColor: 'rgba(245, 215, 122, 0.75)',
        backgroundColor: '#8E1B28',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    lattice: {
        ...StyleSheet.absoluteFillObject,
    },
    latticeDiamond: {
        position: 'absolute',
        borderWidth: 1,
        borderColor: 'rgba(245, 215, 122, 0.28)',
        transform: [{ rotate: '45deg' }],
    },
    medal: {
        backgroundColor: '#5E0F18',
        borderWidth: 1.5,
        borderColor: '#E3BF5A',
        justifyContent: 'center',
        alignItems: 'center',
    },
    medalStar: {
        position: 'absolute',
        backgroundColor: '#D4AF37',
        borderRadius: 2,
    },
});
