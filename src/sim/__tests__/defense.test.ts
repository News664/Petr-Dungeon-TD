/** The tower-defense layer: fixed-tick battles played headlessly. */
import { describe, expect, it } from 'vitest';
import { apply, applyAll, buildFixture, defenderWeapon, deserialize, flatGroups, getDefenseMap, serialize } from '../index';
import type { CampaignState, Command, TargetPriority } from '../index';
import { adv, cfg, must, rejected, statueOf } from './helpers';

const TPS = cfg.defense.ticks_per_second;
const WHOLE_BATTLE: Command = { type: 'battle_tick', ticks: TPS * 600 };

const SENSIBLE = {
  watchtower_1: 'Gunner',
  watchtower_2: 'Gunner',
  watchtower_3: 'Alchemist',
  bunker_1: 'Guardian',
  bunker_2: 'Guardian',
  support_station_1: 'Medic',
  support_station_2: 'Medic',
};

/** Post one idle adventurer of the given class in each named slot. */
function post(state: CampaignState, map: 'frontier' | 'sanctuary', posts: Record<string, string>, priority: TargetPriority = 'first') {
  let s = state;
  for (const [slot, classId] of Object.entries(posts)) {
    const a = s.adventurers.find((x) => x.classId === classId && x.condition === 'ready' && x.assignment.type === 'idle');
    if (!a) throw new Error(`No idle ${classId}`);
    s = applyAll(s, [
      { type: 'assign_defender', adventurerId: a.id, structureId: `${map}_${slot}` },
      { type: 'set_target_priority', adventurerId: a.id, priority },
    ]);
  }
  return s;
}

function frontierBattle(posts: Record<string, string>, priority: TargetPriority = 'first') {
  const s = post(buildFixture('stable_secured'), 'frontier', posts, priority);
  return applyAll(s, [{ type: 'debug_force_invasion' }, { type: 'battle_start' }, { type: 'battle_begin' }]);
}

function siegeBattle(posts: Record<string, string>) {
  const s = post(buildFixture('sanctuary_siege'), 'sanctuary', posts, 'petrifier');
  return applyAll(s, [{ type: 'advance_time', hours: cfg.clock.sanctuary_siege_delay_hours }, { type: 'battle_start' }, { type: 'battle_begin' }]);
}

describe('map data', () => {
  it('gives every structure a position and every wave a known enemy and lane', () => {
    const s = buildFixture('new_game');
    for (const mapId of ['frontier', 'sanctuary'] as const) {
      const map = getDefenseMap(mapId);
      const ids = s.structures.filter((d) => d.map === mapId).map((d) => d.id);
      expect(Object.keys(map.slots).sort()).toEqual([...ids].sort());
      for (const { group } of flatGroups(mapId)) {
        expect(cfg.defense.enemy_stats[group.enemy], group.enemy).toBeDefined();
        expect(map.lanes[group.lane]).toBeDefined();
      }
    }
    expect(getDefenseMap('sanctuary').turrets.length).toBeGreaterThan(0);
    expect(getDefenseMap('frontier').turrets).toHaveLength(0);
  });

  it('lets the structure change how the same adventurer fights', () => {
    const s = buildFixture('full_roster');
    const gunner = s.adventurers.find((a) => a.classId === 'Gunner')!;
    const tower = defenderWeapon(cfg, gunner, s.structures.find((d) => d.type === 'watchtower')!)!;
    const bunker = defenderWeapon(cfg, gunner, s.structures.find((d) => d.type === 'bunker')!)!;
    expect(tower.range).toBeGreaterThan(bunker.range);
    expect(tower.damage).toBeGreaterThan(bunker.damage);
  });
});

describe('frontier battles', () => {
  it('holds with a well-posted garrison that hunts petrifiers first', () => {
    const s = must(frontierBattle(SENSIBLE, 'petrifier'), WHOLE_BATTLE);
    expect(s.battle).toMatchObject({ outcome: 'win', fallen: [] });
    expect(s.battle!.gateHp).toBeGreaterThan(cfg.defense.frontier_gate_max_hp / 2);
  });

  it('holds but loses a defender when the same garrison ignores the petrifiers', () => {
    const s = must(frontierBattle(SENSIBLE, 'first'), WHOLE_BATTLE);
    expect(s.battle!.outcome).toBe('win');
    expect(s.battle!.fallen.length).toBeGreaterThan(0);
  });

  it('falls with too few defenders, and with a careless posting', () => {
    const thin = must(frontierBattle({ watchtower_2: 'Gunner', watchtower_3: 'Alchemist', bunker_1: 'Guardian' }), WHOLE_BATTLE);
    expect(thin.battle!.outcome).toBe('loss');
    const careless = must(
      frontierBattle({ ...SENSIBLE, watchtower_1: 'Medic', watchtower_2: 'Medic', watchtower_3: 'Guardian', bunker_1: 'Gunner', bunker_2: 'Gunner', support_station_1: 'Alchemist', support_station_2: 'Alchemist' }),
      WHOLE_BATTLE,
    );
    expect(careless.battle!.outcome).toBe('loss');
  });

  it('falls when nobody defends, without solidifying anyone', () => {
    const s = must(frontierBattle({}), WHOLE_BATTLE);
    expect(s.battle).toMatchObject({ outcome: 'loss', gateHp: 0, killed: 0, fallen: [] });
    expect(s.statues).toHaveLength(0);
  });

  it('solidifies a defender the moment her gauge fills, where she stands', () => {
    let s = frontierBattle({ watchtower_1: 'Medic' });
    const medic = s.adventurers.find((a) => a.assignment.type === 'defense')!;
    while (s.battle!.outcome === 'ongoing' && s.battle!.fallen.length === 0) s = must(s, { type: 'battle_tick', ticks: 10 });
    expect(s.battle!.fallen).toEqual([medic.id]);
    expect(adv(s, medic.id)).toMatchObject({ condition: 'solidified', gauge: 100 });
    expect(statueOf(s, medic.id)).toMatchObject({ locationType: 'frontier', locationId: 'frontier_watchtower_1', formedAtHour: s.simHour });
    expect(s.structures.find((d) => d.id === 'frontier_watchtower_1')!.occupantId).toBeNull(); // the post goes silent
  });

  it('protects a bunker occupant far better than a watchtower occupant', () => {
    // Watchtower 3 is out of the brutes' reach, so only the petrifiers decide her fate there.
    const exposed = must(frontierBattle({ watchtower_3: 'Guardian' }), WHOLE_BATTLE);
    const sheltered = must(frontierBattle({ bunker_2: 'Guardian' }), WHOLE_BATTLE);
    const guardian = (s: CampaignState) => s.adventurers.find((a) => a.classId === 'Guardian')!;
    expect(guardian(sheltered).condition).toBe('ready');
    expect(guardian(sheltered).gauge).toBeGreaterThan(0);
    expect(guardian(exposed).gauge).toBeGreaterThanOrEqual(guardian(sheltered).gauge * 4);
  });

  it('has brutes stop to batter a manned structure, a few blows each, and leave empty ones alone', () => {
    let s = frontierBattle({ support_station_1: 'Medic' });
    const ram = cfg.defense.enemy_stats.armored!.structure_attack!;
    const station = () => s.structures.find((d) => d.id === 'frontier_support_station_1')!;
    const brutes = () => s.battle!.enemies.filter((e) => e.type === 'armored');
    while (s.battle!.outcome === 'ongoing' && !brutes().some((e) => e.siegeTarget)) s = must(s, { type: 'battle_tick', ticks: 5 });
    const brute = brutes().find((e) => e.siegeTarget)!;
    expect(brute.siegeTarget).toBe('frontier_support_station_1');
    expect(station().hp).toBe(station().maxHp); // it winds up first: no damage on arrival
    const stoppedAt = brute.progress;
    s = must(s, { type: 'battle_tick', ticks: Math.round(ram.cooldown_seconds * TPS) + 1 });
    const same = brutes().find((e) => e.id === brute.id)!;
    expect(same.progress).toBe(stoppedAt); // halted while it batters
    expect(station().hp).toBe(station().maxHp - ram.damage);
    s = must(s, WHOLE_BATTLE);
    // Nothing was manned elsewhere, so nothing else was touched.
    expect(s.structures.filter((d) => d.map === 'frontier' && d.id !== station().id).every((d) => d.hp === d.maxHp)).toBe(true);
  });

  it('lets armored enemies wreck a structure and drive its occupant out unharmed', () => {
    const weakened = structuredClone(frontierBattle({ bunker_1: 'Guardian' }));
    weakened.structures.find((d) => d.id === 'frontier_bunker_1')!.hp = 3;
    let s: CampaignState = weakened;
    const guardian = s.adventurers.find((a) => a.assignment.type === 'defense')!;
    const bunker = () => s.structures.find((d) => d.id === 'frontier_bunker_1')!;
    while (s.battle!.outcome === 'ongoing' && bunker().hp > 0) s = must(s, { type: 'battle_tick', ticks: 10 });
    expect(bunker()).toMatchObject({ hp: 0, occupantId: null });
    expect(adv(s, guardian.id)).toMatchObject({ condition: 'ready', assignment: { type: 'idle' } });
    expect(rejected(s, { type: 'assign_defender', adventurerId: guardian.id, structureId: 'frontier_bunker_1' })).toMatch(/destroyed/);
    expect(rejected(s, { type: 'repair_structure', structureId: 'frontier_bunker_1' })).toMatch(/battle is over/);

    // Damage persists after the battle until it is paid for.
    s = applyAll(s, [WHOLE_BATTLE, { type: 'battle_finish' }]);
    expect(bunker().hp).toBe(0);
    const materials = s.resources.construction_materials;
    s = must(s, { type: 'repair_structure', structureId: 'frontier_bunker_1' });
    expect(bunker().hp).toBe(bunker().maxHp);
    expect(materials - s.resources.construction_materials).toBe((bunker().maxHp / 10) * cfg.defense.repair_materials_per_10_hp);
    expect(rejected(s, { type: 'repair_structure', structureId: 'frontier_bunker_1' })).toMatch(/not damaged/);
  });

  it('makes a repositioned defender wait before she can act', () => {
    let s = frontierBattle({ watchtower_3: 'Gunner' });
    const gunner = s.adventurers.find((a) => a.assignment.type === 'defense')!;
    s = must(s, { type: 'assign_defender', adventurerId: gunner.id, structureId: 'frontier_watchtower_1' });
    const wait = cfg.defense.reposition_seconds * TPS;
    expect(s.battle!.busyUntil[gunner.id]).toBe(wait);
    // The first runners are in reach of that tower well before she is ready: nothing dies until then.
    s = must(s, { type: 'battle_tick', ticks: wait - 1 });
    expect(s.battle!.killed).toBe(0);
    expect(s.battle!.enemies.length).toBeGreaterThan(0);
    expect(s.battle!.enemies.every((e) => e.hp === e.maxHp)).toBe(true);
    s = must(s, { type: 'battle_tick', ticks: TPS * 4 });
    expect(s.battle!.enemies.some((e) => e.hp < e.maxHp) || s.battle!.killed > 0).toBe(true);
  });

  it('conceding is a loss with no further casualties', () => {
    let s = frontierBattle(SENSIBLE);
    s = must(s, { type: 'battle_tick', ticks: TPS * 5 });
    s = must(s, { type: 'battle_concede' });
    expect(s.battle).toMatchObject({ outcome: 'loss', fallen: [] });
    s = must(s, { type: 'battle_finish' });
    expect(s.phase).toBe('DIVINE_EMERGENCY');
    expect(s.pendingMiracle).toBeNull();
    expect(s.statues).toHaveLength(0);
  });
});

describe('battles and the campaign', () => {
  it('feeds a fought win into the campaign and brings the fallen home as statues', () => {
    let s = must(frontierBattle(SENSIBLE, 'first'), WHOLE_BATTLE);
    const fallen = s.battle!.fallen;
    expect(rejected(s, { type: 'advance_time', hours: 1 })).toMatch(/must be fought/);
    s = must(s, { type: 'battle_finish' });
    expect(s).toMatchObject({ phase: 'STABLE_FRONTIER', battle: null, pendingBattle: null });
    expect(s.nextInvasionHour).toBe(s.simHour + cfg.clock.invasion_interval_hours);
    for (const id of fallen) expect(statueOf(s, id)).toMatchObject({ retrievedAtHour: s.simHour, permanent: false });
  });

  it('offers the miracle for defenders who fell in a fought loss', () => {
    let s = frontierBattle({ watchtower_1: 'Medic', watchtower_2: 'Medic', watchtower_3: 'Alchemist' });
    s = applyAll(s, [WHOLE_BATTLE]);
    const fallen = s.battle!.fallen;
    expect(s.battle!.outcome).toBe('loss');
    expect(fallen.length).toBeGreaterThanOrEqual(2);
    s = must(s, { type: 'battle_finish' });
    expect(s.phase).toBe('DIVINE_EMERGENCY');
    expect(s.pendingMiracle).toEqual({ eligibleIds: fallen, count: Math.ceil(fallen.length / 2) });
  });

  it('cannot be finished early, started twice, or started with no attack', () => {
    const s = frontierBattle(SENSIBLE);
    expect(rejected(s, { type: 'battle_finish' })).toMatch(/not over/);
    expect(rejected(s, { type: 'battle_start' })).toMatch(/already/);
    expect(rejected(buildFixture('stable_secured'), { type: 'battle_start' })).toMatch(/no attack/);
  });

  it('is deterministic, and a mid-battle save resumes identically', () => {
    const a = must(frontierBattle(SENSIBLE), WHOLE_BATTLE);
    const b = must(frontierBattle(SENSIBLE), WHOLE_BATTLE);
    expect(a).toEqual(b);

    // Same battle in uneven chunks with a save and reload in the middle.
    let c = frontierBattle(SENSIBLE);
    for (const n of [1, 7, 333, 2]) c = must(c, { type: 'battle_tick', ticks: n });
    c = deserialize(serialize(c));
    c = must(c, WHOLE_BATTLE);
    const strip = (s: CampaignState) => ({ ...s, battle: { ...s.battle!, shots: [] } });
    expect(strip(c)).toEqual(strip(a));
  });

  it('rest at the sanctuary eases gauge and wounds day by day', () => {
    const s = applyAll(frontierBattle({ bunker_1: 'Guardian' }), [WHOLE_BATTLE, { type: 'battle_finish' }]);
    const before = s.adventurers.find((a) => a.classId === 'Guardian')!;
    expect(before.gauge).toBeGreaterThan(0);
    const later = must(s, { type: 'advance_time', hours: 24 });
    const after = adv(later, before.id);
    expect(after.gauge).toBe(Math.max(0, before.gauge - cfg.roster.rest_gauge_per_day));
  });
});

describe('sanctuary siege', () => {
  it('cannot be held by the automated weapons alone', () => {
    const s = must(siegeBattle({}), WHOLE_BATTLE);
    expect(s.battle!.outcome).toBe('loss');
    expect(s.sanctuary.automatedAmmo).toBe(0);
    expect(must(s, { type: 'battle_finish' }).phase).toBe('GAME_OVER');
  });

  it('can be held by a few adventurers behind the walls, at a cost in ammunition', () => {
    let s = siegeBattle({ watchtower_1: 'Gunner', watchtower_2: 'Alchemist', bunker_1: 'Guardian' });
    const ammoBefore = s.sanctuary.automatedAmmo;
    s = must(s, WHOLE_BATTLE);
    expect(s.battle!.outcome).toBe('win');
    expect(s.battle!.ammoSpent).toBeGreaterThan(20);
    expect(s.sanctuary.automatedAmmo).toBe(ammoBefore - s.battle!.ammoSpent);
    s = must(s, { type: 'battle_finish' });
    expect(s.phase).toBe('COUNTEROFFENSIVE_PREPARATION');

    // Ammunition does not come back by itself; it is bought with materials.
    const materials = s.resources.construction_materials;
    const ammo = s.sanctuary.automatedAmmo;
    s = must(s, { type: 'restock_ammo' });
    expect(s.sanctuary.automatedAmmo).toBe(Math.min(cfg.defense.sanctuary_max_automated_ammo, ammo + cfg.defense.ammo_restock.ammo));
    expect(materials - s.resources.construction_materials).toBe(cfg.defense.ammo_restock.construction_materials);
  });

  it('silences the automated weapons when the magazines are empty', () => {
    const start = applyAll(post(buildFixture('sanctuary_siege'), 'sanctuary', {}), [
      { type: 'advance_time', hours: cfg.clock.sanctuary_siege_delay_hours },
    ]);
    const drained = structuredClone(start);
    drained.sanctuary.automatedAmmo = 0;
    const s = applyAll(drained, [{ type: 'battle_start' }, { type: 'battle_begin' }, WHOLE_BATTLE]);
    expect(s.battle).toMatchObject({ outcome: 'loss', killed: 0, ammoSpent: 0 });
    expect(apply(s, { type: 'restock_ammo' }).ok).toBe(false); // not during a battle
  });
});
