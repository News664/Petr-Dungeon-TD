/** Stories Sakuya tells when something is brought home. Shown once when earned, and kept to reread. */
export interface Story {
  title: string;
  speaker: string;
  paragraphs: string[];
}

export const STORIES: Record<string, Story> = {
  the_first: {
    title: 'The first to answer',
    speaker: 'Sakuya',
    paragraphs: [
      'You have brought her home. I did not think anyone would.',
      'She was the first I ever called. Before there was a guild, before there was a seal worth the name, I asked across the dark for anyone at all, and she said yes without knowing what she was agreeing to. That is how all of this began: with her kindness.',
      'She was also the first my sister took. Not in anger. Iwanaga looked at her and saw the one thing in all the worlds that had been freely given, and could not bear that it would end. So she made it not end.',
      'The Keeper of the Galleries hid her for longer than I can count, and paid for it. My sister has never stopped looking. Now she is here, in the grove, and Iwanaga will know it.',
      'She cannot be restored. I want you to understand that I have tried. But there are things below that were hers, and people who remember her, and if you are willing there is a longer road that begins where she fell.',
    ],
  },
};
