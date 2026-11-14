/**
 * The fourteen handoff scenarios (docs/design/handoff/acceptance_tests.json),
 * one test each, driven only through public commands.
 */
import { describe, expect, it } from 'vitest';
import { apply, applyAll, buildFixture, deserialize, productionMultiplier, serialize, treatmentCost } from '../index';
import { adv, advanceTo, cfg, deploy, must, readyIds, rejected, slots, statueOf } from './helpers';

const FAR = 100_000;

describe('handoff acceptance scenarios', () => {
  it('T01 one unified 30-day deadline, whatever the location', () => {
    let s = must(buildFixture('full_roster'), { type: 'debug_set_next_invasion', hour: FAR });
    s = advanceTo(s, 100);
    // A falls in the dungeon; B falls inside an occupied frontier bunker, at the same hour.
    s = must(s, { type: 'start_expedition', partyIds: ['adv_1', 'adv_3'] });
    s = must(s, { type: 'report_casualty', adventurerId: 'adv_1' });
    s = must(s, { type: 'assign_defender', adventurerId: 'adv_2', structureId: 'frontier_bunker_1' });
    s = must(s, { type: 'debug_solidify', adventurerId: 'adv_2', locationType: 'frontier', locationId: 'frontier_bunker_1' });
    expect(statueOf(s, 'adv_1')?.permanenceAtHour).toBe(820);
    expect(statueOf(s, 'adv_2')?.permanenceAtHour).toBe(820);

    s = advanceTo(s, 819);
    for (const id of ['adv_1', 'adv_2']) {
      expect(statueOf(s, id)?.permanent).toBe(false);
      expect(apply(s, { type: 'debug_retrieve', adventurerId: id }).ok).toBe(true);
    }

    s = advanceTo(s, 820);
    for (const id of ['adv_1', 'adv_2']) {
      expect(statueOf(s, id)?.permanent).toBe(true);
      expect(adv(s, id).condition).toBe('lost');
      expect(rejected(s, { type: 'debug_retrieve', adventurerId: id })).toMatch(/permanently/);
    }
  });

  it('T02 safe retrieval freezes exposure and fixes the treatment cost', () => {
    let s = must(buildFixture('full_roster'), { type: 'debug_set_next_invasion', hour: FAR });
    s = advanceTo(s, 100);
    s = must(s, { type: 'debug_solidify', adventurerId: 'adv_1', locationType: 'dungeon' });
    s = advanceTo(s, 700);
    s = must(s, { type: 'debug_retrieve', adventurerId: 'adv_1' });
    const costAt700 = treatmentCost(s, cfg, statueOf(s, 'adv_1')!);
    expect(costAt700).toBe(cfg.resources.treatment_base_reagents * 3); // 600 h abandoned -> third bracket

    s = advanceTo(s, 900);
    const statue = statueOf(s, 'adv_1')!;
    expect(statue.permanent).toBe(false);
    expect(adv(s, 'adv_1').condition).toBe('solidified');
    expect(treatmentCost(s, cfg, statue)).toBe(costAt700);

    const reagentBefore = s.resources.restoration_reagent;
    s = must(s, { type: 'queue_treatment', adventurerId: 'adv_1' });
    expect(reagentBefore - s.resources.restoration_reagent).toBe(costAt700);
    s = advanceTo(s, 900 + cfg.resources.treatment_hours);
    expect(adv(s, 'adv_1').condition).toBe('ready');
    expect(statueOf(s, 'adv_1')).toBeUndefined();
  });

  it('T03 the miracle fully restores half of the fallen, chosen by the player', () => {
    // The frontier map has seven slots, so seven deploy and the eighth stays in reserve.
    let s = buildFixture('stable_secured');
    expect(s.miracleCharges).toBe(1);
    const deployed = s.adventurers.slice(0, 7).map((a) => a.id);
    s = deploy(s, 'frontier', deployed);
    s = must(s, { type: 'debug_force_invasion' });
    const fallen = deployed.slice(0, 6);
    const formedAt = s.simHour;

    s = must(s, { type: 'resolve_battle', result: 'loss', solidified: fallen });
    expect(s.pendingMiracle).toEqual({ eligibleIds: fallen, count: 3 });
    expect(rejected(s, { type: 'advance_time', hours: 1 })).toMatch(/goddess/);
    expect(rejected(s, { type: 'choose_miracle_targets', adventurerIds: fallen.slice(0, 2) })).toMatch(/exactly 3/);

    const chosen = [fallen[1]!, fallen[3]!, fallen[5]!];
    s = must(s, { type: 'choose_miracle_targets', adventurerIds: chosen });
    expect(s.miracleCharges).toBe(0);
    expect(s.phase).toBe('DIVINE_EMERGENCY');
    expect(s.pendingBattle).toBeNull();
    for (const id of chosen) {
      expect(adv(s, id)).toMatchObject({ condition: 'ready', gauge: 0 });
      expect(adv(s, id).hp).toBe(adv(s, id).maxHp);
      expect(statueOf(s, id)).toBeUndefined();
    }
    for (const id of fallen.filter((f) => !chosen.includes(f))) {
      expect(statueOf(s, id)).toMatchObject({ formedAtHour: formedAt, retrievedAtHour: null, locationType: 'frontier' });
    }
    expect(adv(s, deployed[6]!).condition).toBe('ready'); // the one who escaped
    expect(productionMultiplier(s, cfg)).toBe(cfg.campaign.emergency_production_multiplier);
  });

  it('T04 a lost rematch leads to the sanctuary siege with no second miracle', () => {
    let s = buildFixture('divine_emergency');
    expect(s.miracleCharges).toBe(0);
    const ready = readyIds(s);
    s = deploy(s, 'frontier', ready);
    s = advanceTo(s, s.nextInvasionHour!);
    expect(s.pendingBattle?.kind).toBe('frontier_rematch');
    s = must(s, { type: 'resolve_battle', result: 'loss', solidified: ready.slice(0, 2) });
    expect(s.phase).toBe('SANCTUARY_SIEGE');
    expect(s.pendingMiracle).toBeNull();
    expect(adv(s, ready[0]!).condition).toBe('solidified');
    expect(productionMultiplier(s, cfg)).toBe(0);
  });

  it('T05 siege win -> rebuild -> auto-retrieval -> lost breakthrough -> siege again', () => {
    let s = buildFixture('siege_battle');
    const frontierStatues = s.statues.filter((st) => st.locationType === 'frontier').map((st) => st.adventurerId);
    expect(frontierStatues.length).toBeGreaterThan(0);
    const start = { ...s.resources };

    s = must(s, { type: 'resolve_battle', result: 'win', ammoSpent: 40 });
    expect(s.phase).toBe('COUNTEROFFENSIVE_PREPARATION');
    expect(s.nextInvasionHour).toBe(s.simHour + cfg.clock.post_sanctuary_interval_hours);
    expect(productionMultiplier(s, cfg)).toBe(0);

    s = must(s, { type: 'start_frontier_rebuild' });
    s = must(s, { type: 'advance_time', hours: cfg.resources.emergency_rebuild_hours });
    expect(s.phase).toBe('FRONTIER_BREAKTHROUGH');
    for (const id of frontierStatues) {
      expect(statueOf(s, id)?.retrievedAtHour).toBe(s.simHour); // brought back...
      expect(adv(s, id).condition).toBe('solidified'); // ...but not revived
    }

    s = must(s, { type: 'queue_treatment', adventurerId: frontierStatues[0]! });
    s = advanceTo(s, s.nextInvasionHour!);
    expect(s.pendingBattle?.kind).toBe('frontier_breakthrough');
    s = must(s, { type: 'resolve_battle', result: 'loss' });
    expect(s.phase).toBe('SANCTUARY_SIEGE');
    expect(s.resources.construction_materials).toBeLessThan(start.construction_materials);
    expect(s.resources.restoration_reagent).toBeLessThan(start.restoration_reagent);
  });

  it('T06 a won breakthrough restores production and starts the recharge at zero', () => {
    let s = buildFixture('frontier_breakthrough');
    expect(s.miracleCharges).toBe(0);
    expect(productionMultiplier(s, cfg)).toBe(0);
    s = advanceTo(s, s.nextInvasionHour!);
    s = must(s, { type: 'resolve_battle', result: 'win' });
    expect(s.phase).toBe('STABLE_FRONTIER');
    expect(productionMultiplier(s, cfg)).toBe(1);
    expect(s.stableCycles).toBe(0);
    expect(s.miracleCharges).toBe(0);
  });

  it('T07 two stable cycles recharge the miracle, and it never stacks', () => {
    let s = buildFixture('recharging');
    expect(s).toMatchObject({ phase: 'STABLE_FRONTIER', miracleCharges: 0, stableCycles: 0 });
    const win = () => {
      s = advanceTo(s, s.nextInvasionHour!);
      s = must(s, { type: 'resolve_battle', result: 'win' });
    };
    win();
    expect(s).toMatchObject({ stableCycles: 1, miracleCharges: 0 });
    win();
    expect(s).toMatchObject({ stableCycles: 2, miracleCharges: 1 });
    win();
    win();
    expect(s.miracleCharges).toBe(1);
  });

  it('T08 waiting never recharges the miracle and never skips an invasion', () => {
    let s = buildFixture('recharging');
    const due = s.nextInvasionHour!;
    s = must(s, { type: 'advance_time', hours: 24 * 60 });
    expect(s.simHour).toBe(due); // the skip stopped at the attack
    expect(s.pendingBattle?.kind).toBe('frontier_defense');
    expect(rejected(s, { type: 'advance_time', hours: 1 })).toMatch(/must be fought/);
    expect(s).toMatchObject({ miracleCharges: 0, stableCycles: 0 });
  });

  it('T09 an adventurer cannot be in the dungeon and in a tower at once', () => {
    let s = buildFixture('full_roster');
    s = must(s, { type: 'start_expedition', partyIds: ['adv_1', 'adv_2'] });
    expect(rejected(s, { type: 'assign_defender', adventurerId: 'adv_1', structureId: 'frontier_watchtower_1' })).toMatch(/expedition/);
    expect(s.structures.every((d) => d.occupantId !== 'adv_1')).toBe(true);
    expect(s.adventurers.filter((a) => a.id === 'adv_1')).toHaveLength(1);
    // And the other way round: a tower holder cannot join an expedition.
    s = must(s, { type: 'end_expedition' });
    s = must(s, { type: 'assign_defender', adventurerId: 'adv_1', structureId: 'frontier_watchtower_1' });
    expect(rejected(s, { type: 'start_expedition', partyIds: ['adv_1'] })).toMatch(/relieve/);
  });

  it('T10 defeating the boss secures the stratum and starts protected extraction', () => {
    let s = buildFixture('full_roster');
    const invasion = s.nextInvasionHour;
    const before = { ...s.resources };
    s = must(s, { type: 'defeat_boss', stratumId: 'stratum_1' });
    const stratum = s.strata[0]!;
    expect(stratum).toMatchObject({ bossDefeated: true, secured: true });
    expect(stratum.deposits[0]?.active).toBe(true);
    expect(s.frontierStratumId).toBe('stratum_2'); // the frontier moved on
    expect(s.nextInvasionHour).toBe(invasion); // one schedule, and it did not change

    s = advanceTo(s, 24);
    const r = cfg.resources;
    const sanctuaryNet = r.sanctuary_ward_energy_generation_per_day - r.sanctuary_ward_energy_upkeep_per_day;
    expect(s.resources.ward_energy - before.ward_energy).toBe(
      sanctuaryNet + r.cleared_stratum_normal_daily_output.ward_energy - r.cleared_stratum_ward_energy_upkeep_per_day,
    );
    expect(s.resources.construction_materials - before.construction_materials).toBe(r.cleared_stratum_normal_daily_output.construction_materials);

    // The old stratum never gets a battle of its own: the next attack is on the frontier map.
    s = advanceTo(s, invasion!);
    expect(s.pendingBattle).toMatchObject({ kind: 'frontier_defense', map: 'frontier' });
  });

  it('T11 a held sanctuary still leaves a paid route back to the frontier', () => {
    let s = buildFixture('counteroffensive');
    expect(readyIds(s)).toHaveLength(1);
    expect(s.statues.filter((st) => st.retrievedAtHour !== null).length).toBeGreaterThanOrEqual(3);
    const before = { ...s.resources };

    s = must(s, { type: 'start_frontier_rebuild' });
    const rescued = s.statues.filter((st) => st.retrievedAtHour !== null).map((st) => st.adventurerId);
    s = applyAll(s, rescued.map((id) => ({ type: 'queue_treatment' as const, adventurerId: id })));
    s = must(s, { type: 'summon', classId: 'Gunner', emergency: true });
    s = must(s, { type: 'advance_time', hours: cfg.resources.treatment_hours * 2 });

    expect(s.phase).toBe('FRONTIER_BREAKTHROUGH');
    expect(s.simHour).toBeLessThan(s.nextInvasionHour!);
    expect(readyIds(s).length).toBeGreaterThanOrEqual(5);
    // Nothing was free: every stock that the route uses went down.
    expect(s.resources.ward_energy).toBeLessThan(before.ward_energy);
    expect(s.resources.construction_materials).toBeLessThan(before.construction_materials);
    expect(s.resources.restoration_reagent).toBeLessThan(before.restoration_reagent);
  });

  it('T12 losing the sanctuary is game over, and an earlier save still loads', () => {
    let s = buildFixture('siege_battle');
    const save = serialize(s);
    s = must(s, { type: 'resolve_battle', result: 'loss' });
    expect(s.phase).toBe('GAME_OVER');
    expect(s.pendingMiracle).toBeNull();
    expect(rejected(s, { type: 'advance_time', hours: 1 })).toMatch(/fallen/);
    expect(rejected(s, { type: 'summon', classId: 'Medic', emergency: true })).toMatch(/fallen/);
    expect(deserialize(save).phase).toBe('SANCTUARY_SIEGE');
  });

  it('T13 shutting a site down stops output without harming the workers', () => {
    let s = buildFixture('stable_secured');
    const deposit = s.strata[0]!.deposits[0]!;
    s = must(s, { type: 'debug_set_resources', resources: { ward_energy: 0 } });
    s = must(s, { type: 'set_deposit_active', depositId: deposit.id, active: false });
    const before = { ...s.resources };
    const statues = s.statues.length;
    s = must(s, { type: 'advance_time', hours: 24 * 3 });
    const after = s.strata[0]!.deposits[0]!;
    expect(after.lastStatus).toBe('shut_down');
    expect(after.workers).toBe(deposit.workers);
    expect(s.statues.length).toBe(statues);
    expect(s.resources.construction_materials).toBe(before.construction_materials);
    expect(s.resources.restoration_reagent).toBe(before.restoration_reagent);
  });

  it('T14 save and load preserve everything exactly', () => {
    let s = must(buildFixture('divine_emergency'), { type: 'frontier_recovery_sortie' });
    const rescued = s.statues.filter((st) => st.retrievedAtHour !== null).map((st) => st.adventurerId);
    s = must(s, { type: 'start_expedition', partyIds: [readyIds(s)[0]!] });
    s = must(s, { type: 'report_casualty', adventurerId: readyIds(s)[0]! }); // an unrecovered statue
    s = must(s, { type: 'assign_defender', adventurerId: readyIds(s)[0]!, structureId: slots(s, 'frontier')[0]! });
    s = advanceTo(s, s.nextInvasionHour! - 20);
    s = must(s, { type: 'queue_treatment', adventurerId: rescued[0]! }); // still running at the save point
    s = advanceTo(s, s.nextInvasionHour! - 15);
    expect(s.statues.some((st) => st.retrievedAtHour === null)).toBe(true);
    expect(s.treatmentJobs.length).toBeGreaterThan(0);

    const loaded = deserialize(serialize(s));
    expect(loaded).toEqual(s);
    // Both copies must also evolve identically from here.
    const next = [{ type: 'advance_time' as const, hours: 15 }, { type: 'resolve_battle' as const, result: 'win' as const }];
    expect(applyAll(loaded, next)).toEqual(applyAll(s, next));
  });
});
