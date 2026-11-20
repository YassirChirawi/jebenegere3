/**
 * La cloche : bouton de l'en-tête (pastille = non lues) et fenêtre des notifications.
 * Toucher une notification : demande d'ami → écran Amis ; invitation → rejoindre le salon.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';
import PlayerAvatar from './PlayerAvatar';
import { GameButton, PressableScale } from './ui';
import { LUXE, LuxePanel, GoldSquare } from './Luxe';
import inboxService, { useInbox } from '../network/inboxService';
import { useAccount } from '../network/accountService';
import { gameInfo } from '../games';
import { t } from '../i18n';

const TEXT = {
    friend_request: (n) => ({ title: t("{p0} veut être ton ami", { p0: n.from?.name }), action: t('Voir') }),
    friend_accepted: (n) => ({ title: t("{p0} a accepté ta demande", { p0: n.from?.name }), action: t('Amis') }),
    room_invite: (n) => ({ title: t("{p0} t'invite à jouer", { p0: n.from?.name }), sub: t("{p0} · salon {p1}", { p0: gameInfo(n.data?.gameType).label, p1: n.data?.roomId }), action: t('Rejoindre') }),
};

function ago(at) {
    const m = Math.max(0, Math.round((Date.now() - at) / 60000));
    if (m < 1) return "à l'instant";
    if (m < 60) return t("il y a {p0} min", { p0: m });
    const h = Math.round(m / 60);
    if (h < 24) return `il y a ${h} h`;
    return `il y a ${Math.round(h / 24)} j`;
}

/** Bouton cloche (rien sans compte). onJoinRoom(roomId) : rejoindre le salon d'une invitation. */
export default function InboxBell({ navigation, onJoinRoom }) {
    const { profile } = useAccount();
    const inbox = useInbox();
    const [open, setOpen] = useState(false);
    // Une fois la fenêtre ouverte, tout est considéré comme lu
    useEffect(() => {
        if (!open) return undefined;
        const t = setTimeout(() => inboxService.markAllRead(), 800);
        return () => clearTimeout(t);
    }, [open]);
    if (!profile) return null;

    const act = (n) => {
        setOpen(false);
        if (n.type === 'room_invite' && n.data?.roomId) onJoinRoom(n.data.roomId);
        else navigation.navigate('Friends');
    };

    return (
        <>
            <GoldSquare onPress={() => { inboxService.refresh(); setOpen(true); }} label={inbox.unread ? t('Notifications : {n} non lues', { n: inbox.unread }) : t('Notifications')}>
                <Text style={{ fontSize: 18 }}>🔔</Text>
                {inbox.unread > 0 && (
                    <View style={styles.badge}><Text style={styles.badgeText}>{inbox.unread > 9 ? '9+' : inbox.unread}</Text></View>
                )}
            </GoldSquare>
            <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
                <Pressable style={styles.bg} onPress={() => setOpen(false)}>
                    <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 440, maxHeight: '80%' }}>
                        <LuxePanel style={{ padding: 14 }}>
                            <Text style={styles.title}>{t("🔔 Notifications")}</Text>
                            <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
                                {inbox.items.length === 0 ? (
                                    <Text style={styles.empty}>{t("Rien de nouveau. Les demandes d'ami et les invitations à jouer apparaissent ici.")}</Text>
                                ) : inbox.items.map((n) => {
                                    const tx = (TEXT[n.type] || (() => ({ title: t('Notification') })))(n);
                                    return (
                                        <PressableScale key={n.id} onPress={() => act(n)} style={[styles.item, !n.read && styles.itemNew]} scaleTo={0.98} accessibilityLabel={tx.title}>
                                            <PlayerAvatar name={n.from?.name || '?'} variant={n.from?.avatar || 0} size={40} />
                                            <View style={{ flex: 1, marginHorizontal: 10 }}>
                                                <Text style={styles.itemTitle} numberOfLines={2}>{tx.title}</Text>
                                                <Text style={styles.itemSub} numberOfLines={1}>{tx.sub ? `${tx.sub} · ` : ''}{ago(n.at)}</Text>
                                            </View>
                                            <Text style={styles.itemAction}>{tx.action} ›</Text>
                                        </PressableScale>
                                    );
                                })}
                            </ScrollView>
                            <GameButton small title={t("Fermer")} variant="outline" onPress={() => setOpen(false)} style={{ alignSelf: 'center', marginTop: 12 }} />
                        </LuxePanel>
                    </Pressable>
                </Pressable>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    badge: { position: 'absolute', top: 1, right: 1, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 3, backgroundColor: '#E5262E', borderWidth: 1.5, borderColor: '#FFD5A0', alignItems: 'center', justifyContent: 'center' },
    badgeText: { color: '#fff', fontWeight: '900', fontSize: 9 },
    bg: { flex: 1, backgroundColor: 'rgba(4,8,18,0.82)', justifyContent: 'center', alignItems: 'center', padding: 16 },
    title: { color: LUXE.goldLight, fontWeight: '900', fontSize: 18, textAlign: 'center', marginBottom: 10 },
    empty: { color: LUXE.dim, fontWeight: '700', fontSize: 13, textAlign: 'center', padding: 16, lineHeight: 19 },
    item: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 14, marginBottom: 6, borderWidth: 1, borderColor: 'rgba(232,184,74,0.2)', backgroundColor: 'rgba(0,0,0,0.25)' },
    itemNew: { borderColor: LUXE.gold, backgroundColor: 'rgba(232,184,74,0.12)' },
    itemTitle: { color: LUXE.cream, fontWeight: '900', fontSize: 13 },
    itemSub: { color: LUXE.dim, fontWeight: '700', fontSize: 11, marginTop: 2 },
    itemAction: { color: LUXE.goldLight, fontWeight: '900', fontSize: 12 },
});
