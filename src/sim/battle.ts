import { concludeBattle } from './campaign';
import type { ClassCombat, EnemyStats, GameConfig, WeaponStats } from './config';
import { airLength, airPoint, flatGroups, getDefenseMap, laneLength, lanePoint, wavesFor } from './defenseMap';
import type { Point } from './defenseMap';
import { getStratumMap } from './dungeonMap';
import { addGauge, easeGauge, statsOf } from './growth';
import { getAdventurer } from './selectors';
import { clearAssignment, solidify } from './statues';
import type { Adventurer, BattleEnemy, CampaignState, DefenseBattle, DefenseStructure, ShotKind } from './types';
import { fail, log } from './util';

/**
 * Real-time for the player, fixed-tick for the rules. Every tick does the
 * same things in the same order, so a battle replays identically from a save
 * and can be run headlessly for tests and balance work.
 */

const toTicks = (seconds: number, cfg: GameConfig) => Math.max(1, Math.round(seconds * cfg.defense.ticks_per_second));

/** Which stratum's attackers a battle on this map would face now. */
export function battleDepth(s: CampaignState, map: DefenseBattle['map']): string | null {
  const depth = s.frontierStratumId;
  return depth && getDefenseMap(map).waves_by_frontier?.[depth] ? depth : null;
}

export function startBattle(s: CampaignState, cfg: GameConfig): void {
  const pending = s.pendingBattle ?? fail('There is no attack to fight.');
  if (s.battle) fail('The battle is already under way.');
  const map = getDefenseMap(pending.map);
  const depth = pending.kind === 'tutorial_defense' ? null : battleDepth(s, pending.map);
  const gateMaxHp = pending.map === 'sanctuary' ? cfg.defense.sanctuary_gate_max_hp : cfg.defense.frontier_gate_max_hp;
  s.battle = {
    kind: pending.kind,
    map: pending.map,
    tick: 0,
    gateHp: gateMaxHp,
    gateMaxHp,
    enemies: [],
    nextEnemyId: 1,
    spawned: flatGroups(pending.map, pending.kind, depth).map(() => 0),
    cooldowns: {},
    busyUntil: {},
    turretCooldowns: map.turrets.map(() => 0),
    fallen: [],
    killed: 0,
    leaked: 0,
    ammoSpent: 0,
    outcome: 'ongoing',
    depth,
    deploying: true,
    shots: [],
  };
  log(s, 'battle_started', `The defenders take up positions at the ${map.name.toLowerCase()}.`);
}

export interface DefenderWeapon extends ClassCombat {
  supportMult: number;
  minRange: number;
  hitsAir: boolean;
  attacks: boolean;
}

/**
 * Effective weapon of an adventurer in a given structure. `boost` is what
 * nearby signal posts add, in percent.
 */
export function defenderWeapon(cfg: GameConfig, adv: Adventurer, structure: DefenseStructure, boost = { damagePct: 0, rangePct: 0 }): DefenderWeapon | null {
  const combat = cfg.defense.class_combat[adv.classId];
  const st = cfg.defense.structure_stats[structure.type];
  if (!combat || !st) return null;
  const affinity = combat.affinity?.[structure.type];
  const own = statsOf(cfg, adv);
  return {
    ...combat,
    damage: Math.round(combat.damage * st.damage_mult * (affinity?.damage_mult ?? 1) * own.tdDamage * (1 + boost.damagePct / 100)),
    range: Math.round(combat.range * st.range_mult * (affinity?.range_mult ?? 1) * own.tdRange * (1 + boost.rangePct / 100)),
    cooldown_seconds: combat.cooldown_seconds * (st.cooldown_mult ?? 1),
    splash_radius: combat.splash_radius ?? st.splash_radius,
    supportMult: st.support_mult * own.support,
    minRange: st.min_range ?? 0,
    hitsAir: st.hits_air ?? true,
    attacks: st.attacks ?? true,
  };
}

interface Located {
  enemy: BattleEnemy;
  x: number;
  y: number;
  /** Map units left before the gate. */
  remaining: number;
}

const flies = (cfg: GameConfig, enemy: BattleEnemy) => cfg.defense.enemy_stats[enemy.type]?.flying === true;

/** Length of the way an attacker takes to the gate: its lane, or straight there if it flies. */
function pathLength(cfg: GameConfig, b: DefenseBattle, enemy: BattleEnemy): number {
  return flies(cfg, enemy) ? airLength(b.map, enemy.lane) : laneLength(b.map, enemy.lane);
}

/** Where an attacker is on the map. Also used by the renderer. */
export function enemyPoint(cfg: GameConfig, b: Pick<DefenseBattle, 'map'>, enemy: BattleEnemy): Point {
  const d = enemy.progress / 1000;
  return flies(cfg, enemy) ? airPoint(b.map, enemy.lane, d) : lanePoint(b.map, enemy.lane, d);
}

function locate(cfg: GameConfig, b: DefenseBattle): Located[] {
  return b.enemies.map((enemy) => {
    const [x, y] = enemyPoint(cfg, b, enemy);
    return { enemy, x, y, remaining: pathLength(cfg, b, enemy) - enemy.progress / 1000 };
  });
}

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

function shot(b: DefenseBattle, kind: ShotKind, from: Point, to: Point): void {
  b.shots.push({ kind, x1: Math.round(from[0]), y1: Math.round(from[1]), x2: Math.round(to[0]), y2: Math.round(to[1]) });
}

/** Armor a target gains from bulwarks standing near it (not counting itself). */
function auraArmor(cfg: GameConfig, located: Located[], target: Located): number {
  let extra = 0;
  for (const l of located) {
    const aura = l.enemy !== target.enemy && l.enemy.hp > 0 ? cfg.defense.enemy_stats[l.enemy.type]?.armor_aura : undefined;
    if (aura && dist(l.x, l.y, target.x, target.y) <= aura.radius) extra = Math.max(extra, aura.armor);
  }
  return extra;
}

function damage(cfg: GameConfig, enemy: BattleEnemy, weapon: WeaponStats, extraArmor = 0): void {
  const stats = cfg.defense.enemy_stats[enemy.type];
  const armor = ((stats?.armor ?? 0) + extraArmor) * (enemy.corrodeTicks > 0 ? enemy.corrodePct / 100 : 1);
  enemy.hp -= Math.max(1, Math.round(weapon.damage - armor * (1 - weapon.armor_pierce)));
}

/** Attackers worth killing first: those that solidify, pin or mend. */
const isCaster = (stats: EnemyStats | undefined) => !!(stats?.petrify_attack || stats?.bind_attack || stats?.heal_aura);

function pickTarget(
  cfg: GameConfig,
  located: Located[],
  origin: Point,
  range: number,
  priority: Adventurer['targetPriority'],
  limits: { minRange?: number; hitsAir?: boolean } = {},
): Located | null {
  let best: Located | null = null;
  let bestScore = -Infinity;
  for (const l of located) {
    if (l.enemy.hp <= 0) continue;
    const d = dist(origin[0], origin[1], l.x, l.y);
    if (d > range || d < (limits.minRange ?? 0)) continue;
    if (limits.hitsAir === false && flies(cfg, l.enemy)) continue;
    // Closest to the gate wins ties in every mode.
    let score = -l.remaining;
    if (priority === 'strongest') score += l.enemy.hp * 1e6;
    if (priority === 'petrifier' && isCaster(cfg.defense.enemy_stats[l.enemy.type])) score += 1e9;
    if (score > bestScore) {
      best = l;
      bestScore = score;
    }
  }
  return best;
}

function newEnemy(b: DefenseBattle, type: string, lane: number, progress: number, hp: number): BattleEnemy {
  return {
    id: b.nextEnemyId++,
    type,
    lane,
    progress,
    hp,
    maxHp: hp,
    slowTicks: 0,
    slowPct: 100,
    corrodeTicks: 0,
    corrodePct: 100,
    cooldown: 0,
    siegeTarget: null,
    siegeBlows: 0,
    battered: [],
  };
}

function spawn(cfg: GameConfig, b: DefenseBattle): void {
  const tps = cfg.defense.ticks_per_second;
  flatGroups(b.map, b.kind, b.depth).forEach(({ start, group }, g) => {
    const stats = cfg.defense.enemy_stats[group.enemy];
    if (!stats) return;
    while ((b.spawned[g] ?? 0) < group.count) {
      const n = b.spawned[g] ?? 0;
      if (b.tick < Math.round((start + n * group.interval_seconds) * tps)) break;
      b.enemies.push(newEnemy(b, group.enemy, group.lane, 0, stats.hp));
      b.spawned[g] = n + 1;
    }
  });
}

function manned(s: CampaignState, b: DefenseBattle): { structure: DefenseStructure; adv: Adventurer; pos: Point }[] {
  const out: { structure: DefenseStructure; adv: Adventurer; pos: Point }[] = [];
  for (const structure of s.structures) {
    if (structure.map !== b.map || !structure.occupantId) continue;
    out.push({ structure, adv: getAdventurer(s, structure.occupantId), pos: [structure.x, structure.y] });
  }
  return out;
}

/** What the manned signal posts near a structure add to it. */
export function signalBoost(cfg: GameConfig, structures: DefenseStructure[], target: DefenseStructure): { damagePct: number; rangePct: number } {
  const boost = { damagePct: 0, rangePct: 0 };
  for (const post of structures) {
    const aura = cfg.defense.structure_stats[post.type]?.aura;
    if (!aura || post === target || post.map !== target.map || !post.occupantId || post.hp <= 0) continue;
    if (dist(post.x, post.y, target.x, target.y) > aura.radius) continue;
    boost.damagePct += aura.damage_pct;
    boost.rangePct += aura.range_pct;
  }
  return boost;
}

function defendersAct(s: CampaignState, cfg: GameConfig, b: DefenseBattle, located: Located[]): void {
  const posts = manned(s, b);
  for (const { structure, adv, pos } of posts) {
    if (structure.hp <= 0 || b.tick < (b.busyUntil[adv.id] ?? 0)) continue;
    if (cfg.defense.structure_stats[structure.type]?.attacks === false) continue;
    const cd = (b.cooldowns[adv.id] ?? 0) - 1;
    if (cd > 0) {
      b.cooldowns[adv.id] = cd;
      continue;
    }
    const weapon = defenderWeapon(cfg, adv, structure, signalBoost(cfg, s.structures, structure));
    if (!weapon) continue;

    if (weapon.support && weapon.supportMult > 0) {
      // A medic tends to whoever needs it most before she fires.
      const allies = posts.filter((p) => dist(pos[0], pos[1], p.pos[0], p.pos[1]) <= weapon.range);
      const stricken = allies.filter((p) => p.adv.gauge > 0).sort((a, c) => c.adv.gauge - a.adv.gauge)[0];
      const wounded = allies.filter((p) => p.adv.hp < p.adv.maxHp).sort((a, c) => a.adv.hp / a.adv.maxHp - c.adv.hp / c.adv.maxHp)[0];
      const patient = stricken ?? wounded;
      if (patient) {
        if (stricken) easeGauge(patient.adv, Math.round(weapon.support.gauge * weapon.supportMult));
        else patient.adv.hp = Math.min(patient.adv.maxHp, patient.adv.hp + Math.round(weapon.support.heal * weapon.supportMult));
        shot(b, 'support', pos, patient.pos);
        b.cooldowns[adv.id] = toTicks(weapon.cooldown_seconds, cfg);
        continue;
      }
    }

    const target = pickTarget(cfg, located, pos, weapon.range, adv.targetPriority, { minRange: weapon.minRange, hitsAir: weapon.hitsAir });
    if (!target) {
      b.cooldowns[adv.id] = 0;
      continue;
    }
    // A burst does not reach flyers if the weapon cannot hit them.
    const hit = weapon.splash_radius
      ? located.filter((l) => l.enemy.hp > 0 && dist(l.x, l.y, target.x, target.y) <= (weapon.splash_radius as number) && (weapon.hitsAir || !flies(cfg, l.enemy)))
      : [target];
    for (const l of hit) {
      if (weapon.corrode) {
        l.enemy.corrodeTicks = toTicks(weapon.corrode.seconds, cfg);
        l.enemy.corrodePct = Math.round(weapon.corrode.armor_factor * 100);
      }
      damage(cfg, l.enemy, weapon, auraArmor(cfg, located, l));
      if (weapon.slow && !flies(cfg, l.enemy)) {
        l.enemy.slowTicks = toTicks(weapon.slow.seconds, cfg);
        l.enemy.slowPct = Math.round(weapon.slow.factor * 100);
      }
    }
    shot(b, weapon.splash_radius ? 'splash' : 'attack', pos, [target.x, target.y]);
    b.cooldowns[adv.id] = toTicks(weapon.cooldown_seconds, cfg);
  }
}

function turretsAct(s: CampaignState, cfg: GameConfig, b: DefenseBattle, located: Located[]): void {
  const turret = cfg.defense.turret;
  getDefenseMap(b.map).turrets.forEach((pos, i) => {
    const cd = (b.turretCooldowns[i] ?? 0) - 1;
    if (cd > 0) {
      b.turretCooldowns[i] = cd;
      return;
    }
    b.turretCooldowns[i] = 0;
    if (s.sanctuary.automatedAmmo <= 0) return; // out of ammunition: the weapon is silent
    const target = pickTarget(cfg, located, pos, turret.range, 'first');
    if (!target) return;
    damage(cfg, target.enemy, turret, auraArmor(cfg, located, target));
    // In the prologue the goddess herself feeds the weapons.
    if (b.kind !== 'tutorial_defense') {
      s.sanctuary.automatedAmmo -= 1;
      b.ammoSpent += 1;
    }
    shot(b, 'turret', pos, [target.x, target.y]);
    b.turretCooldowns[i] = toTicks(turret.cooldown_seconds, cfg);
  });
}

function enemiesAct(s: CampaignState, cfg: GameConfig, b: DefenseBattle): void {
  const tps = cfg.defense.ticks_per_second;
  const survivors: BattleEnemy[] = [];
  const born: BattleEnemy[] = [];
  const before = locate(cfg, b);
  for (const enemy of b.enemies) {
    if (enemy.hp <= 0) {
      b.killed += 1;
      // A husk bursts: what was inside comes on from where it fell.
      const burst = cfg.defense.enemy_stats[enemy.type]?.on_death;
      const kind = burst ? cfg.defense.enemy_stats[burst.spawn] : undefined;
      if (burst && kind) {
        for (let i = 0; i < burst.count; i++) born.push(newEnemy(b, burst.spawn, enemy.lane, Math.max(0, enemy.progress - i * 6000), kind.hp));
      }
      continue;
    }
    const stats = cfg.defense.enemy_stats[enemy.type];
    if (!stats) continue;

    // A brute halts beside a manned structure in reach and batters it before moving on.
    const ram = stats.flying ? undefined : stats.structure_attack;
    if (ram) {
      if (enemy.siegeTarget) {
        const held = s.structures.find((d) => d.id === enemy.siegeTarget);
        if (!held || held.hp <= 0 || !held.occupantId || enemy.siegeBlows <= 0) enemy.siegeTarget = null;
      }
      if (!enemy.siegeTarget && enemy.battered.length < ram.max_structures) {
        const [px, py] = enemyPoint(cfg, b, enemy);
        let target: DefenseStructure | null = null;
        let nearest = Infinity;
        for (const structure of s.structures) {
          if (structure.map !== b.map || structure.hp <= 0 || !structure.occupantId || enemy.battered.includes(structure.id)) continue;
          const d = dist(px, py, structure.x, structure.y);
          if (d <= ram.range && d < nearest) {
            nearest = d;
            target = structure;
          }
        }
        if (target) {
          enemy.siegeTarget = target.id;
          enemy.siegeBlows = ram.blows;
          enemy.battered.push(target.id);
          enemy.cooldown = toTicks(ram.cooldown_seconds, cfg); // it winds up before the first blow
        }
      }
    }

    if (!enemy.siegeTarget) {
      const step = Math.round((stats.speed * 1000) / tps);
      enemy.progress += enemy.slowTicks > 0 ? Math.round((step * enemy.slowPct) / 100) : step;
    }
    if (enemy.slowTicks > 0) enemy.slowTicks -= 1;
    if (enemy.corrodeTicks > 0) enemy.corrodeTicks -= 1;

    if (enemy.progress >= pathLength(cfg, b, enemy) * 1000) {
      b.gateHp = Math.max(0, b.gateHp - stats.gate_damage);
      b.leaked += 1;
      continue;
    }
    survivors.push(enemy);

    if (enemy.cooldown > 0) {
      enemy.cooldown -= 1;
      continue;
    }
    const [x, y] = enemyPoint(cfg, b, enemy);

    const mend = stats.heal_aura;
    if (mend) {
      let mended = false;
      for (const other of before) {
        if (other.enemy === enemy || other.enemy.hp <= 0 || other.enemy.hp >= other.enemy.maxHp) continue;
        if (dist(x, y, other.x, other.y) > mend.radius) continue;
        other.enemy.hp = Math.min(other.enemy.maxHp, other.enemy.hp + mend.amount);
        shot(b, 'mend', [x, y], [other.x, other.y]);
        mended = true;
      }
      if (mended) enemy.cooldown = toTicks(mend.cooldown_seconds, cfg);
    }

    const bind = stats.bind_attack;
    if (bind) {
      // Pins the most exposed defender in reach who is not pinned already.
      let victim: { structure: DefenseStructure; adv: Adventurer; pos: Point } | null = null;
      let best = -Infinity;
      for (const post of manned(s, b)) {
        const d = dist(x, y, post.pos[0], post.pos[1]);
        if (d > bind.range || (b.busyUntil[post.adv.id] ?? 0) > b.tick) continue;
        const exposure = cfg.defense.structure_stats[post.structure.type]?.exposure ?? 1;
        const score = exposure * 1e6 - d;
        if (score > best) {
          best = score;
          victim = post;
        }
      }
      if (victim) {
        const exposure = cfg.defense.structure_stats[victim.structure.type]?.exposure ?? 1;
        b.busyUntil[victim.adv.id] = b.tick + Math.max(1, Math.round(bind.seconds * exposure * tps));
        shot(b, 'bind', [x, y], victim.pos);
        enemy.cooldown = toTicks(bind.cooldown_seconds, cfg);
      }
    }

    const petrify = stats.petrify_attack;
    if (petrify) {
      // Goes for the most exposed defender in reach; the nearest breaks ties.
      let victim: { structure: DefenseStructure; adv: Adventurer; pos: Point } | null = null;
      let best = -Infinity;
      for (const post of manned(s, b)) {
        const d = dist(x, y, post.pos[0], post.pos[1]);
        if (d > petrify.range) continue;
        const exposure = cfg.defense.structure_stats[post.structure.type]?.exposure ?? 1;
        const score = exposure * 1e6 - d;
        if (score > best) {
          best = score;
          victim = post;
        }
      }
      if (victim) {
        const exposure = cfg.defense.structure_stats[victim.structure.type]?.exposure ?? 1;
        // The attackers come up from the frontier stratum and carry its medium with them.
        const medium = (s.frontierStratumId ? getStratumMap(s.frontierStratumId)?.medium : undefined) ?? 'stone';
        addGauge(victim.adv, Math.round(petrify.gauge * exposure * (1 - statsOf(cfg, victim.adv).gaugeResist)), medium);
        victim.adv.hp = Math.max(0, victim.adv.hp - Math.round(petrify.damage * exposure));
        shot(b, 'petrify', [x, y], victim.pos);
        enemy.cooldown = toTicks(petrify.cooldown_seconds, cfg);
        if (victim.adv.gauge >= 100 || victim.adv.hp <= 0) {
          solidify(s, cfg, victim.adv.id, b.map, victim.structure.id, medium);
          b.fallen.push(victim.adv.id);
        }
      }
    }

    const target = ram && enemy.siegeTarget ? s.structures.find((d) => d.id === enemy.siegeTarget) : undefined;
    if (ram && target) {
      target.hp = Math.max(0, target.hp - ram.damage);
      enemy.siegeBlows -= 1;
      shot(b, 'structure', [x, y], [target.x, target.y]);
      enemy.cooldown = toTicks(ram.cooldown_seconds, cfg);
      if (target.hp === 0) {
        const name = target.id.replace(/_/g, ' ');
        if (target.occupantId) {
          const adv = getAdventurer(s, target.occupantId);
          clearAssignment(s, adv); // she gets out unharmed, but the post is gone
          log(s, 'structure_destroyed', `The ${name} was destroyed; ${adv.name} fell back to reserve.`);
        } else {
          log(s, 'structure_destroyed', `The ${name} was destroyed.`);
        }
      }
    }
  }
  b.enemies = [...survivors, ...born];
}

function tick(s: CampaignState, cfg: GameConfig, b: DefenseBattle): void {
  b.tick += 1;
  spawn(cfg, b);
  const located = locate(cfg, b);
  defendersAct(s, cfg, b, located);
  turretsAct(s, cfg, b, located);
  enemiesAct(s, cfg, b);

  if (b.gateHp <= 0) {
    b.outcome = 'loss';
    log(s, 'battle_lost', 'The gate has been broken.');
  } else if (b.enemies.length === 0 && flatGroups(b.map, b.kind, b.depth).every(({ group }, g) => (b.spawned[g] ?? 0) >= group.count)) {
    b.outcome = 'win';
    log(s, 'battle_won', 'The last of the attackers has been driven off.');
  }
}

/** During deployment: send everyone in reserve back to the post she held last time, where it is free. */
export function repostDefenders(s: CampaignState, assign: (adventurerId: string, structureId: string) => void): void {
  const b = s.battle ?? fail('No battle is under way.');
  if (!b.deploying) fail('The fighting has already begun.');
  for (const adv of s.adventurers) {
    if (adv.condition !== 'ready' || adv.assignment.type !== 'idle' || !adv.lastPost) continue;
    const post = s.structures.find((d) => d.id === adv.lastPost);
    if (post && post.map === b.map && post.hp > 0 && !post.occupantId) assign(adv.id, post.id);
  }
}

/** End the deployment phase: the first wave is on its way. */
export function beginBattle(s: CampaignState): void {
  const b = s.battle ?? fail('No battle is under way.');
  if (!b.deploying) fail('The fighting has already begun.');
  b.deploying = false;
  log(s, 'battle_begun', 'The attackers come into sight.');
}

export function tickBattle(s: CampaignState, cfg: GameConfig, ticks: number): void {
  const b = s.battle ?? fail('No battle is under way.');
  if (b.deploying) fail('The defenders are still taking up positions.');
  if (!Number.isInteger(ticks) || ticks < 0) fail('Ticks must be a whole number.');
  b.shots = [];
  for (let i = 0; i < ticks && b.outcome === 'ongoing'; i++) tick(s, cfg, b);
}

/** Abandon the line: an immediate loss, but nobody else falls. */
export function concedeBattle(s: CampaignState): void {
  const b = s.battle ?? fail('No battle is under way.');
  if (b.outcome !== 'ongoing') fail('The battle is already decided.');
  b.outcome = 'loss';
  b.enemies = [];
  log(s, 'battle_conceded', 'The guild master sounded the retreat.');
}

/** Hand the result to the campaign and leave the battle. */
export function finishBattle(s: CampaignState, cfg: GameConfig, miracleChoices?: string[]): void {
  const b = s.battle ?? fail('No battle is under way.');
  if (b.outcome === 'ongoing') fail('The battle is not over yet.');
  s.battle = null;
  s.pendingBattle = null;
  concludeBattle(s, cfg, b.kind, b.outcome === 'win', b.fallen, miracleChoices);
}

/** Summary of what is coming, for the forecast shown before and during a battle. */
export function waveForecast(
  map: DefenseBattle['map'],
  kind?: DefenseBattle['kind'],
  depth?: string | null,
): { wave: number; startSeconds: number; groups: { enemy: string; count: number; lane: string }[] }[] {
  const data = getDefenseMap(map);
  return wavesFor(map, kind, depth).map((w, wave) => ({
    wave: wave + 1,
    startSeconds: w.start_seconds,
    groups: w.groups.map((g) => ({ enemy: g.enemy, count: g.count, lane: data.lane_names[g.lane] ?? `lane ${g.lane + 1}` })),
  }));
}
