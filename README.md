# L'Carta

*(anciennement Jeben Gere3 : le domaine `jebengere3.fun`, le serveur `jebenegere3.onrender.com` et les identifiants `fun.jebengere3.app` gardent l'ancien nom.)*

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
- **Comptes joueurs (phase 2)** : il faut définir la variable `DATABASE_URL`, qui pointe vers une base PostgreSQL (base actuelle : Prisma Postgres, projet dédié au jeu). Les variables copiées telles quelles depuis Vercel / Prisma sont aussi reconnues (`XXX_DATABASE_URL_POOLED` en priorité, puis `XXX_DATABASE_URL`, `XXX_POSTGRES_URL`) : sur Render, **Environment → Add from .env** et coller le bloc. Les tables `players`, `reports` et `tournaments` sont créées toutes seules au démarrage ; le journal indique la variable utilisée (`[progress] base PostgreSQL : variable …`). **Ne pas lancer `prisma migrate`** : le projet n'utilise pas Prisma ORM, et Prisma proposerait d'effacer ces tables.
  - Sans `DATABASE_URL`, les comptes sont enregistrés dans `server/data/players.json`. **Sur Render, ce fichier est effacé à chaque redéploiement ou redémarrage** : cette solution ne convient donc qu'en local.
  - Au démarrage, le journal de Render indique le stockage utilisé : `[progress] stockage : postgres`.
- **Sécurité** ([server/security.js](server/security.js)) :
  - seuls le site (`jebengere3.fun`), les déploiements Vercel, `localhost` et l'appli installée (sans origine) peuvent se connecter. Pour ajouter un domaine : variable `ALLOWED_ORIGINS` (séparés par des virgules ; `*` pour tout autoriser en dépannage) ;
  - en-têtes de sécurité, vraie IP du joueur derrière le proxy Render (limite d'essais de connexion) ;
  - anti-flood : au-delà de 25 messages par seconde, les messages sont ignorés ; au-delà de 120, la connexion est coupée.

## Pseudos des joueurs et des bots

- **Compte = pseudo + mot de passe.** Le pseudo est l'identifiant : unique (sans tenir compte des majuscules), 3 à 16 caractères. Connecté, on joue toujours sous le pseudo de son compte.
- **Pseudo réservé** : un invité (sans compte) ne peut pas prendre le pseudo d'un compte existant, ni pour créer ou rejoindre un salon, ni en partie en ligne, ni pour s'inscrire à un tournoi. Message : « Ce pseudo appartient à un compte. Connecte-toi à ce compte (Profil), ou choisis un autre pseudo. »
- **Bots** ([server/botNames.js](server/botNames.js)) : pseudos écrits comme ceux des joueurs (Hamza27, Salma_212, SoufianeK, Imane.casa, Simo10…), sans « Bot » devant, jamais deux fois le même à une table, avec un portrait assorti au prénom. En partie, rien ne les distingue des joueurs (plus d'icône 🤖). En partie en ligne, l'écran de recherche annonce « Adversaires trouvés ! » ; dans un salon privé, l'hôte voit toujours qui est un bot (il les ajoute et les retire lui-même).

## Joueurs en ligne

Sur l'accueil, au-dessus de **JOUER EN LIGNE** : « 🟢 12 joueurs en ligne · 3 parties en cours » (connectés au serveur, et parties en cours avec au moins un humain ; les bots ne comptent pas). Dans le menu **Jouer en ligne**, une pastille verte sur une taille indique combien de joueurs attendent déjà une partie de ce jeu à cette taille : la choisir lance la partie tout de suite.

Côté serveur : événement `online_stats` `{ online, playing, games, searching: { 'hezz2:4': 2, … } }`, envoyé à la connexion puis à tous quand ça change, au plus toutes les 5 s (`ONLINE_STATS_MS`). Fonction annoncée : `online_count` (sans elle, l'accueil n'affiche rien).

## Coupures réseau et redémarrages du serveur

- **Micro-coupure** (réseau mobile, appli en arrière-plan, moins de 2 min) : la connexion est retrouvée telle quelle (`connectionStateRecovery` de Socket.io), le joueur garde sa place et reçoit les coups manqués.
- **Coupure plus longue en pleine partie** : sa place est gardée **45 s** (`RECONNECT_GRACE_MS`), le chrono joue pour lui ; ensuite il est remplacé (bot, ou forfait à 2 et en tournoi). Un départ volontaire (bouton Quitter) reste immédiat.
- **Partie disparue** (serveur redémarré par un déploiement Render ou une panne, ou place perdue) : au premier coup joué, ou dès la reconnexion, l'appli affiche « Partie interrompue » au lieu d'une table figée. En tournoi, le bouton ramène à la page du tournoi : le match est relancé dès que les deux camps y sont (sinon le joueur était compté absent, puis forfait au bout de 3 min). La partie interrompue recommence de zéro.
- **Erreur dans un moteur de jeu** : l'action est refusée et l'erreur est écrite dans le journal, sans arrêter le serveur (qui couperait toutes les parties).
- **Conseil** : éviter de redéployer Render pendant un tournoi ou un test en cours.
- Test de robustesse du moteur de Ronda : `cd server && node scripts/fuzz-ronda.js 300 4` (parties au hasard avec annonces, dénonciations et temps écoulés).

## Capacité du serveur et limites

**Test de charge** (`cd server && node scripts/loadtest/load_run.js 25,50,100,200,300`) : des salons privés de Hezz2 à 4 vrais joueurs (sockets) qui jouent comme des humains (1 à 2,5 s par coup) et relancent une manche dès qu'elle finit. Mesuré le 17 nov 2026 sur un portable (Intel i7-1165G7), serveur seul dans son processus :

| Joueurs connectés | Parties en cours | Processeur (moyenne / pic, % d'un cœur) | Mémoire | Coups par seconde | Réponse à un coup (médiane / 95 %) |
|---|---|---|---|---|---|
| 100 | 25 | 2,4 % / 11 % | 48 Mo | 13 | 1 / 3 ms |
| 200 | 50 | 4,4 % / 13 % | 56 Mo | 25 | 1 / 3 ms |
| 400 | 100 | 3,9 % / 12 % | 68 Mo | 51 | 1 / 2 ms |
| 800 | 200 | 7,6 % / 17 % | 89 Mo | 102 | 1 / 4 ms |
| 1 200 | 300 | 9,2 % / 24 % | 99 Mo | 150 | 1 / 3 ms |

Lecture pour Render :
- **Offre gratuite** (0,1 processeur, 512 Mo, processeur plus lent qu'un portable récent) : le processeur est la limite, pas la mémoire. Estimation : **environ 400 à 600 joueurs en même temps (100 à 150 parties)** avant que les coups ne prennent du retard. S'y ajoute la mise en veille après 15 min sans visite.
- **Offre Starter** (0,5 processeur, environ 7 $/mois, sans mise en veille) : plusieurs milliers de joueurs.
- Limites du test : en local (sans le délai d'Internet), Hezz2 seulement (la Ronda, le Kdoub et la Sota envoient une vue par joueur, un peu plus coûteuse), sans compte ni base de données.

**Base de données** : un compte pèse 5 à 10 Ko. Chaque connexion d'un joueur avec compte, chaque fin de partie et chaque enregistrement comptent pour 1 à 3 opérations sur la base ; surveiller le quota d'opérations de l'offre Prisma (onglet Usage). Le **classement** est gardé en mémoire : la base n'est relue qu'une fois par minute au plus (par saison et par jeu, `RANKING_TTL_MS`), avec une requête qui ne lit que le pseudo, le portrait, le titre et l'XP de la saison ; il est tenu à jour à chaque fin de partie, changement de portrait ou suppression de compte.

**Limites fixées dans le jeu** : joueurs par partie (Hezz2 2 à 4, Ronda 2 ou 4, Kdoub 3 à 6, Sota 4 à 6) ; 6 spectateurs par salon ; 10 s d'attente en partie en ligne puis bots ; tournois de 4 ou 8, 300 ouverts au plus, jusqu'à 30 jours à l'avance, palmarès des 20 derniers ; 5 appareils connectés par compte ; historique des 30 dernières parties ; 8 essais de mot de passe ratés par 10 min ; 25 messages par seconde par joueur (exclusion au-delà de 120) ; signalements gardés 6 mois. Les parties en cours sont en mémoire : un redémarrage les coupe (les tournois reprennent).

## Publicité (Google AdSense, site web seulement)

- **Script :** le script AdSense du compte de Yassir (`ca-pub-1980774468513818`) est dans `public/index.html`. `public/ads.txt` déclare ce compte comme vendeur autorisé.
- **Politique de sécurité :** la Content-Security-Policy de `vercel.json` autorise les domaines de Google AdSense (scripts, cadres des annonces, images). Sans ça, le navigateur bloquerait le script.
- **Confidentialité :** la politique (`/privacy`) a une section « Publicité sur le site web » (cookies Google, refus de la publicité personnalisée).
- **Visiteurs européens :** pour ceux de l'EEE, du Royaume-Uni et de la Suisse, Google exige un message de consentement. Il s'active dans AdSense → Confidentialité et messages, sans code à ajouter.
- **Aucun effet sur le jeu :** la publicité ne donne ni binga ni avantage. Le pseudo, le compte et la progression ne sont pas transmis à Google.

## Appli installable (PWA) et site (Vercel)

Le site est une **appli installable** : icône sur l'écran d'accueil, plein écran, démarrage rapide.
- **Android (Chrome)** : bouton **« 📲 Installer l'appli »** sur l'accueil, ou menu ⋮ → « Installer l'application ».
- **iPhone (Safari)** : Partager ⬆️ → « Sur l'écran d'accueil ». Le bouton de l'accueil l'explique.
- Fichiers dans [public/](public/), copiés tels quels par `expo export` :
  - `index.html` (modèle de la page), `manifest.webmanifest`, `icons/` ;
  - `sw.js` : service worker. Les pages passent toujours par le réseau (dernière version), le code et les images sont gardés en cache. Le serveur de jeu n'est jamais mis en cache. Pour forcer le vidage du cache chez tous les joueurs : changer `VERSION` dans `sw.js`.
- **Plein écran sur téléphone** ([src/utils/fullscreen.js](src/utils/fullscreen.js)) : au lancement d'une partie (ou au premier toucher en jeu), la barre du navigateur disparaît. **La Ronda passe en paysage** : les 4 joueurs autour de la table en velours rouge et zellige (voir « Tables de jeu »). La zone de jeu prend toute la place libre entre les joueurs et les cartes posées prennent la plus grande taille qui tient (une ou deux rangées) ; les boutons « RONDA ! » et « Il est rondé ? » sont à gauche, au-dessus de « Toi », pour ne pas cacher la table. Le score, les cartes ramassées et la distribution tiennent dans une petite barre en haut à droite ; le tour (avec le chrono) et les réactions sont en bas à droite. La table garde ainsi toute la largeur. Sur Android, c'est automatique. Sur iPhone, Safari ne le permet pas : le plein écran passe par l'appli installée, et la Ronda propose de tourner le téléphone.
- [vercel.json](vercel.json) : en-têtes de sécurité du site (HTTPS forcé, CSP, anti-iframe…). **Si le jeu charge un jour une ressource d'un autre domaine** (nouveau serveur, images externes), il faut l'ajouter dans la `Content-Security-Policy`, sinon le navigateur la bloque.

## Applis mobiles : build iOS et Android (EAS)

Identifiants : **`fun.jebengere3.app`** sur iOS (bundleIdentifier) et sur Android (package). Nom affiché : **L'Carta**. Logo, icônes et splash sont dans `assets/brand/`, tous générés depuis le logo carré `logo-source.png` par `python scripts/build-brand.py <logo.png>` : icône carrée 1024 sans transparence (iOS), premier plan de l'icône adaptative Android (logo réduit dans la zone sûre, fond bleu nuit `#020E28`), splash (logo détouré), favicon, icônes du site (`public/icons/`) et logo de l'accueil (`logo.webp`, ~95 Ko). Le micro, le stockage et la superposition d'écran sont retirés des permissions Android ; seuls Internet et la vibration restent.

Profils de [eas.json](eas.json) :
- `development` : APK de debug (Android) ou build simulateur (iOS) ;
- `preview` : APK installable directement sur un téléphone Android, ou build iOS en distribution interne (TestFlight non nécessaire) ;
- `production` : AAB pour Google Play et build App Store ; le numéro de build augmente tout seul (`autoIncrement`, version gérée par EAS).

Procédure :
1. `npm install -g eas-cli`, puis `eas login` (compte Expo gratuit).
2. `eas init` : relie le projet à un projet Expo (ajoute `extra.eas.projectId` dans app.json, à commiter).
3. `npx expo-doctor` : doit afficher 18/18.
4. Android de test : `eas build --profile preview --platform android`, puis installer l'APK reçu par lien.
5. iOS de test : `eas device:create` (enregistre l'iPhone), puis `eas build --profile preview --platform ios` (compte Apple Developer requis).
6. Production : `eas build --profile production --platform all`.
7. Envoi aux stores : `eas submit --platform android` et `eas submit --platform ios` (voir « Publication » plus bas).

Aucun secret n'est dans le dépôt : les certificats et clés de signature sont créés et gardés par EAS lors du premier build.

## Publication sur l'App Store et Google Play

Rien n'est publié : le code est prêt, il reste les comptes et les envois.

1. **Avant tout** : remplacer les fichiers 🔴 de [ASSETS-LICENCES.md](ASSETS-LICENCES.md) (la musique et le son « +2 » sont faits ; il reste à vérifier les fichiers 🟡).
2. Redéployer le serveur Render (suppression de compte, modération du chat) et vérifier https://jebengere3.fun/privacy et /terms.
3. Créer les comptes : **Apple Developer, 99 $ par an** (developer.apple.com, validation en 1 à 2 jours, plus pour une entreprise) ; **Google Play Console, 25 $ une seule fois** (play.google.com/console, vérification d'identité de quelques jours).
4. Builds de production : `eas build --profile production --platform all` (voir la section « Applis mobiles » ci-dessus).
5. App Store Connect : créer l'appli `fun.jebengere3.app`, puis remplir la fiche (captures, description, catégorie Jeux / Cartes), l'URL de confidentialité, les « étiquettes de confidentialité » (pseudo et contenu du chat, non liés à l'identité, pas de pistage), et la classification d'âge (chat entre joueurs : contenu généré par les utilisateurs, avec signalement et blocage). Indiquer 12+.
6. Google Play Console : créer l'appli, remplir la fiche, la « Sécurité des données » (mêmes réponses), la classification IARC et le public cible (12 ans et plus, pas destiné aux enfants).
7. Envoyer : `eas submit --platform ios` (TestFlight, puis « Soumettre pour vérification ») et `eas submit --platform android` (piste de test).
8. **Google, compte personnel récent** : test fermé obligatoire avec au moins 12 testeurs pendant 14 jours avant de pouvoir demander la production.
9. Délais de relecture : Apple, en général 24 à 48 h (refus fréquent au premier essai, réponse dans le Resolution Center) ; Google, de quelques heures à 7 jours pour une première appli.
10. Après la mise en ligne : chaque nouvelle version, c'est `eas build --profile production` (le numéro de build monte tout seul) puis `eas submit`.

## Confidentialité et conditions d'utilisation

- Politique de confidentialité : **https://jebengere3.fun/privacy**
- Conditions d'utilisation : **https://jebengere3.fun/terms**

Un seul texte, dans [src/legal/legal.json](src/legal/legal.json), sert à la fois :
- à l'écran « Confidentialité / Conditions » de l'appli (liens en bas de l'accueil, dans le Profil et dans Personnaliser → Réglages), lisible sans compte et sans connexion ;
- aux pages web statiques `public/privacy/index.html` et `public/terms/index.html` (HTML pur, sans JavaScript ni serveur de jeu), régénérées avec `node scripts/build-legal.js` après chaque modification du texte.

Adresse email de contact (`contactEmail`) : **yasschirawi11@gmail.com**, affichée en bas des deux pages et de l'écran de l'appli (lien mailto). Pour la changer : modifier `contactEmail`, puis relancer `node scripts/build-legal.js`.

## Modération du chat

- **Signaler / Bloquer** : toucher la bulle d'un message (ou le bouton « ⋯ » dans la fenêtre du chat, qui garde les derniers messages) ouvre un menu.
  - **Signaler** (insulte, spam, triche, autre) : le serveur enregistre le message, son auteur, la date et la raison ; le message est masqué pour celui qui signale.
  - **Bloquer le joueur** : dans les deux sens, plus aucun message ni réaction entre les deux joueurs, dans la partie en cours et les suivantes. La liste est dans le Profil (« Joueurs bloqués », bouton Débloquer). Elle est gardée sur l'appareil et, pour un joueur connecté, dans son compte.
- **Filtre** ([server/moderation.js](server/moderation.js)) : les insultes les plus courantes (français, darija en lettres latines, arabe) sont refusées, avec un message clair pour l'expéditeur. Pas de sanction automatique pour un mot.
- **Lire les signalements** (V1, sans interface d'administration) : sur Render, onglet Shell du service, `node scripts/reports.js` (liste) ; `node scripts/reports.js --delete <id>` une fois traité. Ils sont supprimés automatiquement après 6 mois (table `reports` en PostgreSQL, `server/data/reports.json` en local).
- Les messages rapides, les messages personnalisés et les réactions emoji marchent comme avant.
- Sur ordinateur : toute la ligne d'un message dans « Derniers messages » est cliquable ; une bulle reçue pendant que l'onglet est en arrière-plan reste affichée jusqu'au retour sur l'onglet. Deux onglets d'un même navigateur comptent comme deux joueurs (le deuxième reçoit une identité temporaire : un blocage contre lui dure tant que cet onglet reste ouvert). Entre deux appareils ou deux comptes, le blocage est permanent.

## Suppression de compte

- Profil → section Compte → **« Supprimer mon compte »** (bouton rouge, visible dès qu'on est connecté). Une confirmation explique ce qui est effacé : pseudo, XP, rang, stats, historique, défis, titres, dos et tapis débloqués, liste des joueurs bloqués.
- Serveur : `DELETE /api/me` (jeton du joueur) supprime la ligne de la table `players` (PostgreSQL) ou l'entrée du fichier local, réécrit tout de suite. Aucune copie gardée ; le pseudo redevient libre. Les moteurs de jeu ne sont pas touchés.
- Appli : après la suppression, toutes les données de l'appareil sont effacées, le joueur est déconnecté et revient à l'accueil.
- Serveur pas à jour : message clair (« la suppression du compte n'est pas disponible pour l'instant ; ton compte n'a pas été supprimé »), jamais d'écran vide.

## Tables de jeu

Une table par jeu, vue du dessus ([src/components/TableBackground.js](src/components/TableBackground.js)), images générées par IA (ChatGPT, offre payante) et préparées par `python scripts/build-tables.py <dossier>` (`assets/tables/`) :

| Jeu | Table |
|---|---|
| Hezz2 | ronde, tapis vert, thé à la menthe (`menthe.jpg`) |
| Ronda | ovale, velours rouge et zellige (`velours.jpg`) |
| Kdoub | plateau rond en cuivre, désert (`cuivre.jpg`) |
| Sota Ghamla | ovale néon (`neon.jpg`) |
| (en réserve) | ovale verte de tournoi (`tournoi.jpg`) |

L'image couvre tout l'écran ; les tables ovales ont une version tournée d'un quart de tour quand l'écran est plus haut que large. La teinte de tapis choisie dans Personnaliser ne colore que le tapis (le tapis par défaut garde la table telle quelle). En Ronda paysage, les cartes se posent directement sur le velours.

## Mode test (web)

Ajouter `?test=1` à l'adresse du site, par exemple `https://jebengere3.fun/?test=1`. Les parties Hezz2 contre l'ordinateur commencent alors avec des **1, 2 et 7** en main, ce qui permet de vérifier les cartes spéciales en jeu réel.

Avec `?test=big`, la main commence avec **20 cartes**, pour vérifier l'affichage de l'éventail sur un grand écran comme sur un téléphone.

## Inviter par lien (plus de code à taper)

1. **Créer un salon privé** : le salon affiche « INVITE TES AMIS » avec le lien (`https://jebengere3.fun/salon/XXXXX`), un bouton **Copier le lien** et un bouton **Partager** (partage du téléphone : WhatsApp, SMS… ; sur ordinateur sans partage, le lien est copié).
2. **L'ami clique sur le lien** : le jeu s'ouvre et le fait entrer directement dans le salon. S'il n'a pas encore de pseudo, une fenêtre le lui demande, puis il rejoint. L'adresse revient ensuite sur l'accueil (recharger la page ne le fait pas rejoindre une deuxième fois).
3. **Salon complet ou partie commencée** : il entre en **spectateur** et voit la partie en cours. Jusqu'à 6 spectateurs en plus des joueurs. Un spectateur ne joue pas et n'écrit pas dans le chat, mais peut envoyer des réactions emoji (« 👀 Nom : 👏 » chez les joueurs).
4. **Un joueur quitte en pleine partie** : une annonce s'affiche chez tout le monde (« X a quitté la partie : un bot prend sa place ») ; à 2 joueurs, c'est une victoire par forfait. L'écran de fin de manche nomme les joueurs qui l'ont vraiment jouée ; au moment de rejouer, un spectateur qui attend prend la place du joueur parti (sinon un bot ordinaire la garde), puis le Khasser du Hezz2 laisse sa place. Au retour au salon, la place du joueur parti est libérée. Un bot ne devient jamais spectateur.

Le code reste l'identifiant interne du salon. Un ancien lien ou un code seul marche toujours : accueil → **« 🔗 J'ai un lien d'invitation »**, coller le lien ou le code (majuscules ou minuscules). Sur le web, `/salon/*` est réécrit vers l'appli dans `vercel.json`. Dans l'appli mobile, les liens `jebengere3://salon/XXXXX` sont compris ; pour qu'un lien `https://` ouvre directement l'appli installée (liens universels iOS et liens d'application Android), il faudra publier les fichiers d'association du domaine une fois les comptes stores créés. D'ici là, le lien ouvre le site.

## Tournois (élimination directe)

Accueil → **🏆 TOURNOIS** : créer un tournoi, retrouver ses tournois, voir le **palmarès** des champions. Le dernier champion est aussi affiché sur l'accueil, sous le bouton.

1. **Créer** : nom, jeu (**Hezz2** ou **Ronda** en V1 ; Ronda en **1 contre 1** ou **2 contre 2**), **4 ou 8 joueurs**, jour (aujourd'hui + 6 jours) et heure (par quart d'heure). Le créateur devient l'organisateur.
2. **Inviter** : le tournoi a son lien `https://jebengere3.fun/tournoi/CODE` (boutons **Copier le lien** et **Partager**). Ouvrir le lien mène à la page du tournoi : on choisit son pseudo et on touche **JE M'INSCRIS** (désinscription possible tant que le tournoi n'a pas commencé). Pas de compte nécessaire.
3. **Page du tournoi** : jeu, date et compte à rebours, inscrits (pseudos seulement), **tableau** (quarts, demi-finales, finale), puis le **champion**. Toucher un match terminé affiche ses coups clés.
4. **Début** : à l'heure prévue (ou plus tôt avec **Lancer maintenant**, réservé à l'organisateur, dès 2 inscrits, 3 en 2 contre 2), le tableau est tiré au sort. S'il manque des joueurs, une place vide fait passer l'adversaire au tour suivant ; en 2 contre 2, un nombre impair d'inscrits donne un bot comme coéquipier.
5. **Matchs, tour par tour** : il faut **garder la page du tournoi ouverte**. Le match se lance tout seul dès que les deux adversaires sont là. Un joueur absent au bout de **3 minutes** perd par **forfait** (personne : vainqueur tiré au sort). Quitter la partie en cours = forfait. Le tour suivant commence quand tous les matchs du tour sont finis.
   - Hezz2 : une manche en 1 contre 1, le Khasser est éliminé.
   - Ronda : la partie se joue jusqu'au score final, les manches s'enchaînent toutes seules. En 2 contre 2, les coéquipiers sont assis en face l'un de l'autre.
6. **Fin d'un match** : une fenêtre affiche le vainqueur, le score (Ronda) et les **coups clés** (Ronda : Darba, Hbel, B'achra, Missa ; Hezz2 : grosses pioches, dernière carte ; abandons et forfaits), puis **Retour au tournoi**.
7. **Champion** : dos de cartes exclusif **« Champion »** (rouge et or, couronne au centre, à choisir dans Profil → Style), titre **« Moul chi »** et 150 XP. Il faut un compte pour garder la récompense : un champion sans compte la reçoit automatiquement dès qu'il se connecte à un compte **depuis le même appareil**.

**Côté serveur** (`server/tournaments.js`) : un tournoi est un tableau de matchs, chaque match se joue dans une salle normale (sans Rejouer ni hôte). On ne garde que les pseudos, le tableau et les coups clés ; chaque inscrit reçoit un ticket secret gardé sur son appareil (le serveur n'en garde que l'empreinte). Les tournois sont sauvegardés (table `tournaments` en PostgreSQL, sinon `server/data/tournaments.json`) et reprennent après un redémarrage de Render : un match coupé par le redémarrage est relancé. Le serveur gratuit s'endort sans visite : à l'heure du tournoi, la première personne qui ouvre la page le réveille, et le tournoi démarre alors.

**Plus tard** : Kdoub et Sota en tournoi (coups clés KDOUB et Sota finale), replay des matchs.

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

## Accueil

- **En-tête, sur l'accueil et sur le choix du jeu :** le portrait avec le numéro de niveau, le pseudo, le rang, la barre d'XP jusqu'au rang suivant, et le solde de binga (le « ＋ » ouvre la Boutique). À droite : classement, musique, son. Toucher le portrait ouvre le Profil.
- **Premier écran :** l'en-tête, le logo et un seul gros bouton **JOUER**. Sans compte, une case « Ton pseudo » apparaît sous le logo.
  - Sous le bouton : 4 raccourcis, Roue (pastille rouge quand le tour gratuit est disponible), Boutique, Défis et Connexion (jour de la série).
- **JOUER** ouvre le choix du jeu et du mode : en ligne, contre l'ordinateur, salon privé, tournois. Le bouton « ← Accueil » ramène à la carte. Le fonctionnement de chaque mode ne change pas.
- **Fenêtres du jour** (`src/components/DailyPopups.js`) : une fois par jour chacune, l'une après l'autre, quand l'accueil est libre (pas pendant les règles, une invitation ou une recherche).
  1. **Connexion du jour :** les binga reçus et le calendrier des 7 jours (jours passés cochés, jour 7 à 150).
  2. **Roue du jour :** « 1 tour gratuit t'attend », si le tour n'a pas encore été fait.
  3. **Boutique :** les nouveautés (portraits premium, coffres).
  - **Sans compte :** une seule fenêtre « Crée ton compte, c'est gratuit », avec un bouton « Jouer sans compte ».
  - Toutes se ferment d'un geste. Ce qui a déjà été vu est gardé sur l'appareil, pour le jour en cours (clé `dailyPopups`).

## Premier lancement, bilan de fin de partie, sons

- **Premier lancement** (`src/components/Onboarding.js`) : 4 écrans courts (bienvenue, binga, coffres et roue, « À toi de jouer »), avec le pseudo et le choix du jeu, puis une première partie contre l'ordinateur en un geste, à la plus petite taille du jeu. « Passer » ou « Plus tard » ferment la présentation. Elle n'est montrée qu'une fois, et jamais à un joueur qui avait déjà ouvert l'appli (règles déjà vues). Les fenêtres du jour attendent qu'elle soit fermée.
- **Bilan de fin de partie** (`src/components/GameRecap.js`, comptes) :
  - XP gagnée, avec la barre du rang qui se remplit et le passage au rang suivant animé ;
  - binga qui défilent, avec le détail (partie, missions, nouveau rang) ;
  - défis réussis, nouveau titre, récompense de tournoi.
  Il remplace les petites notifications de fin de partie. Celles-ci restent pour les manches de Ronda et pour les mises.
- **Sons dédiés** (`scripts/generate-sfx.js`, par exemple `node scripts/generate-sfx.js coins` pour un seul son) : pluie de pièces, cliquetis de la roue qui ralentit, arpège à l'arrêt de la roue, coffre qui s'ouvre, fanfare de nouveau rang, « ding » des fenêtres du jour.

## Binga : la monnaie du jeu

Le binga se **gagne en jouant**. Il ne s'achète pas avec de l'argent et ne se convertit jamais en argent. Il est réservé aux joueurs avec un compte, et il est stocké avec le compte dans PostgreSQL : il est donc retrouvé après un redémarrage du serveur ou sur un autre appareil. Il servira pour les cosmétiques, les coffres et les entrées de tournoi, jamais pour jouer une partie normale, qui reste gratuite.

| Gain | Montant |
|---|---|
| Partie finie, perdue | **10 binga** (même en perdant) |
| Partie finie, gagnée, avec au moins un adversaire humain | **25 binga** |
| Partie gagnée contre l'ordinateur seulement | **20 binga** |
| Connexion du jour, en série | 50, 75, puis 100 (jours 3 à 6), **150** le 7ᵉ jour, puis la série recommence ; un jour manqué la remet à 50 |
| Missions du jour (3) | jouer 3 parties : 30 · gagner 1 partie : 50 · jouer une partie de Ronda, Kdoub ou Sota : 30 |
| Nouveau rang | **100 binga** par rang |

- **Ce qu'est une victoire :** la même définition que pour les statistiques. En Hezz2, ne pas être Khasser ; en Ronda, l'équipe qui gagne la partie (pas une simple manche) ; en Kdoub, le premier ; en Sota, ne pas finir avec la Sota.
- **Plafond :** 500 binga par jour gagnés en jouant. Les missions, la connexion du jour et les rangs passent en plus. Si le plafond est atteint au milieu d'une partie, on reçoit seulement le reste.
- **Rien n'est crédité** pour un abandon ou pour une partie jouée en automatique (plus de 3 tours manqués), comme pour l'XP.
- **Le jour change à minuit, heure du Maroc**, comme pour les défis du jour.
- **Tout est calculé par le serveur**, à partir des parties qu'il arbitre. La connexion du jour (`POST /api/daily-login`) n'est créditée qu'une fois par jour, et l'appli ne peut envoyer aucun montant.
- **Affichage :**
  - après chaque partie, une notification indique le gain, par exemple « +10 binga, même en perdant » ;
  - l'accueil affiche le solde et les missions ;
  - le Profil affiche le solde, la série de connexion, les gains du jour sur 500, les missions et les derniers gains.
- **Pas de vidéo récompensée :** il n'y en a pas dans l'appli pour l'instant (prévue à 50 binga, 3 fois par jour au plus).
- Les montants sont regroupés dans `BINGA`, dans `server/progress/defs.js`. Ils ont été décidés par Yassir : ne pas les changer sans lui demander.

## Boutique : cosmétiques en binga

La boutique s'ouvre depuis la ligne 💰 de l'accueil, ou depuis la section Binga du Profil.

Les cosmétiques sont des **visuels seulement** : ils ne donnent aucun avantage en partie. La rareté change seulement le prix, et plus tard la fréquence dans les coffres.

| Rareté | Prix |
|---|---|
| Commun | 100 binga |
| Rare | 250 binga |
| Épique | 500 binga |
| Légendaire | ne s’achète pas : coffre Or seulement |

| Type | Objets (rareté) |
|---|---|
| Dos (11 + Classique offert) | Cuivre martelé, Velours rouge (Commun) · Thé à la menthe, Rose de Kelaa, Zellige, Sahara (Rare) · Océan, Néon (Épique) · Or, Saison (Légendaire) · Champion (Légendaire, réservé au gagnant d'un tournoi : ni boutique, ni coffre) |
| Effets de victoire et de coup spécial (6 + Drapeau offert) | Confettis, Étoiles (Commun) · Menthe, Feu (Rare) · Tonnerre (Épique) · Or (Légendaire) |
| Réactions (12, en plus des 4 offertes 😂 😡 😱 👏) | Rire, Bravo, Aïe, Merci, Triste, Surpris (Commun) · Bien joué, Dors, Chat, Feu (Rare) · Menthe (Épique) · Couronne (Légendaire) |
| Tables (8, images de Yassir) | Vert classique, Velours rouge (Commun) · Cuivre sculpté, Zellige, Turquoise (Rare) · Nuit (marbre noir), Sahara (Épique) · Pourpre royal (Légendaire). Une table choisie remplace la table de chaque jeu, pour les 4 jeux ; sans choix, chaque jeu garde sa table. |
| Couleurs de tapis | Tadelakt, Safran, Braise, Lavande (Rare) : teinte du tapis d'une table de jeu. |
| Portraits (16, en plus des 12 offerts) | Touareg, Dame voilée, Cheval noir, As couronné, Bouffon, Pacha, Capuche rouge (Commun) · Roi, Reine, Sage, Aigle, Loup (Rare) · Lion couronné, Tigre blanc (Épique) · Phénix, Dragon d'or (Légendaire). Portraits 13 à 36 : le serveur refuse un portrait qu'on ne possède pas. |
| Portraits premium (8, planches de Yassir, portraits 29 à 36) | Tigresse reine, Aigle roi, Grand mage, Renarde mage, Ours roi (Épique) · Lion roi, Loup roi, Hibou mage (Légendaire, coffre Or). Découpés par `python scripts/build-avatars-premium.py assets/sources/avatars-premium-1.png assets/sources/avatars-premium-2.png`. |

- **Tables et portraits :**
  - découpés dans les planches de Yassir par `python scripts/build-table-skins.py <planche.png>` et `python scripts/build-avatars.py <planche.png> 4 4 12 0.85` ;
  - environ 60 Ko par table, en version paysage et en version tournée pour les écrans en hauteur ; seule la table choisie est chargée ;
  - le portrait tiré du pseudo reste choisi parmi les 12 offerts : aucun joueur ne change de portrait.
- **Chaque dos a son propre dessin**, en vectoriel et sans fichier à charger (`src/components/BackArt.js`) : feuilles de menthe, cuivre martelé, étoiles de zellige, dunes et soleil, vagues, néon, velours, arabesques dorées, rayons.
- **Effets** (`src/components/WinEffects.js`) :
  - ils se déclenchent à la victoire, et sur ses propres Darba, Hbel, Boug et Missa en Ronda, en version courte ;
  - chacun a son dessin et son mouvement : canons à confettis, étoiles qui scintillent, feuilles de menthe, braises et flammes, éclairs, pluie de pièces ;
  - chacun dure 3 secondes au plus, et on peut le voir dans la boutique avant de l'acheter.
- **Réactions :** en partie, le bouton ✨ à côté des réactions offertes ouvre celles qu'on possède, avec un petit texte (« Hhhhh », « Mzyana ! », « Atay ? »…). Le serveur refuse une réaction de la boutique envoyée par quelqu'un qui ne la possède pas.
- **L'achat est vérifié par le serveur** (`POST /api/shop/buy`) : existence de l'objet, prix, solde suffisant, objet pas déjà possédé, légendaires refusés. L'objet rejoint la liste `unlocks` du compte, déjà utilisée pour les défis, la saison et les tournois.
- **Gardé pour toujours avec le compte :** les objets possédés et les choix (dos, effet, tapis) sont enregistrés dans le compte. Après une réinstallation, il suffit de se reconnecter pour tout retrouver.
- **Les anciens déblocages restent valables :** Zellige au rang fchkel, les dos et tapis des défis du jour, le dos de Saison pour le top 10, Champion pour le gagnant d'un tournoi.
- Le catalogue (`COSMETICS`, `RARITIES`) est dans `server/progress/defs.js`, utilisé par le serveur et par l'appli.

## Parties à mise et tournois à entrée en binga

Les **parties classiques restent gratuites**. La mise est une option des salons privés, jamais une obligation, et ne porte jamais sur de l'argent réel.

- **Choix de la mise :** dans le salon, l'hôte choisit Gratuit, 10, 50 ou 100 binga, seulement entre deux parties. En fixant la mise, l'hôte mise lui-même.
- **Chaque joueur décide :** il touche « Miser … binga » pour miser, et peut revenir en arrière. Les joueurs qui misent ont 💰 à côté de leur nom.
- **Personne n'est forcé :** sans compte, sans assez de binga, ou sans avoir choisi de miser, on joue gratuitement, sans pénalité ni blocage. Une notification l'indique (« Partie gratuite pour toi »).
- **Mise retirée au début de la partie**, pas à la fin. Le serveur vérifie le solde à ce moment-là (`server/stakes.js`).
- **Fin de partie :**
  - le gagnant prend le pot, c'est-à-dire la mise de chaque joueur qui a misé ;
  - les perdants gardent leurs autres binga ;
  - en Ronda à 2 contre 2, le pot est partagé dans l'équipe gagnante ;
  - en Ronda, la mise couvre toute la partie, jusqu'au score final, et pas chaque manche ;
  - si le gagnant n'avait pas misé (bot ou joueur gratuit), chacun récupère sa mise.
- **Abandons et interruptions :**
  - un abandon laisse sa mise dans le pot ;
  - si tout le monde quitte le salon, les mises sont perdues, sinon on pourrait partir pour ne pas perdre ;
  - si le serveur redémarre pendant la partie, les mises sont rendues à la reconnexion (« Mise rendue (partie interrompue) »).
- **Tournoi à entrée en binga**, option à la création d'un tournoi :
  - l'entrée est de 50 binga, retirée au début du tournoi, pas à l'inscription ;
  - sans compte ou sans assez de binga, on joue gratuitement ;
  - le gagnant qui a payé reçoit, en plus de Champion, le dos exclusif **Sultan** (vert et or, ni en boutique ni en coffre), le titre **« Sultan dyal l'binga »** (nom proposé, à valider) et le double d'XP. Jamais d'argent.
- Les montants (`stakes`, `tournamentEntry`) sont regroupés dans `BINGA`, dans `server/progress/defs.js`.

## Effets spéciaux des jeux

Une icône lumineuse (planche de Yassir, `python scripts/build-fx-icons.py <planche.png>`, `assets/fx/`) apparaît 1,8 s au centre de la table sur les coups marquants. C'est **visuel seulement** : les règles des 4 jeux ne changent pas.

| Jeu | Coup (règle actuelle) | Effet |
|---|---|---|
| Hezz2 | 1 : le suivant passe son tour, sauf s'il contre avec un 1 | Restriction (cadenas) |
| Hezz2 | 2 : le suivant pioche +2 (cumulable), sauf s'il contre avec un 2 | Attaque +2 |
| Hezz2 | 7 : nouvelle famille demandée | Choix ultime |
| Ronda | Ronda annoncée et gagnée (2 cartes semblables) | Effet Ronda |
| Ronda | Tringa annoncée et gagnée (3 cartes semblables) | Effet Tringa |
| Ronda | Dernière carte du donneur, prise avec le 12 (Rey, +5) | Effet Royal |
| Ronda | Dernière carte du donneur sans rien prendre (+5 pour l'adversaire) | Effet Flop |
| Sota Ghamla | Tu pioches la Sota (le 10) : toi seul la vois | 10 secret (vu seulement par toi) |
| Kdoub | Menteur démasqué (il ramasse le tas) | Pinocchio |

La fiche « Effets spéciaux » de Yassir décrit parfois d'autres règles : le 7 qui « attaque, change le sens ou fait piocher », le 12 qui « gagne la manche directement », la Ronda qui « relance le tour ». Elles n'ont **pas** été appliquées : les règles restent celles du jeu, à changer seulement sur décision explicite de Yassir.

## Roue du jour et décor du binga

- **Roue du jour** (accueil, ou Boutique → Coffres) :
  - un tour gratuit par jour pour les comptes, jamais payant, ni en binga ni en argent ;
  - toujours un lot, tiré par le serveur (`POST /api/wheel/spin`, `crypto.randomInt`) ;
  - la roue tourne jusqu'à la case gagnante en 2,6 s.

  | Lot | Chances |
  |---|---|
  | 20 binga | 22 % |
  | 50 binga | 20 % |
  | Coffre Bronze (ouvert gratuitement) | 15 % |
  | Cosmétique Commun (un qu'on n'a pas ; tout possédé = 20 binga) | 12 % |
  | 100 binga | 12 % |
  | Coffre Argent (ouvert gratuitement) | 8 % |
  | 200 binga | 8 % |
  | Coffre Or (ouvert gratuitement) | 3 % |

  Les chances sont affichées sous la roue. Un coffre gagné suit ses propres chances et compte pour sa garantie. Pas de tour payant : un tour rapporte en moyenne plus qu'un petit prix en binga, ce qui permettrait de fabriquer des binga.
- **Décor** (illustrations de Yassir, `python scripts/build-decor.py <dossier>`, `assets/decor/`, environ 230 Ko en tout) :
  - la pièce au pique est l'icône du binga (accueil, Boutique, Profil, roue) ;
  - les jetons pique, cœur et trèfle illustrent les mises de 10, 50 et 100 dans les salons ;
  - le jeton couronne marque les tournois à entrée en binga ;
  - la scène au pique sert de fond à la roue, et le coffre rempli de pièces de bandeau aux coffres.
- Les illustrations avec des montants ou des « gemmes » (monnaies qui n'existent pas dans le jeu) ne sont pas utilisées telles quelles.

## Coffres

Les coffres s'ouvrent dans la Boutique, onglet Coffres, **seulement avec des binga gagnés en jouant**, jamais avec de l'argent réel. Chaque coffre contient **1 cosmétique**, jamais du binga seul.

| Coffre | Prix | Commun | Rare | Épique | Légendaire | Garantie |
|---|---|---|---|---|---|---|
| Bronze | 100 | 70 % | 25 % | 5 % | 0 % | aucune |
| Argent | 250 | 40 % | 40 % | 18 % | 2 % | après 10 coffres Argent sans Épique, le 11ᵉ donne un Épique (ou mieux) |
| Or | 500 | 10 % | 35 % | 40 % | 15 % | après 20 coffres Or sans Légendaire, le 21ᵉ donne un Légendaire |

- **Les probabilités sont affichées** sur chaque coffre avant l'ouverture, avec le compteur de garantie (« Plus que 3 coffres avant un Épique garanti »). Ne jamais les changer sans le dire.
- **Le tirage se fait sur le serveur** (`POST /api/chests/open`, `server/progress/chests.js`), avec le générateur aléatoire du serveur (`crypto.randomInt`). L'appli demande seulement quel coffre ouvrir, et ne choisit jamais son lot.
- **Contenu :** tous les cosmétiques sauf Champion, qui reste réservé au tournoi. Dans la rareté tirée, on reçoit d'abord un objet qu'on n'a pas encore.
- **Doublon :** seulement quand toute la rareté est déjà possédée. On reçoit alors 20 % de la valeur en binga : 20 (Commun), 50 (Rare), 100 (Épique), 200 (Légendaire, pour une valeur de 1 000).
- **Animation :** le coffre tremble pendant le tirage, s'ouvre, puis le cosmétique apparaît avec son nom et sa rareté. Cela prend environ 1,7 s, et 3 s au plus.
- **Historique :** le Profil affiche les 50 derniers coffres ouverts, avec la date, le coffre, l'objet, sa rareté et le doublon éventuel. Le journal des binga montre les dépenses et les remboursements.
- Les pages `/privacy` et `/terms` le disent : coffres ouverts avec du binga gratuit gagné en jouant, probabilités affichées, aucun argent réel en jeu.

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
- **Avatars** : 12 portraits dessinés pour le jeu (`assets/avatars/`, découpés dans une planche par `python scripts/build-avatars.py <planche.png>`), inclus dans l'appli. Sans choix, le portrait est tiré du pseudo. Profil → toucher son portrait (✏️) pour choisir parmi les 12, **avec ou sans compte** : le choix est gardé dans le compte, ou sur l'appareil pour un invité (envoyé au serveur à la connexion, donc visible des autres joueurs). Valeur stockée : 0 = tiré du pseudo, 1 à 12 = portrait choisi.
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

La musique d'ambiance du menu (`assets/music/cava.mp3`) est « Cava » de 808xri (Pixabay, licence Pixabay), compressée depuis l'original (non suivi par git, 5,3 Mo) avec le ffmpeg de `@ffmpeg-installer/ffmpeg` : `ffmpeg -i <original.mp3> -af "pan=mono|c0=0.5*c0+0.5*c1,volume=-3dB,afade=t=in:st=0:d=0.8,afade=t=out:st=161.6:d=3" -ar 32000 -codec:a libmp3lame -b:a 56k -map_metadata -1 assets/music/cava.mp3`. Les sons sont générés par `node scripts/generate-sfx.js`. Le script écrit des fichiers WAV dans `assets/sfx/`, y compris le « +2 » du Hezz2 (`plus_two.wav` : dum-tak de darbouka et deux coups de cuivres, qui remplace depuis le 17 nov 2026 l'extrait de chanson).
