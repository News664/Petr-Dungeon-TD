# The Last Sanctuary

Prototype of a hardcore first-person grid dungeon RPG combined with adventurer-slotted tower defense and a small survival economy. Working title; the full design is in [`docs/design/handoff/GAME_DESIGN_SPEC.md`](docs/design/handoff/GAME_DESIGN_SPEC.md).

## Status

| Milestone | What | State |
|---|---|---|
| M0 | Campaign state machine, economy, roster, statues, miracle, crisis loops, save/load, debug console | Done |
| M1 | Tower defense layer (frontier and sanctuary maps) | Playable, placeholder art |
| M2 | First-person dungeon, turn-based party combat, statue rescue | Playable, placeholder art |
| M3 | Tutorial, integration, balance | Prologue, tutorial defense, guild advisor and autosave done; balance by hand play and real art still open |
| M4 | Growth and fortification | Skill trees, equipment, supplies and field menu, buildable defenses, temporary emergency summons; art briefs and lore draft |
| M5 | Cast and first-stratum expansion | Twenty-four original champions with traits; larger floors with keys, traps, exhibits, a baited room and a hidden boss; rebalanced |

The slice is playable from start to finish: prologue and first defense, the three-floor labyrinth, weekly attacks, the boss, protected extraction, and the crisis loops after a lost frontier. A scripted player finishes it in tests.

Playtest build: https://news664.github.io/Petr-Dungeon-TD/ (deployed by the `Deploy playtest build` workflow; needs GitHub Pages enabled with source "GitHub Actions").

## Run it

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

`npm run build` type-checks and produces a static site in `dist/`.

## Stack

- **TypeScript** throughout.
- **Simulation core** (`src/sim`): plain TypeScript with no browser, clock or unseeded-random access. State is plain JSON; every change goes through `apply(state, command)`.
- **Interface** (`src/app`): React and plain CSS built on design tokens in `src/app/styles.css`.
- **Defense battles** (`src/app/BattleScreen.tsx`): PixiJS draws the map; the rules run in the simulation core at a fixed 30 ticks per second.
- **Labyrinth** (`src/app/DungeonScreen.tsx`): Three.js draws the first-person view; movement, encounters and turn-based combat run in the simulation core.
- **Tests**: Vitest. Browser checks with Playwright.

## Layout

```
config/balance.json        Editable balance values (the live copy)
config/defense_maps.json   Defense map layouts and wave scripts
config/dungeon_maps.json   Labyrinth floors, gates, elites and encounter tables
docs/design/handoff/       The original design handoff, unchanged
docs/ASSUMPTIONS.md        Prototype decisions and open design questions
docs/ART_PIPELINE.md       How character art is organised and how to add it
graphics/                  Art requirements: style guide, briefs, and a list of every picture needed
lore/                      World and character draft, with open questions
public/art/                Delivered pictures (the game scans this folder when built)
scripts/                   Art tooling: manifest generation and the delivery check
src/sim/                   Campaign simulator and its tests
src/art/                   Art manifest: which picture shows at which solidification stage
src/app/                   Campaign console (debug-grade interface)
```

## Art: working with an image-generation agent

The pictures are made outside this codebase, by an image tool or an artist working from the briefs in `graphics/`.

- **What to make:** `graphics/asset_list.json` lists every picture with its size, delivery path and a prompt. `graphics/AGENT_GUIDE.md` is the instruction sheet for an agent; `graphics/STYLE_GUIDE.md` and `graphics/briefs/` give the direction.
- **Where it goes:** `public/art/`, at the exact path in the list. An agent with write access opens a pull request that adds only picture files there. Without write access, upload the files through GitHub's "Add file → Upload files".
- **No data to edit:** the game builds its picture list from the files present each time it is built (`npm run art:manifest`, run automatically before `dev` and `build`).
- **Checking:** `npm run art:check` reports progress and any picture with the wrong size, name or an incomplete character set. It runs in CI.
- **What shows up today:** character portraits everywhere an adventurer appears (her own set, else her class's set), monsters in labyrinth fights, Sakuya in the prologue, Iwanaga on the game-over screen, and the title background. Labyrinth textures, battle-map pieces and icons have delivery paths but are not drawn yet.

```bash
npm run art:check
```

## Balance and debug

Edit the files in `config/` and reload. The "Debug tools" section in the guild view can jump to every campaign phase, force an attack, edit stocks, toggle the miracle and solidify an adventurer. The labyrinth screen has its own debug controls (reveal the maps, jump between floors, win a fight).

Controls in the labyrinth: W A S D to move, Q and E or the arrow keys to turn. The handoff's fourteen acceptance scenarios are in `src/sim/__tests__/acceptance.test.ts`.
