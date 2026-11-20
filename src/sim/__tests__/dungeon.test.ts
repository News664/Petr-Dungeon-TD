/** The labyrinth: exploration, turn-based combat, statues and rescue. */
import { describe, expect, it } from 'vitest';
import { DIRS, apply, applyAll, buildFixture, createCampaign, deserialize, elitesHere, enemyIntent, findTile, getStratumMap, productionMultiplier, serialize, tileAt } from '../index';
import type { CampaignState, CombatKind, Command, MoveKind } from '../index';
import { chooseActions, fightOut, route, stepTo, walkTo } from './autoplay';
import { adv, cfg, deploy, must, rejected, statueOf } from './helpers';

const FAR = 1_000_000;
const D = cfg.dungeon;
const MAP = getStratumMap('stratum_1')!;
const PARTY = ['adv_1', 'adv_2', 'adv_3', 'adv_4', 'adv_5']; // Guardian, Gunner, Alchemist, Medic, Guardian

/** Eight adventurers, no invasions in the way, a party of five at the entrance. */
function delve(options: { level?: number; party?: string[]; seed?: number } = {}): CampaignState {
  let s = applyAll(createCampaign(cfg, options.seed ?? 1), [
    ...Array.from({ length: 8 }, (_, i) => ({ type: 'summon' as const, classId: cfg.roster.classes[i % 4]! })),
    { type: 'debug_set_next_invasion', hour: FAR },
  ]);
  if (options.level) {
    s = structuredClone(s);
    for (const a of s.adventurers) {
      a.level = options.level;
      a.maxHp = Math.round(cfg.roster.class_stats[a.classId]!.max_hp * (1 + D.level_hp_bonus * (options.level - 1)));
      a.hp = a.maxHp;
    }
  }
  return must(s, { type: 'start_expedition', partyIds: options.party ?? PARTY });
}

/** Put the party into a chosen fight. */
function versus(state: CampaignState, group: string[], kind: CombatKind = 'normal'): CampaignState {
  const s = structuredClone(state);
  s.expedition!.combat = {
    kind,
    eliteId: null,
    round: 0,
    enemies: group.map((type, i) => ({ id: i + 1, type, hp: D.enemies[type]!.hp, maxHp: D.enemies[type]!.hp, patternIndex: 0, corrode: 0, slow: 0 })),
    shieldWall: 0,
    wardMist: 0,
    taunt: null,
    log: [],
  };
  return s;
}

const moves = (...list: MoveKind[]): Command[] => list.map((move) => ({ type: 'dungeon_move', move }));
const guardAll = (s: CampaignState) => Object.fromEntries(s.expedition!.partyIds.map((id) => [id, { type: 'guard' as const }]));

describe('labyrinth data', () => {
  it('references only known enemies, attacks and skills', () => {
    for (const [id, enemy] of Object.entries(D.enemies)) for (const a of enemy.pattern) expect(D.attacks[a], `${id}:${a}`).toBeDefined();
    for (const stats of Object.values(D.class_stats)) for (const sk of stats.skills) expect(D.skills[sk], sk).toBeDefined();
    for (const floor of MAP.floors) {
      for (const type of [...floor.encounters.flat(), ...floor.elites.flatMap((e) => e.group)]) expect(D.enemies[type], type).toBeDefined();
    }
    for (const type of MAP.boss) expect(D.enemies[type]).toBeDefined();
  });

  it('has three connected floors with stairs, two gathering sites, an elite and a boss', () => {
    expect(MAP.floors).toHaveLength(cfg.campaign.stratum_floor_count);
    expect(MAP.floors.filter((f) => findTile(f, 'G')).length).toBe(2);
    expect(MAP.floors.flatMap((f) => f.elites)).toHaveLength(1);
    expect(findTile(MAP.floors[2]!, 'B')).not.toBeNull();

    MAP.floors.forEach((floor, index) => {
      const start = findTile(floor, index === 0 ? 'E' : '<')!;
      const reach = (gatesOpen: boolean) => {
        const seen = new Set([start.join()]);
        const queue = [start];
        while (queue.length) {
          const [x, y] = queue.shift()!;
          for (const [dx, dy] of DIRS) {
            const t = tileAt(floor, x + dx, y + dy);
            // Statues are solid; gates, locks and the secret door only count as open in the "everything opened" pass.
            if ('#SHTP'.includes(t) || ('=%L'.includes(t) && !gatesOpen) || seen.has([x + dx, y + dy].join())) continue;
            seen.add([x + dx, y + dy].join());
            if (t !== 'B' && t !== 'X') queue.push([x + dx, y + dy]);
          }
        }
        return seen;
      };
      const closed = reach(false);
      const open = reach(true);
      // Nothing is walled off for good, and the way onward never depends on a shortcut.
      floor.grid.forEach((row, y) => [...row].forEach((t, x) => !'#SHTP'.includes(t) && expect(open.has([x, y].join()), `floor ${index + 1} (${x},${y})`).toBe(true)));
      const onward = findTile(floor, index === 2 ? 'B' : '>')!;
      expect(closed.has(onward.join())).toBe(true);
      for (const gate of floor.gates) {
        const [dx, dy] = DIRS['NESW'.indexOf(gate.open_from)]!;
        expect(closed.has([gate.x + dx, gate.y + dy].join()), 'gate can be reached from its opening side').toBe(true);
      }
    });
  });
});

describe('exploring', () => {
  it('moves one tile at a time, charts what it sees, and spends five minutes a step', () => {
    let s = delve();
    expect(s.expedition).toMatchObject({ floor: 0, x: 1, y: 1, facing: 1 });
    expect(rejected(s, { type: 'dungeon_move', move: 'left' })).toMatch(/wall/);
    s = applyAll(s, moves('forward', 'forward'));
    expect(s.expedition).toMatchObject({ x: 3, y: 1 });
    expect(s).toMatchObject({ simHour: 0, minuteCarry: 2 * cfg.clock.dungeon_step_minutes });
    s = applyAll(s, moves('turn_right', 'turn_right', 'turn_left'));
    expect(s.expedition!.facing).toBe(2);
    expect(s.minuteCarry).toBe(10); // turning is free
    const seen = s.dungeon.discovered['stratum_1:0']!;
    expect(seen[1]!.slice(0, 5)).toBe('11111');
    expect(seen[5]).toBe('0'.repeat(MAP.floors[0]!.grid[0]!.length));
  });

  it('opens a one-way gate only from its far side, and keeps it open', () => {
    let s = delve({ level: 6 });
    s = applyAll(s, moves('forward', 'forward'));
    expect(rejected(s, { type: 'dungeon_move', move: 'forward' })).toMatch(/barred/);
    s = walkTo(s, 5, 1); // the long way round
    s = applyAll(s, moves('turn_right', 'turn_right', 'turn_right', 'turn_right'));
    while (s.expedition!.facing !== 3) s = must(s, { type: 'dungeon_move', move: 'turn_right' });
    s = fightOut(must(s, { type: 'dungeon_move', move: 'forward' })).state;
    expect(s.dungeon.openGates).toEqual(['stratum_1:0:4,1']);
    s = walkTo(s, 1, 1);
    s = must(s, { type: 'end_expedition' });
    // A later party walks straight through.
    s = must(s, { type: 'start_expedition', partyIds: ['adv_6'] });
    expect(route(s, 5, 1)).toHaveLength(4);
  });

  it('uses stairs, remembers the deepest floor, and only leaves from a way out', () => {
    let s = delve({ level: 6 });
    expect(rejected(s, { type: 'dungeon_stairs' })).toMatch(/no stairs/);
    expect(rejected(s, { type: 'start_expedition', partyIds: ['adv_6'], floor: 1 })).toMatch(/already/);
    s = walkTo(s, 13, 9);
    expect(rejected(s, { type: 'end_expedition' })).toMatch(/entrance or from the stairs/);
    s = must(s, { type: 'dungeon_stairs' });
    expect(s.expedition).toMatchObject({ floor: 1, x: 1, y: 1 });
    expect(s.dungeon.reachedFloor.stratum_1).toBe(1);
    const hour = s.simHour;
    s = must(s, { type: 'end_expedition' }); // up the stairs and home: one hour per floor
    expect(s.expedition).toBeNull();
    expect(s.simHour).toBe(hour + D.floor_travel_hours);

    expect(rejected(s, { type: 'start_expedition', partyIds: PARTY, floor: 2 })).toMatch(/not found a way down/);
    const before = s.simHour;
    s = must(s, { type: 'start_expedition', partyIds: PARTY, floor: 1 });
    expect(s.expedition).toMatchObject({ floor: 1, x: 1, y: 1 });
    expect(s.simHour).toBe(before + D.floor_travel_hours);
    s = must(s, { type: 'dungeon_stairs' });
    expect(s.expedition).toMatchObject({ floor: 0, x: 13, y: 9 });
  });

  it('banks gathered resources only when the party gets home', () => {
    let s = delve({ level: 6 });
    s = walkTo(s, 3, 3);
    const stock = { ...s.resources };
    const carried = { ...s.expedition!.loot };
    s = must(s, { type: 'dungeon_gather' });
    const yieldHere = MAP.floors[0]!.gather_yield!;
    expect(s.expedition!.loot.construction_materials - carried.construction_materials).toBe(yieldHere.construction_materials);
    expect(s.resources).toEqual(stock);
    expect(rejected(s, { type: 'dungeon_gather' })).toMatch(/worked recently/);

    const lost = applyAll(s, s.expedition!.partyIds.map((id) => ({ type: 'report_casualty' as const, adventurerId: id })));
    expect(lost.expedition).toBeNull();
    expect(lost.resources).toEqual(stock); // a wiped party brings nothing back

    s = walkTo(s, 1, 1);
    const loot = { ...s.expedition!.loot };
    s = must(s, { type: 'end_expedition' });
    expect(s.resources.construction_materials).toBe(stock.construction_materials + loot.construction_materials);
  });

  it('fills the danger meter as the party walks until a fight breaks out', () => {
    let s = delve();
    let steps = 0;
    while (!s.expedition!.combat && steps < 200) {
      const before = s.expedition!.danger;
      s = applyAll(s, moves(steps % 2 === 0 ? 'forward' : 'back'));
      steps += 1;
      // The entrance itself is safe ground; every other step adds to the meter.
      if (!s.expedition!.combat) expect(s.expedition!.danger - before).toBeGreaterThanOrEqual(steps % 2 === 1 ? D.encounter.gain_min : 0);
    }
    expect(s.expedition!.combat).toMatchObject({ kind: 'normal', round: 0 });
    expect(s.expedition!.danger).toBe(0);
    expect(steps).toBeGreaterThanOrEqual(Math.ceil(100 / D.encounter.gain_max));
    expect(rejected(s, { type: 'dungeon_move', move: 'forward' })).toMatch(/in a fight/);
    expect(rejected(s, { type: 'end_expedition' })).toMatch(/in a fight/);
  });

  it('lets solidifying mist creep up the gauge', () => {
    let s = must(delve(), { type: 'debug_teleport', floor: 0, x: 5, y: 7 });
    while (s.expedition!.facing !== 1) s = must(s, { type: 'dungeon_move', move: 'turn_right' });
    s = must(s, { type: 'dungeon_move', move: 'forward' });
    expect(tileAt(MAP.floors[0]!, s.expedition!.x, s.expedition!.y)).toBe('~');
    for (const id of PARTY) expect(adv(s, id).gauge).toBe(D.mist_gauge);
  });

  it('recalls the party from anywhere for ward energy and time', () => {
    let s = must(delve(), { type: 'debug_teleport', floor: 2, x: 5, y: 5 });
    const before = { ward: s.resources.ward_energy, hour: s.simHour };
    s = must(s, { type: 'dungeon_recall' });
    expect(s.expedition).toBeNull();
    expect(before.ward - s.resources.ward_energy).toBe(D.recall.ward_energy);
    expect(s.simHour).toBe(before.hour + D.recall.hours);
    expect(adv(s, 'adv_1').assignment).toEqual({ type: 'idle' });
  });
});

describe('combat', () => {
  it('rejects orders an adventurer cannot carry out', () => {
    const s = versus(delve(), ['pale_crawler']);
    const order = (id: string, action: object) => rejected(s, { type: 'combat_round', actions: { [id]: action } } as Command);
    expect(order('adv_1', { type: 'skill', skillId: 'aimed_shot', target: 1 })).toMatch(/does not know/);
    expect(order('adv_2', { type: 'attack', target: 9 })).toMatch(/no such target/);
    expect(order('adv_4', { type: 'skill', skillId: 'mend', target: 'adv_8' })).toMatch(/ally in the party/);
    const drained = structuredClone(s);
    drained.adventurers[1]!.sp = 0;
    expect(rejected(drained, { type: 'combat_round', actions: { adv_2: { type: 'skill', skillId: 'aimed_shot', target: 1 } } })).toMatch(/skill points/);
  });

  it('shows what each enemy will do next, and a charge turn warns of the blow after it', () => {
    let s = versus(delve(), ['basalt_sentinel']);
    const next = () => enemyIntent(cfg, s.expedition!.combat!.enemies[0]!)!.name;
    expect(next()).toBe('Slam');
    s = must(s, { type: 'combat_round', actions: guardAll(s) });
    expect(next()).toBe('Brace');
    s = must(s, { type: 'combat_round', actions: guardAll(s) });
    expect(s.expedition!.combat!.log.join(' ')).toMatch(/braces/);
    expect(next()).toBe('Crush');
  });

  it('keeps melee off the back row while the front row stands', () => {
    let s = versus(delve({ level: 8 }), ['stone_hound', 'stone_hound', 'pale_crawler']);
    for (let i = 0; i < 4; i++) s = must(s, { type: 'combat_round', actions: guardAll(s) });
    for (const a of s.adventurers.slice(0, 5)) {
      if (a.row === 'back') expect(a.hp, a.name).toBe(a.maxHp);
    }
    expect(s.adventurers.filter((a) => a.row === 'front').some((a) => a.hp < a.maxHp)).toBe(true);
  });

  it('halves damage for a guarding adventurer, and Taunt pulls single attacks onto her', () => {
    const base = versus(delve({ party: ['adv_1'] }), ['stone_hound']);
    const open = must(base, { type: 'combat_round', actions: { adv_1: { type: 'attack', target: 1 } } });
    const guarded = must(base, { type: 'combat_round', actions: { adv_1: { type: 'guard' } } });
    const lost = (s: CampaignState) => adv(s, 'adv_1').maxHp - adv(s, 'adv_1').hp;
    const def = D.class_stats.Guardian!.def;
    expect(lost(open)).toBe(D.enemies.stone_hound!.atk - def);
    expect(lost(guarded)).toBe(Math.round(D.enemies.stone_hound!.atk * D.guard_multiplier) - def);

    let s = versus(delve({ level: 8 }), ['gazer', 'gazer']);
    s = must(s, { type: 'combat_round', actions: { ...guardAll(s), adv_1: { type: 'skill', skillId: 'taunt' } } });
    s = must(s, { type: 'combat_round', actions: guardAll(s) });
    expect(adv(s, 'adv_1').gauge).toBeGreaterThan(0);
    for (const id of PARTY.slice(1)) expect(adv(s, id).gauge).toBe(0);
    expect(adv(s, 'adv_1').sp).toBe(D.class_stats.Guardian!.max_sp - D.skills.taunt!.sp);
  });

  it('softens a party-wide blow behind a Shield Wall and slows the stone with Ward Mist', () => {
    const hit = (actions: object) => {
      let s = versus(delve({ level: 8 }), ['hollow_colossus'], 'boss');
      s = structuredClone(s);
      s.expedition!.combat!.enemies[0]!.patternIndex = 2; // Pale Breath this round
      return must(s, { type: 'combat_round', actions: actions as never });
    };
    const bare = hit({});
    const walled = hit({ adv_1: { type: 'skill', skillId: 'shield_wall' }, adv_2: { type: 'attack', target: 1 }, adv_3: { type: 'attack', target: 1 }, adv_4: { type: 'skill', skillId: 'ward_mist' }, adv_5: { type: 'attack', target: 1 } });
    // Unordered adventurers guard by default, so compare one who attacked with one who guarded.
    const gunner = (s: CampaignState) => adv(s, 'adv_2');
    const breath = D.attacks.pale_breath!;
    expect(gunner(bare).gauge).toBe(Math.round(breath.gauge! * D.guard_multiplier));
    expect(gunner(walled).gauge).toBe(Math.round(breath.gauge! * D.ward_mist_multiplier));
    const raw = D.enemies.hollow_colossus!.atk * breath.power!;
    expect(gunner(walled).maxHp - gunner(walled).hp).toBe(Math.round(raw * D.shield_wall_multiplier) - D.class_stats.Gunner!.def);
  });

  it('rewards a win with experience, levels and loot', () => {
    const group = ['stone_hound', 'stone_hound', 'stone_hound', 'stone_hound', 'stone_hound', 'gazer'];
    const s = must(versus(delve(), group), { type: 'debug_win_combat' });
    const xp = 5 * D.enemies.stone_hound!.xp + D.enemies.gazer!.xp;
    const survivor = s.adventurers.find((a) => a.condition === 'ready' && a.assignment.type === 'expedition')!;
    expect(survivor.level).toBe(2);
    expect(survivor.xp).toBe(xp - D.xp_per_level);
    expect(survivor.maxHp).toBe(Math.round(cfg.roster.class_stats[survivor.classId]!.max_hp * (1 + D.level_hp_bonus)));
    expect(s.expedition!.loot.construction_materials).toBe(10);
    expect(s.expedition!.report.join(' ')).toMatch(/Victory/);
  });

  it('turns the defeated into statues on the spot, and a rescue must go to that tile', () => {
    let s = must(delve({ party: ['adv_2', 'adv_3'] }), { type: 'debug_teleport', floor: 0, x: 3, y: 3 });
    s = versus(s, ['stone_hound', 'stone_hound', 'stone_hound']);
    while (s.expedition) s = must(s, { type: 'combat_round', actions: {} });
    for (const id of ['adv_2', 'adv_3']) {
      expect(statueOf(s, id)).toMatchObject({ locationType: 'dungeon', locationId: 'stratum_1:0:3,3', retrievedAtHour: null });
    }

    s = must(s, { type: 'start_expedition', partyIds: ['adv_1'] });
    expect(rejected(s, { type: 'expedition_pickup_statue', adventurerId: 'adv_2' })).toMatch(/not here/);
    s = must(s, { type: 'debug_teleport', floor: 0, x: 3, y: 3 });
    s = must(s, { type: 'expedition_pickup_statue', adventurerId: 'adv_2' });
    expect(rejected(s, { type: 'expedition_pickup_statue', adventurerId: 'adv_3' })).toMatch(/already carrying/); // one statue each
    s = must(s, { type: 'debug_teleport', floor: 0, x: 1, y: 1 });
    s = must(s, { type: 'end_expedition' });
    expect(statueOf(s, 'adv_2')?.retrievedAtHour).toBe(s.simHour);
    expect(statueOf(s, 'adv_3')?.retrievedAtHour).toBeNull();
  });

  it('drops carried statues where a rescue party is itself wiped out', () => {
    let s = delve({ party: ['adv_2'] });
    s = must(s, { type: 'report_casualty', adventurerId: 'adv_2' });
    s = must(s, { type: 'start_expedition', partyIds: ['adv_3'] });
    s = must(s, { type: 'expedition_pickup_statue', adventurerId: 'adv_2' });
    s = must(s, { type: 'debug_teleport', floor: 0, x: 7, y: 5 });
    s = must(s, { type: 'report_casualty', adventurerId: 'adv_3' });
    expect(s.expedition).toBeNull();
    expect(statueOf(s, 'adv_2')).toMatchObject({ locationId: 'stratum_1:0:7,5', retrievedAtHour: null });
  });

  it('allows fleeing ordinary fights but never the boss', () => {
    expect(rejected(versus(delve(), ['hollow_colossus'], 'boss'), { type: 'combat_escape' })).toMatch(/no escaping/);
    let s = versus(delve({ level: 8 }), ['pale_crawler']);
    let tries = 0;
    while (s.expedition!.combat && tries < 30) {
      s = must(s, { type: 'combat_escape' });
      tries += 1;
    }
    expect(s.expedition!.combat).toBeNull();
    expect(s.expedition!.report.join(' ')).toMatch(/got away/);
  });
});

describe('elite and boss', () => {
  it('sends the elite round its loop, one step for each step the party takes', () => {
    let s = must(delve(), { type: 'debug_teleport', floor: 1, x: 1, y: 1 });
    const where = () => elitesHere(s, s.expedition!)[0]!.pos;
    expect(where()).toEqual([3, 3]);
    s = applyAll(s, moves('forward', 'forward'));
    expect(where()).toEqual([5, 3]);
    s = applyAll(s, moves('turn_left'));
    expect(where()).toEqual([5, 3]);
  });

  it('starts an elite fight on contact, and a beaten elite stays away for a week', () => {
    let s = must(delve({ level: 9 }), { type: 'debug_teleport', floor: 1, x: 3, y: 4 });
    while (s.expedition!.facing !== 0) s = must(s, { type: 'dungeon_move', move: 'turn_right' });
    s = must(s, { type: 'dungeon_move', move: 'forward' }); // straight into it
    expect(s.expedition!.combat).toMatchObject({ kind: 'elite', eliteId: 'stratum_1:1:warden' });
    expect(s.expedition).toMatchObject({ x: 3, y: 4 });
    s = must(s, { type: 'debug_win_combat' });
    expect(elitesHere(s, s.expedition!)).toHaveLength(0);
    expect(s.dungeon.eliteRespawnHour['stratum_1:1:warden']).toBe(s.simHour + D.elite_respawn_hours);
    expect(s.expedition!.loot.ward_energy).toBe(D.enemies.warden_of_dust!.loot.ward_energy);
  });

  it('wipes an unprepared party that picks a fight with the elite', () => {
    expect(fightOut(versus(delve(), ['warden_of_dust'], 'elite')).result).toBe('wiped');
  });

  it('secures the stratum when the boss falls, and the cleared floors grow quieter', () => {
    let s = must(delve(), { type: 'debug_teleport', floor: 2, x: 9, y: 4 });
    while (s.expedition!.facing !== 0) s = must(s, { type: 'dungeon_move', move: 'turn_right' });
    s = must(s, { type: 'dungeon_move', move: 'forward' });
    expect(s.expedition!.combat?.kind).toBe('boss');
    expect(s.expedition).toMatchObject({ x: 9, y: 4 }); // the fight is at the threshold
    s = must(s, { type: 'debug_win_combat' });
    expect(s.strata[0]).toMatchObject({ bossDefeated: true, secured: true });
    expect(s.frontierStratumId).toBe('stratum_2');
    expect(productionMultiplier(s, cfg)).toBe(1);
    s = must(s, { type: 'dungeon_move', move: 'forward' });
    expect(s.expedition).toMatchObject({ x: 9, y: 3, combat: null });

    // The secured stratum can still be visited, and danger builds far more slowly there.
    s = applyAll(s, [{ type: 'debug_teleport', floor: 2, x: 1, y: 1 }, { type: 'end_expedition' }]);
    s = must(s, { type: 'start_expedition', partyIds: PARTY, stratumId: 'stratum_1' });
    expect(s.expedition!.stratumId).toBe('stratum_1');
    s = applyAll(s, moves('forward', 'forward'));
    expect(s.expedition!.danger).toBeLessThanOrEqual(2 * Math.round(D.encounter.gain_max * D.encounter.secured_multiplier));
  });

  it('can be played through: three floors, the boss, and home again', () => {
    let s = delve({ level: 10 });
    s = walkTo(s, 3, 3);
    s = must(s, { type: 'dungeon_gather' });
    s = walkTo(s, 13, 9);
    s = must(s, { type: 'dungeon_stairs' });
    s = walkTo(s, 11, 9); // the outer ring keeps clear of the elite
    s = must(s, { type: 'dungeon_stairs' });
    s = walkTo(s, 9, 4);
    s = stepTo(s, 9, 3);
    expect(s.expedition?.combat?.kind).toBe('boss');
    const fought = fightOut(s);
    expect(fought.result).toBe('won');
    s = walkTo(fought.state, 1, 1);
    s = must(s, { type: 'end_expedition' });
    expect(s.expedition).toBeNull();
    expect(s.strata[0]!.secured).toBe(true);
    expect(s.resources.construction_materials).toBeGreaterThan(cfg.resources.starting_stockpile.construction_materials);
    expect(s.adventurers.every((a) => a.assignment.type === 'idle')).toBe(true);
  });
});

describe('the labyrinth and the campaign', () => {
  it('stops for an invasion that arrives while the party is below, and resumes after it', () => {
    let s = must(delve({ level: 8 }), { type: 'debug_set_next_invasion', hour: 1 });
    // Pace the first corridor until the hour is up, fighting whatever turns up.
    for (let i = 0; i < 40 && !s.pendingBattle; i++) {
      if (s.expedition!.combat) s = fightOut(s).state;
      else s = must(s, { type: 'dungeon_move', move: s.expedition!.x === 1 ? 'forward' : 'back' });
    }
    expect(s.pendingBattle?.kind).toBe('frontier_defense');
    if (s.expedition!.combat) s = must(s, { type: 'debug_win_combat' });
    expect(rejected(s, { type: 'dungeon_move', move: 'forward' })).toMatch(/must be fought/);
    expect(rejected(s, { type: 'assign_defender', adventurerId: 'adv_1', structureId: 'frontier_bunker_1' })).toMatch(/expedition/);
    s = deploy(s, 'frontier', ['adv_6', 'adv_7', 'adv_8']);
    s = must(s, { type: 'resolve_battle', result: 'win' });
    expect(apply(s, { type: 'dungeon_move', move: 'turn_left' }).ok).toBe(true);
    expect(s.expedition).not.toBeNull();
  });

  it('calls the expedition home, with its haul, when the frontier falls for good', () => {
    let s = must(delve(), { type: 'debug_set_miracle', charges: 0 });
    s = structuredClone(s);
    s.expedition!.loot.construction_materials = 9;
    const stock = s.resources.construction_materials;
    s = applyAll(s, [{ type: 'debug_force_invasion' }, { type: 'resolve_battle', result: 'loss' }]);
    expect(s.phase).toBe('SANCTUARY_SIEGE');
    expect(s.expedition).toBeNull();
    expect(s.resources.construction_materials).toBe(stock + 9);
    expect(adv(s, 'adv_1').assignment).toEqual({ type: 'idle' });
  });

  it('restores skill points with rest, and saves and resumes a fight exactly', () => {
    let s = versus(delve(), ['stone_hound', 'gazer']);
    s = must(s, { type: 'combat_round', actions: chooseActions(s) });
    const loaded = deserialize(serialize(s));
    expect(loaded).toEqual(s);
    expect(fightOut(loaded).state).toEqual(fightOut(s).state);

    let home = fightOut(s).state;
    home = applyAll(home, [{ type: 'debug_teleport', floor: 0, x: 1, y: 1 }, { type: 'end_expedition' }]);
    const tired = adv(home, 'adv_2');
    expect(tired.sp).toBeLessThan(tired.maxSp);
    home = must(home, { type: 'advance_time', hours: 24 });
    expect(adv(home, 'adv_2').sp).toBe(Math.min(tired.maxSp, tired.sp + cfg.roster.rest_sp_per_day));
  });
});

describe('fixtures still build', () => {
  it('builds a stable campaign with the dungeon state in place', () => {
    expect(buildFixture('stable_secured').dungeon).toMatchObject({ openGates: [] });
  });
});

describe('the expanded first stratum', () => {
  const at = (s: CampaignState, floor: number, x: number, y: number) => must(s, { type: 'debug_teleport', floor, x, y });
  const face = (s: CampaignState, dir: number) => {
    let out = s;
    while (out.expedition!.facing !== dir) out = must(out, { type: 'dungeon_move', move: 'turn_right' });
    return out;
  };
  const step = (s: CampaignState, dir: number) => must(face(s, dir), { type: 'dungeon_move', move: 'forward' });

  it('floor 1: a key opens the locked store, whose cache can be taken once', () => {
    let s = at(delve({ level: 9 }), 0, 19, 7);
    expect(rejected(face(s, 2), { type: 'dungeon_move', move: 'forward' })).toMatch(/locked/);
    s = step(at(s, 0, 18, 3), 3); // onto the key
    expect(s.expedition!.report.join(' ')).toMatch(/key/);
    s = step(at(s, 0, 19, 7), 2);
    if (s.expedition!.combat) s = must(s, { type: 'debug_win_combat' });
    expect(s.expedition).toMatchObject({ x: 19, y: 8 });
    const before = s.expedition!.loot.construction_materials;
    s = step(at(s, 0, 19, 9), 3);
    if (s.expedition!.combat) s = must(s, { type: 'debug_win_combat' });
    expect(s.expedition!.loot.construction_materials - before).toBe(MAP.floors[0]!.cache!.construction_materials);
    const again = step(step(s, 1), 3);
    expect(again.expedition!.loot.construction_materials).toBe(s.expedition!.loot.construction_materials);
  });

  it('floor 2: a dust trap springs once per trip and makes noise', () => {
    let s = at(delve({ level: 9 }), 1, 9, 9);
    s = step(s, 3); // west onto the plate at (8,9)
    for (const id of PARTY) expect(adv(s, id).gauge).toBe(D.trap_gauge);
    expect(s.expedition!.danger).toBeGreaterThanOrEqual(D.trap_danger);
    if (s.expedition!.combat) s = must(s, { type: 'debug_win_combat' });
    s = step(step(s, 1), 3);
    if (s.expedition!.combat) s = must(s, { type: 'debug_win_combat' });
    for (const id of PARTY) expect(adv(s, id).gauge).toBe(D.trap_gauge);
  });

  it('floor 3: a statue holds a door open, and carrying her home shuts it for good', () => {
    let s = at(delve({ level: 9 }), 2, 7, 5);
    expect(route(s, 9, 4)).toHaveLength(3); // through the held door
    s = step(s, 1); // into the doorway
    expect(rejected(face(s, 2), { type: 'dungeon_move', move: 'forward' })).toMatch(/statue stands in the way/);
    s = must(s, { type: 'dungeon_take_statue' });
    expect(s.expedition!.exhibits).toHaveLength(1);
    s = at(s, 2, 7, 5);
    expect(rejected(face(s, 1), { type: 'dungeon_move', move: 'forward' })).toMatch(/wall/);
    expect(route(s, 9, 4)!.length).toBeGreaterThan(15); // the long way still reaches the boss
    s = must(at(s, 2, 1, 1), { type: 'end_expedition' });
    expect(s.memorialUnnamed).toBe(1);
    expect(s.resources).toEqual(buildFixture('full_roster').resources); // no reward of any kind
  });

  it('floor 3: the lone statue is bait, and behind the ambush lies the clue to the hidden way', () => {
    let s = at(delve({ level: 9 }), 2, 15, 7);
    s = step(s, 2); // onto the ambush tile
    expect(s.expedition!.combat?.enemies.map((e) => e.type)).toEqual(MAP.floors[2]!.ambush);
    s = must(s, { type: 'debug_win_combat' });
    s = step(s, 2);
    s = step(s, 3); // the clue
    expect(s.dungeon.flags).toContain('stratum_1:clue');
    s = step(s, 1);
    s = must(s, { type: 'dungeon_take_statue' }); // the bait herself can still be brought home
    // A wiped party sets the nameless back where they stood.
    const wiped = applyAll(s, s.expedition!.partyIds.map((id) => ({ type: 'report_casualty' as const, adventurerId: id })));
    expect(wiped.memorialUnnamed).toBe(0);
    expect(wiped.dungeon.flags).not.toContain('stratum_1:2:16,9');
    expect(wiped.dungeon.flags).toContain('stratum_1:clue');
  });

  it('floor 2: the wall is a wall until the clue is found; then the Keeper can be met, and she rearranges the party', () => {
    let s = at(delve({ level: 9 }), 1, 11, 7);
    expect(rejected(face(s, 1), { type: 'dungeon_move', move: 'forward' })).toMatch(/wall/);
    s = structuredClone(s);
    s.dungeon.flags.push('stratum_1:clue');
    s = step(s, 1);
    if (s.expedition!.combat) s = must(s, { type: 'debug_win_combat' });
    expect(s.expedition).toMatchObject({ x: 12, y: 7 });
    s = step(at(s, 1, 16, 5), 3);
    expect(s.expedition!.combat).toMatchObject({ kind: 'hidden' });
    expect(rejected(s, { type: 'combat_escape' })).toMatch(/no escaping/);
    const rows = PARTY.map((id) => adv(s, id).row);
    s = must(s, { type: 'combat_round', actions: guardAll(s) });
    expect(PARTY.map((id) => adv(s, id).row)).toEqual(rows.map((r) => (r === 'front' ? 'back' : 'front')));
    s = must(s, { type: 'debug_win_combat' });
    expect(s.milestones).toContain('keeper');
    expect(s.strata[0]!.secured).toBe(false); // she is not the master of the stratum
    s = step(s, 3);
    expect(s.expedition).toMatchObject({ x: 15, y: 5, combat: null });

    // What she kept from Iwanaga can now be taken home, and Sakuya has a story for it.
    s = must(s, { type: 'dungeon_take_statue' });
    s = must(at(s, 1, 1, 1), { type: 'end_expedition' });
    expect(s.stories).toEqual(['keeper_beaten', 'the_first']);
    expect(s.memorialUnnamed).toBe(0);
  });

  it('floor 2: the prized statue cannot be touched while the Keeper stands', () => {
    let s = at(delve({ level: 9 }), 1, 13, 5);
    expect(rejected(s, { type: 'dungeon_take_statue' })).toMatch(/Keeper will not let her/);
  });
});
