/**
 * Lance les tests dans le navigateur, l'un après l'autre (chacun dans son processus).
 *
 *   npm run e2e            construit le site (e2e/.web) puis lance tous les tests
 *   npm run e2e -- --no-build   relance sans reconstruire
 *   npm run e2e -- home    seulement les tests dont le nom contient « home »
 */
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const filter = args.find((a) => !a.startsWith('--'));
const ROOT = path.join(__dirname, '..');

if (!args.includes('--no-build')) {
    console.log('Construction du site (e2e/.web)…');
    execSync('npx expo export --platform web --clear --output-dir e2e/.web', {
        cwd: ROOT, stdio: 'ignore', env: { ...process.env, EXPO_PUBLIC_SOCKET_URL: 'http://localhost:3000' },
    });
}

const tests = fs.readdirSync(__dirname).filter((f) => f.endsWith('.e2e.js') && (!filter || f.includes(filter))).sort();
let failed = 0;
for (const t of tests) {
    const r = spawnSync(process.execPath, [path.join(__dirname, t)], { cwd: ROOT, encoding: 'utf8', timeout: 240000 });
    const lines = `${r.stdout || ''}${r.stderr || ''}`.split('\n').filter((l) => /^(OK|ÉCHEC|ERREUR)|rror/.test(l));
    lines.forEach((l) => console.log(l));
    if (r.status !== 0) { failed += 1; console.log(`✗ ${t} (code ${r.status})`); } else console.log(`✓ ${t}`);
}
console.log(failed ? `${failed} test(s) en échec sur ${tests.length}` : `Tous les tests passent (${tests.length})`);
process.exit(failed ? 1 : 0);
