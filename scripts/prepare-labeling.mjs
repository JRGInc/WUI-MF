// Prepare a SAM-assisted labeling bundle from the triaged-KEEP image pool.
//
//   node scripts/prepare-labeling.mjs [--src training-data/harvest] [--out training-data/labeling]
//
// Produces an annotation-tool-agnostic bundle for instance segmentation of the
// 11 wildfire-hazard classes:
//
//   <out>/images/                 kept images (hardlinked from the pool, copy fallback)
//   <out>/classes.txt             YOLO class list (taxonomy minus the negative tag)
//   <out>/dataset.yaml            Ultralytics YOLO-seg config (train/val filled after split)
//   <out>/label-studio-config.xml PolygonLabels config (one label per class, SAM-ready)
//   <out>/label-studio-tasks.json one task per image, carrying the weak hazard
//                                 tags from harvest/field-capture as annotator hints
//   <out>/guidance.md             per-class "what to look for", grounded in standards
//   <out>/README.md               two workflows (Label Studio+SAM, Roboflow) + train step
//
// Re-runnable: regenerate after more images are triaged-kept. Class order is
// taken from HAZARD_TAGS in src/shared/types/index.ts (single source of truth).

import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  linkSync,
  copyFileSync,
  rmSync,
  readdirSync,
} from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const NEGATIVE_TAG = 'no-hazards-visible';
const argv = process.argv;
const arg = (flag, def) =>
  argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : def;

const srcDir = resolve(ROOT, arg('--src', 'training-data/harvest'));
const outDir = resolve(ROOT, arg('--out', 'training-data/labeling'));

// Distinct colors so adjacent classes are visually separable while labeling.
const COLORS = [
  '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
  '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe',
  '#008080', '#9a6324',
];

const GUIDANCE = {
  'dry-dead-vegetation':
    'Brown/cured grasses, dead shrubs, dried-out plants. Mask the vegetation mass, not bare soil.',
  'ground-fuels':
    'Leaf litter, pine needles, bark, slash/brush piles on the ground. Outline accumulations.',
  'overhanging-vegetation':
    'Tree limbs/branches above or touching a roof, eave, or chimney. Mask the overhanging foliage.',
  'vegetation-near-structure':
    'Shrubs/plants directly against or within a few feet of a wall. Mask the plant, note proximity.',
  'woodpile-lumber':
    'Stacked firewood, cut logs, stored lumber/timber. Mask the pile.',
  'propane-tank':
    'Cylindrical LPG/propane tanks or bottles, residential. Mask the tank.',
  'wood-shake-roof':
    'Wood shake / cedar shingle roofing (not asphalt/tile/metal). Mask the roof plane.',
  'roof-debris':
    'Leaves, needles, branches accumulated on a roof surface. Outline the debris.',
  'gutter-debris':
    'Leaves/needles/moss filling a rain gutter. Outline the debris in the channel.',
  'combustible-fence':
    'Wood or vinyl fencing, especially where it meets/attaches to the house. Mask the fence run nearest the structure.',
  'combustible-mulch':
    'Bark/wood-chip/rubber mulch beds, especially within ~5 ft of a wall. Outline the mulch bed.',
};

// --- taxonomy (single source of truth) --------------------------------------

function loadClasses() {
  const src = readFileSync(join(ROOT, 'src/shared/types/index.ts'), 'utf8');
  const block = src.match(/HAZARD_TAGS\s*=\s*\[([\s\S]*?)\]\s*as const/);
  if (!block) throw new Error('Could not find HAZARD_TAGS in src/shared/types/index.ts');
  const tags = [...block[1].matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
  return tags.filter((t) => t !== NEGATIVE_TAG);
}

// --- gather kept images ------------------------------------------------------

const manifestPath = join(srcDir, 'manifest.jsonl');
if (!existsSync(manifestPath)) {
  console.error(`No manifest at ${manifestPath} — run the harvester/export first.`);
  process.exit(1);
}

const classes = loadClasses();
const kept = [];
for (const line of readFileSync(manifestPath, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  let m;
  try {
    m = JSON.parse(line);
  } catch {
    continue; // tolerate a partial trailing line if a harvest is mid-append
  }
  // Only images that passed triage. Untriaged harvest images (no verdict yet)
  // and explicit drops are excluded — run the triage pass first.
  if (m.triage !== 'keep') continue;
  const file = join(srcDir, m.file);
  if (existsSync(file)) kept.push({ ...m, abs: file, base: m.file.split('/').pop() });
}

if (kept.length === 0) {
  console.error('No kept images found — nothing to label.');
  process.exit(1);
}

// --- build bundle ------------------------------------------------------------

// Fresh images dir each run so removed/re-triaged images don't linger.
if (existsSync(join(outDir, 'images'))) rmSync(join(outDir, 'images'), { recursive: true });
mkdirSync(join(outDir, 'images'), { recursive: true });

let linked = 0;
let copied = 0;
for (const k of kept) {
  const dst = join(outDir, 'images', k.base);
  try {
    linkSync(k.abs, dst);
    linked++;
  } catch {
    copyFileSync(k.abs, dst); // cross-device / drvfs fallback
    copied++;
  }
}

writeFileSync(join(outDir, 'classes.txt'), classes.join('\n') + '\n');

writeFileSync(
  join(outDir, 'dataset.yaml'),
  [
    '# Ultralytics YOLO-seg dataset. Fill train/val after splitting the',
    '# labeled set (e.g. 80/20). Labels go in a sibling labels/ dir, YOLO-seg',
    '# polygon format: <class> <x1> <y1> <x2> <y2> ... (normalized).',
    `path: ${outDir}`,
    'train: images',
    'val: images',
    'names:',
    ...classes.map((c, i) => `  ${i}: ${c}`),
    '',
  ].join('\n')
);

// Label Studio polygon-segmentation config (also imports cleanly to Roboflow).
const labelTags = classes
  .map((c, i) => `    <Label value="${c}" background="${COLORS[i % COLORS.length]}"/>`)
  .join('\n');
writeFileSync(
  join(outDir, 'label-studio-config.xml'),
  `<View>
  <Image name="image" value="$image" zoom="true" zoomControl="true" rotateControl="true"/>
  <Header value="Suggested classes for this image: $hint"/>
  <PolygonLabels name="label" toName="image" strokeWidth="2" pointSize="small">
${labelTags}
  </PolygonLabels>
</View>
`
);

// Label Studio tasks — local-file serving paths + weak-tag hints.
const tasks = kept.map((k) => {
  const hazards = (k.hazardTags ?? []).filter((t) => t !== NEGATIVE_TAG);
  const hint =
    hazards.length > 0
      ? hazards.join(', ')
      : k.targetClass && k.targetClass !== 'residential-context'
        ? k.targetClass
        : 'scan whole scene';
  return {
    data: {
      image: `/data/local-files/?d=labeling/images/${k.base}`,
      hint,
      source_id: k.id,
    },
  };
});
writeFileSync(join(outDir, 'label-studio-tasks.json'), JSON.stringify(tasks, null, 2) + '\n');

// CVAT label spec — paste into "Constructor → Raw" when creating the project,
// or pass via the SDK. Order MUST match HAZARD_TAGS: CVAT assigns label_id by
// definition order, and that id becomes the YOLO-seg class index.
const cvatLabels = classes.map((c, i) => ({
  name: c,
  color: COLORS[i % COLORS.length],
  type: 'polygon',
  attributes: [],
}));
writeFileSync(join(outDir, 'cvat-labels.json'), JSON.stringify(cvatLabels, null, 2) + '\n');

writeFileSync(
  join(outDir, 'guidance.md'),
  '# Annotation guidance — wildfire hazard instance segmentation\n\n' +
    'Draw a tight polygon around each instance of these classes. One polygon per\n' +
    'distinct object/area. The "Suggested classes" hint per image is a weak label\n' +
    '(what the image was collected for) — still scan the whole scene and label any\n' +
    'other hazard classes you see.\n\n' +
    classes.map((c, i) => `${i}. **${c}** — ${GUIDANCE[c] ?? ''}`).join('\n') +
    '\n'
);

const counts = {};
for (const k of kept) counts[k.targetClass] = (counts[k.targetClass] ?? 0) + 1;

writeFileSync(
  join(outDir, 'README.md'),
  labelingReadme(classes, kept.length, outDir)
);

// --- report ------------------------------------------------------------------

console.log(`Labeling bundle ready: ${outDir}`);
console.log(`  ${kept.length} images (${linked} hardlinked, ${copied} copied)`);
console.log(`  ${classes.length} classes -> classes.txt, dataset.yaml`);
console.log(`  label-studio-config.xml, label-studio-tasks.json, cvat-labels.json, guidance.md, README.md`);
console.log('\nimages by collection class:');
for (const [c, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${c.padEnd(26)} ${n}`);
}
console.log(`\nNext: see ${join(outDir, 'README.md')}`);

function labelingReadme(classes, n, dir) {
  return `# Labeling pipeline — wildfire hazard segmentation

${n} triaged images, ${classes.length} classes. Regenerate this bundle anytime with:

    npm run label:prepare

Goal: produce YOLO-seg polygon labels, then train a YOLO11n-seg model
(scripts/export-yolo-tfjs.sh deploys the result to the browser).

## Option A — Label Studio + Segment Anything (local, free, SAM-assisted)

1. Install and start (run these yourself; prefix with \`!\` in Claude Code):

       pip install label-studio
       export LABEL_STUDIO_LOCAL_FILES_SERVING_ENABLED=true
       export LABEL_STUDIO_LOCAL_FILES_DOCUMENT_ROOT=${resolve(dir, '..')}
       label-studio start

2. Create a project → Labeling Setup → Custom template → paste
   \`label-studio-config.xml\`.
3. Import \`label-studio-tasks.json\` (Data Import). Each task's "hint" shows the
   suggested classes; \`guidance.md\` has per-class instructions.
4. SAM assist (optional but ~5-10x faster): run the official Segment Anything ML
   backend and connect it under Settings → Machine Learning:

       git clone https://github.com/HumanSignal/label-studio-ml-backend
       cd label-studio-ml-backend/label_studio_ml/examples/segment_anything_2_image
       docker compose up   # or follow its README for a pip setup

   Then click an object → SAM proposes the mask → assign the class.
5. Export as **YOLOv8 OBB / Instance Segmentation** (YOLO-seg). Drop the exported
   \`labels/\` next to \`images/\` and split 80/20 into train/val.

## Option B — CVAT (open source, SAM + YOLO-assist built in)

CVAT (MIT) has Segment Anything and Ultralytics YOLO auto-annotation built in,
and exports the exact Ultralytics YOLO-seg format this pipeline trains on.

1. Run CVAT (self-host) — run these yourself (\`!\` prefix in Claude Code):

       git clone https://github.com/cvat-ai/cvat && cd cvat
       docker compose up -d        # opens http://localhost:8080

   For SAM-assisted labeling, also deploy the Segment Anything serverless
   function per CVAT's "Automatic annotation / AI Tools" docs (nuclio), or use
   cvat.ai where SAM is already enabled.
2. Create a **Project** → in the label editor switch to **Raw** and paste
   \`cvat-labels.json\` (the 11 classes, polygon type). **Do not reorder** — CVAT
   assigns label_id by this order and it becomes the YOLO-seg class index.
3. Create a **Task** under the project and upload \`images/\` (zip or folder).
   Use \`guidance.md\` for per-class definitions (CVAT has no per-image hint field).
4. Annotate: pick the **AI Tools → Segment Anything** interactive tool, click an
   object, assign the class. Optionally run YOLO detection first, then refine.
5. **Export** the task/project → format **"Ultralytics YOLO Segmentation 1.0"**.
   The zip already contains \`data.yaml\` + \`labels/\` in YOLO-seg polygon format —
   no conversion needed. Merge with this bundle's split or use CVAT's subsets.

## Option C — Roboflow (hosted, SAM "Smart Polygon" built in)

1. Create a project (Instance Segmentation). Upload \`images/\`.
2. Add the ${classes.length} classes from \`classes.txt\` (exact names/order).
3. Annotate with Smart Polygon (SAM). Use \`guidance.md\` for class definitions.
4. Generate a version → Export format **YOLOv8** → download. It includes a
   \`data.yaml\` equivalent to \`dataset.yaml\`.

## After labeling — train & deploy

    # in the yolo export venv (see scripts/export-yolo-tfjs.sh)
    yolo segment train model=yolo11n-seg.pt data=${join(dir, 'dataset.yaml')} imgsz=512 epochs=100
    # then convert best.pt -> TF.js for the browser:
    YOLO_WEIGHTS=runs/segment/train/weights/best.pt scripts/export-yolo-tfjs.sh

## Notes

- The pool is light on propane-tank, gutter-debris, combustible-mulch, and
  combustible-fence — prioritize collecting/labeling more of those (app field
  photos are the best source).
- Class order here MUST match the model's: it is taken from HAZARD_TAGS in
  src/shared/types/index.ts. Don't reorder.
`;
}
