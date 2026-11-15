/** Whole-campaign runs by a scripted guild master, from the prologue to the boss and beyond. */
import { describe, expect, it } from 'vitest';
import { applyAll, buildFixture, rosterCount } from '../index';
import { playSlice } from './director';
import { cfg, must, rejected } from './helpers';

describe('playing the slice through', () => {
  it('lets a careful player secure the first stratum within six weeks, with nobody lost', () => {
    for (const seed of [1, 6, 7]) {
      const run = playSlice(seed);
      const s = run.state;
      expect(s.phase, `seed ${seed}`).toBe('STABLE_FRONTIER');
      expect(run.bossDay, `seed ${seed}`).not.toBeNull();
      expect(run.bossDay!).toBeLessThanOrEqual(42);
      expect(run.bossDay!).toBeGreaterThan(7); // not before the first attack: it takes real preparation
      expect(run.lost).toBe(0);
      expect(s.miracleCharges).toBe(1);
      // Two weeks of production after the boss leave the stores well above where they started.
      expect(s.strata[0]).toMatchObject({ secured: true });
      expect(s.resources.construction_materials).toBeGreaterThan(cfg.resources.starting_stockpile.construction_materials);
      expect(s.resources.ward_energy).toBeGreaterThan(cfg.resources.starting_stockpile.ward_energy);
    }
  });

  it('punishes a reckless attempt on the boss, but leaves a paid way back', () => {
    // This player walks into the boss a level too early. On this seed the party is wiped at its door.
    const run = playSlice(1, 90, 4);
    expect(run.journal.some((line) => /statues 5/.test(line))).toBe(true);
    const s = run.state;
    expect(s.phase).toBe('STABLE_FRONTIER');
    expect(run.bossDay).not.toBeNull();
    // Getting back cost emergency summons, paid from the stores.
    expect(s.adventurers.length).toBeGreaterThan(cfg.roster.max_roster);
    expect(run.lost).toBe(0);
  });
});

describe('the guild hall', () => {
  it('counts fighters and statues in the ward, not champions still lying out there', () => {
    let s = must(buildFixture('full_roster'), { type: 'debug_set_next_invasion', hour: 1e6 });
    expect(rosterCount(s)).toBe(cfg.roster.max_roster);
    expect(rejected(s, { type: 'summon', classId: 'Medic', emergency: true })).toMatch(/full/);
    // One falls in the labyrinth: her bed is free while she lies there.
    s = must(s, { type: 'debug_solidify', adventurerId: 'adv_1', locationType: 'dungeon' });
    expect(rosterCount(s)).toBe(cfg.roster.max_roster - 1);
    s = must(s, { type: 'summon', classId: 'Guardian', emergency: true });
    expect(rejected(s, { type: 'summon', classId: 'Medic', emergency: true })).toMatch(/full/);
    // Bringing her home is never refused, even though the hall is then over capacity.
    s = must(s, { type: 'debug_retrieve', adventurerId: 'adv_1' });
    expect(rosterCount(s)).toBe(cfg.roster.max_roster + 1);
    s = applyAll(s, [{ type: 'queue_treatment', adventurerId: 'adv_1' }, { type: 'advance_time', hours: cfg.resources.treatment_hours }]);
    expect(s.adventurers.filter((a) => a.condition === 'ready')).toHaveLength(cfg.roster.max_roster + 1);
  });

  it('stands the defenders down after a battle and offers them their old posts next time', () => {
    let s = buildFixture('frontier_battle');
    const posted = s.structures.filter((d) => d.map === 'frontier' && d.occupantId).map((d) => [d.occupantId!, d.id] as const);
    s = applyAll(s, [{ type: 'battle_start' }, { type: 'battle_begin' }, { type: 'battle_concede' }, { type: 'battle_finish' }]);
    expect(s.structures.every((d) => d.occupantId === null)).toBe(true);
    expect(s.adventurers.every((a) => a.assignment.type === 'idle')).toBe(true);
    for (const [id, post] of posted) expect(s.adventurers.find((a) => a.id === id)!.lastPost).toBe(post);

    s = applyAll(s, [{ type: 'debug_force_invasion' }, { type: 'battle_start' }, { type: 'battle_repost' }]);
    for (const [id, post] of posted) expect(s.structures.find((d) => d.id === post)!.occupantId).toBe(id);
    expect(s.battle!.busyUntil).toEqual({});
    expect(rejected(must(s, { type: 'battle_begin' }), { type: 'battle_repost' })).toMatch(/already begun/);
  });
});
