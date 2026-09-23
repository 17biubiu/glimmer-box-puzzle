# Glimmer Memory Box · Pet Box Puzzle

[中文](./README.md) | [English](./README.en.md) | [日本語](./README.ja.md) | [Français](./README.fr.md) | [Deutsch](./README.de.md)

A 3D box-pushing puzzle with a pet memorial theme, built with Nuxt 3 and raw Three.js. Guide your pet companion and push the glowing memory boxes into the starlit spots.

For more background and extended content, see the [paw & ever](https://www.pawandever.com/?ref=box-puzzle-readme).

## Run

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

## Controls

- Desktop: arrow keys / WASD to move, `Z` or `U` to undo (up to 4 steps)
- Mobile: swipe on the board or use the D-pad below the board
- Top HUD: steps, pushes, undo, restart, mute, tips, level select
- Buttons support Tab, Enter, and Space; dialogs trap focus, Escape closes confirm dialogs and tip cards
- Move animation is 140ms, push animation is 180ms; pets keep a stable camera-facing pose with light paw motion
- Decorative animation is reduced when the OS preference is set to reduced motion; page zoom is allowed

## Rules and Systems

- Classic box-pushing puzzle: push one box at a time, never pull; place all memory boxes on goal tiles to win
- Stars: `steps ≤ par` gives 3 stars, `≤ round(par × 1.5)` gives 2 stars, otherwise 1 star; levels without par give 3 stars on clear
- Undo history is capped at 4 steps and rolls back both board state and counters
- Progress is stored in localStorage under `glimmer-box-puzzle.v2`, with migration support for older saves
- 4 difficulty packs: Tutorial 10, Easy 40, Medium 55, Hard 50, 155 levels total
- 4 procedural pets: cat, dog, rabbit, lizard; the same models are reused on the home page, in-game, and reward views
- Each pet earns 1 to 3 food rewards on the first clear of a level depending on star rank; higher stars grant the difference only
- Audio is generated in real time with Web Audio oscillators and uses no external audio files
- Tip cards and UI text are localized through i18n and currently support Chinese, English, Japanese, French, and German

## Level Difficulty

The official curriculum still contains 155 levels, with rotational, mirrored, and equivalent-start duplicates removed.  
Difficulty score is `minimum pushes × 4 + reference solution steps + box count × 6`, and each pack is ordered upward as Starter / Advanced / Challenge.

| Pack | Reference Steps | Minimum Pushes |
| --- | --- | --- |
| Tutorial | 1-10 | 1-4 |
| Easy | 6-24 | 2-8 |
| Medium | 15-38 | 7-11 |
| Hard | 22-60 | 8-21 |

The hard pack adds 12 compact challenge stages. The solver minimizes pushes first, then walking steps among those solutions, so “reference solution steps” are not unconditional global minimum steps.

## Project Structure

```text
game/core/        Pure TypeScript game core
game/render/      Three.js rendering layer
game/audio/       Procedural Web Audio synthesis
pages/            Home / level select / play
components/       Pet preview, rewards, native dialogs, tip card, locale switcher
composables/      Save and i18n wrappers
i18n/locales/     Locale files for zh, en, ja, fr, de
public/levels/    Official level sources and preserved retired boards
scripts/          Tooling, regression tests, level curation scripts
```

## Tooling

```bash
./node_modules/.bin/esbuild scripts/box-puzzle-tools.ts --bundle --platform=node --format=esm --outfile=.tmp/tools.mjs
./node_modules/.bin/esbuild scripts/engine-check.ts --bundle --platform=node --format=esm --outfile=.tmp/check.mjs

node .tmp/tools.mjs solve
node .tmp/tools.mjs gen 100 5 8 8 3 1 6 4 9
node .tmp/check.mjs

node node_modules/esbuild/bin/esbuild scripts/curate-levels.ts --bundle --platform=node --format=esm --outfile=.tmp/curate.mjs
node .tmp/curate.mjs --enhance --write
```

Chrome is required for browser tests. `.tmp/` stores screenshots and failure artifacts and is not part of release assets.

## License

Code is released under [MIT](./LICENSE). Audio is procedural Web Audio synthesis and the pet models are procedural geometry — no third-party assets. All levels are original to this project (hand-designed or produced by the in-repo generator) except `tutorial/1.xsb`, whose board comes from David W. Skinner's Microban set (#44 'Duh!') and is used with attribution per the author's terms; see [public/levels/LICENSE-NOTE.md](./public/levels/LICENSE-NOTE.md).
