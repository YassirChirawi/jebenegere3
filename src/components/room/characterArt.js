/**
 * Dessins des personnages assis (fournis par Yassir, un par portrait du Profil), découpés par
 * scripts/build-characters.py dans assets/characters/cXX/. Clé : numéro du portrait (0 à 35, comme avatar_XX.webp).
 *
 *   body       : buste assis dans une boîte largeur x 1,05 (avec la tête si le personnage n'a pas de tête séparée)
 *   head       : tête yeux ouverts, posée sur le buste dans la boîte headBox (fractions [x, y, largeur, hauteur]) ;
 *                elle bouge seule (pivot au cou) et cligne avec headBlink
 *   hands      : { open, hold, point } (lots 2 et 3)
 *
 * Sans entrée : corps provisoire avec le portrait comme tête (Character.js). Le code d'animation est le même.
 */
import generated from './characterArt.generated.json';

const box = (i) => generated[String(i)]?.head || null;

export const CHARACTER_ART = {
    // Avatar 1 : homme au fez (planche complète : buste, tête, yeux fermés, mains)
    0: {
        body: require('../../../assets/characters/c00/body.webp'),
        head: require('../../../assets/characters/c00/head.webp'),
        headBlink: require('../../../assets/characters/c00/head-blink.webp'),
        headBox: box(0),
        hands: {
            open: require('../../../assets/characters/c00/hand-open.webp'),
            hold: require('../../../assets/characters/c00/hand-hold.webp'),
            point: require('../../../assets/characters/c00/hand-point.webp'),
        },
    },
    // Avatar 2 : femme au foulard bleu (buste seul, tête comprise : pas de clignement)
    1: {
        body: require('../../../assets/characters/c01/body.webp'),
    },
};

// Position de la tête du corps provisoire (fractions de la boîte du personnage)
export const DEFAULT_ANCHOR = { headX: 0.5, headY: 0.33, headSize: 0.64, shoulderY: 0.62 };
