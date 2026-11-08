import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import Animated, {
    ZoomIn,
    FadeOut,
    FadeIn,
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withSequence,
    withTiming,
    LinearTransition,
} from 'react-native-reanimated';
import PlayerAvatar from './PlayerAvatar';
import { CardBack } from './Card';
import { theme } from './ui';

const MINT = require('../../assets/menthe-poivree-removebg-preview.png');
const MAX_VISIBLE = 10;

/**
 * Siège d'un adversaire : avatar, nom, nombre de cartes, mini-main en éventail.
 * position : 'top' | 'left' | 'right'
 */
export default function OpponentSeat({ player, handSize, active, reaction, position = 'top', finished, isInitialDeal, isBot, compact, badge, badgeColor, mood }) {
    const vertical = position !== 'top';

    // Petit "bump" du compteur quand le nombre de cartes change
    const bump = useSharedValue(1);
    useEffect(() => {
        bump.value = withSequence(withTiming(1.35, { duration: 120 }), withSpring(1, { damping: 8 }));
    }, [handSize]);
    const bumpStyle = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }));

    const visible = Math.min(handSize, MAX_VISIBLE);
    const cards = Array.from({ length: visible });

    const miniW = vertical ? 34 : 24;
    const miniH = vertical ? 24 : 34;

    return (
        <View style={[styles.seat, vertical && styles.seatVertical, compact && styles.seatCompact]}>
            <View style={styles.avatarWrap}>
                <PlayerAvatar name={player?.name} variant={player?.avatar || 0} size={vertical ? 44 : 46} active={active} mood={mood} />
                {active && <Image source={MINT} style={styles.mint} />}
                {finished && (
                    <Animated.View entering={ZoomIn.springify()} style={styles.finishedBadge}>
                        <Text style={styles.finishedText}>✓</Text>
                    </Animated.View>
                )}
                {reaction ? (
                    <Animated.View
                        entering={ZoomIn.springify().damping(9)}
                        exiting={FadeOut}
                        style={[styles.reaction, position === 'top' ? styles.reactionBelow : styles.reactionAbove]}
                    >
                        <Text style={styles.reactionText}>{reaction}</Text>
                    </Animated.View>
                ) : null}
            </View>

            <View style={compact ? styles.compactInfo : styles.infoCol}>
            <View style={[styles.namePill, vertical && styles.namePillVertical, active && styles.namePillActive]}>
                <Text style={[styles.name, vertical && styles.nameVertical, active && styles.nameActive]} numberOfLines={1}>
                    {isBot && !vertical ? '🤖 ' : ''}{player?.name || '...'}
                </Text>
            </View>

            {badge ? <Text style={[styles.badge, badgeColor && { color: badgeColor, borderColor: badgeColor }]}>{badge}</Text> : null}
            {finished ? (
                <Animated.Text entering={FadeIn} style={styles.finishedLabel}>Sorti 🏁</Animated.Text>
            ) : (
                <View style={[styles.handRow, vertical && styles.handCol]}>
                    {cards.map((_, i) => {
                        const mid = (visible - 1) / 2;
                        const off = i - mid;
                        return (
                            <Animated.View
                                key={i}
                                entering={isInitialDeal ? FadeIn.delay(i * 95 + 150).duration(250) : FadeIn.duration(200)}
                                layout={LinearTransition.springify().damping(16)}
                                style={vertical ? { marginTop: i === 0 ? 0 : -miniH + 7 } : { marginLeft: i === 0 ? 0 : -miniW + 9 }}
                            >
                                <View
                                    style={{
                                        transform: vertical
                                            ? [{ rotate: `${off * 2}deg` }]
                                            : [{ rotate: `${off * 4}deg` }, { translateY: Math.abs(off) * 1.2 }],
                                    }}
                                >
                                    <CardBack width={miniW} height={miniH} />
                                </View>
                            </Animated.View>
                        );
                    })}
                    <Animated.View style={[styles.countBadge, bumpStyle, active && styles.countBadgeActive]}>
                        <Text style={[styles.countText, active && { color: theme.bg }]}>{handSize}</Text>
                    </Animated.View>
                </View>
            )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    seat: {
        alignItems: 'center',
    },
    seatCompact: {
        flexDirection: 'row',
        gap: 12,
    },
    infoCol: {
        alignItems: 'center',
    },
    compactInfo: {
        alignItems: 'flex-start',
    },
    seatVertical: {
        width: 84,
    },
    avatarWrap: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    mint: {
        position: 'absolute',
        right: -18,
        bottom: -6,
        width: 26,
        height: 26,
        resizeMode: 'contain',
    },
    finishedBadge: {
        position: 'absolute',
        top: -4,
        right: -6,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: theme.greenLight,
        borderWidth: 1.5,
        borderColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    finishedText: {
        color: '#fff',
        fontWeight: '900',
        fontSize: 11,
    },
    badge: {
        marginTop: 3,
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 1,
        color: theme.goldLight,
        borderWidth: 1,
        borderColor: theme.gold,
        borderRadius: 8,
        paddingHorizontal: 6,
        paddingVertical: 1,
        overflow: 'hidden',
    },
    finishedLabel: {
        color: theme.mint,
        fontWeight: '800',
        fontSize: 12,
        marginTop: 4,
    },
    namePill: {
        marginTop: 5,
        paddingHorizontal: 9,
        paddingVertical: 2,
        borderRadius: 10,
        backgroundColor: 'rgba(10, 4, 6, 0.65)',
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.3)',
        maxWidth: 110,
    },
    namePillVertical: {
        maxWidth: 82,
        paddingHorizontal: 6,
    },
    nameVertical: {
        fontSize: 11,
    },
    namePillActive: {
        backgroundColor: theme.gold,
        borderColor: theme.goldLight,
    },
    name: {
        color: theme.cream,
        fontSize: 12,
        fontWeight: '800',
    },
    nameActive: {
        color: theme.bg,
    },
    handRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        minHeight: 38,
    },
    handCol: {
        flexDirection: 'column',
        marginTop: 6,
    },
    countBadge: {
        position: 'absolute',
        right: -12,
        bottom: -6,
        minWidth: 22,
        height: 22,
        paddingHorizontal: 5,
        borderRadius: 11,
        backgroundColor: '#12080B',
        borderWidth: 1.5,
        borderColor: theme.gold,
        alignItems: 'center',
        justifyContent: 'center',
    },
    countBadgeActive: {
        backgroundColor: theme.gold,
    },
    countText: {
        color: theme.goldLight,
        fontWeight: '900',
        fontSize: 11,
    },
    reaction: {
        position: 'absolute',
        zIndex: 50,
        backgroundColor: '#fff',
        borderRadius: 18,
        paddingHorizontal: 6,
        paddingVertical: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 4,
        elevation: 10,
    },
    reactionBelow: {
        top: 44,
    },
    reactionAbove: {
        top: -34,
    },
    reactionText: {
        fontSize: 26,
    },
});
