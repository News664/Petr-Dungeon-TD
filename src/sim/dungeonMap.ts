import raw from '../../config/dungeon_maps.json';
import type { Resources } from './types';

export type GridPoint = [number, number];

export interface FloorData {
  name: string;
  start_facing: number;
  grid: string[];
  /** Gates open only when first entered from the given side; they stay open afterwards. */
  gates: { x: number; y: number; open_from: 'N' | 'E' | 'S' | 'W' }[];
  elites: { id: string; group: string[]; loop: GridPoint[] }[];
  gather_yield?: Partial<Resources>;
  encounters: string[][];
}

export interface StratumMap {
  /** What this stratum's creatures turn their victims into. */
  medium: string;
  boss: string[];
  floors: FloorData[];
}

const maps = raw as unknown as Record<string, StratumMap | string>;

export function getStratumMap(stratumId: string): StratumMap | undefined {
  const map = maps[stratumId];
  return typeof map === 'object' ? map : undefined;
}

/** Facing index -> step. 0 north, 1 east, 2 south, 3 west. */
export const DIRS: GridPoint[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];
export const DIR_LETTERS = ['N', 'E', 'S', 'W'] as const;

export function tileAt(floor: FloorData, x: number, y: number): string {
  return floor.grid[y]?.[x] ?? '#';
}

export function findTile(floor: FloorData, tile: string): GridPoint | null {
  for (let y = 0; y < floor.grid.length; y++) {
    const x = (floor.grid[y] as string).indexOf(tile);
    if (x >= 0) return [x, y];
  }
  return null;
}

export const floorKey = (stratumId: string, floor: number) => `${stratumId}:${floor}`;
export const tileKey = (stratumId: string, floor: number, x: number, y: number) => `${stratumId}:${floor}:${x},${y}`;

/** Parse a statue or tile key back into its parts. */
export function parseTileKey(key: string): { stratumId: string; floor: number; x: number; y: number } | null {
  const m = /^(.+):(\d+):(\d+),(\d+)$/.exec(key);
  return m ? { stratumId: m[1] as string, floor: Number(m[2]), x: Number(m[3]), y: Number(m[4]) } : null;
}

const loopCache = new Map<string, GridPoint[]>();

/** Every tile of an elite's patrol loop, in walking order. */
export function elitePath(stratumId: string, floor: number, eliteId: string): GridPoint[] {
  const key = `${stratumId}:${floor}:${eliteId}`;
  let path = loopCache.get(key);
  if (!path) {
    path = [];
    const corners = getStratumMap(stratumId)?.floors[floor]?.elites.find((e) => e.id === eliteId)?.loop ?? [];
    corners.forEach(([x, y], i) => {
      const [nx, ny] = corners[(i + 1) % corners.length] as GridPoint;
      const steps = Math.max(Math.abs(nx - x), Math.abs(ny - y));
      for (let k = 0; k < steps; k++) (path as GridPoint[]).push([x + Math.sign(nx - x) * k, y + Math.sign(ny - y) * k]);
    });
    loopCache.set(key, path);
  }
  return path;
}
