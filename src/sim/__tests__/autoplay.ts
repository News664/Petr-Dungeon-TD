/** A simple, sensible player for headless dungeon tests and balance probes. */
import { DIRS, apply, applyAll, canEnter, defaultConfig as cfg, effectiveTile, enemyIntent, slide } from '../index';
import type { CampaignState, CombatAction, Command } from '../index';

export function chooseActions(s: CampaignState): Record<string, CombatAction> {
  const exp = s.expedition!;
  const c = exp.combat!;
  const D = cfg.dungeon;
  const foes = c.enemies.filter((e) => e.hp > 0);
  const members = exp.partyIds.map((id) => s.adventurers.find((a) => a.id === id)!);
  const intents = foes.map((e) => enemyIntent(cfg, e));
  const big = intents.some((i) => i && !i.charge && (i.target === 'all' || (i.power ?? 0) >= 1.5));
  const stony = intents.some((i) => (i?.gauge ?? 0) >= 20);
  const weakest = [...foes].sort((a, b) => a.hp - b.hp)[0]!;
  const toughest = [...foes].sort((a, b) => b.hp - a.hp)[0]!;
  const guardianCanWall = members.some((m) => m.classId === 'Guardian' && m.sp >= 6);
  const actions: Record<string, CombatAction> = {};
  let walled = false;
  let misted = false;
  const mended = new Set<string>();

  for (const m of members) {
    const attack: CombatAction = { type: 'attack', target: weakest.id };
    if (m.classId === 'Guardian') {
      if (big && m.sp >= 6 && !walled) {
        walled = true;
        actions[m.id] = { type: 'skill', skillId: 'shield_wall' };
      } else if (!c.taunt && m.sp >= 4 && !Object.values(actions).some((a) => a.type === 'skill' && a.skillId === 'taunt')) {
        actions[m.id] = { type: 'skill', skillId: 'taunt' };
      } else if (big && !guardianCanWall) actions[m.id] = { type: 'guard' };
      else actions[m.id] = m.sp >= 4 ? { type: 'skill', skillId: 'heavy_blow', target: weakest.id } : attack;
    } else if (m.classId === 'Medic') {
      const hurt = members.filter((a) => a.hp / a.maxHp < 0.55 && !mended.has(a.id)).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      const stone = members.filter((a) => a.gauge >= 45 && !mended.has(a.id)).sort((a, b) => b.gauge - a.gauge)[0];
      if (stone && stone.gauge >= 70 && m.sp >= 5) {
        mended.add(stone.id);
        actions[m.id] = { type: 'skill', skillId: 'purge_stone', target: stone.id };
      } else if (hurt && m.sp >= 4) {
        mended.add(hurt.id);
        actions[m.id] = { type: 'skill', skillId: 'mend', target: hurt.id };
      } else if (stone && m.sp >= 5) {
        mended.add(stone.id);
        actions[m.id] = { type: 'skill', skillId: 'purge_stone', target: stone.id };
      } else if (stony && c.wardMist === 0 && m.sp >= 6 && !misted) {
        misted = true;
        actions[m.id] = { type: 'skill', skillId: 'ward_mist' };
      } else actions[m.id] = attack;
    } else if (big && !guardianCanWall) {
      actions[m.id] = { type: 'guard' };
    } else if (m.classId === 'Gunner') {
      if (foes.length >= 3 && m.sp >= 6) actions[m.id] = { type: 'skill', skillId: 'suppressing_fire' };
      else actions[m.id] = m.sp >= 5 ? { type: 'skill', skillId: 'aimed_shot', target: toughest.id } : attack;
    } else {
      const armored = foes.find((e) => (D.enemies[e.type]?.def ?? 0) >= 7 && e.corrode === 0);
      if (foes.length >= 2 && m.sp >= 6) actions[m.id] = { type: 'skill', skillId: 'flame_flask' };
      else if (armored && m.sp >= 4) actions[m.id] = { type: 'skill', skillId: 'corrosive_mist', target: armored.id };
      else actions[m.id] = m.sp >= 5 ? { type: 'skill', skillId: 'frost_vial', target: toughest.id } : attack;
    }
  }
  return actions;
}

/** Fight the current combat to its end. Returns how it ended. */
export function fightOut(state: CampaignState): { state: CampaignState; result: 'won' | 'wiped'; rounds: number } {
  let s = state;
  let rounds = 0;
  while (s.expedition?.combat) {
    s = applyAll(s, [{ type: 'combat_round', actions: chooseActions(s) }]);
    rounds += 1;
    if (rounds > 200) throw new Error('Combat did not end.');
  }
  return { state: s, result: s.expedition ? 'won' : 'wiped', rounds };
}

/**
 * Where one move in direction `dir` from (x, y) leaves the party, following
 * the game's own rules for walls, gates, water and ice. Null if the move is
 * impossible. Bosses, hidden bosses and ambushes are only entered as the
 * final target.
 */
export function landing(s: CampaignState, x: number, y: number, dir: number, target?: [number, number]): [number, number] | null {
  const exp = s.expedition!;
  const [dx, dy] = DIRS[dir]!;
  const nx = x + dx;
  const ny = y + dy;
  const tile = effectiveTile(s, exp.stratumId, exp.floor, nx, ny);
  if (!canEnter(s, exp.stratumId, exp.floor, nx, ny)) return null;
  if (tile === '=' && !s.dungeon.openGates.includes(`${exp.stratumId}:${exp.floor}:${nx},${ny}`)) return null;
  if ((tile === 'B' || tile === 'X' || tile === 'A') && !(target && nx === target[0] && ny === target[1])) return null;
  if (tile === 'B' || tile === 'X') return [nx, ny];
  const probe = { ...exp, x: nx, y: ny };
  slide({ ...s, dungeon: { ...s.dungeon, discovered: structuredClone(s.dungeon.discovered) } }, probe, dir);
  return [probe.x, probe.y];
}

/** Every tile the party could come to rest on from where it stands. */
export function reachable(s: CampaignState): Set<string> {
  const exp = s.expedition!;
  const seen = new Set([`${exp.x},${exp.y}`]);
  const queue: [number, number][] = [[exp.x, exp.y]];
  while (queue.length) {
    const [x, y] = queue.shift()!;
    for (let dir = 0; dir < 4; dir++) {
      const to = landing(s, x, y, dir);
      if (!to || seen.has(to.join())) continue;
      seen.add(to.join());
      queue.push(to);
    }
  }
  return seen;
}

/** Shortest route on the party's floor, as the [x, y] where each move comes to rest. */
export function route(s: CampaignState, tx: number, ty: number, avoid: (x: number, y: number) => boolean = () => false): [number, number][] | null {
  const exp = s.expedition!;
  const key = (x: number, y: number) => `${x},${y}`;
  const from = new Map<string, string | null>([[key(exp.x, exp.y), null]]);
  const queue: [number, number][] = [[exp.x, exp.y]];
  while (queue.length) {
    const [x, y] = queue.shift()!;
    if (x === tx && y === ty) break;
    if (effectiveTile(s, exp.stratumId, exp.floor, x, y) === 'B' || effectiveTile(s, exp.stratumId, exp.floor, x, y) === 'X') continue;
    for (let dir = 0; dir < 4; dir++) {
      const to = landing(s, x, y, dir, [tx, ty]);
      if (!to || from.has(key(...to)) || avoid(...to)) continue;
      from.set(key(...to), key(x, y));
      queue.push(to);
    }
  }
  if (!from.has(key(tx, ty))) return null;
  const path: [number, number][] = [];
  for (let k: string | null = key(tx, ty); k && from.get(k) !== null; k = from.get(k) ?? null) {
    const [x, y] = k.split(',').map(Number) as [number, number];
    path.unshift([x, y]);
  }
  return path;
}

/** Turn and make the one move that comes to rest on (x, y). */
export function stepTo(state: CampaignState, x: number, y: number): CampaignState {
  const exp = state.expedition!;
  const dir = [0, 1, 2, 3].find((d) => {
    const to = landing(state, exp.x, exp.y, d, [x, y]);
    return to && to[0] === x && to[1] === y;
  });
  if (dir === undefined) throw new Error(`No single move from (${exp.x},${exp.y}) comes to rest on (${x},${y}).`);
  const cmds: Command[] = [];
  for (let f = exp.facing; f !== dir; f = (f + 1) % 4) cmds.push({ type: 'dungeon_move', move: 'turn_right' });
  cmds.push({ type: 'dungeon_move', move: 'forward' });
  return applyAll(state, cmds);
}

/** Walk to a tile, fighting whatever turns up. Stops early if the party is wiped. */
export function walkTo(state: CampaignState, tx: number, ty: number): CampaignState {
  let s = state;
  for (let guard = 0; guard < 500; guard++) {
    if (!s.expedition) return s;
    if (s.expedition.combat) {
      s = fightOut(s).state;
      continue;
    }
    if (s.expedition.x === tx && s.expedition.y === ty) return s;
    const path = route(s, tx, ty);
    if (!path || path.length === 0) throw new Error(`No route to (${tx},${ty}).`);
    s = stepTo(s, path[0]![0], path[0]![1]);
  }
  throw new Error('Walk did not finish.');
}

export { apply };
