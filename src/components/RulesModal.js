import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';

export default function RulesModal({ visible, onClose }) {
    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>📜 Règles : Jeben Gere3</Text>

                    <ScrollView style={styles.scrollView}>
                        <Text style={styles.sectionTitle}>🎯 But du jeu</Text>
                        <Text style={styles.text}>
                            Être le premier joueur à se débarrasser de toutes ses cartes. Le dernier joueur avec des cartes est le "Khasser" (Perdant) et est remplacé par un spectateur !
                        </Text>

                        <Text style={styles.sectionTitle}>⏳ Chronomètre de 15s</Text>
                        <Text style={styles.text}>
                            Vous avez <Text style={styles.highlight}>15 secondes</Text> maximum pour jouer à chaque tour ! Si le temps est écoulé, vous êtes pénalisé et piochez automatiquement une carte au hasard.
                        </Text>

                        <Text style={styles.sectionTitle}>🃏 Cartes Spéciales</Text>

                        <View style={styles.ruleItem}>
                            <Text style={styles.ruleIcon}>1️⃣</Text>
                            <View style={styles.ruleTextContainer}>
                                <Text style={styles.ruleName}>Carte 1</Text>
                                <Text style={styles.ruleDesc}>Le joueur suivant saute son tour.</Text>
                            </View>
                        </View>

                        <View style={styles.ruleItem}>
                            <Text style={styles.ruleIcon}>2️⃣</Text>
                            <View style={styles.ruleTextContainer}>
                                <Text style={styles.ruleName}>Carte 2</Text>
                                <Text style={styles.ruleDesc}>Le joueur suivant doit piocher 2 cartes, SAUF s'il possède lui aussi un 2 pour contrer et renvoyer la pénalité au suivant (+4, +6...).</Text>
                            </View>
                        </View>

                        <View style={styles.ruleItem}>
                            <Text style={styles.ruleIcon}>7️⃣</Text>
                            <View style={styles.ruleTextContainer}>
                                <Text style={styles.ruleName}>Carte 7</Text>
                                <Text style={styles.ruleDesc}>Permet de changer la famille (Couleur) en cours. Peut être jouée sur n'importe quelle carte !</Text>
                            </View>
                        </View>
                    </ScrollView>

                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Text style={styles.closeButtonText}>J'AI COMPRIS</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#2F1218',
        borderRadius: 20,
        width: '100%',
        maxHeight: '80%',
        padding: 20,
        borderWidth: 2,
        borderColor: '#D4AF37',
    },
    modalTitle: {
        color: '#D4AF37',
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#4A0E1A',
        paddingBottom: 10,
    },
    scrollView: {
        marginBottom: 20,
    },
    sectionTitle: {
        color: '#FCD34D',
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 15,
        marginBottom: 5,
    },
    text: {
        color: '#E5E7EB',
        fontSize: 15,
        lineHeight: 22,
    },
    highlight: {
        color: '#EF4444',
        fontWeight: 'bold',
    },
    ruleItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: 10,
        backgroundColor: '#4A0E1A',
        padding: 10,
        borderRadius: 8,
    },
    ruleIcon: {
        fontSize: 24,
        marginRight: 10,
    },
    ruleTextContainer: {
        flex: 1,
    },
    ruleName: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
    ruleDesc: {
        color: '#D1D5DB',
        fontSize: 14,
        marginTop: 2,
    },
    closeButton: {
        backgroundColor: '#D4AF37',
        padding: 15,
        borderRadius: 12,
        alignItems: 'center',
    },
    closeButtonText: {
        color: '#1C0F13',
        fontWeight: '900',
        fontSize: 16,
    },
});
