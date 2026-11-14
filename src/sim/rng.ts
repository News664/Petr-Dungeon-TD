/**
 * Seeded generator (mulberry32). The state lives in CampaignState so that
 * a reloaded save continues the exact same sequence.
 */
export function nextRandom(holder: { rngState: number }): number {
  holder.rngState = (holder.rngState + 0x6d2b79f5) | 0;
  let t = holder.rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randomInt(holder: { rngState: number }, maxExclusive: number): number {
  return Math.floor(nextRandom(holder) * maxExclusive);
}
