import { getStratumMap, parseTileKey, tileAt } from './dungeonMap';
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
  // Most of the long lost are nameless. One of them is the statue the Keeper hid from Iwanaga.
  const prized = exp.exhibits.filter((key) => {
    const at = parseTileKey(key);
    const floor = at ? getStratumMap(at.stratumId)?.floors[at.floor] : undefined;
    return at && floor ? tileAt(floor, at.x, at.y) === 'P' : false;
  });
  const nameless = exp.exhibits.length - prized.length;
  if (nameless > 0) {
    s.memorialUnnamed += nameless;
    log(s, 'enshrined', `${nameless} of the long lost ${nameless === 1 ? 'was' : 'were'} carried home to the Still Grove. Nobody knows their names.`);
  }
  if (prized.length > 0 && !s.stories.includes('the_first')) {
    s.stories.push('the_first');
    log(s, 'story', 'The statue the Keeper guarded stands in the Still Grove. Sakuya has something to tell you.');
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
