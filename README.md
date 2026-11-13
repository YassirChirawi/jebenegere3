# Jeben Gere3

Jeux de cartes marocains avec le jeu espagnol de 40 cartes, à plusieurs en ligne, contre des bots ou entre amis dans un salon privé.

Le projet contient l'application Expo / React Native (Android, iOS et web) et un serveur Node + Socket.io. Le serveur décide seul des coups, des captures et des scores.

| Jeu | Joueurs | État |
|---|---|---|
| **Hezz2** | 2 à 4 | ✅ jouable |
| **Ronda** | 1 contre 1, 2 contre 2 | ✅ jouable (phase 1) |
| **Kdoub** | 3 à 6 | ✅ jouable (phase 2) |
| **Sota Ghamla** | 4 à 6 | ✅ jouable (phase 3) |

Les quatre jeux partagent le même compte local, la même XP et les mêmes rangs. Chaque jeu se joue de trois façons :

- **en ligne** (matchmaking, la table est complétée par des bots après 10 s d'attente) ;
- **contre l'ordinateur** ;
- **en salon privé**, avec un code à partager.

Le chat, les réactions emoji, les sons et les vibrations sont disponibles partout.

## Règles en bref

### Hezz2
Le but est de vider sa main en premier. On pose une carte de même famille ou de même valeur.
- **1** : le suivant saute son tour, sauf s'il contre avec un 1 dans les 3 secondes.
- **2** : le suivant pioche 2 cartes, sauf s'il surenchérit avec un autre 2 (+4, +6…).
- **7** : se pose comme une carte normale (même famille ou même valeur), puis on choisit la nouvelle famille.

Le dernier joueur qui a encore des cartes est le *Khasser*.

### Ronda
La partie se joue en 1 contre 1 ou en 2 contre 2 (coéquipiers face à face). La table est vide au départ. Chaque joueur reçoit 3, puis 3, puis 4 cartes ; en 1 contre 1, ce cycle se fait deux fois. Le premier camp à **42 points** gagne : dès qu'un camp les atteint, même en pleine manche, la partie s'arrête.

- **Manger** : une carte ramasse la carte de même valeur sur la table, plus la suite ascendante (1…7, 10, 11, 12).
- **Coups spéciaux** :
  - **Darba +1** : prendre la carte que l'adversaire vient de poser.
  - **Hbel +5** : 3ᵉ exemplaire joué à la suite, on reprend 3 cartes.
  - **Boug +10** : 4ᵉ exemplaire, on reprend 4 cartes.
  - **Missa +1** : vider la table, sauf à la toute dernière prise.
- **Annonces**, tant qu'aucune carte de la combinaison n'est posée : **Ronda +1** (une paire), **Tringa +5** (un brelan).
  - Le résultat est donné à la fin de la distribution. Seule l'annonce la plus forte marque, et elle prend tous les points annoncés : 6 pour une tringa contre une ronda, 10 pour une tringa contre une tringa.
  - Égalité de rondas : le camp qui a mangé en premier avec cette valeur laisse le point à l'autre.
- **« Il est rondé ! »** : toucher l'adversaire, à tout moment de la distribution. C'est juste s'il a posé une carte de sa ronda sans l'annoncer.
- **Darba et Hbel** : les cartes restent 2,5 s au centre, en zoom, pour voir s'il y aura Hbel (ou Boug). La première fois, c'est un avertissement ; ensuite, une dénonciation juste rapporte les points et une fausse coûte -1.
- **Dernière carte du donneur** :
  - il mange avec un 12 : **+5** pour son camp (*9a3a Rey*) ;
  - il mange avec un 1, ou ne mange rien : **+5** pour l'adversaire (*9a3a AS*).
- **Fin de manche** : le reste de la table va au dernier camp qui a mangé. Chaque carte au-delà de 20 vaut 1 point (la **Makla**).
- **Détail des points** : l'écran de fin de manche montre chaque catégorie sur sa ligne, pour chaque camp : Makla (avec le nombre de cartes), Darba, Ronda / Tringa, 9a3a Rey, 9a3a AS, puis Hbel, Boug, Missa et dénonciations quand il y en a.

### Kdoub
Jeu de bluff pour 3 à 6 joueurs. Les 40 cartes sont distribuées.

- Le premier joueur **choisit la carte à annoncer** (1, 2… 7, 10, 11 ou 12). Tant que personne ne crie KDOUB, tout le monde continue sur cette même carte.
- À ton tour, tu poses **1 à 4 cartes face cachée** en annonçant cette carte. Tu peux mentir sur les cartes, jamais sur leur nombre.
- Pendant **5 secondes**, chaque adversaire peut crier **KDOUB** :
  - le poseur a menti : il ramasse le tas, et **le joueur d'après choisit la nouvelle carte** ;
  - il a dit vrai : l'accusateur ramasse le tas, et **le poseur choisit lui-même la nouvelle carte et rejoue**.
- À la fin du chrono, une carte est posée au hasard ; s'il fallait choisir l'annonce, c'est la valeur de cette carte.
- Le premier qui vide sa main gagne. Les autres sont classés selon le nombre de cartes restantes.

### Sota Ghamla
Jeu de paires pour 4 à 6 joueurs, variante marocaine du Pouilleux. Le paquet compte **3 Sota** (le 10), soit 39 cartes, toutes distribuées.

- Les paires (deux cartes de même valeur) sont éliminées automatiquement, dès la distribution puis après chaque pioche.
- À son tour, on pioche une carte au hasard, face cachée, dans la main du joueur suivant. Le timer est de 30 s.
- Main vide = sorti, donc gagné. Le dernier qui a encore une carte tient la Sota : c'est le **Ghamla**, le perdant.

## Lancer le projet

Il faut Node 18 ou plus récent.

```bash
# Application (dossier racine)
npm install
npx expo start -c          # puis scanner le QR code avec Expo Go, ou appuyer sur "w" pour le web

# Serveur (dossier server/)
cd server
npm install
npm start                  # écoute sur le port $PORT, 3000 par défaut
```

Par défaut, l'application se connecte au serveur de production (`https://jebenegere3.onrender.com`). Pour utiliser un serveur local :

```bash
EXPO_PUBLIC_SOCKET_URL=http://192.168.1.10:3000 npx expo start -c
```

Après un changement de `EXPO_PUBLIC_SOCKET_URL`, il faut relancer avec `-c` pour vider le cache de Metro.

## Déploiement du serveur (Render)

L'application vérifie la version du serveur à chaque connexion : le serveur envoie `server_info`, que l'on peut aussi consulter sur `GET /version`.
- Si le serveur est trop ancien, l'accueil affiche **« Le serveur en ligne n'est pas à jour »** et désactive le jeu en ligne, au lieu de chercher dans le vide.
- Après chaque changement dans `server/`, il faut **redéployer le service Render**, depuis la branche `main` et avec le dossier racine `server`. Pour vérifier le déploiement, `https://jebenegere3.onrender.com/version` doit répondre avec un JSON qui contient `"version"`.
- Variable d'environnement facultative : `MATCHMAKING_WAIT_MS`, le délai avant de compléter la table avec des bots (10 000 ms par défaut).
- **Comptes joueurs (phase 2)** : il faut définir la variable `DATABASE_URL`, qui pointe vers une base PostgreSQL, par exemple une base gratuite Neon, Supabase ou Render Postgres. La table `players` est créée toute seule au démarrage.
  - Sans `DATABASE_URL`, les comptes sont enregistrés dans `server/data/players.json`. **Sur Render, ce fichier est effacé à chaque redéploiement ou redémarrage** : cette solution ne convient donc qu'en local.
  - Au démarrage, le journal de Render indique le stockage utilisé : `[progress] stockage : postgres`.
- **Sécurité** ([server/security.js](server/security.js)) :
  - seuls le site (`jebengere3.fun`), les déploiements Vercel, `localhost` et l'appli installée (sans origine) peuvent se connecter. Pour ajouter un domaine : variable `ALLOWED_ORIGINS` (séparés par des virgules ; `*` pour tout autoriser en dépannage) ;
  - en-têtes de sécurité, vraie IP du joueur derrière le proxy Render (limite d'essais de connexion) ;
  - anti-flood : au-delà de 25 messages par seconde, les messages sont ignorés ; au-delà de 120, la connexion est coupée.

## Appli installable (PWA) et site (Vercel)

Le site est une **appli installable** : icône sur l'écran d'accueil, plein écran, démarrage rapide.
- **Android (Chrome)** : bouton **« 📲 Installer l'appli »** sur l'accueil, ou menu ⋮ → « Installer l'application ».
- **iPhone (Safari)** : Partager ⬆️ → « Sur l'écran d'accueil ». Le bouton de l'accueil l'explique.
- Fichiers dans [public/](public/), copiés tels quels par `expo export` :
  - `index.html` (modèle de la page), `manifest.webmanifest`, `icons/` ;
  - `sw.js` : service worker. Les pages passent toujours par le réseau (dernière version), le code et les images sont gardés en cache. Le serveur de jeu n'est jamais mis en cache. Pour forcer le vidage du cache chez tous les joueurs : changer `VERSION` dans `sw.js`.
- **Plein écran sur téléphone** ([src/utils/fullscreen.js](src/utils/fullscreen.js)) : au lancement d'une partie (ou au premier toucher en jeu), la barre du navigateur disparaît. **La Ronda passe en paysage** : les 4 joueurs autour d'une table marocaine dessinée (cadre en cèdre et clous en laiton, bande de zellige, tapis rouge — [src/components/MoroccanTable.js](src/components/MoroccanTable.js)). La table prend toute la place libre entre les joueurs et les cartes posées prennent la plus grande taille qui tient (une ou deux rangées) ; les boutons « RONDA ! » et « Il est rondé ? » sont à gauche, au-dessus de « Toi », pour ne pas cacher la table. Le score, les cartes ramassées et la distribution tiennent dans une petite barre en haut à droite ; le tour (avec le chrono) et les réactions sont en bas à droite. La table garde ainsi toute la largeur. Sur Android, c'est automatique. Sur iPhone, Safari ne le permet pas : le plein écran passe par l'appli installée, et la Ronda propose de tourner le téléphone.
- [vercel.json](vercel.json) : en-têtes de sécurité du site (HTTPS forcé, CSP, anti-iframe…). **Si le jeu charge un jour une ressource d'un autre domaine** (nouveau serveur, images externes), il faut l'ajouter dans la `Content-Security-Policy`, sinon le navigateur la bloque.

## Mode test (web)

Ajouter `?test=1` à l'adresse du site, par exemple `https://jebengere3.fun/?test=1`. Les parties Hezz2 contre l'ordinateur commencent alors avec des **1, 2 et 7** en main, ce qui permet de vérifier les cartes spéciales en jeu réel.

Avec `?test=big`, la main commence avec **20 cartes**, pour vérifier l'affichage de l'éventail sur un grand écran comme sur un téléphone.

## Salons privés : jeu, bots et équipes
- **Changer de jeu sans quitter le salon** : l'hôte choisit le jeu dans le salon (« JEU DU SALON » : Hezz2, Ronda, Kdoub, Sota Ghamla). En fin de partie, le bouton « 🎲 Changer de jeu » ramène tout le monde au salon, avec le même code. S'il y a trop de joueurs pour le nouveau jeu, les bots partent d'abord, puis les derniers arrivés passent spectateurs ; s'il y a de la place, les spectateurs entrent en jeu. Pas disponible en matchmaking ni contre les bots.
- L'hôte peut **ajouter un bot** avant le lancement (bouton « 🤖 ＋ Ajouter un bot ») et le retirer (✕). Exemple : 3 amis en Ronda + 1 bot pour jouer en 2 contre 2, ou 2 amis contre 2 bots.
- **Équipes (Ronda à 4)** : les places 1+3 jouent contre 2+4. L'hôte touche deux joueurs pour échanger leurs places ; les équipes sont affichées en bleu et en rouge.
- Un ami qui rejoint un salon complet prend la place d'un bot.
- **Bots ajoutés automatiquement** : s'il manque des joueurs pour lancer (ex. Ronda à 3, qui se joue à 2 ou à 4), le bouton devient « DÉMARRER · +1 BOT » et complète la table avec le nombre de bots nécessaire avant de lancer. Ça marche dès 2 humains dans le salon, pour tous les jeux (Sota à 2 ou 3, Kdoub à 2…).
- Pas de musique pendant les parties : elle s'arrête en fondu au lancement et reprend au menu.

## Compte à rebours avant la partie
- Au lancement de chaque partie (salon, matchmaking, contre les bots, Rejouer), un compte à rebours de **6 secondes** s'affiche avec le nom du joueur qui commence (« C'est toi qui commences ! »). Le chrono du tour et les bots ne démarrent qu'après, et le serveur refuse les coups pendant ce temps : le premier joueur n'est jamais pris au dépourvu.
- En Ronda, sur téléphone tenu en portrait, un bouton « 🔄 Tourner l'écran » passe en plein écran paysage (Android) ; sur iPhone, un message demande de tourner le téléphone.
- Pas de compte à rebours entre deux manches d'une même Ronda (« Continuer »).
- Variable d'environnement facultative du serveur : `START_COUNTDOWN_MS` (6000 par défaut, 0 pour le désactiver ; désactivé automatiquement pendant `npm test`).

## Anti-blocage

- **Hezz2** : au 1er tour manqué, la pioche est automatique et un avertissement s'affiche. À partir du 2ᵉ tour manqué d'affilée, un coup est joué automatiquement au bout de 8 s, comme le ferait un bot. Le compteur repart à zéro dès que le joueur rejoue.
- **Ronda** : une carte au hasard est jouée à la fin du chrono.
- **Kdoub** : une carte est posée au hasard à la fin du chrono, avec une limite de 40 s.
- **Sota Ghamla** : une carte est piochée au hasard à la fin du chrono.
- La fenêtre pour contrer un 1 en Hezz2 dure **5 s**.

## Premium, phase 2 : progression et récompenses

- **Compte** : un pseudo de 3 à 16 caractères et un mot de passe d'au moins 6 caractères, sans email.
  - Le mot de passe est haché avec scrypt, et les essais sont limités.
  - L'XP de l'appareil est reprise à l'inscription, jusqu'à 3 000 XP.
  - Sans compte, le jeu fonctionne comme avant, avec une progression locale.
- **Le serveur calcule la progression** à partir des parties qu'il arbitre, avec les mêmes règles d'XP qu'avant. Il tient à jour :
  - les statistiques par jeu : parties jouées, victoires, défaites, taux de victoire, meilleure série ;
  - les coups spéciaux : Darba, Hbel, Boug, Missa, KDOUB criés, menteurs démasqués, Sota évitée, 1ʳᵉ place en Hezz2 ;
  - l'historique des 30 dernières parties : jeu, résultat, XP, date et adversaires.
- **Abandons et absences** : un abandon en cours de partie compte comme une défaite, sans XP. Une partie jouée en automatique, avec plus de 3 tours manqués, ne rapporte pas d'XP.
- **Défis du jour** : 3 défis par jour, renouvelés à minuit, heure du Maroc. Chacun rapporte des XP et débloque un dos ou un tapis exclusif.
- **Titres** : 7 titres. On choisit dans le Profil celui qui s'affiche, et il apparaît aussi dans les salons.
- **Rangs** : les 5 rangs existants sont conservés. L'Boss va désormais jusqu'à 5 000 XP, puis viennent M3allem, Sultan dyal l'karta et L'Ostora.
- **Saison de 4 semaines** : un classement général et un classement par jeu, avec le pseudo seulement. En fin de saison, le top 10 reçoit un dos exclusif et un badge.
- **Avatars** : on peut choisir parmi 8 avatars.
- Les définitions des rangs, défis, titres et récompenses sont regroupées dans `server/progress/defs.js`, utilisé par le serveur et par l'appli.

## Premium, phase 1 : visuel et animations

- **Une table par jeu** :
  - Hezz2 : café vert, bois et cuivre ;
  - Ronda : bleu nuit ;
  - Kdoub : rouge sombre ;
  - Sota Ghamla : violet nuit.

  Le tapis est recoloré en gardant ses motifs, et le coffret de cartes reste dans ses couleurs d'origine.
- **Personnalisation** (Profil → 🎨 Style) :
  - 5 dos de cartes : Classique, Couleurs du jeu et Doré dès le départ ; Zellige débloqué au rang fchkel, Nuit étoilée au rang chdid ;
  - 3 tapis par jeu : celui par défaut, un 2ᵉ débloqué au rang Hara o kan, un 3ᵉ au rang fchkel ;
  - réglage des vibrations.
- **Animations** :
  - la pioche vole vers le joueur qui pioche ;
  - en Kdoub, le tas glisse vers celui qui ramasse ;
  - en Sota, la carte piochée vole vers le joueur ;
  - un éclat doré accompagne Darba, Hbel, Boug, Missa, le Roi en dernière carte (9a3a rey), le verdict d'un KDOUB, la Sota finale, la sortie d'un joueur et la victoire par forfait.
- **Avatars** :
  - un petit saut quand le joueur joue ;
  - 😤 quand il crie KDOUB ;
  - 😭 quand il ramasse ;
  - 🤡 pour le Khasser ou le Ghamla ;
  - 😎 après un beau coup.
- **Cartes non jouables** : elles sont grisées. Quand on en touche une, un message explique pourquoi, par exemple « Il faut la même famille ou la même valeur ».
- **Fin de partie** : le classement apparaît ligne par ligne, puis les XP défilent et la barre de rang se remplit.
- **Son** :
  - la musique accélère légèrement (jusqu'à +7 %) et monte un peu quand la partie se tend ;
  - 4 nouveaux sons synthétisés : KDOUB, MENTEUR, VRAI et Sota finale.
- **Vibrations** : courte pour une pose, longue pour un KDOUB ou la Sota, double pour une victoire. Elles sont coupées par le bouton muet ou par le réglage dans le Profil.

## Tests

```bash
cd server
npm test                   # tests des moteurs, puis tests réseau de bout en bout (vrai serveur et vrais clients) :
                           # matchmaking, bots, annulation, Rejouer, abandon et forfait, mode test,
                           # compte à rebours, changement de jeu et retour au salon
```

## Architecture

```
server/
  server.js              rooms, matchmaking par jeu, timer, bots, chat, réactions
  engines/common.js      deck espagnol 40 cartes, mélange, ordre des valeurs
  engines/hezz2.js       adaptateur du moteur Hezz2 (GameEngine.js) et de son IA
  engines/ronda.js       moteur Ronda (règles, annonces, dénonciation, bots, vue masquée)
  engines/kdoub.js       moteur Kdoub (poses cachées, fenêtre KDOUB, révélation, bots)
  engines/sota.js        moteur Sota Ghamla (paires, pioche à l'aveugle, Sota finale, bots)
  engines/index.js       registre : room.gameType → moteur
  tests/                 tests node:test
src/
  games.js               catalogue des jeux côté client
  screens/               Home (sélecteur de jeu), Lobby, Game (Hezz2), Ronda, Kdoub, Sota, Profile
  components/            cartes, sièges, table, chat et réactions communs, bannières, fins de manche
  network/               socket et audio (sons synthétisés : scripts/generate-sfx.js)
```

Chaque moteur expose la même interface : `init`, `apply(state, joueur, action)`, `timerFor`, `onTimeout`, `botActions`, et en option `viewFor`, qui masque les mains adverses pour chaque joueur. Ajouter un jeu revient à écrire un moteur et à l'enregistrer dans `engines/index.js`.

Les sons sont générés par `node scripts/generate-sfx.js`. Le script écrit des fichiers WAV dans `assets/sfx/`.
