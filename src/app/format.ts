import type { BattleKind, Phase } from '../sim';

export function duration(hours: number): string {
  if (hours <= 0) return 'now';
  const d = Math.floor(hours / 24);
  const h = hours % 24;
  if (d === 0) return `${h}h`;
  return h === 0 ? `${d}d` : `${d}d ${h}h`;
}

export const PHASE_LABEL: Record<Phase, string> = {
  PROLOGUE: 'The last summoner',
  STABLE_FRONTIER: 'Stable frontier',
  DIVINE_EMERGENCY: 'Divine emergency',
  SANCTUARY_SIEGE: 'Sanctuary siege',
  COUNTEROFFENSIVE_PREPARATION: 'Counteroffensive preparation',
  FRONTIER_BREAKTHROUGH: 'Frontier breakthrough',
  GAME_OVER: 'The sanctuary has fallen',
};

export const PHASE_NOTE: Record<Phase, string> = {
  PROLOGUE: 'Sakuya spends the last of her strength on your seal.',
  STABLE_FRONTIER: 'The frontier holds. Secured sites produce normally.',
  DIVINE_EMERGENCY: 'Sakuya is spent. Production is crippled until the rematch is won.',
  SANCTUARY_SIEGE: 'The frontier is overrun. Outside production has stopped.',
  COUNTEROFFENSIVE_PREPARATION: 'The sanctuary held. Rebuild the frontier outpost before the monsters return.',
  FRONTIER_BREAKTHROUGH: 'The outpost stands again. Win the next battle to restore production.',
  GAME_OVER: 'Load an earlier save or a debug state to continue.',
};

export const BATTLE_LABEL: Record<BattleKind, string> = {
  tutorial_defense: 'The first defense',
  frontier_defense: 'Frontier defense',
  frontier_rematch: 'Frontier rematch',
  sanctuary_siege: 'Sanctuary siege',
  frontier_breakthrough: 'Frontier breakthrough',
};

export function title(id: string): string {
  const text = id.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const ENEMY_NAMES: Record<string, [string, string]> = {
  runner: ['runner', 'runners'],
  armored: ['armored brute', 'armored brutes'],
  petrifier: ['petrifier', 'petrifiers'],
  swarmling: ['swarmling', 'swarmlings'],
  wisp: ['wisp', 'wisps'],
  mender: ['mender', 'menders'],
  binder: ['binder', 'binders'],
  husk: ['husk', 'husks'],
  bulwark: ['bulwark', 'bulwarks'],
};

export function enemyCount(enemy: string, count: number): string {
  const names = ENEMY_NAMES[enemy] ?? [enemy, `${enemy}s`];
  return `${count} ${count === 1 ? names[0] : names[1]}`;
}
