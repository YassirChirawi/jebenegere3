/**
 * Outils communs des tests dans le navigateur (e2e).
 *
 * Chaque test démarre, dans le même processus :
 * - le serveur de jeu (stockage en mémoire, port 3000) ;
 * - un petit serveur web qui sert le site construit (dossier e2e/.web, port 8099),
 *   avec un relais « /server » vers le serveur de jeu (comme l'URL mapping de Discord) ;
 * - Chrome sans fenêtre (CHROME_PATH pour un autre chemin).
 */
process.env.STORE = 'memory';
process.env.START_COUNTDOWN_MS = '0';

const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const WEB = path.join(__dirname, '.web');
const OUT = path.join(__dirname, '.shots');
const CHROME = process.env.CHROME_PATH || (process.platform === 'win32'
    ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/usr/bin/google-chrome');
const DISCORD_HOST = '1572975413687226451.discordsays.com';
const TYPES = { '.js': 'application/javascript', '.html': 'text/html', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function createChecker(name) {
    let ok = true;
    return {
        check(label, v) { console.log(`${v ? 'OK   ' : 'ÉCHEC'} [${name}] ${label}`); if (!v) ok = false; },
        get ok() { return ok; },
    };
}

/** Démarre serveur de jeu + site + Chrome. */
async function setup() {
    if (!fs.existsSync(path.join(WEB, 'index.html'))) throw new Error('Site pas construit : lancer « npm run e2e » (il construit e2e/.web).');
    fs.mkdirSync(OUT, { recursive: true });
    const app = require(path.join(ROOT, 'server', 'server'));
    await app.start(3000);
    const stats = { proxied: 0 };
    const web = http.createServer((req, res) => {
        if (req.url.startsWith('/server')) {
            stats.proxied += 1;
            const p = http.request({ host: '127.0.0.1', port: 3000, path: req.url, method: req.method, headers: req.headers }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
            req.pipe(p);
            return;
        }
        let f = path.join(WEB, decodeURIComponent(req.url.split('?')[0]));
        // Dossier avec sa propre page (/privacy, /regles/ronda…) : comme les réécritures de vercel.json
        if (fs.existsSync(f) && fs.statSync(f).isDirectory() && fs.existsSync(path.join(f, 'index.html'))) f = path.join(f, 'index.html');
        if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(WEB, 'index.html');
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
        fs.createReadStream(f).pipe(res);
    });
    web.on('upgrade', (req, sock, head) => {
        stats.proxied += 1;
        const up = net.connect(3000, '127.0.0.1', () => {
            up.write(`${req.method} ${req.url} HTTP/1.1\r\n${Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n')}\r\n\r\n`);
            up.write(head);
            sock.pipe(up).pipe(sock);
        });
        up.on('error', () => sock.destroy());
    });
    await new Promise((r) => web.listen(8099, r));
    const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: [`--host-resolver-rules=MAP ${DISCORD_HOST} 127.0.0.1`] });
    return {
        app, browser, stats, sleep, OUT,
        url: 'http://localhost:8099',
        discordUrl: `http://${DISCORD_HOST}:8099`,
        /** Contexte de navigateur ; opts.account : jeton à mettre dans le stockage ; opts.fresh : premier lancement ;
         *  opts.userAgent : se faire passer pour un autre appareil (iPhone…). */
        async context({ width = 390, height = 844, token = null, fresh = false, userAgent } = {}) {
            const ctx = await browser.newContext({ viewport: { width, height }, locale: 'fr-FR', ...(userAgent ? { userAgent } : {}) });
            if (!fresh) {
                await ctx.addInitScript((t) => {
                    const d = new Date(); const day = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
                    localStorage.setItem('onboarded', '1'); localStorage.setItem('rulesSeen', '1');
                    localStorage.setItem('dailyPopups', JSON.stringify({ day, seen: ['wheel', 'login', 'shop', 'account', 'login_reward'] }));
                    if (t) { localStorage.setItem('authToken', t); }
                }, token);
            }
            return ctx;
        },
        async page(ctx) {
            const p = await ctx.newPage();
            p.on('pageerror', (e) => console.log('ERREUR JS', e.message));
            return p;
        },
        text: (p) => p.evaluate(() => document.body.innerText),
        async waitText(p, re, ms = 8000) {
            const t0 = Date.now();
            while (Date.now() - t0 < ms) { if (re.test(await p.evaluate(() => document.body.innerText))) return true; await sleep(150); }
            return false;
        },
        async close() { await browser.close(); web.close(); await app.stop(); },
    };
}

module.exports = { setup, createChecker, sleep, DISCORD_HOST };
