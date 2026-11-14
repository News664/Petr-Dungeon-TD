import { describe, expect, it } from 'vitest';
import { portraitFor, validateManifest } from './manifest';
import type { CharacterArt } from './manifest';

const ysolde: CharacterArt = {
  id: 'ysolde',
  stages: [
    { key: 'late', fromGauge: 75, file: 'ysolde/late.webp' },
    { key: 'normal', fromGauge: 0, file: 'ysolde/normal.webp' },
    { key: 'early', fromGauge: 25, file: 'ysolde/early.webp' },
    { key: 'mid', fromGauge: 50, file: 'ysolde/mid.webp' },
  ],
  statue: 'ysolde/statue.webp',
};

describe('art manifest', () => {
  it('picks the stage picture from the gauge', () => {
    const at = (gauge: number) => portraitFor(ysolde, { gauge, condition: 'ready' }).key;
    expect([0, 24, 25, 50, 74, 75, 99].map(at)).toEqual(['normal', 'normal', 'early', 'mid', 'mid', 'late', 'late']);
  });

  it('uses the statue picture once solidified, and for permanent loss unless a variant exists', () => {
    expect(portraitFor(ysolde, { gauge: 100, condition: 'solidified' }).file).toBe('ysolde/statue.webp');
    expect(portraitFor(ysolde, { gauge: 100, condition: 'lost' }).file).toBe('ysolde/statue.webp');
    const withVariant = { ...ysolde, permanent: 'ysolde/permanent.webp' };
    expect(portraitFor(withVariant, { gauge: 100, condition: 'lost' }).file).toBe('ysolde/permanent.webp');
  });

  it('reports manifest mistakes', () => {
    expect(validateManifest({ version: 1, basePath: 'art/characters', characters: [ysolde] })).toEqual([]);
    const broken: CharacterArt = { id: 'x', stages: [{ key: 'early', fromGauge: 30, file: 'x/early.webp' }], statue: '' };
    expect(validateManifest({ version: 1, basePath: 'art/characters', characters: [broken, broken] })).toHaveLength(5);
  });
});
