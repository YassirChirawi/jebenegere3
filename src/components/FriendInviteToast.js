/**
 * Invitation d'un ami : « Nadia t'invite à jouer à la Ronda » avec Rejoindre / Plus tard.
 * Affichée par-dessus n'importe quel écran, sauf pendant une partie (elle attend la fin).
 * « Rejoindre » ouvre l'accueil, qui rejoint le salon comme avec un lien d'invitation.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { SlideInUp, SlideOutUp } from 'react-native-reanimated';
import PlayerAvatar from './PlayerAvatar';
import { GameButton } from './ui';
import { LUXE, LuxePanel } from './Luxe';
import socketService from '../network/socketService';
import audioService from '../network/audioService';
import { gameInfo } from '../games';

const TTL = 60 * 1000; // une invitation reste valable une minute

export default function FriendInviteToast({ navigationRef }) {
    const [invite, setInvite] = useState(null);
    const [route, setRoute] = useState(null);
    const timer = useRef(null);

    useEffect(() => {
        let socket = null;
        let retry = null;
        const onInvite = (inv) => {
            if (!inv?.roomId) return;
            audioService.playSound('popup');
            setInvite({ ...inv, receivedAt: Date.now() });
        };
        const attach = () => {
            if (!socketService.socket) { retry = setTimeout(attach, 500); return; }
            socket = socketService.socket;
            socket.on('friend_invite', onInvite);
        };
        attach();
        return () => { clearTimeout(retry); socket?.off('friend_invite', onInvite); };
    }, []);

    // Écran affiché : pas d'invitation par-dessus une partie
    useEffect(() => {
        const update = () => setRoute(navigationRef.getCurrentRoute?.() || null);
        update();
        const off = navigationRef.addListener?.('state', update);
        return () => off && off();
    }, [navigationRef]);

    useEffect(() => {
        clearTimeout(timer.current);
        if (invite) timer.current = setTimeout(() => setInvite(null), Math.max(0, TTL - (Date.now() - invite.receivedAt)));
        return () => clearTimeout(timer.current);
    }, [invite]);

    if (!invite || route?.name === 'Game') return null;
    const same = route?.name === 'Lobby' && route.params?.roomId === invite.roomId;
    if (same) return null;

    const join = () => {
        const inv = invite;
        setInvite(null);
        // Déjà dans un autre salon : on le quitte d'abord
        if (route?.name === 'Lobby' && route.params?.roomId) socketService.leaveRoom(route.params.roomId);
        navigationRef.navigate('Home', { invite: inv.roomId, inviteAt: Date.now() });
    };

    return (
        <Animated.View entering={SlideInUp.springify().damping(16)} exiting={SlideOutUp} style={styles.wrap} pointerEvents="box-none">
            <LuxePanel style={styles.box}>
                <View style={styles.row}>
                    <PlayerAvatar name={invite.from.name} variant={invite.from.avatar || 0} size={46} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.title} numberOfLines={1}>{invite.from.name} t'invite</Text>
                        <Text style={styles.sub} numberOfLines={1}>à jouer à {gameInfo(invite.gameType).label} dans son salon</Text>
                    </View>
                </View>
                <View style={styles.btns}>
                    <GameButton small title="Plus tard" variant="outline" onPress={() => setInvite(null)} style={{ flex: 1 }} />
                    <GameButton small title="Rejoindre" icon="🎮" variant="green" onPress={join} style={{ flex: 1 }} />
                </View>
            </LuxePanel>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    wrap: { position: 'absolute', top: 10, left: 10, right: 10, alignItems: 'center', zIndex: 50 },
    box: { width: '100%', maxWidth: 440, padding: 12 },
    row: { flexDirection: 'row', alignItems: 'center' },
    title: { color: LUXE.goldLight, fontWeight: '900', fontSize: 16 },
    sub: { color: LUXE.cream, fontWeight: '700', fontSize: 12, marginTop: 2 },
    btns: { flexDirection: 'row', gap: 8, marginTop: 10 },
});
