/**
 * Amis : ajouter par pseudo, demandes reçues (accepter / refuser), liste (en ligne d'abord),
 * demandes envoyées. Pour jouer ensemble : créer un salon puis « Inviter un ami » dans le salon.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import PlayerAvatar from '../components/PlayerAvatar';
import AppNav from '../components/AppNav';
import { GameButton, PressableScale } from '../components/ui';
import { dialog } from '../components/Dialog';
import { LUXE, LuxePanel, LuxeBackdrop, ScreenHeader, SectionHead } from '../components/Luxe';
import { useAccount } from '../network/accountService';
import friendsService, { useFriends } from '../network/friendsService';
import audioService from '../network/audioService';
import { getRankInfo } from '../utils/stats';
import { t } from '../i18n';

const PEOPLE = require('../../assets/ui/mode_salon.webp');

function FriendRow({ f, children, sub }) {
    return (
        <View style={styles.row}>
            <View>
                <PlayerAvatar name={f.name} variant={f.avatar || 0} size={44} />
                {f.online !== undefined && <View style={[styles.dot, { backgroundColor: f.online ? '#3FD97A' : '#5B6478' }]} />}
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.name} numberOfLines={1}>{f.name}</Text>
                <Text style={styles.sub} numberOfLines={1}>{sub ?? `Niveau ${(getRankInfo(f.xp || 0).index ?? 0) + 1}${f.online ? t(' · en ligne') : ''}`}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>{children}</View>
        </View>
    );
}

export default function FriendsScreen({ navigation }) {
    const account = useAccount();
    const fr = useFriends();
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState(null);

    const add = async () => {
        if (!name.trim()) return;
        setBusy(true);
        setMsg(null);
        const r = await friendsService.add(name.trim());
        setBusy(false);
        if (r.error) { audioService.playSound('error'); setMsg({ error: true, text: r.error }); return; }
        audioService.playSound('pop');
        setMsg({ text: r.accepted ? t("Vous êtes maintenant amis avec {p0} 🎉", { p0: r.other.name }) : t("Demande envoyée à {p0}.", { p0: r.to.name }) });
        setName('');
    };
    const remove = (f) => dialog.alert(t("Retirer {p0} ?", { p0: f.name }), 'Vous ne serez plus amis (vous pourrez vous redemander plus tard).', [
        { text: t('Annuler'), style: 'cancel' },
        { text: t('Retirer'), style: 'destructive', onPress: () => friendsService.remove(f.id) },
    ]);

    return (
        <View style={styles.container}>
            <LuxeBackdrop />
            <ScreenHeader title={t("Amis")} onBack={() => navigation.goBack()} />
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {!account.profile ? (
                    <LuxePanel style={{ padding: 16 }}>
                        <Text style={styles.title}>{t("Joue avec tes amis")}</Text>
                        <Text style={styles.dim}>{t("Avec un compte gratuit : ajoute tes amis par leur pseudo, vois qui est en ligne et invite-les dans ton salon en un geste.")}</Text>
                        <GameButton small title={t("Créer mon compte")} icon="🔐" onPress={() => navigation.navigate('Profile')} style={{ marginTop: 12, alignSelf: 'center' }} />
                    </LuxePanel>
                ) : (
                    <>
                        <Animated.View entering={FadeInDown.springify().damping(16)}>
                            <LuxePanel inner={false}>
                                <SectionHead icon={PEOPLE} title={t("Ajouter un ami")} />
                                <View style={{ padding: 12 }}>
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <TextInput style={styles.input} placeholder={t("Son pseudo…")} placeholderTextColor={LUXE.dim} value={name} onChangeText={setName} autoCapitalize="none" maxLength={16} onSubmitEditing={add} accessibilityLabel={t("Pseudo de l'ami")} />
                                        {busy ? <ActivityIndicator color={LUXE.gold} /> : <GameButton small title={t("Ajouter")} onPress={add} />}
                                    </View>
                                    {msg && <Text style={[styles.msg, msg.error && { color: '#FCA5A5' }]}>{msg.text}</Text>}
                                    <Text style={[styles.dim, { marginTop: 8, textAlign: 'left' }]}>{t("Ton pseudo à donner :")} <Text style={{ color: LUXE.goldLight, fontWeight: '900' }}>{account.profile.name}</Text></Text>
                                </View>
                            </LuxePanel>
                        </Animated.View>

                        {fr.incoming.length > 0 && (
                            <Animated.View entering={FadeInDown.delay(60).springify().damping(16)}>
                                <LuxePanel inner={false}>
                                    <SectionHead emoji="📩" title={t("Demandes reçues")} right={`${fr.incoming.length}`} />
                                    {fr.incoming.map((f) => (
                                        <FriendRow key={f.id} f={{ ...f, online: undefined }} sub={t("veut être ton ami")}>
                                            <GameButton small title="✓" variant="green" onPress={() => friendsService.respond(f.id, true)} />
                                            <GameButton small title="✕" variant="outline" onPress={() => friendsService.respond(f.id, false)} />
                                        </FriendRow>
                                    ))}
                                </LuxePanel>
                            </Animated.View>
                        )}

                        <Animated.View entering={FadeInDown.delay(120).springify().damping(16)}>
                            <LuxePanel inner={false}>
                                <SectionHead emoji="🤝" title={t("Mes amis")} right={t("{p0} en ligne · {p1}", { p0: fr.friends.filter((f) => f.online).length, p1: fr.friends.length })} />
                                {!fr.loaded ? <ActivityIndicator color={LUXE.gold} style={{ margin: 16 }} /> : fr.friends.length === 0 ? (
                                    <Text style={[styles.dim, { padding: 14 }]}>{t("Pas encore d'amis. Ajoute-les avec leur pseudo, puis invite-les depuis ton salon privé.")}</Text>
                                ) : fr.friends.map((f) => (
                                    <FriendRow key={f.id} f={f}>
                                        <PressableScale onPress={() => remove(f)} style={styles.remove} accessibilityLabel={`Retirer ${f.name}`}><Text style={styles.removeText}>✕</Text></PressableScale>
                                    </FriendRow>
                                ))}
                                {fr.friends.some((f) => f.online) && (
                                    <View style={{ padding: 12 }}>
                                        <GameButton small title={t("Créer un salon et les inviter")} icon="🎮" variant="green" onPress={() => navigation.popToTop()} />
                                        <Text style={[styles.dim, { marginTop: 6 }]}>{t("Sur l'accueil : « Entre amis », puis « Inviter un ami » dans le salon.")}</Text>
                                    </View>
                                )}
                            </LuxePanel>
                        </Animated.View>

                        {fr.outgoing.length > 0 && (
                            <LuxePanel inner={false}>
                                <SectionHead emoji="⏳" title={t("Demandes envoyées")} />
                                {fr.outgoing.map((f) => (
                                    <FriendRow key={f.id} f={{ ...f, online: undefined }} sub={t("en attente")}>
                                        <GameButton small title={t("Annuler")} variant="outline" onPress={() => friendsService.remove(f.id)} />
                                    </FriendRow>
                                ))}
                            </LuxePanel>
                        )}
                    </>
                )}
            </ScrollView>
            <AppNav navigation={navigation} current="friends" />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: LUXE.night },
    scroll: { padding: 14, paddingBottom: 24, gap: 14, width: '100%', maxWidth: 560, alignSelf: 'center' },
    title: { color: LUXE.goldLight, fontWeight: '900', fontSize: 17, textAlign: 'center', marginBottom: 6 },
    dim: { color: LUXE.dim, fontWeight: '700', fontSize: 12, textAlign: 'center', lineHeight: 18 },
    input: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1.5, borderColor: LUXE.gold, borderRadius: 12, color: LUXE.cream, paddingHorizontal: 12, paddingVertical: 9, fontWeight: '800', fontSize: 15 },
    msg: { color: '#9BF5B0', fontWeight: '800', fontSize: 12, marginTop: 8 },
    row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(232,184,74,0.15)' },
    dot: { position: 'absolute', right: 0, bottom: 0, width: 13, height: 13, borderRadius: 7, borderWidth: 2, borderColor: LUXE.night },
    name: { color: LUXE.cream, fontWeight: '900', fontSize: 15 },
    sub: { color: LUXE.dim, fontWeight: '700', fontSize: 11, marginTop: 1 },
    remove: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(232,184,74,0.45)', alignItems: 'center', justifyContent: 'center' },
    removeText: { color: LUXE.dim, fontWeight: '900' },
});
