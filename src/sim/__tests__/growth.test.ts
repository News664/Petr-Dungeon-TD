/** Skill trees, equipment, supplies and the field menu, and choosing where defenses stand. */
import { describe, expect, it } from 'vitest';
import { applyAll, buildFixture, buildsLeft, createCampaign, getDefenseMap, statsOf } from '../index';
import type { CampaignState } from '../index';
import { adv, cfg, must, rejected } from './helpers';

const D = cfg.dungeon;
const guild = () => must(buildFixture('full_roster'), { type: 'debug_set_next_invasion', hour: 1e6 });
const rich = (s: CampaignState) => must(s, { type: 'debug_set_resources', resources: { ward_energy: 500, construction_materials: 500, restoration_reagent: 500 } });

describe('skill trees', () => {
  it('starts everyone with her class skills at rank 1 and one point to spend', () => {
    const s = guild();
    for (const a of s.adventurers) {
      expect(a.skills).toEqual(Object.fromEntries(D.class_stats[a.classId]!.skills.map((id) => [id, 1])));
      expect(a.skillPoints).toBe(D.starting_skill_points);
      for (const id of D.class_stats[a.classId]!.tree) expect(D.skills[id], id).toBeDefined();
    }
  });

  it('spends points on ranks and passives, within the tree, the level gate and the rank cap', () => {
    let s = guild();
    const before = statsOf(cfg, adv(s, 'adv_1')); // a Guardian
    expect(rejected(s, { type: 'learn_skill', adventurerId: 'adv_1', skillId: 'aimed_shot' })).toMatch(/cannot learn/);
    expect(rejected(s, { type: 'learn_skill', adventurerId: 'adv_1', skillId: 'wall_warden' })).toMatch(/needs level 3/);
    s = must(s, { type: 'learn_skill', adventurerId: 'adv_1', skillId: 'bulwark' });
    expect(statsOf(cfg, adv(s, 'adv_1')).def).toBe(before.def + 2);
    expect(rejected(s, { type: 'learn_skill', adventurerId: 'adv_1', skillId: 'bulwark' })).toMatch(/no skill points/);

    s = must(s, { type: 'debug_set_level', level: 8 });
    expect(adv(s, 'adv_1').skillPoints).toBe(7 * D.skill_points_per_level);
    s = applyAll(s, [1, 2].map(() => ({ type: 'learn_skill' as const, adventurerId: 'adv_1', skillId: 'bulwark' })));
    expect(rejected(s, { type: 'learn_skill', adventurerId: 'adv_1', skillId: 'bulwark' })).toMatch(/highest rank/);
    s = must(s, { type: 'learn_skill', adventurerId: 'adv_1', skillId: 'wall_warden' });
    expect(statsOf(cfg, adv(s, 'adv_1')).tdDamage).toBeCloseTo((1 + 7 * cfg.defense.level_damage_bonus) * 1.15);
  });

  it('makes a higher rank hit harder and a trained Medic heal more', () => {
    const fight = (learn: boolean) => {
      let s = must(guild(), { type: 'debug_set_level', level: 3 });
      if (learn) s = must(s, { type: 'learn_skill', adventurerId: 'adv_2', skillId: 'aimed_shot' });
      s = must(s, { type: 'start_expedition', partyIds: ['adv_2'] });
      s = structuredClone(s);
      s.expedition!.combat = { kind: 'normal', eliteId: null, round: 0, enemies: [{ id: 1, type: 'basalt_sentinel', hp: 130, maxHp: 130, patternIndex: 1, corrode: 0, slow: 0 }], shieldWall: 0, wardMist: 0, taunt: null, log: [] };
      s = must(s, { type: 'combat_round', actions: { adv_2: { type: 'skill', skillId: 'aimed_shot', target: 1 } } });
      return 130 - s.expedition!.combat!.enemies[0]!.hp;
    };
    const atk = statsOf(cfg, adv(must(guild(), { type: 'debug_set_level', level: 3 }), 'adv_2')).atk;
    expect(fight(false)).toBe(Math.round(atk * 2));
    expect(fight(true)).toBe(Math.round(atk * 2 * (1 + D.rank_bonus)));

    let s = must(guild(), { type: 'learn_skill', adventurerId: 'adv_4', skillId: 'field_surgeon' });
    s = must(s, { type: 'start_expedition', partyIds: ['adv_1', 'adv_4'] });
    s = structuredClone(s);
    s.adventurers[0]!.hp = 10;
    s = must(s, { type: 'field_use_skill', adventurerId: 'adv_4', skillId: 'mend', target: 'adv_1' });
    expect(adv(s, 'adv_1').hp).toBe(10 + Math.round(45 * 1.15));
    expect(adv(s, 'adv_4').sp).toBe(D.class_stats.Medic!.max_sp - D.skills.mend!.sp);
    expect(s.minuteCarry).toBe(D.field_action_minutes);
    expect(rejected(s, { type: 'field_use_skill', adventurerId: 'adv_4', skillId: 'ward_mist', target: 'adv_1' })).toMatch(/only be used in a fight/);
  });
});

describe('equipment', () => {
  it('is made from resources once its recipe is found, and changes what she can do', () => {
    let s = rich(guild());
    expect(rejected(s, { type: 'craft_item', itemId: 'galleries_steel' })).toMatch(/does not know how/);
    const before = { stock: s.resources.construction_materials, stats: statsOf(cfg, adv(s, 'adv_1')) };
    s = applyAll(s, [
      { type: 'craft_item', itemId: 'iron_arms' },
      { type: 'craft_item', itemId: 'padded_coat' },
      { type: 'equip_item', adventurerId: 'adv_1', itemId: 'iron_arms' },
      { type: 'equip_item', adventurerId: 'adv_1', itemId: 'padded_coat' },
    ]);
    expect(before.stock - s.resources.construction_materials).toBe(20);
    const now = statsOf(cfg, adv(s, 'adv_1'));
    expect(now).toMatchObject({ atk: before.stats.atk + 3, def: before.stats.def + 2, maxHp: before.stats.maxHp + 10 });
    expect(adv(s, 'adv_1')).toMatchObject({ maxHp: now.maxHp, hp: now.maxHp });
    expect(s.armory).toMatchObject({ iron_arms: 0, padded_coat: 0 });
    expect(rejected(s, { type: 'equip_item', adventurerId: 'adv_2', itemId: 'iron_arms' })).toMatch(/no Iron Arms in the armory/);
    s = must(s, { type: 'unequip_item', adventurerId: 'adv_1', slot: 'armor' });
    expect(adv(s, 'adv_1').maxHp).toBe(before.stats.maxHp);
    expect(s.armory.padded_coat).toBe(1);
  });

  it('unlocks better recipes by going deeper, and keeps class-bound gear to its class', () => {
    let s = rich(guild());
    s = applyAll(s, [{ type: 'start_expedition', partyIds: ['adv_1'] }, { type: 'debug_teleport', floor: 0, x: 13, y: 9 }, { type: 'dungeon_stairs' }]);
    expect(s.milestones).toEqual(['floor_2']);
    s = applyAll(s, [{ type: 'debug_teleport', floor: 2, x: 1, y: 1 }, { type: 'debug_teleport', floor: 0, x: 1, y: 1 }]);
    expect(rejected(s, { type: 'craft_item', itemId: 'sentinel_plate' })).toMatch(/does not know how/); // teleporting is not discovering
    s = applyAll(s, [{ type: 'debug_teleport', floor: 1, x: 11, y: 9 }, { type: 'dungeon_stairs' }, { type: 'debug_teleport', floor: 0, x: 1, y: 1 }]);
    expect(s.milestones).toContain('floor_3');
    expect(rejected(s, { type: 'equip_item', adventurerId: 'adv_1', itemId: 'iron_arms' })).toMatch(/labyrinth/);
    s = applyAll(s, [{ type: 'end_expedition' }, { type: 'craft_item', itemId: 'sentinel_plate' }, { type: 'craft_item', itemId: 'marksman_scope' }]);
    expect(rejected(s, { type: 'equip_item', adventurerId: 'adv_2', itemId: 'sentinel_plate' })).toMatch(/made for Guardian/);
    s = must(s, { type: 'equip_item', adventurerId: 'adv_2', itemId: 'marksman_scope' });
    expect(statsOf(cfg, adv(s, 'adv_2')).tdRange).toBeCloseTo(1.12);
  });
});

describe('supplies', () => {
  it('packs up to three of each, uses them in the field and in fights, and brings the rest home', () => {
    let s = rich(guild());
    s = applyAll(s, [...Array(5).fill({ type: 'craft_supply', itemId: 'draught' }), { type: 'craft_supply', itemId: 'salve' }]);
    expect(s.supplies).toEqual({ draught: 5, salve: 1 });
    s = must(s, { type: 'start_expedition', partyIds: ['adv_1', 'adv_2'] });
    expect(s.expedition!.pack).toEqual({ draught: cfg.supplies.pack_limit_per_item, salve: 1 });
    expect(s.supplies).toEqual({ draught: 2, salve: 0 });

    s = structuredClone(s);
    s.adventurers[0]!.hp = 20;
    s.adventurers[1]!.gauge = 60;
    s = must(s, { type: 'field_use_item', itemId: 'draught', target: 'adv_1' });
    expect(adv(s, 'adv_1').hp).toBe(70);
    expect(rejected(s, { type: 'field_use_item', itemId: 'tonic', target: 'adv_1' })).toMatch(/no Clear Tonic/);

    s = structuredClone(s);
    s.expedition!.combat = { kind: 'normal', eliteId: null, round: 0, enemies: [{ id: 1, type: 'pale_crawler', hp: 44, maxHp: 44, patternIndex: 0, corrode: 0, slow: 0 }], shieldWall: 0, wardMist: 0, taunt: null, log: [] };
    expect(rejected(s, { type: 'field_use_item', itemId: 'salve', target: 'adv_2' })).toMatch(/in a fight/);
    s = must(s, { type: 'combat_round', actions: { adv_1: { type: 'guard' }, adv_2: { type: 'item', itemId: 'salve', target: 'adv_2' } } });
    expect(adv(s, 'adv_2').gauge).toBe(25);
    expect(s.expedition!.pack).toEqual({ draught: 2, salve: 0 });

    s = applyAll(s, [{ type: 'debug_win_combat' }, { type: 'end_expedition' }]);
    expect(s.supplies).toEqual({ draught: 4, salve: 0 });
  });
});

describe('choosing where the defenses stand', () => {
  it('starts a real campaign with a bare frontier and the fixed posts of the sanctuary', () => {
    const s = must(createCampaign(cfg, 1, { prologue: true }), { type: 'debug_skip_prologue' });
    expect(s.structures.filter((d) => d.map === 'frontier')).toHaveLength(0);
    const walls = s.structures.filter((d) => d.map === 'sanctuary');
    expect(walls).toHaveLength(getDefenseMap('sanctuary').fixed_layout.length);
    expect(walls.every((d) => d.fixed)).toBe(true);
    expect(rejected(s, { type: 'demolish_structure', structureId: walls[0]!.id })).toMatch(/cannot be removed/);
  });

  it('builds on free sites up to the cap for each type, and lets the layout be changed', () => {
    let s = must(createCampaign(cfg, 1, { prologue: true }), { type: 'debug_skip_prologue' });
    const caps = cfg.defense.build_caps.frontier!;
    expect(buildsLeft(s, cfg, 'frontier', 'bunker')).toBe(caps.bunker);
    s = must(s, { type: 'build_structure', map: 'frontier', site: 's9', structureType: 'bunker' });
    expect(s.structures.find((d) => d.site === 's9')).toMatchObject({ id: 'frontier_bunker_1', x: 420, y: 150, fixed: false });
    expect(rejected(s, { type: 'build_structure', map: 'frontier', site: 's9', structureType: 'watchtower' })).toMatch(/already stands/);
    expect(rejected(s, { type: 'build_structure', map: 'frontier', site: 'nowhere', structureType: 'watchtower' })).toMatch(/no such building site/);
    s = must(s, { type: 'build_structure', map: 'frontier', site: 's10', structureType: 'bunker' });
    expect(rejected(s, { type: 'build_structure', map: 'frontier', site: 's11', structureType: 'bunker' })).toMatch(/No more bunkers/);

    // A manned post cannot be pulled down; an empty one can, and the site is free again.
    s = must(s, { type: 'assign_defender', adventurerId: 'adv_1', structureId: 'frontier_bunker_1' });
    expect(rejected(s, { type: 'demolish_structure', structureId: 'frontier_bunker_1' })).toMatch(/back to reserve first/);
    s = applyAll(s, [{ type: 'unassign_defender', adventurerId: 'adv_1' }, { type: 'demolish_structure', structureId: 'frontier_bunker_1' }]);
    s = must(s, { type: 'build_structure', map: 'frontier', site: 's4', structureType: 'bunker' });
    expect(s.structures.find((d) => d.site === 's4')!.id).toBe('frontier_bunker_1');

    // The recommended layout fills in whatever the caps still allow.
    s = must(s, { type: 'build_recommended', map: 'frontier' });
    for (const type of ['watchtower', 'bunker', 'support_station']) expect(buildsLeft(s, cfg, 'frontier', type), type).toBe(0);
    expect(rejected(s, { type: 'build_recommended', map: 'frontier' })).toMatch(/nothing more to build/);
  });

  it('allows building while taking up positions, never once the fighting has begun', () => {
    let s = must(createCampaign(cfg, 1, { prologue: true }), { type: 'debug_skip_prologue' });
    s = applyAll(s, [{ type: 'debug_force_invasion' }, { type: 'battle_start' }]);
    s = must(s, { type: 'build_structure', map: 'frontier', site: 's12', structureType: 'watchtower' });
    s = must(s, { type: 'assign_defender', adventurerId: 'adv_2', structureId: 'frontier_watchtower_1' });
    s = must(s, { type: 'battle_begin' });
    expect(rejected(s, { type: 'build_structure', map: 'frontier', site: 's1', structureType: 'watchtower' })).toMatch(/once the fighting has begun/);
    expect(rejected(s, { type: 'demolish_structure', structureId: 'frontier_watchtower_1' })).toMatch(/once the fighting has begun/);
    // A structure built somewhere new fights from where it stands.
    s = must(s, { type: 'battle_tick', ticks: cfg.defense.ticks_per_second * 40 });
    expect(s.battle!.killed).toBeGreaterThan(0);
  });

  it('lets the sanctuary add a little to its fixed defenses', () => {
    let s = buildFixture('sanctuary_siege');
    s = must(s, { type: 'build_structure', map: 'sanctuary', site: 'w5', structureType: 'watchtower' });
    expect(rejected(s, { type: 'build_structure', map: 'sanctuary', site: 'w6', structureType: 'watchtower' })).toMatch(/No more watchtowers/);
    expect(rejected(s, { type: 'build_structure', map: 'sanctuary', site: 'w6', structureType: 'support_station' })).toMatch(/No more support stations/);
    expect(rejected(s, { type: 'build_structure', map: 'frontier', site: 's8', structureType: 'bunker' })).toMatch(/overrun/);
  });
});

describe('what the lore decisions changed', () => {
  it('lets the guild master be named, within sixteen characters', () => {
    let s = createCampaign(cfg, 1, { prologue: true });
    expect(s.playerName).toBe('Master');
    s = must(s, { type: 'set_player_name', name: '  Aveline  ' });
    expect(s.playerName).toBe('Aveline');
    expect(rejected(s, { type: 'set_player_name', name: '   ' })).toMatch(/one to sixteen/);
    expect(rejected(s, { type: 'set_player_name', name: 'x'.repeat(17) })).toMatch(/one to sixteen/);
  });

  it('gives temporary champions made-up names, never one of the known characters', () => {
    let s = rich(guild());
    const known = cfg.roster.champions.map((c) => c.name);
    for (let i = 0; i < cfg.roster.emergency.max_active; i++) s = must(s, { type: 'summon', classId: 'Gunner', emergency: true });
    const temps = s.adventurers.filter((a) => a.fadesAtHour !== null);
    expect(new Set(temps.map((a) => a.name)).size).toBe(temps.length);
    for (const a of temps) expect(known).not.toContain(a.name);
  });

  it('keeps her gear on a fallen champion: home with her if she is rescued, perished if she is abandoned', () => {
    let s = rich(guild());
    s = applyAll(s, [
      { type: 'craft_item', itemId: 'iron_arms' },
      { type: 'craft_item', itemId: 'iron_arms' },
      { type: 'equip_item', adventurerId: 'adv_1', itemId: 'iron_arms' },
      { type: 'equip_item', adventurerId: 'adv_2', itemId: 'iron_arms' },
      { type: 'debug_solidify', adventurerId: 'adv_1', locationType: 'dungeon' },
      { type: 'debug_solidify', adventurerId: 'adv_2', locationType: 'dungeon' },
    ]);
    expect(s.armory.iron_arms).toBe(0); // it is out there with them
    s = must(s, { type: 'debug_retrieve', adventurerId: 'adv_1' });
    s = must(s, { type: 'advance_time', hours: cfg.clock.solidification_permanence_hours });
    expect(adv(s, 'adv_1').equipment.weapon).toBe('iron_arms');
    expect(adv(s, 'adv_2')).toMatchObject({ condition: 'lost', equipment: { weapon: null } });
    expect(s.armory.iron_arms).toBe(0);
  });

  it('lets a permanently lost champion be carried home to the memorial, still lost', () => {
    let s = must(guild(), { type: 'start_expedition', partyIds: ['adv_1'] });
    s = must(s, { type: 'report_casualty', adventurerId: 'adv_1' });
    s = must(s, { type: 'advance_time', hours: cfg.clock.solidification_permanence_hours });
    expect(adv(s, 'adv_1').condition).toBe('lost');
    s = must(s, { type: 'start_expedition', partyIds: ['adv_2'] });
    s = must(s, { type: 'expedition_pickup_statue', adventurerId: 'adv_1' });
    s = must(s, { type: 'end_expedition' });
    const statue = s.statues.find((st) => st.adventurerId === 'adv_1')!;
    expect(statue).toMatchObject({ permanent: true, locationType: 'memorial', retrievedAtHour: null });
    expect(adv(s, 'adv_1').condition).toBe('lost');
    expect(rejected(s, { type: 'queue_treatment', adventurerId: 'adv_1' })).toMatch(/permanently solidified/);
  });
});

describe('the cast', () => {
  const real = () => must(createCampaign(cfg, 3, { prologue: true }), { type: 'debug_skip_prologue' });

  it('has twenty-four champions, six to a class, each with her own epithet and trait', () => {
    const cast = cfg.roster.champions;
    expect(cast).toHaveLength(24);
    for (const classId of cfg.roster.classes) expect(cast.filter((c) => c.class === classId), classId).toHaveLength(6);
    expect(new Set(cast.map((c) => c.name)).size).toBe(24);
    expect(new Set(cast.map((c) => c.trait.name)).size).toBe(24);
    for (const c of cast) expect(Object.keys(c.trait.stats).length, c.name).toBeGreaterThan(0);
  });

  it('summons a chosen champion once, with her trait and small differences of her own', () => {
    let s = real();
    s = must(s, { type: 'summon', champion: 'Haruka' });
    const haruka = s.adventurers.find((a) => a.name === 'Haruka')!;
    expect(haruka).toMatchObject({ classId: 'Gunner', epithet: 'the Longshot', trait: { name: 'Far sight' } });
    expect(statsOf(cfg, haruka).tdRange).toBeCloseTo(1.15);
    for (const [stat, value] of Object.entries(haruka.aptitude)) expect(Math.abs(value), stat).toBeLessThanOrEqual(cfg.roster.aptitude_range[stat]!);
    expect(haruka.hp).toBe(statsOf(cfg, haruka).maxHp);
    expect(rejected(s, { type: 'summon', champion: 'Haruka' })).toMatch(/already answered/);
    expect(rejected(s, { type: 'summon', champion: 'Nobody' })).toMatch(/answers the seal/);
    expect(rejected(s, { type: 'summon', champion: 'Rin', emergency: true })).toMatch(/cannot choose/);
  });

  it('makes two champions of one class differ, and keeps the standard cast identical', () => {
    const s = real();
    const guardians = s.adventurers.filter((a) => a.classId === 'Guardian');
    const sheet = (a: (typeof guardians)[number]) => JSON.stringify([a.trait?.name, statsOf(cfg, a)]);
    expect(new Set(s.adventurers.map((a) => a.trait?.name)).size).toBe(s.adventurers.length);
    expect(guardians.length === 1 || sheet(guardians[0]!) !== sheet(guardians[1]!)).toBe(true);

    const standard = guild().adventurers.filter((a) => a.classId === 'Guardian');
    expect(standard.every((a) => a.trait === null && Object.keys(a.aptitude).length === 0)).toBe(true);
    expect(JSON.stringify(statsOf(cfg, standard[0]!))).toBe(JSON.stringify(statsOf(cfg, standard[1]!)));
  });

  it('keeps one medium per champion from the first touch until she is clear of it', () => {
    let s = must(guild(), { type: 'start_expedition', partyIds: ['adv_1'] });
    s = must(s, { type: 'debug_teleport', floor: 0, x: 5, y: 7 });
    while (s.expedition!.facing !== 1) s = must(s, { type: 'dungeon_move', move: 'turn_right' });
    s = must(s, { type: 'dungeon_move', move: 'forward' }); // into the mist
    expect(adv(s, 'adv_1')).toMatchObject({ gauge: cfg.dungeon.mist_gauge, medium: 'stone' });
    const tainted = structuredClone(s);
    tainted.adventurers[0]!.medium = 'ice'; // as if a deeper stratum had touched her first
    const fallen = must(tainted, { type: 'report_casualty', adventurerId: 'adv_1' });
    expect(fallen.statues[0]).toMatchObject({ medium: 'ice' });
    s = applyAll(s, [{ type: 'debug_teleport', floor: 0, x: 1, y: 1 }, { type: 'end_expedition' }, { type: 'advance_time', hours: 24 }]);
    expect(adv(s, 'adv_1')).toMatchObject({ gauge: 0, medium: null });
  });
});
