/** Deeper attackers and the two earned structures. */
import { describe, expect, it } from 'vitest';
import { airLength, applyAll, battleDepth, buildFixture, enemyPoint, flatGroups, getDefenseMap, signalBoost, waveForecast } from '../index';
import type { BattleEnemy, CampaignState } from '../index';
import { cfg, must, rejected } from './helpers';

const TPS = cfg.defense.ticks_per_second;
const E = cfg.defense.enemy_stats;

/** A frontier battle at the given depth with no script: only the attackers placed by the test. */
function arena(depth = 'stratum_1', posts: Record<string, string> = {}, milestones: string[] = []): CampaignState {
  let s = must(buildFixture('full_roster'), { type: 'debug_set_next_invasion', hour: 1e6 });
  s = structuredClone(s);
  s.frontierStratumId = depth;
  s.milestones.push(...milestones);
  s = applyAll(s, [{ type: 'debug_force_invasion' }, { type: 'battle_start' }]);
  s = applyAll(s, Object.entries(posts).map(([structureId, adventurerId]) => ({ type: 'assign_defender' as const, adventurerId, structureId })));
  s = must(s, { type: 'battle_begin' });
  s = structuredClone(s);
  const b = s.battle!;
  b.spawned = flatGroups('frontier', b.kind, b.depth).map(({ group }) => group.count);
  return s;
}

function place(s: CampaignState, type: string, lane: number, distance: number, hp?: number): BattleEnemy {
  const b = s.battle!;
  const enemy: BattleEnemy = { id: b.nextEnemyId++, type, lane, progress: distance * 1000, hp: hp ?? E[type]!.hp, maxHp: E[type]!.hp, slowTicks: 0, slowPct: 100, corrodeTicks: 0, corrodePct: 100, cooldown: 0, siegeTarget: null, siegeBlows: 0, battered: [] };
  b.enemies.push(enemy);
  return enemy;
}

const tick = (s: CampaignState, n = 1) => must(s, { type: 'battle_tick', ticks: n });
const find = (s: CampaignState, id: number) => s.battle!.enemies.find((e) => e.id === id);

describe('attackers follow the frontier down', () => {
  it('uses the map\'s own script while the first stratum is the frontier, and the deeper ones after', () => {
    expect(battleDepth(buildFixture('full_roster'), 'frontier')).toBeNull();
    const deeper = buildFixture('stable_secured');
    expect(deeper.frontierStratumId).toBe('stratum_2');
    expect(battleDepth(deeper, 'frontier')).toBe('stratum_2');
    const s = applyAll(deeper, [{ type: 'debug_force_invasion' }, { type: 'battle_start' }]);
    expect(s.battle!.depth).toBe('stratum_2');
    const kinds = (depth: string | null) => new Set(waveForecast('frontier', 'frontier_defense', depth).flatMap((w) => w.groups.map((g) => g.enemy)));
    expect([...kinds(null)].sort()).toEqual(['armored', 'petrifier', 'runner']);
    for (const k of ['swarmling', 'wisp', 'mender', 'binder']) expect(kinds('stratum_2').has(k), k).toBe(true);
    for (const k of ['husk', 'bulwark']) expect(kinds('stratum_3').has(k), k).toBe(true);
    // Every attacker named in any script exists.
    for (const map of ['frontier', 'sanctuary'] as const) {
      for (const waves of Object.values(getDefenseMap(map).waves_by_frontier ?? {})) for (const w of waves) for (const g of w.groups) expect(E[g.enemy], g.enemy).toBeDefined();
    }
  });

  it('keeps the first defense of the prologue on its own script', () => {
    const s = buildFixture('prologue');
    expect(waveForecast('sanctuary', 'tutorial_defense', battleDepth(s, 'sanctuary')).length).toBe(3);
  });
});

describe('new attackers', () => {
  it('lets wisps fly straight at the gate, out of reach of bunkers, and immune to slowing', () => {
    let s = arena('stratum_1', { frontier_bunker_1: 'adv_1' });
    const wisp = place(s, 'wisp', 0, 300);
    const [x, y] = enemyPoint(cfg, s.battle!, wisp);
    const map = getDefenseMap('frontier');
    const [sx, sy] = map.lanes[0]![0]!;
    // On the straight line from the lane's mouth to the gate.
    expect(Math.abs((map.gate[1] - sy) * (x - sx) - (map.gate[0] - sx) * (y - sy))).toBeLessThan(1e-6 * airLength('frontier', 0) * 1000 + 1);
    s = tick(s, TPS * 2);
    expect(find(s, wisp.id)!.hp).toBe(E.wisp!.hp); // the guardian in the bunker cannot touch it
    s = tick(s, TPS * 30);
    expect(s.battle!.leaked).toBe(1);
    expect(s.battle!.gateHp).toBe(cfg.defense.frontier_gate_max_hp - E.wisp!.gate_damage);
  });

  it('lets a mender heal the wounded around it', () => {
    let s = arena();
    const mender = place(s, 'mender', 0, 50);
    const hurt = place(s, 'runner', 0, 60, 10);
    s = tick(s);
    expect(find(s, hurt.id)!.hp).toBe(10 + E.mender!.heal_aura!.amount);
    expect(s.battle!.shots.some((sh) => sh.kind === 'mend')).toBe(true);
    s = tick(s);
    expect(find(s, hurt.id)!.hp).toBe(10 + E.mender!.heal_aura!.amount); // and then it must wait
    void mender;
  });

  it('lets a binder pin the most exposed defender in reach, for less time the better she is sheltered', () => {
    const pinned = (post: string) => {
      let s = arena('stratum_1', { [post]: 'adv_2' });
      s = structuredClone(s);
      const target = s.structures.find((d) => d.id === post)!;
      // Put the binder on the lane at the point nearest the post.
      let best = 0;
      let bestD = Infinity;
      for (let d = 0; d < 1200; d += 5) {
        const [x, y] = enemyPoint(cfg, s.battle!, { ...place(structuredClone(s), 'binder', 0, d) });
        const gap = Math.hypot(x - target.x, y - target.y);
        if (gap < bestD) {
          bestD = gap;
          best = d;
        }
      }
      place(s, 'binder', 0, best);
      s = tick(s);
      return (s.battle!.busyUntil.adv_2 ?? 0) - s.battle!.tick;
    };
    const exposed = pinned('frontier_watchtower_1');
    const sheltered = pinned('frontier_bunker_1');
    expect(exposed).toBe(Math.round(E.binder!.bind_attack!.seconds * TPS));
    expect(sheltered).toBeLessThan(exposed / 3);
  });

  it('bursts a husk into swarmlings where it falls', () => {
    let s = arena();
    const husk = place(s, 'husk', 1, 400, 0);
    s = tick(s);
    const swarm = s.battle!.enemies.filter((e) => e.type === 'swarmling');
    expect(swarm).toHaveLength(E.husk!.on_death!.count);
    expect(Math.max(...swarm.map((e) => e.progress))).toBeLessThanOrEqual(husk.progress + 1000 * E.swarmling!.speed);
    expect(s.battle!.killed).toBe(1);
  });

  it('hardens the armor of attackers beside a bulwark', () => {
    const hitFor = (withBulwark: boolean) => {
      let s = arena('stratum_1', { frontier_watchtower_1: 'adv_2' });
      const t = s.structures.find((d) => d.id === 'frontier_watchtower_1')!;
      let best = 0;
      let bestD = Infinity;
      for (let d = 0; d < 1200; d += 5) {
        const [x, y] = enemyPoint(cfg, s.battle!, { ...place(structuredClone(s), 'armored', 0, d) });
        const gap = Math.hypot(x - t.x, y - t.y);
        if (gap < bestD) {
          bestD = gap;
          best = d;
        }
      }
      const brute = place(s, 'armored', 0, best);
      if (withBulwark) place(s, 'bulwark', 0, best - 20);
      s = must(s, { type: 'set_target_priority', adventurerId: 'adv_2', priority: 'first' });
      s = tick(s);
      return brute.maxHp - find(s, brute.id)!.hp;
    };
    expect(hitFor(true)).toBeLessThan(hitFor(false));
  });
});

describe('earned structures', () => {
  it('must be earned before they can be built', () => {
    let s = applyAll(buildFixture('full_roster'), [{ type: 'debug_force_invasion' }, { type: 'battle_start' }]);
    expect(rejected(s, { type: 'build_structure', map: 'frontier', site: 's11', structureType: 'mortar_pit' })).toMatch(/master of the first stratum/);
    expect(rejected(s, { type: 'build_structure', map: 'frontier', site: 's12', structureType: 'signal_post' })).toMatch(/Warden of Dust/);
    s = structuredClone(s);
    s.milestones.push('boss', 'elite');
    s = applyAll(s, [
      { type: 'build_structure', map: 'frontier', site: 's11', structureType: 'mortar_pit' },
      { type: 'build_structure', map: 'frontier', site: 's12', structureType: 'signal_post' },
    ]);
    expect(rejected(s, { type: 'build_structure', map: 'frontier', site: 's8', structureType: 'mortar_pit' })).toMatch(/No more mortar pits/);
  });

  it('lets a mortar pit burst over a group far off, but not hit what is close or flying', () => {
    let s = applyAll(buildFixture('full_roster'), [{ type: 'debug_force_invasion' }, { type: 'battle_start' }]);
    s = structuredClone(s);
    s.milestones.push('boss');
    s = applyAll(s, [{ type: 'build_structure', map: 'frontier', site: 's11', structureType: 'mortar_pit' }, { type: 'assign_defender', adventurerId: 'adv_3', structureId: 'frontier_mortar_pit_1' }, { type: 'battle_begin' }]);
    s = structuredClone(s);
    s.battle!.spawned = flatGroups('frontier', s.battle!.kind, null).map(({ group }) => group.count);
    const pit = s.structures.find((d) => d.id === 'frontier_mortar_pit_1')!;
    const near: BattleEnemy[] = [];
    const far: BattleEnemy[] = [];
    const minRange = cfg.defense.structure_stats.mortar_pit!.min_range!;
    for (const lane of [0, 1]) {
      for (let d = 0; d < 1200; d += 10) {
        const probe = { ...place(structuredClone(s), 'runner', lane, d) };
        const [x, y] = enemyPoint(cfg, s.battle!, probe);
        const gap = Math.hypot(x - pit.x, y - pit.y);
        if (gap < minRange - 10 && near.length === 0) near.push(place(s, 'runner', lane, d));
        if (gap > 200 && gap < 260 && far.length === 0) far.push(place(s, 'runner', lane, d), place(s, 'runner', lane, d + 15));
      }
    }
    // A wisp well inside the pit's reach, and nearer the gate than the runners: it would be the first target if it could be hit.
    let wispAt = -1;
    for (let d = 0; d < 1000 && wispAt < 0; d += 5) {
      const [x, y] = enemyPoint(cfg, s.battle!, { ...place(structuredClone(s), 'wisp', 1, d) });
      const gap = Math.hypot(x - pit.x, y - pit.y);
      if (gap > minRange + 20 && gap < 250 && x > pit.x) wispAt = d;
    }
    expect(wispAt).toBeGreaterThan(0);
    const wisp = place(s, 'wisp', 1, wispAt);
    s = tick(s);
    expect(find(s, near[0]!.id)!.hp).toBe(E.runner!.hp);
    expect(far.every((e) => (find(s, e.id)?.hp ?? 0) < E.runner!.hp)).toBe(true); // both caught in one burst
    expect(s.battle!.shots.filter((sh) => sh.kind === 'splash')).toHaveLength(1);
    expect(find(s, wisp.id)!.hp).toBe(E.wisp!.hp);
  });

  it('lets a manned signal post strengthen the posts around it while its own occupant does not fight', () => {
    let s = applyAll(buildFixture('full_roster'), [{ type: 'debug_force_invasion' }, { type: 'battle_start' }]);
    s = structuredClone(s);
    s.milestones.push('elite');
    s = must(s, { type: 'build_structure', map: 'frontier', site: 's9', structureType: 'signal_post' });
    const tower = s.structures.find((d) => d.id === 'frontier_watchtower_1')!;
    const post = s.structures.find((d) => d.type === 'signal_post')!;
    expect(signalBoost(cfg, s.structures, tower)).toEqual({ damagePct: 0, rangePct: 0 }); // nobody in it yet
    s = must(s, { type: 'assign_defender', adventurerId: 'adv_1', structureId: post.id });
    const inReach = Math.hypot(post.x - tower.x, post.y - tower.y) <= cfg.defense.structure_stats.signal_post!.aura!.radius;
    expect(signalBoost(cfg, s.structures, s.structures.find((d) => d.id === tower.id)!)).toEqual(inReach ? { damagePct: 20, rangePct: 10 } : { damagePct: 0, rangePct: 0 });
    s = must(s, { type: 'battle_begin' });
    s = structuredClone(s);
    s.battle!.spawned = flatGroups('frontier', s.battle!.kind, null).map(({ group }) => group.count);
    place(s, 'runner', 0, 200);
    s = tick(s, TPS * 5);
    expect(s.battle!.shots.some((sh) => sh.x1 === post.x && sh.y1 === post.y)).toBe(false);
  });
});
