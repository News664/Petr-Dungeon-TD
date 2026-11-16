import { getAdventurer } from './selectors';
import { enshrine, retrieve } from './statues';
import type { CampaignState } from './types';
import { RESOURCE_IDS } from './types';
import { formatCost, log } from './util';

/** The party is home: bank the loot, bring carried statues to the ward, free the members. */
export function finishExpedition(s: CampaignState, how: string): void {
  const exp = s.expedition;
  if (!exp) return;
  for (const id of exp.partyIds) getAdventurer(s, id).assignment = { type: 'idle' };
  for (const st of s.statues.filter((x) => exp.carriedStatueIds.includes(x.adventurerId))) {
    if (st.permanent) enshrine(s, st);
    else retrieve(s, st, 'carried out by the expedition');
  }
  if (exp.exhibits.length > 0) {
    s.memorialUnnamed += exp.exhibits.length;
    log(s, 'enshrined', `${exp.exhibits.length} of the long lost ${exp.exhibits.length === 1 ? 'was' : 'were'} carried home to the memorial. Nobody knows their names.`);
  }
  for (const id of RESOURCE_IDS) s.resources[id] += exp.loot[id];
  for (const [id, n] of Object.entries(exp.pack)) s.supplies[id] = (s.supplies[id] ?? 0) + n;
  const haul = RESOURCE_IDS.some((id) => exp.loot[id] > 0) ? ` They brought back ${formatCost(exp.loot)}.` : '';
  s.expedition = null;
  log(s, 'expedition_returned', `${how}${haul}`);
}

/** Everyone in the party is stone. Whatever they carried stays where they fell. */
export function wipeExpedition(s: CampaignState, locationId: string): void {
  const exp = s.expedition;
  if (!exp) return;
  for (const st of s.statues) {
    if (exp.carriedStatueIds.includes(st.adventurerId)) st.locationId = locationId;
  }
  // The nameless ones they were carrying are set back where they stood.
  s.dungeon.flags = s.dungeon.flags.filter((f) => !exp.exhibits.includes(f));
  s.expedition = null;
  log(s, 'expedition_wiped', 'The whole expedition was solidified. Everything they carried is lost; a rescue party will be needed.');
}
