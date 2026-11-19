// Lot 3 : coffres Bronze, Argent, Or ouverts en binga ; probabilités affichées respectées ; doublon = 20 % ;
// garantie (pity) ; tirage côté serveur uniquement
process.env.STORE = 'memory';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createProgress } = require('../progress/progress');
const { memoryStore } = require('../progress/store');
const { CHESTS, COSMETICS } = require('../progress/defs');
const { rollChest, rollRarity, pityLeft, POOL } = require('../progress/chests');
const app = require('../server');

const DAY = Date.UTC(2026, 10, 9, 12);
const ZERO = () => 0; // tirage forcé : toujours la 1re case (Commun, 1er objet)

test('probabilités : 40 000 tirages par coffre, écart de moins de 1 point avec les pourcentages affichés', () => {
    const N = 40000;
    for (const [id, chest] of Object.entries(CHESTS)) {
        const count = { commun: 0, rare: 0, epique: 0, legendaire: 0 };
        for (let i = 0; i < N; i++) count[rollRarity(chest)] += 1;
        const seen = Object.fromEntries(Object.entries(count).map(([k, v]) => [k, (100 * v) / N]));
        for (const r of Object.keys(count)) {
            assert.ok(Math.abs(seen[r] - chest.odds[r]) < 1, `${id} ${r} : ${seen[r].toFixed(2)} % au lieu de ${chest.odds[r]} %`);
        }
        console.log(`  ${chest.label} :`, Object.entries(seen).map(([k, v]) => `${k} ${v.toFixed(1)} %`).join(' · '));
    }
    assert.equal(CHESTS.bronze.odds.legendaire, 0);
});

test('probabilités affichées : chaque coffre totalise 100 %, avec les valeurs décidées', () => {
    assert.deepEqual(CHESTS.bronze.odds, { commun: 70, rare: 25, epique: 5, legendaire: 0 });
    assert.deepEqual(CHESTS.argent.odds, { commun: 40, rare: 40, epique: 18, legendaire: 2 });
    assert.deepEqual(CHESTS.or.odds, { commun: 10, rare: 35, epique: 40, legendaire: 15 });
    assert.deepEqual([CHESTS.bronze.price, CHESTS.argent.price, CHESTS.or.price], [100, 250, 500]);
    Object.values(CHESTS).forEach((c) => assert.equal(Object.values(c.odds).reduce((a, b) => a + b, 0), 100));
    assert.ok(!POOL.some((c) => c.id === 'back:tournoi'), 'Champion jamais dans un coffre');
});

test('garantie : 11e coffre Argent sans Épique = Épique ; 21e coffre Or sans Légendaire = Légendaire', () => {
    assert.equal(rollChest('argent', 9, [], ZERO).rarity, 'commun');
    const a = rollChest('argent', 10, [], ZERO);
    assert.equal(a.rarity, 'epique');
    assert.equal(a.pity, true);
    assert.equal(a.nextPity, 0);
    assert.equal(rollChest('or', 19, [], ZERO).rarity, 'commun');
    const o = rollChest('or', 20, [], ZERO);
    assert.equal(o.rarity, 'legendaire');
    assert.equal(o.nextPity, 0);
    assert.equal(pityLeft('argent', 0), 11);
    assert.equal(pityLeft('argent', 8), 3, '« Plus que 3 coffres »');
    assert.equal(pityLeft('argent', 10), 1);
    assert.equal(pityLeft('bronze', 5), null);
});

test('on reçoit d\'abord un objet qu\'on n\'a pas ; doublon seulement quand toute la rareté est possédée', () => {
    const communs = POOL.filter((c) => c.rarity === 'commun').map((c) => c.id);
    const r1 = rollChest('bronze', 0, [communs[0]], ZERO);
    assert.notEqual(r1.item.id, communs[0]);
    assert.equal(r1.duplicate, false);
    const r2 = rollChest('bronze', 0, communs, ZERO);
    assert.equal(r2.duplicate, true);
    assert.equal(r2.refund, 20, '20 % de 100');
});

async function player(balance, unlocks = []) {
    const p = createProgress(memoryStore());
    const { profile } = await p.register({ name: 'Chanceux', password: 'secret1' });
    const u = await p.store.get(profile.id);
    u.binga = { balance, log: [] };
    u.unlocks = unlocks;
    await p.store.save(u);
    return { p, user: u };
}

test('ouvrir un coffre Bronze, Argent, Or : prix retiré, objet ajouté au compte, historique', async () => {
    const { p, user } = await player(850);
    for (const [chest, price] of [['bronze', 100], ['argent', 250], ['or', 500]]) {
        const before = (await p.store.get(user.id)).binga.balance;
        const r = await p.openChest(user, chest, DAY);
        assert.ok(r.success, chest);
        assert.equal(r.profile.binga.balance, before - price);
        assert.ok(r.profile.unlocks.includes(r.result.item.id));
        assert.equal(r.profile.chests.history[0].chest, chest);
        assert.equal(r.profile.chests.history[0].item.id, r.result.item.id);
    }
    const prof = await p.profile(await p.store.get(user.id), DAY);
    assert.equal(prof.binga.balance, 0);
    assert.equal(prof.chests.history.length, 3);
});

test('solde insuffisant ou coffre inconnu : refusé, rien retiré', async () => {
    const { p, user } = await player(90);
    assert.match((await p.openChest(user, 'bronze', DAY)).error, /manque 10 binga/);
    assert.ok((await p.openChest(user, 'diamant', DAY)).error);
    assert.equal((await p.store.get(user.id)).binga.balance, 90);
});

test('doublon : 20 % de la valeur rendus en binga (Commun 20, Légendaire 200), jamais zéro', async () => {
    const communs = POOL.filter((c) => c.rarity === 'commun').map((c) => c.id);
    const { p, user } = await player(100, communs);
    const r = await p.openChest(user, 'bronze', DAY, ZERO);
    assert.equal(r.result.duplicate, true);
    assert.equal(r.result.refund, 20);
    assert.equal(r.profile.binga.balance, 20);
    assert.equal(r.profile.binga.log[0].amount, 20);
    // Légendaire en double (garantie du coffre Or, tout possédé)
    const all = COSMETICS.map((c) => c.id);
    const { p: p2, user: u2 } = await player(500, all);
    const v = await p2.store.get(u2.id);
    v.chests = { pity: { or: 20 }, history: [] };
    await p2.store.save(v);
    const r2 = await p2.openChest(u2, 'or', DAY, ZERO);
    assert.equal(r2.result.item.rarity, 'legendaire');
    assert.equal(r2.result.refund, 200);
    assert.equal(r2.profile.binga.balance, 200);
});

test('compteur de garantie dans le profil : « Plus que N coffres », remis à zéro après l\'Épique', async () => {
    const { p, user } = await player(3000);
    for (let i = 0; i < 8; i++) await p.openChest(user, 'argent', DAY, ZERO); // 8 Communs d'affilée
    let prof = await p.profile(await p.store.get(user.id), DAY);
    assert.equal(prof.chests.pityLeft.argent, 3);
    await p.openChest(user, 'argent', DAY, ZERO);
    await p.openChest(user, 'argent', DAY, ZERO);
    const r = await p.openChest(user, 'argent', DAY, ZERO); // 11e
    assert.equal(r.result.item.rarity, 'epique');
    assert.equal(r.result.pity, true);
    assert.equal(r.profile.chests.pityLeft.argent, 11);
});

// ------------------------------------------------------------------ de bout en bout
let URL;
test.before(async () => { URL = `http://localhost:${await app.start(0)}`; });
test.after(async () => { await app.stop(); });
const post = async (path, body, token) => {
    const r = await fetch(URL + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body || {}) });
    return { status: r.status, body: await r.json() };
};

test('en ligne : ouverture d\'un coffre ; l\'appli ne peut pas choisir son lot', async () => {
    const reg = await post('/api/register', { name: 'Ouvreur', password: 'secret12' });
    const u = await app.progress.store.getByName('Ouvreur');
    u.binga = { balance: 100, log: [] };
    await app.progress.store.save(u);
    const r = await post('/api/chests/open', { chest: 'bronze', item: 'back:or', rarity: 'legendaire' }, reg.body.token);
    assert.equal(r.status, 200);
    assert.notEqual(r.body.result.item.rarity, 'legendaire', 'Bronze : jamais de Légendaire, quoi que demande l\'appli');
    assert.equal(r.body.profile.binga.balance, 0);
    assert.equal((await post('/api/chests/open', { chest: 'bronze' }, reg.body.token)).status, 400);
    assert.equal((await post('/api/chests/open', { chest: 'bronze' }, 'faux.jeton')).status, 401);
});
