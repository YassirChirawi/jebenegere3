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
| **`نوض القلاوي نوض nod al9lawi nod  Moroccan Memes Sound Effect.mp3`** | Non | Son « mème » tiré d'une vidéo | Droits de l'auteur de la vidéo inconnus. | Retirer du dépôt ; si on veut un son de ce genre, l'enregistrer soi-même. |
| **`Galleria_01.jpg` à `Galleria_04.jpg`** (anciennes faces de cartes) | **Non, plus depuis le 16 nov 2026** (remplacées par `assets/cards/`, voir plus bas) | Scans d'un jeu de cartes espagnoles imprimé ; on lit la mention d'éditeur « MAROC CARTES 61002 » sur certaines cartes | Le dessin traditionnel (modèle Fournier de 1889) est ancien, mais un scan d'un jeu imprimé reproduit le travail d'un éditeur précis, avec sa mention. Risque de réclamation, et refus possible en relecture Apple. | Jeux espagnols du domaine public ou sous licence libre sur Wikimedia Commons (catégorie « Spanish playing cards » : vérifier la licence de chaque fichier, CC0 ou domaine public de préférence), ou redessiner les cartes (SVG). |
| **`icon.png`** (ancienne icône) | Non, sauf `public/index.html` qui ne s'en sert plus pour les icônes ; **plus utilisé par l'appli depuis le 16 nov 2026** | Visuel au format Instagram 1080×1350 (probablement Canva), avec les cartes du jeu scanné | Remplacée par le logo L'Carta (voir 🟢). | Retirer du dépôt. |

## 🟡 À vérifier

| Fichier | Utilisé | Source probable | À faire |
|---|---|---|---|
| `Yellow and White Illustrative Ramadan Greeting Instagram Post.png` (fond des menus) | Oui (accueil, salon, profil, classement) | Modèle Canva (nom de modèle Canva, format Instagram) | Vérifier que le modèle et ses éléments sont « Free » (pas « Pro ») et que la licence Canva couvre un fond d'appli. Garder si c'est le cas. |

## 🟢 Garder

| Fichier | Utilisé | Source | Licence |
|---|---|---|---|
| `assets/sfx/*.wav` (32 bruitages : cartes, darba, kdoub, victoire, pièces, roue, coffre, nouveau rang, « +2 » du Hezz2…) | Oui | Créés par synthèse avec [scripts/generate-sfx.js](scripts/generate-sfx.js) | Création du projet : libre. |
| `assets/music/cava.mp3` (musique d'ambiance du menu) | Oui ([audioService.js](src/network/audioService.js), `MUSIC_SRC`) | « Afro Moroccan Style Beat x African Instrumental "Cava" » de **808xri**, Pixabay n° 354190 (fichier d'origine `808xri-afro-moroccan-style-beat-x-african-instrumental-quotcavaquot-354190.mp3`, ajouté par Yassir le 18 nov 2026) | Licence Pixabay : usage commercial gratuit, crédit non obligatoire. Garder une capture de la page de téléchargement. Compressé pour l'appli (mono, 56 kbit/s, 1,1 Mo au lieu de 5,3 Mo, même volume que l'ancienne musique, fondu de 0,8 s au début et de 3 s à la fin pour la boucle). |
| `alexis_gaming_cam-vinyl-stop-342938.mp3` (son « passe ton tour ») | Oui (`skip`) | Pixabay (nommage Pixabay : auteur, titre, numéro) | Licence Pixabay : usage commercial gratuit, sans crédit obligatoire. Garder la page de téléchargement en capture. |
| `universfield-very-infectious-laughter-117727.mp3` (rire) | Oui (`laugh`) | Pixabay (auteur Universfield) | Licence Pixabay, même remarque. |
| `freesound_community-080205_life-lost-game-over-89697.mp3` | Oui (`game_over`) | Pixabay, compte « freesound_community » (sons repris de Freesound) | Licence Pixabay, même remarque. |
| `freesound_community-tic-tac-27828.mp3` (tic-tac du chrono) | Oui | Pixabay, compte « freesound_community » | Licence Pixabay, même remarque. |
| `freesound_community-flipcard-91468.mp3` | Non | Pixabay | Libre ; peut être retiré du dépôt (non utilisé). |
| 12 avatars (`assets/avatars/avatar_00.webp` à `avatar_11.webp`, via [scripts/build-avatars.py](scripts/build-avatars.py)) | Oui ([PlayerAvatar.js](src/components/PlayerAvatar.js)) | Planche de portraits fournie par Yassir, générée avec ChatGPT, offre payante (17 nov 2026) | Même licence que les cartes. Remplacent les avatars DiceBear : plus de crédit CC BY à afficher, plus d'appel à api.dicebear.com. |
| Brin de menthe du joueur actif (`assets/menthe.png`, via [scripts/build-mint.py](scripts/build-mint.py)) | Oui | Image fournie par Yassir, générée avec ChatGPT, offre payante (17 nov 2026) | Même licence. Remplace `menthe-poivree-removebg-preview.png` (source inconnue, retirée du dépôt). |
| Table marocaine de la Ronda, fonds SVG | Oui ([MoroccanTable.js](src/components/MoroccanTable.js)) | Dessinés en code pour le projet | Création du projet. |
| Faces des 40 cartes (`assets/cards/deck_0.jpg` à `deck_3.jpg`, via [scripts/build-card-sheets.py](scripts/build-card-sheets.py)) | Oui | Générées par Yassir avec **ChatGPT, offre payante** (16 nov 2026) | Conditions d'OpenAI : les images générées appartiennent à l'utilisateur, usage commercial autorisé. Création du projet, sans scan ni mention d'éditeur. |
| 5 tables de jeu (`assets/tables/`, via [scripts/build-tables.py](scripts/build-tables.py)) | Oui | ChatGPT, offre payante (16 nov 2026) | Même licence. |
| 16 portraits de la boutique (`assets/avatars/avatar_12.webp` à `avatar_27.webp`, via [scripts/build-avatars.py](scripts/build-avatars.py)) | Oui | Planche fournie par Yassir, générée par IA (ChatGPT, offre payante, 19 nov 2026) | Même licence que les 12 premiers portraits. À confirmer par Yassir : même outil que les autres images. |
| 10 icônes d'effets spéciaux (`assets/fx/`, via [scripts/build-fx-icons.py](scripts/build-fx-icons.py)) | Oui ([SpecialFx.js](src/components/SpecialFx.js)) | Planche fournie par Yassir, générée par IA (19 nov 2026) | Même licence. À confirmer par Yassir : même outil que les autres images. |
| Décor du binga (`assets/decor/` : pièce, 5 jetons, fond de la roue, bandeau des coffres, via [scripts/build-decor.py](scripts/build-decor.py)) | Oui | Illustrations fournies par Yassir, générées par IA (19 nov 2026) | Même licence. À confirmer par Yassir : même outil que les autres images. |
| Habillage de l'accueil (`assets/ui/` : logo, arche et lanterne, cadre de lauriers, trophée, icônes des statistiques, des raccourcis et des modes, scène de Marrakech, via [scripts/build-home-ui.py](scripts/build-home-ui.py)) | Oui | Maquette de l'accueil fournie par Yassir, générée par IA (19 nov 2026) | Même licence. À confirmer par Yassir : même outil que les autres images. |
| 8 portraits premium (`assets/avatars/avatar_28.webp` à `avatar_35.webp`, via [scripts/build-avatars-premium.py](scripts/build-avatars-premium.py)) | Oui | Planches fournies par Yassir, générées par IA (19 nov 2026) ; originaux dans `assets/sources/`, hors git | Même licence. À confirmer par Yassir : même outil que les autres images. |
| 8 tables de la boutique (`assets/tables/skins/`, via [scripts/build-table-skins.py](scripts/build-table-skins.py)) | Oui | Planche fournie par Yassir, générée par IA (ChatGPT, offre payante, 19 nov 2026) | Même licence. À confirmer par Yassir : même outil que les autres images. |
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

1. Fait : musique d'ambiance remplacée (18 nov 2026) par « Cava » de 808xri (Pixabay) ; son « +2 » fait (17 nov 2026) : l'extrait de la chanson de Khalid Aouni est remplacé par un son de synthèse (`plus_two` dans [scripts/generate-sfx.js](scripts/generate-sfx.js)), et la chanson, l'extrait et `extract_clip.js` sont retirés du dépôt (ils restent dans l'historique Git).
2. Trancher sur les 🟡 : retrouver la source ou remplacer.
3. Retirer les fichiers non utilisés et les fichiers 🔴 du dépôt.
