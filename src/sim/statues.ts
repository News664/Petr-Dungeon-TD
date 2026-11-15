import type { GameConfig } from './config';
import { findStatue, getAdventurer, treatmentCost } from './selectors';
import type { Adventurer, CampaignState, Statue, StatueLocationType } from './types';
import { fail, log, pay } from './util';

/** Remove her from whatever slot or party she occupies. */
export function clearAssignment(s: CampaignState, adv: Adventurer): void {
  if (adv.assignment.type === 'defense') {
    for (const d of s.structures) if (d.occupantId === adv.id) d.occupantId = null;
  } else if (adv.assignment.type === 'expedition' && s.expedition) {
    s.expedition.partyIds = s.expedition.partyIds.filter((id) => id !== adv.id);
  }
  adv.assignment = { type: 'idle' };
}

export function solidify(
  s: CampaignState,
  cfg: GameConfig,
  adventurerId: string,
  locationType: StatueLocationType,
  locationId: string,
): Statue {
  const adv = getAdventurer(s, adventurerId);
  if (adv.condition !== 'ready') fail(`${adv.name} is already solidified.`);
  clearAssignment(s, adv);
  adv.condition = 'solidified';
  adv.hp = 0;
  adv.gauge = 100;
  const statue: Statue = {
    adventurerId,
    formedAtHour: s.simHour,
    // One universal deadline. Location and structure type are deliberately ignored.
    permanenceAtHour: s.simHour + cfg.clock.solidification_permanence_hours,
    locationType,
    locationId,
    retrievedAtHour: null,
    permanent: false,
    treatment: 'none',
  };
  s.statues.push(statue);
  log(s, 'solidified', `${adv.name} was solidified (${locationType}: ${locationId.replace(/_/g, ' ')}).`);
  return statue;
}

/** Unrecovered statues at or past the deadline become permanent. Runs before any retrieval at the same hour. */
export function processPermanence(s: CampaignState): void {
  for (const st of s.statues) {
    if (st.permanent || st.retrievedAtHour !== null) continue;
    if (s.simHour >= st.permanenceAtHour) {
      st.permanent = true;
      const adv = getAdventurer(s, st.adventurerId);
      adv.condition = 'lost';
      // Her gear was recovered long ago, or never left; either way the armory keeps it.
      for (const slot of ['weapon', 'armor', 'charm'] as const) {
        const itemId = adv.equipment[slot];
        if (itemId) s.armory[itemId] = (s.armory[itemId] ?? 0) + 1;
        adv.equipment[slot] = null;
      }
      if (s.expedition) s.expedition.carriedStatueIds = s.expedition.carriedStatueIds.filter((id) => id !== adv.id);
      log(s, 'permanent', `${adv.name} was abandoned for too long. Her solidification is now permanent.`);
    }
  }
}

/** Bring a statue to a protected facility. Stops exposure; does not revive her. */
export function retrieve(s: CampaignState, statue: Statue, how: string): void {
  if (statue.permanent || s.simHour >= statue.permanenceAtHour) {
    fail(`${getAdventurer(s, statue.adventurerId).name} is permanently solidified and cannot be recovered.`);
  }
  if (statue.retrievedAtHour !== null) return;
  statue.retrievedAtHour = s.simHour;
  statue.locationType = 'sanctuary';
  statue.locationId = 'recovery_ward';
  log(s, 'retrieved', `${getAdventurer(s, statue.adventurerId).name}'s statue was brought to safety (${how}).`);
}

export function retrieveAllAt(s: CampaignState, locationType: StatueLocationType, how: string): number {
  let n = 0;
  for (const st of s.statues) {
    if (st.locationType === locationType && st.retrievedAtHour === null && !st.permanent) {
      retrieve(s, st, how);
      n += 1;
    }
  }
  return n;
}

/** Return her to combat-ready state and drop the statue record. */
export function restoreAdventurer(s: CampaignState, adventurerId: string): void {
  const adv = getAdventurer(s, adventurerId);
  s.statues = s.statues.filter((st) => st.adventurerId !== adventurerId);
  s.treatmentJobs = s.treatmentJobs.filter((j) => j.adventurerId !== adventurerId);
  adv.condition = 'ready';
  adv.hp = adv.maxHp;
  adv.gauge = 0;
  adv.assignment = { type: 'idle' };
}

export function queueTreatment(s: CampaignState, cfg: GameConfig, adventurerId: string): void {
  const adv = getAdventurer(s, adventurerId);
  const statue = findStatue(s, adventurerId) ?? fail(`${adv.name} is not solidified.`);
  if (statue.permanent) fail(`${adv.name} is permanently solidified; treatment cannot help her.`);
  if (statue.retrievedAtHour === null) fail(`${adv.name}'s statue has not been brought back to the sanctuary yet.`);
  if (statue.treatment !== 'none') fail(`${adv.name} is already in the treatment queue.`);
  // Cost is fixed by exposure at retrieval, so waiting in the ward never makes it worse.
  const reagentCost = treatmentCost(s, cfg, statue);
  pay(s, { restoration_reagent: reagentCost }, `restore ${adv.name}`);
  s.treatmentJobs.push({ adventurerId, reagentCost, queuedAtHour: s.simHour, startHour: null, finishHour: null });
  statue.treatment = 'queued';
  log(s, 'treatment_queued', `${adv.name} was queued for restoration (${reagentCost} reagent).`);
  startQueuedTreatments(s, cfg);
}

function startQueuedTreatments(s: CampaignState, cfg: GameConfig): void {
  let running = s.treatmentJobs.filter((j) => j.startHour !== null).length;
  for (const job of s.treatmentJobs) {
    if (running >= cfg.resources.treatment_slots) break;
    if (job.startHour !== null) continue;
    job.startHour = s.simHour;
    job.finishHour = s.simHour + cfg.resources.treatment_hours;
    const statue = findStatue(s, job.adventurerId);
    if (statue) statue.treatment = 'in_progress';
    running += 1;
  }
}

export function processTreatments(s: CampaignState, cfg: GameConfig): void {
  const done = s.treatmentJobs.filter((j) => j.finishHour !== null && j.finishHour <= s.simHour);
  for (const job of done) {
    const name = getAdventurer(s, job.adventurerId).name;
    restoreAdventurer(s, job.adventurerId);
    log(s, 'restored', `${name} has been restored and is combat-ready.`);
  }
  startQueuedTreatments(s, cfg);
}
