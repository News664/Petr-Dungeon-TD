import { tell } from './story';
import type { GameConfig } from './config';
import { productionMultiplier } from './selectors';
import type { CampaignState } from './types';
import { RESOURCE_IDS } from './types';
import { RESOURCE_LABELS, fail, log } from './util';

/** Runs once per in-game day boundary. */
export function applyDailyProduction(s: CampaignState, cfg: GameConfig): void {
  const r = cfg.resources;
  const before = { ...s.resources };

  // Sanctuary baseline: small, always on, even under siege.
  s.resources.ward_energy += r.sanctuary_ward_energy_generation_per_day;
  s.resources.ward_energy -= Math.min(s.resources.ward_energy, r.sanctuary_ward_energy_upkeep_per_day);

  const mult = productionMultiplier(s, cfg);
  for (const stratum of s.strata) {
    for (const dep of stratum.deposits) {
      if (!stratum.secured) {
        dep.lastStatus = 'unsecured';
      } else if (!dep.active) {
        // Evacuated by the player: no output, no upkeep, workers are safe.
        dep.lastStatus = 'shut_down';
      } else if (mult <= 0) {
        dep.lastStatus = 'cut_off';
      } else {
        const upkeep = Math.ceil(dep.wardUpkeepPerDay * mult);
        if (s.resources.ward_energy < upkeep) {
          // Workers shelter for the day instead of working unprotected.
          dep.lastStatus = 'unpowered';
          log(s, 'ward_shortfall', `Not enough ward energy to protect ${stratum.name}; its workers sheltered and produced nothing today.`);
        } else {
          s.resources.ward_energy -= upkeep;
          for (const id of RESOURCE_IDS) s.resources[id] += Math.floor(dep.dailyYield[id] * mult);
          dep.lastStatus = 'producing';
        }
      }
    }
  }

  const delta = RESOURCE_IDS.map((id) => {
    const d = s.resources[id] - before[id];
    return `${d >= 0 ? '+' : ''}${d} ${RESOURCE_LABELS[id]}`;
  }).join(', ');
  log(s, 'daily_production', `Daily ledger: ${delta}.`);
}

/** Reported by the dungeon layer when the final-floor boss falls. */
export function defeatBoss(s: CampaignState, stratumId: string): void {
  const index = s.strata.findIndex((st) => st.id === stratumId);
  const stratum = s.strata[index] ?? fail(`Unknown stratum "${stratumId}".`);
  if (stratum.bossDefeated) fail(`${stratum.name} is already secured.`);
  if (s.frontierStratumId !== stratumId) fail(`${stratum.name} is not the active frontier stratum.`);
  stratum.bossDefeated = true;
  stratum.secured = true;
  tell(s, `${stratumId}_secured`);
  for (const dep of stratum.deposits) {
    dep.active = true;
    dep.lastStatus = 'producing';
  }
  // The frontier moves on; the invasion schedule itself does not change.
  s.frontierStratumId = s.strata[index + 1]?.id ?? null;
  log(s, 'stratum_secured', `${stratum.name} is secured. Protected extraction can begin; ward upkeep is still required.`);
}

export function setDepositActive(s: CampaignState, depositId: string, active: boolean): void {
  for (const stratum of s.strata) {
    const dep = stratum.deposits.find((d) => d.id === depositId);
    if (!dep) continue;
    if (!stratum.secured) fail(`${stratum.name} is not secured yet.`);
    dep.active = active;
    dep.lastStatus = active ? dep.lastStatus : 'shut_down';
    log(s, 'deposit_toggled', active ? `Workers returned to ${stratum.name}.` : `${stratum.name} was evacuated and shut down.`);
    return;
  }
  fail(`Unknown deposit "${depositId}".`);
}
