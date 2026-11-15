import { concludeBattle } from './campaign';
import type { ClassCombat, GameConfig, WeaponStats } from './config';
import { flatGroups, getDefenseMap, laneLength, lanePoint, wavesFor } from './defenseMap';
import type { Point } from './defenseMap';
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

export function startBattle(s: CampaignState, cfg: GameConfig): void {
  const pending = s.pendingBattle ?? fail('There is no attack to fight.');
  if (s.battle) fail('The battle is already under way.');
  const map = getDefenseMap(pending.map);
  const gateMaxHp = pending.map === 'sanctuary' ? cfg.defense.sanctuary_gate_max_hp : cfg.defense.frontier_gate_max_hp;
  s.battle = {
    kind: pending.kind,
    map: pending.map,
    tick: 0,
    gateHp: gateMaxHp,
    gateMaxHp,
    enemies: [],
    nextEnemyId: 1,
    spawned: flatGroups(pending.map, pending.kind).map(() => 0),
    cooldowns: {},
    busyUntil: {},
    turretCooldowns: map.turrets.map(() => 0),
    fallen: [],
    killed: 0,
    leaked: 0,
    ammoSpent: 0,
    outcome: 'ongoing',
    deploying: true,
    shots: [],
  };
  log(s, 'battle_started', `The defenders take up positions at the ${map.name.toLowerCase()}.`);
}

/** Effective weapon of an adventurer in a given structure. */
export function defenderWeapon(cfg: GameConfig, adv: Adventurer, structure: DefenseStructure): (ClassCombat & { supportMult: number }) | null {
  const combat = cfg.defense.class_combat[adv.classId];
  const st = cfg.defense.structure_stats[structure.type];
  if (!combat || !st) return null;
  const affinity = combat.affinity?.[structure.type];
  return {
    ...combat,
    damage: Math.round(combat.damage * st.damage_mult * (affinity?.damage_mult ?? 1)),
    range: Math.round(combat.range * st.range_mult * (affinity?.range_mult ?? 1)),
    supportMult: st.support_mult,
  };
}

interface Located {
  enemy: BattleEnemy;
  x: number;
  y: number;
  /** Map units left before the gate. */
  remaining: number;
}

function locate(b: DefenseBattle): Located[] {
  return b.enemies.map((enemy) => {
    const d = enemy.progress / 1000;
    const [x, y] = lanePoint(b.map, enemy.lane, d);
    return { enemy, x, y, remaining: laneLength(b.map, enemy.lane) - d };
  });
}

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

function shot(b: DefenseBattle, kind: ShotKind, from: Point, to: Point): void {
  b.shots.push({ kind, x1: Math.round(from[0]), y1: Math.round(from[1]), x2: Math.round(to[0]), y2: Math.round(to[1]) });
}

function damage(cfg: GameConfig, enemy: BattleEnemy, weapon: WeaponStats): void {
  const stats = cfg.defense.enemy_stats[enemy.type];
  const armor = (stats?.armor ?? 0) * (enemy.corrodeTicks > 0 ? enemy.corrodePct / 100 : 1);
  enemy.hp -= Math.max(1, Math.round(weapon.damage - armor * (1 - weapon.armor_pierce)));
}

function pickTarget(cfg: GameConfig, located: Located[], origin: Point, range: number, priority: Adventurer['targetPriority']): Located | null {
  let best: Located | null = null;
  let bestScore = -Infinity;
  for (const l of located) {
    if (l.enemy.hp <= 0 || dist(origin[0], origin[1], l.x, l.y) > range) continue;
    // Closest to the gate wins ties in every mode.
    let score = -l.remaining;
    if (priority === 'strongest') score += l.enemy.hp * 1e6;
    if (priority === 'petrifier' && cfg.defense.enemy_stats[l.enemy.type]?.petrify_attack) score += 1e9;
    if (score > bestScore) {
      best = l;
      bestScore = score;
    }
  }
  return best;
}

function spawn(cfg: GameConfig, b: DefenseBattle): void {
  const tps = cfg.defense.ticks_per_second;
  flatGroups(b.map, b.kind).forEach(({ start, group }, g) => {
    const stats = cfg.defense.enemy_stats[group.enemy];
    if (!stats) return;
    while ((b.spawned[g] ?? 0) < group.count) {
      const n = b.spawned[g] ?? 0;
      if (b.tick < Math.round((start + n * group.interval_seconds) * tps)) break;
      b.enemies.push({
        id: b.nextEnemyId++,
        type: group.enemy,
        lane: group.lane,
        progress: 0,
        hp: stats.hp,
        maxHp: stats.hp,
        slowTicks: 0,
        slowPct: 100,
        corrodeTicks: 0,
        corrodePct: 100,
        cooldown: 0,
        siegeTarget: null,
        siegeBlows: 0,
        battered: [],
      });
      b.spawned[g] = n + 1;
    }
  });
}

function manned(s: CampaignState, b: DefenseBattle): { structure: DefenseStructure; adv: Adventurer; pos: Point }[] {
  const map = getDefenseMap(b.map);
  const out: { structure: DefenseStructure; adv: Adventurer; pos: Point }[] = [];
  for (const structure of s.structures) {
    if (structure.map !== b.map || !structure.occupantId) continue;
    const pos = map.slots[structure.id];
    if (pos) out.push({ structure, adv: getAdventurer(s, structure.occupantId), pos });
  }
  return out;
}

function defendersAct(s: CampaignState, cfg: GameConfig, b: DefenseBattle, located: Located[]): void {
  const posts = manned(s, b);
  for (const { structure, adv, pos } of posts) {
    if (structure.hp <= 0 || b.tick < (b.busyUntil[adv.id] ?? 0)) continue;
    const cd = (b.cooldowns[adv.id] ?? 0) - 1;
    if (cd > 0) {
      b.cooldowns[adv.id] = cd;
      continue;
    }
    const weapon = defenderWeapon(cfg, adv, structure);
    if (!weapon) continue;

    if (weapon.support) {
      // A medic tends to whoever needs it most before she fires.
      const allies = posts.filter((p) => dist(pos[0], pos[1], p.pos[0], p.pos[1]) <= weapon.range);
      const stricken = allies.filter((p) => p.adv.gauge > 0).sort((a, c) => c.adv.gauge - a.adv.gauge)[0];
      const wounded = allies.filter((p) => p.adv.hp < p.adv.maxHp).sort((a, c) => a.adv.hp / a.adv.maxHp - c.adv.hp / c.adv.maxHp)[0];
      const patient = stricken ?? wounded;
      if (patient) {
        if (stricken) patient.adv.gauge = Math.max(0, patient.adv.gauge - Math.round(weapon.support.gauge * weapon.supportMult));
        else patient.adv.hp = Math.min(patient.adv.maxHp, patient.adv.hp + Math.round(weapon.support.heal * weapon.supportMult));
        shot(b, 'support', pos, patient.pos);
        b.cooldowns[adv.id] = toTicks(weapon.cooldown_seconds, cfg);
        continue;
      }
    }

    const target = pickTarget(cfg, located, pos, weapon.range, adv.targetPriority);
    if (!target) {
      b.cooldowns[adv.id] = 0;
      continue;
    }
    const hit = weapon.splash_radius
      ? located.filter((l) => l.enemy.hp > 0 && dist(l.x, l.y, target.x, target.y) <= (weapon.splash_radius as number))
      : [target];
    for (const l of hit) {
      if (weapon.corrode) {
        l.enemy.corrodeTicks = toTicks(weapon.corrode.seconds, cfg);
        l.enemy.corrodePct = Math.round(weapon.corrode.armor_factor * 100);
      }
      damage(cfg, l.enemy, weapon);
      if (weapon.slow) {
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
    damage(cfg, target.enemy, turret);
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
  const map = getDefenseMap(b.map);
  const survivors: BattleEnemy[] = [];
  for (const enemy of b.enemies) {
    if (enemy.hp <= 0) {
      b.killed += 1;
      continue;
    }
    const stats = cfg.defense.enemy_stats[enemy.type];
    if (!stats) continue;

    // A brute halts beside a manned structure in reach and batters it before moving on.
    const ram = stats.structure_attack;
    if (ram) {
      if (enemy.siegeTarget) {
        const held = s.structures.find((d) => d.id === enemy.siegeTarget);
        if (!held || held.hp <= 0 || !held.occupantId || enemy.siegeBlows <= 0) enemy.siegeTarget = null;
      }
      if (!enemy.siegeTarget && enemy.battered.length < ram.max_structures) {
        const [px, py] = lanePoint(b.map, enemy.lane, enemy.progress / 1000);
        let target: DefenseStructure | null = null;
        let nearest = Infinity;
        for (const structure of s.structures) {
          const pos = structure.map === b.map ? map.slots[structure.id] : undefined;
          if (!pos || structure.hp <= 0 || !structure.occupantId || enemy.battered.includes(structure.id)) continue;
          const d = dist(px, py, pos[0], pos[1]);
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

    if (enemy.progress >= laneLength(b.map, enemy.lane) * 1000) {
      b.gateHp = Math.max(0, b.gateHp - stats.gate_damage);
      b.leaked += 1;
      continue;
    }
    survivors.push(enemy);

    if (enemy.cooldown > 0) {
      enemy.cooldown -= 1;
      continue;
    }
    const [x, y] = lanePoint(b.map, enemy.lane, enemy.progress / 1000);

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
        victim.adv.gauge = Math.min(100, victim.adv.gauge + Math.round(petrify.gauge * exposure));
        victim.adv.hp = Math.max(0, victim.adv.hp - Math.round(petrify.damage * exposure));
        shot(b, 'petrify', [x, y], victim.pos);
        enemy.cooldown = toTicks(petrify.cooldown_seconds, cfg);
        if (victim.adv.gauge >= 100 || victim.adv.hp <= 0) {
          solidify(s, cfg, victim.adv.id, b.map, victim.structure.id);
          b.fallen.push(victim.adv.id);
        }
      }
    }

    const target = ram && enemy.siegeTarget ? s.structures.find((d) => d.id === enemy.siegeTarget) : undefined;
    if (ram && target) {
      target.hp = Math.max(0, target.hp - ram.damage);
      enemy.siegeBlows -= 1;
      shot(b, 'structure', [x, y], map.slots[target.id] as Point);
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
  b.enemies = survivors;
}

function tick(s: CampaignState, cfg: GameConfig, b: DefenseBattle): void {
  b.tick += 1;
  spawn(cfg, b);
  const located = locate(b);
  defendersAct(s, cfg, b, located);
  turretsAct(s, cfg, b, located);
  enemiesAct(s, cfg, b);

  if (b.gateHp <= 0) {
    b.outcome = 'loss';
    log(s, 'battle_lost', 'The gate has been broken.');
  } else if (b.enemies.length === 0 && flatGroups(b.map, b.kind).every(({ group }, g) => (b.spawned[g] ?? 0) >= group.count)) {
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
export function waveForecast(map: DefenseBattle['map'], kind?: DefenseBattle['kind']): { wave: number; startSeconds: number; groups: { enemy: string; count: number; lane: string }[] }[] {
  const data = getDefenseMap(map);
  return wavesFor(map, kind).map((w, wave) => ({
    wave: wave + 1,
    startSeconds: w.start_seconds,
    groups: w.groups.map((g) => ({ enemy: g.enemy, count: g.count, lane: data.lane_names[g.lane] ?? `lane ${g.lane + 1}` })),
  }));
}
