import type { GameConfig, RemedyEffect, StatKey } from './config';
import { getAdventurer } from './selectors';
import type { Adventurer, CampaignState, EquipSlot } from './types';
import { RESOURCE_IDS } from './types';
import { fail, formatCost, log, pay } from './util';

/**
 * What an adventurer has become: levels, the skills she has put points into,
 * and what she wears. Everything that reads her strength goes through here.
 */

export interface Stats {
  atk: number;
  def: number;
  speed: number;
  maxHp: number;
  maxSp: number;
  /** Share of incoming solidification she shrugs off (0–0.8). */
  gaugeResist: number;
  /** Multipliers that apply when she holds a defensive post. */
  tdDamage: number;
  tdRange: number;
  /** Multiplier on her healing and purging, in the labyrinth and on the walls. */
  support: number;
}

export const skillRank = (adv: Adventurer, skillId: string) => adv.skills[skillId] ?? 0;
export const rankScale = (cfg: GameConfig, rank: number) => 1 + cfg.dungeon.rank_bonus * Math.max(0, rank - 1);

function bonuses(cfg: GameConfig, adv: Adventurer): Record<StatKey, number> {
  const sum: Record<StatKey, number> = { atk: 0, atk_pct: 0, def: 0, speed: 0, max_hp: 0, max_sp: 0, gauge_resist_pct: 0, td_damage_pct: 0, td_range_pct: 0, support_pct: 0 };
  for (const [skillId, rank] of Object.entries(adv.skills)) {
    const effect = cfg.dungeon.skills[skillId]?.effect;
    if (effect?.kind === 'passive') sum[effect.stat] += effect.per_rank * rank;
  }
  for (const [stat, value] of Object.entries(adv.trait?.stats ?? {})) sum[stat as StatKey] += value;
  for (const [stat, value] of Object.entries(adv.aptitude)) sum[stat as StatKey] += value;
  for (const itemId of Object.values(adv.equipment)) {
    const item = itemId ? cfg.equipment.items[itemId] : undefined;
    for (const [stat, value] of Object.entries(item?.stats ?? {})) sum[stat as StatKey] += value ?? 0;
  }
  return sum;
}

export function statsOf(cfg: GameConfig, adv: Adventurer): Stats {
  const D = cfg.dungeon;
  const cls = D.class_stats[adv.classId];
  const baseHp = cfg.roster.class_stats[adv.classId]?.max_hp ?? adv.maxHp;
  const b = bonuses(cfg, adv);
  const levels = adv.level - 1;
  return {
    atk: Math.round((cls?.atk ?? 0) * (1 + D.level_atk_bonus * levels) * (1 + b.atk_pct / 100)) + b.atk,
    def: (cls?.def ?? 0) + b.def,
    speed: (cls?.speed ?? 0) + b.speed,
    maxHp: Math.round(baseHp * (1 + D.level_hp_bonus * levels)) + b.max_hp,
    maxSp: (cls?.max_sp ?? 0) + b.max_sp,
    gaugeResist: Math.min(0.8, b.gauge_resist_pct / 100),
    tdDamage: (1 + cfg.defense.level_damage_bonus * levels) * (1 + b.td_damage_pct / 100),
    tdRange: 1 + b.td_range_pct / 100,
    support: 1 + b.support_pct / 100,
  };
}

/** Bring her health and skill-point ceilings in line after a level, a skill or a change of gear. */
export function refreshDerived(cfg: GameConfig, adv: Adventurer): void {
  const stats = statsOf(cfg, adv);
  if (adv.condition === 'ready') {
    adv.hp = Math.max(1, Math.min(stats.maxHp, adv.hp + Math.max(0, stats.maxHp - adv.maxHp)));
    adv.sp = Math.max(0, Math.min(stats.maxSp, adv.sp + Math.max(0, stats.maxSp - adv.maxSp)));
  }
  adv.maxHp = stats.maxHp;
  adv.maxSp = stats.maxSp;
}

export function addMilestone(s: CampaignState, key: string): void {
  if (!s.milestones.includes(key)) s.milestones.push(key);
}

const unlocked = (s: CampaignState, key: string) => key === 'start' || s.milestones.includes(key);

function atGuild(s: CampaignState, adv: Adventurer, what: string): void {
  if (adv.condition !== 'ready') fail(`${adv.name} is solidified.`);
  if (adv.assignment.type === 'expedition') fail(`${adv.name} is in the labyrinth; ${what} has to wait until she is home.`);
  if (s.battle && !s.battle.deploying && s.battle.outcome === 'ongoing') fail(`Not in the middle of a battle.`);
}

export function learnSkill(s: CampaignState, cfg: GameConfig, adventurerId: string, skillId: string): void {
  const adv = getAdventurer(s, adventurerId);
  const skill = cfg.dungeon.skills[skillId];
  if (!skill || !cfg.dungeon.class_stats[adv.classId]?.tree.includes(skillId)) fail(`${adv.name} cannot learn that.`);
  if (s.expedition?.combat) fail('Not in the middle of a fight.');
  if (adv.condition !== 'ready') fail(`${adv.name} is solidified.`);
  if (adv.skillPoints <= 0) fail(`${adv.name} has no skill points to spend.`);
  if (adv.level < (skill.requires_level ?? 1)) fail(`${skill.name} needs level ${skill.requires_level}.`);
  const rank = skillRank(adv, skillId);
  if (rank >= cfg.dungeon.skill_max_rank) fail(`${skill.name} is already at its highest rank.`);
  adv.skills[skillId] = rank + 1;
  adv.skillPoints -= 1;
  refreshDerived(cfg, adv);
  log(s, 'skill_learned', `${adv.name} ${rank === 0 ? 'learned' : 'improved'} ${skill.name} (rank ${rank + 1}).`);
}

export function craftItem(s: CampaignState, cfg: GameConfig, itemId: string): void {
  const item = cfg.equipment.items[itemId] ?? fail('There is no such piece of equipment.');
  if (!unlocked(s, item.unlock)) fail(`The guild does not know how to make ${item.name} yet.`);
  pay(s, item.cost, `make ${item.name}`);
  s.armory[itemId] = (s.armory[itemId] ?? 0) + 1;
  log(s, 'crafted', `The artisans made ${item.name} (${formatCost(item.cost)}).`);
}

export function unequipItem(s: CampaignState, cfg: GameConfig, adventurerId: string, slot: EquipSlot): void {
  const adv = getAdventurer(s, adventurerId);
  atGuild(s, adv, 'changing gear');
  const itemId = adv.equipment[slot] ?? fail(`${adv.name} has nothing there.`);
  adv.equipment[slot] = null;
  s.armory[itemId] = (s.armory[itemId] ?? 0) + 1;
  refreshDerived(cfg, adv);
}

export function equipItem(s: CampaignState, cfg: GameConfig, adventurerId: string, itemId: string): void {
  const adv = getAdventurer(s, adventurerId);
  const item = cfg.equipment.items[itemId] ?? fail('There is no such piece of equipment.');
  atGuild(s, adv, 'changing gear');
  if ((s.armory[itemId] ?? 0) <= 0) fail(`There is no ${item.name} in the armory.`);
  if (item.classes && !item.classes.includes(adv.classId)) fail(`${item.name} is made for ${item.classes.join(' or ')}.`);
  if (adv.equipment[item.slot]) unequipItem(s, cfg, adventurerId, item.slot);
  s.armory[itemId] = (s.armory[itemId] ?? 0) - 1;
  adv.equipment[item.slot] = itemId;
  refreshDerived(cfg, adv);
}

/** A fading or permanently lost adventurer's gear goes back to the armory. */
export function returnGear(s: CampaignState, adv: Adventurer): void {
  for (const slot of Object.keys(adv.equipment) as EquipSlot[]) {
    const itemId = adv.equipment[slot];
    if (itemId) s.armory[itemId] = (s.armory[itemId] ?? 0) + 1;
    adv.equipment[slot] = null;
  }
}

export function craftSupply(s: CampaignState, cfg: GameConfig, itemId: string): void {
  const item = cfg.supplies.items[itemId] ?? fail('There is no such supply.');
  pay(s, item.cost, `prepare a ${item.name}`);
  s.supplies[itemId] = (s.supplies[itemId] ?? 0) + 1;
}

/** Apply a healing effect to one adventurer. Returns what happened, for the log. */
export function applyRemedy(effect: RemedyEffect, target: Adventurer, strength: number): string {
  if (effect.kind === 'heal') {
    const before = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + Math.round(effect.amount * strength));
    return `${target.name} recovers ${target.hp - before} health`;
  }
  if (effect.kind === 'purge') {
    const before = target.gauge;
    easeGauge(target, Math.round(effect.gauge * strength));
    return `${target.name}'s solidification eases by ${before - target.gauge}%`;
  }
  const before = target.sp;
  target.sp = Math.min(target.maxSp, target.sp + Math.round(effect.amount * strength));
  return `${target.name} recovers ${target.sp - before} skill points`;
}

/** What a full pack holds, given the guild's stores. Taken out of the stores when the party leaves. */
export function loadPack(s: CampaignState, cfg: GameConfig): Record<string, number> {
  const pack: Record<string, number> = {};
  for (const id of Object.keys(cfg.supplies.items)) {
    const take = Math.min(cfg.supplies.pack_limit_per_item, s.supplies[id] ?? 0);
    if (take > 0) {
      pack[id] = take;
      s.supplies[id] = (s.supplies[id] ?? 0) - take;
    }
  }
  return pack;
}

export function unloadPack(s: CampaignState, pack: Record<string, number>): void {
  for (const [id, n] of Object.entries(pack)) s.supplies[id] = (s.supplies[id] ?? 0) + n;
}

export const hasCost = (cost: object) => RESOURCE_IDS.some((id) => ((cost as Record<string, number>)[id] ?? 0) > 0);

/**
 * Add to her gauge. Whatever first touches her decides what she is turning
 * into, until the gauge is back at zero: a champion is never a mixture.
 */
export function addGauge(adv: Adventurer, amount: number, medium: string): void {
  if (amount <= 0) return;
  if (adv.gauge <= 0 || !adv.medium) adv.medium = medium;
  adv.gauge = Math.min(100, adv.gauge + amount);
}

/** Lower her gauge; once it is gone she is turning into nothing at all. */
export function easeGauge(adv: Adventurer, amount: number): void {
  adv.gauge = Math.max(0, adv.gauge - amount);
  if (adv.gauge === 0) adv.medium = null;
}
