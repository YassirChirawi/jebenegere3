/**
 * Temps forts d'une partie, pour l'écran de fin et le résumé des matchs de tournoi.
 * Affichage seulement : rien ici ne change les règles ni les points.
 *
 * Les compteurs couvrent toute la partie (en Ronda, toutes les manches), contrairement à room.tally
 * qui est remis à zéro à chaque fin de manche une fois les défis crédités.
 *
 * Chaque temps fort : { kind, player, n }.
 *   Ronda : darba, hbel, boug, missa (n = nombre de fois), ronda / tringa (annonce gagnée), rey (dernière carte prise avec le 12)
 *   Hezz2 : pile (plus grosse pioche de pénalité : n cartes), two / one (le plus de 2 ou de 1 joués),
 *           first (premier à poser sa dernière carte)
 *   Kdoub : catch (menteurs démasqués), pile (plus gros tas ramassé : n cartes)
 *   Sota  : pairs (le plus de paires), first (premier sorti)
 */

const RONDA_KINDS = { darba: 'darba', hbel: 'hbel', bachra: 'boug', missa: 'missa', rey: 'rey' };

function resetHighlights(room) {
    room.hl = { counts: {}, pile: null };
}

function bump(hl, p, kind, n = 1) {
    if (p === undefined || p === null || p < 0) return;
    hl.counts[p] = hl.counts[p] || {};
    hl.counts[p][kind] = (hl.counts[p][kind] || 0) + n;
}

function biggest(hl, p, n) {
    if (n >= 2 && (!hl.pile || n > hl.pile.n)) hl.pile = { player: p, n };
}

/** À chaque nouvel état : compte les coups marquants (événements des moteurs, ou mains qui grossissent en Hezz2). */
function trackHighlights(room, prev, next) {
    if (!room.hl) resetHighlights(room);
    const hl = room.hl;
    (next.events || []).forEach((e) => {
        if (RONDA_KINDS[e.type]) bump(hl, e.player, RONDA_KINDS[e.type]);
        if (e.type === 'announce_win' && (e.combo === 'ronda' || e.combo === 'tringa')) bump(hl, e.player, e.combo);
        if (e.type === 'kdoub') {
            if (!e.truthful) bump(hl, e.by, 'catch');
            biggest(hl, e.loser, e.taken || 0);
        }
    });
    // Hezz2 : pas d'événements. Qui a pioché plusieurs cartes d'un coup (+2 cumulés),
    // et quelle carte vient d'arriver au milieu (posée par le joueur dont c'était le tour)
    if (room.gameType === 'hezz2' && prev?.hands && next?.hands) {
        next.hands.forEach((h, p) => biggest(hl, p, h.length - (prev.hands[p]?.length || 0)));
        const pile = next.middlePile || [];
        if (prev.middlePile && pile.length === prev.middlePile.length + 1) {
            const v = pile[pile.length - 1]?.value;
            if (v === 2) bump(hl, prev.turn, 'two');
            if (v === 1) bump(hl, prev.turn, 'one');
        }
    }
}

/** Liste des temps forts de la partie terminée (au plus 6), dans l'ordre d'affichage. */
function highlightsFor(room, state) {
    const hl = room.hl || { counts: {} };
    const out = [];
    // Seulement le meilleur joueur pour ce compteur
    const top = (kind) => {
        const best = Object.entries(hl.counts).filter(([, c]) => c[kind]).sort((a, b) => b[1][kind] - a[1][kind])[0];
        if (best) out.push({ kind, player: Number(best[0]), n: best[1][kind] });
    };
    const each = (kind) => Object.entries(hl.counts)
        .filter(([, c]) => c[kind])
        .sort((a, b) => b[1][kind] - a[1][kind])
        .forEach(([p, c]) => out.push({ kind, player: Number(p), n: c[kind] }));
    switch (room.gameType) {
        case 'ronda':
            ['boug', 'hbel', 'tringa', 'ronda', 'rey', 'missa', 'darba'].forEach(each);
            break;
        case 'hezz2': {
            if (hl.pile) out.push({ kind: 'pile', ...hl.pile });
            ['two', 'one'].forEach((k) => top(k));
            const first = (state.finishedPlayers || []).find((i) => i !== state.loserIndex);
            if (first !== undefined && !state.forfeit) out.push({ kind: 'first', player: first, n: 1 });
            break;
        }
        case 'kdoub':
            each('catch');
            if (hl.pile) out.push({ kind: 'pile', ...hl.pile });
            break;
        case 'sota': {
            const pairs = (state.pairs || []).map((x, p) => ({ p, n: (x || []).length })).sort((a, b) => b.n - a.n);
            if (pairs[0]?.n > 0) out.push({ kind: 'pairs', player: pairs[0].p, n: pairs[0].n });
            const first = (state.outOrder || [])[0];
            if (first !== undefined && first !== state.loser && !state.forfeit) out.push({ kind: 'first', player: first, n: 1 });
            break;
        }
        default:
            break;
    }
    return out.slice(0, 6);
}

module.exports = { resetHighlights, trackHighlights, highlightsFor };
