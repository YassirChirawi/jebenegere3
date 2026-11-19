// Éléments communs à tous les écrans de jeu : barre du haut, chat, réactions emoji.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, LinearTransition, SlideInDown } from 'react-native-reanimated';
import { IconButton, PressableScale, theme } from './ui';
import socketService from '../network/socketService';
import audioService from '../network/audioService';
import { dialog } from './Dialog';
import { logMessage, shouldHide, isMine, openMessageMenu, useChatModeration } from '../utils/chatModeration';
import ReactionGlyph, { reactionText } from './ReactionGlyph';
import { useCosmetics } from '../utils/cosmetics';
import { COSMETICS } from '../../server/progress/defs';

// Rejouer : le serveur répond toujours (succès ou raison du refus), jamais de clic sans effet
export function requestReplay(roomId) {
    socketService.playAgain(roomId, (res) => {
        if (res && res.success === false) {
            audioService.playSound('error');
            dialog.alert('Impossible de rejouer', res.message || 'Réessaie dans un instant.');
        }
    });
}

// Salon privé, fin de partie : l'hôte ramène tout le monde au salon pour choisir un autre jeu.
// Renvoie undefined si ce n'est pas possible (pas l'hôte, matchmaking, partie contre bots, vieux serveur).
export function changeGameHandler(roomId, state) {
    const host = state?.hostId && state.hostId === socketService.socket?.id;
    if (!host || !state?.isPrivate || !socketService.supports('lobby_games')) return undefined;
    return () => socketService.backToLobby(roomId, (res) => {
        if (res && res.success === false) {
            audioService.playSound('error');
            dialog.alert('Impossible', res.message || 'Réessaie dans un instant.');
        }
    });
}

// Web : si l'onglet est en arrière-plan quand un message arrive, la bulle reste jusqu'au retour
// sur l'onglet (puis ses 3,5 s habituelles), sinon on ne la verrait jamais.
function whenVisible(fn) {
    if (typeof document === 'undefined' || !document.hidden) { fn(); return; }
    const onVis = () => {
        if (document.hidden) return;
        document.removeEventListener('visibilitychange', onVis);
        fn();
    };
    document.addEventListener('visibilitychange', onVis);
}

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
                if (shouldHide(data)) return; // joueur bloqué ou message signalé
                logMessage(data);
                audioService.playSound('pop');
                // Onglet en arrière-plan : la bulle s'affichera sans animation (les animations y sont suspendues)
                const quiet = typeof document !== 'undefined' && !!document.hidden;
                setChatMessages((prev) => [...prev.slice(-3), { ...data, quiet }]);
                whenVisible(() => setTimeout(() => setChatMessages((prev) => prev.filter((m) => m.id !== data.id)), 3500));
            }),
            socketService.onPlayerReaction(({ playerIndex, reactionType, spectatorName }) => {
                audioService.playSound('pop', { rate: 1.15 });
                if (playerIndex === -1) {
                    const id = `spec-${Date.now()}-${Math.random()}`;
                    setChatMessages((prev) => [...prev.slice(-3), { id, system: true, playerName: `👀 ${spectatorName || 'Spectateur'}`, message: reactionText(reactionType) }]);
                    whenVisible(() => setTimeout(() => setChatMessages((prev) => prev.filter((m) => m.id !== id)), 3000));
                    return;
                }
                setActiveReactions((prev) => ({ ...prev, [playerIndex]: reactionType }));
                setTimeout(() => {
                    setActiveReactions((prev) => {
                        const next = { ...prev };
                        delete next[playerIndex];
                        return next;
                    });
                }, 2500);
            }),
            socketService.onChatRejected((r) => {
                audioService.playSound('error');
                dialog.alert('Message refusé', r?.message || "Ce message n'a pas été envoyé.");
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

// Bulles du chat : toucher la bulle d'un autre joueur ouvre « Signaler / Bloquer »
export function ChatBubbles({ messages, top = 130 }) {
    const mod = useChatModeration();
    const visible = messages.filter((m) => !mod.hidden.has(m.id) && !mod.blocked.some((b) => b.key === m.from));
    return (
        <View style={[styles.chatOverlay, { top }]} pointerEvents="box-none">
            {visible.map((msg) => (
                <Animated.View
                    key={msg.id}
                    entering={msg.quiet ? undefined : ZoomIn.springify().damping(12)}
                    exiting={FadeOut}
                    style={styles.chatBubbleWrap}
                >
                    <Pressable
                        style={styles.chatBubble}
                        onPress={() => openMessageMenu(msg)}
                        disabled={isMine(msg) || msg.system}
                        accessibilityLabel={`Message de ${msg.playerName}. Toucher pour signaler ou bloquer.`}
                    >
                        <Text style={styles.chatText}>
                            <Text style={styles.chatName}>{msg.playerName} : </Text>
                            {msg.message}
                            {!isMine(msg) && !msg.system ? <Text style={styles.chatMore}>  ⋯</Text> : null}
                        </Text>
                    </Pressable>
                </Animated.View>
            ))}
        </View>
    );
}

// Réactions de la boutique possédées par le joueur (dans l'ordre du catalogue)
export function useOwnedEmotes() {
    const cos = useCosmetics();
    const owned = new Set(cos.unlocks || []);
    return COSMETICS.filter((c) => c.kind === 'emote' && owned.has(c.id));
}

export function ReactionBar({ onSend, land }) {
    const emotes = useOwnedEmotes();
    const [open, setOpen] = useState(false);
    return (
        <View style={[styles.reactionBar, land && styles.reactionBarLand]}>
            {REACTIONS.map((emoji) => (
                <PressableScale key={emoji} sound={null} scaleTo={0.8} style={styles.reactionBtn} onPress={() => onSend(emoji)}>
                    <Text style={styles.reactionBtnText}>{emoji}</Text>
                </PressableScale>
            ))}
            {emotes.length > 0 && (
                <PressableScale sound={null} scaleTo={0.8} style={[styles.reactionBtn, open && styles.reactionBtnOn]} onPress={() => setOpen(!open)} accessibilityLabel="Mes réactions">
                    <Text style={styles.reactionBtnText}>✨</Text>
                </PressableScale>
            )}
            {open && (
                <Animated.View entering={ZoomIn.springify().damping(14)} style={[styles.emotePanel, land && styles.emotePanelLand]}>
                    {emotes.map((e) => (
                        <PressableScale key={e.id} sound={null} scaleTo={0.85} style={styles.emoteBtn} onPress={() => { setOpen(false); onSend(e.id); }}>
                            <ReactionGlyph type={e.id} size={22} textColor={theme.cream} />
                        </PressableScale>
                    ))}
                </Animated.View>
            )}
        </View>
    );
}

export function ChatSheet({ visible, onClose, onSend, quickMessages = QUICK_MESSAGES, spectator = false, onReact }) {
    const [customMsg, setCustomMsg] = useState('');
    const mod = useChatModeration();
    if (!visible) return null;
    const recent = mod.log.slice(-6).reverse();
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
                {recent.length > 0 && (
                    <View style={styles.recentBox}>
                        <Text style={styles.recentTitle}>Derniers messages · ⋯ pour signaler ou bloquer</Text>
                        {recent.map((m) => (
                            <Pressable
                                key={m.id}
                                style={({ hovered }) => [styles.recentRow, !isMine(m) && hovered && styles.recentRowHover]}
                                disabled={isMine(m)}
                                onPress={() => { onClose(); openMessageMenu(m); }}
                                accessibilityLabel={`Signaler ou bloquer ${m.playerName}`}
                            >
                                <Text style={styles.recentText} numberOfLines={1}>
                                    <Text style={styles.recentName}>{isMine(m) ? 'Toi' : m.playerName} : </Text>{m.message}
                                </Text>
                                {!isMine(m) && (
                                    <View style={styles.recentMore}>
                                        <Text style={styles.recentMoreText}>⋯</Text>
                                    </View>
                                )}
                            </Pressable>
                        ))}
                    </View>
                )}
                {spectator ? (
                    <>
                        <Text style={styles.sheetTitle}>👀 Tu es spectateur</Text>
                        <Text style={styles.spectatorNote}>Les spectateurs ne peuvent pas écrire, mais peuvent réagir :</Text>
                        <View style={{ alignItems: 'center', marginTop: 10 }}>
                            <ReactionBar onSend={(e) => { onReact && onReact(e); onClose(); }} />
                        </View>
                    </>
                ) : (<>
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
                </>)}
            </Animated.View>
        </Animated.View>
    );
}

// Réaction emoji au-dessus d'un avatar
export function ReactionBubble({ emoji, style }) {
    if (!emoji) return null;
    return (
        <Animated.View entering={ZoomIn.springify().damping(9)} exiting={FadeOut} style={[styles.reactionBubble, style]}>
            <ReactionGlyph type={emoji} size={26} />
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
    chatMore: { color: '#8A6D3B', fontWeight: '900' },
    spectatorNote: { color: theme.text, fontSize: 13, textAlign: 'center', marginTop: 4 },
    chatBubbleWrap: { maxWidth: '100%', flexShrink: 0 },
    recentBox: { marginBottom: 12, padding: 10, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
    recentTitle: { color: theme.textDim, fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginBottom: 6 },
    recentRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, paddingHorizontal: 4, borderRadius: 8, cursor: 'pointer' },
    recentRowHover: { backgroundColor: 'rgba(212,175,55,0.12)' },
    recentText: { flex: 1, color: theme.text, fontSize: 13 },
    recentName: { color: theme.goldLight, fontWeight: '900' },
    recentMore: { paddingHorizontal: 10, paddingVertical: 2, borderRadius: 10, backgroundColor: 'rgba(212,175,55,0.18)' },
    recentMoreText: { color: theme.goldLight, fontWeight: '900', fontSize: 16 },
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
    reactionBtnOn: { borderColor: theme.gold, backgroundColor: 'rgba(212,175,55,0.3)' },
    emotePanel: {
        position: 'absolute',
        bottom: 44,
        right: 0,
        width: 236,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        padding: 8,
        borderRadius: 16,
        backgroundColor: 'rgba(10,4,6,0.92)',
        borderWidth: 1,
        borderColor: theme.gold,
        zIndex: 100,
        elevation: 20,
    },
    emotePanelLand: { bottom: 0, right: 90 },
    emoteBtn: { width: 50, paddingVertical: 4, alignItems: 'center', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)' },
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
