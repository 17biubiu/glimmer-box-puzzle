# Leuchtende Erinnerungsbox · Haustier-Boxrätsel

[中文](./README.md) | [English](./README.en.md) | [日本語](./README.ja.md) | [Français](./README.fr.md) | [Deutsch](./README.de.md)

Ein kleines 3D-Boxrätsel mit Haustier-Erinnerungsthema, gebaut mit Nuxt 3 und nativen Three.js APIs. Gemeinsam mit einem Haustier schiebst du leuchtende Erinnerungsboxen auf Sternfelder.

Mehr Hintergrund und weitere Inhalte findest du auf der [paw & ever](https://www.pawandever.com/?ref=box-puzzle-readme).

## Starten

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

## Steuerung

- Desktop: Pfeiltasten / WASD zum Bewegen, `Z` oder `U` zum Rückgängig machen (maximal 4 Schritte)
- Mobil: auf dem Brett wischen oder das Steuerkreuz unter dem Brett nutzen
- Oberes HUD: Schritte, Schübe, Rückgängig, Neustart, Ton, Tipps, Levelauswahl
- Buttons unterstützen Tab, Enter und Leertaste; Dialoge halten den Fokus, Escape schließt Bestätigungen und Tippkarten
- Bewegung dauert 140 ms, Schieben 180 ms; das Haustier bleibt stabil zur Kamera ausgerichtet
- Bei reduzierter Bewegung im System werden Zieranimationen reduziert

## Regeln und Systeme

- Klassisches Boxrätsel: immer nur eine Box schieben, niemals ziehen
- Sterne: `Schritte ≤ par` gibt 3★, `≤ round(par × 1.5)` gibt 2★, sonst 1★
- Die Rückgängig-Historie ist auf 4 Schritte begrenzt
- Der Fortschritt liegt in localStorage unter `glimmer-box-puzzle.v2`, mit Migration älterer Spielstände
- 4 Schwierigkeits-Pakete: Tutorial 10, Easy 40, Medium 55, Hard 50, insgesamt 155 Level
- 4 prozedurale Haustiere: Katze, Hund, Kaninchen, Eidechse
- Jedes Haustier erhält beim ersten Abschluss eines Levels 1 bis 3 Futterbelohnungen je nach Sternwertung
- Audio wird in Echtzeit mit Web Audio erzeugt und nutzt keine externen Audiodateien
- Oberfläche und Wissenskarten laufen über i18n und unterstützen Chinesisch, Englisch, Japanisch, Französisch und Deutsch

## Schwierigkeitskurve

Der offizielle Kurs umfasst weiterhin 155 Level. Rotationen, Spiegelungen und äquivalente Startpositionen wurden entfernt.  
Der Schwierigkeitswert ist `minimale Schübe × 4 + Referenzschritte + Boxanzahl × 6`.

| Paket | Referenzschritte | Minimale Schübe |
| --- | --- | --- |
| Tutorial | 1-10 | 1-4 |
| Easy | 6-24 | 2-8 |
| Medium | 15-38 | 7-11 |
| Hard | 22-60 | 8-21 |

Im Hard-Paket gibt es zusätzlich 12 kompakte Challenge-Level. Der Solver minimiert zuerst die Schübe und danach die Laufwege innerhalb dieser Lösungen.

## Projektstruktur

```text
game/core/        Reiner TypeScript-Spielkern
game/render/      Three.js-Rendering
game/audio/       Prozedurales Web-Audio
pages/            Start / Levelauswahl / Spielseite
components/       Haustier-Vorschau, Belohnungen, native Dialoge, Wissenskarte, Sprachumschalter
composables/      Wrapper für Save und i18n
i18n/locales/     Sprachdateien für zh / en / ja / fr / de
public/levels/    Offizielle Levelquellen und aufbewahrte alte Bretter
scripts/          Tools, Regressionstests, Curation-Skripte
```

## Werkzeuge

```bash
./node_modules/.bin/esbuild scripts/box-puzzle-tools.ts --bundle --platform=node --format=esm --outfile=.tmp/tools.mjs
./node_modules/.bin/esbuild scripts/engine-check.ts --bundle --platform=node --format=esm --outfile=.tmp/check.mjs

node .tmp/tools.mjs solve
node .tmp/tools.mjs gen 100 5 8 8 3 1 6 4 9
node .tmp/check.mjs
```

Für Browsertests wird Chrome benötigt. `.tmp/` enthält Screenshots und Fehlerartefakte.

## Lizenz

Der Code steht unter [MIT](./LICENSE). Audio wird prozedural per Web Audio erzeugt, die Haustiermodelle sind prozedurale Geometrie — keine Drittanbieter-Assets. Alle Level sind Eigenmaterial des Projekts (handgebaut oder mit dem hauseigenen Generator erstellt), mit einer Ausnahme: das Board von `tutorial/1.xsb` stammt aus David W. Skinners Microban-Sammlung (#44 'Duh!') und wird mit Namensnennung gemäß den Bedingungen des Autors verwendet. Details: [public/levels/LICENSE-NOTE.md](./public/levels/LICENSE-NOTE.md).
