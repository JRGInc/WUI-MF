// Export training-consented assessment photos from Supabase into a
// YOLO-ready dataset layout for SAM-assisted labeling (Roboflow / CVAT /
// Label Studio).
//
//   node scripts/export-training-data.mjs [--out training-data]
//
// Auth: uses SUPABASE_SERVICE_ROLE_KEY from the environment when set
// (recommended — bypasses RLS so all consented rows are visible); otherwise
// falls back to the anon key from .env.
//
// Output layout:
//   <out>/images/<photo_id>.jpg     downloaded photos (incremental — existing
//                                   files are skipped, safe to re-run)
//   <out>/labels/                   empty; filled by the annotation tool
//   <out>/manifest.jsonl            one JSON line per image: tags, category,
//                                   assessment id, capture time
//   <out>/classes.txt               YOLO class list (taxonomy minus the
//                                   'no-hazards-visible' negative marker)
//   <out>/dataset.yaml              Ultralytics dataset skeleton
//
// Image-level hazard tags are weak labels: they tell annotators what to look
// for, they are not boxes/masks. The summary at the end tracks collection
// progress toward per-class instance targets.

import { createClient } from '@supabase/supabase-js';
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NEGATIVE_TAG = 'no-hazards-visible';
const BUCKET = 'assessment-photos';
const PAGE_SIZE = 500;

// --- config ---------------------------------------------------------------

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const env = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return env;
}

const dotenv = parseEnvFile(join(ROOT, '.env'));
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? dotenv.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? dotenv.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !(SERVICE_KEY || ANON_KEY)) {
  console.error('Missing VITE_SUPABASE_URL / key — configure .env or env vars.');
  process.exit(1);
}
if (/your-project/.test(SUPABASE_URL)) {
  console.error(
    '.env still has the placeholder Supabase URL (your-project.supabase.co) — ' +
      'point VITE_SUPABASE_URL at a real project before exporting.'
  );
  process.exit(1);
}
if (!SERVICE_KEY) {
  console.warn(
    'WARNING: using the anon key — RLS may hide rows/files. ' +
      'Set SUPABASE_SERVICE_ROLE_KEY for a complete export.'
  );
}

const outDir = resolve(
  ROOT,
  process.argv.includes('--out')
    ? process.argv[process.argv.indexOf('--out') + 1]
    : 'training-data'
);

// Single source of truth for the taxonomy: parse HAZARD_TAGS from the
// TypeScript domain types rather than duplicating the list here.
function loadHazardTags() {
  const src = readFileSync(join(ROOT, 'src/shared/types/index.ts'), 'utf8');
  const block = src.match(/HAZARD_TAGS\s*=\s*\[([\s\S]*?)\]\s*as const/);
  if (!block) throw new Error('Could not find HAZARD_TAGS in src/shared/types/index.ts');
  const tags = [...block[1].matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
  if (tags.length === 0) throw new Error('HAZARD_TAGS parsed empty');
  return tags;
}

// --- export ----------------------------------------------------------------

const hazardTags = loadHazardTags();
const classes = hazardTags.filter((t) => t !== NEGATIVE_TAG);
const supabase = createClient(SUPABASE_URL, SERVICE_KEY ?? ANON_KEY);

mkdirSync(join(outDir, 'images'), { recursive: true });
mkdirSync(join(outDir, 'labels'), { recursive: true });

// Fetch all consented rows (paged).
const rows = [];
for (let from = 0; ; from += PAGE_SIZE) {
  const { data, error } = await supabase
    .from('assessment_photos')
    .select('id, assessment_id, storage_path, category, hazard_tags, captured_at')
    .eq('training_consent', true)
    .order('captured_at', { ascending: true })
    .range(from, from + PAGE_SIZE - 1);

  if (error) {
    if (/column .*training_consent/i.test(error.message)) {
      console.error(
        'The assessment_photos table is missing the training columns.\n' +
          'Run the migration first:\n\n' +
          "  alter table assessment_photos\n" +
          "    add column training_consent boolean not null default false,\n" +
          "    add column hazard_tags text[] not null default '{}';\n"
      );
    } else {
      console.error('Query failed:', error.message);
    }
    process.exit(1);
  }
  rows.push(...(data ?? []));
  if (!data || data.length < PAGE_SIZE) break;
}

console.log(`${rows.length} consented photo(s) in Supabase`);

const existing = new Set(readdirSync(join(outDir, 'images')));
let downloaded = 0;
let skipped = 0;
let failed = 0;
const manifest = [];

for (const row of rows) {
  const filename = `${row.id}.jpg`;

  if (existing.has(filename)) {
    skipped++;
  } else {
    const { data, error } = await supabase.storage.from(BUCKET).download(row.storage_path);
    if (error || !data) {
      console.warn(`  download failed for ${row.storage_path}: ${error?.message}`);
      failed++;
      continue; // keep failed photos out of the manifest — no local file
    }
    writeFileSync(join(outDir, 'images', filename), Buffer.from(await data.arrayBuffer()));
    downloaded++;
  }

  manifest.push({
    id: row.id,
    file: `images/${filename}`,
    assessmentId: row.assessment_id,
    category: row.category,
    hazardTags: row.hazard_tags ?? [],
    negative: (row.hazard_tags ?? []).includes(NEGATIVE_TAG),
    capturedAt: row.captured_at,
  });
}

writeFileSync(
  join(outDir, 'manifest.jsonl'),
  manifest.map((m) => JSON.stringify(m)).join('\n') + (manifest.length ? '\n' : '')
);
writeFileSync(join(outDir, 'classes.txt'), classes.join('\n') + '\n');
writeFileSync(
  join(outDir, 'dataset.yaml'),
  [
    '# Ultralytics dataset config — point train/val at labeled splits once',
    '# annotation (SAM-assisted, human-reviewed) is done.',
    `path: ${outDir}`,
    'train: images # TODO: split after labeling',
    'val: images   # TODO: split after labeling',
    'names:',
    ...classes.map((c, i) => `  ${i}: ${c}`),
    '',
  ].join('\n')
);

// Collection-progress summary (weak image-level counts, not instances).
const tagCounts = Object.fromEntries(hazardTags.map((t) => [t, 0]));
let untagged = 0;
for (const m of manifest) {
  if (m.hazardTags.length === 0) untagged++;
  for (const t of m.hazardTags) if (t in tagCounts) tagCounts[t]++;
}

console.log(`downloaded ${downloaded}, skipped ${skipped} existing, failed ${failed}`);
console.log(`\nImage counts per tag (weak labels — instance counts come after annotation):`);
for (const [tag, count] of Object.entries(tagCounts)) {
  console.log(`  ${tag.padEnd(28)} ${count}`);
}
console.log(`  ${'(untagged)'.padEnd(28)} ${untagged}`);
console.log(`\nDataset written to ${outDir}`);
