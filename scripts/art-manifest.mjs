// Writes public/art/manifest.json from the pictures that are actually there.
// Run automatically before `npm run dev` and `npm run build`; nobody edits the manifest by hand.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ART_ROOT, STAGE_START, characterSets, listFiles } from './art-lib.mjs';

const characters = [];
for (const { id, stages } of characterSets()) {
  if (!stages.normal || !stages.statue) {
    console.warn(`art: skipping "${id}": a character needs at least normal and statue pictures.`);
    continue;
  }
  characters.push({
    id,
    stages: Object.keys(STAGE_START)
      .filter((key) => stages[key])
      .map((key) => ({ key, fromGauge: STAGE_START[key], file: stages[key] })),
    statue: stages.statue,
    ...(stages.permanent ? { permanent: stages.permanent } : {}),
  });
}
const files = listFiles(ART_ROOT).filter((f) => f !== 'manifest.json' && /\.(webp|png)$/.test(f));
mkdirSync(ART_ROOT, { recursive: true });
writeFileSync(join(ART_ROOT, 'manifest.json'), JSON.stringify({ version: 1, basePath: 'art/characters', characters, files }, null, 1) + '\n');
console.log(`art: manifest written (${characters.length} character sets, ${files.length} pictures).`);
