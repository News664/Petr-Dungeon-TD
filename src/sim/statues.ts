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
  medium = 'stone',
): Statue {
  const adv = getAdventurer(s, adventurerId);
  if (adv.condition !== 'ready') fail(`${adv.name} is already solidified.`);
  clearAssignment(s, adv);
  const turning = adv.medium;
  adv.condition = 'solidified';
  adv.hp = 0;
  adv.gauge = 100;
  adv.medium = turning ?? medium;
  const statue: Statue = {
    adventurerId,
    formedAtHour: s.simHour,
    // One universal deadline. Location and structure type are deliberately ignored.
    permanenceAtHour: s.simHour + cfg.clock.solidification_permanence_hours,
    locationType,
    locationId,
    retrievedAtHour: null,
    permanent: false,
    // Whatever had already begun on her finishes the job; otherwise what struck the last blow.
    medium: adv.medium ?? medium,
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
      // She herself will never be harmed, but what she wore and carried does not last out there.
      const perished = (['weapon', 'armor', 'charm'] as const).filter((slot) => adv.equipment[slot]);
      for (const slot of perished) adv.equipment[slot] = null;
      log(s, 'permanent', `${adv.name} was abandoned for too long. Her solidification is now permanent${perished.length > 0 ? ', and her gear is past saving' : ''}.`);
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

/** A permanently lost champion is brought home to stand in the memorial. She is not restored. */
export function enshrine(s: CampaignState, statue: Statue): void {
  if (!statue.permanent || statue.locationType === 'memorial') return;
  statue.locationType = 'memorial';
  statue.locationId = 'memorial';
  log(s, 'enshrined', `${getAdventurer(s, statue.adventurerId).name} was carried home. She stands in the memorial now.`);
}

export function retrieveAllAt(s: CampaignState, locationType: StatueLocationType, how: string): number {
  let n = 0;
  for (const st of s.statues) {
    if (st.locationType !== locationType) continue;
    if (st.permanent) enshrine(s, st); // too late for her, but she is not left out there
    else if (st.retrievedAtHour === null) {
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
  adv.medium = null;
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
