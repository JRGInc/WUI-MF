// Bridge the consented-photo export into the labeling pool — the missing link
// in the training-data flywheel. `npm run export:training` downloads
// consent-gated field photos from Supabase into training-data/{images,manifest.jsonl};
// this script folds them into training-data/harvest/manifest.jsonl (as
// triage='keep'), where `npm run label:prepare` picks them up for the
// SAM-assisted labeling bundle. Run the whole loop with `npm run flywheel`.
//
//   node scripts/import-consented-photos.mjs [--src training-data] \
//        [--pool training-data/harvest]
//
// Re-runnable: rows already in the pool manifest are skipped, so this can run
// on a schedule after each export. In-app photos carry per-photo consent and
// user-assigned hazard tags; the first tag becomes the labeling bundle's
// targetClass hint (untagged photos get 'field-consented').

import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  appendFileSync,
  linkSync,
  copyFileSync,
} from 'node:fs';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv;
const arg = (flag, def) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : def);

const srcDir = resolve(ROOT, arg('--src', 'training-data'));
const poolDir = resolve(ROOT, arg('--pool', 'training-data/harvest'));

const NEGATIVE_TAG = 'no-hazards-visible';

const srcManifestPath = join(srcDir, 'manifest.jsonl');
if (!existsSync(srcManifestPath)) {
  console.error(
    `No export manifest at ${srcManifestPath} — run \`npm run export:training\` first.`
  );
  process.exit(1);
}

const rows = readFileSync(srcManifestPath, 'utf8')
  .split('\n')
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l));

if (rows.length === 0) {
  console.log('Export manifest is empty — nothing to import yet.');
  console.log('(Consented photos appear here after users opt in during assessments.)');
  process.exit(0);
}

mkdirSync(join(poolDir, 'images'), { recursive: true });
const poolManifestPath = join(poolDir, 'manifest.jsonl');
if (!existsSync(poolManifestPath)) writeFileSync(poolManifestPath, '');

const existing = new Set();
for (const line of readFileSync(poolManifestPath, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  try {
    existing.add(JSON.parse(line).id);
  } catch {
    /* tolerate partial line */
  }
}

let imported = 0;
let skipped = 0;
let missing = 0;
const perClass = new Map();

for (const row of rows) {
  const id = `consent-${row.id}`;
  if (existing.has(id)) {
    skipped++;
    continue;
  }
  const srcImage = join(srcDir, row.file);
  if (!existsSync(srcImage)) {
    missing++;
    continue; // download failed rows never enter the export manifest, but be safe
  }
  const base = `${id}${basename(row.file).slice(basename(row.file).lastIndexOf('.'))}`;
  const dst = join(poolDir, 'images', base);
  try {
    linkSync(srcImage, dst);
  } catch {
    copyFileSync(srcImage, dst);
  }

  const tags = (row.hazardTags ?? []).filter((t) => t !== NEGATIVE_TAG);
  const targetClass = row.negative
    ? 'field-consented-negative'
    : (tags[0] ?? 'field-consented');
  perClass.set(targetClass, (perClass.get(targetClass) ?? 0) + 1);

  appendFileSync(
    poolManifestPath,
    JSON.stringify({
      id,
      file: `images/${base}`,
      source: 'field:consented',
      assessmentId: row.assessmentId,
      category: row.category,
      targetClass,
      hazardTags: row.hazardTags ?? [],
      triage: 'keep',
      triageReason: 'consented in-app field photo',
      capturedAt: row.capturedAt ?? null,
      importedAt: new Date().toISOString(),
    }) + '\n'
  );
  existing.add(id);
  imported++;
}

console.log(`Imported ${imported} consented photo(s) into the labeling pool`);
console.log(`  ${skipped} already present, ${missing} missing image file(s)`);
if (perClass.size) {
  console.log('  by target class:');
  for (const [cls, n] of [...perClass.entries()].sort()) {
    console.log(`    ${cls.padEnd(28)} ${n}`);
  }
}
console.log(`\nNext: npm run label:prepare  (folds these into the labeling bundle)`);
console.log('Note: consent covers training use, not PII review. Before labeling,');
console.log('check new photos for faces, license plates, and visible house numbers.');
