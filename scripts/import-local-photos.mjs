// Import a local directory of field photos into the training pool's manifest
// so they flow into the labeling bundle (npm run label:prepare).
//
//   node scripts/import-local-photos.mjs --src BoisePhotos [--prefix boise] \
//        [--target-class field-boise] [--pool training-data/harvest]
//
// Field photos are user-curated, so they are imported as triage='keep' (they
// skip the scraped-image triage). They keep their source folder as `property`
// metadata (e.g. the street address) and get hazardTags=[] to be assigned
// during labeling. Re-runnable: images already in the manifest are skipped.
//
// IDs are derived from a hash of the relative path (filenames like image.jpg
// repeat across property folders, so the basename alone is not unique).

import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  appendFileSync,
  linkSync,
  copyFileSync,
  statSync,
  readdirSync,
} from 'node:fs';
import { resolve, dirname, join, basename, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv;
const arg = (flag, def) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : def);

const srcDir = resolve(ROOT, arg('--src', 'BoisePhotos'));
const prefix = arg('--prefix', 'boise');
const targetClass = arg('--target-class', 'field-boise');
const poolDir = resolve(ROOT, arg('--pool', 'training-data/harvest'));

if (!existsSync(srcDir)) {
  console.error(`Source dir not found: ${srcDir}`);
  process.exit(1);
}

const IMG_RE = /\.(jpe?g|png)$/i;

// Recursively collect image files, skipping hidden/junk files.
function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.') || name.startsWith('._')) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (IMG_RE.test(name)) acc.push(full);
  }
  return acc;
}

const files = walk(srcDir);
if (files.length === 0) {
  console.error('No .jpg/.jpeg/.png files found.');
  process.exit(1);
}

mkdirSync(join(poolDir, 'images'), { recursive: true });
const manifestPath = join(poolDir, 'manifest.jsonl');
if (!existsSync(manifestPath)) writeFileSync(manifestPath, '');

// Existing manifest ids (skip re-import) + existing image filenames.
const existing = new Set();
for (const line of readFileSync(manifestPath, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  try {
    existing.add(JSON.parse(line).id);
  } catch {
    /* tolerate partial line */
  }
}

let imported = 0;
let skipped = 0;
let linked = 0;
let copied = 0;
const perProperty = new Set();

for (const abs of files) {
  const rel = relative(srcDir, abs);
  const hash = createHash('sha1').update(rel).digest('hex').slice(0, 10);
  const ext = extname(abs).toLowerCase() === '.png' ? 'png' : 'jpg';
  const id = `${prefix}-${hash}`;
  if (existing.has(id)) {
    skipped++;
    continue;
  }
  const base = `${id}.${ext}`;
  const dst = join(poolDir, 'images', base);
  try {
    linkSync(abs, dst);
    linked++;
  } catch {
    copyFileSync(abs, dst);
    copied++;
  }
  // `property` = immediate parent folder (street address), trimmed of any
  // container like "New Boise Photos".
  const property = basename(dirname(abs));
  perProperty.add(property);
  let capturedAt = null;
  try {
    capturedAt = statSync(abs).mtime.toISOString();
  } catch {
    /* ignore */
  }
  appendFileSync(
    manifestPath,
    JSON.stringify({
      id,
      file: `images/${base}`,
      source: `field:${prefix}`,
      property,
      originalPath: rel,
      targetClass,
      hazardTags: [],
      triage: 'keep',
      triageReason: 'user-provided field photo',
      capturedAt,
      importedAt: new Date().toISOString(),
    }) + '\n'
  );
  existing.add(id);
  imported++;
}

console.log(`Imported ${imported} photo(s) from ${srcDir}`);
console.log(`  ${linked} hardlinked, ${copied} copied, ${skipped} already present`);
console.log(`  across ${perProperty.size} property folder(s), source=field:${prefix}`);
console.log(`\nNext: npm run label:prepare  (folds these into the labeling bundle)`);
console.log('Note: field photos skip triage. Before commercial use, review for');
console.log('faces, license plates, and visible house numbers (PII).');
