# The Last Sanctuary — Coding Agent Entry Point

Read `GAME_DESIGN_SPEC.md` in full before implementing. It is the authoritative, self-contained game/prototype specification. Do not assume knowledge of Etrian Odyssey, GemCraft, Factorio, or Frostpunk; their relevant mechanics are explained inside.

Read `prototype_config.json` for **illustrative starting balance values** and `acceptance_tests.json` for deterministic scenarios. Values in config are not all canon: the specification marks confirmed rules versus tunable or unresolved parameters.

## Priority
1. First build a headless/deterministic campaign state machine and economic simulation (time, production, roster, statues, 30-day timer, miracle, invasions, sanctuary/counteroffensive loops).
2. Implement a small playable frontier tower-defense layer: character-in-structure combat and enemy attacks against exposed defenders.
3. Implement grid-based first-person dungeon movement, 5-character turn-based combat, exploration discovery and physical statue recovery.
4. Integrate one three-floor stratum, two defense maps, guild management, tutorial, and end-to-end playability.

## Guardrails
- No full Factorio factory or conveyors in this prototype; cleared strata unlock abstract automated extraction and ward upkeep.
- No real-time idle progression. The in-game clock advances via actions; UI planning pauses the clock.
- All solidified adventurers share **one** 30-day abandoned-statue deadline, with **no structure-specific exceptions**. Exposure ends upon safe recovery. Defensive structures do not protect statues after the area is overrun.
- The goddess's first-defeat miracle **fully revives** approximately half of fallen defenders, not merely teleports their statues.
- Successful sanctuary siege buys time but does **not** restore resource production; a frontier counteroffensive victory does.
- Miracle recharges only after **two successful stable invasion cycles** with full operational production, and stores at most one charge.
- No gem creation/fusion, no direct copy of another game's characters/art/UI/maps. Mechanics are genre inspirations only.
- If a rule is underspecified, make it data-driven, choose a sensible prototype value, log the assumption, and ensure the gameplay can still be completed.

## What to deliver
A runnable prototype, instructions to run it, editable balance configuration, automated state-machine tests, debug/fast-forward controls for every crisis state, and a concise list of remaining design questions.
