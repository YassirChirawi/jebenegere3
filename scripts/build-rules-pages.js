/**
 * Pages web statiques des règles, pour Google : /regles, /regles/hezz2, /regles/ronda, /regles/kdoub,
 * /regles/sota-ghamla, plus sitemap.xml et robots.txt.
 * HTML pur (lisible sans JavaScript) ; chaque page finit par un bouton « Jouer » qui ouvre le jeu
 * avec ce jeu déjà choisi (/?jeu=ronda…).
 *
 * Le texte reprend les règles de l'appli (src/components/RulesModal.js) et les moteurs du serveur.
 * Si une règle change dans le jeu, la changer ici aussi, puis :
 *
 *   node scripts/build-rules-pages.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const SITE = 'https://www.jebengere3.fun';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// **gras** dans le texte
const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

const DECK = 'Le jeu de cartes espagnol de 40 cartes : 1 à 7, puis 10 (Sota), 11 (Caballo) et 12 (Rey), en quatre familles : deniers (Oros), coupes (Copas), épées (Espadas) et bâtons (Bastos).';

const GAMES = [
    {
        slug: 'hezz2', play: 'au Hezz2', id: 'hezz2', name: 'Hezz2',
        title: 'Règles du Hezz2 (Hez 2) – Jouer au Hezz2 en ligne gratuitement',
        desc: 'Les règles du Hezz2, le jeu de cartes marocain : le 1 qui fait sauter un tour, le 2 qui fait piocher, le 7 qui change la famille. Joue en ligne avec tes amis ou contre des bots.',
        intro: 'Le Hezz2 (ou « Hez 2 ») est le jeu de cartes le plus joué au Maroc entre amis et en famille. Le but est simple : se débarrasser de toutes ses cartes avant les autres, en se méfiant des 2 qui font piocher.',
        players: '2 à 4 joueurs',
        sections: [
            ['🃏 Le matériel', [DECK]],
            ['🎯 But du jeu', ['Être le premier à poser toutes ses cartes. Le dernier joueur qui a encore des cartes est le **Khasser** (le perdant).']],
            ['🔄 Déroulement', [
                'Chaque joueur reçoit **4 cartes**. Une carte est retournée au milieu (jamais un 1, un 2 ou un 7 au départ), le reste forme la pioche.',
                'À ton tour, tu poses une carte de **la même famille ou de la même valeur** que la carte du milieu.',
                'Si tu ne peux pas (ou ne veux pas) jouer, tu **pioches une carte**.',
                'Sur L\'Carta, tu as **15 secondes** par tour ; sinon une carte est piochée pour toi.',
            ]],
            ['✨ Les cartes spéciales', [
                '**Le 1** : le joueur suivant saute son tour, sauf s\'il pose lui aussi un 1 (en 5 secondes) : l\'attaque rebondit sur le joueur d\'après.',
                '**Le 2** : le joueur suivant pioche 2 cartes, sauf s\'il pose lui aussi un 2 : la pénalité passe au suivant et grossit (+4, +6…).',
                '**Le 7** : il se pose comme une carte normale (même famille ou même valeur), puis tu choisis la nouvelle famille. Après un 7, il faut jouer la famille demandée ou un autre 7.',
            ]],
            ['🏆 Les points', ['Le premier à finir marque autant de points qu\'il y a d\'adversaires, puis 1 de moins par place. Le Khasser ne marque rien. Les points s\'additionnent d\'une manche à l\'autre.']],
        ],
    },
    {
        slug: 'ronda', play: 'à la Ronda', id: 'ronda', name: 'Ronda',
        title: 'Règles de la Ronda marocaine – Darba, Hbel, Missa, Tringa | Jouer en ligne',
        desc: 'Toutes les règles de la Ronda : manger, darba, hbel, boug, missa, annonces ronda et tringa, 9a3a Rey. Joue à la Ronda en ligne, en 1 contre 1 ou en 2 contre 2.',
        intro: 'La Ronda est le grand classique des cafés marocains. On ramasse des cartes sur la table en posant la même valeur, on annonce ses paires (ronda) et ses brelans (tringa), et on vise les 42 points.',
        players: '2 joueurs (1 contre 1) ou 4 joueurs (2 contre 2)',
        sections: [
            ['🃏 Le matériel', [DECK]],
            ['🎯 But du jeu', ['Ramasser un maximum de cartes et de points. Le premier camp à **42 points** gagne : dès qu\'un camp les atteint, même en pleine manche, la partie s\'arrête. En 2 contre 2, les coéquipiers sont face à face et mettent cartes et points en commun.']],
            ['🔄 Distribution', ['Table vide au départ. 3 cartes, puis 3, puis 4 par joueur (en 1 contre 1, ce cycle se fait deux fois). Chacun pose une carte à son tour, 15 secondes maximum.']],
            ['🍽️ Manger', [
                'Une carte de même valeur qu\'une carte de la table la ramasse, avec la suite qui la prolonge (1, 2, 3… 7, 10, 11, 12).',
                'Exemple : ton 3 prend le 3, puis le 4 et le 5 s\'ils sont sur la table. Un 7 prend 7, 10, 11. Sinon, ta carte reste sur la table.',
            ]],
            ['💥 Les coups spéciaux', [
                '**Darba (+1)** : tu prends la carte que l\'adversaire vient juste de poser.',
                '**Hbel (+5)** : tu rejoues la même valeur juste après une darba et tu reprends les 3 cartes.',
                '**Boug (+10)** : le 4e exemplaire joué à la suite (darba, hbel puis boug) : tu reprends les 4 cartes.',
                '**Missa (+1)** : tu vides toute la table d\'un coup (sauf la toute dernière prise de la manche).',
            ]],
            ['📣 Les annonces', [
                '**Ronda (+1)** : une paire en main. Tu peux l\'annoncer tant qu\'aucune de ses cartes n\'est posée.',
                '**Tringa (+5)** : trois cartes de même valeur en main.',
                'Le résultat est donné à la fin de la distribution. Seule l\'annonce la plus forte marque, et elle prend tous les points annoncés : tringa contre ronda = 6, tringa contre tringa = 10. Entre deux rondas, la plus haute gagne (12 en haut, 1 en bas). Égalité de rondas : le camp qui a mangé en premier avec cette valeur laisse le point à l\'autre.',
            ]],
            ['🕵️ « Il est rondé ! »', [
                'Un adversaire a posé une carte de sa ronda sans l\'annoncer ? Dénonce-le, à tout moment de la distribution (une seule fois par distribution). Juste : ton camp prend les points (1 ou 5). Fausse : -1 point. La première fois, c\'est seulement un avertissement, sans points.',
            ]],
            ['👑 La dernière carte du donneur', ['Le donneur doit manger avec sa toute dernière carte. Avec un 12 : +5 pour son camp (**9a3a Rey**). Avec un 1, ou s\'il ne mange rien : +5 pour l\'adversaire (**9a3a AS**).']],
            ['🏁 Fin de manche', ['Les cartes restées sur la table vont au dernier camp qui a mangé. Chaque carte au-delà de 20 vaut 1 point : 26 cartes ramassées = +6 points.']],
        ],
    },
    {
        slug: 'kdoub', play: 'au Kdoub', id: 'kdoub', name: 'Kdoub',
        title: 'Règles du Kdoub (jeu du menteur) – Jouer au Kdoub en ligne',
        desc: 'Les règles du Kdoub, le jeu de cartes du menteur : pose tes cartes face cachée, bluffe et crie KDOUB au bon moment. Joue en ligne de 3 à 6 joueurs.',
        intro: 'Le Kdoub (« mensonge » en darija) est un jeu de bluff : on pose ses cartes face cachée en annonçant une valeur… vraie ou pas. Si on te prend à mentir, tu ramasses tout le tas.',
        players: '3 à 6 joueurs',
        sections: [
            ['🃏 Le matériel', [DECK, 'Les 40 cartes sont distribuées.']],
            ['🎯 But du jeu', ['Être le premier à se débarrasser de toutes ses cartes.']],
            ['📣 L\'annonce', [
                'Le premier joueur **choisit la carte à annoncer** (1, 2… 7, 10, 11 ou 12). Tant que personne ne crie KDOUB, tout le monde continue sur cette même carte.',
                'À ton tour, tu poses **1 à 4 cartes face cachée** en annonçant cette carte. Tu peux mentir sur les cartes, jamais sur le nombre.',
            ]],
            ['🤥 KDOUB !', [
                'Après chaque pose, tout adversaire a **5 secondes** pour crier KDOUB.',
                'Le poseur a menti : il ramasse tout le tas, et le joueur d\'après choisit la nouvelle carte à annoncer.',
                'Il a dit vrai : c\'est l\'accusateur qui ramasse tout le tas, et le poseur choisit lui-même la nouvelle carte et rejoue.',
                'Personne n\'accuse : le tas reste et le suivant continue sur la même carte.',
            ]],
            ['💡 Exemple', ['On joue des 5. Tu n\'en as qu\'un : tu poses ton 5 et un 12 en disant « deux 5 ». Si quelqu\'un crie KDOUB, les cartes sont retournées : tu as menti, tu ramasses tout le tas.']],
            ['🏁 Fin', ['Le premier qui vide sa main gagne, une fois la fenêtre de 5 secondes passée. Les autres sont classés selon le nombre de cartes qui leur restent.']],
        ],
    },
    {
        slug: 'sota-ghamla', play: 'à la Sota Ghamla', id: 'sota', name: 'Sota Ghamla',
        title: 'Règles de la Sota Ghamla – Ne finis pas avec la Sota | Jouer en ligne',
        desc: 'Les règles de la Sota Ghamla : forme des paires, pioche chez ton voisin et ne reste pas avec la dernière Sota. Joue en ligne de 4 à 6 joueurs.',
        intro: 'La Sota Ghamla ressemble au « pouilleux » : on se débarrasse de ses cartes par paires, en piochant chez son voisin. Celui qui reste avec la dernière Sota (le 10) a perdu.',
        players: '4 à 6 joueurs, chacun pour soi',
        sections: [
            ['🃏 Le paquet', ['Le jeu espagnol avec seulement **3 Sota** au lieu de 4 (39 cartes), toutes distribuées. Deux Sota font une paire ; la troisième ne pourra jamais être appariée : c\'est la carte perdante.']],
            ['🎯 But du jeu', ['Se débarrasser de toutes ses cartes en formant des paires, et surtout ne pas finir avec la **Sota**.']],
            ['✨ Les paires', [
                'Deux cartes de même valeur, quelle que soit la famille. Elles sont éliminées automatiquement, face visible, dès la distribution puis après chaque pioche.',
                '3 cartes identiques : on en élimine 2 et on garde la troisième. 4 identiques : 2 paires.',
            ]],
            ['👆 À ton tour', ['Tu prends une carte au hasard, face cachée, dans la main du joueur suivant. Si elle fait une paire avec une de tes cartes, la paire part aussitôt. Tu as 30 secondes, sinon une carte est piochée au hasard pour toi.']],
            ['💡 Exemple', ['Tu as un 4 et un 11. Tu pioches un 4 chez ton voisin : la paire de 4 est éliminée, il te reste le 11. Si tu tombes sur la Sota, garde ton calme… et espère qu\'on te la reprenne !']],
            ['🏁 Fin', ['Main vide = tu es sorti, tu as gagné. Le dernier joueur qui a encore une carte tient la Sota : c\'est le **Ghamla**, le perdant.']],
        ],
    },
];

const STYLE = `
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #0A1527; color: #F3E9DC; font: 17px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
    main { max-width: 760px; margin: 0 auto; padding: 20px 16px 48px; }
    header { display: flex; align-items: center; gap: 12px; }
    header img { width: 44px; height: 44px; border-radius: 12px; }
    header a { color: #F5D77A; font-weight: 800; text-decoration: none; font-size: 18px; }
    nav { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0 4px; }
    nav a { color: #F3E9DC; text-decoration: none; border: 1px solid rgba(212,175,55,0.45); border-radius: 18px; padding: 4px 12px; font-size: 14px; }
    nav a[aria-current] { background: #D4AF37; color: #0A1527; font-weight: 800; }
    h1 { color: #F5D77A; font-size: 28px; line-height: 1.25; margin: 18px 0 6px; }
    .meta { color: #B8A99A; font-size: 15px; margin: 0 0 10px; }
    .intro { font-size: 18px; }
    h2 { color: #D4AF37; font-size: 20px; margin: 28px 0 8px; }
    ul { padding-left: 20px; margin: 0; }
    li { margin: 6px 0; }
    strong { color: #FCD34D; }
    a { color: #F5D77A; }
    .play { display: block; text-align: center; margin: 32px 0 8px; padding: 16px; border-radius: 16px; background: linear-gradient(#FFE795, #EDBE4E 55%, #A8761A); color: #3A1A05; font-weight: 900; font-size: 20px; text-decoration: none; border: 2px solid #FFE9A8; }
    .play small { display: block; font-weight: 700; font-size: 14px; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-top: 18px; }
    .cards a { display: block; padding: 16px; border-radius: 14px; border: 1px solid rgba(212,175,55,0.45); background: rgba(0,0,0,0.25); text-decoration: none; color: #F3E9DC; }
    .cards b { color: #F5D77A; font-size: 19px; display: block; }
    footer { margin-top: 28px; color: #B8A99A; font-size: 14px; display: flex; gap: 16px; flex-wrap: wrap; }`;

function head({ title, desc, url }) {
    return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} | L'Carta</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${SITE}${url}">
  <meta name="theme-color" content="#0A1527">
  <link rel="icon" href="/favicon.ico">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="L'Carta">
  <meta property="og:locale" content="fr_FR">
  <meta property="og:url" content="${SITE}${url}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:image" content="${SITE}/og-image.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <style>${STYLE}
  </style>
</head>`;
}

const nav = (current) => `
    <nav aria-label="Règles des jeux">
      ${GAMES.map((g) => `<a href="/regles/${g.slug}"${g.slug === current ? ' aria-current="page"' : ''}>${esc(g.name)}</a>`).join('\n      ')}
    </nav>`;

const footer = `
    <footer>
      <a href="/regles">Toutes les règles</a>
      <a href="/">Jouer à L'Carta</a>
      <a href="/privacy">Confidentialité</a>
      <a href="/terms">Conditions d'utilisation</a>
    </footer>`;

function gamePage(g) {
    const sections = g.sections.map(([h, items]) => `
    <h2>${esc(h)}</h2>
    <ul>${items.map((i) => `\n      <li>${rich(i)}</li>`).join('')}
    </ul>`).join('');
    return `${head({ title: g.title, desc: g.desc, url: `/regles/${g.slug}` })}
<body>
  <main>
    <header>
      <img src="/icons/icon-192.png" alt="" width="44" height="44">
      <a href="/">L'Carta</a>
    </header>${nav(g.slug)}
    <h1>Règles du jeu : ${esc(g.name)}</h1>
    <p class="meta">${esc(g.players)} · jeu de cartes espagnol · gratuit en ligne</p>
    <p class="intro">${rich(g.intro)}</p>${sections}
    <a class="play" href="/?jeu=${g.id}">▶ Jouer ${esc(g.play)} maintenant<small>Gratuit, sans téléchargement, avec tes amis ou contre des bots</small></a>${footer}
  </main>
</body>
</html>
`;
}

function indexPage() {
    return `${head({
        title: 'Règles des jeux de cartes marocains : Hezz2, Ronda, Kdoub, Sota Ghamla',
        desc: 'Les règles des jeux de cartes marocains avec le jeu espagnol : Hezz2, Ronda, Kdoub et Sota Ghamla. Apprends en 2 minutes, puis joue en ligne gratuitement.',
        url: '/regles',
    })}
<body>
  <main>
    <header>
      <img src="/icons/icon-192.png" alt="" width="44" height="44">
      <a href="/">L'Carta</a>
    </header>
    <h1>Règles des jeux de cartes marocains</h1>
    <p class="intro">Quatre jeux qu'on joue au Maroc avec les cartes espagnoles, au café, en famille ou entre amis. Choisis un jeu pour lire ses règles, puis lance une partie en ligne, gratuitement.</p>
    <div class="cards">
      ${GAMES.map((g) => `<a href="/regles/${g.slug}"><b>${esc(g.name)}</b>${esc(g.players)}</a>`).join('\n      ')}
    </div>
    <a class="play" href="/">▶ Jouer maintenant<small>Gratuit, sans téléchargement</small></a>${footer}
  </main>
</body>
</html>
`;
}

function write(rel, content) {
    const f = path.join(root, 'public', rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, content);
    console.log(`public/${rel}`);
}

write('regles/index.html', indexPage());
for (const g of GAMES) write(`regles/${g.slug}/index.html`, gamePage(g));

const urls = ['/', '/regles', ...GAMES.map((g) => `/regles/${g.slug}`), '/privacy', '/terms'];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE}${u}</loc></url>`).join('\n')}
</urlset>
`);
write('robots.txt', `User-agent: *
Allow: /

Sitemap: ${SITE}/sitemap.xml
`);
