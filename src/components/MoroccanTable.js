import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, Pattern, Rect, Polygon, Path, Circle, LinearGradient, RadialGradient, Stop } from 'react-native-svg';

/**
 * Table marocaine dessinée (SVG, aucun fichier image) :
 * - cadre en bois de cèdre avec clous en laiton ;
 * - bande de zellige (étoiles à 8 branches) ;
 * - centre en tapis rouge à losanges, avec une rosace discrète.
 * Se place en fond (position absolue) derrière les cartes de la table.
 */
const FRAME = 10; // bois
const BAND = 11; // zellige
const R = 26; // arrondi des coins

// Étoile à 8 branches (khatem) centrée en (cx, cy)
function star8(cx, cy, r, inner = 0.62) {
    const pts = [];
    for (let i = 0; i < 16; i++) {
        const a = (Math.PI / 8) * i - Math.PI / 2;
        const rr = i % 2 === 0 ? r : r * inner;
        pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`);
    }
    return pts.join(' ');
}

function rrect(x, y, w, h, r) {
    return `M${x + r},${y} H${x + w - r} A${r},${r} 0 0 1 ${x + w},${y + r} V${y + h - r} A${r},${r} 0 0 1 ${x + w - r},${y + h} H${x + r} A${r},${r} 0 0 1 ${x},${y + h - r} V${y + r} A${r},${r} 0 0 1 ${x + r},${y} Z`;
}

export default function MoroccanTable({ style }) {
    const [size, setSize] = useState(null);
    const onLayout = (e) => {
        const { width, height } = e.nativeEvent.layout;
        if (!size || Math.abs(size.w - width) > 1 || Math.abs(size.h - height) > 1) setSize({ w: width, h: height });
    };
    const w = size?.w || 0;
    const h = size?.h || 0;

    // Clous en laiton le long du cadre
    const studs = [];
    if (w > 0) {
        const step = 46;
        const nx = Math.max(2, Math.floor((w - 2 * R) / step));
        const ny = Math.max(1, Math.floor((h - 2 * R) / step));
        for (let i = 0; i <= nx; i++) {
            const x = R + ((w - 2 * R) * i) / nx;
            studs.push([x, FRAME / 2], [x, h - FRAME / 2]);
        }
        for (let j = 0; j <= ny; j++) {
            const y = R + ((h - 2 * R) * j) / ny;
            studs.push([FRAME / 2, y], [w - FRAME / 2, y]);
        }
    }

    const i1 = FRAME;
    const i2 = FRAME + BAND;
    const cx = w / 2;
    const cy = h / 2;
    const medal = Math.min(w, h) * 0.3;

    return (
        <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none" onLayout={onLayout}>
            {w > 0 && (
                <Svg width={w} height={h}>
                    <Defs>
                        <LinearGradient id="mtWood" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor="#7A4320" />
                            <Stop offset="0.5" stopColor="#5A2E14" />
                            <Stop offset="1" stopColor="#3A1C0B" />
                        </LinearGradient>
                        <RadialGradient id="mtRug" cx="50%" cy="50%" rx="60%" ry="60%">
                            <Stop offset="0" stopColor="#9A2A2A" />
                            <Stop offset="0.7" stopColor="#7A1C20" />
                            <Stop offset="1" stopColor="#5C1418" />
                        </RadialGradient>
                        <Pattern id="mtZellige" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
                            <Rect x="0" y="0" width="16" height="16" fill="#0F5E5A" />
                            <Polygon points={star8(8, 8, 6.2)} fill="#F3E9D2" />
                            <Polygon points={star8(8, 8, 2.6, 0.55)} fill="#1F4E8C" />
                            <Rect x="-1.6" y="-1.6" width="3.2" height="3.2" fill="#C9A227" transform="rotate(45 0 0)" />
                            <Rect x="14.4" y="14.4" width="3.2" height="3.2" fill="#C9A227" transform="rotate(45 16 16)" />
                        </Pattern>
                        <Pattern id="mtLattice" x="0" y="0" width="26" height="26" patternUnits="userSpaceOnUse">
                            <Path d="M13 0 L26 13 L13 26 L0 13 Z" fill="none" stroke="#E8C66A" strokeOpacity="0.16" strokeWidth="1" />
                            <Circle cx="13" cy="13" r="1.4" fill="#E8C66A" fillOpacity="0.18" />
                        </Pattern>
                    </Defs>

                    {/* Cadre en bois */}
                    <Path d={rrect(0, 0, w, h, R)} fill="url(#mtWood)" stroke="#24110A" strokeWidth={1.5} />
                    <Path d={rrect(2, 2, w - 4, h - 4, R - 2)} fill="none" stroke="#A8693A" strokeOpacity={0.45} strokeWidth={1} />

                    {/* Bande de zellige */}
                    <Path d={rrect(i1, i1, w - 2 * i1, h - 2 * i1, R - i1 / 2)} fill="url(#mtZellige)" />
                    <Path d={rrect(i1, i1, w - 2 * i1, h - 2 * i1, R - i1 / 2)} fill="none" stroke="#C9A227" strokeWidth={1.2} />

                    {/* Tapis */}
                    <Path d={rrect(i2, i2, w - 2 * i2, h - 2 * i2, Math.max(6, R - i2 / 2))} fill="url(#mtRug)" />
                    <Path d={rrect(i2, i2, w - 2 * i2, h - 2 * i2, Math.max(6, R - i2 / 2))} fill="url(#mtLattice)" />
                    <Path d={rrect(i2 + 5, i2 + 5, w - 2 * i2 - 10, h - 2 * i2 - 10, Math.max(4, R - i2 / 2 - 4))} fill="none" stroke="#E8C66A" strokeOpacity={0.35} strokeWidth={1} strokeDasharray="6 4" />
                    <Path d={rrect(i2, i2, w - 2 * i2, h - 2 * i2, Math.max(6, R - i2 / 2))} fill="none" stroke="#C9A227" strokeWidth={1.4} />

                    {/* Rosace centrale */}
                    <Polygon points={star8(cx, cy, medal / 2)} fill="none" stroke="#E8C66A" strokeOpacity={0.22} strokeWidth={1.5} />
                    <Polygon points={star8(cx, cy, medal / 3.2)} fill="#E8C66A" fillOpacity={0.07} stroke="#E8C66A" strokeOpacity={0.18} strokeWidth={1} />

                    {/* Clous en laiton */}
                    {studs.map(([x, y], k) => (
                        <React.Fragment key={k}>
                            <Circle cx={x} cy={y} r={2.6} fill="#D9B44A" stroke="#6E5313" strokeWidth={0.8} />
                            <Circle cx={x - 0.8} cy={y - 0.8} r={0.9} fill="#FFF3C4" fillOpacity={0.8} />
                        </React.Fragment>
                    ))}
                </Svg>
            )}
        </View>
    );
}

export const TABLE_INSET = FRAME + BAND + 6;
