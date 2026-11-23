/** Choix de la langue : Français, English (les mots du jeu restent en darija). */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PressableScale } from './ui';
import { LANGS, setLang, useLang } from '../i18n';

export default function LanguagePicker({ style }) {
    const lang = useLang();
    return (
        <View style={[styles.row, style]} accessibilityRole="radiogroup">
            {LANGS.map((l) => {
                const on = l.id === lang;
                return (
                    <PressableScale key={l.id} onPress={() => setLang(l.id)} style={[styles.chip, on && styles.chipOn]} accessibilityLabel={l.label} accessibilityState={{ selected: on }} scaleTo={0.92}>
                        <Text style={[styles.text, on && styles.textOn]}>{l.label}</Text>
                    </PressableScale>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
    chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(232,184,74,0.45)', backgroundColor: 'rgba(0,0,0,0.3)' },
    chipOn: { borderColor: '#FFE08A', backgroundColor: 'rgba(232,184,74,0.25)' },
    text: { color: '#E9DFC6', fontWeight: '800', fontSize: 13 },
    textOn: { color: '#FFE08A', fontWeight: '900' },
});
