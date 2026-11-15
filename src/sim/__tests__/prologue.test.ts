/** The opening: five summons from the goddess, then the first defense of the sanctuary. */
import { describe, expect, it } from 'vitest';
import { applyAll, createCampaign, waveForecast } from '../index';
import type { CampaignState, Command } from '../index';
import { cfg, must, rejected } from './helpers';

const CLASSES = ['Guardian', 'Gunner', 'Alchemist', 'Medic', 'Gunner'];
const fresh = () => createCampaign(cfg, 1, { prologue: true });
const summoned = () => applyAll(fresh(), CLASSES.map((classId) => ({ type: 'summon' as const, classId })));
const WHOLE: Command = { type: 'battle_tick', ticks: cfg.defense.ticks_per_second * 600 };

/** Call the five, post four of them on the walls and start the tutorial battle. */
function atTheWalls(): CampaignState {
  let s = must(summoned(), { type: 'prologue_begin_defense' });
  const posts: [string, string][] = [
    ['sanctuary_bunker_1', 'adv_1'],
    ['sanctuary_watchtower_1', 'adv_2'],
    ['sanctuary_watchtower_2', 'adv_3'],
    ['sanctuary_support_station_1', 'adv_4'],
  ];
  s = must(s, { type: 'battle_start' });
  s = applyAll(s, posts.map(([structureId, adventurerId]) => ({ type: 'assign_defender' as const, adventurerId, structureId })));
  expect(s.battle).toMatchObject({ deploying: true, tick: 0, busyUntil: {} }); // posting during deployment is free
  expect(rejected(s, WHOLE)).toMatch(/taking up positions/);
  return applyAll(s, [{ type: 'set_target_priority', adventurerId: 'adv_2', priority: 'petrifier' }, { type: 'battle_begin' }]);
}

describe('prologue', () => {
  it('starts with empty stores, five sponsored summons and the clock held still', () => {
    const s = fresh();
    expect(s).toMatchObject({ phase: 'PROLOGUE', nextInvasionHour: null, simHour: 0 });
    expect(s.resources).toEqual({ ward_energy: 0, construction_materials: 0, restoration_reagent: 0 });
    expect(s.seal.freeCredits).toBe(cfg.roster.starter_free_summons);
    expect(rejected(s, { type: 'advance_time', hours: 1 })).toMatch(/holds the hour still/);
    expect(rejected(s, { type: 'prologue_begin_defense' })).toMatch(/Call all 5 champions first/);
    expect(rejected(s, { type: 'summon', classId: 'Medic', emergency: true })).toMatch(/no more than these few/);
  });

  it('allows exactly the five, and nothing outside the walls', () => {
    const s = summoned();
    expect(s.adventurers).toHaveLength(5);
    expect(rejected(s, { type: 'summon', classId: 'Medic' })).toMatch(/no more than these few/);
    expect(rejected(s, { type: 'start_expedition', partyIds: ['adv_1'] })).toMatch(/holds the hour still/);
    // The frontier is bare ground and out of reach until the sanctuary is safe.
    expect(s.structures.filter((d) => d.map === 'frontier')).toHaveLength(0);
    expect(rejected(s, { type: 'build_structure', map: 'frontier', site: 's1', structureType: 'watchtower' })).toMatch(/overrun/);
  });

  it('uses a short, gentle wave script for the first defense', () => {
    const tutorial = waveForecast('sanctuary', 'tutorial_defense');
    const siege = waveForecast('sanctuary', 'sanctuary_siege');
    const count = (waves: typeof tutorial) => waves.flatMap((w) => w.groups).reduce((n, g) => n + g.count, 0);
    expect(tutorial.length).toBeLessThan(siege.length);
    expect(count(tutorial)).toBeLessThan(count(siege) / 2);
    // Every enemy type is introduced once.
    expect(new Set(tutorial.flatMap((w) => w.groups.map((g) => g.enemy)))).toEqual(new Set(['runner', 'armored', 'petrifier']));
  });

  it('ends in a stable frontier with the starter stockpile once the first defense is won', () => {
    let s = must(atTheWalls(), WHOLE);
    expect(s.battle).toMatchObject({ kind: 'tutorial_defense', outcome: 'win', ammoSpent: 0 });
    expect(s.sanctuary.automatedAmmo).toBe(cfg.defense.sanctuary_initial_automated_ammo); // the goddess fed the weapons
    s = must(s, { type: 'battle_finish' });
    expect(s).toMatchObject({ phase: 'STABLE_FRONTIER', battle: null, pendingBattle: null, simHour: 0 });
    expect(s.nextInvasionHour).toBe(cfg.clock.invasion_interval_hours);
    expect(s.resources).toEqual(cfg.resources.starting_stockpile);
    expect(s.seal.freeCredits).toBe(cfg.roster.bonus_early_summon_credits);
    expect(s.statues).toHaveLength(0);
    expect(s.adventurers.every((a) => a.condition === 'ready' && a.hp === a.maxHp && a.gauge === 0 && a.assignment.type === 'idle')).toBe(true);
    expect(s.structures.every((d) => d.hp === d.maxHp && d.occupantId === null)).toBe(true);
    expect(must(s, { type: 'advance_time', hours: 1 }).simHour).toBe(1);
  });

  it('cannot be lost for good: the goddess turns the hour back and nobody stays stone', () => {
    let s = must(summoned(), { type: 'prologue_begin_defense' });
    s = applyAll(s, [{ type: 'battle_start' }, { type: 'assign_defender', adventurerId: 'adv_4', structureId: 'sanctuary_watchtower_1' }, { type: 'battle_begin' }]);
    s = applyAll(s, [
      { type: 'battle_tick', ticks: 60 },
      { type: 'debug_solidify', adventurerId: 'adv_4', locationType: 'sanctuary' },
      { type: 'battle_concede' },
    ]);
    expect(s.statues).toHaveLength(1);
    s = must(s, { type: 'battle_finish' });
    expect(s.phase).toBe('PROLOGUE');
    expect(s.pendingBattle).toMatchObject({ kind: 'tutorial_defense' });
    expect(s.statues).toHaveLength(0);
    expect(s.adventurers.every((a) => a.condition === 'ready' && a.gauge === 0)).toBe(true);
    expect(must(s, { type: 'battle_start' }).battle).toMatchObject({ deploying: true, gateHp: cfg.defense.sanctuary_gate_max_hp });
  });

  it('can be skipped for debugging', () => {
    const s = must(fresh(), { type: 'debug_skip_prologue' });
    expect(s).toMatchObject({ phase: 'STABLE_FRONTIER', nextInvasionHour: cfg.clock.invasion_interval_hours });
    expect(s.adventurers).toHaveLength(cfg.roster.starter_free_summons);
    expect(s.resources).toEqual(cfg.resources.starting_stockpile);
  });
});
