import React from 'react';
import { View, Text, StyleSheet, ScrollView, Linking, Pressable } from 'react-native';
import { PressableScale, theme } from '../components/ui';
import legal from '../legal/legal.json';
import { LuxeBackdrop, ScreenHeader, BingaPill } from '../components/Luxe';
import { t } from '../i18n';

/**
 * Politique de confidentialité et conditions d'utilisation, lisibles dans l'appli
 * sans compte ni connexion (même texte que https://jebengere3.fun/privacy et /terms).
 */
export default function LegalScreen({ route, navigation }) {
    const key = route?.params?.doc === 'terms' ? 'terms' : 'privacy';
    const doc = legal[key];
    const otherKey = key === 'privacy' ? 'terms' : 'privacy';

    return (
        <View style={styles.container}>
            <LuxeBackdrop />
            <ScreenHeader title={doc.title} onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'))} />
            <ScrollView contentContainerStyle={styles.scroll}>
                <Text style={styles.updated}>{t("Mise à jour :")} {doc.updated}</Text>
                <Text style={styles.p}>{doc.intro}</Text>
                {doc.sections.map((s) => (
                    <View key={s.h}>
                        <Text style={styles.h2}>{s.h}</Text>
                        {s.items.map((it) => (
                            <View key={it} style={styles.li}>
                                <Text style={styles.bullet}>•</Text>
                                <Text style={styles.liText}>{it}</Text>
                            </View>
                        ))}
                    </View>
                ))}
                <View style={styles.contact}>
                    {legal.contactEmail ? (
                        <Text style={styles.p} onPress={() => Linking.openURL(`mailto:${legal.contactEmail}`)}>
                            Contact : <Text style={styles.link}>{legal.contactEmail}</Text>
                        </Text>
                    ) : (
                        <Text style={styles.p}>{legal.contactMissing}</Text>
                    )}
                </View>
                <Pressable onPress={() => navigation.replace('Legal', { doc: otherKey })} style={styles.other}>
                    <Text style={styles.link}>{legal[otherKey].title} ›</Text>
                </Pressable>
                <Text style={styles.web}>{t("Aussi en ligne : jebengere3.fun")}{doc.path}</Text>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 14, paddingBottom: 8, gap: 10 },
    back: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: theme.gold, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
    backText: { fontSize: 18 },
    headerTitle: { flex: 1, textAlign: 'center', color: theme.goldLight, fontWeight: '900', fontSize: 17 },
    scroll: { paddingHorizontal: 18, paddingBottom: 40 },
    updated: { color: theme.textDim, fontSize: 12, marginBottom: 10 },
    p: { color: theme.text, fontSize: 15, lineHeight: 22 },
    h2: { color: theme.gold, fontWeight: '900', fontSize: 16, marginTop: 20, marginBottom: 6 },
    li: { flexDirection: 'row', gap: 8, marginVertical: 3 },
    bullet: { color: theme.gold, fontSize: 15, lineHeight: 22 },
    liText: { flex: 1, color: theme.text, fontSize: 14, lineHeight: 21 },
    contact: { marginTop: 24, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', backgroundColor: 'rgba(0,0,0,0.25)' },
    link: { color: theme.goldLight, fontWeight: '800', textDecorationLine: 'underline' },
    other: { marginTop: 18 },
    web: { color: theme.textDim, fontSize: 12, marginTop: 14 },
});
