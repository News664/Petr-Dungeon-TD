// Shared helpers for the art scripts. No dependencies.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export const ART_ROOT = 'public/art';
export const STAGES = ['normal', 'early', 'mid', 'late', 'statue', 'permanent'];
export const STAGE_START = { normal: 0, early: 25, mid: 50, late: 75 };
const EXTENSIONS = ['.webp', '.png'];

/** Every file under a folder, as paths relative to it, with forward slashes. */
export function listFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else out.push(relative(root, full).split('\\').join('/'));
    }
  };
  if (existsSync(root)) walk(root);
  return out.sort();
}

/** The delivered file for a requested path, accepting .png in place of .webp. Null if neither exists. */
export function delivered(path) {
  const stem = path.replace(/\.(webp|png)$/, '');
  for (const ext of EXTENSIONS) if (existsSync(stem + ext)) return stem + ext;
  return null;
}

/** Pixel size of a PNG or WebP file, or null if it cannot be read. */
export function imageSize(path) {
  const b = readFileSync(path);
  if (b.length > 24 && b.toString('ascii', 1, 4) === 'PNG') return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b.length > 30 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const kind = b.toString('ascii', 12, 16);
    if (kind === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
    if (kind === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
    if (kind === 'VP8L') {
      const bits = b.readUInt32LE(21);
      return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
    }
  }
  return null;
}

/** Character folders and the stage pictures each one has. */
export function characterSets() {
  const dir = join(ART_ROOT, 'characters');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((id) => statSync(join(dir, id)).isDirectory())
    .map((id) => {
      const stages = {};
      for (const stage of STAGES) {
        const file = delivered(join(dir, id, `${stage}.webp`));
        if (file) stages[stage] = `${id}/${file.split(/[\\/]/).pop()}`;
      }
      return { id, stages };
    });
}
