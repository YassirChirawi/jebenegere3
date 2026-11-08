// Stockage PostgreSQL (production sur Render), testé avec une base Postgres en mémoire (pg-mem)
const test = require('node:test');
const assert = require('node:assert/strict');
const { newDb } = require('pg-mem');
const { pgStore } = require('../progress/store');
const { createProgress } = require('../progress/progress');

test('PostgreSQL : création de la table, inscription, connexion, progression, classement', async () => {
    const db = newDb({ noAstCoverageCheck: true }); // "IF NOT EXISTS" sur une table existante : non géré par pg-mem sinon
    const { Pool } = db.adapters.createPg();
    const store = pgStore('postgres://test', Pool);
    const p = createProgress(store);
    const { token, profile } = await p.register({ name: 'Postgres', password: 'secret12' });
    assert.equal((await p.register({ name: 'POSTGRES', password: 'secret12' })).error, 'Ce pseudo est déjà pris.');
    await p.award(profile.id, { game: 'ronda', xp: 130, record: true, won: true, result: 'Victoire', counters: { missa: 2 } });
    const u = await p.userFromToken(token);
    assert.equal(u.xp >= 130, true);
    assert.equal(u.stats.ronda.wins, 1);
    assert.ok((await p.login({ name: 'postgres', password: 'secret12' })).token);
    const lb = await p.leaderboard('ronda', u);
    assert.equal(lb.me.rank, 1);
    // Une "nouvelle connexion" (même base) relit les mêmes données
    const p2 = createProgress(pgStore('postgres://test', Pool));
    assert.equal((await p2.userFromToken(token)).name, 'Postgres');
});
