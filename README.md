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
La partie se joue en 1 contre 1 ou en 2 contre 2 (coéquipiers face à face). La table est vide au départ. Chaque joueur reçoit 3, puis 3, puis 4 cartes ; en 1 contre 1, ce cycle se fait deux fois. Le premier camp à **41 points** gagne.

- **Manger** : une carte ramasse la carte de même valeur sur la table, plus la suite ascendante (1…7, 10, 11, 12).
- **Coups spéciaux** :
  - **Darba +1** : prendre la carte que l'adversaire vient de poser.
  - **Hbel +5** : 3ᵉ exemplaire joué à la suite, on reprend 3 cartes.
  - **Boug +10** : 4ᵉ exemplaire, on reprend 4 cartes.
  - **Missa +1** : vider la table, sauf à la toute dernière prise.
- **Annonces**, avant sa première carte : **Ronda +1** (une paire), **Tringa +5** (un brelan).
  - Seule l'annonce la plus forte marque, et elle prend tous les points annoncés : 6 pour une tringa contre une ronda, 10 pour une tringa contre une tringa.
  - Égalité de rondas : le camp qui mange en premier avec cette valeur laisse le point à l'autre.
- **« Il est rondé ! »** : dénoncer une ronda non annoncée. La première fois, c'est un avertissement ; ensuite, une dénonciation juste rapporte les points et une fausse coûte -1.
- **Dernière carte du donneur** :
  - il mange avec un 12 : **+5** pour son camp (*9a3a Rey*) ;
  - il mange avec un 1, ou ne mange rien : **+5** pour l'adversaire (*9a3a AS*).
- **Fin de manche** : le reste de la table va au dernier camp qui a mangé. Chaque carte au-delà de 20 vaut 1 point.

### Kdoub
Jeu de bluff pour 3 à 6 joueurs. Les 40 cartes sont distribuées. Les annonces suivent l'ordre imposé 1, 2… 7, 10, 11, 12, puis on recommence à 1.

- À ton tour, tu poses **1 à 4 cartes face cachée** en annonçant la valeur demandée. Tu peux mentir sur les cartes, jamais sur leur nombre.
- Pendant **5 secondes**, chaque adversaire peut crier **KDOUB**. Si le poseur a menti, il ramasse le tas ; sinon, c'est l'accusateur qui le ramasse. Le joueur suivant celui qui ramasse reprend la partie.
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

## Mode test (web)

Ajouter `?test=1` à l'adresse du site, par exemple `https://jebengere3.fun/?test=1`. Les parties Hezz2 contre l'ordinateur commencent alors avec des **1, 2 et 7** en main, ce qui permet de vérifier les cartes spéciales en jeu réel.

Avec `?test=big`, la main commence avec **20 cartes**, pour vérifier l'affichage de l'éventail sur un grand écran comme sur un téléphone.

## Anti-blocage

- **Hezz2** : au 1er tour manqué, la pioche est automatique et un avertissement s'affiche. À partir du 2ᵉ tour manqué d'affilée, un coup est joué automatiquement au bout de 8 s, comme le ferait un bot. Le compteur repart à zéro dès que le joueur rejoue.
- **Ronda** : une carte au hasard est jouée à la fin du chrono.
- **Kdoub** : une carte est posée au hasard à la fin du chrono, avec une limite de 40 s.
- **Sota Ghamla** : une carte est piochée au hasard à la fin du chrono.
- La fenêtre pour contrer un 1 en Hezz2 dure **5 s**.

## Premium, phase 1 : visuel et animations

- **Une table par jeu** :
  - Hezz2 : café vert, bois et cuivre ;
  - Ronda : bleu nuit ;
  - Kdoub : rouge sombre ;
  - Sota Ghamla : violet nuit.

  Le tapis est recoloré en gardant ses motifs, et le coffret de cartes reste dans ses couleurs d'origine.
- **Personnalisation** (Profil → 🎨 Style) :
  - 5 dos de cartes : Classique, Couleurs du jeu et Doré dès le départ ; Zellige débloqué au rang fchkel, Nuit étoilée au rang chdid ;
  - 3 tapis par jeu : celui par défaut, un 2ᵉ débloqué au rang Zmagri, un 3ᵉ au rang fchkel ;
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
                           # matchmaking, bots, annulation, Rejouer, abandon et forfait, mode test
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
