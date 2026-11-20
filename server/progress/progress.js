/**
 * Comptes et progression côté serveur : inscription / connexion (pseudo + mot de passe),
 * XP, statistiques, historique, défis du jour, titres, saisons et classements.
 * Le serveur calcule lui-même les XP à partir des parties qu'il arbitre.
 */
const crypto = require('crypto');
const defs = require('./defs');

const { rankFor, dailyChallenges, dayKey, TITLES, REWARDS, seasonOf, SEASON_TOP_REWARD, GAME_KEYS, BINGA, RARITIES, priceOf, cosmetic, CHESTS, FREE_AVATARS, MAX_AVATAR, WHEEL, COSMETICS, DUPLICATE_REFUND } = defs;
const { rollChest, pityLeft, serverRng, rollWheel } = require('./chests');
const CHEST_HISTORY_MAX = 50;
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

// Pseudo Discord → pseudo L'Carta valide (3 à 16 caractères autorisés), ou null
function discordName(raw) {
    let n = String(raw || '').normalize('NFC').replace(/[^\p{L}\p{N} _.'-]/gu, '').trim().replace(/\s+/g, ' ').slice(0, 16).trim();
    if (/^bot\b/i.test(n)) n = `J ${n}`.slice(0, 16);
    return NAME_RE.test(n) ? n : null;
}

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

// Choix visibles (dos, effet, tapis par jeu), gardés avec le compte pour les retrouver après une réinstallation.
// L'appli vérifie elle-même qu'un choix est débloqué avant de l'afficher.
function cleanEquipped(e) {
    const id = (v) => (typeof v === 'string' && /^[a-z0-9]{1,16}$/.test(v) ? v : undefined);
    const out = {};
    if (id(e.back)) out.back = e.back;
    if (id(e.effect)) out.effect = e.effect;
    if (id(e.table)) out.table = e.table;
    if (e.felts && typeof e.felts === 'object') {
        out.felts = {};
        GAME_KEYS.forEach((g) => { if (id(e.felts[g])) out.felts[g] = e.felts[g]; });
    }
    return out;
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
        // Compte créé par Discord : pas de mot de passe, pas de connexion par pseudo
        const hash = user?.salt && user?.hash ? await scrypt(String(password || ''), user.salt) : null;
        const ok = user && hash && crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.hash, 'hex'));
        if (!ok) {
            fail(key);
            return { error: 'Pseudo ou mot de passe incorrect.' };
        }
        fails.delete(key);
        const token = await withUser(user.id, (u) => newSession(u));
        return { token, profile: await profileOf(await store.get(user.id)) };
    }

    // Discord Activities : compte lié à l'identité Discord (id vérifié par le serveur auprès de Discord).
    // Premier passage : compte créé avec le pseudo Discord (nettoyé, rendu unique), sans mot de passe.
    async function discordLogin(discord) {
        const did = String(discord?.id || '');
        if (!/^\d{5,25}$/.test(did)) return { error: 'Profil Discord invalide.' };
        const id = `discord-${did}`;
        let user = await store.get(id);
        // Compte Discord relié à un compte L'Carta : on ouvre une session sur ce compte-là
        if (user?.linkedTo) {
            const target = await store.get(user.linkedTo);
            if (target && target.discordId === did) {
                const token = await withUser(target.id, (u) => newSession(u));
                return { token, profile: await profileOf(await store.get(target.id)) };
            }
            await store.remove(id); // compte relié supprimé depuis : on repart d'un compte Discord neuf
            user = null;
        }
        if (!user) {
            const base = discordName(discord.global_name) || discordName(discord.username) || 'Joueur';
            let name = base;
            for (let i = 0; i < 12 && await store.getByName(name); i += 1) {
                name = `${base.slice(0, 11)} ${crypto.randomInt(1000, 10000)}`;
            }
            if (await store.getByName(name)) return { error: 'Impossible de créer le compte, réessaie.' };
            user = blankUser(name);
            user.id = id;
            user.discordId = did;
            const token = await newSession(user);
            await store.save(user);
            return { token, profile: await profileOf(user), created: true };
        }
        const token = await withUser(id, (u) => newSession(u));
        return { token, profile: await profileOf(await store.get(id)) };
    }

    // Relier le compte Discord du joueur (session en cours, dans Discord) à son compte L'Carta existant
    // (pseudo + mot de passe vérifiés). La progression gagnée dans Discord est ajoutée au compte L'Carta :
    // XP, binga, statistiques, coups spéciaux, saisons, objets débloqués, historique. Ensuite, se connecter
    // depuis Discord ouvre directement le compte L'Carta.
    async function linkDiscord(sessionUser, { name, password, ip = '' }, now = Date.now()) {
        const did = sessionUser?.discordId;
        if (!did || sessionUser.id !== `discord-${did}`) return { error: 'Seul un compte créé dans Discord peut être relié.' };
        const key = `${String(name || '').toLowerCase()}|${ip}`;
        if (tooMany(key)) return { error: 'Trop d\'essais. Réessaie dans quelques minutes.' };
        const target = await store.getByName(name);
        const hash = target?.salt && target?.hash ? await scrypt(String(password || ''), target.salt) : null;
        const ok = target && hash && crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(target.hash, 'hex'));
        if (!ok) { fail(key); return { error: 'Pseudo ou mot de passe incorrect.' }; }
        fails.delete(key);
        if (target.discordId && target.discordId !== did) return { error: 'Ce compte L\'Carta est déjà relié à un autre compte Discord.' };
        const source = await store.get(sessionUser.id);
        if (!source) return { error: 'Compte Discord introuvable.' };
        if (Object.keys(source.binga?.stakes || {}).length) return { error: 'Termine d\'abord ta partie à mise en cours.' };

        await withUser(target.id, (t) => {
            t.discordId = did;
            t.xp = (t.xp || 0) + (source.xp || 0);
            const sumInto = (dst, src) => {
                for (const [k, v] of Object.entries(src || {})) if (typeof v === 'number') dst[k] = (dst[k] || 0) + v;
                return dst;
            };
            for (const [g, st] of Object.entries(source.stats || {})) {
                const cur = (t.stats[g] = t.stats[g] || { played: 0, wins: 0, losses: 0, streak: 0, best: 0 });
                cur.played = (cur.played || 0) + (st.played || 0);
                cur.wins = (cur.wins || 0) + (st.wins || 0);
                cur.losses = (cur.losses || 0) + (st.losses || 0);
                cur.best = Math.max(cur.best || 0, st.best || 0);
            }
            t.counters = sumInto({ ...(t.counters || {}) }, source.counters);
            t.seasons = t.seasons || {};
            for (const [sid, row] of Object.entries(source.seasons || {})) t.seasons[sid] = sumInto({ ...(t.seasons[sid] || {}) }, row);
            t.unlocks = [...new Set([...(t.unlocks || []), ...(source.unlocks || [])])];
            const badgeIds = new Set((t.badges || []).map((b) => b.id));
            t.badges = [...(t.badges || []), ...(source.badges || []).filter((b) => !badgeIds.has(b.id))];
            t.history = [...(t.history || []), ...(source.history || [])].sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, HISTORY_MAX);
            const b = bingaDay(t, now);
            credit(t, source.binga?.balance || 0, 'Progression Discord ajoutée (compte relié)', now);
            b.playToday = Math.max(b.playToday || 0, source.binga?.day === b.day ? source.binga.playToday || 0 : 0);
        });
        // Le compte Discord devient un simple renvoi vers le compte L'Carta (pas de pseudo, pas de session)
        await store.save({ id: source.id, name: `#discord-${did}`, nameLower: `#discord-${did}`, linkedTo: target.id, discordId: did, createdAt: source.createdAt, sessions: [], seasons: {}, stats: {} });
        const token = await withUser(target.id, (u) => newSession(u));
        return { token, profile: await profileOf(await store.get(target.id), now) };
    }

    // ------------------------------------------------------------------ amis
    // u.friends : ids des amis (lien dans les deux comptes) ; u.friendIn : demandes reçues [{ id, at }] ;
    // u.friendOut : ids des demandes envoyées. Seuls les comptes peuvent avoir des amis.
    const FRIENDS_MAX = 100;
    const PENDING_MAX = 50;
    const isPlayer = (u) => u && !u.linkedTo && typeof u.name === 'string' && !u.name.startsWith('#');
    const ensureFriends = (u) => {
        u.friends = u.friends || [];
        u.friendIn = u.friendIn || [];
        u.friendOut = u.friendOut || [];
        return u;
    };

    async function friendsView(user, isOnline = () => false) {
        const u = ensureFriends(await store.get(user.id) || user);
        const card = async (id, extra = {}) => {
            const f = await store.get(id);
            if (!isPlayer(f)) return null;
            return { id: f.id, name: f.name, avatar: f.avatar || 0, xp: f.xp || 0, online: !!isOnline(f.id), ...extra };
        };
        const friends = (await Promise.all(u.friends.map((id) => card(id)))).filter(Boolean)
            .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));
        const incoming = (await Promise.all(u.friendIn.map((r) => card(r.id, { at: r.at })))).filter(Boolean);
        const outgoing = (await Promise.all(u.friendOut.map((id) => card(id)))).filter(Boolean);
        return { friends, incoming, outgoing };
    }

    /** Demande d'ami par pseudo. Si l'autre m'avait déjà demandé, on devient amis tout de suite. */
    async function requestFriend(user, name, now = Date.now()) {
        const target = await store.getByName(String(name || '').trim());
        if (!isPlayer(target)) return { error: 'Aucun joueur avec ce pseudo (il faut un compte).' };
        if (target.id === user.id) return { error: 'C\'est toi !' };
        const me = ensureFriends(await store.get(user.id));
        if (me.friends.includes(target.id)) return { error: `${target.name} est déjà ton ami.` };
        if (me.friendIn.some((r) => r.id === target.id)) return respondFriend(user, target.id, true, now);
        if (me.friendOut.includes(target.id)) return { error: 'Demande déjà envoyée.' };
        if (me.friends.length >= FRIENDS_MAX) return { error: `${FRIENDS_MAX} amis au maximum.` };
        if (me.friendOut.length >= PENDING_MAX) return { error: 'Trop de demandes en attente.' };
        const ok = await withUser(target.id, (t) => {
            ensureFriends(t);
            if (t.friendIn.length >= PENDING_MAX) return false;
            t.friendIn = [{ id: user.id, at: now }, ...t.friendIn.filter((r) => r.id !== user.id)];
            return true;
        });
        if (!ok) return { error: `${target.name} a trop de demandes en attente.` };
        await withUser(user.id, (u) => { ensureFriends(u); u.friendOut = [...new Set([target.id, ...u.friendOut])]; });
        return { success: true, sent: true, to: { id: target.id, name: target.name } };
    }

    async function respondFriend(user, otherId, accept, now = Date.now()) {
        const other = await store.get(String(otherId || ''));
        const me = ensureFriends(await store.get(user.id));
        if (!isPlayer(other) || !me.friendIn.some((r) => r.id === other.id)) return { error: 'Demande introuvable.' };
        if (accept && me.friends.length >= FRIENDS_MAX) return { error: `${FRIENDS_MAX} amis au maximum.` };
        await withUser(user.id, (u) => {
            ensureFriends(u);
            u.friendIn = u.friendIn.filter((r) => r.id !== other.id);
            u.friendOut = u.friendOut.filter((id) => id !== other.id);
            if (accept) u.friends = [...new Set([...u.friends, other.id])];
        });
        await withUser(other.id, (o) => {
            ensureFriends(o);
            o.friendOut = o.friendOut.filter((id) => id !== user.id);
            o.friendIn = o.friendIn.filter((r) => r.id !== user.id);
            if (accept) o.friends = [...new Set([...o.friends, user.id])];
        });
        return { success: true, accepted: !!accept, other: { id: other.id, name: other.name } };
    }

    /** Retirer un ami, ou annuler une demande envoyée. */
    async function removeFriend(user, otherId) {
        const id = String(otherId || '');
        await withUser(user.id, (u) => {
            ensureFriends(u);
            u.friends = u.friends.filter((x) => x !== id);
            u.friendOut = u.friendOut.filter((x) => x !== id);
        });
        await withUser(id, (o) => {
            ensureFriends(o);
            o.friends = o.friends.filter((x) => x !== user.id);
            o.friendIn = o.friendIn.filter((r) => r.id !== user.id);
        });
        return { success: true };
    }

    // ------------------------------------------------------------------ notifications
    // u.inbox : [{ id, type, at, read, from: { id, name, avatar }, data }] (50 au plus, 30 jours)
    const INBOX_MAX = 50;
    const INBOX_TTL = 30 * 24 * 3600 * 1000;
    async function notify(userId, { type, from = null, data = {} }, now = Date.now()) {
        const item = { id: crypto.randomUUID(), type, at: now, read: false, from, data };
        const ok = await withUser(userId, (u) => {
            if (!isPlayer(u)) return false;
            u.inbox = [item, ...(u.inbox || []).filter((x) => now - x.at < INBOX_TTL)].slice(0, INBOX_MAX);
            return true;
        });
        return ok ? item : null;
    }
    async function inboxView(user, now = Date.now()) {
        const u = await store.get(user.id);
        const items = (u?.inbox || []).filter((x) => now - x.at < INBOX_TTL);
        return { items, unread: items.filter((x) => !x.read).length };
    }
    async function markInboxRead(user, ids = null) {
        await withUser(user.id, (u) => {
            (u.inbox || []).forEach((x) => { if (!ids || ids.includes(x.id)) x.read = true; });
        });
        return inboxView(user);
    }

    async function areFriends(aId, bId) {
        const a = await store.get(aId);
        return !!a && (a.friends || []).includes(bId);
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

    async function updateMe(user, { title, avatar, equipped }) {
        return withUser(user.id, async (u) => {
            if (title === null || (typeof title === 'string' && u.titles.includes(title))) u.title = title;
            // 0 = tiré du pseudo, 1 à 12 = portraits offerts, 13 à 36 = portraits débloqués (boutique, coffres)
            if (Number.isInteger(avatar) && avatar >= 0 && (avatar <= FREE_AVATARS || (avatar <= MAX_AVATAR && (u.unlocks || []).includes(`avatar:${avatar}`)))) u.avatar = avatar;
            if (equipped && typeof equipped === 'object') u.equipped = cleanEquipped(equipped);
            return profileOf(u);
        });
    }

    // ------------------------------------------------------------------ parties à mise
    // Le serveur indique quelles parties existent encore (mises en attente d'une partie disparue = rendues)
    let roomAlive = () => true;
    function setRoomAlive(fn) { roomAlive = fn; }

    /** Retire la mise au début de la partie (si le solde suffit). La mise reste « en attente » jusqu'au résultat. */
    async function chargeStake(userId, roomId, amount, now = Date.now()) {
        return withUser(userId, (u) => {
            const b = bingaDay(u, now);
            if (b.balance < amount) return { ok: false, balance: b.balance };
            b.balance -= amount;
            b.stakes = { ...(b.stakes || {}), [roomId]: { amount, at: now } };
            b.log = [{ at: now, amount: -amount, reason: `Mise de partie (salon ${roomId})` }, ...(b.log || [])].slice(0, BINGA_LOG_MAX);
            return { ok: true, balance: b.balance, profile: profileOf(u, now) };
        });
    }

    /** Résultat de la partie : gain (pot ou mise rendue), et la mise n'est plus en attente. */
    async function settleStake(userId, roomId, gain, reason, now = Date.now()) {
        return withUser(userId, (u) => {
            const b = bingaDay(u, now);
            if (!b.stakes || !b.stakes[roomId]) return { profile: profileOf(u, now) }; // déjà réglée
            delete b.stakes[roomId];
            if (gain > 0) credit(u, gain, reason || 'Partie à mise', now);
            return { profile: profileOf(u, now) };
        });
    }

    /** Entrée d'un tournoi en binga : retirée au début du tournoi (si le solde suffit, sinon il joue gratuitement). */
    async function chargeEntry(userId, amount, reason, now = Date.now()) {
        return withUser(userId, (u) => {
            const b = bingaDay(u, now);
            if (b.balance < amount) return { ok: false, balance: b.balance };
            b.balance -= amount;
            b.log = [{ at: now, amount: -amount, reason }, ...(b.log || [])].slice(0, BINGA_LOG_MAX);
            return { ok: true, balance: b.balance, profile: profileOf(u, now) };
        });
    }

    // Mises d'une partie qui n'existe plus (serveur redémarré) : rendues
    function refundStaleStakes(u, now = Date.now()) {
        const b = u.binga;
        if (!b || !b.stakes) return;
        Object.entries(b.stakes).forEach(([roomId, s]) => {
            if (roomAlive(roomId)) return;
            delete b.stakes[roomId];
            credit(u, s.amount, 'Mise rendue (partie interrompue)', now);
        });
    }

    // ------------------------------------------------------------------ coffres
    /**
     * Ouverture d'un coffre : le serveur vérifie le solde, retire le prix, tire le lot (crypto) et l'ajoute au compte.
     * Doublon : 20 % de sa valeur en binga. Garantie (pity) tenue à jour par type de coffre.
     */
    async function openChest(user, chestId, now = Date.now(), rng) {
        const chest = CHESTS[String(chestId || '')];
        if (!chest) return { error: "Ce coffre n'existe pas." };
        return withUser(user.id, (u) => {
            const b = bingaDay(u, now);
            if (b.balance < chest.price) return { error: `Il te manque ${chest.price - b.balance} binga.` };
            b.balance -= chest.price;
            b.log = [{ at: now, amount: -chest.price, reason: `${chest.label}` }, ...(b.log || [])].slice(0, BINGA_LOG_MAX);
            const result = giveChest(u, chestId, now, rng);
            return { success: true, result, profile: profileOf(u, now) };
        });
    }

    // Contenu d'un coffre (payé, ou offert par la roue du jour) : tirage, ajout au compte, doublon, garantie, historique
    function giveChest(u, chestId, now, rng, gift = false) {
        const chest = CHESTS[chestId];
        u.chests = { pity: {}, history: [], ...(u.chests || {}) };
        u.unlocks = u.unlocks || [];
        const roll = rollChest(chestId, u.chests.pity[chestId] || 0, u.unlocks, rng);
        if (roll.duplicate) credit(u, roll.refund, `Doublon : ${roll.item.label} (20 %)`, now);
        else u.unlocks.push(roll.item.id);
        if (chest.pity) u.chests.pity[chestId] = roll.nextPity;
        const result = {
            chest: chestId,
            item: { id: roll.item.id, label: roll.item.label, kind: roll.item.kind, rarity: roll.rarity },
            duplicate: roll.duplicate,
            refund: roll.refund,
            pity: roll.pity,
            ...(gift ? { gift: true } : {}),
        };
        u.chests.history = [{ at: now, ...result }, ...u.chests.history].slice(0, CHEST_HISTORY_MAX);
        return result;
    }

    // ------------------------------------------------------------------ roue du jour
    /**
     * Un tour gratuit par jour (jamais payant). Toujours un lot : binga, coffre offert ou cosmétique commun.
     * Tirage fait ici avec le générateur du serveur ; les chances sont affichées dans l'appli.
     */
    async function spinWheel(user, now = Date.now(), rng = serverRng) {
        return withUser(user.id, (u) => {
            const today = dayKey(now);
            u.wheel = { day: null, history: [], ...(u.wheel || {}) };
            if (u.wheel.day === today) return { error: "Tu as déjà fait ton tour aujourd'hui : reviens demain !" };
            bingaDay(u, now);
            const segment = rollWheel(rng);
            const seg = WHEEL.segments[segment];
            const result = { segment, id: seg.id, label: seg.label };
            if (seg.binga) {
                result.binga = credit(u, seg.binga, `Roue du jour : ${seg.label}`, now);
            } else if (seg.chest) {
                result.chest = giveChest(u, seg.chest, now, rng, true);
            } else if (seg.cosmetic) {
                const pool = COSMETICS.filter((c) => !c.source && c.rarity === seg.cosmetic);
                const missing = pool.filter((c) => !(u.unlocks || []).includes(c.id));
                if (missing.length) {
                    const item = missing[rng(missing.length)];
                    u.unlocks = [...(u.unlocks || []), item.id];
                    result.item = { id: item.id, label: item.label, kind: item.kind, rarity: item.rarity };
                } else {
                    const refund = Math.round(RARITIES[seg.cosmetic].value * DUPLICATE_REFUND);
                    result.binga = credit(u, refund, `Roue du jour : ${seg.label} (déjà tout possédé)`, now);
                    result.duplicate = true;
                }
            }
            u.wheel.day = today;
            u.wheel.history = [{ at: now, ...result }, ...u.wheel.history].slice(0, 20);
            return { success: true, result, profile: profileOf(u, now) };
        });
    }

    // ------------------------------------------------------------------ boutique
    /**
     * Achat d'un cosmétique en binga : le serveur vérifie le prix, le solde et qu'il n'est pas déjà possédé.
     * Les légendaires et les exclusifs (Champion) ne s'achètent pas.
     */
    async function buy(user, id, now = Date.now()) {
        const item = cosmetic(String(id || ''));
        if (!item) return { error: "Cet objet n'existe pas." };
        const price = priceOf(item);
        if (price === null) {
            return { error: item.source === 'tournament' ? "Ce dos est réservé au gagnant d'un tournoi." : "Les objets légendaires ne s'achètent pas : on les trouve seulement dans le coffre Or." };
        }
        return withUser(user.id, (u) => {
            const b = bingaDay(u, now);
            if ((u.unlocks || []).includes(item.id)) return { error: "Tu l'as déjà." };
            if (b.balance < price) return { error: `Il te manque ${price - b.balance} binga.` };
            b.balance -= price;
            b.log = [{ at: now, amount: -price, reason: `Achat : ${item.label} (${RARITIES[item.rarity].label})` }, ...(b.log || [])].slice(0, BINGA_LOG_MAX);
            u.unlocks = [...(u.unlocks || []), item.id];
            return { success: true, item: { id: item.id, label: item.label, kind: item.kind }, profile: profileOf(u, now) };
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
    async function awardTournament(userId, game, now = Date.now(), { bingaEntry = false } = {}) {
        const counters = bingaEntry ? { tournament_win: 1, binga_tournament_win: 1 } : { tournament_win: 1 };
        const r = await award(userId, { game, xp: bingaEntry ? TOURNAMENT_XP * 2 : TOURNAMENT_XP, record: false, counters }, now);
        if (!r) return null;
        return withUser(userId, (u) => {
            // Dos « Champion » ; tournoi à entrée en binga : en plus, le dos exclusif « Sultan »
            const ids = bingaEntry ? ['back:sultan', 'back:tournoi'] : ['back:tournoi'];
            const fresh = ids.filter((id) => !u.unlocks.includes(id));
            fresh.forEach((id) => u.unlocks.push(id));
            const reward = fresh.length ? REWARDS.find((x) => x.id === fresh[0]) : null;
            return { ...r, reward: reward ? { id: reward.id, label: reward.label, kind: reward.kind } : null, profile: profileOf(u, now) };
        });
    }

    // Abandon en cours de partie : compté comme une défaite, sans XP
    async function recordAbandon(userId, game, opponents, now = Date.now()) {
        return award(userId, { game, xp: 0, record: true, won: false, result: 'Abandon 🏳️', opponents, counters: {}, hezz2Khasser: true, noBinga: true }, now);
    }

    // Connexion du jour (une fois par jour, le serveur décide) : { reward | null, profile }
    async function dailyLogin(user, now = Date.now()) {
        return withUser(user.id, (u) => {
            refundStaleStakes(u, now);
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
            discord: u.discordId ? (u.id === `discord-${u.discordId}` ? 'only' : 'linked') : null, // compte créé dans Discord / relié
            unread: (u.inbox || []).filter((x) => !x.read && Date.now() - x.at < 30 * 24 * 3600 * 1000).length,
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
            equipped: u.equipped || {},
            chests: {
                pityLeft: Object.fromEntries(Object.keys(CHESTS).filter((k) => CHESTS[k].pity).map((k) => [k, pityLeft(k, u.chests?.pity?.[k] || 0)])),
                history: u.chests?.history || [],
            },
            titles: TITLES.map((t) => ({ id: t.id, label: t.label, desc: t.desc, target: t.target, progress: Math.min(t.target, u.counters[t.counter] || 0), unlocked: u.titles.includes(t.id) })),
            badges: u.badges || [],
            season: { id: season.id, end: season.end, xp: u.seasons?.[season.id]?.all || 0 },
            binga: bingaView(u, now),
            wheel: { available: !u.wheel || u.wheel.day !== dayKey(now), history: (u.wheel?.history || []).slice(0, 5) },
        };
    }

    async function profile(user, now = Date.now()) {
        const fresh = await settleSeasons(user, now);
        return withUser(fresh.id, (u) => { refundStaleStakes(u, now); return profileOf(u, now); });
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

    return { register, login, discordLogin, linkDiscord, friendsView, requestFriend, respondFriend, removeFriend, areFriends, notify, inboxView, markInboxRead, logout, userFromToken, updateMe, publicInfo, award, awardTournament, recordAbandon, dailyLogin, buy, openChest, spinWheel, chargeStake, settleStake, setRoomAlive, chargeEntry, profile, leaderboard, getBlocked, setBlocked, deleteAccount, store };
}

module.exports = { createProgress };
