/**
 * Signalements du chat (V1, sans interface d'administration).
 *
 *   node scripts/reports.js              liste les signalements (les plus anciens d'abord)
 *   node scripts/reports.js --json       même liste en JSON
 *   node scripts/reports.js --delete ID  supprime un signalement traité
 *
 * Utilise le même stockage que le serveur : DATABASE_URL (PostgreSQL, Render) sinon server/data/.
 * Sur Render : onglet Shell du service, puis `node scripts/reports.js`.
 * Les signalements de plus de 6 mois sont supprimés automatiquement.
 */
const { createStore } = require('../progress/store');

(async () => {
    const store = createStore();
    const args = process.argv.slice(2);
    try {
        if (args[0] === '--delete' && args[1]) {
            console.log((await store.deleteReport(args[1])) ? `Supprimé : ${args[1]}` : `Introuvable : ${args[1]}`);
        } else {
            const list = await store.listReports();
            if (args[0] === '--json') console.log(JSON.stringify(list, null, 2));
            else if (!list.length) console.log('Aucun signalement.');
            else {
                list.forEach((r) => {
                    console.log(`${new Date(r.at).toISOString()}  [${r.reason}]  ${r.id}`);
                    console.log(`   auteur : ${r.authorName}${r.authorUserId ? ` (compte ${r.authorUserId})` : ' (sans compte)'}  · salon ${r.roomId}`);
                    console.log(`   message : « ${r.message} »`);
                    console.log(`   signalé par : ${r.reporterName || '?'}`);
                });
                console.log(`\n${list.length} signalement(s).`);
            }
        }
    } finally {
        store.flushNow && store.flushNow();
        store.close && (await store.close());
    }
})().catch((e) => { console.error(e); process.exit(1); });
