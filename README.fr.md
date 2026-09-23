# Boîte Souvenir Étincelante · Jeu de Boîtes

[中文](./README.md) | [English](./README.en.md) | [日本語](./README.ja.md) | [Français](./README.fr.md) | [Deutsch](./README.de.md)

Petit jeu de puzzle 3D autour des boîtes et du souvenir animalier, construit avec Nuxt 3 et Three.js natif. Votre petit compagnon pousse des boîtes souvenirs lumineuses jusqu’aux cases étoilées.

Pour davantage de contexte et de contenus liés, consultez le [paw & ever](https://www.pawandever.com/?ref=box-puzzle-readme).

## Lancer le projet

```bash
npm install
npm run dev
npm run dev:clean
npm run dev -- --port 7100 --host 127.0.0.1
npm run dev:host
npm run build
npm run preview
npm test
node scripts/regression-red.mjs
npm run test:levels
npm run typecheck
npm run test:ui
```

## Contrôles

- Bureau : flèches / WASD pour bouger, `Z` ou `U` pour annuler (4 coups max)
- Mobile : glisser sur le plateau ou utiliser la croix directionnelle sous le plateau
- HUD supérieur : pas, poussées, annulation, recommencer, son, astuces, sélection des niveaux
- Les boutons fonctionnent avec Tab, Entrée et Espace ; les dialogues gardent le focus et Escape ferme les fenêtres de confirmation ou les cartes d’astuce
- Animation de déplacement : 140 ms ; poussée : 180 ms ; l’animal reste orienté vers la caméra
- Les animations décoratives sont réduites si le système active les mouvements réduits

## Règles et systèmes

- Puzzle de boîtes classique : on pousse une caisse à la fois, on ne peut jamais la tirer
- Étoiles : `pas ≤ par` donne 3★, `≤ round(par × 1.5)` donne 2★, sinon 1★
- L’historique d’annulation est limité à 4 coups
- La progression est stockée dans localStorage sous `glimmer-box-puzzle.v2`, avec migration des anciennes sauvegardes
- 4 packs de difficulté : Tutorial 10, Easy 40, Medium 55, Hard 50, soit 155 niveaux
- 4 animaux procéduraux : chat, chien, lapin, lézard
- Chaque animal gagne 1 à 3 récompenses de nourriture lors de son premier clear d’un niveau, selon le nombre d’étoiles
- L’audio est généré en temps réel via Web Audio, sans fichiers audio externes
- L’interface et les cartes de connaissance passent par i18n, avec prise en charge du chinois, de l’anglais, du japonais, du français et de l’allemand

## Progression de difficulté

Le cursus officiel contient toujours 155 niveaux, avec suppression des doublons par rotation, miroir, ou simple changement de départ.  
Le score de difficulté est calculé avec `poussées minimales × 4 + pas de la solution de référence + nombre de caisses × 6`.

| Pack | Pas de référence | Poussées minimales |
| --- | --- | --- |
| Tutorial | 1-10 | 1-4 |
| Easy | 6-24 | 2-8 |
| Medium | 15-38 | 7-11 |
| Hard | 22-60 | 8-21 |

Le pack Hard ajoute 12 défis compacts. Le solveur minimise d’abord les poussées, puis les pas parmi ces solutions.

## Structure du projet

```text
game/core/        Cœur du jeu en TypeScript pur
game/render/      Rendu Three.js
game/audio/       Audio procédural Web Audio
pages/            Accueil / sélection des niveaux / jeu
components/       Aperçu animal, récompenses, dialogues natifs, carte d’astuce, sélecteur de langue
composables/      Wrappers pour sauvegarde et i18n
i18n/locales/     Fichiers de langue zh / en / ja / fr / de
public/levels/    Sources des niveaux officiels et anciens plateaux conservés
scripts/          Outils, tests de régression, scripts de curation
```

## Outils

```bash
./node_modules/.bin/esbuild scripts/box-puzzle-tools.ts --bundle --platform=node --format=esm --outfile=.tmp/tools.mjs
./node_modules/.bin/esbuild scripts/engine-check.ts --bundle --platform=node --format=esm --outfile=.tmp/check.mjs

node .tmp/tools.mjs solve
node .tmp/tools.mjs gen 100 5 8 8 3 1 6 4 9
node .tmp/check.mjs
```

Chrome est requis pour les tests navigateur. `.tmp/` contient les captures et traces d’échec.

## Licence

Le code est publié sous [licence MIT](./LICENSE). L’audio est synthétisé procéduralement via Web Audio et les modèles d’animaux sont des géométries procédurales — aucun asset tiers. Tous les niveaux sont des créations du projet (faits main ou générés en interne), à une exception près : le plateau de `tutorial/1.xsb` provient de la collection Microban de David W. Skinner (#44 « Duh! ») et est utilisé avec attribution selon les conditions de l’auteur. Voir [public/levels/LICENSE-NOTE.md](./public/levels/LICENSE-NOTE.md).
