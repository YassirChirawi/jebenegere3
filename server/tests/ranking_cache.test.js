// Classement en cache : la base est lue au plus une fois par minute, et le classement reste juste
// après une partie, un changement de portrait ou une suppression de compte
process.env.STORE = 'memory';
const test = require('node:test');
const assert = require('node:assert/strict');
const { memoryStore } = require('../progress/store');
const { createProgress } = require('../progress/progress');

test('classement : une lecture de la base, puis tenu à jour sans relire', async () => {
    const store = memoryStore();
    let reads = 0;
    const seasonRows = store.seasonRows.bind(store);
    store.seasonRows = async (...a) => { reads += 1; return seasonRows(...a); };
    const p = createProgress(store);
    const a = (await p.register({ name: 'Amine', password: 'secret12' })).profile;
    const b = (await p.register({ name: 'Badr', password: 'secret12' })).profile;
    await p.award(a.id, { game: 'hezz2', xp: 100, record: true, won: true, result: 'Victoire' });

    let lb = await p.leaderboard('all');
    assert.equal(reads, 1);
    assert.deepEqual(lb.top.map((r) => r.name), ['Amine']);

    // Badr gagne plus : il passe devant, sans nouvelle lecture
    await p.award(b.id, { game: 'hezz2', xp: 250, record: true, won: true, result: 'Victoire' });
    await p.updateMe(await store.get(b.id), { avatar: 7 });
    lb = await p.leaderboard('all', await store.get(a.id));
    assert.equal(reads, 1, 'pas de relecture de la base');
    assert.deepEqual(lb.top.map((r) => [r.name, r.avatar]), [['Badr', 7], ['Amine', 0]]);
    assert.equal(lb.me.rank, 2);

    // Suppression du compte : il disparaît tout de suite du classement
    await p.deleteAccount(b.id);
    lb = await p.leaderboard('all');
    assert.deepEqual(lb.top.map((r) => r.name), ['Amine']);
    assert.equal(reads, 1);

    // Une autre table (jeu) = une lecture de plus ; ensuite en cache
    await p.leaderboard('hezz2');
    await p.leaderboard('hezz2');
    assert.equal(reads, 2);
});
