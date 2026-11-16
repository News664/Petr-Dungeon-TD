import type { CampaignState } from './types';

const SAVE_FORMAT = 'last-sanctuary-save';

/** The whole campaign is plain data, so a save is just that data, tagged and versioned. */
export function serialize(state: CampaignState): string {
  return JSON.stringify({ format: SAVE_FORMAT, state });
}

export function deserialize(text: string): CampaignState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('This save is not readable.');
  }
  const wrapper = parsed as { format?: string; state?: CampaignState };
  if (wrapper?.format !== SAVE_FORMAT || !wrapper.state) throw new Error('This is not a Last Sanctuary save.');
  const state = wrapper.state;
  const saved = state as unknown as { version: number; playerName?: string; standardCast?: boolean };
  if (saved.version === 3) {
    saved.playerName = 'Master';
    saved.version = 4;
  }
  if (saved.version === 4) {
    // Champions gained traits, aptitudes and a medium; older ones simply have none.
    saved.standardCast = false;
    for (const adv of state.adventurers) Object.assign(adv, { epithet: null, trait: null, aptitude: {}, medium: adv.gauge > 0 ? 'stone' : null });
    for (const statue of state.statues) statue.medium = 'stone';
    saved.version = 5;
  }
  if (saved.version === 5) {
    state.dungeon.flags = [];
    state.memorialUnnamed = 0;
    if (state.expedition) Object.assign(state.expedition, { sprung: [], exhibits: [] });
    saved.version = 6;
  }
  if (saved.version === 6) {
    state.stories = [];
    saved.version = 7;
  }
  if (saved.version !== 7) throw new Error('This save is from an older build of the prototype and cannot be loaded.');
  return state;
}
