/**
 * Parties à mise en binga (salons privés, en option). Jamais d'argent réel.
 *
 * - L'hôte choisit une mise (10, 50 ou 100 binga) ou laisse la partie gratuite.
 * - Chaque joueur choisit de miser ou non (l'hôte mise en fixant la mise). Personne n'est forcé :
 *   sans compte ou sans assez de binga, on joue gratuitement, sans pénalité.
 * - Les mises sont retirées AU DÉBUT de la partie et forment le pot.
 * - Fin de partie : le pot va au gagnant s'il a misé (partagé dans l'équipe gagnante en Ronda à 2 contre 2) ;
 *   sinon (bot ou joueur qui n'a pas misé), chacun récupère sa mise.
 * - Abandon : la mise reste dans le pot ; salon vidé (tous partis) : mises perdues ; serveur redémarré : mises rendues.
 */
const STAKES = [0, 10, 50, 100];

// Sièges gagnants, d'après l'état de fin de partie (mêmes règles que les écrans de fin)
function stakeWinners(room, state) {
    const n = room.activePlayers.length;
    switch (room.gameType) {
        case 'hezz2': {
            const loser = state.loserIndex;
            const order = (state.finishedPlayers || []).filter((i) => i !== loser);
            if (order.length) return [order[0]];
            const others = [...Array(n).keys()].filter((i) => i !== loser);
            return others.length === 1 ? others : [];
        }
        case 'ronda':
            if (state.winnerTeam === null || state.winnerTeam === undefined) return [];
            return [...Array(n).keys()].filter((i) => i % 2 === state.winnerTeam);
        case 'kdoub':
            return Number.isInteger(state.winner) ? [state.winner] : [];
        case 'sota': {
            const first = (state.outOrder || [])[0];
            return Number.isInteger(first) ? [first] : [];
        }
        default:
            return [];
    }
}

// Une partie de Ronda continue (manche suivante) : pas de nouvelle mise
const continuing = (room, prevState) => room.gameType === 'ronda' && prevState && prevState.winnerTeam === null;
// Fin de la partie entière (en Ronda : score final atteint, pas une simple manche)
const gameFinished = (room, state) => (room.gameType === 'ronda' ? state.winnerTeam !== null && state.winnerTeam !== undefined : true);

function createStakes({ io, rooms, progress }) {
    const emitTo = (sid, ev, data) => sid && io.to(sid).emit(ev, data);

    function setStake(room, socket, amount) {
        if (room.hostId !== socket.id) return { success: false, message: "Seul l'hôte choisit la mise." };
        if (room.tournament) return { success: false, message: 'Pas de mise en tournoi.' };
        if (!STAKES.includes(amount)) return { success: false, message: 'Mise possible : gratuit, 10, 50 ou 100 binga.' };
        room.stake = amount;
        // Les accords des joueurs sont remis à zéro ; l'hôte mise d'office (il vient de choisir la mise)
        room.stakeIn = new Set(amount && socket.data.user ? [socket.id] : []);
        return { success: true };
    }

    function optIn(room, socket, on) {
        if (!room.stake) return { success: false, message: "L'hôte n'a pas fixé de mise." };
        if (!socket.data.user) return { success: false, message: 'Crée ton compte pour miser des binga. Tu peux jouer gratuitement.' };
        room.stakeIn = room.stakeIn || new Set();
        if (on) room.stakeIn.add(socket.id); else room.stakeIn.delete(socket.id);
        return { success: true };
    }

    /** Début d'une nouvelle partie : retire la mise de chaque joueur qui a misé (s'il a assez de binga). */
    function onStart(room, prevState) {
        if (continuing(room, prevState)) return;
        room.pot = null;
        if (!room.stake || room.tournament) return;
        const amount = room.stake;
        const pot = { amount, total: 0, stakers: [], settled: false, roomId: room.id };
        room.pot = pot;
        const charges = room.activePlayers.map((p, seat) => {
            if (p.isBot || !p.userId || !room.stakeIn?.has(p.id)) {
                if (!p.isBot) emitTo(p.id, 'stake_update', { roomId: room.id, paid: false, amount, reason: p.userId ? 'Tu as choisi de jouer sans miser.' : 'Sans compte, tu joues gratuitement.' });
                return null;
            }
            return progress.chargeStake(p.userId, room.id, amount).then((r) => {
                if (r && r.ok) {
                    pot.stakers.push({ seat, userId: p.userId, socketId: p.id, name: p.name });
                    pot.total += amount;
                    emitTo(p.id, 'stake_update', { roomId: room.id, paid: true, amount, balance: r.balance, profile: r.profile });
                } else {
                    emitTo(p.id, 'stake_update', { roomId: room.id, paid: false, amount, reason: `Pas assez de binga (${r?.balance ?? 0}) : tu joues gratuitement, sans pénalité.` });
                }
            }).catch((e) => console.error('[mise] retrait', e));
        });
        pot.ready = Promise.all(charges);
    }

    /** Fin de partie : le pot va au(x) gagnant(s) qui ont misé, sinon chacun récupère sa mise. */
    async function onGameOver(room, state) {
        const pot = room.pot;
        if (!pot || pot.settled || !gameFinished(room, state)) return;
        pot.settled = true;
        await pot.ready;
        if (!pot.stakers.length) return;
        const winners = stakeWinners(room, state)
            .map((seat) => pot.stakers.find((s) => s.seat === seat && room.activePlayers[seat]?.userId === s.userId))
            .filter(Boolean);
        const results = [];
        if (winners.length) {
            const share = Math.floor(pot.total / winners.length);
            let rest = pot.total - share * winners.length;
            for (const s of pot.stakers) {
                const w = winners.includes(s);
                const gain = w ? share + (rest > 0 ? rest : 0) : 0;
                if (w && rest > 0) rest = 0;
                const r = await progress.settleStake(s.userId, room.id, gain, w ? `Pot gagné (${pot.stakers.length} mises de ${pot.amount})` : null);
                results.push({ s, gain, profile: r?.profile });
            }
        } else {
            for (const s of pot.stakers) {
                const r = await progress.settleStake(s.userId, room.id, pot.amount, 'Mise rendue (le gagnant n\'avait pas misé)');
                results.push({ s, gain: pot.amount, profile: r?.profile, refund: true });
            }
        }
        const summary = { roomId: room.id, total: pot.total, amount: pot.amount, refunded: !winners.length, winners: winners.map((w) => w.name) };
        results.forEach(({ s, gain, profile }) => emitTo(s.socketId, 'stake_result', { ...summary, gain, profile }));
        room.spectators.forEach((p) => emitTo(p.id, 'stake_result', summary));
    }

    /**
     * Salon supprimé avant la fin parce que tous les joueurs sont partis : chacun a abandonné, les mises sont perdues
     * (sinon on pourrait partir pour éviter de perdre sa mise). Après un redémarrage du serveur, en revanche,
     * les mises sont rendues (voir refundStaleStakes dans progress.js).
     */
    async function onRoomGone(room) {
        const pot = room.pot;
        if (!pot || pot.settled) return;
        pot.settled = true;
        await pot.ready;
        for (const s of pot.stakers) await progress.settleStake(s.userId, room.id, 0, null);
    }

    const publicInfo = (room) => ({ stake: room.stake || 0, stakeIn: [...(room.stakeIn || [])] });

    return { setStake, optIn, onStart, onGameOver, onRoomGone, publicInfo, roomAlive: (id) => !!rooms[id] };
}

module.exports = { createStakes, stakeWinners, STAKES };
