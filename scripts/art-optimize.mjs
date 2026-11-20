// Runs after `npm run build`. Scales delivered pictures in dist/art down to the size the
// game asks for, so a generator that returns something larger costs nothing at play time.
// Pictures are never enlarged, never cropped, and the originals under public/art are untouched.
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { listFiles } from './art-lib.mjs';

const OUT = 'dist/art';
const FALLBACK = [2048, 2048];

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.log('art: image library not available; pictures are shipped at their delivered size.');
  process.exit(0);
}
if (!existsSync(OUT)) process.exit(0);

const targets = new Map();
for (const asset of JSON.parse(readFileSync('graphics/asset_list.json', 'utf8')).assets) {
  targets.set(asset.deliver_to.replace(/^public\/art\//, '').replace(/\.(webp|png)$/, ''), asset.size);
}

let resized = 0;
let saved = 0;
for (const file of listFiles(OUT).filter((f) => /\.(webp|png)$/.test(f))) {
  const path = join(OUT, file);
  const [maxW, maxH] = targets.get(file.replace(/\.(webp|png)$/, '')) ?? FALLBACK;
  const image = sharp(path);
  const meta = await image.metadata();
  if (!meta.width || !meta.height || (meta.width <= maxW && meta.height <= maxH)) continue;
  const before = statSync(path).size;
  const pipeline = image.resize({ width: maxW, height: maxH, fit: 'inside', withoutEnlargement: true });
  const buffer = file.endsWith('.png') ? await pipeline.png({ compressionLevel: 9 }).toBuffer() : await pipeline.webp({ quality: 88 }).toBuffer();
  writeFileSync(path, buffer);
  resized += 1;
  saved += before - buffer.length;
}
console.log(`art: ${resized} picture(s) scaled down for the build${resized ? `, ${(saved / 1024 / 1024).toFixed(1)} MB saved` : ''}.`);
