/** The second stratum: the Drowned Cloister. */
import { describe, expect, it } from 'vitest';
import { DIRS, applyAll, createCampaign, getStratumMap, tideState, tileAt } from '../index';
import type { CampaignState } from '../index';
import { fightOut, route } from './autoplay';
import { adv, cfg, must, rejected } from './helpers';

const MAP = getStratumMap('stratum_2')!;
const D = cfg.dungeon;
const PARTY = ['adv_1', 'adv_2', 'adv_3', 'adv_4', 'adv_6'];

/** The first stratum is secured; a strong party stands at the Cloister's entrance at the given hour of the day. */
function below(hour = 0, level = 10): CampaignState {
  let s = applyAll(createCampaign(cfg, 1), [
    ...Array.from({ length: 8 }, (_, i) => ({ type: 'summon' as const, classId: cfg.roster.classes[i % 4]! })),
    { type: 'debug_set_next_invasion', hour: 1e6 },
    { type: 'debug_set_level', level },
    { type: 'defeat_boss', stratumId: 'stratum_1' },
  ]);
  if (hour > 0) s = must(s, { type: 'advance_time', hours: hour });
  return must(s, { type: 'start_expedition', partyIds: PARTY });
}
const at = (s: CampaignState, floor: number, x: number, y: number) => must(s, { type: 'debug_teleport', floor, x, y });
const face = (s: CampaignState, dir: number) => {
  let out = s;
  while (out.expedition!.facing !== dir) out = must(out, { type: 'dungeon_move', move: 'turn_right' });
  return out;
};

describe('the Drowned Cloister', () => {
  it('is entered by default once the first stratum is secured', () => {
    const s = below();
    expect(s.frontierStratumId).toBe('stratum_2');
    expect(s.expedition).toMatchObject({ stratumId: 'stratum_2', floor: 0, x: 1, y: 1 });
    expect(s.strata.map((st) => st.id)).toEqual(['stratum_1', 'stratum_2', 'stratum_3']);
  });

  it('has three connected floors whose way onward never depends on the tide', () => {
    expect(MAP.floors).toHaveLength(3);
    for (const type of [...MAP.floors.flatMap((f) => [...f.encounters.flat(), ...f.elites.flatMap((e) => e.group)]), ...MAP.boss]) {
      expect(D.enemies[type], type).toBeDefined();
      for (const a of D.enemies[type]!.pattern) expect(D.attacks[a], a).toBeDefined();
    }
    MAP.floors.forEach((floor, index) => {
      const start = [...floor.grid.entries()].flatMap(([y, row]) => [...row].map((t, x) => [t, x, y] as const)).find(([t]) => t === (index === 0 ? 'E' : '<'))!;
      const reach = (lowTide: boolean) => {
        const seen = new Set([`${start[1]},${start[2]}`]);
        const queue: [number, number][] = [[start[1], start[2]]];
        while (queue.length) {
          const [x, y] = queue.shift()!;
          for (const [dx, dy] of DIRS) {
            const t = tileAt(floor, x + dx, y + dy);
            if (t === '#' || (t === 'w' && !lowTide) || seen.has(`${x + dx},${y + dy}`)) continue;
            seen.add(`${x + dx},${y + dy}`);
            if (t !== 'B') queue.push([x + dx, y + dy]);
          }
        }
        return seen;
      };
      const dry = reach(false);
      const low = reach(true);
      floor.grid.forEach((row, y) => [...row].forEach((t, x) => t !== '#' && expect(low.has(`${x},${y}`), `floor ${index + 1} (${x},${y})`).toBe(true)));
      const onward = [...floor.grid.entries()].flatMap(([y, row]) => [...row].map((t, x) => [t, x, y] as const)).find(([t]) => t === (index === 2 ? 'B' : '>'))!;
      expect(dry.has(`${onward[1]},${onward[2]}`), `floor ${index + 1} onward at high tide`).toBe(true);
    });
  });

  it('floods its low corridors by the clock: shut at high tide, open at low', () => {
    const tide = MAP.tide!;
    const high = at(below(0), 0, 4, 5);
    expect(tideState(high, 'stratum_2')).toEqual({ low: false, changesInHours: tide.low_start });
    expect(rejected(face(high, 1), { type: 'dungeon_move', move: 'forward' })).toMatch(/flooded. The water falls in 6 hours/);
    const longWay = route(high, 10, 1)!.length;

    const low = at(below(tide.low_start), 0, 4, 5);
    expect(tideState(low, 'stratum_2')).toEqual({ low: true, changesInHours: tide.low_hours });
    expect(route(low, 10, 1)!.length).toBeLessThan(longWay); // the drained corridor is the short way to the gathering site
    let s = must(face(low, 1), { type: 'dungeon_move', move: 'forward' });
    if (s.expedition!.combat) s = must(s, { type: 'debug_win_combat' });
    expect(s.expedition).toMatchObject({ x: 5, y: 5 });
  });

  it('keeps the gathering hall of the second floor behind the water', () => {
    expect(route(at(below(0), 1, 13, 5), 5, 5)).toBeNull();
    expect(route(at(below(MAP.tide!.low_start), 1, 13, 5), 5, 5)).toHaveLength(8);
  });

  it('has creatures a seasoned party can beat, and an elite on the cloister ring', () => {
    for (const group of MAP.floors[0]!.encounters) {
      const s = structuredClone(below());
      s.expedition!.combat = { kind: 'normal', eliteId: null, round: 0, enemies: group.map((type, i) => ({ id: i + 1, type, hp: D.enemies[type]!.hp, maxHp: D.enemies[type]!.hp, patternIndex: 0, corrode: 0, slow: 0 })), shieldWall: 0, wardMist: 0, taunt: null, log: [] };
      expect(fightOut(s).result, group.join()).toBe('won');
    }
    let s = at(below(), 1, 3, 4);
    s = must(face(s, 0), { type: 'dungeon_move', move: 'forward' });
    expect(s.expedition!.combat).toMatchObject({ kind: 'elite' });
    expect(s.expedition!.combat!.enemies[0]!.type).toBe('the_bellringer');
  });

  it('ends with the Abbess, who speaks; beating her secures the Cloister and moves the frontier on', () => {
    let s = at(below(), 2, 10, 5);
    s = must(face(s, 1), { type: 'dungeon_move', move: 'forward' });
    expect(s.expedition!.combat).toMatchObject({ kind: 'boss' });
    s = must(s, { type: 'combat_round', actions: {} });
    expect(s.expedition!.combat!.log.some((line) => line.startsWith('The Abbess of Still Water: "'))).toBe(true);
    s = must(s, { type: 'debug_win_combat' });
    expect(s.strata[1]).toMatchObject({ secured: true, bossDefeated: true });
    expect(s.frontierStratumId).toBe('stratum_3');
    expect(s.milestones).toContain('stratum_2:boss');
    expect(s.milestones).not.toContain('boss'); // the first stratum's was the debug shortcut, which grants none
    // Its recipes are its own.
    s = applyAll(s, [{ type: 'debug_teleport', floor: 0, x: 1, y: 1 }, { type: 'end_expedition' }, { type: 'debug_set_resources', resources: { ward_energy: 100, restoration_reagent: 100 } }, { type: 'craft_item', itemId: 'abbess_veil' }]);
    expect(s.armory.abbess_veil).toBe(1);
    expect(rejected(s, { type: 'craft_item', itemId: 'bellmetal_arms' })).toMatch(/does not know how/);
    // Both secured strata now produce, and both can still be entered.
    expect(must(s, { type: 'start_expedition', partyIds: PARTY, stratumId: 'stratum_1' }).expedition!.stratumId).toBe('stratum_1');
    expect(adv(s, 'adv_1').level).toBe(10);
  });
});
