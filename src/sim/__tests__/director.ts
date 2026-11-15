/**
 * A scripted guild master that plays the whole slice through public commands:
 * prologue, weekly defenses, expeditions, rescue and recovery, up to the boss.
 * It plays carefully rather than cleverly; it exists to prove the campaign can
 * be finished and to show how long that takes.
 */
import { apply, applyAll, createCampaign, defaultConfig as cfg, findTile, getStratumMap, parseTileKey, recoverableStatues, repairCost, rosterCount, tileAt, treatmentCost } from '../index';
import type { Adventurer, CampaignState, Command } from '../index';
import { fightOut, route, stepTo } from './autoplay';

const PREFERRED: Record<string, string[]> = { watchtower: ['Gunner', 'Alchemist'], bunker: ['Guardian'], support_station: ['Medic'] };
const WHOLE: Command = { type: 'battle_tick', ticks: cfg.defense.ticks_per_second * 900 };
export const BOSS_LEVEL = 5;

const ready = (s: CampaignState) => s.adventurers.filter((a) => a.condition === 'ready');
const idle = (s: CampaignState) => ready(s).filter((a) => a.assignment.type === 'idle');
const tryApply = (s: CampaignState, cmd: Command) => apply(s, cmd).state;

function defend(state: CampaignState): CampaignState {
  let s = state;
  const map = s.pendingBattle!.map;
  for (const d of s.structures) if (d.occupantId) s = applyAll(s, [{ type: 'unassign_defender', adventurerId: d.occupantId }]);
  s = applyAll(s, [{ type: 'battle_start' }]);
  const pool = [...idle(s)].sort((a, b) => b.level - a.level);
  const open = s.structures.filter((d) => d.map === map && d.hp > 0);
  for (const pass of [0, 1]) {
    for (const d of open) {
      if (s.structures.find((x) => x.id === d.id)?.occupantId) continue;
      // First choice of class for this kind of post, then second choice, then (second pass) anyone.
      const wanted = pass === 1 ? [undefined] : (PREFERRED[d.type] ?? []);
      let i = -1;
      for (const classId of wanted) {
        i = pool.findIndex((a) => classId === undefined || a.classId === classId);
        if (i >= 0) break;
      }
      const pick = i >= 0 ? pool.splice(i, 1)[0] : undefined;
      if (!pick) continue;
      s = applyAll(s, [
        { type: 'assign_defender', adventurerId: pick.id, structureId: d.id },
        { type: 'set_target_priority', adventurerId: pick.id, priority: pick.classId === 'Gunner' ? 'petrifier' : 'first' },
      ]);
    }
  }
  s = applyAll(s, [{ type: 'battle_begin' }, WHOLE, { type: 'battle_finish' }]);
  if (s.pendingMiracle) s = applyAll(s, [{ type: 'choose_miracle_targets', adventurerIds: s.pendingMiracle.eligibleIds.slice(0, s.pendingMiracle.count) }]);
  return s;
}

function housekeeping(state: CampaignState): CampaignState {
  let s = state;
  for (const st of s.statues) {
    if (st.retrievedAtHour !== null && st.treatment === 'none' && !st.permanent && s.resources.restoration_reagent >= treatmentCost(s, cfg, st)) {
      s = tryApply(s, { type: 'queue_treatment', adventurerId: st.adventurerId });
    }
  }
  for (const d of s.structures) {
    if (d.hp < d.maxHp && s.resources.construction_materials >= repairCost(cfg, d) + 15) s = tryApply(s, { type: 'repair_structure', structureId: d.id });
  }
  if (s.phase === 'COUNTEROFFENSIVE_PREPARATION' && !s.rebuild) s = tryApply(s, { type: 'start_frontier_rebuild' });
  if (recoverableStatues(s, 'frontier').length > 0) s = tryApply(s, { type: 'frontier_recovery_sortie' });
  // Too few left to hold a wall: pay for replacements while the stores allow it.
  const fighters = () => ready(s).length + s.statues.filter((st) => st.retrievedAtHour !== null && !st.permanent).length;
  while (fighters() < 6 && s.seal.freeCredits === 0) {
    const counts = (c: string) => ready(s).filter((a) => a.classId === c).length;
    const need = [...cfg.roster.classes].sort((a, b) => counts(a) - counts(b))[0]!;
    const next = tryApply(s, { type: 'summon', classId: need, emergency: true });
    if (next === s) break;
    s = next;
  }
  while (s.seal.freeCredits > 0 && rosterCount(s) < cfg.roster.max_roster) {
    const counts = (c: string) => s.adventurers.filter((a) => a.classId === c && a.condition !== 'lost').length;
    const need = [...cfg.roster.classes].sort((a, b) => counts(a) - counts(b))[0]!;
    s = applyAll(s, [{ type: 'summon', classId: need }]);
  }
  return s;
}

function pickParty(s: CampaignState): Adventurer[] {
  const pool = [...idle(s)].sort((a, b) => b.level - a.level || b.hp - a.hp);
  const take = (classId: string, n: number) => pool.filter((a) => a.classId === classId).slice(0, n);
  const core = [...take('Guardian', 1), ...take('Gunner', 2), ...take('Alchemist', 1), ...take('Medic', 1)];
  const rest = pool.filter((a) => !core.includes(a));
  return [...core, ...rest].slice(0, cfg.roster.max_dungeon_party);
}

const fit = (a: Adventurer) => a.hp >= a.maxHp * 0.85 && a.sp >= a.maxSp * 0.75 && a.gauge <= 15;

function tired(s: CampaignState, size: number): boolean {
  const exp = s.expedition;
  if (!exp) return true;
  const members = exp.partyIds.map((id) => s.adventurers.find((a) => a.id === id)!);
  const medic = members.find((m) => m.classId === 'Medic');
  return members.length < size || members.some((m) => m.hp < m.maxHp * 0.5 || m.gauge >= 45) || (medic ? medic.sp < 9 : true);
}

/** Walk to a tile unless the party is wiped, gets tired on the way (when `careful`), or an attack arrives. */
function go(state: CampaignState, x: number, y: number, size: number, careful: boolean): CampaignState {
  let s = state;
  for (let guard = 0; guard < 400; guard++) {
    if (!s.expedition || s.pendingBattle) return s;
    if (s.expedition.combat) {
      s = fightOut(s).state;
      continue;
    }
    if (s.expedition.x === x && s.expedition.y === y) return s;
    if (careful && tired(s, size)) return s;
    const path = route(s, x, y);
    if (!path?.length) return s;
    s = stepTo(s, path[0]![0], path[0]![1]);
  }
  return s;
}

function goHome(state: CampaignState): CampaignState {
  let s = state;
  if (!s.expedition || s.pendingBattle) return s;
  const floor = getStratumMap(s.expedition.stratumId)!.floors[s.expedition.floor]!;
  const exit = findTile(floor, s.expedition.floor === 0 ? 'E' : '<')!;
  s = go(s, exit[0], exit[1], 0, false);
  if (s.expedition && !s.expedition.combat && !s.pendingBattle && s.expedition.x === exit[0] && s.expedition.y === exit[1]) s = tryApply(s, { type: 'end_expedition' });
  return s;
}

function expedition(state: CampaignState, party: Adventurer[], bossLevel: number): CampaignState {
  let s = state;
  const map = getStratumMap('stratum_1')!;
  const reached = s.dungeon.reachedFloor.stratum_1 ?? 0;
  const level = Math.min(...party.map((a) => a.level));
  const ids = party.map((a) => a.id);

  // Someone lying in the labyrinth comes first.
  const lost = recoverableStatues(s, 'dungeon')
    .map((st) => ({ st, where: parseTileKey(st.locationId) }))
    .filter((x) => x.where && x.where.floor <= reached)
    .sort((a, b) => a.st.permanenceAtHour - b.st.permanenceAtHour)[0];
  if (lost?.where) {
    s = applyAll(s, [{ type: 'start_expedition', partyIds: ids, floor: lost.where.floor }]);
    s = go(s, lost.where.x, lost.where.y, ids.length, false);
    if (s.expedition && !s.expedition.combat && !s.pendingBattle) {
      for (const st of recoverableStatues(s, 'dungeon')) s = tryApply(s, { type: 'expedition_pickup_statue', adventurerId: st.adventurerId });
    }
    return goHome(s);
  }

  // Otherwise train on the deepest floor the party is ready for, and push on when it has outgrown it.
  const wanted = level >= 3 ? 2 : level >= 2 ? 1 : 0;
  const floorIndex = Math.min(wanted, reached);
  s = applyAll(s, [{ type: 'start_expedition', partyIds: ids, floor: floorIndex }]);

  if (floorIndex === 2 && level >= bossLevel) {
    const boss = findTile(map.floors[2]!, 'B')!;
    s = go(s, boss[0], boss[1] + 1, ids.length, false);
    if (s.expedition && !s.expedition.combat && !s.pendingBattle && !tired(s, ids.length)) {
      s = stepTo(s, boss[0], boss[1]);
      if (s.expedition?.combat) s = fightOut(s).state;
    }
    return goHome(s);
  }

  const floor = map.floors[floorIndex]!;
  const start = findTile(floor, floorIndex === 0 ? 'E' : '<')!;
  const onward = findTile(floor, '>');
  const node = floorIndex === 0 ? findTile(floor, 'G') : null; // the floor-2 site sits inside the elite's loop
  // On the last floor there are no stairs to walk to: patrol out to the far corner instead.
  const far: [number, number] = [floor.grid[0]!.length - 2, floor.grid.length - 2];
  const turn = onward ?? (tileAt(floor, far[0], far[1]) === '.' ? far : null);
  const waypoints = [node, turn, start, turn].filter((p): p is [number, number] => !!p);
  for (let lap = 0; lap < 3 && s.expedition && !tired(s, ids.length) && !s.pendingBattle; lap++) {
    for (const [x, y] of waypoints) {
      s = go(s, x, y, ids.length, true);
      if (!s.expedition || s.pendingBattle || tired(s, ids.length)) break;
      if (tileAt(floor, s.expedition.x, s.expedition.y) === 'G') s = tryApply(s, { type: 'dungeon_gather' });
      if (!s.expedition) break;
      // Outgrown this floor: take the stairs once, so the next party can start below.
      if (onward && wanted > floorIndex && s.expedition && s.expedition.x === onward[0] && s.expedition.y === onward[1]) {
        s = tryApply(s, { type: 'dungeon_stairs' });
        return goHome(s);
      }
    }
  }
  return goHome(s);
}

export interface Playthrough {
  journal: string[];
  state: CampaignState;
  days: number;
  expeditions: number;
  battles: number;
  bossDay: number | null;
  lost: number;
}

export function playSlice(seed: number, maxDays = 90, bossLevel = BOSS_LEVEL): Playthrough {
  let s = createCampaign(cfg, seed, { prologue: true });
  s = applyAll(s, ['Guardian', 'Gunner', 'Alchemist', 'Medic', 'Gunner'].map((classId) => ({ type: 'summon' as const, classId })));
  s = applyAll(s, [{ type: 'prologue_begin_defense' }]);
  s = defend(s);
  let expeditions = 0;
  let battles = 1;
  let bossDay: number | null = null;
  const journal: string[] = [];

  for (let guard = 0; guard < 4000; guard++) {
    if (s.phase === 'GAME_OVER' || s.simHour >= maxDays * 24) break;
    if (bossDay === null && s.strata[0]!.secured) bossDay = Math.floor(s.simHour / 24) + 1;
    if (bossDay !== null && s.simHour >= (bossDay + 14) * 24) break; // two more weeks of ordinary life after the boss
    if (s.pendingBattle) {
      const kind = s.pendingBattle.kind;
      s = defend(s);
      battles += 1;
      journal.push(`d${Math.floor(s.simHour / 24) + 1} ${kind} -> ${s.phase}, statues ${s.statues.length}, ready ${ready(s).length}`);
      continue;
    }
    if (s.expedition) {
      s = goHome(s);
      if (s.expedition && !s.pendingBattle) s = tryApply(s, { type: 'dungeon_recall' });
      continue;
    }
    s = housekeeping(s);
    const untilAttack = s.nextInvasionHour === null ? Infinity : s.nextInvasionHour - s.simHour;
    const party = pickParty(s);
    const canDelve = (s.phase === 'STABLE_FRONTIER' || s.phase === 'DIVINE_EMERGENCY' || s.phase === 'FRONTIER_BREAKTHROUGH') && !s.strata[0]!.secured;
    if (canDelve && party.length >= 4 && party.every(fit) && untilAttack >= 30) {
      const before = s;
      s = expedition(s, party, bossLevel);
      expeditions += 1;
      journal.push(`d${Math.floor(before.simHour / 24) + 1} delve L${Math.min(...party.map((a) => a.level))} -> floor ${(s.dungeon.reachedFloor.stratum_1 ?? 0) + 1} reached, ${s.simHour - before.simHour}h, xp+${s.adventurers.reduce((n, a) => n + a.xp + a.level * 1000, 0) - before.adventurers.reduce((n, a) => n + a.xp + a.level * 1000, 0)}, statues ${s.statues.length}`);
    } else {
      const toMidnight = 24 - (s.simHour % 24);
      s = tryApply(s, { type: 'advance_time', hours: Math.max(1, Math.min(toMidnight, untilAttack)) });
    }
  }
  return { journal, state: s, days: Math.floor(s.simHour / 24) + 1, expeditions, battles, bossDay, lost: s.adventurers.filter((a) => a.condition === 'lost').length };
}
