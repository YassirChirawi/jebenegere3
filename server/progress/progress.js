/**
 * Comptes et progression côté serveur : inscription / connexion (pseudo + mot de passe),
 * XP, statistiques, historique, défis du jour, titres, saisons et classements.
 * Le serveur calcule lui-même les XP à partir des parties qu'il arbitre.
 */
const crypto = require('crypto');
const defs = require('./defs');

const { rankFor, dailyChallenges, dayKey, TITLES, REWARDS, seasonOf, SEASON_TOP_REWARD, GAME_KEYS, BINGA } = defs;
const BINGA_LOG_MAX = 30;
const GAME_NAMES = { hezz2: 'Hezz2', ronda: 'Ronda', kdoub: 'Kdoub', sota: 'Sota' };

const NAME_RE = /^[\p{L}\p{N} _.'-]{3,16}$/u;
const HISTORY_MAX = 30;
const SESSIONS_MAX = 5;
const IMPORT_XP_MAX = 3000;
const TOURNAMENT_XP = 150; // bonus du champion de tournoi

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const scrypt = (password, salt) => new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, key) => (err ? reject(err) : resolve(key.toString('hex'))));
});

function blankUser(name) {
    return {
        id: crypto.randomUUID(),
        name,
        nameLower: name.toLowerCase(),
        createdAt: Date.now(),
        salt: null,
        hash: null,
        sessions: [],
        avatar: 0,
        title: null,
        xp: 0,
        stats: {},
        counters: {},
        history: [],
        daily: { day: null, progress: {}, done: [] },
        unlocks: [],
        titles: [],
        seasons: {},
        seasonDone: {},
        badges: [],
        blocked: [], // joueurs bloqués dans le chat : [{ key, name, at }]
        binga: blankBinga(),
    };
}

// ----------------------------------------------------------------------------
// Binga : tout est calculé ici, à partir des parties arbitrées par le serveur
// (jamais sur la parole de l'appli)
// ----------------------------------------------------------------------------
function blankBinga() {
    return { balance: 0, day: null, playToday: 0, missions: { progress: {}, done: [] }, login: { last: null, streak: 0 }, log: [] };
}

// Remet à zéro les compteurs du jour (gains en jouant, missions) quand le jour change
function bingaDay(u, now = Date.now()) {
    u.binga = { ...blankBinga(), ...(u.binga || {}) };
    const day = dayKey(now);
    if (u.binga.day !== day) {
        u.binga.day = day;
        u.binga.playToday = 0;
        u.binga.missions = { progress: {}, done: [] };
    }
    return u.binga;
}

function credit(u, amount, reason, now = Date.now()) {
    if (!amount) return 0;
    u.binga.balance += amount;
    u.binga.log = [{ at: now, amount, reason }, ...(u.binga.log || [])].slice(0, BINGA_LOG_MAX);
    return amount;
}

/**
 * Binga d'une partie finie : 10 même en perdant, 25 en gagnant (20 contre l'ordinateur),
 * dans la limite de 500 par jour ; puis missions du jour. Rien pour un abandon ou une partie
 * jouée en automatique.
 */
function bingaForGame(u, entry, now = Date.now()) {
    const b = bingaDay(u, now);
    const out = { game: 0, base: 0, capped: false, won: !!entry.won, vsBots: !!entry.vsBots, missions: [] };
    if (!entry.record || entry.noBinga || entry.afk) return out;
    const rates = entry.vsBots ? BINGA.game.bots : BINGA.game.online;
    out.base = entry.won ? rates.win : rates.loss;
    out.game = Math.max(0, Math.min(out.base, BINGA.playDailyCap - b.playToday));
    out.capped = out.game < out.base;
    b.playToday += out.game;
    credit(u, out.game, `Partie de ${GAME_NAMES[entry.game] || entry.game} · ${entry.won ? 'victoire' : 'défaite'}`, now);

    const metrics = { play: 1, win: entry.won ? 1 : 0, other: ['ronda', 'kdoub', 'sota'].includes(entry.game) ? 1 : 0 };
    BINGA.missions.forEach((m) => {
        if (b.missions.done.includes(m.id) || !metrics[m.metric]) return;
        b.missions.progress[m.id] = Math.min(m.target, (b.missions.progress[m.id] || 0) + metrics[m.metric]);
        if (b.missions.progress[m.id] >= m.target) {
            b.missions.done.push(m.id);
            credit(u, m.binga, `Mission : ${m.label}`, now);
            out.missions.push({ id: m.id, label: m.label, binga: m.binga });
        }
    });
    return out;
}

/** Connexion du jour : 50, 75, puis 100 (jours 3 à 6), 150 le 7e jour ; un jour manqué remet la série à 1. */
function claimLogin(u, now = Date.now()) {
    const b = bingaDay(u, now);
    const today = dayKey(now);
    if (b.login.last === today) return null;
    const yesterday = dayKey(now - 24 * 3600 * 1000);
    const streak = b.login.last === yesterday ? (b.login.streak % BINGA.login.length) + 1 : 1;
    const amount = BINGA.login[streak - 1];
    b.login = { last: today, streak };
    credit(u, amount, `Connexion du jour (jour ${streak}/${BINGA.login.length})`, now);
    return { amount, streak, days: BINGA.login.length };
}

function bingaView(u, now = Date.now()) {
    const b = bingaDay(u, now);
    const today = dayKey(now);
    const claimed = b.login.last === today;
    const yesterday = dayKey(now - 24 * 3600 * 1000);
    const nextStreak = claimed ? b.login.streak : (b.login.last === yesterday ? (b.login.streak % BINGA.login.length) + 1 : 1);
    return {
        balance: b.balance,
        playToday: b.playToday,
        playCap: BINGA.playDailyCap,
        missions: BINGA.missions.map((m) => ({ ...m, progress: b.missions.progress[m.id] || 0, done: b.missions.done.includes(m.id) })),
        login: { claimed, streak: claimed ? b.login.streak : nextStreak, amount: BINGA.login[nextStreak - 1], days: BINGA.login.length },
        log: b.log || [],
    };
}

// Classement gardé en mémoire : relu dans la base au plus une fois par minute et par (saison, jeu),
// et tenu à jour à chaque enregistrement d'un compte (XP, pseudo, portrait, titre) ou suppression.
const RANKING_TTL_MS = Number(process.env.RANKING_TTL_MS) || 60 * 1000;

function createProgress(store) {
    const { rankRow, rankRows } = require('./store');
    const rankingCache = new Map(); // `${sid}:${game}` -> { at, rows (triées) }
    const byRank = (a, b) => b.xp - a.xp || a.createdAt - b.createdAt;
    function touchRanking(u) {
        for (const [key, entry] of rankingCache) {
            const [sid, game] = key.split(':');
            const row = rankRow(u, sid, game);
            entry.rows = entry.rows.filter((r) => r.id !== u.id);
            if (row.xp > 0) entry.rows.push(row);
            entry.rows.sort(byRank);
        }
    }
    function dropFromRanking(id) {
        for (const entry of rankingCache.values()) entry.rows = entry.rows.filter((r) => r.id !== id);
    }

    // Sérialise les écritures par joueur (deux parties qui finissent en même temps)
    const locks = new Map();
    function withUser(id, fn) {
        const prev = locks.get(id) || Promise.resolve();
        const run = prev.then(async () => {
            const user = await store.get(id);
            if (!user) return null;
            const out = await fn(user);
            await store.save(user);
            touchRanking(user);
            return out;
        });
        locks.set(id, run.catch(() => {}));
        return run;
    }

    // Limite des essais de connexion ratés : 8 par pseudo et par adresse toutes les 10 minutes
    const fails = new Map();
    const tooMany = (key) => {
        const f = fails.get(key);
        return f && f.n >= 8 && Date.now() - f.at < 10 * 60 * 1000;
    };
    const fail = (key) => {
        const f = fails.get(key);
        if (!f || Date.now() - f.at > 10 * 60 * 1000) fails.set(key, { n: 1, at: Date.now() });
        else f.n += 1;
    };

    async function newSession(user) {
        const token = `${user.id}.${crypto.randomBytes(24).toString('hex')}`;
        user.sessions = [{ h: sha(token), at: Date.now() }, ...(user.sessions || [])].slice(0, SESSIONS_MAX);
        return token;
    }

    // ------------------------------------------------------------------ comptes
    async function register({ name, password, importXp }) {
        name = String(name || '').trim().replace(/\s+/g, ' ');
        if (!NAME_RE.test(name)) return { error: 'Pseudo : 3 à 16 caractères (lettres, chiffres, espace, _ . - ).' };
        if (/^bot\b/i.test(name)) return { error: 'Ce pseudo est réservé.' };
        if (typeof password !== 'string' || password.length < 6 || password.length > 64) return { error: 'Mot de passe : 6 caractères minimum.' };
        if (await store.getByName(name)) return { error: 'Ce pseudo est déjà pris.' };
        const user = blankUser(name);
        user.salt = crypto.randomBytes(16).toString('hex');
        user.hash = await scrypt(password, user.salt);
        // Reprise de la progression locale (plafonnée)
        const imported = Math.max(0, Math.min(IMPORT_XP_MAX, Math.floor(Number(importXp) || 0)));
        user.xp = imported;
        const token = await newSession(user);
        await store.save(user);
        return { token, profile: await profileOf(user) };
    }

    async function login({ name, password, ip = '' }) {
        const key = `${String(name || '').toLowerCase()}|${ip}`;
        if (tooMany(key)) return { error: 'Trop d\'essais. Réessaie dans quelques minutes.' };
        const user = await store.getByName(name);
        const hash = user ? await scrypt(String(password || ''), user.salt) : null;
        const ok = user && hash && crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.hash, 'hex'));
        if (!ok) {
            fail(key);
            return { error: 'Pseudo ou mot de passe incorrect.' };
        }
        fails.delete(key);
        const token = await withUser(user.id, (u) => newSession(u));
        return { token, profile: await profileOf(await store.get(user.id)) };
    }

    async function userFromToken(token) {
        if (typeof token !== 'string' || !token.includes('.')) return null;
        const id = token.split('.')[0];
        const user = await store.get(id);
        if (!user) return null;
        const h = sha(token);
        return (user.sessions || []).some((s) => s.h === h) ? user : null;
    }

    async function logout(token) {
        const user = await userFromToken(token);
        if (!user) return;
        const h = sha(token);
        await withUser(user.id, (u) => { u.sessions = (u.sessions || []).filter((s) => s.h !== h); });
    }

    async function updateMe(user, { title, avatar }) {
        return withUser(user.id, async (u) => {
            if (title === null || (typeof title === 'string' && u.titles.includes(title))) u.title = title;
            if (Number.isInteger(avatar) && avatar >= 0 && avatar <= 12) u.avatar = avatar; // 0 = tiré du pseudo, 1 à 12 = portrait choisi
            return profileOf(u);
        });
    }

    // Résumé public d'un joueur (affiché dans les salons)
    const publicInfo = (u) => ({
        userId: u.id,
        name: u.name,
        avatar: u.avatar || 0,
        title: u.title ? (TITLES.find((t) => t.id === u.title)?.label || null) : null,
    });

    // ------------------------------------------------------------------ défis
    function ensureDay(u, now = Date.now()) {
        const day = dayKey(now);
        if (!u.daily || u.daily.day !== day) u.daily = { day, progress: {}, done: [] };
        return dailyChallenges(day);
    }

    function lockedRewards(u, source = 'challenge') {
        return REWARDS.filter((r) => r.source === source && !u.unlocks.includes(r.id));
    }

    // ------------------------------------------------------------------ saisons
    function addSeasonXp(u, game, xp, now = Date.now()) {
        if (!xp) return;
        const sid = seasonOf(now).id;
        const s = (u.seasons[sid] = u.seasons[sid] || { all: 0 });
        s.all += xp;
        s[game] = (s[game] || 0) + xp;
    }

    async function seasonRanking(sid, game = 'all', now = Date.now()) {
        const key = `${sid}:${game}`;
        let entry = rankingCache.get(key);
        if (!entry || now - entry.at > RANKING_TTL_MS || now < entry.at) {
            const rows = store.seasonRows ? await store.seasonRows(sid, game) : rankRows(await store.all(), sid, game);
            entry = { at: now, rows: rows.sort(byRank) };
            rankingCache.set(key, entry);
        }
        // Même forme qu'avant : { u, xp }, u ne contenant que les champs publics
        return entry.rows.map((r) => ({ u: r, xp: r.xp }));
    }

    // Récompenses des saisons terminées (calculées à la première visite après la fin)
    async function settleSeasons(user, now = Date.now()) {
        const current = seasonOf(now).id;
        const pending = Object.keys(user.seasons || {}).map(Number).filter((sid) => sid < current && !user.seasonDone?.[sid]);
        if (!pending.length) return user;
        const results = {};
        for (const sid of pending) {
            const ranking = await seasonRanking(sid, 'all', now);
            results[sid] = { rank: ranking.findIndex((x) => x.u.id === user.id) + 1, xp: user.seasons[sid].all };
        }
        await withUser(user.id, (u) => {
            u.seasonDone = u.seasonDone || {};
            for (const sid of pending) {
                if (u.seasonDone[sid]) continue;
                u.seasonDone[sid] = true;
                const { rank, xp } = results[sid];
                if (rank >= 1 && rank <= SEASON_TOP_REWARD) {
                    if (!u.unlocks.includes('back:saison')) u.unlocks.push('back:saison');
                    u.badges.push({ id: `s${sid}`, label: `Saison ${sid} · ${rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : 'Top 10'}`, season: sid, rank });
                } else if (xp >= 500) {
                    u.badges.push({ id: `s${sid}`, label: `Saison ${sid} · participant`, season: sid, rank });
                }
            }
        });
        return store.get(user.id);
    }

    async function leaderboard(game = 'all', user = null, now = Date.now()) {
        const season = seasonOf(now);
        const key = GAME_KEYS.includes(game) ? game : 'all';
        const ranking = await seasonRanking(season.id, key, now);
        const row = (x, i) => ({ rank: i + 1, name: x.u.name, avatar: x.u.avatar || 0, title: publicInfo(x.u).title, xp: x.xp });
        const meIdx = user ? ranking.findIndex((x) => x.u.id === user.id) : -1;
        return {
            season: { id: season.id, start: season.start, end: season.end },
            game: key,
            players: ranking.length,
            top: ranking.slice(0, 50).map(row),
            me: meIdx >= 0 ? row(ranking[meIdx], meIdx) : null,
        };
    }

    // ------------------------------------------------------------------ fin de partie
    /**
     * entry : { game, xp, record, won, result, opponents, counters: { metric: n }, hezz2Khasser? }
     * Renvoie { xpGained, completed: [...], titles: [...], profile }
     */
    async function award(userId, entry, now = Date.now()) {
        return withUser(userId, (u) => {
            const counters = { ...(entry.counters || {}) };
            let xpGained = entry.xp || 0;

            if (entry.record) {
                counters.play_any = (counters.play_any || 0) + 1;
                const st = (u.stats[entry.game] = u.stats[entry.game] || { played: 0, wins: 0, losses: 0, streak: 0, best: 0 });
                st.played += 1;
                if (entry.won) {
                    st.wins += 1;
                    st.streak += 1;
                    st.best = Math.max(st.best, st.streak);
                    counters[`win_${entry.game}`] = (counters[`win_${entry.game}`] || 0) + 1;
                } else {
                    st.losses += 1;
                    st.streak = 0;
                }
                if (entry.game === 'hezz2') {
                    u.counters.hezz2_safe = entry.hezz2Khasser ? 0 : (u.counters.hezz2_safe || 0) + 1;
                    u.counters.hezz2_safe_best = Math.max(u.counters.hezz2_safe_best || 0, u.counters.hezz2_safe);
                }
            }

            // Compteurs cumulés (titres)
            Object.entries(counters).forEach(([k, n]) => { u.counters[k] = (u.counters[k] || 0) + n; });

            // Défis du jour
            const today = ensureDay(u, now);
            const completed = [];
            today.forEach((c) => {
                if (u.daily.done.includes(c.id) || !counters[c.metric]) return;
                u.daily.progress[c.id] = Math.min(c.target, (u.daily.progress[c.id] || 0) + counters[c.metric]);
                if (u.daily.progress[c.id] >= c.target) {
                    u.daily.done.push(c.id);
                    xpGained += c.xp;
                    const pool = lockedRewards(u);
                    const reward = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
                    if (reward) u.unlocks.push(reward.id);
                    completed.push({ id: c.id, label: c.label, xp: c.xp, reward: reward ? { id: reward.id, label: reward.label, kind: reward.kind } : null });
                }
            });

            // Titres
            const newTitles = [];
            TITLES.forEach((t) => {
                if (!u.titles.includes(t.id) && (u.counters[t.counter] || 0) >= t.target) {
                    u.titles.push(t.id);
                    newTitles.push({ id: t.id, label: t.label });
                }
            });

            // Binga : partie finie (même perdue) et missions du jour, puis nouveau rang
            const binga = bingaForGame(u, entry, now);
            const rankBefore = rankFor(u.xp).index;
            u.xp += xpGained;
            addSeasonXp(u, entry.game, xpGained, now);
            const ranksUp = Math.max(0, rankFor(u.xp).index - rankBefore);
            binga.rank = credit(u, ranksUp * BINGA.rankUp, `Nouveau rang : ${rankFor(u.xp).name}`, now);
            binga.total = binga.game + binga.missions.reduce((n, m) => n + m.binga, 0) + binga.rank;

            if (entry.record) {
                u.history = [{
                    game: entry.game,
                    result: entry.result,
                    won: !!entry.won,
                    xp: xpGained,
                    opponents: entry.opponents || '',
                    at: now,
                }, ...(u.history || [])].slice(0, HISTORY_MAX);
            }
            return { xpGained, completed, titles: newTitles, binga, profile: profileOf(u, now) };
        });
    }

    // Tournoi gagné : dos « Champion » (exclusif), titre « Moul chi » (compteur tournament_win) et XP
    async function awardTournament(userId, game, now = Date.now()) {
        const r = await award(userId, { game, xp: TOURNAMENT_XP, record: false, counters: { tournament_win: 1 } }, now);
        if (!r) return null;
        return withUser(userId, (u) => {
            const reward = REWARDS.find((x) => x.id === 'back:tournoi');
            const isNew = !u.unlocks.includes(reward.id);
            if (isNew) u.unlocks.push(reward.id);
            return { ...r, reward: isNew ? { id: reward.id, label: reward.label, kind: reward.kind } : null, profile: profileOf(u, now) };
        });
    }

    // Abandon en cours de partie : compté comme une défaite, sans XP
    async function recordAbandon(userId, game, opponents, now = Date.now()) {
        return award(userId, { game, xp: 0, record: true, won: false, result: 'Abandon 🏳️', opponents, counters: {}, hezz2Khasser: true, noBinga: true }, now);
    }

    // Connexion du jour (une fois par jour, le serveur décide) : { reward | null, profile }
    async function dailyLogin(user, now = Date.now()) {
        return withUser(user.id, (u) => {
            const reward = claimLogin(u, now);
            return { reward, profile: profileOf(u, now) };
        });
    }

    // ------------------------------------------------------------------ profil
    function profileOf(u, now = Date.now()) {
        const today = ensureDay(u, now);
        const season = seasonOf(now);
        return {
            id: u.id,
            name: u.name,
            avatar: u.avatar || 0,
            title: u.title,
            xp: u.xp,
            rank: rankFor(u.xp),
            stats: Object.fromEntries(GAME_KEYS.map((g) => [g, { played: 0, wins: 0, losses: 0, streak: 0, best: 0, ...(u.stats[g] || {}) }])),
            counters: u.counters,
            history: u.history || [],
            daily: {
                day: u.daily.day,
                list: today.map((c) => ({ ...c, progress: u.daily.progress[c.id] || 0, done: u.daily.done.includes(c.id) })),
            },
            unlocks: u.unlocks,
            titles: TITLES.map((t) => ({ id: t.id, label: t.label, desc: t.desc, target: t.target, progress: Math.min(t.target, u.counters[t.counter] || 0), unlocked: u.titles.includes(t.id) })),
            badges: u.badges || [],
            season: { id: season.id, end: season.end, xp: u.seasons?.[season.id]?.all || 0 },
            binga: bingaView(u, now),
        };
    }

    async function profile(user, now = Date.now()) {
        const fresh = await settleSeasons(user, now);
        return withUser(fresh.id, (u) => profileOf(u, now));
    }

    // Suppression définitive du compte (après les écritures en cours de ce joueur)
    async function deleteAccount(userId) {
        await (locks.get(userId) || Promise.resolve());
        locks.delete(userId);
        dropFromRanking(userId);
        return store.remove(userId);
    }

    // Joueurs bloqués (chat) : suivent le compte d'un appareil à l'autre
    async function getBlocked(userId) {
        const u = await store.get(userId);
        return (u && u.blocked) || [];
    }
    async function setBlocked(userId, list) {
        return withUser(userId, (u) => { u.blocked = list; return u.blocked; });
    }

    return { register, login, logout, userFromToken, updateMe, publicInfo, award, awardTournament, recordAbandon, dailyLogin, profile, leaderboard, getBlocked, setBlocked, deleteAccount, store };
}

module.exports = { createProgress };
