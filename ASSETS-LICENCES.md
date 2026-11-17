# Audit des droits : sons et images (avant publication sur les stores)

Audit du 16 novembre 2026, dossier `assets/`. **Rien n'a été supprimé ni remplacé** : cette liste sert à décider, avec une recommandation par fichier.

Légende :
- 🟢 **Garder** : libre ou créé pour le projet.
- 🟡 **À vérifier** : source inconnue ou licence à confirmer (retrouver la page de téléchargement, faire une capture de la licence).
- 🔴 **À remplacer avant publication** : sous droits réservés, ou très probablement.

« Utilisé » signifie que le fichier est chargé par l'appli (donc embarqué dans les builds iOS / Android et sur le site). Un fichier non utilisé n'est pas dans l'appli, mais il reste visible dans le dépôt Git.

## 🔴 À remplacer avant publication

| Fichier | Utilisé | Source probable | Pourquoi | Alternative libre proposée |
|---|---|---|---|---|
| **`FREE DYSTINCT X TIF X CHAABI TYPE BEAT - ZINA (1).mp3`** (musique d'ambiance) | Oui ([audioService.js](src/network/audioService.js), `MUSIC_SRC`) | « Type beat » gratuit publié sur YouTube par un beatmaker | Ces beats « FREE » sont en général libres **seulement pour un usage non commercial et avec crédit**. Une diffusion sur les stores demande l'accord écrit du beatmaker (ou l'achat d'une licence). Le nom de deux artistes dans le titre n'arrange rien. | Musique « moroccan », « chaabi » ou « oriental » sous licence Pixabay (pixabay.com/music, usage commercial gratuit sans crédit), ou une boucle composée pour le jeu. Sinon, obtenir une licence écrite du beatmaker. |
| **`plus_two.mp3`** (son du « +2 » en Hezz2) | Oui (`plus_two`) | Extrait de 3 s de la chanson de Khalid Aouni « Zid jouj ya moul rouge » (créé par `extract_clip.js`) | Extrait d'une chanson commerciale : droits de l'artiste et de son label, même pour 3 secondes. | Enregistrer soi-même « Zid jouj ! » (voix de Yassir ou d'un ami), ou utiliser le son synthétique `penalty.wav` déjà dans le jeu. |
| **`خالد العوني زيد جوج يا مول الروج زيد جوج.mp3`** | Non (source de `plus_two.mp3`) | Chanson complète de Khalid Aouni | Œuvre protégée, présente en entier dans le dépôt. | Retirer du dépôt (et de l'historique Git si le dépôt est public). |
| **`نوض القلاوي نوض nod al9lawi nod  Moroccan Memes Sound Effect.mp3`** | Non | Son « mème » tiré d'une vidéo | Droits de l'auteur de la vidéo inconnus. | Retirer du dépôt ; si on veut un son de ce genre, l'enregistrer soi-même. |
| **`Galleria_01.jpg` à `Galleria_04.jpg`** (anciennes faces de cartes) | **Non, plus depuis le 16 nov 2026** (remplacées par `assets/cards/`, voir plus bas) | Scans d'un jeu de cartes espagnoles imprimé ; on lit la mention d'éditeur « MAROC CARTES 61002 » sur certaines cartes | Le dessin traditionnel (modèle Fournier de 1889) est ancien, mais un scan d'un jeu imprimé reproduit le travail d'un éditeur précis, avec sa mention. Risque de réclamation, et refus possible en relecture Apple. | Jeux espagnols du domaine public ou sous licence libre sur Wikimedia Commons (catégorie « Spanish playing cards » : vérifier la licence de chaque fichier, CC0 ou domaine public de préférence), ou redessiner les cartes (SVG). |
| **`icon.png`** (ancienne icône) | Non, sauf `public/index.html` qui ne s'en sert plus pour les icônes ; **plus utilisé par l'appli depuis le 16 nov 2026** | Visuel au format Instagram 1080×1350 (probablement Canva), avec les cartes du jeu scanné | Remplacée par le logo L'Carta (voir 🟢). | Retirer du dépôt. |

## 🟡 À vérifier

| Fichier | Utilisé | Source probable | À faire |
|---|---|---|---|
| `Yellow and White Illustrative Ramadan Greeting Instagram Post.png` (fond des menus) | Oui (accueil, salon, profil, classement) | Modèle Canva (nom de modèle Canva, format Instagram) | Vérifier que le modèle et ses éléments sont « Free » (pas « Pro ») et que la licence Canva couvre un fond d'appli. Garder si c'est le cas. |
| `menthe-poivree-removebg-preview.png` (feuille de menthe des joueurs actifs) | Oui | Image trouvée en ligne, fond retiré avec remove.bg | Source inconnue : la remplacer par un petit dessin SVG ou l'emoji 🌿, ou retrouver une image libre. |

## 🟢 Garder

| Fichier | Utilisé | Source | Licence |
|---|---|---|---|
| `assets/sfx/*.wav` (25 bruitages : cartes, darba, kdoub, victoire…) | Oui | Créés par synthèse avec [scripts/generate-sfx.js](scripts/generate-sfx.js) | Création du projet : libre. |
| `alexis_gaming_cam-vinyl-stop-342938.mp3` (son « passe ton tour ») | Oui (`skip`) | Pixabay (nommage Pixabay : auteur, titre, numéro) | Licence Pixabay : usage commercial gratuit, sans crédit obligatoire. Garder la page de téléchargement en capture. |
| `universfield-very-infectious-laughter-117727.mp3` (rire) | Oui (`laugh`) | Pixabay (auteur Universfield) | Licence Pixabay, même remarque. |
| `freesound_community-080205_life-lost-game-over-89697.mp3` | Oui (`game_over`) | Pixabay, compte « freesound_community » (sons repris de Freesound) | Licence Pixabay, même remarque. |
| `freesound_community-tic-tac-27828.mp3` (tic-tac du chrono) | Oui | Pixabay, compte « freesound_community » | Licence Pixabay, même remarque. |
| `freesound_community-flipcard-91468.mp3` | Non | Pixabay | Libre ; peut être retiré du dépôt (non utilisé). |
| Avatars (images DiceBear, style « Adventurer », chargées depuis api.dicebear.com) | Oui ([PlayerAvatar.js](src/components/PlayerAvatar.js)) | Style « Adventurer » de Lisa Wischofsky, servi par DiceBear | **CC BY 4.0 : le crédit est obligatoire.** Ajouter une ligne « Avatars : Adventurer par Lisa Wischofsky (CC BY 4.0), via DiceBear » dans l'appli (par exemple sous les règles ou dans la page Conditions). |
| Table marocaine de la Ronda, fonds SVG | Oui ([MoroccanTable.js](src/components/MoroccanTable.js)) | Dessinés en code pour le projet | Création du projet. |
| Faces des 40 cartes (`assets/cards/deck_0.jpg` à `deck_3.jpg`, via [scripts/build-card-sheets.py](scripts/build-card-sheets.py)) | Oui | Générées par Yassir avec **ChatGPT, offre payante** (16 nov 2026) | Conditions d'OpenAI : les images générées appartiennent à l'utilisateur, usage commercial autorisé. Création du projet, sans scan ni mention d'éditeur. |
| 5 tables de jeu (`assets/tables/`, via [scripts/build-tables.py](scripts/build-tables.py)) | Oui | ChatGPT, offre payante (16 nov 2026) | Même licence. |
| Logo « L'CARTA » (`assets/brand/logo-source.png` → icônes, splash, `public/icons/`, logo de l'accueil, via [scripts/build-brand.py](scripts/build-brand.py)) | Oui | ChatGPT, offre payante (17 nov 2026) | Même licence. |
| Affiche Sota / Caballo / Rey à Marrakech (`assets/brand/affiche.jpg`) | Non, plus depuis le 17 nov 2026 | ChatGPT, offre payante (16 nov 2026) | Même licence ; peut être retirée du dépôt. |

## Non utilisés dans l'appli : à retirer du dépôt

Aucun de ces fichiers n'est chargé par l'appli. Ce sont des photos de produits ou des images trouvées en ligne, de source inconnue. Recommandation : les retirer du dépôt (après accord de Yassir), surtout si le dépôt est public.

| Fichier | Remarque |
|---|---|
| `DUCALE-JEU-40-CARTES-ESPAGNOLES-cartes.png` | Photo d'un jeu commercial de marque « Ducale » : 🔴 droits de l'éditeur. |
| `cartes-espagnoles-naypes-48-cartes.jpg` | Photo produit, source inconnue. |
| `espagnole-3.jpg` | Source inconnue. |
| `bajana-carte-n-7_0001-1024x381.webp` | Image d'un site web, source inconnue. |
| `Jeu_de_ronda.jpg` | Source inconnue (peut-être Wikimedia : à vérifier si on veut la garder). |
| `virtual_hand.png` | Source inconnue. |
| `adaptive-icon.png`, `splash-icon.png`, `favicon.png` | Images par défaut d'Expo (MIT), remplacées par `assets/brand/`. |
| `Galleria_01.jpg` à `Galleria_04.jpg`, `icon.png`, `table.png`, `table-bg.jpg` | Anciennes cartes scannées, ancienne icône et anciens fonds de table (source inconnue, remplacés par `assets/tables/`) : 🔴 à retirer du dépôt. |

## Avant d'envoyer aux stores

1. Remplacer la musique et `plus_two.mp3` (tableau rouge).
2. Trancher sur les 🟡 : retrouver la source ou remplacer.
3. Ajouter le crédit DiceBear / Adventurer.
4. Retirer les fichiers non utilisés et les fichiers 🔴 du dépôt.
