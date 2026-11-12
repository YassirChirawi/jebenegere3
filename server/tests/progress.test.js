// Phase 2 : comptes, XP, stats, défis, titres, saisons (sans réseau)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createProgress } = require('../progress/progress');
const { memoryStore, fileStore } = require('../progress/store');
const defs = require('../progress/defs');
const { gameResults, tallyEvents } = require('../progress/results');

const DAY = Date.UTC(2026, 10, 9, 12); // pendant la saison 1

test('inscription : pseudo, mot de passe haché, pseudo unique (sans tenir compte des majuscules)', async () => {
    const p = createProgress(memoryStore());
    const r = await p.register({ name: 'Yassir', password: 'secret1' });
    assert.ok(r.token && r.profile.name === 'Yassir');
    const u = await p.store.getByName('yassir');
    assert.notEqual(u.hash, 'secret1');
    assert.ok(!JSON.stringify(r.profile).includes(u.hash), 'le profil ne contient jamais le hash');
    assert.match((await p.register({ name: 'YASSIR', password: 'autre12' })).error, /pris/);
    assert.ok((await p.register({ name: 'ab', password: 'secret1' })).error);
    assert.ok((await p.register({ name: 'Bot Hassan', password: 'secret1' })).error);
    assert.ok((await p.register({ name: 'Karim', password: '123' })).error);
});

test('connexion : bon / mauvais mot de passe, jeton, déconnexion', async () => {
    const p = createProgress(memoryStore());
    await p.register({ name: 'Salma', password: 'motdepasse' });
    assert.ok((await p.login({ name: 'salma', password: 'faux' })).error);
    const { token } = await p.login({ name: 'Salma', password: 'motdepasse' });
    assert.equal((await p.userFromToken(token)).name, 'Salma');
    assert.equal(await p.userFromToken(`${token}x`), null);
    await p.logout(token);
    assert.equal(await p.userFromToken(token), null);
});

test('connexion : trop d\'essais ratés = blocage temporaire', async () => {
    const p = createProgress(memoryStore());
    await p.register({ name: 'Hamid', password: 'motdepasse' });
    for (let i = 0; i < 8; i++) await p.login({ name: 'Hamid', password: 'x', ip: '1.2.3.4' });
    assert.match((await p.login({ name: 'Hamid', password: 'motdepasse', ip: '1.2.3.4' })).error, /essais/);
    assert.ok((await p.login({ name: 'Hamid', password: 'motdepasse', ip: '5.6.7.8' })).token);
});

test('reprise de la progression locale, plafonnée à 3000 XP', async () => {
    const p = createProgress(memoryStore());
    assert.equal((await p.register({ name: 'Ancien', password: 'secret1', importXp: 750 })).profile.xp, 750);
    assert.equal((await p.register({ name: 'Tricheur', password: 'secret1', importXp: 999999 })).profile.xp, 3000);
});

test('XP, stats, série, historique après des parties', async () => {
    const p = createProgress(memoryStore());
    const { profile } = await p.register({ name: 'Joueur', password: 'secret1' });
    await p.award(profile.id, { game: 'hezz2', xp: 100, record: true, won: true, result: 'Victoire 🎉', counters: { hezz2_first: 1 } }, DAY);
    await p.award(profile.id, { game: 'hezz2', xp: 50, record: true, won: true, result: '2e place', counters: {} }, DAY);
    const r = await p.award(profile.id, { game: 'hezz2', xp: 10, record: true, won: false, result: 'Khasser 💀', counters: {}, hezz2Khasser: true }, DAY);
    const st = r.profile.stats.hezz2;
    assert.deepEqual([st.played, st.wins, st.losses, st.best, st.streak], [3, 2, 1, 2, 0]);
    assert.equal(r.profile.history.length, 3);
    assert.equal(r.profile.history[0].result, 'Khasser 💀');
    assert.ok(r.profile.xp >= 160);
    assert.equal(r.profile.rank.name, defs.rankFor(r.profile.xp).name);
});

test('défis du jour : 3 défis stables par jour, progression, XP et récompense une seule fois', async () => {
    const list = defs.dailyChallenges('2026-11-09');
    assert.equal(list.length, 3);
    assert.deepEqual(list.map((c) => c.id), defs.dailyChallenges('2026-11-09').map((c) => c.id));
    assert.equal(new Set(list.map((c) => c.id)).size, 3);

    const p = createProgress(memoryStore());
    const { profile } = await p.register({ name: 'Defi', password: 'secret1' });
    const c = list[0];
    let last;
    for (let k = 0; k < c.target + 2; k++) {
        last = await p.award(profile.id, { game: 'ronda', xp: 0, record: false, counters: { [c.metric]: 1 } }, DAY);
        if (last.completed.length) break;
    }
    assert.equal(last.completed.length, 1);
    assert.equal(last.completed[0].id, c.id);
    assert.equal(last.xpGained, c.xp);
    assert.ok(last.completed[0].reward, 'une récompense est débloquée');
    assert.ok(last.profile.unlocks.includes(last.completed[0].reward.id));
    const again = await p.award(profile.id, { game: 'ronda', xp: 0, record: false, counters: { [c.metric]: 5 } }, DAY);
    assert.equal(again.completed.length, 0, 'pas deux fois le même défi');
    assert.ok(again.profile.daily.list.find((x) => x.id === c.id).done);
});

test('titres : débloqués par les compteurs, choisissables seulement s\'ils sont gagnés', async () => {
    const p = createProgress(memoryStore());
    const { profile } = await p.register({ name: 'Titre', password: 'secret1' });
    const r = await p.award(profile.id, { game: 'ronda', xp: 0, record: false, counters: { missa: 25 } }, DAY);
    assert.ok(r.titles.some((t) => t.id === 'moul_missa'));
    const user = await p.store.get(profile.id);
    assert.equal((await p.updateMe(user, { title: 'roi_ronda' })).title, null, 'titre non gagné refusé');
    assert.equal((await p.updateMe(user, { title: 'moul_missa' })).title, 'moul_missa');
    assert.equal(p.publicInfo(await p.store.get(profile.id)).title, 'Moul Missa');
});

test('Jamais Khasser : série de parties Hezz2 sans être Khasser', async () => {
    const p = createProgress(memoryStore());
    const { profile } = await p.register({ name: 'Serie', password: 'secret1' });
    let r;
    for (let i = 0; i < 10; i++) r = await p.award(profile.id, { game: 'hezz2', xp: 20, record: true, won: true, result: 'x', counters: {} }, DAY);
    assert.ok(r.titles.some((t) => t.id === 'jamais_khasser'));
});

test('saison : classement par jeu et général, position du joueur, pseudo seulement', async () => {
    const p = createProgress(memoryStore());
    const ids = [];
    for (const [name, xp] of [['Amine', 300], ['Badr', 900], ['Chama', 100]]) {
        const { profile } = await p.register({ name, password: 'secret1' });
        ids.push(profile.id);
        await p.award(profile.id, { game: 'kdoub', xp, record: true, won: true, result: 'x', counters: {} }, DAY);
    }
    const lb = await p.leaderboard('all', await p.store.get(ids[0]), DAY);
    assert.deepEqual(lb.top.map((r) => r.name), ['Badr', 'Amine', 'Chama']);
    assert.equal(lb.me.rank, 2);
    assert.deepEqual(Object.keys(lb.top[0]).sort(), ['avatar', 'name', 'rank', 'title', 'xp']);
    assert.equal((await p.leaderboard('ronda', null, DAY)).top.length, 0);
});

test('fin de saison : top 10 = dos exclusif + badge, une seule fois', async () => {
    const p = createProgress(memoryStore());
    const { profile } = await p.register({ name: 'Champion', password: 'secret1' });
    await p.award(profile.id, { game: 'sota', xp: 800, record: true, won: true, result: 'x', counters: {} }, DAY);
    const next = defs.seasonOf(DAY).end + 1000;
    const pr = await p.profile(await p.store.get(profile.id), next);
    assert.ok(pr.unlocks.includes('back:saison'));
    assert.equal(pr.badges.length, 1);
    assert.equal(pr.season.id, 2);
    const again = await p.profile(await p.store.get(profile.id), next);
    assert.equal(again.badges.length, 1);
});

test('stockage fichier : les données survivent à un redémarrage', async () => {
    const file = path.join(os.tmpdir(), `jg3-${Date.now()}.json`);
    const s1 = fileStore(file);
    const p1 = createProgress(s1);
    const { token, profile } = await p1.register({ name: 'Durable', password: 'secret1' });
    await p1.award(profile.id, { game: 'ronda', xp: 130, record: true, won: true, result: 'Victoire', counters: {} }, DAY);
    s1.flushNow();
    const p2 = createProgress(fileStore(file));
    const u = await p2.userFromToken(token);
    assert.equal(u.name, 'Durable');
    assert.equal(u.xp, 130);
    fs.unlinkSync(file);
});

test('résultats de partie : XP identiques aux règles de l\'appli, compteurs de coups spéciaux', () => {
    const players = (n) => Array.from({ length: n }, (_, i) => ({ id: `s${i}`, name: `P${i}`, userId: `u${i}` }));
    // Hezz2 à 3 : 2 sort 1er, 0 2e, 1 Khasser
    let r = gameResults({ gameType: 'hezz2', activePlayers: players(3) }, { loserIndex: 1, finishedPlayers: [2, 0, 1] });
    assert.deepEqual(r.map((x) => x.entry.xp), [50, 10, 100]);
    // Kdoub
    const room = { gameType: 'kdoub', activePlayers: players(3) };
    tallyEvents(room, [{ type: 'kdoub', by: 1, truthful: false }, { type: 'kdoub', by: 1, truthful: true }]);
    r = gameResults(room, { winner: 2, ranking: [{ player: 2 }, { player: 0 }, { player: 1 }] });
    assert.deepEqual(r.map((x) => x.entry.xp), [50, 20, 100]);
    assert.deepEqual(r[1].entry.counters, { kdoub_call: 2, kdoub_catch: 1 });
    // Sota
    r = gameResults({ gameType: 'sota', activePlayers: players(4) }, { loser: 3, outOrder: [1, 0, 2] });
    assert.deepEqual(r.map((x) => x.entry.xp), [50, 100, 50, 10]);
    assert.equal(r[3].entry.won, false);
    // Ronda : manche gagnée + partie gagnée
    const rr = { gameType: 'ronda', activePlayers: players(2) };
    tallyEvents(rr, [{ type: 'missa', player: 0 }, { type: 'darba', player: 1 }]);
    r = gameResults(rr, { summary: { cardPoints: [8, 2], bonus: [1, 1] }, winnerTeam: 0, scores: [42, 30] });
    assert.deepEqual(r.map((x) => x.entry.xp), [130, 10]);
    assert.deepEqual(r[0].entry.counters, { missa: 1 });
    assert.equal(r[0].entry.record, true);
    // Joueur absent (plus de 3 tours automatiques) : pas d'XP
    r = gameResults({ gameType: 'hezz2', activePlayers: players(2), afkCount: { 0: 5 } }, { loserIndex: 1, finishedPlayers: [0] });
    assert.equal(r[0].entry.xp, 0);
    // Bots et invités sans compte : ignorés
    r = gameResults({ gameType: 'hezz2', activePlayers: [{ id: 'a', name: 'Invité' }, { id: 'b', name: 'Bot', isBot: true }] }, { loserIndex: 1, finishedPlayers: [0] });
    assert.equal(r.length, 0);
});

test('rangs : les 5 rangs existants sont conservés, 3 nouveaux au-delà de L\'Boss', () => {
    assert.equal(defs.rankFor(0).name, 'bida2i (Débutant)');
    assert.equal(defs.rankFor(201).name, 'Hara o kan');
    assert.equal(defs.rankFor(2501).name, "L'Boss");
    assert.equal(defs.rankFor(5001).name, 'M3allem');
    assert.equal(defs.rankFor(20000).name, "L'Ostora");
});
