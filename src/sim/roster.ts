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
    summonedAtHour: s.simHour,
  };
  s.adventurers.push(adv);
  log(s, 'summoned', `${name} the ${classId} answered the seal${emergency ? ' (emergency summoning)' : ''}.`);
  return adv;
}

export function assignDefender(s: CampaignState, adventurerId: string, structureId: string): void {
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
  clearAssignment(s, adv);
  structure.occupantId = adv.id;
  adv.assignment = { type: 'defense', structureId };
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
