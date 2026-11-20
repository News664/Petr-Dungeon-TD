import type { GameConfig } from './config';
import { getDefenseMap } from './defenseMap';
import { frontierHeld, getStructure } from './selectors';
import type { CampaignState, DefenseMapId, DefenseStructure } from './types';
import { fail, log } from './util';

/**
 * Where the defensive structures stand. The player chooses the sites; how
 * many of each type may be built on a map is capped. Building is done while
 * taking up positions, never in the middle of the fighting.
 */

function newStructure(cfg: GameConfig, s: { structures: DefenseStructure[] }, map: DefenseMapId, site: string, type: string, fixed: boolean): DefenseStructure {
  const [x, y] = getDefenseMap(map).sites[site] ?? fail('There is no such building site.');
  let n = 1;
  while (s.structures.some((d) => d.id === `${map}_${type}_${n}`)) n += 1;
  const maxHp = cfg.defense.structure_max_hp[type] ?? 100;
  return { id: `${map}_${type}_${n}`, map, type, hp: maxHp, maxHp, occupantId: null, site, x, y, fixed };
}

/** The structures a map starts with: its fixed ones, and optionally the default layout. */
export function initialStructures(cfg: GameConfig, map: DefenseMapId, withDefaults: boolean): DefenseStructure[] {
  const data = getDefenseMap(map);
  const holder = { structures: [] as DefenseStructure[] };
  for (const entry of data.fixed_layout) holder.structures.push(newStructure(cfg, holder, map, entry.site, entry.type, true));
  if (withDefaults) for (const entry of data.default_layout) holder.structures.push(newStructure(cfg, holder, map, entry.site, entry.type, false));
  return holder.structures;
}

/** Whether the guild knows how to build this kind of structure yet. */
export function structureUnlocked(s: CampaignState, cfg: GameConfig, type: string): boolean {
  const needed = cfg.defense.structure_unlock[type];
  return !needed || s.milestones.includes(needed);
}

/** How many more of a type the player may still build on a map. */
export function buildsLeft(s: CampaignState, cfg: GameConfig, map: DefenseMapId, type: string): number {
  const cap = cfg.defense.build_caps[map]?.[type] ?? 0;
  return cap - s.structures.filter((d) => d.map === map && d.type === type && !d.fixed).length;
}

function canChange(s: CampaignState, map: DefenseMapId): void {
  if (s.battle && !(s.battle.deploying && s.battle.outcome === 'ongoing')) fail('Nothing can be built or removed once the fighting has begun.');
  if (map === 'frontier' && !frontierHeld(s.phase)) fail('The frontier is overrun; nothing can be built there.');
  if (s.phase === 'GAME_OVER') fail('The sanctuary has fallen.');
}

export function buildStructure(s: CampaignState, cfg: GameConfig, map: DefenseMapId, site: string, type: string): void {
  canChange(s, map);
  if (!(type in cfg.defense.structure_stats)) fail('There is no such kind of structure.');
  if (!getDefenseMap(map).sites[site]) fail('There is no such building site.');
  if (s.structures.some((d) => d.map === map && d.site === site)) fail('Something already stands there.');
  if (!structureUnlocked(s, cfg, type)) fail(`The guild does not know how to build a ${type.replace(/_/g, ' ')} yet: ${cfg.defense.structure_unlock_text[cfg.defense.structure_unlock[type] ?? ''] ?? 'it must be earned'}.`);
  if (buildsLeft(s, cfg, map, type) <= 0) fail(`No more ${type.replace(/_/g, ' ')}s can be built here.`);
  s.structures.push(newStructure(cfg, s, map, site, type, false));
}

export function demolishStructure(s: CampaignState, structureId: string): void {
  const structure = getStructure(s, structureId);
  canChange(s, structure.map);
  if (structure.fixed) fail('That is part of the sanctuary itself and cannot be removed.');
  if (structure.occupantId) fail('Send its defender back to reserve first.');
  s.structures = s.structures.filter((d) => d.id !== structureId);
}

/** Fill the map's default layout wherever its sites are free and the caps allow. */
export function buildRecommended(s: CampaignState, cfg: GameConfig, map: DefenseMapId): void {
  canChange(s, map);
  let built = 0;
  for (const entry of getDefenseMap(map).default_layout) {
    if (s.structures.some((d) => d.map === map && d.site === entry.site) || buildsLeft(s, cfg, map, entry.type) <= 0) continue;
    s.structures.push(newStructure(cfg, s, map, entry.site, entry.type, false));
    built += 1;
  }
  if (built === 0) fail('There is nothing more to build from the recommended layout.');
  log(s, 'fortified', `The recommended defenses were raised (${built} structures).`);
}
