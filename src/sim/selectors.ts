import type { GameConfig } from './config';
import type { Adventurer, BattleKind, CampaignState, DefenseStructure, Phase, Statue } from './types';
import { fail } from './util';

export function getAdventurer(s: CampaignState, id: string): Adventurer {
  return s.adventurers.find((a) => a.id === id) ?? fail(`Unknown adventurer "${id}".`);
}

export function getStructure(s: CampaignState, id: string): DefenseStructure {
  return s.structures.find((d) => d.id === id) ?? fail(`Unknown structure "${id}".`);
}

export function findStatue(s: CampaignState, adventurerId: string): Statue | undefined {
  return s.statues.find((st) => st.adventurerId === adventurerId);
}

/** The guild holds the frontier line (and so can reach the frontier map and the dungeon). */
export function frontierHeld(phase: Phase): boolean {
  return phase === 'STABLE_FRONTIER' || phase === 'DIVINE_EMERGENCY' || phase === 'FRONTIER_BREAKTHROUGH';
}

/** Share of normal output that secured sites can deliver in the current phase. */
export function productionMultiplier(s: CampaignState, cfg: GameConfig): number {
  switch (s.phase) {
    case 'STABLE_FRONTIER':
      return 1;
    case 'DIVINE_EMERGENCY':
      return cfg.campaign.emergency_production_multiplier;
    case 'SANCTUARY_SIEGE':
      return cfg.campaign.siege_outside_production_multiplier;
    case 'COUNTEROFFENSIVE_PREPARATION':
    case 'FRONTIER_BREAKTHROUGH':
      return cfg.campaign.counteroffensive_outside_production_multiplier;
    case 'GAME_OVER':
      return 0;
  }
}

export function battleKindForPhase(phase: Phase): BattleKind {
  switch (phase) {
    case 'STABLE_FRONTIER':
      return 'frontier_defense';
    case 'DIVINE_EMERGENCY':
      return 'frontier_rematch';
    case 'FRONTIER_BREAKTHROUGH':
      return 'frontier_breakthrough';
    default:
      return 'sanctuary_siege';
  }
}

export function combatReady(s: CampaignState): Adventurer[] {
  return s.adventurers.filter((a) => a.condition === 'ready');
}

/** Everyone who still occupies a roster place (permanently lost champions free theirs). */
export function rosterCount(s: CampaignState): number {
  return s.adventurers.filter((a) => a.condition !== 'lost').length;
}

/** Hours spent abandoned. Stops growing once she is safely retrieved. */
export function exposureHours(s: CampaignState, statue: Statue): number {
  return (statue.retrievedAtHour ?? s.simHour) - statue.formedAtHour;
}

export function treatmentCost(s: CampaignState, cfg: GameConfig, statue: Statue): number {
  const exposure = exposureHours(s, statue);
  const brackets = cfg.resources.restoration_cost_brackets;
  const bracket = brackets.find((b) => exposure < b.elapsed_hours_lt) ?? brackets[brackets.length - 1];
  return cfg.resources.treatment_base_reagents * (bracket?.multiplier ?? 1);
}

export function miracleRestoreCount(cfg: GameConfig, fallen: number): number {
  const exact = fallen * cfg.campaign.miracle_restore_fraction;
  const mode = cfg.campaign.miracle_restore_rounding;
  const n = mode === 'floor' ? Math.floor(exact) : mode === 'round' ? Math.round(exact) : Math.ceil(exact);
  return Math.max(0, Math.min(fallen, n));
}

export function recoverableStatues(s: CampaignState, locationType?: Statue['locationType']): Statue[] {
  return s.statues.filter(
    (st) => !st.permanent && st.retrievedAtHour === null && (locationType === undefined || st.locationType === locationType),
  );
}

/** Next hour at which something scheduled happens, for "skip to next event". */
export function nextEventHour(s: CampaignState, cfg: GameConfig): number {
  const day = cfg.clock.hours_per_day;
  const candidates: number[] = [(Math.floor(s.simHour / day) + 1) * day];
  if (s.nextInvasionHour !== null) candidates.push(s.nextInvasionHour);
  if (s.rebuild) candidates.push(s.rebuild.finishHour);
  for (const job of s.treatmentJobs) if (job.finishHour !== null) candidates.push(job.finishHour);
  for (const st of recoverableStatues(s)) candidates.push(st.permanenceAtHour);
  if (s.seal.nextAvailableHour > s.simHour) candidates.push(s.seal.nextAvailableHour);
  return Math.min(...candidates.filter((h) => h > s.simHour));
}
