import type { GameConfig } from './config';
import { randomInt } from './rng';
import { frontierHeld, getAdventurer, getStructure, rosterCount } from './selectors';
import { clearAssignment } from './statues';
import type { Adventurer, CampaignState } from './types';
import { fail, log, pay } from './util';

function pickName(s: CampaignState, cfg: GameConfig): string {
  const used = new Set(s.adventurers.map((a) => a.name));
  const free = cfg.roster.names.filter((n) => !used.has(n));
  if (free.length === 0) return `Champion ${s.seal.summonCount + 1}`;
  return free[randomInt(s, free.length)] as string;
}

export function summon(s: CampaignState, cfg: GameConfig, classId: string, emergency: boolean): Adventurer {
  if (s.phase === 'GAME_OVER') fail('The sanctuary has fallen.');
  const stats = cfg.roster.class_stats[classId];
  if (!cfg.roster.classes.includes(classId) || !stats) fail(`Unknown class "${classId}".`);
  if (rosterCount(s) >= cfg.roster.max_roster) fail(`The guild hall is full (${cfg.roster.max_roster} adventurers).`);
  if (s.phase === 'PROLOGUE' && (emergency || s.seal.freeCredits <= 0)) {
    fail('The goddess has strength for no more than these few champions until the sanctuary is safe.');
  }

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

  const name = pickName(s, cfg);
  const combat = cfg.dungeon.class_stats[classId];
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
    sp: combat?.max_sp ?? 0,
    maxSp: combat?.max_sp ?? 0,
    row: combat?.row ?? 'back',
    lastPost: null,
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
  if (s.battle && s.battle.outcome === 'ongoing' && !s.battle.deploying && s.battle.map === structure.map) {
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

export function setRow(s: CampaignState, adventurerId: string, row: Adventurer['row']): void {
  if (s.expedition?.combat) fail('Rows cannot be changed in the middle of a fight.');
  getAdventurer(s, adventurerId).row = row;
}
