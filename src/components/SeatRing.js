import React from 'react';
import { View, StyleSheet } from 'react-native';

/**
 * Placement des adversaires autour de la table, sens antihoraire (le suivant est à droite).
 * Jusqu'à 5 adversaires : droite, haut-droite, haut, haut-gauche, gauche.
 */
const LAYOUTS = {
    1: ['top'],
    2: ['right', 'left'],
    3: ['right', 'top', 'left'],
    4: ['right', 'topRight', 'topLeft', 'left'],
    5: ['right', 'topRight', 'top', 'topLeft', 'left'],
};

export function seatMap(numPlayers, pivot) {
    const map = {};
    const layout = LAYOUTS[numPlayers - 1] || LAYOUTS[5];
    for (let rel = 1; rel < numPlayers; rel++) {
        map[(pivot + rel) % numPlayers] = layout[rel - 1];
    }
    map[pivot] = 'bottom';
    return map;
}

// Rangée du haut (haut-gauche, haut, haut-droite)
export function TopRow({ renderSeat, positions, height = 112 }) {
    const top = ['topLeft', 'top', 'topRight'].filter((p) => positions.includes(p));
    return (
        <View style={[styles.topRow, { height }]}>
            {top.map((p) => (
                <View key={p} style={styles.topCell}>{renderSeat(p)}</View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        alignItems: 'center',
        paddingHorizontal: 50,
    },
    topCell: {
        alignItems: 'center',
    },
});
