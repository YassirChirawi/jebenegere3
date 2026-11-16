/**
 * Génère les pages web statiques /privacy et /terms à partir de src/legal/legal.json
 * (même texte que l'écran « Confidentialité / Conditions » de l'appli).
 * Pages en HTML pur : lisibles sans compte, sans JavaScript et sans le serveur de jeu.
 *
 *   node scripts/build-legal.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const legal = JSON.parse(fs.readFileSync(path.join(root, 'src', 'legal', 'legal.json'), 'utf8'));

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const linkify = (s) => esc(s).replace(/https:\/\/[^\s)]+/g, (u) => `<a href="${u}">${u}</a>`);

function page(doc, other) {
    const contact = legal.contactEmail
        ? `Contact : <a href="mailto:${esc(legal.contactEmail)}">${esc(legal.contactEmail)}</a>`
        : esc(legal.contactMissing);
    const sections = doc.sections.map((s) => `
    <h2>${esc(s.h)}</h2>
    <ul>${s.items.map((i) => `\n      <li>${linkify(i)}</li>`).join('')}
    </ul>`).join('');
    return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(doc.title)} · Jeben Gere3</title>
  <meta name="description" content="${esc(doc.title)} du jeu Jeben Gere3.">
  <meta name="theme-color" content="#1C0F13">
  <link rel="icon" href="/favicon.ico">
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #1C0F13; color: #F3E9DC; font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
    main { max-width: 720px; margin: 0 auto; padding: 24px 16px 48px; }
    header { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
    header img { width: 48px; height: 48px; border-radius: 12px; }
    header a { color: #F5D77A; font-weight: 800; text-decoration: none; font-size: 18px; }
    h1 { color: #F5D77A; font-size: 26px; line-height: 1.25; margin: 16px 0 4px; }
    .updated { color: #B8A99A; font-size: 14px; margin: 0 0 16px; }
    h2 { color: #D4AF37; font-size: 19px; margin: 28px 0 8px; }
    ul { padding-left: 20px; margin: 0; }
    li { margin: 6px 0; }
    a { color: #F5D77A; overflow-wrap: anywhere; }
    .contact { margin-top: 32px; padding: 14px 16px; border: 1px solid rgba(212,175,55,0.4); border-radius: 12px; background: rgba(0,0,0,0.25); }
    footer { margin-top: 28px; color: #B8A99A; font-size: 14px; display: flex; gap: 16px; flex-wrap: wrap; }
  </style>
</head>
<body>
  <main>
    <header>
      <img src="/icons/icon-192.png" alt="" width="48" height="48">
      <a href="/">Jeben Gere3</a>
    </header>
    <h1>${esc(doc.title)}</h1>
    <p class="updated">Mise à jour : ${esc(doc.updated)}</p>
    <p>${linkify(doc.intro)}</p>${sections}
    <p class="contact">${contact}</p>
    <footer>
      <a href="${other.path}">${esc(other.title)}</a>
      <a href="/">Retour au jeu</a>
    </footer>
  </main>
</body>
</html>
`;
}

for (const [key, other] of [['privacy', 'terms'], ['terms', 'privacy']]) {
    const doc = legal[key];
    const dir = path.join(root, 'public', key);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), page(doc, legal[other]));
    console.log(`public/${key}/index.html`);
}
