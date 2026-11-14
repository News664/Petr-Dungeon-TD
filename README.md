# The Last Sanctuary

Prototype of a hardcore first-person grid dungeon RPG combined with adventurer-slotted tower defense and a small survival economy. Working title; the full design is in [`docs/design/handoff/GAME_DESIGN_SPEC.md`](docs/design/handoff/GAME_DESIGN_SPEC.md).

## Status

| Milestone | What | State |
|---|---|---|
| M0 | Campaign state machine, economy, roster, statues, miracle, crisis loops, save/load, debug console | Done |
| M1 | Tower defense layer (frontier and sanctuary maps) | Not started |
| M2 | First-person dungeon, turn-based party combat, statue rescue | Not started |
| M3 | Tutorial, integration, balance | Not started |

Until M1 and M2 exist, battles and expeditions are resolved by hand in the campaign console: you record who fell and whether the defense held.

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
- **Planned**: PixiJS for the defense maps and character art display, Three.js for the dungeon view. They are added when M1 and M2 start.
- **Tests**: Vitest. Browser checks with Playwright.

## Layout

```
config/balance.json        Editable balance values (the live copy)
docs/design/handoff/       The original design handoff, unchanged
docs/ASSUMPTIONS.md        Prototype decisions and open design questions
docs/ART_PIPELINE.md       How character art is organised (proposal)
src/sim/                   Campaign simulator and its tests
src/art/                   Art manifest: which picture shows at which solidification stage
src/app/                   Campaign console (debug-grade interface)
```

## Balance and debug

Edit `config/balance.json` and reload. The console's Debug panel can jump to every campaign phase, force an attack, edit stocks, toggle the miracle and solidify an adventurer. The handoff's fourteen acceptance scenarios are in `src/sim/__tests__/acceptance.test.ts`.
