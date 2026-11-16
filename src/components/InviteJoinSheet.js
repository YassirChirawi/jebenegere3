import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { GameButton, theme } from './ui';
import { parseInvite } from '../utils/invite';

/**
 * Rejoindre un salon :
 * - arrivée par un lien (code déjà connu) : on demande seulement le pseudo s'il manque ;
 * - « J'ai un lien d'invitation » : on colle le lien (ou un ancien code), puis on rejoint.
 */
export default function InviteJoinSheet({ visible, code: linkCode, name, onChangeName, onJoin, onClose, busy }) {
    const [pasted, setPasted] = useState('');
    const [error, setError] = useState(null);
    useEffect(() => { if (visible) { setPasted(''); setError(null); } }, [visible]);
    if (!visible) return null;

    const fromLink = !!linkCode;
    const submit = () => {
        const code = linkCode || parseInvite(pasted);
        if (!code) { setError("Ce lien n'est pas un lien d'invitation Jeben Gere3."); return; }
        if (!name.trim()) { setError('Choisis un pseudo pour rejoindre la partie.'); return; }
        setError(null);
        onJoin(code, name.trim());
    };

    return (
        <Animated.View entering={FadeIn.duration(150)} style={styles.overlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
            <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.box}>
                <Text style={styles.title}>{fromLink ? '🎴 Tu es invité à une partie !' : "🔗 J'ai un lien d'invitation"}</Text>
                {fromLink ? (
                    <Text style={styles.sub}>Choisis ton pseudo et rejoins tes amis.</Text>
                ) : (
                    <>
                        <Text style={styles.sub}>Colle le lien reçu (WhatsApp, SMS…).</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="https://jebengere3.fun/salon/…"
                            placeholderTextColor={theme.textDim}
                            value={pasted}
                            onChangeText={setPasted}
                            autoCapitalize="none"
                            autoCorrect={false}
                            accessibilityLabel="Lien d'invitation"
                        />
                    </>
                )}
                <Text style={styles.label}>TON PSEUDO</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Ex : Yassir…"
                    placeholderTextColor={theme.textDim}
                    value={name}
                    onChangeText={onChangeName}
                    maxLength={16}
                    onSubmitEditing={submit}
                    accessibilityLabel="Ton pseudo"
                />
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <View style={styles.row}>
                    <GameButton small title="Annuler" variant="outline" onPress={onClose} style={{ flex: 1 }} />
                    <GameButton small title={busy ? '…' : 'REJOINDRE'} variant="gold" onPress={submit} disabled={busy} style={{ flex: 1 }} />
                </View>
            </Animated.View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', alignItems: 'center', padding: 20, zIndex: 9000 },
    box: { width: '100%', maxWidth: 380, backgroundColor: theme.panelSolid, borderRadius: 18, borderWidth: 2, borderColor: theme.gold, padding: 18 },
    title: { color: theme.goldLight, fontSize: 19, fontWeight: '900', textAlign: 'center' },
    sub: { color: theme.text, fontSize: 14, textAlign: 'center', marginTop: 6, marginBottom: 10 },
    label: { color: theme.gold, fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginTop: 10, marginBottom: 6 },
    input: { borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.5)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: theme.cream, fontSize: 15, backgroundColor: 'rgba(0,0,0,0.3)' },
    error: { color: '#FCA5A5', fontSize: 13, marginTop: 8, textAlign: 'center' },
    row: { flexDirection: 'row', gap: 10, marginTop: 16 },
});
