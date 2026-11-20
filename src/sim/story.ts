import type { CampaignState } from './types';

/**
 * Note that a story moment has happened. The rules only record the id, once;
 * the words live in content/stories.json and are shown by the interface.
 */
export function tell(s: CampaignState, id: string): void {
  if (!s.stories.includes(id)) s.stories.push(id);
}
