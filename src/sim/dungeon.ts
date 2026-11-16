import { startCombat } from './combat';
import type { GameConfig } from './config';
import { DIRS, DIR_LETTERS, elitePath, findTile, floorKey, getStratumMap, parseTileKey, tileAt, tileKey } from './dungeonMap';
import type { FloorData, GridPoint } from './dungeonMap';
import { finishExpedition, wipeExpedition } from './expeditionCore';
import { addGauge, addMilestone, applyRemedy, loadPack, rankScale, skillRank, statsOf } from './growth';
import { randomInt } from './rng';
import { frontierHeld, getAdventurer } from './selectors';
import { solidify } from './statues';
import { advanceHours, advanceMinutes, ensureClockFree } from './time';
import type { CampaignState, Expedition, MoveKind } from './types';
import { RESOURCE_IDS } from './types';
import { fail, formatCost, log, pay } from './util';

function expedition(s: CampaignState): Expedition {
  return s.expedition ?? fail('No expedition is under way.');
}

function floorOf(exp: Expedition): FloorData {
  return getStratumMap(exp.stratumId)?.floors[exp.floor] ?? fail('The party is somewhere uncharted.');
}

export const partyTile = (exp: Expedition) => tileKey(exp.stratumId, exp.floor, exp.x, exp.y);

const flag = (s: CampaignState, key: string) => s.dungeon.flags.includes(key);
const setFlag = (s: CampaignState, key: string) => {
  if (!s.dungeon.flags.includes(key)) s.dungeon.flags.push(key);
};

/** Whether a stratum's water is low right now, and how long until that changes. */
export function tideState(s: CampaignState, stratumId: string): { low: boolean; changesInHours: number } | null {
  const tide = getStratumMap(stratumId)?.tide;
  if (!tide) return null;
  const at = s.simHour % tide.period_hours;
  const low = at >= tide.low_start && at < tide.low_start + tide.low_hours;
  const next = low ? tide.low_start + tide.low_hours - at : (tide.low_start - at + tide.period_hours) % tide.period_hours;
  return { low, changesInHours: next === 0 ? tide.period_hours : next };
}

/**
 * What a tile is right now, after everything the guild has done to the
 * labyrinth: keys found, caches emptied, the secret door revealed, statues
 * taken away, the door one of them was holding fallen shut.
 */
export function effectiveTile(s: CampaignState, stratumId: string, floorIndex: number, x: number, y: number): string {
  const floor = getStratumMap(stratumId)?.floors[floorIndex];
  if (!floor) return '#';
  const raw = tileAt(floor, x, y);
  const key = tileKey(stratumId, floorIndex, x, y);
  switch (raw) {
    case '%':
      return flag(s, `${stratumId}:clue`) ? '.' : '#';
    case 'w':
      return tideState(s, stratumId)?.low ? '.' : 'w';
    case 'L':
      return flag(s, `${stratumId}:${floorIndex}:key`) ? '.' : 'L';
    case 'H':
      // She stood in the door's counterweight niche; with her gone it closes with the door.
      return flag(s, key) ? '#' : raw;
    case 'K':
    case '$':
    case 'C':
    case 'A':
    case 'T':
    case 'P':
    case 'X':
      return flag(s, key) ? '.' : raw;
    case 'D': {
      // The door stands open only while the statue beside it still holds it.
      const holder = DIRS.map(([dx, dy]) => [x + dx, y + dy] as const).find(([hx, hy]) => tileAt(floor, hx, hy) === 'H');
      return holder && flag(s, tileKey(stratumId, floorIndex, holder[0], holder[1])) ? '#' : '.';
    }
    default:
      return raw;
  }
}

const SOLID = new Set(['#', 'L', 'S', 'H', 'T', 'P', 'w']);

/** Whether a party could stand on this tile at all (gates and bosses aside). */
export function canEnter(s: CampaignState, stratumId: string, floorIndex: number, x: number, y: number): boolean {
  return !SOLID.has(effectiveTile(s, stratumId, floorIndex, x, y));
}
const eliteKey = (exp: Expedition, id: string) => `${exp.stratumId}:${exp.floor}:${id}`;

/** Elites currently roaming the party's floor, with where they stand. */
export function elitesHere(s: CampaignState, exp: Expedition): { key: string; group: string[]; pos: GridPoint }[] {
  return floorOf(exp)
    .elites.filter((e) => (s.dungeon.eliteRespawnHour[eliteKey(exp, e.id)] ?? 0) <= s.simHour)
    .map((e) => {
      const key = eliteKey(exp, e.id);
      const path = elitePath(exp.stratumId, exp.floor, e.id);
      return { key, group: e.group, pos: path[(exp.elitePositions[key] ?? 0) % path.length] as GridPoint };
    });
}

/** The party notes what it can see: its own tile and everything touching it. */
function discover(s: CampaignState, exp: Expedition): void {
  const floor = floorOf(exp);
  const key = floorKey(exp.stratumId, exp.floor);
  const rows = (s.dungeon.discovered[key] ??= floor.grid.map((row) => '0'.repeat(row.length)));
  for (let y = exp.y - 1; y <= exp.y + 1; y++) {
    const row = rows[y];
    if (row === undefined) continue;
    const chars = row.split('');
    for (let x = exp.x - 1; x <= exp.x + 1; x++) if (x >= 0 && x < chars.length) chars[x] = '1';
    rows[y] = chars.join('');
  }
}

function place(s: CampaignState, exp: Expedition, floorIndex: number, tile: string): void {
  const floor = getStratumMap(exp.stratumId)?.floors[floorIndex] ?? fail('There is no such floor.');
  const [x, y] = findTile(floor, tile) ?? fail('That floor has no way in.');
  Object.assign(exp, { floor: floorIndex, x, y, prevX: x, prevY: y, facing: floor.start_facing });
  s.dungeon.reachedFloor[exp.stratumId] = Math.max(s.dungeon.reachedFloor[exp.stratumId] ?? 0, floorIndex);
  // Discoveries in the first stratum keep their short names; deeper ones carry the stratum's.
  const prefix = exp.stratumId === 'stratum_1' ? '' : `${exp.stratumId}:`;
  if (floorIndex >= 1) addMilestone(s, `${prefix}floor_${floorIndex + 1}`);
  if (floorIndex >= 2) addMilestone(s, `${prefix}floor_2`);
  discover(s, exp);
}

function chartedStratum(s: CampaignState): string {
  const candidates = [s.frontierStratumId, ...s.strata.filter((st) => st.secured).map((st) => st.id).reverse()];
  return candidates.find((id): id is string => !!id && !!getStratumMap(id)) ?? fail('No stratum of the labyrinth can be entered in this prototype.');
}

export function startExpedition(s: CampaignState, cfg: GameConfig, partyIds: string[], floor = 0, stratumId?: string): void {
  if (s.expedition) fail('An expedition is already under way.');
  if (!frontierHeld(s.phase)) fail('The labyrinth cannot be reached while the frontier is overrun.');
  const sid = stratumId ?? chartedStratum(s);
  const stratum = s.strata.find((st) => st.id === sid) ?? fail(`Unknown stratum "${sid}".`);
  if (!stratum.secured && s.frontierStratumId !== sid) fail(`${stratum.name} has not been reached yet.`);
  if (!getStratumMap(sid)) fail(`${stratum.name} is not charted in this prototype.`);
  if (!Number.isInteger(floor) || floor < 0 || floor > (s.dungeon.reachedFloor[sid] ?? 0)) fail('The guild has not found a way down to that floor yet.');

  const unique = [...new Set(partyIds)];
  if (unique.length === 0) fail('Choose at least one adventurer.');
  if (unique.length > cfg.roster.max_dungeon_party) fail(`An expedition takes at most ${cfg.roster.max_dungeon_party} adventurers.`);
  const members = unique.map((id) => getAdventurer(s, id));
  for (const adv of members) {
    if (adv.condition !== 'ready') fail(`${adv.name} is solidified and cannot join.`);
    if (adv.assignment.type === 'defense') fail(`${adv.name} is holding ${adv.assignment.structureId}; relieve her first.`);
  }
  for (const adv of members) adv.assignment = { type: 'expedition' };
  const exp: Expedition = {
    stratumId: sid,
    partyIds: unique,
    startedAtHour: s.simHour,
    carriedStatueIds: [],
    floor: 0,
    x: 0,
    y: 0,
    facing: 0,
    prevX: 0,
    prevY: 0,
    danger: 0,
    loot: { ward_energy: 0, construction_materials: 0, restoration_reagent: 0 },
    combat: null,
    elitePositions: {},
    sprung: [],
    exhibits: [],
    pack: loadPack(s, cfg),
    report: [],
  };
  s.expedition = exp;
  place(s, exp, floor, floor === 0 ? 'E' : '<');
  log(s, 'expedition_started', `An expedition of ${unique.length} entered ${stratum.name}, floor ${floor + 1}.`);
  // Walking down the charted floors takes time.
  if (floor > 0) advanceHours(s, cfg, floor * cfg.dungeon.floor_travel_hours);
}

/** Leave the labyrinth on foot: from the entrance, or back up the stairs the party arrived by. */
export function endExpedition(s: CampaignState, cfg: GameConfig): void {
  const exp = expedition(s);
  if (exp.combat) fail('The party is in a fight.');
  const tile = tileAt(floorOf(exp), exp.x, exp.y);
  if (!(tile === 'E' || tile === '<')) fail('The party can only leave from the entrance or from the stairs leading up.');
  const hours = exp.floor * cfg.dungeon.floor_travel_hours;
  if (hours > 0) {
    ensureClockFree(s);
    advanceHours(s, cfg, hours);
  }
  if (s.expedition) finishExpedition(s, 'The expedition returned to the sanctuary.');
}

/** The seal pulls the party home from anywhere, for a price in ward energy. */
export function recallExpedition(s: CampaignState, cfg: GameConfig): void {
  const exp = expedition(s);
  ensureClockFree(s);
  if (exp.combat) fail('The seal cannot reach the party in the middle of a fight.');
  pay(s, { ward_energy: cfg.dungeon.recall.ward_energy }, 'recall the expedition');
  advanceHours(s, cfg, cfg.dungeon.recall.hours);
  if (s.expedition) finishExpedition(s, 'The seal recalled the expedition to the sanctuary.');
}

function afterStep(s: CampaignState, cfg: GameConfig): void {
  advanceMinutes(s, cfg, cfg.clock.dungeon_step_minutes);
  const exp = s.expedition;
  if (!exp) return; // called home while walking
  const floor = floorOf(exp);
  discover(s, exp);
  const tile = effectiveTile(s, exp.stratumId, exp.floor, exp.x, exp.y);
  const here = partyTile(exp);
  const medium = getStratumMap(exp.stratumId)?.medium ?? 'stone';

  if (tile === 'K') {
    setFlag(s, here);
    setFlag(s, `${exp.stratumId}:${exp.floor}:key`);
    exp.report = ['The party finds a key. A locked door on this floor will open to it.'];
  } else if (tile === '$') {
    setFlag(s, here);
    for (const id of RESOURCE_IDS) exp.loot[id] += floor.cache?.[id] ?? 0;
    exp.report = [`A store nobody has touched since the fall: ${formatCost(floor.cache ?? {})}.`];
  } else if (tile === 'C') {
    setFlag(s, here);
    setFlag(s, `${exp.stratumId}:clue`);
    exp.report = ['A ring of small keys, left where only someone who walked into the trap would find it. Somewhere above, a wall is not a wall.'];
    log(s, 'clue', 'The party found a ring of keys. A hidden way has opened on another floor.');
  } else if (tile === 'A') {
    setFlag(s, here);
    exp.report = ['It was bait.'];
    startCombat(s, cfg, 'normal', floor.ambush ?? [], null);
    return;
  } else if (tile === '^' && !exp.sprung.includes(here)) {
    exp.sprung.push(here);
    exp.danger = Math.min(99, exp.danger + cfg.dungeon.trap_danger);
    exp.report = ['A plate sinks underfoot and pale dust bursts from the walls.'];
    for (const id of [...exp.partyIds]) {
      const adv = getAdventurer(s, id);
      addGauge(adv, Math.round(cfg.dungeon.trap_gauge * (1 - statsOf(cfg, adv).gaugeResist)), medium);
      if (adv.gauge >= 100) solidify(s, cfg, id, 'dungeon', here, medium);
    }
    if (exp.partyIds.length === 0) {
      wipeExpedition(s, here);
      return;
    }
  }

  if (tile === '~') {
    exp.report = ['Pale mist clings to the party. The solidification creeps a little further.'];
    for (const id of [...exp.partyIds]) {
      const adv = getAdventurer(s, id);
      addGauge(adv, Math.round(cfg.dungeon.mist_gauge * (1 - statsOf(cfg, adv).gaugeResist)), medium);
      if (adv.gauge >= 100) solidify(s, cfg, id, 'dungeon', partyTile(exp), medium);
    }
    if (exp.partyIds.length === 0) {
      wipeExpedition(s, partyTile(exp));
      return;
    }
  }

  // Roaming elites take one step for each step the party takes.
  for (const elite of floor.elites) {
    const key = eliteKey(exp, elite.id);
    if ((s.dungeon.eliteRespawnHour[key] ?? 0) > s.simHour) continue;
    const path = elitePath(exp.stratumId, exp.floor, elite.id);
    const index = ((exp.elitePositions[key] ?? 0) + 1) % path.length;
    exp.elitePositions[key] = index;
    const [ex, ey] = path[index] as GridPoint;
    if (ex === exp.x && ey === exp.y) {
      startCombat(s, cfg, 'elite', elite.group, key);
      return;
    }
  }

  if (tile === '.' || tile === '~' || tile === '=' || tile === '^') {
    const enc = cfg.dungeon.encounter;
    const secured = s.strata.find((st) => st.id === exp.stratumId)?.secured ?? false;
    const gain = enc.gain_min + randomInt(s, enc.gain_max - enc.gain_min + 1);
    exp.danger += secured ? Math.round(gain * enc.secured_multiplier) : gain;
    if (exp.danger >= 100 && floor.encounters.length > 0) {
      exp.danger = 0;
      startCombat(s, cfg, 'normal', floor.encounters[randomInt(s, floor.encounters.length)] as string[], null);
    }
  }
}

export function moveParty(s: CampaignState, cfg: GameConfig, move: MoveKind): void {
  const exp = expedition(s);
  if (exp.combat) fail('The party is in a fight.');
  if (move === 'turn_left' || move === 'turn_right') {
    exp.facing = (exp.facing + (move === 'turn_left' ? 3 : 1)) % 4;
    return;
  }
  ensureClockFree(s);
  const offset = { forward: 0, right: 1, back: 2, left: 3 }[move];
  const dir = (exp.facing + offset) % 4;
  const [dx, dy] = DIRS[dir] as GridPoint;
  const nx = exp.x + dx;
  const ny = exp.y + dy;
  const floor = floorOf(exp);
  const tile = effectiveTile(s, exp.stratumId, exp.floor, nx, ny);
  if (tile === '#') fail('A wall blocks the way.');
  if (tile === 'L') fail('The door is locked. Its key must be somewhere on this floor.');
  if (tile === 'w') fail(`The corridor is flooded. The water falls in ${tideState(s, exp.stratumId)?.changesInHours ?? '?'} hours.`);
  if (tile === 'S' || tile === 'H' || tile === 'T' || tile === 'P') fail('A statue stands in the way.');

  if (tile === '=') {
    const key = tileKey(exp.stratumId, exp.floor, nx, ny);
    if (!s.dungeon.openGates.includes(key)) {
      const gate = floor.gates.find((g) => g.x === nx && g.y === ny);
      // Standing on the gate's "open_from" side means walking the opposite way into it.
      const needed = gate ? (DIR_LETTERS.indexOf(gate.open_from) + 2) % 4 : dir;
      if (dir !== needed) fail('This gate is barred from the other side.');
      s.dungeon.openGates.push(key);
      exp.report = ['The party unbars the gate. It will stay open from now on.'];
      log(s, 'gate_opened', `A shortcut was opened on floor ${exp.floor + 1}.`);
    }
  }

  const stratum = s.strata.find((st) => st.id === exp.stratumId);
  if (tile === 'B' && stratum && !stratum.bossDefeated) {
    startCombat(s, cfg, 'boss', getStratumMap(exp.stratumId)?.boss ?? [], null);
    return;
  }
  if (tile === 'X') {
    startCombat(s, cfg, 'hidden', floor.hidden_boss ?? [], tileKey(exp.stratumId, exp.floor, nx, ny));
    return;
  }
  const blocking = elitesHere(s, exp).find((e) => e.pos[0] === nx && e.pos[1] === ny);
  if (blocking) {
    startCombat(s, cfg, 'elite', blocking.group, blocking.key);
    return;
  }

  exp.prevX = exp.x;
  exp.prevY = exp.y;
  exp.x = nx;
  exp.y = ny;
  exp.report = [];
  afterStep(s, cfg);
}

export function useStairs(s: CampaignState, cfg: GameConfig): void {
  const exp = expedition(s);
  ensureClockFree(s);
  if (exp.combat) fail('The party is in a fight.');
  const tile = tileAt(floorOf(exp), exp.x, exp.y);
  if (tile === '>') place(s, exp, exp.floor + 1, '<');
  else if (tile === '<' && exp.floor > 0) place(s, exp, exp.floor - 1, '>');
  else fail('There are no stairs here.');
  exp.danger = 0;
  exp.report = [`The party reaches floor ${exp.floor + 1}: ${floorOf(exp).name}.`];
  advanceMinutes(s, cfg, cfg.clock.dungeon_step_minutes);
}

export function gather(s: CampaignState, cfg: GameConfig): void {
  const exp = expedition(s);
  ensureClockFree(s);
  if (exp.combat) fail('The party is in a fight.');
  const floor = floorOf(exp);
  if (tileAt(floor, exp.x, exp.y) !== 'G' || !floor.gather_yield) fail('There is nothing to gather here.');
  const key = partyTile(exp);
  const last = s.dungeon.gatheredAtHour[key];
  const ready = last === undefined ? 0 : last + cfg.dungeon.gather_cooldown_hours;
  if (s.simHour < ready) fail(`This site was worked recently. It will be worth returning in ${ready - s.simHour} hours.`);
  for (const id of RESOURCE_IDS) exp.loot[id] += floor.gather_yield[id] ?? 0;
  s.dungeon.gatheredAtHour[key] = s.simHour;
  exp.danger = Math.min(99, exp.danger + cfg.dungeon.gather_danger); // the noise carries
  exp.report = [`The party gathers ${formatCost(floor.gather_yield)}.`];
  advanceMinutes(s, cfg, cfg.dungeon.gather_minutes);
}

/** Take a statue from the tile the party stands on. She is only safe once they get home. */
export function pickUpStatue(s: CampaignState, adventurerId: string): void {
  const exp = s.expedition ?? fail('A statue in the labyrinth can only be recovered by an expedition.');
  const adv = getAdventurer(s, adventurerId);
  const statue = s.statues.find((st) => st.adventurerId === adventurerId) ?? fail(`${adv.name} is not solidified.`);
  // A permanent statue cannot be restored, but she can still be brought home.
  if (statue.locationType !== 'dungeon' || statue.retrievedAtHour !== null) fail(`${adv.name}'s statue is not in the labyrinth.`);
  if (exp.carriedStatueIds.includes(adventurerId)) fail(`${adv.name}'s statue is already being carried.`);
  const where = parseTileKey(statue.locationId);
  if (where && statue.locationId !== partyTile(exp)) fail(`${adv.name}'s statue is not here.`);
  if (exp.carriedStatueIds.length + exp.exhibits.length >= exp.partyIds.length) fail('Everyone in the party is already carrying a statue.');
  exp.carriedStatueIds.push(adventurerId);
  log(s, 'statue_secured', statue.permanent ? `The expedition took up ${adv.name}'s statue to carry her home.` : `The expedition secured ${adv.name}'s statue. She is safe once they return.`);
}

/** Debug: a party member falls on the spot. */
export function reportCasualty(s: CampaignState, cfg: GameConfig, adventurerId: string, locationId?: string): void {
  const exp = expedition(s);
  const adv = getAdventurer(s, adventurerId);
  if (adv.assignment.type !== 'expedition') fail(`${adv.name} is not on the expedition.`);
  const where = locationId ?? partyTile(exp);
  solidify(s, cfg, adventurerId, 'dungeon', where);
  if (exp.partyIds.length === 0) wipeExpedition(s, where);
}

export function debugTeleport(s: CampaignState, floor: number, x: number, y: number): void {
  const exp = expedition(s);
  if (!getStratumMap(exp.stratumId)?.floors[floor]) fail('There is no such floor.');
  if (!canEnter(s, exp.stratumId, floor, x, y)) fail('Nobody could stand there.');
  Object.assign(exp, { floor, x, y, prevX: x, prevY: y, combat: null });
  s.dungeon.reachedFloor[exp.stratumId] = Math.max(s.dungeon.reachedFloor[exp.stratumId] ?? 0, floor);
  discover(s, exp);
}

export function debugRevealMap(s: CampaignState): void {
  const exp = expedition(s);
  getStratumMap(exp.stratumId)?.floors.forEach((floor, i) => {
    s.dungeon.discovered[floorKey(exp.stratumId, i)] = floor.grid.map((row) => '1'.repeat(row.length));
  });
  s.dungeon.reachedFloor[exp.stratumId] = (getStratumMap(exp.stratumId)?.floors.length ?? 1) - 1;
}

function fieldReady(s: CampaignState): Expedition {
  const exp = expedition(s);
  ensureClockFree(s);
  if (exp.combat) fail('The party is in a fight; give the order there.');
  return exp;
}

/** Use a carried supply between fights. */
export function fieldUseItem(s: CampaignState, cfg: GameConfig, itemId: string, targetId: string): void {
  const exp = fieldReady(s);
  const item = cfg.supplies.items[itemId] ?? fail('There is no such supply.');
  if ((exp.pack[itemId] ?? 0) <= 0) fail(`The party has no ${item.name} left.`);
  if (!exp.partyIds.includes(targetId)) fail(`${item.name} needs someone in the party.`);
  exp.pack[itemId] = (exp.pack[itemId] ?? 0) - 1;
  exp.report = [`${applyRemedy(item.effect, getAdventurer(s, targetId), 1)}.`];
  advanceMinutes(s, cfg, cfg.dungeon.field_action_minutes);
}

/** Use a healing or purging skill between fights. */
export function fieldUseSkill(s: CampaignState, cfg: GameConfig, adventurerId: string, skillId: string, targetId: string): void {
  const exp = fieldReady(s);
  const adv = getAdventurer(s, adventurerId);
  const skill = cfg.dungeon.skills[skillId];
  if (!exp.partyIds.includes(adventurerId)) fail(`${adv.name} is not with the party.`);
  if (!skill || skillRank(adv, skillId) < 1) fail(`${adv.name} does not know that skill.`);
  const effect = skill.effect;
  if (effect.kind !== 'heal' && effect.kind !== 'purge') fail(`${skill.name} can only be used in a fight.`);
  if (!exp.partyIds.includes(targetId)) fail(`${skill.name} needs someone in the party.`);
  if (adv.sp < skill.sp) fail(`${adv.name} does not have the skill points for ${skill.name}.`);
  adv.sp -= skill.sp;
  const strength = rankScale(cfg, skillRank(adv, skillId)) * statsOf(cfg, adv).support;
  exp.report = [`${adv.name} uses ${skill.name}: ${applyRemedy(effect, getAdventurer(s, targetId), strength)}.`];
  advanceMinutes(s, cfg, cfg.dungeon.field_action_minutes);
}

/** Statues of the long lost that stand next to the party and could be carried home. */
export function statuesInReach(s: CampaignState, exp: Expedition): { key: string; holdsDoor: boolean; prized: boolean }[] {
  return DIRS.map(([dx, dy]) => [exp.x + dx, exp.y + dy] as const)
    .map(([x, y]) => ({ tile: effectiveTile(s, exp.stratumId, exp.floor, x, y), key: tileKey(exp.stratumId, exp.floor, x, y) }))
    .filter((n) => n.tile === 'H' || n.tile === 'T' || n.tile === 'P')
    .map((n) => ({ key: n.key, holdsDoor: n.tile === 'H', prized: n.tile === 'P' }));
}

/**
 * Take up one of the long-lost statues beside the party to bring her home to
 * the memorial. It changes nothing in the guild's favour. If she was holding
 * a door open, the door shuts for good.
 */
export function takeStatue(s: CampaignState): void {
  const exp = expedition(s);
  if (exp.combat) fail('The party is in a fight.');
  const target = statuesInReach(s, exp)[0] ?? fail('There is no statue here that can be carried.');
  if (exp.carriedStatueIds.length + exp.exhibits.length >= exp.partyIds.length) fail('Everyone in the party is already carrying a statue.');
  if (target.prized && !s.milestones.includes('keeper')) fail('The Keeper will not let her be touched.');
  setFlag(s, target.key);
  exp.exhibits.push(target.key);
  exp.report = [target.prized ? 'This is the one the Keeper kept from Iwanaga. They take her up as carefully as they have ever carried anything.' : target.holdsDoor ? 'They lift her down. Behind them the door she was holding grinds shut, and will not open again.' : 'They take her up between them. She is lighter than she looks.'];
}
