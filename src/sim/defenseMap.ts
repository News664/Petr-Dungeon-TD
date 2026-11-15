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
  /** Structure id -> position. */
  slots: Record<string, Point>;
  /** Automated weapons (sanctuary only). */
  turrets: Point[];
  waves: Wave[];
  /** The gentler script used for the prologue's first defense. */
  tutorial_waves: Wave[];
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

export function wavesFor(map: DefenseMapId, kind?: BattleKind): Wave[] {
  const data = getDefenseMap(map);
  return kind === 'tutorial_defense' ? data.tutorial_waves : data.waves;
}

/** Every wave group in map order, with the wave it belongs to. */
export function flatGroups(map: DefenseMapId, kind?: BattleKind): { wave: number; start: number; group: WaveGroup }[] {
  return wavesFor(map, kind).flatMap((w, wave) =>
    w.groups.map((group) => ({ wave, start: w.start_seconds + (group.delay_seconds ?? 0), group })),
  );
}
