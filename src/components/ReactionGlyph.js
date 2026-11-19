/**
 * Affichage d'une réaction : emoji offert (« 😂 ») ou réaction de la boutique (« emote:rire »),
 * qui ajoute un petit texte et, pour Menthe, l'image du verre de thé.
 */
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { cosmetic } from '../../server/progress/defs';

const IMAGES = { menthe: require('../../assets/menthe.png') };

export const emoteOf = (type) => (typeof type === 'string' && type.startsWith('emote:') ? cosmetic(type) : null);

// Texte simple (chat des spectateurs, anciennes versions)
export const reactionText = (type) => {
    const e = emoteOf(type);
    return e ? `${e.emoji} ${e.text}` : type;
};

export default function ReactionGlyph({ type, size = 26, showText = true, textColor = '#5E0F18' }) {
    const e = emoteOf(type);
    if (!e) return <Text style={{ fontSize: size }}>{type}</Text>;
    return (
        <View style={styles.wrap}>
            {e.image && IMAGES[e.image]
                ? <Image source={IMAGES[e.image]} style={{ width: size * 1.25, height: size * 1.25 }} resizeMode="contain" />
                : <Text style={{ fontSize: size }}>{e.emoji}</Text>}
            {showText && <Text style={[styles.text, { color: textColor, fontSize: Math.max(9, size * 0.42) }]} numberOfLines={1}>{e.text}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { alignItems: 'center' },
    text: { fontWeight: '900', marginTop: 1 },
});
