import { completeRebuild, triggerInvasion } from './campaign';
import type { GameConfig } from './config';
import { applyDailyProduction } from './economy';
import { frontierHeld, recoverableStatues } from './selectors';
import { processPermanence, processTreatments, retrieveAllAt } from './statues';
import type { CampaignState } from './types';
import { fail, log } from './util';

export function ensureClockFree(s: CampaignState): void {
  if (s.phase === 'GAME_OVER') fail('The sanctuary has fallen.');
  if (s.pendingMiracle) fail('Choose who the goddess restores first.');
  if (s.pendingBattle) fail('The attack has arrived and must be fought before time moves on.');
}

/**
 * Everything that can happen at one hour boundary, in a fixed order:
 * permanence -> treatment -> rebuild (and its retrieval) -> daily production -> invasion.
 */
function processHour(s: CampaignState, cfg: GameConfig): void {
  processPermanence(s);
  processTreatments(s, cfg);
  if (s.rebuild && s.simHour >= s.rebuild.finishHour) completeRebuild(s);
  if (s.simHour % cfg.clock.hours_per_day === 0) applyDailyProduction(s, cfg);
  if (s.nextInvasionHour !== null && s.simHour >= s.nextInvasionHour) triggerInvasion(s);
}

/** The single place the clock moves. Steps hour by hour so no event is ever skipped. */
export function advanceHours(s: CampaignState, cfg: GameConfig, hours: number): number {
  if (!Number.isInteger(hours) || hours < 0) fail('Time can only move forward by whole hours.');
  ensureClockFree(s);
  let advanced = 0;
  while (advanced < hours) {
    s.simHour += 1;
    advanced += 1;
    processHour(s, cfg);
    if (s.pendingBattle) break; // the remaining time is not spent
  }
  return advanced;
}

/** Sub-hour actions (dungeon steps, battle turns) accumulate until they fill an hour. */
export function advanceMinutes(s: CampaignState, cfg: GameConfig, minutes: number): void {
  if (!Number.isInteger(minutes) || minutes < 0) fail('Time can only move forward.');
  ensureClockFree(s);
  const total = s.minuteCarry + minutes;
  const hours = Math.floor(total / 60);
  s.minuteCarry = total % 60;
  if (hours > 0 && advanceHours(s, cfg, hours) < hours) s.minuteCarry = 0;
}

/** Idle adventurers walk to the held frontier and carry back the statues left there. */
export function frontierRecoverySortie(s: CampaignState, cfg: GameConfig): void {
  ensureClockFree(s);
  if (!frontierHeld(s.phase)) fail('The frontier is overrun; nobody can reach the statues there.');
  if (recoverableStatues(s, 'frontier').length === 0) fail('There are no recoverable statues at the frontier.');
  if (!s.adventurers.some((a) => a.condition === 'ready' && a.assignment.type === 'idle')) {
    fail('No idle adventurer is free to make the trip.');
  }
  const hours = cfg.campaign.frontier_recovery_sortie_hours;
  if (s.nextInvasionHour !== null && s.simHour + hours > s.nextInvasionHour) {
    fail('There is not enough time to reach the frontier and return before the next attack.');
  }
  log(s, 'sortie', `A recovery sortie left for the frontier (${hours} hours).`);
  advanceHours(s, cfg, hours);
  retrieveAllAt(s, 'frontier', 'recovery sortie');
}
