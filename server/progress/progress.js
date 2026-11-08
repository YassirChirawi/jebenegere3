/**
 * Comptes et progression côté serveur : inscription / connexion (pseudo + mot de passe),
 * XP, statistiques, historique, défis du jour, titres, saisons et classements.
 * Le serveur calcule lui-même les XP à partir des parties qu'il arbitre.
 */
const crypto = require('crypto');
const defs = require('./defs');

const { rankFor, dailyChallenges, dayKey, TITLES, REWARDS, seasonOf, SEASON_TOP_REWARD, GAME_KEYS } = defs;

const NAME_RE = /^[\p{L}\p{N} _.'-]{3,16}$/u;
const HISTORY_MAX = 30;
const SESSIONS_MAX = 5;
const IMPORT_XP_MAX = 3000;

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
    };
}

function createProgress(store) {
    // Sérialise les écritures par joueur (deux parties qui finissent en même temps)
    const locks = new Map();
    function withUser(id, fn) {
        const prev = locks.get(id) || Promise.resolve();
        const run = prev.then(async () => {
            const user = await store.get(id);
            if (!user) return null;
            const out = await fn(user);
            await store.save(user);
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
            if (Number.isInteger(avatar) && avatar >= 0 && avatar < 12) u.avatar = avatar;
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

    async function seasonRanking(sid, game = 'all') {
        const users = await store.all();
        return users
            .map((u) => ({ u, xp: u.seasons?.[sid]?.[game] || 0 }))
            .filter((x) => x.xp > 0)
            .sort((a, b) => b.xp - a.xp || a.u.createdAt - b.u.createdAt);
    }

    // Récompenses des saisons terminées (calculées à la première visite après la fin)
    async function settleSeasons(user, now = Date.now()) {
        const current = seasonOf(now).id;
        const pending = Object.keys(user.seasons || {}).map(Number).filter((sid) => sid < current && !user.seasonDone?.[sid]);
        if (!pending.length) return user;
        const results = {};
        for (const sid of pending) {
            const ranking = await seasonRanking(sid);
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
        const ranking = await seasonRanking(season.id, key);
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

            u.xp += xpGained;
            addSeasonXp(u, entry.game, xpGained, now);

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
            return { xpGained, completed, titles: newTitles, profile: profileOf(u, now) };
        });
    }

    // Abandon en cours de partie : compté comme une défaite, sans XP
    async function recordAbandon(userId, game, opponents, now = Date.now()) {
        return award(userId, { game, xp: 0, record: true, won: false, result: 'Abandon 🏳️', opponents, counters: {}, hezz2Khasser: true }, now);
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
        };
    }

    async function profile(user, now = Date.now()) {
        const fresh = await settleSeasons(user, now);
        return withUser(fresh.id, (u) => profileOf(u, now));
    }

    return { register, login, logout, userFromToken, updateMe, publicInfo, award, recordAbandon, profile, leaderboard, store };
}

module.exports = { createProgress };
