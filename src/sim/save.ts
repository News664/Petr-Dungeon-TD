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
  if (wrapper.state.version !== 1) throw new Error(`Save version ${String(wrapper.state.version)} is not supported.`);
  return wrapper.state;
}
