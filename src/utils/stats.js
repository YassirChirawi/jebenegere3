import AsyncStorage from '@react-native-async-storage/async-storage';
import { RANKS, rankFor } from '../../server/progress/defs';

// Rangs partagés avec le serveur (5 rangs historiques + 3 nouveaux au-delà de L'Boss)
export const RANK_THRESHOLDS = RANKS.map((r, i) => ({ maxXP: r.max, name: r.name, emoji: r.emoji, nextXP: RANKS[i + 1] ? r.max + 1 : null }));

export function getRankInfo(xp) {
    const r = rankFor(xp || 0);
    return { name: r.name, emoji: r.emoji, maxXP: r.max, nextXP: r.next ? r.next.min : null, currentXP: xp || 0, levelProgress: r.levelProgress, next: r.next };
}

// ---------------------------------------------------------------------------
// Sauvegarde locale commune à tous les jeux : XP, stats globales, stats par jeu, historique
// ---------------------------------------------------------------------------

export async function addXp(amount) {
    try {
        // Avec un compte, c'est le serveur qui compte l'XP (le profil est resynchronisé en fin de partie)
        if (await AsyncStorage.getItem('authToken')) return;
        const cur = parseInt((await AsyncStorage.getItem('playerXP')) || '0', 10);
        await AsyncStorage.setItem('playerXP', String(cur + amount));
    } catch (e) { /* ignore */ }
}

export async function getGameStats(game) {
    try {
        return JSON.parse((await AsyncStorage.getItem(`stats_${game}`)) || 'null') || { played: 0, wins: 0, losses: 0 };
    } catch (e) {
        return { played: 0, wins: 0, losses: 0 };
    }
}

/**
 * Enregistre une partie terminée.
 * won : true / false ; game : 'hezz2' | 'ronda' | ... ; result : texte affiché dans l'historique
 */
export async function recordGame({ game, won, result, opponents }) {
    try {
        const [gp, w, l] = await Promise.all(['gamesPlayed', 'wins', 'losses'].map((k) => AsyncStorage.getItem(k)));
        await AsyncStorage.setItem('gamesPlayed', String(parseInt(gp || '0', 10) + 1));
        if (won) await AsyncStorage.setItem('wins', String(parseInt(w || '0', 10) + 1));
        else await AsyncStorage.setItem('losses', String(parseInt(l || '0', 10) + 1));

        const gs = await getGameStats(game);
        gs.played += 1;
        if (won) gs.wins += 1;
        else gs.losses += 1;
        await AsyncStorage.setItem(`stats_${game}`, JSON.stringify(gs));

        const history = JSON.parse((await AsyncStorage.getItem('matchHistory')) || '[]');
        history.unshift({
            id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
            date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
            game,
            result: result || (won ? 'Victoire 🎉' : 'Défaite 💀'),
            opponents: opponents || 'Inconnus',
        });
        await AsyncStorage.setItem('matchHistory', JSON.stringify(history.slice(0, 15)));
    } catch (e) {
        console.error('recordGame', e);
    }
}
