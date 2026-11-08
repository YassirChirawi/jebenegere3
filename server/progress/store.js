/**
 * Stockage des comptes joueurs.
 * - DATABASE_URL défini : PostgreSQL (une table `players`, données en JSONB). Recommandé sur Render,
 *   dont le disque est effacé à chaque redéploiement.
 * - Sinon : fichier JSON (DATA_FILE, par défaut server/data/players.json), pratique en local.
 * - STORE=memory : en mémoire (tests).
 *
 * Interface : get(id), getByName(name), save(user), all()
 */
const fs = require('fs');
const path = require('path');

const lower = (s) => String(s || '').trim().toLowerCase();

function memoryStore(initial = []) {
    const byId = new Map(initial.map((u) => [u.id, u]));
    return {
        kind: 'memory',
        async get(id) { return byId.get(id) || null; },
        async getByName(name) {
            const n = lower(name);
            for (const u of byId.values()) if (u.nameLower === n) return u;
            return null;
        },
        async save(user) { byId.set(user.id, user); return user; },
        async all() { return [...byId.values()]; },
        _map: byId,
    };
}

function fileStore(file) {
    let data = [];
    try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { data = []; }
    const mem = memoryStore(data);
    let timer = null;
    const flush = () => {
        timer = null;
        try {
            fs.mkdirSync(path.dirname(file), { recursive: true });
            const tmp = `${file}.tmp`;
            fs.writeFileSync(tmp, JSON.stringify([...mem._map.values()]));
            fs.renameSync(tmp, file);
        } catch (e) {
            console.error('[store] écriture impossible :', e.message);
        }
    };
    return {
        ...mem,
        kind: 'file',
        async save(user) {
            await mem.save(user);
            if (!timer) timer = setTimeout(flush, 300);
            return user;
        },
        flushNow() { if (timer) { clearTimeout(timer); flush(); } },
    };
}

function pgStore(url) {
    // Chargé seulement si une base est configurée
    // eslint-disable-next-line global-require
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false }, max: 5 });
    const ready = pool.query(`
        CREATE TABLE IF NOT EXISTS players (
            id TEXT PRIMARY KEY,
            name_lower TEXT UNIQUE NOT NULL,
            data JSONB NOT NULL,
            updated_at TIMESTAMPTZ DEFAULT now()
        )`);
    return {
        kind: 'postgres',
        async get(id) {
            await ready;
            const r = await pool.query('SELECT data FROM players WHERE id = $1', [id]);
            return r.rows[0]?.data || null;
        },
        async getByName(name) {
            await ready;
            const r = await pool.query('SELECT data FROM players WHERE name_lower = $1', [lower(name)]);
            return r.rows[0]?.data || null;
        },
        async save(user) {
            await ready;
            await pool.query(
                `INSERT INTO players (id, name_lower, data, updated_at) VALUES ($1, $2, $3, now())
                 ON CONFLICT (id) DO UPDATE SET name_lower = EXCLUDED.name_lower, data = EXCLUDED.data, updated_at = now()`,
                [user.id, user.nameLower, user],
            );
            return user;
        },
        async all() {
            await ready;
            const r = await pool.query('SELECT data FROM players');
            return r.rows.map((x) => x.data);
        },
        close() { return pool.end(); },
    };
}

function createStore() {
    if (process.env.STORE === 'memory') return memoryStore();
    if (process.env.DATABASE_URL) return pgStore(process.env.DATABASE_URL);
    return fileStore(process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'players.json'));
}

module.exports = { createStore, memoryStore, fileStore };
