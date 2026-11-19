/**
 * Décor du binga et des tournois (illustrations de Yassir, découpées par scripts/build-decor.py) :
 * la pièce au pique (icône du binga) et les jetons (pique, cœur, trèfle, carreau, couronne).
 */
import React from 'react';
import { Image } from 'react-native';

export const DECOR = {
    binga: require('../../assets/decor/binga.webp'),
    pique: require('../../assets/decor/jeton_pique.webp'),
    coeur: require('../../assets/decor/jeton_coeur.webp'),
    trefle: require('../../assets/decor/jeton_trefle.webp'),
    carreau: require('../../assets/decor/jeton_carreau.webp'),
    couronne: require('../../assets/decor/jeton_couronne.webp'),
    fondRoue: require('../../assets/decor/fond_roue.webp'),
    coffres: require('../../assets/decor/coffres.webp'),
};

// Jeton par mise (salons à mise)
export const STAKE_CHIP = { 10: 'pique', 50: 'coeur', 100: 'trefle' };

export function BingaIcon({ size = 18, style }) {
    return <Image source={DECOR.binga} style={[{ width: size, height: size }, style]} accessibilityLabel="binga" />;
}

export function Chip({ name, size = 28, style }) {
    if (!DECOR[name]) return null;
    return <Image source={DECOR[name]} style={[{ width: size, height: size }, style]} />;
}
