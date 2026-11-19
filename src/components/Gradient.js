/**
 * Dégradé qui remplit son parent (vertical par défaut), dessiné en SVG.
 */
import React, { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

const cleanId = (id) => String(id).replace(/[^a-zA-Z0-9_-]/g, '');

export default function Gradient({ colors, horizontal, radius = 0, style, opacity = 1 }) {
    const id = `g${cleanId(useId())}`;
    return (
        <Svg style={[StyleSheet.absoluteFill, style]} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100" pointerEvents="none">
            <Defs>
                <LinearGradient id={id} x1="0" y1="0" x2={horizontal ? '1' : '0'} y2={horizontal ? '0' : '1'}>
                    {colors.map((c, i) => <Stop key={i} offset={i / Math.max(1, colors.length - 1)} stopColor={c} stopOpacity={opacity} />)}
                </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100" height="100" rx={radius} fill={`url(#${id})`} />
        </Svg>
    );
}

