/** Story moments: the rules record them; content/stories.json says them. */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyAll, buildFixture } from '../index';
import { playSlice } from './director';
import { cfg, deploy, must, readyIds } from './helpers';

const STORIES = JSON.parse(readFileSync(join(process.cwd(), 'content/stories.json'), 'utf8')) as Record<string, { title: string; speaker: string; when: string; paragraphs: string[] }>;

describe('story moments', () => {
  it('has words for every moment the rules can record', () => {
    // Every literal id passed to tell(...) anywhere in the rules, plus the per-stratum ones.
    const dir = join(process.cwd(), 'src/sim');
    const ids = new Set<string>();
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
      for (const m of readFileSync(join(dir, file), 'utf8').matchAll(/tell\(s, '([a-z0-9_]+)'\)/g)) ids.add(m[1]!);
    }
    for (const st of ['stratum_1_secured', 'stratum_2_secured', 'stratum_2_entered']) ids.add(st);
    expect(ids.size).toBeGreaterThanOrEqual(10);
    for (const id of ids) {
      const story = STORIES[id];
      expect(story, id).toBeDefined();
      expect(story!.title && story!.speaker && story!.when, id).toBeTruthy();
      expect(story!.paragraphs.length, id).toBeGreaterThan(0);
    }
  });

  it('gives every champion a few lines about who she is', () => {
    for (const c of cfg.roster.champions) expect((c.story ?? '').length, c.name).toBeGreaterThan(80);
  });

  it('marks the turning points of the crisis loop, each once', () => {
    let s = buildFixture('stable_secured');
    s = deploy(s, 'frontier', readyIds(s).slice(0, 6));
    s = applyAll(s, [{ type: 'debug_force_invasion' }, { type: 'resolve_battle', result: 'loss', solidified: readyIds(s).slice(0, 2), miracleChoices: [readyIds(s)[0]!] }]);
    expect(s.stories).toContain('flowering');
    s = must(s, { type: 'advance_time', hours: s.nextInvasionHour! - s.simHour });
    s = must(s, { type: 'resolve_battle', result: 'loss' });
    expect(s.stories).toContain('no_flowering');
    s = applyAll(s, [{ type: 'advance_time', hours: cfg.clock.sanctuary_siege_delay_hours }, { type: 'resolve_battle', result: 'win' }]);
    expect(s.stories).toContain('siege_held');
    const before = [...s.stories];
    s = applyAll(s, [{ type: 'start_frontier_rebuild' }, { type: 'advance_time', hours: s.nextInvasionHour! - s.simHour }, { type: 'resolve_battle', result: 'win' }]);
    for (let i = 0; i < 2; i++) s = applyAll(s, [{ type: 'advance_time', hours: s.nextInvasionHour! - s.simHour }, { type: 'resolve_battle', result: 'win' }]);
    // This garrison had never held a tide before the crisis, so its first one is marked too.
    expect(s.stories.filter((id) => !before.includes(id))).toEqual(['first_tide_held', 'flowering_returns']);
    expect(new Set(s.stories).size).toBe(s.stories.length);
  });

  it('is told along a whole playthrough', { timeout: 60_000 }, () => {
    const { state } = playSlice(1);
    expect(state.stories).toEqual(expect.arrayContaining(['first_tide_held', 'stratum_1_secured']));
  });
});
