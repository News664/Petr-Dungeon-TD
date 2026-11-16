import type { EnemyAttack, GameConfig } from './config';
import { tileKey } from './dungeonMap';
import { defeatBoss } from './economy';
import { wipeExpedition } from './expeditionCore';
import { addMilestone, applyRemedy, rankScale, refreshDerived, skillRank, statsOf } from './growth';
import { nextRandom, randomInt } from './rng';
import { getAdventurer } from './selectors';
import { solidify } from './statues';
import { advanceMinutes, ensureClockFree } from './time';
import type { Adventurer, CampaignState, CombatAction, CombatEnemy, CombatKind, DungeonCombat, Expedition } from './types';
import { RESOURCE_IDS } from './types';
import { fail, log } from './util';

/**
 * Turn-based labyrinth combat. The player commits one action per party
 * member, then the whole round resolves in speed order. Enemies follow fixed
 * move patterns, so their next move can always be shown before it happens.
 */

const LOG_LINES = 60;

function fight(s: CampaignState): { exp: Expedition; c: DungeonCombat } {
  const exp = s.expedition ?? fail('No expedition is under way.');
  const c = exp.combat ?? fail('The party is not in a fight.');
  return { exp, c };
}

const party = (s: CampaignState, exp: Expedition) => exp.partyIds.map((id) => getAdventurer(s, id));
const alive = (c: DungeonCombat) => c.enemies.filter((e) => e.hp > 0);
const say = (c: DungeonCombat, line: string) => {
  c.log.push(line);
  if (c.log.length > LOG_LINES) c.log.splice(0, c.log.length - LOG_LINES);
};

export function startCombat(s: CampaignState, cfg: GameConfig, kind: CombatKind, group: string[], eliteId: string | null): void {
  const exp = s.expedition ?? fail('No expedition is under way.');
  const enemies: CombatEnemy[] = group.map((type, i) => {
    const data = cfg.dungeon.enemies[type] ?? fail(`Unknown enemy "${type}".`);
    return { id: i + 1, type, hp: data.hp, maxHp: data.hp, patternIndex: 0, corrode: 0, slow: 0 };
  });
  const names = enemies.map((e) => cfg.dungeon.enemies[e.type]?.name).join(', ');
  const intro = kind === 'boss' ? `The master of this stratum rises: ${names}.` : kind === 'elite' ? `The party is caught by ${names}.` : `Monsters attack: ${names}.`;
  exp.combat = { kind, eliteId, round: 0, enemies, shieldWall: 0, wardMist: 0, taunt: null, log: [intro] };
  log(s, 'combat', intro);
}

/** The move an enemy will make on its next turn. */
export function enemyIntent(cfg: GameConfig, enemy: CombatEnemy): EnemyAttack | undefined {
  const pattern = cfg.dungeon.enemies[enemy.type]?.pattern ?? [];
  return cfg.dungeon.attacks[pattern[enemy.patternIndex % pattern.length] ?? ''];
}

/** Attack power of an adventurer in the labyrinth: level, skills and gear counted in. */
export function partyAttack(cfg: GameConfig, adv: Adventurer): number {
  return statsOf(cfg, adv).atk;
}

function validate(cfg: GameConfig, exp: Expedition, c: DungeonCombat, adv: Adventurer, action: CombatAction): void {
  if (action.type === 'guard') return;
  if (action.type === 'attack') {
    if (!c.enemies.some((e) => e.id === action.target)) fail(`${adv.name} has no such target.`);
    return;
  }
  if (action.type === 'item') {
    const item = cfg.supplies.items[action.itemId] ?? fail('There is no such supply.');
    if ((exp.pack[action.itemId] ?? 0) <= 0) fail(`The party has no ${item.name} left.`);
    if (!exp.partyIds.includes(action.target)) fail(`${item.name} needs someone in the party.`);
    return;
  }
  const skill = cfg.dungeon.skills[action.skillId];
  if (!skill || skill.effect.kind === 'passive' || skillRank(adv, action.skillId) < 1) fail(`${adv.name} does not know that skill.`);
  if (adv.sp < skill.sp) fail(`${adv.name} does not have the skill points for ${skill.name}.`);
  if (skill.target === 'enemy' && !c.enemies.some((e) => e.id === action.target)) fail(`${skill.name} needs an enemy target.`);
  if (skill.target === 'ally' && !exp.partyIds.includes(String(action.target))) fail(`${skill.name} needs an ally in the party.`);
}

function strike(cfg: GameConfig, adv: Adventurer, enemy: CombatEnemy, power: number, pierce: boolean, frontStands: boolean): number {
  const D = cfg.dungeon;
  const stats = D.class_stats[adv.classId];
  const reach = stats?.melee && adv.row === 'back' && frontStands ? D.back_row_melee_dealt : 1;
  const armor = pierce ? 0 : Math.round((D.enemies[enemy.type]?.def ?? 0) * (enemy.corrode > 0 ? 0.5 : 1));
  const dealt = Math.max(1, Math.round(partyAttack(cfg, adv) * power * reach) - armor);
  enemy.hp = Math.max(0, enemy.hp - dealt);
  return dealt;
}

function partyActs(s: CampaignState, cfg: GameConfig, exp: Expedition, c: DungeonCombat, adv: Adventurer, action: CombatAction): void {
  const D = cfg.dungeon;
  const name = (e: CombatEnemy) => D.enemies[e.type]?.name ?? e.type;
  const frontStands = party(s, exp).some((a) => a.row === 'front');
  // A target that died earlier in the round is replaced by the first enemy still standing.
  const targetEnemy = (id: number | string | undefined) => alive(c).find((e) => e.id === id) ?? alive(c)[0];

  if (action.type === 'attack') {
    const enemy = targetEnemy(action.target);
    if (!enemy) return;
    const dealt = strike(cfg, adv, enemy, 1, false, frontStands);
    say(c, `${adv.name} attacks ${name(enemy)} for ${dealt}.${enemy.hp === 0 ? ` ${name(enemy)} falls.` : ''}`);
    return;
  }
  if (action.type === 'item') {
    const item = cfg.supplies.items[action.itemId];
    const ally = party(s, exp).find((a) => a.id === action.target);
    if (!item || !ally || (exp.pack[action.itemId] ?? 0) <= 0) return; // gone, or her patient is already stone
    exp.pack[action.itemId] = (exp.pack[action.itemId] ?? 0) - 1;
    say(c, `${adv.name} uses a ${item.name}: ${applyRemedy(item.effect, ally, 1)}.`);
    return;
  }
  if (action.type !== 'skill') return;
  const skill = D.skills[action.skillId];
  if (!skill || adv.sp < skill.sp) return;
  const effect = skill.effect;
  if (effect.kind === 'party_buff' || effect.kind === 'taunt' || effect.kind === 'passive') return; // buffs were applied at the start of the round
  adv.sp -= skill.sp;
  const rank = skillRank(adv, action.skillId);
  const scale = rankScale(cfg, rank);

  if (effect.kind === 'damage') {
    const targets = skill.target === 'all_enemies' ? alive(c) : [targetEnemy(action.target)].filter((e): e is CombatEnemy => !!e);
    const parts = targets.map((enemy) => {
      const dealt = strike(cfg, adv, enemy, effect.power * scale, effect.pierce ?? false, frontStands);
      if (effect.status && enemy.hp > 0) enemy[effect.status] = effect.rounds ?? 1;
      return `${name(enemy)} ${dealt}${enemy.hp === 0 ? ' (falls)' : ''}`;
    });
    say(c, `${adv.name} uses ${skill.name}: ${parts.join(', ')}.`);
  } else if (effect.kind === 'status') {
    const enemy = targetEnemy(action.target);
    if (!enemy) return;
    enemy[effect.status] = effect.rounds + rank - 1;
    say(c, `${adv.name} uses ${skill.name} on ${name(enemy)}.`);
  } else {
    const ally = party(s, exp).find((a) => a.id === action.target);
    if (!ally) {
      adv.sp += skill.sp; // her patient is already stone; nothing is spent
      return;
    }
    say(c, `${adv.name} uses ${skill.name}: ${applyRemedy(effect, ally, scale * statsOf(cfg, adv).support)}.`);
  }
}

function enemyActs(s: CampaignState, cfg: GameConfig, exp: Expedition, c: DungeonCombat, enemy: CombatEnemy, guarding: Set<string>): void {
  const D = cfg.dungeon;
  const data = D.enemies[enemy.type];
  const attack = enemyIntent(cfg, enemy);
  enemy.patternIndex += 1;
  if (!data || !attack) return;
  if (attack.charge) {
    say(c, `${data.name} ${attack.telegraph ?? 'gathers itself'}.`);
    return;
  }
  const living = party(s, exp);
  if (living.length === 0) return;
  const front = living.filter((a) => a.row === 'front');
  const back = living.filter((a) => a.row === 'back');
  // Melee cannot get past a standing front row.
  const reach = attack.kind === 'melee' && front.length > 0 ? front : living;

  let targets: Adventurer[];
  if (attack.target === 'all') targets = living;
  else if (attack.target === 'row') {
    const rows = attack.kind === 'melee' ? [reach] : [front, back].filter((r) => r.length > 0);
    targets = rows[randomInt(s, rows.length)] ?? living;
  } else {
    const taunter = c.taunt ? living.find((a) => a.id === c.taunt?.adventurerId) : undefined;
    targets = [taunter ?? (reach[randomInt(s, reach.length)] as Adventurer)];
  }

  const where = tileKey(exp.stratumId, exp.floor, exp.x, exp.y);
  for (const target of targets) {
    const guard = guarding.has(target.id) ? D.guard_multiplier : 1;
    const wall = c.shieldWall > 0 ? D.shield_wall_multiplier : 1;
    const their = statsOf(cfg, target);
    const def = their.def;
    const dealt = Math.max(1, Math.round(data.atk * (attack.power ?? 1) * guard * wall) - def);
    const stone = Math.round((attack.gauge ?? 0) * guard * (c.wardMist > 0 ? D.ward_mist_multiplier : 1) * (1 - their.gaugeResist));
    target.hp = Math.max(0, target.hp - dealt);
    target.gauge = Math.min(100, target.gauge + stone);
    say(c, `${data.name} uses ${attack.name} on ${target.name}: ${dealt} damage${stone > 0 ? `, +${stone}% solidified` : ''}.`);
    if (target.hp <= 0 || target.gauge >= 100) {
      solidify(s, cfg, target.id, 'dungeon', where);
      say(c, `${target.name} is solidified.`);
      if (c.taunt?.adventurerId === target.id) c.taunt = null;
    }
  }
}

function grantXp(cfg: GameConfig, adv: Adventurer, xp: number): boolean {
  const D = cfg.dungeon;
  adv.xp += xp;
  let levelled = false;
  while (adv.level < D.level_cap && adv.xp >= adv.level * D.xp_per_level) {
    adv.xp -= adv.level * D.xp_per_level;
    adv.level += 1;
    adv.skillPoints += D.skill_points_per_level;
    refreshDerived(cfg, adv);
    levelled = true;
  }
  return levelled;
}

function victory(s: CampaignState, cfg: GameConfig, exp: Expedition, c: DungeonCombat): void {
  const D = cfg.dungeon;
  let xp = 0;
  for (const e of c.enemies) {
    const data = D.enemies[e.type];
    xp += data?.xp ?? 0;
    for (const id of RESOURCE_IDS) exp.loot[id] += data?.loot[id] ?? 0;
  }
  say(c, `Victory. Each survivor gains ${xp} experience.`);
  for (const adv of party(s, exp)) {
    if (grantXp(cfg, adv, xp)) say(c, `${adv.name} reaches level ${adv.level} and has a skill point to spend.`);
  }
  exp.report = c.log.slice(-12);
  exp.combat = null;
  log(s, 'combat_won', `The party won a fight on floor ${exp.floor + 1}.`);
  if (c.kind === 'elite' && c.eliteId) {
    s.dungeon.eliteRespawnHour[c.eliteId] = s.simHour + D.elite_respawn_hours;
    addMilestone(s, 'elite');
  }
  if (c.kind === 'boss') {
    addMilestone(s, 'boss');
    defeatBoss(s, exp.stratumId);
  }
}

/** True when the fight ended (either way) and the round must stop. */
function settled(s: CampaignState, cfg: GameConfig, exp: Expedition, c: DungeonCombat): boolean {
  if (exp.partyIds.length === 0) {
    wipeExpedition(s, tileKey(exp.stratumId, exp.floor, exp.x, exp.y));
    return true;
  }
  if (alive(c).length === 0) {
    victory(s, cfg, exp, c);
    return true;
  }
  return false;
}

function endRound(s: CampaignState, cfg: GameConfig, c: DungeonCombat): void {
  if (c.shieldWall > 0) c.shieldWall -= 1;
  if (c.wardMist > 0) c.wardMist -= 1;
  if (c.taunt && --c.taunt.rounds <= 0) c.taunt = null;
  for (const e of c.enemies) {
    if (e.corrode > 0) e.corrode -= 1;
    if (e.slow > 0) e.slow -= 1;
  }
  advanceMinutes(s, cfg, cfg.clock.battle_action_minutes);
}

export function resolveRound(s: CampaignState, cfg: GameConfig, actions: Record<string, CombatAction>): void {
  const { exp, c } = fight(s);
  ensureClockFree(s);
  const D = cfg.dungeon;
  const plan = new Map<string, CombatAction>();
  for (const adv of party(s, exp)) {
    const action = actions[adv.id] ?? { type: 'guard' };
    validate(cfg, exp, c, adv, action);
    plan.set(adv.id, action);
  }

  c.round += 1;
  say(c, `— Round ${c.round} —`);
  const guarding = new Set<string>();
  // Guards and party-wide protections are in place before anyone moves.
  for (const adv of party(s, exp)) {
    const action = plan.get(adv.id);
    if (action?.type === 'guard') guarding.add(adv.id);
    if (action?.type !== 'skill') continue;
    const skill = D.skills[action.skillId];
    if (!skill) continue;
    if (skill.effect.kind === 'party_buff') {
      adv.sp -= skill.sp;
      const rounds = skill.effect.rounds + skillRank(adv, action.skillId) - 1;
      if (skill.effect.buff === 'shield_wall') c.shieldWall = rounds;
      else c.wardMist = rounds;
      say(c, `${adv.name} raises ${skill.name}.`);
    } else if (skill.effect.kind === 'taunt') {
      adv.sp -= skill.sp;
      c.taunt = { adventurerId: adv.id, rounds: skill.effect.rounds + skillRank(adv, action.skillId) - 1 };
      say(c, `${adv.name} draws the enemy's eyes.`);
    }
  }

  type Actor = { side: 0 | 1; key: string | number; speed: number; order: number };
  const actors: Actor[] = [
    ...party(s, exp).map((a, i) => ({ side: 0 as const, key: a.id, speed: statsOf(cfg, a).speed, order: i })),
    ...alive(c).map((e, i) => ({ side: 1 as const, key: e.id, speed: (D.enemies[e.type]?.speed ?? 0) / (e.slow > 0 ? 2 : 1), order: i })),
  ].sort((a, b) => b.speed - a.speed || a.side - b.side || a.order - b.order);

  for (const actor of actors) {
    if (actor.side === 0) {
      if (!exp.partyIds.includes(actor.key as string)) continue; // solidified earlier this round
      partyActs(s, cfg, exp, c, getAdventurer(s, actor.key as string), plan.get(actor.key as string) as CombatAction);
    } else {
      const enemy = c.enemies.find((e) => e.id === actor.key);
      if (!enemy || enemy.hp <= 0) continue;
      enemyActs(s, cfg, exp, c, enemy, guarding);
    }
    if (settled(s, cfg, exp, c)) {
      if (s.expedition) advanceMinutes(s, cfg, cfg.clock.battle_action_minutes);
      return;
    }
  }
  endRound(s, cfg, c);
}

export function escapeCombat(s: CampaignState, cfg: GameConfig): void {
  const { exp, c } = fight(s);
  ensureClockFree(s);
  if (c.kind === 'boss') fail('There is no escaping this fight.');
  const chance = c.kind === 'elite' ? cfg.dungeon.escape_chance.elite : cfg.dungeon.escape_chance.normal;
  c.round += 1;
  if (nextRandom(s) < chance) {
    exp.report = [...c.log.slice(-6), 'The party got away.'];
    exp.combat = null;
    // Fall back to the tile they came from, out of an elite's path.
    exp.x = exp.prevX;
    exp.y = exp.prevY;
    advanceMinutes(s, cfg, cfg.clock.battle_action_minutes);
    return;
  }
  say(c, `— Round ${c.round} — The party tries to flee and is cut off.`);
  for (const enemy of alive(c)) {
    enemyActs(s, cfg, exp, c, enemy, new Set());
    if (settled(s, cfg, exp, c)) return;
  }
  endRound(s, cfg, c);
}

export function debugWinCombat(s: CampaignState, cfg: GameConfig): void {
  const { exp, c } = fight(s);
  for (const e of c.enemies) e.hp = 0;
  victory(s, cfg, exp, c);
}
