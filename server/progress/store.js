/**
 * Stockage des comptes joueurs.
 * - DATABASE_URL défini : PostgreSQL (une table `players`, données en JSONB). Recommandé sur Render,
 *   dont le disque est effacé à chaque redéploiement.
 * - Sinon : fichier JSON (DATA_FILE, par défaut server/data/players.json), pratique en local.
 * - STORE=memory : en mémoire (tests).
 *
 * Interface : get(id), getByName(name), save(user), all(), remove(id) (suppression définitive du compte)
 * Signalements du chat : addReport(report), listReports(), deleteReport(id)
 *   (purgés automatiquement au bout de REPORT_TTL_MS, 6 mois, comme annoncé dans /privacy)
 * Tournois : saveTournament(t), listTournaments(), deleteTournament(id)
 *   (pseudos et tableau seulement, aucune donnée personnelle)
 */
const fs = require('fs');
const path = require('path');

const lower = (s) => String(s || '').trim().toLowerCase();
const REPORT_TTL_MS = 183 * 24 * 3600 * 1000;
const fresh = (r, now = Date.now()) => r && now - r.at < REPORT_TTL_MS;

function memoryStore(initial = [], initialReports = [], initialTournaments = []) {
    const byId = new Map(initial.map((u) => [u.id, u]));
    const tournaments = new Map(initialTournaments.map((t) => [t.id, t]));
    let reports = initialReports.filter((r) => fresh(r));
    return {
        kind: 'memory',
        async get(id) { return byId.get(id) || null; },
        async getByName(name) {
            const n = lower(name);
            for (const u of byId.values()) if (u.nameLower === n) return u;
            return null;
        },
        async save(user) { byId.set(user.id, user); return user; },
        async remove(id) { return byId.delete(id); },
        async all() { return [...byId.values()]; },
        async addReport(r) { reports = [...reports.filter((x) => fresh(x)), r]; return r; },
        async listReports() { reports = reports.filter((x) => fresh(x)); return [...reports]; },
        async deleteReport(id) { const n = reports.length; reports = reports.filter((x) => x.id !== id); return reports.length < n; },
        async saveTournament(t) { tournaments.set(t.id, JSON.parse(JSON.stringify(t))); return t; },
        async listTournaments() { return [...tournaments.values()].map((t) => JSON.parse(JSON.stringify(t))); },
        async deleteTournament(id) { return tournaments.delete(id); },
        _map: byId,
        _reports: () => reports,
        _tournaments: () => [...tournaments.values()],
    };
}

function fileStore(file) {
    let data = [];
    try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { data = []; }
    const reportsFile = path.join(path.dirname(file), 'reports.json');
    let reportsData = [];
    try { reportsData = JSON.parse(fs.readFileSync(reportsFile, 'utf8')); } catch (e) { reportsData = []; }
    const tournamentsFile = path.join(path.dirname(file), 'tournaments.json');
    let tournamentsData = [];
    try { tournamentsData = JSON.parse(fs.readFileSync(tournamentsFile, 'utf8')); } catch (e) { tournamentsData = []; }
    const mem = memoryStore(data, reportsData, tournamentsData);
    const writeJson = (target, value) => {
        try {
            fs.mkdirSync(path.dirname(target), { recursive: true });
            const tmp = `${target}.tmp`;
            fs.writeFileSync(tmp, JSON.stringify(value));
            fs.renameSync(tmp, target);
        } catch (e) {
            console.error('[store] écriture impossible :', e.message);
        }
    };
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
        // Suppression : le fichier est réécrit tout de suite, sans le compte (aucune copie gardée)
        async remove(id) {
            const ok = await mem.remove(id);
            if (timer) { clearTimeout(timer); timer = null; }
            flush();
            return ok;
        },
        async addReport(r) { await mem.addReport(r); writeJson(reportsFile, mem._reports()); return r; },
        async listReports() { const list = await mem.listReports(); writeJson(reportsFile, list); return list; },
        async deleteReport(id) { const ok = await mem.deleteReport(id); writeJson(reportsFile, mem._reports()); return ok; },
        async saveTournament(t) { await mem.saveTournament(t); writeJson(tournamentsFile, mem._tournaments()); return t; },
        async deleteTournament(id) { const ok = await mem.deleteTournament(id); writeJson(tournamentsFile, mem._tournaments()); return ok; },
        flushNow() { if (timer) { clearTimeout(timer); flush(); } },
    };
}

function pgStore(url, PoolImpl) {
    // Chargé seulement si une base est configurée (PoolImpl : pour les tests)
    // eslint-disable-next-line global-require
    const Pool = PoolImpl || require('pg').Pool;
    const pool = new Pool(PoolImpl ? {} : { connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false }, max: 5 });
    const ready = pool.query(`
        CREATE TABLE IF NOT EXISTS players (
            id TEXT PRIMARY KEY,
            name_lower TEXT UNIQUE NOT NULL,
            data JSONB NOT NULL,
            updated_at TIMESTAMPTZ DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS reports (
            id TEXT PRIMARY KEY,
            at BIGINT NOT NULL,
            data JSONB NOT NULL
        );
        CREATE TABLE IF NOT EXISTS tournaments (
            id TEXT PRIMARY KEY,
            data JSONB NOT NULL,
            updated_at TIMESTAMPTZ DEFAULT now()
        )`);
    const purge = () => pool.query('DELETE FROM reports WHERE at < $1', [Date.now() - REPORT_TTL_MS]);
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
        async remove(id) {
            await ready;
            const r = await pool.query('DELETE FROM players WHERE id = $1', [id]);
            return r.rowCount > 0;
        },
        async all() {
            await ready;
            const r = await pool.query('SELECT data FROM players');
            return r.rows.map((x) => x.data);
        },
        async addReport(r) {
            await ready;
            await purge();
            await pool.query('INSERT INTO reports (id, at, data) VALUES ($1, $2, $3)', [r.id, r.at, r]);
            return r;
        },
        async listReports() {
            await ready;
            await purge();
            const r = await pool.query('SELECT data FROM reports ORDER BY at');
            return r.rows.map((x) => x.data);
        },
        async deleteReport(id) {
            await ready;
            const r = await pool.query('DELETE FROM reports WHERE id = $1', [id]);
            return r.rowCount > 0;
        },
        async saveTournament(t) {
            await ready;
            await pool.query(
                `INSERT INTO tournaments (id, data, updated_at) VALUES ($1, $2, now())
                 ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
                [t.id, t],
            );
            return t;
        },
        async listTournaments() {
            await ready;
            const r = await pool.query('SELECT data FROM tournaments');
            return r.rows.map((x) => x.data);
        },
        async deleteTournament(id) {
            await ready;
            const r = await pool.query('DELETE FROM tournaments WHERE id = $1', [id]);
            return r.rowCount > 0;
        },
        close() { return pool.end(); },
    };
}

function createStore() {
    if (process.env.STORE === 'memory') return memoryStore();
    if (process.env.DATABASE_URL) return pgStore(process.env.DATABASE_URL);
    return fileStore(process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'players.json'));
}

module.exports = { createStore, memoryStore, fileStore, pgStore, REPORT_TTL_MS };
