import type { CampaignState, Resources, ResourceId } from './types';
import { RESOURCE_IDS } from './types';

/** A rule violation the player (or UI) can be told about. Never a crash. */
export class RuleError extends Error {}

export function fail(message: string): never {
  throw new RuleError(message);
}

const LOG_LIMIT = 400;

export function log(s: CampaignState, type: string, message: string): void {
  s.log.push({ hour: s.simHour, type, message });
  if (s.log.length > LOG_LIMIT) s.log.splice(0, s.log.length - LOG_LIMIT);
}

export function canAfford(s: CampaignState, cost: Partial<Resources>): boolean {
  return RESOURCE_IDS.every((id) => s.resources[id] >= (cost[id] ?? 0));
}

export function pay(s: CampaignState, cost: Partial<Resources>, what: string): void {
  if (!canAfford(s, cost)) fail(`Not enough resources to ${what} (needs ${formatCost(cost)}).`);
  for (const id of RESOURCE_IDS) s.resources[id] -= cost[id] ?? 0;
}

export const RESOURCE_LABELS: Record<ResourceId, string> = {
  ward_energy: 'blossom-light',
  construction_materials: 'construction materials',
  restoration_reagent: 'restoration reagent',
};

export function formatCost(cost: Partial<Resources>): string {
  const parts = RESOURCE_IDS.filter((id) => (cost[id] ?? 0) > 0).map((id) => `${cost[id]} ${RESOURCE_LABELS[id]}`);
  return parts.length ? parts.join(', ') : 'nothing';
}

export function formatHour(hour: number, hoursPerDay = 24): string {
  const day = Math.floor(hour / hoursPerDay) + 1;
  const h = hour % hoursPerDay;
  return `Day ${day}, ${String(h).padStart(2, '0')}:00`;
}
