// Reports which requested pictures have been delivered and whether they follow the rules.
//   node scripts/art-check.mjs            progress report; exits 0 unless a delivered picture breaks a rule
//                                         (wrong place or name, not a picture, or a character set that cannot be shown).
//                                         Size is never an error: the game scales what it is given.
//   node scripts/art-check.mjs --next 20  also lists the next 20 pictures to make, most urgent first
import { readFileSync, statSync } from 'node:fs';
import { ART_ROOT, characterSets, delivered, imageSize, listFiles } from './art-lib.mjs';

const list = JSON.parse(readFileSync('graphics/asset_list.json', 'utf8'));
const nextCount = process.argv.includes('--next') ? Number(process.argv[process.argv.indexOf('--next') + 1] ?? 10) : 10;
const problems = [];
const notes = [];
const sets = {};
const missing = [];
const wanted = new Set();
const done = { 1: 0, 2: 0, 3: 0 };
const total = { 1: 0, 2: 0, 3: 0 };

for (const asset of list.assets) {
  total[asset.priority] += 1;
  const stem = asset.deliver_to.replace(/^public\/art\//, '').replace(/\.(webp|png)$/, '');
  wanted.add(stem);
  const file = delivered(asset.deliver_to);
  if (!file) {
    missing.push(asset);
    continue;
  }
  done[asset.priority] += 1;
  const size = imageSize(file);
  if (!size) {
    problems.push(`${file}: not a readable PNG or WebP picture.`);
    continue;
  }
  // Size is a target, not a rule: the game scales pictures. Only the shape matters.
  const shape = asset.size[0] / asset.size[1];
  const got = size[0] / size[1];
  if (Math.abs(got - shape) / shape > 0.12) notes.push(`${file}: is ${size[0]}×${size[1]}; the game expects roughly ${asset.size[0]}×${asset.size[1]} in shape and will crop or letterbox it.`);
  if (size[0] < asset.size[0] / 2) notes.push(`${file}: is only ${size[0]} px wide and may look soft.`);
  if (statSync(file).size > 4 * 1024 * 1024) notes.push(`${file}: is over 4 MB; the build scales it down, but the repository keeps the large file.`);
  if (asset.manifest_id) (sets[asset.manifest_id] ??= []).push(`${size[0]}×${size[1]}`);
}

for (const [id, sizes] of Object.entries(sets)) {
  if (new Set(sizes).size > 1) notes.push(`characters/${id}: stages have different sizes (${[...new Set(sizes)].join(', ')}); they will not line up when the picture changes.`);
}

for (const { id, stages } of characterSets()) {
  const have = Object.keys(stages);
  if (have.length > 0 && (!stages.normal || !stages.statue)) problems.push(`characters/${id}: has ${have.join(', ')} but needs at least normal and statue to be shown.`);
}
for (const file of listFiles(ART_ROOT)) {
  if (file === 'manifest.json' || file === 'README.md') continue;
  if (!/\.(webp|png)$/.test(file)) problems.push(`${file}: only .webp and .png pictures belong under ${ART_ROOT}.`);
  else if (!wanted.has(file.replace(/\.(webp|png)$/, ''))) problems.push(`${file}: not in graphics/asset_list.json (wrong name or folder?).`);
}

console.log('Art progress');
for (const p of [1, 2, 3]) console.log(`  priority ${p}: ${done[p]} of ${total[p]} delivered`);
if (missing.length > 0) {
  console.log(`\nNext to make (${Math.min(nextCount, missing.length)} of ${missing.length} missing):`);
  for (const a of missing.slice(0, nextCount)) console.log(`  [${a.priority}] ${a.id} -> ${a.deliver_to} (about ${a.size[0]}×${a.size[1]}${a.transparent ? ', transparent' : ''})`);
}
if (notes.length > 0) {
  console.log(`\nWorth a look (${notes.length}), not errors:`);
  for (const n of notes) console.log(`  ${n}`);
}
if (problems.length > 0) {
  console.log(`\nProblems (${problems.length}):`);
  for (const p of problems) console.log(`  ${p}`);
  process.exit(1);
}
console.log('\nNo problems with the delivered pictures.');
