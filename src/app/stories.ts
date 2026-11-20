import raw from '../../content/stories.json';

/** Words spoken at the campaign's turning points. The text lives in content/stories.json. */
export interface Story {
  title: string;
  speaker: string;
  when: string;
  paragraphs: string[];
}

export const STORIES: Record<string, Story> = Object.fromEntries(Object.entries(raw).filter(([id]) => !id.startsWith('_'))) as Record<string, Story>;
