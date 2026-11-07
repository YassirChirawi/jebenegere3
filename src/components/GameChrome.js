// Éléments communs à tous les écrans de jeu : barre du haut, chat, réactions emoji.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, LinearTransition, SlideInDown } from 'react-native-reanimated';
import { IconButton, PressableScale, theme } from './ui';
import socketService from '../network/socketService';
import audioService from '../network/audioService';

export const QUICK_MESSAGES = ['L3eb a zmagri !', 'Zid Jouj !', 'Hezz !', 'Zrebti 3lina...', 'Wry9a wa7da 😉', 'Saaaaaaaafi 😡'];
export const REACTIONS = ['😂', '😡', '😱', '👏'];

/**
 * Chat + réactions d'une room : écoute le serveur, garde les bulles et les réactions actives.
 */
export function useRoomChat(roomId, { extraMessages } = {}) {
    const [chatMessages, setChatMessages] = useState([]);
    const [activeReactions, setActiveReactions] = useState({});
    const [showChat, setShowChat] = useState(false);

    useEffect(() => {
        const unsubs = [
            socketService.onChatMessage((data) => {
                audioService.playSound('pop');
                setChatMessages((prev) => [...prev.slice(-3), data]);
                setTimeout(() => setChatMessages((prev) => prev.filter((m) => m.id !== data.id)), 3500);
            }),
            socketService.onPlayerReaction(({ playerIndex, reactionType }) => {
                audioService.playSound('pop', { rate: 1.15 });
                setActiveReactions((prev) => ({ ...prev, [playerIndex]: reactionType }));
                setTimeout(() => {
                    setActiveReactions((prev) => {
                        const next = { ...prev };
                        delete next[playerIndex];
                        return next;
                    });
                }, 2500);
            }),
        ];
        return () => unsubs.forEach((u) => u && u());
    }, []);

    const sendChat = (message) => {
        socketService.sendChat(roomId, message);
        setShowChat(false);
    };
    const sendReaction = (emoji) => {
        socketService.sendReaction(roomId, emoji);
        setShowChat(false);
    };

    return { chatMessages, activeReactions, showChat, setShowChat, sendChat, sendReaction, quickMessages: extraMessages || QUICK_MESSAGES };
}

export function TopBar({ roomId, land, isMuted, onQuit, onChat, onMute, onRules, center }) {
    return (
        <View style={[styles.topBar, land && styles.topBarLand]} pointerEvents="box-none">
            <View style={styles.topBtns}>
                <IconButton icon="🚪" onPress={onQuit} label="Quitter" size={38} />
                <IconButton icon="💬" onPress={onChat} label="Chat" size={38} />
            </View>
            {center !== undefined ? center : roomId && !land ? (
                <View style={styles.roomPill}>
                    <Text style={styles.roomPillText}>SALON {roomId}</Text>
                </View>
            ) : null}
            <View style={styles.topBtns}>
                <IconButton icon={isMuted ? '🔇' : '🔊'} onPress={onMute} label="Son" size={38} />
                <IconButton icon="📜" onPress={onRules} label="Règles" size={38} />
            </View>
        </View>
    );
}

export function ChatBubbles({ messages, top = 130 }) {
    return (
        <View style={[styles.chatOverlay, { top }]} pointerEvents="none">
            {messages.map((msg) => (
                <Animated.View
                    key={msg.id}
                    style={styles.chatBubble}
                    entering={ZoomIn.springify().damping(12)}
                    exiting={FadeOut}
                    layout={LinearTransition.springify()}
                >
                    <Text style={styles.chatText}>
                        <Text style={styles.chatName}>{msg.playerName} : </Text>
                        {msg.message}
                    </Text>
                </Animated.View>
            ))}
        </View>
    );
}

export function ReactionBar({ onSend, land }) {
    return (
        <View style={[styles.reactionBar, land && styles.reactionBarLand]}>
            {REACTIONS.map((emoji) => (
                <PressableScale key={emoji} sound={null} scaleTo={0.8} style={styles.reactionBtn} onPress={() => onSend(emoji)}>
                    <Text style={styles.reactionBtnText}>{emoji}</Text>
                </PressableScale>
            ))}
        </View>
    );
}

export function ChatSheet({ visible, onClose, onSend, quickMessages = QUICK_MESSAGES }) {
    const [customMsg, setCustomMsg] = useState('');
    if (!visible) return null;
    const submit = () => {
        if (customMsg.trim()) {
            onSend(customMsg.trim());
            setCustomMsg('');
        }
    };
    return (
        <Animated.View entering={FadeIn.duration(150)} style={styles.sheetOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
            <Animated.View entering={SlideInDown.springify().damping(16)} style={styles.sheet}>
                <View style={styles.sheetHandle} />
                <Text style={styles.sheetTitle}>💬 Message rapide</Text>
                <View style={styles.customRow}>
                    <TextInput
                        style={styles.customInput}
                        placeholder="Message personnalisé..."
                        placeholderTextColor={theme.textDim}
                        value={customMsg}
                        onChangeText={setCustomMsg}
                        maxLength={60}
                        onSubmitEditing={submit}
                    />
                    <PressableScale style={styles.sendBtn} onPress={submit}>
                        <Text style={styles.sendText}>➤</Text>
                    </PressableScale>
                </View>
                <View style={styles.quickGrid}>
                    {quickMessages.map((msg) => (
                        <PressableScale key={msg} style={styles.quickBtn} onPress={() => onSend(msg)}>
                            <Text style={styles.quickText}>{msg}</Text>
                        </PressableScale>
                    ))}
                </View>
            </Animated.View>
        </Animated.View>
    );
}

// Réaction emoji au-dessus d'un avatar
export function ReactionBubble({ emoji, style }) {
    if (!emoji) return null;
    return (
        <Animated.View entering={ZoomIn.springify().damping(9)} exiting={FadeOut} style={[styles.reactionBubble, style]}>
            <Text style={{ fontSize: 26 }}>{emoji}</Text>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 12,
        zIndex: 20,
    },
    topBarLand: {
        position: 'absolute',
        top: 8,
        left: 0,
        right: 0,
    },
    topBtns: {
        flexDirection: 'row',
        gap: 8,
    },
    roomPill: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.35)',
    },
    roomPillText: {
        color: theme.goldLight,
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1.5,
    },
    chatOverlay: {
        position: 'absolute',
        left: 16,
        right: 16,
        alignItems: 'center',
        zIndex: 40,
    },
    chatBubble: {
        backgroundColor: '#FFF8E7',
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 16,
        borderBottomLeftRadius: 4,
        marginBottom: 6,
        borderWidth: 1.5,
        borderColor: theme.gold,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.35,
        shadowRadius: 4,
        elevation: 8,
    },
    chatText: {
        fontSize: 14,
        color: '#2A1419',
        fontWeight: '700',
    },
    chatName: {
        color: '#B91C1C',
        fontWeight: '900',
    },
    reactionBar: {
        flexDirection: 'row',
        gap: 6,
    },
    reactionBarLand: {
        flexWrap: 'wrap',
        width: 82,
        justifyContent: 'center',
    },
    reactionBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(10,4,6,0.6)',
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.45)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    reactionBtnText: {
        fontSize: 18,
    },
    reactionBubble: {
        position: 'absolute',
        top: -36,
        left: -4,
        backgroundColor: '#fff',
        borderRadius: 16,
        paddingHorizontal: 4,
        zIndex: 50,
    },
    sheetOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
        zIndex: 9000,
        elevation: 9000,
    },
    sheet: {
        backgroundColor: theme.panelSolid,
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        borderWidth: 2,
        borderBottomWidth: 0,
        borderColor: theme.gold,
        padding: 18,
        paddingBottom: 28,
    },
    sheetHandle: {
        alignSelf: 'center',
        width: 44,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(212,175,55,0.5)',
        marginBottom: 12,
    },
    sheetTitle: {
        color: theme.goldLight,
        fontSize: 18,
        fontWeight: '900',
        marginBottom: 12,
        textAlign: 'center',
    },
    customRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 14,
    },
    customInput: {
        flex: 1,
        minWidth: 0,
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: 'rgba(212,175,55,0.5)',
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: theme.cream,
        fontSize: 15,
    },
    sendBtn: {
        width: 46,
        borderRadius: 12,
        backgroundColor: theme.gold,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendText: {
        color: theme.bg,
        fontSize: 18,
        fontWeight: '900',
    },
    quickGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    quickBtn: {
        width: '48.5%',
        paddingVertical: 11,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.35)',
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.45)',
        alignItems: 'center',
    },
    quickText: {
        color: theme.cream,
        fontWeight: '800',
        fontSize: 14,
    },
});
