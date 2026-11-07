import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import audioService from '../network/audioService';

// Règles de la Ronda (version V1 de l'app)
function RondaRules() {
    const Item = ({ icon, name, desc }) => (
        <View style={styles.ruleItem}>
            <Text style={styles.ruleIcon}>{icon}</Text>
            <View style={styles.ruleTextContainer}>
                <Text style={styles.ruleName}>{name}</Text>
                <Text style={styles.ruleDesc}>{desc}</Text>
            </View>
        </View>
    );
    return (
        <>
            <Text style={styles.sectionTitle}>🎯 But du jeu</Text>
            <Text style={styles.text}>
                Ramasser un maximum de cartes et de points. Premier camp à <Text style={styles.highlight}>41 points</Text> gagne. En 1 contre 1 ou en 2 contre 2 (coéquipiers face à face, cartes et points en commun).
            </Text>

            <Text style={styles.sectionTitle}>🃏 Distribution</Text>
            <Text style={styles.text}>
                Table vide au départ. 3 cartes, puis 3, puis 4 par joueur (en 1 contre 1, ce cycle se fait deux fois). Chacun pose une carte à son tour, 15 secondes maximum.
            </Text>

            <Text style={styles.sectionTitle}>🍽️ Manger</Text>
            <Text style={styles.text}>
                Une carte de même valeur qu'une carte de la table la ramasse, avec la suite qui la prolonge (1, 2, 3… 7, 10, 11, 12).{'\n'}
                Exemple : ton 3 prend le 3, puis le 4 et le 5 s'ils sont sur la table. Un 7 prend 7, 10, 11. Sinon, ta carte reste sur la table.
            </Text>

            <Text style={styles.sectionTitle}>💥 Coups spéciaux</Text>
            <Item icon="👊" name="Darba (+1)" desc="Tu prends la carte que l'adversaire vient juste de poser." />
            <Item icon="🔥" name="Hbel (+5)" desc="Tu rejoues la même valeur juste après une darba : tu reprends les 3 cartes." />
            <Item icon="💣" name="B'achra (+10)" desc="Le 4e exemplaire joué à la suite (darba, hbel puis b'achra) : tu reprends les 4 cartes." />
            <Item icon="🧹" name="Missa (+1)" desc="Tu vides toute la table d'un coup (sauf la toute dernière prise de la manche)." />

            <Text style={styles.sectionTitle}>📣 Annonces</Text>
            <Item icon="✌️" name="Ronda (+1)" desc="Une paire en main. Annonce-la avant de jouer ta première carte de la distribution." />
            <Item icon="🤟" name="Tringa (+5)" desc="Trois cartes de même valeur en main." />
            <Text style={styles.text}>
                Seule l'annonce la plus forte marque, et elle prend tous les points annoncés : tringa contre ronda = 6, tringa contre tringa = 10. Entre deux rondas, la plus haute gagne (12 en haut, 1 en bas).{'\n'}
                Égalité de rondas : le camp qui mange en premier avec cette valeur laisse le point à l'autre.
            </Text>

            <Text style={styles.sectionTitle}>🕵️ Il est rondé !</Text>
            <Text style={styles.text}>
                Si un adversaire a joué sa première carte sans annoncer sa ronda, dénonce-le avant qu'il joue la suivante en choisissant la valeur. Une seule dénonciation par distribution.{'\n'}
                Juste : ton camp prend les points (1 ou 5). Fausse : -1 point.{'\n'}
                La première fois, c'est seulement un <Text style={styles.highlight}>avertissement</Text> (sans points), dans les deux cas.
            </Text>

            <Text style={styles.sectionTitle}>👑 Dernière carte du donneur</Text>
            <Text style={styles.text}>
                Le donneur doit manger avec sa toute dernière carte. Avec un 12 : +5 pour son camp (9a3a Rey). Avec un 1, ou s'il ne mange rien : +5 pour l'adversaire (9a3a AS).
            </Text>

            <Text style={styles.sectionTitle}>🏁 Fin de manche</Text>
            <Text style={styles.text}>
                Les cartes restées sur la table vont au dernier camp qui a mangé. Chaque carte au-delà de 20 vaut 1 point. Exemple : 26 cartes ramassées = +6 points.
            </Text>
        </>
    );
}

function KdoubRules() {
    return (
        <>
            <Text style={styles.sectionTitle}>🎯 But du jeu</Text>
            <Text style={styles.text}>
                Être le premier à se débarrasser de toutes ses cartes. 3 à 6 joueurs, les 40 cartes sont distribuées.
            </Text>

            <Text style={styles.sectionTitle}>🔁 Ordre imposé</Text>
            <Text style={styles.text}>
                Les annonces suivent l'ordre 1, 2, 3, 4, 5, 6, 7, 10, 11, 12, puis on recommence à 1.{'\n'}À ton tour, tu poses <Text style={styles.highlight}>1 à 4 cartes face cachée</Text> en annonçant la valeur demandée. Tu peux mentir sur les cartes, jamais sur le nombre.
            </Text>

            <Text style={styles.sectionTitle}>🤥 KDOUB !</Text>
            <Text style={styles.text}>
                Après chaque pose, tout adversaire a <Text style={styles.highlight}>5 secondes</Text> pour crier KDOUB (le joueur suivant attend).{'\n'}
                • Le poseur a menti : il ramasse tout le tas.{'\n'}
                • Il a dit vrai : c'est l'accusateur qui ramasse tout le tas.{'\n'}
                Personne n'accuse : le tas reste et on continue avec la valeur suivante.
            </Text>

            <Text style={styles.sectionTitle}>💡 Exemple</Text>
            <Text style={styles.text}>
                On attend des 5. Tu n'en as qu'un : tu poses ton 5 et un 12 en disant « deux 5 ». Si quelqu'un crie KDOUB, les cartes sont retournées : tu as menti, tu ramasses tout le tas.
            </Text>

            <Text style={styles.sectionTitle}>🏁 Fin</Text>
            <Text style={styles.text}>
                Le premier qui vide sa main gagne, une fois la fenêtre de 5 secondes passée. Les autres sont classés selon le nombre de cartes qui leur restent.
            </Text>
        </>
    );
}

export default function RulesModal({ visible, onClose, gameType = 'hezz2' }) {
    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>📜 Règles : {{ ronda: 'Ronda', kdoub: 'Kdoub' }[gameType] || 'Hezz2'}</Text>

                    <ScrollView style={styles.scrollView}>
                        {gameType === 'ronda' ? <RondaRules /> : gameType === 'kdoub' ? <KdoubRules /> : <>
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
                                <Text style={styles.ruleDesc}>Le joueur suivant saute son tour, SAUF s'il pose lui aussi un 1 en moins de 3 secondes : l'attaque rebondit alors sur le joueur d'après.</Text>
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
                                <Text style={styles.ruleDesc}>Se pose comme une carte normale (même famille ou même valeur), puis tu choisis la nouvelle famille. Après un 7, il faut jouer la famille demandée ou un autre 7.</Text>
                            </View>
                        </View>

                        <Text style={styles.sectionTitle}>🏆 Points</Text>
                        <Text style={styles.text}>
                            Le 1er à finir marque autant de points qu'il y a d'adversaires, puis 1 de moins par place. Le Khasser ne marque rien. Les points s'additionnent d'une manche à l'autre.
                        </Text>
                        </>}
                    </ScrollView>

                    <TouchableOpacity style={styles.closeButton} onPress={() => { audioService.playSound('click'); onClose(); }}>
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
