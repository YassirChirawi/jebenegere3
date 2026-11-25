/**
 * Salle commune (Animations 3D) : mur chaud, fenêtres marocaines floutées et lampes douces, derrière la table.
 * Même décor pour tous les joueurs de la partie ; seule la couleur du mur suit le jeu.
 * Dessin fixe (SVG), aucune animation : rien ne coûte pendant la partie.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect, Path, Ellipse, G } from 'react-native-svg';

const WALL = {
    hezz2: ['#3B2414', '#160C06'],
    ronda: ['#3E1A12', '#160606'],
    kdoub: ['#40230F', '#170A04'],
    sota: ['#2A1838', '#0C0614'],
};

// Fenêtre en arc outrepassé (forme marocaine), dans une boîte 100 x 160
const ARCH = 'M10 160 L10 70 C10 30 30 8 50 4 C70 8 90 30 90 70 L90 160 Z';

export default function RoomBackdrop({ w, h, game = 'hezz2' }) {
    const [top, bottom] = WALL[game] || WALL.hezz2;
    // Trois fenêtres sur le mur du fond (en haut de l'écran, derrière la table inclinée)
    const winH = Math.min(h * 0.34, 260);
    const winW = winH * 0.62;
    const xs = w > h ? [0.2, 0.5, 0.8] : [0.18, 0.5, 0.82];
    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg width={w} height={h}>
                <Defs>
                    <LinearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={top} />
                        <Stop offset="0.55" stopColor={bottom} />
                        <Stop offset="1" stopColor="#050302" />
                    </LinearGradient>
                    <LinearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor="#FFD9A0" stopOpacity="0.32" />
                        <Stop offset="1" stopColor="#7A3A1A" stopOpacity="0.05" />
                    </LinearGradient>
                    <RadialGradient id="lamp" cx="50%" cy="50%" rx="50%" ry="50%">
                        <Stop offset="0" stopColor="#FFC56B" stopOpacity="0.55" />
                        <Stop offset="0.4" stopColor="#FF9F3A" stopOpacity="0.18" />
                        <Stop offset="1" stopColor="#FF9F3A" stopOpacity="0" />
                    </RadialGradient>
                    <RadialGradient id="tableLight" cx="50%" cy="50%" rx="50%" ry="50%">
                        <Stop offset="0" stopColor="#FFCF7A" stopOpacity="0.16" />
                        <Stop offset="1" stopColor="#FFCF7A" stopOpacity="0" />
                    </RadialGradient>
                </Defs>
                <Rect x="0" y="0" width={w} height={h} fill="url(#wall)" />
                {/* Fenêtres floutées : contour doux + vitre lumineuse */}
                {xs.map((fx) => (
                    <G key={fx} x={w * fx - winW / 2} y={h * 0.02} scale={winW / 100}>
                        <Path d={ARCH} fill="#000" opacity={0.25} transform="translate(-4 -4) scale(1.08)" />
                        <Path d={ARCH} fill="url(#glass)" />
                        <Path d="M50 6 L50 160 M10 92 L90 92" stroke="#2A160A" strokeWidth="3" opacity={0.35} />
                    </G>
                ))}
                {/* Lampes suspendues (halo chaud) */}
                <Ellipse cx={w * 0.08} cy={h * 0.1} rx={w * 0.22} ry={h * 0.16} fill="url(#lamp)" />
                <Ellipse cx={w * 0.92} cy={h * 0.1} rx={w * 0.22} ry={h * 0.16} fill="url(#lamp)" />
                <Ellipse cx={w * 0.5} cy={h * 0.55} rx={w * 0.6} ry={h * 0.45} fill="url(#tableLight)" />
            </Svg>
        </View>
    );
}

// Inclinaison de la table (vue légèrement plongeante) : le haut part au loin, le bas vient vers le joueur
export const TABLE_TILT = (h) => [{ perspective: 1200 }, { translateY: h * 0.05 }, { rotateX: '24deg' }, { scale: 1.06 }];
