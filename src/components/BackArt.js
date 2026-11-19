/**
 * Dessins des dos de cartes de la boutique : chaque dos a son motif propre (pas une simple couleur).
 * Vectoriel, sans fichier à charger. Le motif est dessiné dans un cadre de 60 × 90, étiré à la taille de la carte.
 */
import React, { memo } from 'react';
import Svg, { Path, Circle, Rect, Polygon, G, Defs, LinearGradient, Stop, RadialGradient } from 'react-native-svg';

// Étoile à 8 branches (zellige), centrée en (cx, cy)
function star8(cx, cy, r) {
    const pts = [];
    for (let i = 0; i < 16; i++) {
        const a = (Math.PI / 8) * i - Math.PI / 2;
        const rr = i % 2 === 0 ? r : r * 0.62;
        pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`);
    }
    return pts.join(' ');
}

// Feuille de menthe (pointe en haut), centrée en (0, 0), longueur ~10
const LEAF = 'M0 -6 C 3.6 -3.4 3.6 3 0 6 C -3.6 3 -3.6 -3.4 0 -6 Z';

function Zellige({ pal }) {
    const cells = [];
    for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 4; col++) {
            const cx = col * 18 + (row % 2 ? 9 : 0);
            const cy = row * 20 + 4;
            cells.push(<Polygon key={`${row}-${col}`} points={star8(cx, cy, 8)} fill={row % 2 ? pal.lattice : 'none'} stroke={pal.line} strokeWidth={0.8} />);
        }
    }
    return <G>{cells}</G>;
}

function Waves({ pal }) {
    const lines = [];
    for (let i = 0; i < 12; i++) {
        const y = i * 8 + 2;
        const amp = 2.6;
        lines.push(
            <Path
                key={i}
                d={`M-5 ${y} Q 2.5 ${y - amp} 10 ${y} T 25 ${y} T 40 ${y} T 55 ${y} T 70 ${y}`}
                stroke={i % 3 === 0 ? pal.star : pal.lattice}
                strokeWidth={i % 3 === 0 ? 1.4 : 0.9}
                fill="none"
                opacity={i % 3 === 0 ? 0.9 : 0.7}
            />,
        );
    }
    return <G>{lines}</G>;
}

function Dunes({ pal }) {
    return (
        <G>
            <Circle cx={44} cy={18} r={9} fill={pal.star} opacity={0.85} />
            <Path d="M-2 46 C 14 34 26 40 38 46 C 48 51 56 44 62 40 L62 92 L-2 92 Z" fill={pal.frame} opacity={0.9} />
            <Path d="M-2 58 C 10 50 24 52 34 60 C 44 67 54 58 62 54 L62 92 L-2 92 Z" fill={pal.lattice} opacity={0.75} />
            <Path d="M-2 72 C 12 64 22 68 32 74 C 44 80 52 72 62 70 L62 92 L-2 92 Z" fill={pal.medal} opacity={0.7} />
            <Path d="M-2 46 C 14 34 26 40 38 46 C 48 51 56 44 62 40" stroke={pal.line} strokeWidth={0.8} fill="none" />
            <Path d="M-2 72 C 12 64 22 68 32 74 C 44 80 52 72 62 70" stroke={pal.line} strokeWidth={0.7} fill="none" />
        </G>
    );
}

function Neon({ pal }) {
    const glow = (d, color, k) => (
        <G key={k}>
            <Path d={d} stroke={color} strokeWidth={3.2} opacity={0.22} fill="none" />
            <Path d={d} stroke={color} strokeWidth={0.9} fill="none" />
        </G>
    );
    const out = [];
    for (let i = -4; i < 8; i++) out.push(glow(`M${i * 12} 0 L${i * 12 + 60} 90`, i % 2 ? pal.lattice : pal.border, `a${i}`));
    out.push(glow('M6 6 H54 V84 H6 Z', pal.border, 'frame'));
    return <G>{out}</G>;
}

function Velvet({ pal }) {
    return (
        <G>
            <Defs>
                <LinearGradient id="fold" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor="#000" stopOpacity={0.45} />
                    <Stop offset="0.5" stopColor="#fff" stopOpacity={0.12} />
                    <Stop offset="1" stopColor="#000" stopOpacity={0.45} />
                </LinearGradient>
            </Defs>
            {Array.from({ length: 6 }).map((_, i) => <Rect key={i} x={i * 10} y={0} width={10} height={90} fill="url(#fold)" />)}
            <Path d="M0 0 H60 V8 Q 52 14 45 8 Q 37 14 30 8 Q 22 14 15 8 Q 7 14 0 8 Z" fill={pal.border} opacity={0.85} />
            <Path d="M0 90 H60 V82 Q 52 76 45 82 Q 37 76 30 82 Q 22 76 15 82 Q 7 76 0 82 Z" fill={pal.border} opacity={0.85} />
        </G>
    );
}

function Leaves({ pal }) {
    const out = [];
    for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 4; col++) {
            const x = col * 16 + (row % 2 ? 8 : 2);
            const y = row * 16 + 6;
            const rot = ((row * 4 + col) * 47) % 360;
            out.push(
                <G key={`${row}-${col}`} transform={`translate(${x} ${y}) rotate(${rot})`}>
                    <Path d={LEAF} fill={pal.lattice} stroke={pal.line} strokeWidth={0.5} />
                    <Path d="M0 -5 L0 5" stroke={pal.line} strokeWidth={0.4} />
                </G>,
            );
        }
    }
    return <G>{out}</G>;
}

function Hammered({ pal }) {
    const out = [];
    let k = 0;
    for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 7; col++) {
            const x = col * 9 + (row % 2 ? 4.5 : 0);
            const y = row * 9.5 + 2;
            const r = 2.6 + ((row * 7 + col) % 3) * 0.6;
            out.push(<Circle key={k++} cx={x} cy={y} r={r} fill="none" stroke={pal.line} strokeWidth={0.5} opacity={0.65} />);
            out.push(<Circle key={k++} cx={x - r * 0.35} cy={y - r * 0.35} r={r * 0.35} fill={pal.border} opacity={0.35} />);
        }
    }
    return <G>{out}</G>;
}

function Sunburst({ pal }) {
    const rays = [];
    for (let i = 0; i < 24; i++) {
        const a1 = (Math.PI * 2 * i) / 24;
        const a2 = a1 + Math.PI / 24;
        const p = (a) => `${(30 + 80 * Math.cos(a)).toFixed(1)},${(45 + 80 * Math.sin(a)).toFixed(1)}`;
        if (i % 2 === 0) rays.push(<Polygon key={i} points={`30,45 ${p(a1)} ${p(a2)}`} fill={pal.lattice} />);
    }
    return <G>{rays}</G>;
}

// Or : feuille d'or avec arabesques et reflets
function Arabesque({ pal }) {
    const out = [];
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 3; col++) {
            const x = col * 20 + 10;
            const y = row * 24 + 9;
            out.push(
                <G key={`${row}-${col}`} transform={`translate(${x} ${y})`}>
                    <Path d="M0 -9 C 6 -9 9 -4 9 0 C 9 4 6 9 0 9 C -6 9 -9 4 -9 0 C -9 -4 -6 -9 0 -9 Z" fill="none" stroke={pal.lattice} strokeWidth={0.9} />
                    <Path d="M0 -9 C 2 -3 2 3 0 9 M-9 0 C -3 -2 3 -2 9 0" stroke={pal.lattice} strokeWidth={0.7} fill="none" />
                    <Circle r={1.6} fill={pal.star} />
                </G>,
            );
        }
    }
    return (
        <G>
            <Defs>
                <LinearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor="#fff" stopOpacity={0} />
                    <Stop offset="0.45" stopColor="#fff" stopOpacity={0.35} />
                    <Stop offset="0.55" stopColor="#fff" stopOpacity={0} />
                </LinearGradient>
            </Defs>
            {out}
            <Rect x={0} y={0} width={60} height={90} fill="url(#sheen)" />
        </G>
    );
}

const PATTERNS = { zellige: Zellige, waves: Waves, dunes: Dunes, neon: Neon, velvet: Velvet, leaf: Leaves, hammered: Hammered, sunburst: Sunburst, arabesque: Arabesque };

export const BackPattern = memo(function BackPattern({ pal, width, height }) {
    const Draw = PATTERNS[pal.pattern];
    if (!Draw) return null;
    return (
        <Svg width={width} height={height} viewBox="0 0 60 90" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
            <Draw pal={pal} />
        </Svg>
    );
});

// Médaillon central : soleil, lune, feuille, vague, anneau, couronne
export const MedalIcon = memo(function MedalIcon({ icon, size, pal }) {
    const c = pal.star;
    let body = null;
    switch (icon) {
        case 'sun':
            body = (
                <G>
                    {Array.from({ length: 12 }).map((_, i) => <Rect key={i} x={19} y={2} width={2} height={8} fill={c} transform={`rotate(${i * 30} 20 20)`} />)}
                    <Circle cx={20} cy={20} r={8} fill={c} />
                </G>
            );
            break;
        case 'moon':
            body = (
                <G>
                    <Path d="M26 6 A 14 14 0 1 0 26 34 A 11 11 0 1 1 26 6 Z" fill={c} />
                    <Polygon points={star8(29, 20, 5)} fill={c} />
                </G>
            );
            break;
        case 'leaf':
            body = (
                <G transform="translate(20 20) scale(2.4) rotate(35)">
                    <Path d={LEAF} fill={c} />
                    <Path d="M0 -5 L0 5" stroke={pal.medal} strokeWidth={0.5} />
                </G>
            );
            break;
        case 'wave':
            body = <Path d="M4 24 Q 10 12 18 18 Q 24 23 22 14 Q 32 14 36 26 Q 28 22 24 28 Q 14 34 4 24 Z" fill={c} />;
            break;
        case 'ring':
            body = (
                <G>
                    <Circle cx={20} cy={20} r={12} stroke={c} strokeWidth={5} opacity={0.25} fill="none" />
                    <Circle cx={20} cy={20} r={12} stroke={c} strokeWidth={1.8} fill="none" />
                    <Circle cx={20} cy={20} r={4} fill={pal.medalBorder} />
                </G>
            );
            break;
        case 'crown':
            body = (
                <G>
                    <Path d="M6 30 L4 12 L13 20 L20 8 L27 20 L36 12 L34 30 Z" fill={c} />
                    <Rect x={6} y={31} width={28} height={3} fill={c} />
                    <Circle cx={20} cy={23} r={2.6} fill={pal.bg} />
                </G>
            );
            break;
        default:
            return null;
    }
    // Identifiant propre à la couleur (sur le web, deux dégradés de même nom se confondraient)
    const gid = `mg-${icon}-${String(c).replace(/[^a-zA-Z0-9]/g, '')}`;
    return (
        <Svg width={size} height={size} viewBox="0 0 40 40">
            <Defs>
                <RadialGradient id={gid} cx="50%" cy="50%" r="50%">
                    <Stop offset="0" stopColor={c} stopOpacity={0.25} />
                    <Stop offset="1" stopColor={c} stopOpacity={0} />
                </RadialGradient>
            </Defs>
            <Circle cx={20} cy={20} r={20} fill={`url(#${gid})`} />
            {body}
        </Svg>
    );
});
