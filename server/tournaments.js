/**
 * Tournois à élimination directe (V1 : Hezz2 en 1 contre 1, Ronda en 1 contre 1 ou en 2 contre 2).
 *
 * Un tournoi = un code (lien /tournoi/CODE), un nom, un jeu, 4 ou 8 joueurs, une date de début.
 * On ne garde que des pseudos et le tableau : aucune donnée personnelle. Chaque inscrit reçoit
 * un « ticket » secret (gardé sur son appareil) ; le serveur n'en stocke que l'empreinte.
 *
 * Déroulement :
 *  - à l'heure (ou plus tôt si l'organisateur lance), tirage au sort du tableau ;
 *  - tour par tour, chaque match attend ses joueurs (page du tournoi ouverte) jusqu'à SHOWUP_MS,
 *    puis la partie se lance toute seule ; absent à l'heure limite = forfait ;
 *  - abandon pendant la partie = forfait ;
 *  - le champion reçoit le dos « Champion » et le titre « Moul chi » (avec un compte ; sans compte,
 *    il peut réclamer sa récompense depuis le même appareil après s'être connecté).
 */
const crypto = require('crypto');
const { BINGA } = require('./progress/defs');
const { highlightsFor } = require('./progress/highlights');

const SHOWUP_MS = Number(process.env.TOURNAMENT_SHOWUP_MS) || 3 * 60 * 1000;
const NEXT_MANCHE_MS = process.env.TOURNAMENT_NEXT_MANCHE_MS !== undefined ? Number(process.env.TOURNAMENT_NEXT_MANCHE_MS) : 8000;
const TICK_MS = 5000;
const MAX_AHEAD_MS = 30 * 24 * 3600 * 1000;
const MAX_OPEN = 300;
const PALMARES_MAX = 20;
const GAMES = ['hezz2', 'ronda'];

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const token = () => crypto.randomBytes(18).toString('base64url');
const lower = (s) => String(s || '').trim().toLowerCase();

function newCode(exists) {
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (;;) {
        let c = '';
        for (let i = 0; i < 6; i++) c += abc[crypto.randomInt(abc.length)];
        if (!exists(c)) return c;
    }
}

function shuffle(list, rng = Math.random) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

const roundLabel = (matches) => (matches === 1 ? 'Finale' : matches === 2 ? 'Demi-finales' : matches === 4 ? 'Quarts de finale' : `Tour (${matches} matchs)`);

// ---------------------------------------------------------------------------------------------
// Tableau (fonctions pures, testées à part)
// ---------------------------------------------------------------------------------------------

/** Équipes (une personne en solo, deux en 2 contre 2 ; un bot complète une équipe incomplète). */
function makeUnits(t, rng) {
    const people = shuffle(t.entrants.map((e) => e.id), rng);
    if (t.mode !== 'duo') return people.map((id) => ({ members: [id] }));
    const units = [];
    for (let i = 0; i < people.length; i += 2) units.push({ members: [people[i], people[i + 1] || 'bot'] });
    return units;
}

/** Tirage du tableau : places réparties pour qu'aucun match n'oppose deux places vides. */
function seed(t, rng = Math.random) {
    const units = makeUnits(t, rng);
    let slots = 2;
    while (slots < units.length) slots *= 2;
    const order = [];
    for (let i = 0; i < slots; i += 2) order.push(i);
    for (let i = 1; i < slots; i += 2) order.push(i);
    const place = Array(slots).fill(null);
    units.forEach((_, k) => { place[order[k]] = k; });
    const rounds = [];
    for (let n = slots / 2, r = 0; n >= 1; n /= 2, r++) {
        rounds.push(Array.from({ length: n }, (_, k) => ({
            id: `r${r}m${k}`,
            a: r === 0 ? place[2 * k] : null,
            b: r === 0 ? place[2 * k + 1] : null,
            status: 'pending', // pending | waiting | playing | done
            winner: null, // 'a' | 'b'
            forfeit: false,
            bye: false,
            summary: [],
            score: '',
        })));
    }
    t.units = units;
    t.rounds = rounds;
    t.round = 0;
}

/** Vainqueur d'un match (index de l'équipe) */
const winnerUnit = (m) => (m.winner === 'a' ? m.a : m.winner === 'b' ? m.b : null);

/** Remplit le tour r+1 avec les vainqueurs du tour r. */
function fillNext(t, r) {
    const next = t.rounds[r + 1];
    if (!next) return;
    next.forEach((m, k) => {
        m.a = winnerUnit(t.rounds[r][2 * k]);
        m.b = winnerUnit(t.rounds[r][2 * k + 1]);
    });
}

/** Ouvre un tour : les matchs avec une place vide sont gagnés d'office. */
function openRound(t, r, now) {
    t.round = r;
    t.rounds[r].forEach((m) => {
        if (m.a === null || m.b === null) {
            Object.assign(m, { status: 'done', winner: m.a === null ? 'b' : 'a', bye: true });
        } else {
            Object.assign(m, { status: 'waiting', deadline: now + SHOWUP_MS });
        }
    });
}

const unitName = (t, u) => {
    if (u === null || u === undefined || !t.units[u]) return null;
    return t.units[u].members.map((id) => (id === 'bot' ? 'Bot' : t.entrants.find((e) => e.id === id)?.name || '?')).join(' & ');
};

/** Ce que tout le monde voit : pseudos et tableau, jamais les tickets. */
function publicView(t, now = Date.now()) {
    return {
        id: t.id,
        name: t.name,
        gameType: t.gameType,
        mode: t.mode,
        size: t.size,
        startsAt: t.startsAt,
        status: t.status,
        reason: t.reason || null,
        entry: t.entry || 0, // entrée en binga (0 = gratuit)
        entrants: t.entrants.map((e) => ({ id: e.id, name: e.name, paid: !!e.paid })),
        round: t.round ?? null,
        rounds: (t.rounds || []).map((list) => ({
            label: roundLabel(list.length),
            matches: list.map((m) => ({
                id: m.id,
                a: unitName(t, m.a),
                b: unitName(t, m.b),
                aMembers: m.a !== null && t.units[m.a] ? t.units[m.a].members : [],
                bMembers: m.b !== null && t.units[m.b] ? t.units[m.b].members : [],
                status: m.status,
                winner: m.winner,
                forfeit: m.forfeit,
                bye: m.bye,
                summary: m.summary,
                score: m.score,
                waitLeft: m.status === 'waiting' && m.deadline ? Math.max(0, m.deadline - now) : 0,
            })),
        })),
        champion: t.champion || null,
        finishedAt: t.finishedAt || null,
        serverNow: now,
    };
}

/**
 * Coups clés de la partie (fin de match), d'après les temps forts de toute la partie (server/progress/highlights.js).
 * En Ronda, ils couvrent toutes les manches (avant : compteurs remis à zéro à chaque manche, résumé vide).
 */
const SUMMARY = {
    boug: '⚡ Boug', hbel: '🔥 Hbel', tringa: '🎴 Tringa', ronda: '🎴 Ronda', rey: '👑 9A3A REY', missa: '🧹 Missa', darba: '💥 Darba',
    catch: '🤥 Menteur démasqué', pairs: '🃏 Paires', two: '✌️ 2 joués', one: '☝️ 1 joués',
};
function buildSummary(room, state) {
    const names = room.activePlayers.map((p) => String(p.name).replace(/ \(parti\)$/, ''));
    const out = highlightsFor(room, state).map((h) => {
        const who = names[h.player] || '?';
        if (h.kind === 'pile') return `🃏 ${who} ramasse ${h.n} cartes`;
        if (h.kind === 'first') return `🏁 ${who} pose sa dernière carte`;
        return `${SUMMARY[h.kind] || h.kind}${h.n > 1 ? ` ×${h.n}` : ''} : ${who}`;
    });
    if (state.forfeit) out.push(`🏳️ ${names[state.forfeit.player] || 'Un joueur'} a abandonné`);
    return out.slice(0, 8);
}

// ---------------------------------------------------------------------------------------------
// Gestion en ligne (sockets, salles de jeu, sauvegarde)
// ---------------------------------------------------------------------------------------------
function createTournaments(deps) {
    const { io, rooms, store, progress, getEngine, startGame, makeBots, playerOf, generateRoomCode, isOffensive } = deps;
    const all = new Map(); // id -> tournoi
    const presence = new Map(); // id -> Map(entrantId -> socketId)
    const save = (t) => store.saveTournament(t).catch((e) => console.error('[tournoi] sauvegarde', e.message));
    const broadcast = (t) => io.to(`t:${t.id}`).emit('tournament_update', publicView(t));

    const loaded = store.listTournaments().then((list) => {
        const now = Date.now();
        list.forEach((t) => {
            all.set(t.id, t);
            // Redémarrage du serveur : les matchs en cours (salles perdues) sont rejoués
            if (t.status === 'running') {
                (t.rounds[t.round] || []).forEach((m) => {
                    if (m.status === 'playing' && !rooms[m.roomId]) Object.assign(m, { status: 'waiting', deadline: now + SHOWUP_MS, roomId: null });
                });
            }
        });
    }).catch((e) => console.error('[tournoi] chargement', e.message));

    const entrantByTicket = (t, ticket) => (ticket ? t.entrants.find((e) => e.ticketHash === sha(ticket)) : null);
    const socketOf = (id) => (id ? io.sockets.sockets.get(id) : null);

    // Un joueur est disponible s'il a la page du tournoi ouverte et ne joue pas déjà une autre partie
    function presentSocket(t, entrantId) {
        const sid = presence.get(t.id)?.get(entrantId);
        const s = socketOf(sid);
        if (!s) return null;
        const busy = Object.values(rooms).some((r) => r.gameState && !getEngine(r.gameType).isOver(r.gameState)
            && r.activePlayers.some((p) => p.id === sid));
        return busy ? null : s;
    }

    function start(t, now = Date.now()) {
        const units = t.mode === 'duo' ? Math.ceil(t.entrants.length / 2) : t.entrants.length;
        if (units < 2) {
            t.status = 'cancelled';
            t.reason = "Pas assez d'inscrits à l'heure du début.";
            save(t);
            broadcast(t);
            return false;
        }
        seed(t);
        t.status = 'running';
        t.startedAt = now;
        chargeEntries(t);
        openRound(t, 0, now);
        afterResults(t, now);
        save(t);
        broadcast(t);
        tryLaunch(t, now);
        return true;
    }

    /**
     * Tournoi à entrée en binga : l'entrée est retirée au début du tournoi à chaque inscrit qui a un compte
     * et assez de binga. Les autres jouent gratuitement, sans pénalité (ils ne gagnent pas le dos exclusif).
     */
    function chargeEntries(t) {
        if (!t.entry) return;
        t.entrants.forEach((e) => {
            const s = socketOf(presence.get(t.id)?.get(e.id)) || socketOf(e.lastSocket);
            if (!e.userId) {
                if (s) s.emit('tournament_entry', { id: t.id, paid: false, amount: t.entry, reason: 'Sans compte, tu joues ce tournoi gratuitement.' });
                return;
            }
            progress.chargeEntry(e.userId, t.entry, `Entrée du tournoi « ${t.name} »`).then((r) => {
                e.paid = !!r?.ok;
                save(t);
                broadcast(t);
                if (s) s.emit('tournament_entry', { id: t.id, paid: e.paid, amount: t.entry, profile: r?.profile, reason: e.paid ? null : `Pas assez de binga (${r?.balance ?? 0}) : tu joues gratuitement, sans pénalité.` });
            }).catch((err) => console.error('[tournoi] entrée', err));
        });
    }

    function launch(t, m, sides) {
        const roomId = generateRoomCode();
        // Sièges : solo [a, b] ; 2 contre 2 [a1, b1, a2, b2] (équipes = sièges pairs / impairs)
        const seats = t.mode === 'duo' ? [sides.a[0], sides.b[0], sides.a[1], sides.b[1]] : [sides.a[0], sides.b[0]];
        let bots = 0;
        const activePlayers = seats.map((x) => {
            if (x.socket) return playerOf(x.socket, x.name);
            bots += 1;
            return makeBots(roomId, 1, bots)[0];
        });
        rooms[roomId] = {
            id: roomId,
            gameType: t.gameType,
            hostId: 'tournoi', // pas d'hôte : ni Rejouer, ni retour au salon
            activePlayers,
            spectators: [],
            gameState: null,
            isBotMatch: false,
            tournament: { id: t.id, matchId: m.id, name: t.name, label: roundLabel(t.rounds[t.round].length) },
        };
        seats.forEach((x) => x.socket && x.socket.join(roomId));
        Object.assign(m, { status: 'playing', roomId });
        startGame(roomId);
        console.log(`[tournoi ${t.id}] ${m.id} lancé dans ${roomId}`);
    }

    function decide(t, m, winner, forfeit, summary = []) {
        Object.assign(m, { status: 'done', winner, forfeit, summary });
    }

    /** Lance les matchs dont les joueurs sont là ; forfait pour les absents à l'heure limite. */
    function tryLaunch(t, now = Date.now()) {
        if (t.status !== 'running') return;
        let changed = false;
        (t.rounds[t.round] || []).forEach((m) => {
            // Salle disparue (tous les joueurs partis, redémarrage) : le match est rejoué
            if (m.status === 'playing' && !rooms[m.roomId]) Object.assign(m, { status: 'waiting', deadline: now + SHOWUP_MS, roomId: null });
            if (m.status !== 'waiting') return;
            const side = (u) => t.units[u].members.map((id) => {
                const e = t.entrants.find((x) => x.id === id);
                return { id, name: e ? e.name : 'Bot', socket: id === 'bot' ? null : presentSocket(t, id), human: id !== 'bot' };
            });
            const sides = { a: side(m.a), b: side(m.b) };
            const here = (s) => s.filter((x) => x.socket).length;
            const humans = (s) => s.filter((x) => x.human).length;
            const full = here(sides.a) === humans(sides.a) && here(sides.b) === humans(sides.b);
            if (full) {
                launch(t, m, sides);
                changed = true;
            } else if (now >= m.deadline) {
                if (here(sides.a) && here(sides.b)) {
                    launch(t, m, sides); // 2 contre 2 : un bot remplace le coéquipier absent
                } else if (here(sides.a) || here(sides.b)) {
                    const w = here(sides.a) ? 'a' : 'b';
                    const absent = unitName(t, w === 'a' ? m.b : m.a);
                    decide(t, m, w, true, [`⏰ ${absent} absent à l'heure : forfait`]);
                } else {
                    decide(t, m, Math.random() < 0.5 ? 'a' : 'b', true, ['⏰ Aucun joueur présent : vainqueur tiré au sort']);
                }
                changed = true;
            }
        });
        if (changed) {
            afterResults(t, now);
            save(t);
            broadcast(t);
        }
    }

    /** Tour terminé : tour suivant, ou fin du tournoi. */
    function afterResults(t, now = Date.now()) {
        while (t.status === 'running' && t.rounds[t.round].every((m) => m.status === 'done')) {
            if (t.round === t.rounds.length - 1) {
                finish(t, now);
                return;
            }
            fillNext(t, t.round);
            openRound(t, t.round + 1, now);
        }
    }

    function finish(t, now) {
        const final = t.rounds[t.rounds.length - 1][0];
        const u = winnerUnit(final);
        const members = t.units[u].members.filter((id) => id !== 'bot');
        t.status = 'done';
        t.finishedAt = now;
        t.champion = { name: unitName(t, u), names: members.map((id) => t.entrants.find((e) => e.id === id)?.name) };
        console.log(`[tournoi ${t.id}] champion : ${t.champion.name}`);
        members.forEach((id) => {
            const e = t.entrants.find((x) => x.id === id);
            const s = socketOf(presence.get(t.id)?.get(id)) || socketOf(e.lastSocket);
            const userId = s?.data?.user?.userId || e.userId;
            if (userId) {
                e.claimed = true;
                progress.awardTournament(userId, t.gameType, Date.now(), { bingaEntry: !!(t.entry && e.paid) })
                    .then((r) => { if (r && s) s.emit('progress', { ...r, game: t.gameType }); })
                    .catch((err) => console.error('[tournoi] récompense', err));
            }
            if (s) s.emit('tournament_won', { id: t.id, name: t.name, needsAccount: !userId });
        });
    }

    // ------------------------------------------------------------------ crochets du serveur
    /** Fin de partie dans une salle de tournoi : résultat du match. */
    function onGameOver(room, state) {
        const info = room.tournament;
        const t = info && all.get(info.id);
        if (!t || info.done) return;
        const m = t.rounds.flat().find((x) => x.id === info.matchId);
        if (!m || m.status === 'done') return;
        let seat; // siège du vainqueur (Hezz2) ou équipe gagnante (Ronda)
        if (room.gameType === 'ronda') {
            if (state.winnerTeam === null || state.winnerTeam === undefined) {
                // Ronda : manche suivante automatiquement, jusqu'au score final
                setTimeout(() => {
                    const r = rooms[room.id];
                    if (r && r.gameState === state && !info.done) startGame(room.id, state);
                }, NEXT_MANCHE_MS);
                return;
            }
            seat = state.winnerTeam;
        } else {
            seat = state.loserIndex === 0 ? 1 : 0;
        }
        info.done = true;
        const winner = seat % 2 === 0 ? 'a' : 'b';
        const summary = buildSummary(room, state);
        decide(t, m, winner, !!state.forfeit, summary);
        if (room.gameType === 'ronda' && state.scores) m.score = `${state.scores[0]} – ${state.scores[1]}`;
        const final = t.rounds[t.rounds.length - 1][0] === m;
        io.to(room.id).emit('tournament_match_over', {
            id: t.id,
            name: t.name,
            label: info.label,
            winner: unitName(t, winnerUnit(m)),
            loser: unitName(t, winner === 'a' ? m.b : m.a),
            forfeit: !!state.forfeit,
            summary,
            score: m.score,
            final,
        });
        afterResults(t);
        save(t);
        broadcast(t);
        tryLaunch(t);
    }

    function onDisconnect(socket) {
        presence.forEach((map) => map.forEach((sid, eid) => { if (sid === socket.id) map.delete(eid); }));
    }

    // ------------------------------------------------------------------ horloge
    function tick(now = Date.now()) {
        all.forEach((t) => {
            if (t.status === 'open' && now >= t.startsAt) start(t, now);
            else if (t.status === 'running') tryLaunch(t, now);
        });
    }
    const timer = setInterval(() => tick(), TICK_MS);

    // ------------------------------------------------------------------ sockets
    function attach(socket) {
        const reply = (cb, r) => cb && cb(r);
        const find = (id) => all.get(String(id || '').trim().toUpperCase());

        socket.on('tournament_create', async (data, cb) => {
            await loaded;
            const name = String(data?.name || '').trim().replace(/\s+/g, ' ').slice(0, 40);
            const gameType = data?.gameType;
            const size = Number(data?.size);
            const mode = data?.mode === 'duo' && gameType === 'ronda' ? 'duo' : 'solo';
            // Entrée en binga (option) : toujours le même montant, jamais d'argent réel
            const entry = data?.entry ? BINGA.tournamentEntry : 0;
            const startsAt = Number(data?.startsAt);
            const now = Date.now();
            if (name.length < 3) return reply(cb, { success: false, message: 'Donne un nom au tournoi (3 caractères au moins).' });
            if (isOffensive(name)) return reply(cb, { success: false, message: 'Ce nom de tournoi n\'est pas accepté.' });
            if (!GAMES.includes(gameType)) return reply(cb, { success: false, message: 'Tournois disponibles : Hezz2 et Ronda.' });
            if (![4, 8].includes(size)) return reply(cb, { success: false, message: 'Un tournoi se joue à 4 ou 8 joueurs.' });
            if (!Number.isFinite(startsAt) || startsAt < now - 60000 || startsAt > now + MAX_AHEAD_MS) {
                return reply(cb, { success: false, message: 'Choisis une date dans les 30 prochains jours.' });
            }
            if ([...all.values()].filter((x) => x.status === 'open').length >= MAX_OPEN) {
                return reply(cb, { success: false, message: 'Trop de tournois en attente, réessaie plus tard.' });
            }
            const hostToken = token();
            const t = {
                id: newCode((c) => all.has(c)),
                name, gameType, size, mode, entry,
                startsAt: Math.max(startsAt, now),
                createdAt: now,
                status: 'open',
                hostHash: sha(hostToken),
                entrants: [],
            };
            all.set(t.id, t);
            await save(t);
            console.log(`[tournoi ${t.id}] créé : ${name} (${gameType} ${mode}, ${size})`);
            reply(cb, { success: true, id: t.id, hostToken, tournament: publicView(t) });
        });

        socket.on('tournament_watch', async (data, cb) => {
            await loaded;
            const t = find(data?.id);
            if (!t) return reply(cb, { success: false, message: 'Tournoi introuvable.' });
            socket.join(`t:${t.id}`);
            const e = entrantByTicket(t, data?.ticket);
            if (e) {
                if (!presence.has(t.id)) presence.set(t.id, new Map());
                presence.get(t.id).set(e.id, socket.id);
                e.lastSocket = socket.id;
                if (socket.data.user?.userId) e.userId = socket.data.user.userId;
            }
            reply(cb, {
                success: true,
                tournament: publicView(t),
                me: e ? e.id : null,
                isHost: !!data?.hostToken && sha(data.hostToken) === t.hostHash,
            });
            if (e && t.status === 'running') tryLaunch(t);
        });

        socket.on('tournament_unwatch', (data) => {
            const t = find(data?.id);
            if (!t) return;
            socket.leave(`t:${t.id}`);
            const map = presence.get(t.id);
            map && map.forEach((sid, eid) => { if (sid === socket.id) map.delete(eid); });
        });

        socket.on('tournament_register', async (data, cb) => {
            await loaded;
            const t = find(data?.id);
            if (!t) return reply(cb, { success: false, message: 'Tournoi introuvable.' });
            const known = entrantByTicket(t, data?.ticket);
            if (known) return reply(cb, { success: true, me: known.id, ticket: data.ticket, tournament: publicView(t) });
            if (t.status !== 'open') return reply(cb, { success: false, message: 'Les inscriptions sont fermées.' });
            const name = String(data?.name || '').trim().slice(0, 16);
            if (name.length < 2) return reply(cb, { success: false, message: 'Choisis un pseudo pour t\'inscrire.' });
            if (isOffensive(name)) return reply(cb, { success: false, message: 'Ce pseudo n\'est pas accepté.' });
            if (t.entrants.length >= t.size) return reply(cb, { success: false, message: 'Le tournoi est complet.' });
            if (t.entrants.some((e) => lower(e.name) === lower(name))) return reply(cb, { success: false, message: 'Ce pseudo est déjà inscrit : choisis-en un autre.' });
            // Pseudo d'un compte : réservé à ce compte
            const owner = await store.getByName(name).catch(() => null);
            if (owner && owner.id !== socket.data.user?.userId) return reply(cb, { success: false, message: 'Ce pseudo appartient à un compte. Connecte-toi à ce compte (Profil), ou choisis un autre pseudo.' });
            const ticket = token();
            const e = { id: crypto.randomBytes(5).toString('hex'), name, ticketHash: sha(ticket), lastSocket: socket.id };
            if (socket.data.user?.userId) e.userId = socket.data.user.userId;
            t.entrants.push(e);
            socket.join(`t:${t.id}`);
            if (!presence.has(t.id)) presence.set(t.id, new Map());
            presence.get(t.id).set(e.id, socket.id);
            await save(t);
            broadcast(t);
            reply(cb, { success: true, me: e.id, ticket, tournament: publicView(t) });
        });

        socket.on('tournament_unregister', async (data, cb) => {
            const t = find(data?.id);
            const e = t && entrantByTicket(t, data?.ticket);
            if (!e) return reply(cb, { success: false, message: 'Inscription introuvable.' });
            if (t.status !== 'open') return reply(cb, { success: false, message: 'Le tournoi a commencé : abandonner = forfait à ton prochain match.' });
            t.entrants = t.entrants.filter((x) => x !== e);
            presence.get(t.id)?.delete(e.id);
            await save(t);
            broadcast(t);
            reply(cb, { success: true, tournament: publicView(t) });
        });

        // L'organisateur lance le tournoi sans attendre l'heure prévue
        socket.on('tournament_start_now', async (data, cb) => {
            const t = find(data?.id);
            if (!t || !data?.hostToken || sha(data.hostToken) !== t.hostHash) return reply(cb, { success: false, message: "Seul l'organisateur peut lancer le tournoi." });
            if (t.status !== 'open') return reply(cb, { success: false, message: 'Le tournoi a déjà commencé.' });
            const units = t.mode === 'duo' ? Math.ceil(t.entrants.length / 2) : t.entrants.length;
            if (units < 2) return reply(cb, { success: false, message: t.mode === 'duo' ? 'Il faut au moins 3 inscrits (2 équipes).' : 'Il faut au moins 2 inscrits.' });
            start(t);
            reply(cb, { success: true, tournament: publicView(t) });
        });

        socket.on('tournament_palmares', async (_data, cb) => {
            await loaded;
            const list = [...all.values()]
                .filter((t) => t.status === 'done' && t.champion)
                .sort((x, y) => y.finishedAt - x.finishedAt)
                .slice(0, PALMARES_MAX)
                .map((t) => ({ id: t.id, name: t.name, gameType: t.gameType, mode: t.mode, size: t.size, finishedAt: t.finishedAt, champion: t.champion.name }));
            reply(cb, { success: true, list });
        });

        // Champion sans compte : il crée son compte (ou se connecte) puis réclame sa récompense
        socket.on('tournament_claim', async (data, cb) => {
            const t = find(data?.id);
            const e = t && entrantByTicket(t, data?.ticket);
            const userId = socket.data.user?.userId;
            if (!e || t.status !== 'done' || !userId) return reply(cb, { success: false });
            const u = winnerUnit(t.rounds[t.rounds.length - 1][0]);
            if (!t.units[u].members.includes(e.id) || e.claimed) return reply(cb, { success: false });
            e.claimed = true;
            e.userId = userId;
            await save(t);
            const r = await progress.awardTournament(userId, t.gameType, Date.now(), { bingaEntry: !!(t.entry && e.paid) });
            if (r) socket.emit('progress', { ...r, game: t.gameType });
            reply(cb, { success: !!r });
        });
    }

    return {
        attach, onGameOver, onDisconnect, tick,
        ready: () => loaded,
        stop: () => clearInterval(timer),
        _all: all,
    };
}

module.exports = { createTournaments, seed, fillNext, openRound, publicView, buildSummary, roundLabel, SHOWUP_MS };
