// Reports which requested pictures have been delivered and whether they follow the rules.
//   node scripts/art-check.mjs            progress report; exits 0 unless a delivered picture breaks a rule
//   node scripts/art-check.mjs --next 20  also lists the next 20 pictures to make, most urgent first
import { readFileSync } from 'node:fs';
import { ART_ROOT, characterSets, delivered, imageSize, listFiles } from './art-lib.mjs';

const list = JSON.parse(readFileSync('graphics/asset_list.json', 'utf8'));
const nextCount = process.argv.includes('--next') ? Number(process.argv[process.argv.indexOf('--next') + 1] ?? 10) : 10;
const problems = [];
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
  if (!size) problems.push(`${file}: not a readable PNG or WebP picture.`);
  else if (size[0] !== asset.size[0] || size[1] !== asset.size[1]) problems.push(`${file}: is ${size[0]}×${size[1]}, should be ${asset.size[0]}×${asset.size[1]}.`);
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
  for (const a of missing.slice(0, nextCount)) console.log(`  [${a.priority}] ${a.id} -> ${a.deliver_to} (${a.size[0]}×${a.size[1]}${a.transparent ? ', transparent' : ''})`);
}
if (problems.length > 0) {
  console.log(`\nProblems (${problems.length}):`);
  for (const p of problems) console.log(`  ${p}`);
  process.exit(1);
}
console.log('\nNo problems with the delivered pictures.');
