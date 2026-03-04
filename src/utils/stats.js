export const RANK_THRESHOLDS = [
    { maxXP: 200, name: "bida2i (Débutant)", emoji: "🥚", nextXP: 201 },
    { maxXP: 500, name: "Zmagri", emoji: "🥉", nextXP: 501 },
    { maxXP: 1000, name: "fchkel", emoji: "🥈", nextXP: 1001 },
    { maxXP: 2500, name: "chdid", emoji: "🥇", nextXP: 2501 },
    { maxXP: Infinity, name: "L'Boss", emoji: "👑", nextXP: null }
];

export function getRankInfo(xp) {
    for (let i = 0; i < RANK_THRESHOLDS.length; i++) {
        if (xp <= RANK_THRESHOLDS[i].maxXP) {
            return {
                ...RANK_THRESHOLDS[i],
                currentXP: xp,
                levelProgress: i === 0
                    ? (xp / RANK_THRESHOLDS[0].maxXP)
                    : ((xp - RANK_THRESHOLDS[i - 1].maxXP) / (RANK_THRESHOLDS[i].maxXP - RANK_THRESHOLDS[i - 1].maxXP))
            };
        }
    }
    return RANK_THRESHOLDS[RANK_THRESHOLDS.length - 1]; // Boss
}
