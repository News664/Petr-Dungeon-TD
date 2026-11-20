import raw from '../../config/defense_maps.json';
import type { BattleKind, DefenseMapId } from './types';

export type Point = [number, number];

export interface WaveGroup {
  lane: number;
  enemy: string;
  count: number;
  interval_seconds: number;
  delay_seconds?: number;
}

export interface Wave {
  start_seconds: number;
  groups: WaveGroup[];
}

export interface DefenseMapData {
  name: string;
  width: number;
  height: number;
  gate: Point;
  lane_names: string[];
  lanes: Point[][];
  /** Places where a structure may stand. */
  sites: Record<string, Point>;
  /** Built for a ready-made campaign, and by the 'recommended layout' button. */
  default_layout: { site: string; type: string }[];
  /** Always present; cannot be removed. */
  fixed_layout: { site: string; type: string }[];
  /** Automated weapons (sanctuary only). */
  turrets: Point[];
  waves: Wave[];
  /** The gentler script used for the prologue's first defense. */
  tutorial_waves: Wave[];
  /** Replaces `waves` while the guild's frontier is in the named stratum. */
  waves_by_frontier?: Record<string, Wave[]>;
}

const maps = raw as unknown as Record<DefenseMapId, DefenseMapData>;

export function getDefenseMap(id: DefenseMapId): DefenseMapData {
  return maps[id];
}

interface LaneGeometry {
  points: Point[];
  /** Cumulative distance at each point. */
  cumulative: number[];
  length: number;
}

const geometryCache = new Map<string, LaneGeometry>();

function laneGeometry(map: DefenseMapId, lane: number): LaneGeometry {
  const key = `${map}:${lane}`;
  let geo = geometryCache.get(key);
  if (!geo) {
    const points = getDefenseMap(map).lanes[lane] ?? [];
    const cumulative = [0];
    for (let i = 1; i < points.length; i++) {
      const [ax, ay] = points[i - 1] as Point;
      const [bx, by] = points[i] as Point;
      cumulative.push((cumulative[i - 1] as number) + Math.hypot(bx - ax, by - ay));
    }
    geo = { points, cumulative, length: cumulative[cumulative.length - 1] ?? 0 };
    geometryCache.set(key, geo);
  }
  return geo;
}

/** Lane length in map units. */
export function laneLength(map: DefenseMapId, lane: number): number {
  return laneGeometry(map, lane).length;
}

/** Position of a point `distance` map units along a lane. */
export function lanePoint(map: DefenseMapId, lane: number, distance: number): Point {
  const geo = laneGeometry(map, lane);
  const d = Math.max(0, Math.min(geo.length, distance));
  let i = 1;
  while (i < geo.cumulative.length - 1 && (geo.cumulative[i] as number) < d) i++;
  const start = geo.cumulative[i - 1] as number;
  const span = (geo.cumulative[i] as number) - start;
  const t = span === 0 ? 0 : (d - start) / span;
  const [ax, ay] = geo.points[i - 1] as Point;
  const [bx, by] = geo.points[i] as Point;
  return [ax + (bx - ax) * t, ay + (by - ay) * t];
}

/** Which wave script applies: the named depth's if the map has one, otherwise the map's own. */
export function wavesFor(map: DefenseMapId, kind?: BattleKind, depth?: string | null): Wave[] {
  const data = getDefenseMap(map);
  if (kind === 'tutorial_defense') return data.tutorial_waves;
  return (depth ? data.waves_by_frontier?.[depth] : undefined) ?? data.waves;
}

/** Every wave group in map order, with the wave it belongs to. */
export function flatGroups(map: DefenseMapId, kind?: BattleKind, depth?: string | null): { wave: number; start: number; group: WaveGroup }[] {
  return wavesFor(map, kind, depth).flatMap((w, wave) =>
    w.groups.map((group) => ({ wave, start: w.start_seconds + (group.delay_seconds ?? 0), group })),
  );
}

/** A flyer's path: straight from its lane's mouth to the gate. */
export function airLength(map: DefenseMapId, lane: number): number {
  const data = getDefenseMap(map);
  const [sx, sy] = data.lanes[lane]?.[0] ?? data.gate;
  return Math.hypot(data.gate[0] - sx, data.gate[1] - sy);
}

export function airPoint(map: DefenseMapId, lane: number, distance: number): Point {
  const data = getDefenseMap(map);
  const [sx, sy] = data.lanes[lane]?.[0] ?? data.gate;
  const length = airLength(map, lane);
  const t = length === 0 ? 1 : Math.max(0, Math.min(1, distance / length));
  return [sx + (data.gate[0] - sx) * t, sy + (data.gate[1] - sy) * t];
}
