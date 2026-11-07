# Jeben Gere3

Jeux de cartes marocains avec le jeu espagnol de 40 cartes, à plusieurs en ligne, contre des bots ou entre amis dans un salon privé.

Le projet contient l'application Expo / React Native (Android, iOS et web) et un serveur Node + Socket.io. Le serveur décide seul des coups, des captures et des scores.

| Jeu | Joueurs | État |
|---|---|---|
| **Hezz2** | 2 à 4 | ✅ jouable |
| **Ronda** | 1 contre 1, 2 contre 2 | ✅ jouable (phase 1) |
| **Kdoub** | 3 à 6 | 🔜 phase 2 |
| **Sota Ghamla** | 4 à 6 | 🔜 phase 3 |

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
  - **B'achra +10** : 4ᵉ exemplaire, on reprend 4 cartes.
  - **Missa +1** : vider la table, sauf à la toute dernière prise.
- **Annonces**, avant sa première carte : **Ronda +1** (une paire), **Tringa +5** (un brelan).
  - Seule l'annonce la plus forte marque, et elle prend tous les points annoncés : 6 pour une tringa contre une ronda, 10 pour une tringa contre une tringa.
  - Égalité de rondas : le camp qui mange en premier avec cette valeur laisse le point à l'autre.
- **« Il est rondé ! »** : dénoncer une ronda non annoncée. La première fois, c'est un avertissement ; ensuite, une dénonciation juste rapporte les points et une fausse coûte -1.
- **Dernière carte du donneur** :
  - il mange avec un 12 : **+5** pour son camp (*9a3a Rey*) ;
  - il mange avec un 1, ou ne mange rien : **+5** pour l'adversaire (*9a3a AS*).
- **Fin de manche** : le reste de la table va au dernier camp qui a mangé. Chaque carte au-delà de 20 vaut 1 point.

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

## Tests

```bash
cd server
npm test                   # tests unitaires des moteurs (sans interface)
```

## Architecture

```
server/
  server.js              rooms, matchmaking par jeu, timer, bots, chat, réactions
  engines/common.js      deck espagnol 40 cartes, mélange, ordre des valeurs
  engines/hezz2.js       adaptateur du moteur Hezz2 (GameEngine.js) et de son IA
  engines/ronda.js       moteur Ronda (règles, annonces, dénonciation, bots, vue masquée)
  engines/index.js       registre : room.gameType → moteur
  tests/                 tests node:test
src/
  games.js               catalogue des jeux côté client
  screens/               Home (sélecteur de jeu), Lobby, Game (Hezz2), Ronda, Profile
  components/            cartes, sièges, table, chat et réactions communs, bannières, fins de manche
  network/               socket et audio (sons synthétisés : scripts/generate-sfx.js)
```

Chaque moteur expose la même interface : `init`, `apply(state, joueur, action)`, `timerFor`, `onTimeout`, `botActions`, et en option `viewFor`, qui masque les mains adverses pour chaque joueur. Ajouter un jeu revient à écrire un moteur et à l'enregistrer dans `engines/index.js`.

Les sons sont générés par `node scripts/generate-sfx.js`. Le script écrit des fichiers WAV dans `assets/sfx/`.
