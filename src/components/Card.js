import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import Animated, { LinearTransition, FadeIn, FadeOut } from 'react-native-reanimated';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

const img1 = require('../../assets/Galleria_01.jpg');
const img2 = require('../../assets/Galleria_02.jpg');
const img3 = require('../../assets/Galleria_03.jpg');
const img4 = require('../../assets/Galleria_04.jpg');
const images = [img1, img2, img3, img4];

const suitOrder = { Oros: 0, Bastos: 1, Espadas: 2, Copas: 3 };
const valueOrder = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 10: 7, 11: 8, 12: 9 };

// Dimensions de chaque carte à l'écran
const CARD_WIDTH = 70;
const CARD_HEIGHT = 100;

export default function Card({ card, onPress, disabled, hidden }) {
    if (hidden) {
        return (
            <Animated.View
                style={[styles.cardContainer, styles.hiddenCard, disabled && styles.disabled]}
                layout={LinearTransition.springify().damping(14)}
                entering={FadeIn}
                leaving={FadeOut}
            >
                <View style={styles.hiddenInner}>
                    <Text style={styles.hiddenText}>Hezz2</Text>
                </View>
            </Animated.View>
        );
    }

    const sIdx = suitOrder[card.suit] !== undefined ? suitOrder[card.suit] : 0;
    const vIdx = valueOrder[card.value] !== undefined ? valueOrder[card.value] : 0;

    // Index absolu de la carte de 0 à 39 dans l'ordre (Oros, Bastos, Espadas, Copas)
    const absIdx = sIdx * 10 + vIdx;

    // Chaque image (sauf la dernière) contient 12 cartes (3 lignes x 4 colonnes)
    const imgIndex = Math.floor(absIdx / 12);
    const posInImg = absIdx % 12;

    const col = posInImg % 4;
    const row = Math.floor(posInImg / 4);

    // L'image 4 n'a qu'une seule ligne, les autres en ont 3
    const numRows = imgIndex === 3 ? 1 : 3;

    return (
        <AnimatedTouchableOpacity
            style={[styles.cardContainer, disabled && styles.disabled]}
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.7}
            layout={LinearTransition.springify().damping(14)}
            entering={FadeIn}
            leaving={FadeOut}
        >
            <View style={styles.spriteContainer}>
                <Image
                    source={images[imgIndex]}
                    style={[
                        styles.spriteImage,
                        {
                            width: CARD_WIDTH * 4,
                            height: CARD_HEIGHT * numRows,
                            transform: [
                                { translateX: -col * CARD_WIDTH },
                                { translateY: -row * CARD_HEIGHT }
                            ]
                        }
                    ]}
                    resizeMode="stretch"
                />
            </View>
        </AnimatedTouchableOpacity>
    );
}

const styles = StyleSheet.create({
    cardContainer: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginHorizontal: 4,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 3,
    },
    spriteContainer: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        overflow: 'hidden',
    },
    spriteImage: {
        position: 'absolute',
        top: 0,
        left: 0,
    },
    hiddenCard: {
        backgroundColor: '#E2E8F0',
        borderColor: '#94A3B8',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 4,
    },
    hiddenInner: {
        width: '100%',
        height: '100%',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderStyle: 'dashed',
        borderRadius: 4,
        justifyContent: 'center',
        alignItems: 'center',
    },
    hiddenText: {
        fontSize: 12,
        color: '#94A3B8',
        transform: [{ rotate: '-45deg' }],
        fontWeight: 'bold',
    },
    disabled: {
        opacity: 0.5,
    },
});
