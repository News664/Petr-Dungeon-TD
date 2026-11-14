/**
 * Character art is data, not code. Each character lists one picture per key
 * solidification stage; the game picks the picture from her current gauge and
 * condition. Adding a character or a stage means adding files and an entry
 * here, nothing else. See docs/ART_PIPELINE.md.
 */

export interface PortraitStage {
  /** Short name used in file names and for transitions, e.g. "normal", "early". */
  key: string;
  /** This picture is shown from this gauge value (0–100) until the next stage begins. */
  fromGauge: number;
  file: string;
}

export interface CharacterArt {
  id: string;
  /** Living stages. One of them must start at gauge 0. */
  stages: PortraitStage[];
  /** Fully solidified. */
  statue: string;
  /** Optional separate picture for a permanently lost character; falls back to `statue`. */
  permanent?: string;
}

export interface ArtManifest {
  version: 1;
  /** Folder that all `file` paths are relative to. */
  basePath: string;
  characters: CharacterArt[];
}

export interface PortraitQuery {
  gauge: number;
  condition: 'ready' | 'solidified' | 'lost';
}

export function portraitFor(art: CharacterArt, query: PortraitQuery): { key: string; file: string } {
  if (query.condition === 'lost') return { key: 'permanent', file: art.permanent ?? art.statue };
  if (query.condition === 'solidified') return { key: 'statue', file: art.statue };
  const ordered = [...art.stages].sort((a, b) => a.fromGauge - b.fromGauge);
  let current = ordered[0];
  for (const stage of ordered) if (query.gauge >= stage.fromGauge) current = stage;
  if (!current) throw new Error(`Character "${art.id}" has no portrait stages.`);
  return { key: current.key, file: current.file };
}

/** Problems that would show up as a missing or wrong picture in game. Empty means valid. */
export function validateManifest(manifest: ArtManifest): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const c of manifest.characters) {
    if (seen.has(c.id)) problems.push(`Duplicate character id "${c.id}".`);
    seen.add(c.id);
    if (!c.statue) problems.push(`"${c.id}" has no statue picture.`);
    if (!c.stages.some((s) => s.fromGauge === 0)) problems.push(`"${c.id}" has no stage starting at gauge 0.`);
    const keys = new Set<string>();
    const starts = new Set<number>();
    for (const s of c.stages) {
      if (s.fromGauge < 0 || s.fromGauge >= 100) problems.push(`"${c.id}" stage "${s.key}" must start between 0 and 99.`);
      if (keys.has(s.key)) problems.push(`"${c.id}" repeats stage key "${s.key}".`);
      if (starts.has(s.fromGauge)) problems.push(`"${c.id}" has two stages starting at gauge ${s.fromGauge}.`);
      keys.add(s.key);
      starts.add(s.fromGauge);
    }
  }
  return problems;
}
