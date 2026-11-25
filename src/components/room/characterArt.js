/**
 * Dessins des personnages en corps entier (fournis par Yassir, un par portrait du Profil).
 * Clé : numéro du portrait (0 à 35, comme assets/avatars/avatar_XX.webp).
 *
 * Chaque entrée, quand les images arrivent (PNG détourés puis convertis en WebP par un script) :
 *   body       : corps assis, sans la tête ni les bras
 *   head       : tête, yeux ouverts
 *   headBlink  : même tête, yeux fermés (clignement)
 *   armL, armR : bras gauche et droit (épaule en haut, pour pivoter)
 *   hand       : { open, hold, point } (lots 2 et 3)
 *   anchor     : position de la tête et des épaules sur le corps (fractions), si différente de la valeur par défaut
 *
 * Tant qu'un portrait n'a pas d'entrée, Character dessine un corps provisoire avec le portrait comme tête :
 * le code d'animation est le même, seules les images changent.
 */
export const CHARACTER_ART = {
    // 0: {
    //     body: require('../../../assets/characters/c00/body.webp'),
    //     head: require('../../../assets/characters/c00/head.webp'),
    //     headBlink: require('../../../assets/characters/c00/head-blink.webp'),
    //     armL: require('../../../assets/characters/c00/arm-l.webp'),
    //     armR: require('../../../assets/characters/c00/arm-r.webp'),
    // },
};

// Position par défaut des morceaux sur le corps (fractions de la boîte du personnage)
export const DEFAULT_ANCHOR = { headX: 0.5, headY: 0.33, headSize: 0.64, shoulderY: 0.62 };
