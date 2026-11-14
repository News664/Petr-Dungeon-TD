import type { GameConfig } from './config';
import { randomInt } from './rng';
import { frontierHeld, getAdventurer, getStructure, rosterCount } from './selectors';
import { clearAssignment, retrieve, solidify } from './statues';
import type { Adventurer, CampaignState } from './types';
import { fail, log, pay } from './util';

const NAMES = [
  'Ysolde', 'Maren', 'Thessaly', 'Okka', 'Brisa', 'Linnet', 'Havela', 'Sorrel', 'Quenby', 'Idris', 'Velka', 'Nimue',
  'Aurel', 'Castane', 'Petra', 'Rhosyn', 'Ember', 'Wren', 'Zofia', 'Calla', 'Edda', 'Mirelle', 'Tamsin', 'Oriel',
];

function pickName(s: CampaignState): string {
  const used = new Set(s.adventurers.map((a) => a.name));
  const free = NAMES.filter((n) => !used.has(n));
  if (free.length === 0) return `Champion ${s.seal.summonCount + 1}`;
  return free[randomInt(s, free.length)] as string;
}

export function summon(s: CampaignState, cfg: GameConfig, classId: string, emergency: boolean): Adventurer {
  if (s.phase === 'GAME_OVER') fail('The sanctuary has fallen.');
  const stats = cfg.roster.class_stats[classId];
  if (!cfg.roster.classes.includes(classId) || !stats) fail(`Unknown class "${classId}".`);
  if (rosterCount(s) >= cfg.roster.max_roster) fail(`The guild hall is full (${cfg.roster.max_roster} adventurers).`);

  if (s.seal.freeCredits > 0 && !emergency) {
    s.seal.freeCredits -= 1;
  } else if (emergency) {
    // Costly way out of a crisis: ignores the cooldown, never free.
    pay(s, cfg.roster.emergency_summon_cost, 'perform an emergency summoning');
  } else {
    if (s.simHour < s.seal.nextAvailableHour) {
      fail(`The seal is recharging for another ${s.seal.nextAvailableHour - s.simHour} hours.`);
    }
    pay(s, cfg.roster.summon_cost, 'perform a summoning');
    s.seal.nextAvailableHour = s.simHour + cfg.roster.default_summon_cooldown_hours;
  }

  const name = pickName(s);
  s.seal.summonCount += 1;
  const adv: Adventurer = {
    id: `adv_${s.seal.summonCount}`,
    name,
    classId,
    level: 1,
    xp: 0,
    hp: stats.max_hp,
    maxHp: stats.max_hp,
    gauge: 0,
    condition: 'ready',
    assignment: { type: 'idle' },
    targetPriority: 'first',
    summonedAtHour: s.simHour,
  };
  s.adventurers.push(adv);
  log(s, 'summoned', `${name} the ${classId} answered the seal${emergency ? ' (emergency summoning)' : ''}.`);
  return adv;
}

export function assignDefender(s: CampaignState, cfg: GameConfig, adventurerId: string, structureId: string): void {
  const adv = getAdventurer(s, adventurerId);
  const structure = getStructure(s, structureId);
  if (s.phase === 'GAME_OVER') fail('The sanctuary has fallen.');
  if (adv.condition !== 'ready') fail(`${adv.name} is solidified and cannot be deployed.`);
  // One body, one place: an expedition member cannot also hold a tower.
  if (adv.assignment.type === 'expedition') fail(`${adv.name} is on an expedition and must return first.`);
  if (structure.map === 'frontier' && !frontierHeld(s.phase)) fail('The frontier is overrun; its structures cannot be manned.');
  if (structure.occupantId && structure.occupantId !== adv.id) {
    fail(`${structure.id} is already held by ${getAdventurer(s, structure.occupantId).name}.`);
  }
  if (structure.hp <= 0) fail(`The ${structure.id.replace(/_/g, ' ')} is destroyed and must be repaired first.`);
  if (adv.assignment.type === 'defense' && adv.assignment.structureId === structureId) return;
  clearAssignment(s, adv);
  structure.occupantId = adv.id;
  adv.assignment = { type: 'defense', structureId };
  // Moving under fire is not instant: she cannot act until she is in position.
  if (s.battle && s.battle.outcome === 'ongoing' && s.battle.map === structure.map) {
    s.battle.busyUntil[adv.id] = s.battle.tick + Math.round(cfg.defense.reposition_seconds * cfg.defense.ticks_per_second);
    s.battle.cooldowns[adv.id] = 0;
  }
}

export function setTargetPriority(s: CampaignState, adventurerId: string, priority: Adventurer['targetPriority']): void {
  getAdventurer(s, adventurerId).targetPriority = priority;
}

export function repairCost(cfg: GameConfig, structure: { hp: number; maxHp: number }): number {
  return Math.ceil((structure.maxHp - structure.hp) / 10) * cfg.defense.repair_materials_per_10_hp;
}

export function repairStructure(s: CampaignState, cfg: GameConfig, structureId: string): void {
  const structure = getStructure(s, structureId);
  if (s.battle) fail('Repairs have to wait until the battle is over.');
  if (structure.hp >= structure.maxHp) fail('That structure is not damaged.');
  if (structure.map === 'frontier' && !frontierHeld(s.phase)) fail('The frontier is overrun; its structures cannot be reached.');
  pay(s, { construction_materials: repairCost(cfg, structure) }, `repair the ${structureId.replace(/_/g, ' ')}`);
  structure.hp = structure.maxHp;
  log(s, 'repaired', `The ${structureId.replace(/_/g, ' ')} was repaired.`);
}

/** Turn construction materials into ammunition for the sanctuary's automated weapons. */
export function restockAmmo(s: CampaignState, cfg: GameConfig): void {
  const max = cfg.defense.sanctuary_max_automated_ammo;
  if (s.battle) fail('Ammunition cannot be made during a battle.');
  if (s.sanctuary.automatedAmmo >= max) fail('The magazines are full.');
  pay(s, { construction_materials: cfg.defense.ammo_restock.construction_materials }, 'make ammunition');
  s.sanctuary.automatedAmmo = Math.min(max, s.sanctuary.automatedAmmo + cfg.defense.ammo_restock.ammo);
  log(s, 'ammo', `Ammunition restocked to ${s.sanctuary.automatedAmmo}.`);
}

export function unassignDefender(s: CampaignState, adventurerId: string): void {
  const adv = getAdventurer(s, adventurerId);
  if (adv.assignment.type !== 'defense') fail(`${adv.name} is not holding a structure.`);
  clearAssignment(s, adv);
}

export function startExpedition(s: CampaignState, cfg: GameConfig, partyIds: string[]): void {
  if (s.expedition) fail('An expedition is already under way.');
  if (!frontierHeld(s.phase)) fail('The labyrinth cannot be reached while the frontier is overrun.');
  const stratumId = s.frontierStratumId ?? fail('There is no unexplored stratum left in this prototype.');
  const unique = [...new Set(partyIds)];
  if (unique.length === 0) fail('Choose at least one adventurer.');
  if (unique.length > cfg.roster.max_dungeon_party) fail(`An expedition takes at most ${cfg.roster.max_dungeon_party} adventurers.`);
  const party = unique.map((id) => getAdventurer(s, id));
  for (const adv of party) {
    if (adv.condition !== 'ready') fail(`${adv.name} is solidified and cannot join.`);
    if (adv.assignment.type === 'defense') fail(`${adv.name} is holding ${adv.assignment.structureId}; relieve her first.`);
  }
  for (const adv of party) adv.assignment = { type: 'expedition' };
  s.expedition = { stratumId, partyIds: unique, startedAtHour: s.simHour, carriedStatueIds: [] };
  log(s, 'expedition_started', `An expedition of ${unique.length} entered the labyrinth.`);
}

export function endExpedition(s: CampaignState): void {
  const exp = s.expedition ?? fail('No expedition is under way.');
  for (const id of exp.partyIds) getAdventurer(s, id).assignment = { type: 'idle' };
  for (const st of s.statues.filter((x) => exp.carriedStatueIds.includes(x.adventurerId))) {
    retrieve(s, st, 'carried out by the expedition');
  }
  s.expedition = null;
  log(s, 'expedition_returned', 'The expedition returned to the sanctuary.');
}

/** A party member fell in the labyrinth. Her statue stays where she fell. */
export function reportCasualty(s: CampaignState, cfg: GameConfig, adventurerId: string, locationId?: string): void {
  const exp = s.expedition ?? fail('No expedition is under way.');
  const adv = getAdventurer(s, adventurerId);
  if (adv.assignment.type !== 'expedition') fail(`${adv.name} is not on the expedition.`);
  solidify(s, cfg, adventurerId, 'dungeon', locationId ?? `${exp.stratumId}:floor_1`);
  if (exp.partyIds.length === 0) {
    // Total wipe: nobody is left to carry anything out.
    exp.carriedStatueIds = [];
    s.expedition = null;
    log(s, 'expedition_wiped', 'The whole expedition was solidified. A rescue party will be needed.');
  }
}

export function pickUpStatue(s: CampaignState, adventurerId: string): void {
  const exp = s.expedition ?? fail('A statue in the labyrinth can only be recovered by an expedition.');
  const adv = getAdventurer(s, adventurerId);
  const statue = s.statues.find((st) => st.adventurerId === adventurerId) ?? fail(`${adv.name} is not solidified.`);
  if (statue.permanent) fail(`${adv.name} is permanently solidified.`);
  if (statue.locationType !== 'dungeon' || statue.retrievedAtHour !== null) fail(`${adv.name}'s statue is not in the labyrinth.`);
  if (exp.carriedStatueIds.includes(adventurerId)) fail(`${adv.name}'s statue is already being carried.`);
  exp.carriedStatueIds.push(adventurerId);
  log(s, 'statue_secured', `The expedition secured ${adv.name}'s statue. She is safe once they return.`);
}
