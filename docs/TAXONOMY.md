# WUI-MF Unified Detection Taxonomy — proposal

**Status: PROPOSAL — needs a team decision before the labeling campaign's output
is merged for training.** (2026-09-01)

## Why this document exists

The WUI-MF program currently has **two class systems** that must pool their
data for the next model:

| System | Classes | Kind | Where it lives |
| --- | --- | --- | --- |
| **BFMA detector taxonomy** | 19 | **Objects** (structures, attachments, fuels) | Baked into `fast_yolo_v8_s.onnx` (now WebWUI's default detector, `wuiDetector.ts`); trained on synthetic Unity scenes + CVAT-labeled field imagery |
| **WebWUI hazard tags** | 11 (+1 negative) | **Conditions** (hazard states) | `HAZARD_TAGS` in `src/shared/types/index.ts`; drives in-app consent tagging and the staged labeling campaign (1,729 images in 13 CVAT tasks) |

They are not competing lists — they describe different things. BFMA detects
*what an object is* (`fence`, `roof`, `firewood`); WebWUI tags *what is wrong*
(`combustible-fence`, `roof-debris`, `dry-dead-vegetation`). A naive union
(~30 flat classes) would force annotators to choose between "fence" and
"combustible-fence" for the same pixels and fragment the training data.

## Proposal: objects detect, conditions annotate

**One object-class list for detection models; hazard conditions become
per-instance attributes (labeled) or spatial derivations (computed).**

### Object classes (detection head)

Indices 0–18 are **frozen to BFMA's shipped model** so fine-tunes continue its
lineage and existing BFMA labels stay valid; two objects the 19 can't express
are appended:

| Index | Class | Notes |
| --- | --- | --- |
| 0–18 | `solar_panel, garage, pergola, trellis, fence, tree, window, plant, door, vehicle, roof, skylight, firewood, furniture, siding, deck, gutter, vent, stairs` | Exact ONNX order of the shipped model — do not reorder |
| 19 | `propane_tank` | In WebWUI's tags, missing from BFMA's 19; a clear visual object (14 weakly-tagged images already in the pool) |
| 20 | `mulch_bed` | `combustible-mulch` is an object-like region, not an attribute of another class (19 images in the pool) |

### Condition mapping (the 11 WebWUI hazard tags)

| WebWUI hazard tag | Object class | Condition handling |
| --- | --- | --- |
| `woodpile-lumber` | `firewood` (12) | direct rename — same concept |
| `combustible-fence` | `fence` (4) | attribute `material=combustible` (BFMA's fence training data is predominantly wood, so the bare class already implies it; the attribute preserves the distinction) |
| `wood-shake-roof` | `roof` (10) | attribute `material=wood-shake` |
| `roof-debris` | `roof` (10) | attribute `debris=present` |
| `gutter-debris` | `gutter` (16) | attribute `debris=present` |
| `overhanging-vegetation` | `tree` (5) | attribute `overhanging=true` — also spatially derivable (tree box overlapping roof box) |
| `vegetation-near-structure` | `tree`/`plant` (5/7) | **derive spatially**: vegetation box within/adjacent to a structure box (siding/window/door/deck) — `wuiDetector` output already supports this at runtime |
| `dry-dead-vegetation` | `tree`/`plant` (5/7) | attribute `condition=dead-dry` |
| `ground-fuels` | `plant` (7) | attribute `stratum=ground-fuel` |
| `propane-tank` | `propane_tank` (19) | direct — new object class |
| `combustible-mulch` | `mulch_bed` (20) | direct — new object class |
| `no-hazards-visible` | — | negative image: zero boxes (keep as background-only training images; they suppress false positives) |

### What does NOT change

- **`HAZARD_TAGS` in the app stays exactly as-is** (indices 0–8 frozen per the
  existing rule). Users tag *conditions* — that's the right user-facing
  vocabulary — and the flywheel's `targetClass` hints keep working. The
  mapping above is applied at dataset-merge/training time, not in the UI.
- **The in-flight CVAT campaign keeps its 11-class label config.** Polygon
  masks are geometry — at merge time each mask's class maps to its object
  class via the table, and the condition is recorded as the instance's
  attribute. **No re-labeling.** (If the campaign hasn't started when this is
  decided, adding `propane_tank`/`mulch_bed` as CVAT labels and the attributes
  above to the label config is a small config edit — see `cvat-labels.json`;
  labels must be appended, never reordered.)

## Deployment contract for the next model

For a fine-tune to drop into WebWUI without new plumbing, match the shipped
model's interface (`src/features/computer-vision/services/wuiDetector.ts`):

- Ultralytics YOLOv8/v11 **detect** head (not seg — masks train better models
  but the browser decoder consumes boxes; seg output requires decoder work)
- `imgsz=640`, ONNX export with `half=True` (the browser path feeds fp16;
  fp32 also works — the decoder branches on the output type, but the *input*
  tensor type must match the export, so keep half=True or coordinate a change)
- Input tensor `images` `[1, 3, 640, 640]`, output `output0` `[1, 4+C, anchors]`
- On adoption: update `WUI_CLASSES` / `WUI_CLASS_INFO` (`wuiDetector.ts`) and
  `DETECTION_GUIDANCE` (`detectionGuidance.ts`) — both are compile-enforced to
  stay complete — then run `npm run eval:detector` and **raise the recorded
  baseline** (currently 35% image-level recall; see
  `src/features/computer-vision/eval/`). A new model that can't beat the
  baseline doesn't ship.

## Evidence the retraining set should address

From the golden-image evaluation of the shipped model
(`wuiDetector.eval.test.ts`, 2026-09-01):

- **`firewood` misses full-frame close-ups** (0/2) while hitting a woodpile in
  house context — the training set likely lacks close-range hazard shots,
  which is exactly what field inspectors take. The consented-photo flywheel
  (`npm run flywheel`) feeds real inspection framing; prioritize those.
- Night/flash imagery (gutter fixture) and non-residential structures (stone
  church) miss entirely — decide whether they're in scope before labeling.
- Pool balance is skewed: `field-boise` 1,276 vs `propane-tank` 14 and
  `gutter-debris` 18 — the two new object classes and gutters need targeted
  harvesting (`scripts/harvest-images.mjs`).

## Decision checklist

1. Adopt the 21-class object list with frozen 0–18? (owner: ML lead)
2. Attributes in CVAT (label config addendum) vs. derive-only? (labeling lead)
3. Negative-image policy: include all `no-hazards-visible` images as
   background? (ML lead)
4. Close-up/night/non-residential scope for the retraining set? (program)
5. Blocked by the **Ultralytics AGPL determination** (`docs/SBOM.md`) — the
   training stack choice affects both this model and BFMA's. (legal)
