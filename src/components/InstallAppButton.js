import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { PressableScale, theme } from './ui';
import { dialog } from './Dialog';
import { t } from '../i18n';
import { useInstallState, promptInstall } from '../utils/install';

// « Installer l'appli » (version web uniquement, caché si déjà installée)
// - Android / Chrome / Edge : vraie fenêtre d'installation du navigateur.
// - iPhone / iPad : Safari n'a pas de bouton automatique, on explique la manip.
export default function InstallAppButton({ style }) {
    const { canPrompt, available } = useInstallState();
    if (!available) return null;

    const onPress = async () => {
        if (canPrompt && (await promptInstall())) return;
        dialog.alert(
            t("Installer L'Carta"),
            t("Sur iPhone, dans Safari :\n\n1. Touche le bouton Partager (le carré avec la flèche ⬆️)\n2. Choisis « Sur l'écran d'accueil »\n3. Touche « Ajouter »\n\nL'appli s'ouvrira en plein écran, comme une vraie appli."),
            [{ text: t('OK') }],
        );
    };

    return (
        <PressableScale onPress={onPress} style={[styles.btn, style]} accessibilityLabel={t("Installer L'Carta")}>
            <Text style={styles.text}>{t("📲 Installer l'appli")}</Text>
        </PressableScale>
    );
}

const styles = StyleSheet.create({
    btn: {
        alignSelf: 'center',
        marginTop: 14,
        paddingVertical: 9,
        paddingHorizontal: 18,
        borderRadius: 22,
        borderWidth: 1.5,
        borderColor: theme.gold,
        backgroundColor: 'rgba(212, 175, 55, 0.12)',
    },
    text: { color: theme.gold, fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
});
