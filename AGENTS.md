# Notes for coding agents

Read `docs/design/handoff/GAME_DESIGN_SPEC.md` and `docs/design/handoff/AGENTS.md` before changing game rules. The files in `docs/design/handoff/` are the original handoff: do not edit them. Decisions made since are in `docs/ASSUMPTIONS.md`; add to it whenever you pick a value or rule the spec leaves open.

## Rules of the codebase

- `src/sim` is the game. It must stay pure: no DOM, no `Date`, no `Math.random` (use `rng.ts`), no imports from `src/app`. A test enforces this.
- All state is plain JSON in `CampaignState`. Change it only through a `Command` handled in `src/sim/commands.ts`. Rule violations call `fail(...)` with a message a player can read.
- The clock moves only in `src/sim/time.ts`, one hour at a time, in a fixed event order. Do not add a second place that advances time.
- Balance numbers live in `config/balance.json` and `config/defense_maps.json`, never in code.
- Defense battles are part of the simulator (`src/sim/battle.ts`): fixed ticks, no randomness, integer state. The renderer only draws `state.battle` and sends `battle_tick`.
- Presentation (`src/app`, later the defense and dungeon views) reads state and dispatches commands. It holds no game rules.
- Every statue uses the same 30-day deadline. Do not add location- or structure-specific timers.

## Before you commit

```bash
npm run typecheck && npm test && npm run build
```

New rules need a test. The handoff scenarios T01–T14 in `src/sim/__tests__/acceptance.test.ts` must keep passing.
