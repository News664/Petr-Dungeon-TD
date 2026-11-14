/** Rules that the fourteen scenarios do not pin down on their own. */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { apply, buildFixture, createCampaign, fixtures, nextEventHour, productionMultiplier } from '../index';
import { adv, advanceTo, cfg, deploy, must, readyIds, rejected, statueOf } from './helpers';

describe('time and events', () => {
  it('processes permanence before a retrieval at the same hour (rebuild at the deadline)', () => {
    // Two statues lie at the overrun frontier. Rebuild so that retrieval lands exactly on their deadline.
    let s = buildFixture('counteroffensive');
    const atFrontier = s.statues.filter((st) => st.locationType === 'frontier');
    const deadline = atFrontier[0]!.permanenceAtHour;
    s = must(s, { type: 'debug_set_next_invasion', hour: deadline + 500 });
    s = advanceTo(s, deadline - cfg.resources.emergency_rebuild_hours);
    s = must(s, { type: 'start_frontier_rebuild' });
    s = advanceTo(s, deadline);
    expect(s.phase).toBe('FRONTIER_BREAKTHROUGH');
    for (const st of atFrontier) {
      expect(statueOf(s, st.adventurerId)).toMatchObject({ permanent: true, retrievedAtHour: null });
    }
  });

  it('retrieves frontier statues one hour before the deadline', () => {
    let s = buildFixture('counteroffensive');
    const atFrontier = s.statues.filter((st) => st.locationType === 'frontier');
    const deadline = atFrontier[0]!.permanenceAtHour;
    s = must(s, { type: 'debug_set_next_invasion', hour: deadline + 500 });
    s = advanceTo(s, deadline - 1 - cfg.resources.emergency_rebuild_hours);
    s = must(s, { type: 'start_frontier_rebuild' });
    s = advanceTo(s, deadline + 10);
    for (const st of atFrontier) {
      expect(statueOf(s, st.adventurerId)).toMatchObject({ permanent: false, retrievedAtHour: deadline - 1 });
    }
  });

  it('turns sub-hour actions into whole hours without losing minutes', () => {
    let s = createCampaign();
    for (let i = 0; i < 11; i++) s = must(s, { type: 'advance_time', minutes: cfg.clock.dungeon_step_minutes });
    expect(s).toMatchObject({ simHour: 0, minuteCarry: 55 });
    s = must(s, { type: 'advance_time', minutes: cfg.clock.battle_action_minutes });
    expect(s).toMatchObject({ simHour: 1, minuteCarry: 5 });
  });

  it('reports the next scheduled event', () => {
    const s = createCampaign();
    expect(nextEventHour(s, cfg)).toBe(24);
    expect(nextEventHour(advanceTo(s, 150), cfg)).toBe(168);
  });

  it('never mutates the state it is given', () => {
    const s = buildFixture('stable_secured');
    const snapshot = JSON.stringify(s);
    apply(s, { type: 'advance_time', hours: 500 });
    apply(s, { type: 'debug_solidify', adventurerId: 'adv_1', locationType: 'dungeon' });
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  it('is deterministic for a given seed', () => {
    expect(buildFixture('recharging')).toEqual(buildFixture('recharging'));
    const names = (seed: number) => {
      let s = createCampaign(cfg, seed);
      for (let i = 0; i < 4; i++) s = must(s, { type: 'summon', classId: 'Medic' });
      return s.adventurers.map((a) => a.name);
    };
    expect(names(7)).toEqual(names(7));
    expect(names(7)).not.toEqual(names(8));
  });
});

describe('crisis branches', () => {
  it('goes straight to the siege when the frontier falls with no miracle', () => {
    let s = must(buildFixture('stable_secured'), { type: 'debug_set_miracle', charges: 0 });
    s = deploy(s, 'frontier', readyIds(s).slice(0, 4));
    s = must(s, { type: 'debug_force_invasion' });
    s = must(s, { type: 'resolve_battle', result: 'loss', solidified: ['adv_1'] });
    expect(s.phase).toBe('SANCTUARY_SIEGE');
    expect(s.pendingMiracle).toBeNull();
    expect(s.nextInvasionHour).toBe(s.simHour + cfg.clock.sanctuary_siege_delay_hours);
    // Survivors fell back; nobody but the actual casualty is a statue.
    expect(s.structures.filter((d) => d.map === 'frontier').every((d) => d.occupantId === null)).toBe(true);
    expect(s.statues.map((st) => st.adventurerId)).toEqual(['adv_1']);
    expect(rejected(s, { type: 'assign_defender', adventurerId: 'adv_2', structureId: 'frontier_bunker_1' })).toMatch(/overrun/);
    expect(rejected(s, { type: 'start_expedition', partyIds: ['adv_2'] })).toMatch(/overrun/);
  });

  it('revives nobody when the frontier falls without casualties', () => {
    let s = buildFixture('stable_secured');
    s = must(s, { type: 'debug_force_invasion' });
    s = must(s, { type: 'resolve_battle', result: 'loss' });
    expect(s).toMatchObject({ phase: 'DIVINE_EMERGENCY', pendingMiracle: null, miracleCharges: 0 });
  });

  it('a won rematch restores production but does not count as a stable cycle', () => {
    let s = buildFixture('divine_emergency');
    s = advanceTo(s, s.nextInvasionHour!);
    s = must(s, { type: 'resolve_battle', result: 'win' });
    expect(s).toMatchObject({ phase: 'STABLE_FRONTIER', stableCycles: 0, miracleCharges: 0 });
    expect(productionMultiplier(s, cfg)).toBe(1);
    // Holding the frontier brings the statues left there back to safety, still solidified.
    expect(s.statues.every((st) => st.retrievedAtHour !== null)).toBe(true);
    expect(s.statues.length).toBe(3);
  });

  it('sends the monsters back to the sanctuary if the frontier is never rebuilt', () => {
    let s = buildFixture('counteroffensive');
    s = advanceTo(s, s.nextInvasionHour!);
    expect(s.phase).toBe('SANCTUARY_SIEGE');
    expect(s.pendingBattle?.kind).toBe('sanctuary_siege');
    expect(s.siegeAttempts).toBe(2);
  });

  it('refuses a rebuild that cannot finish before the next attack', () => {
    let s = buildFixture('counteroffensive');
    s = advanceTo(s, s.nextInvasionHour! - 10);
    const before = { ...s.resources };
    expect(rejected(s, { type: 'start_frontier_rebuild' })).toMatch(/not enough time/);
    expect(s.resources).toEqual(before);
  });

  it('only accepts casualties who were actually deployed on that map', () => {
    let s = buildFixture('stable_secured');
    s = must(s, { type: 'debug_force_invasion' });
    expect(rejected(s, { type: 'resolve_battle', result: 'loss', solidified: ['adv_1'] })).toMatch(/not deployed/);
  });
});

describe('economy and roster', () => {
  it('cuts emergency production to the configured share', () => {
    let s = buildFixture('divine_emergency');
    const before = { ...s.resources };
    s = must(s, { type: 'advance_time', hours: 24 });
    const out = cfg.resources.cleared_stratum_normal_daily_output;
    const m = cfg.campaign.emergency_production_multiplier;
    expect(s.resources.construction_materials - before.construction_materials).toBe(Math.floor(out.construction_materials * m));
    expect(s.strata[0]!.deposits[0]!.lastStatus).toBe('producing');
  });

  it('recovers on its own after ward energy hits zero', () => {
    let s = must(buildFixture('stable_secured'), { type: 'debug_set_next_invasion', hour: 100_000 });
    s = must(s, { type: 'debug_set_resources', resources: { ward_energy: 0 } });
    s = must(s, { type: 'advance_time', hours: 24 });
    expect(s.strata[0]!.deposits[0]!.lastStatus).toBe('unpowered');
    s = must(s, { type: 'advance_time', hours: 24 * 3 });
    expect(s.strata[0]!.deposits[0]!.lastStatus).toBe('producing');
    expect(s.statues).toHaveLength(0);
  });

  it('charges for summons after the free ones and enforces the cooldown and the cap', () => {
    let s = buildFixture('full_roster');
    expect(s.seal.freeCredits).toBe(0);
    expect(rejected(s, { type: 'summon', classId: 'Medic' })).toMatch(/full/);
    // A permanent loss frees a place.
    s = must(s, { type: 'debug_set_next_invasion', hour: 100_000 });
    s = must(s, { type: 'debug_solidify', adventurerId: 'adv_1', locationType: 'dungeon' });
    s = must(s, { type: 'debug_solidify', adventurerId: 'adv_2', locationType: 'dungeon' });
    s = advanceTo(s, cfg.clock.solidification_permanence_hours);
    const before = { ...s.resources };
    s = must(s, { type: 'summon', classId: 'Medic' });
    expect(before.ward_energy - s.resources.ward_energy).toBe(cfg.roster.summon_cost.ward_energy);
    expect(rejected(s, { type: 'summon', classId: 'Medic' })).toMatch(/recharging/);
    s = must(s, { type: 'summon', classId: 'Medic', emergency: true });
    expect(s.adventurers.filter((a) => a.condition !== 'lost')).toHaveLength(cfg.roster.max_roster);
  });

  it('runs at most the configured number of treatments at once', () => {
    let s = buildFixture('frontier_breakthrough');
    const rescued = s.statues.filter((st) => st.retrievedAtHour !== null).map((st) => st.adventurerId);
    for (const id of rescued.slice(0, 3)) s = must(s, { type: 'queue_treatment', adventurerId: id });
    expect(s.treatmentJobs.filter((j) => j.startHour !== null)).toHaveLength(cfg.resources.treatment_slots);
    s = must(s, { type: 'advance_time', hours: cfg.resources.treatment_hours });
    expect(adv(s, rescued[0]!).condition).toBe('ready');
    expect(adv(s, rescued[2]!).condition).toBe('solidified');
    s = must(s, { type: 'advance_time', hours: cfg.resources.treatment_hours });
    expect(adv(s, rescued[2]!).condition).toBe('ready');
  });

  it('a rescue expedition brings a dungeon statue home; a wipe leaves everyone behind', () => {
    let s = buildFixture('full_roster');
    s = must(s, { type: 'start_expedition', partyIds: ['adv_1', 'adv_2'] });
    s = must(s, { type: 'report_casualty', adventurerId: 'adv_1' });
    s = must(s, { type: 'report_casualty', adventurerId: 'adv_2' });
    expect(s.expedition).toBeNull();
    s = must(s, { type: 'start_expedition', partyIds: ['adv_3', 'adv_4'] });
    s = must(s, { type: 'expedition_pickup_statue', adventurerId: 'adv_1' });
    expect(statueOf(s, 'adv_1')?.retrievedAtHour).toBeNull(); // not safe until they are out
    s = must(s, { type: 'advance_time', hours: 3 });
    s = must(s, { type: 'end_expedition' });
    expect(statueOf(s, 'adv_1')?.retrievedAtHour).toBe(3);
    expect(statueOf(s, 'adv_2')?.retrievedAtHour).toBeNull();
  });
});

describe('fixtures and module boundaries', () => {
  it('builds every debug fixture', () => {
    const phases = new Set(fixtures.map((f) => f.build().phase));
    expect([...phases].sort()).toEqual(
      ['COUNTEROFFENSIVE_PREPARATION', 'DIVINE_EMERGENCY', 'FRONTIER_BREAKTHROUGH', 'GAME_OVER', 'SANCTUARY_SIEGE', 'STABLE_FRONTIER'],
    );
  });

  it('keeps the simulator free of browser, clock and unseeded-random access', () => {
    const dir = join(process.cwd(), 'src/sim');
    const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));
    for (const file of files) {
      const text = readFileSync(join(dir, file), 'utf8');
      expect(text, file).not.toMatch(/Math\.random|Date\.now|new Date|\bwindow\b|\bdocument\b|localStorage|from 'react/);
    }
  });
});
