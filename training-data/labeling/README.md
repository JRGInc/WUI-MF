# Labeling pipeline — wildfire hazard segmentation

1729 triaged images, 11 classes. Regenerate this bundle anytime with:

    npm run label:prepare

Goal: produce YOLO-seg polygon labels, then train a YOLO11n-seg model
(scripts/export-yolo-tfjs.sh deploys the result to the browser).

## Option A — Label Studio + Segment Anything (local, free, SAM-assisted)

1. Install and start (run these yourself; prefix with `!` in Claude Code):

       pip install label-studio
       export LABEL_STUDIO_LOCAL_FILES_SERVING_ENABLED=true
       export LABEL_STUDIO_LOCAL_FILES_DOCUMENT_ROOT=/mnt/d/workspace/WebWUI/training-data
       label-studio start

2. Create a project → Labeling Setup → Custom template → paste
   `label-studio-config.xml`.
3. Import `label-studio-tasks.json` (Data Import). Each task's "hint" shows the
   suggested classes; `guidance.md` has per-class instructions.
4. SAM assist (optional but ~5-10x faster): run the official Segment Anything ML
   backend and connect it under Settings → Machine Learning:

       git clone https://github.com/HumanSignal/label-studio-ml-backend
       cd label-studio-ml-backend/label_studio_ml/examples/segment_anything_2_image
       docker compose up   # or follow its README for a pip setup

   Then click an object → SAM proposes the mask → assign the class.
5. Export as **YOLOv8 OBB / Instance Segmentation** (YOLO-seg). Drop the exported
   `labels/` next to `images/` and split 80/20 into train/val.

## Option B — CVAT (open source, SAM + YOLO-assist built in)

CVAT (MIT) has Segment Anything and Ultralytics YOLO auto-annotation built in,
and exports the exact Ultralytics YOLO-seg format this pipeline trains on.

1. Run CVAT (self-host) — run these yourself (`!` prefix in Claude Code):

       git clone https://github.com/cvat-ai/cvat && cd cvat
       docker compose up -d        # opens http://localhost:8080

   For SAM-assisted labeling, also deploy the Segment Anything serverless
   function per CVAT's "Automatic annotation / AI Tools" docs (nuclio), or use
   cvat.ai where SAM is already enabled.
2. Create a **Project** → in the label editor switch to **Raw** and paste
   `cvat-labels.json` (the 11 classes, polygon type). **Do not reorder** — CVAT
   assigns label_id by this order and it becomes the YOLO-seg class index.
3. Create a **Task** under the project and upload `images/` (zip or folder).
   Use `guidance.md` for per-class definitions (CVAT has no per-image hint field).
4. Annotate: pick the **AI Tools → Segment Anything** interactive tool, click an
   object, assign the class. Optionally run YOLO detection first, then refine.
5. **Export** the task/project → format **"Ultralytics YOLO Segmentation 1.0"**.
   The zip already contains `data.yaml` + `labels/` in YOLO-seg polygon format —
   no conversion needed. Merge with this bundle's split or use CVAT's subsets.

## Option C — Roboflow (hosted, SAM "Smart Polygon" built in)

1. Create a project (Instance Segmentation). Upload `images/`.
2. Add the 11 classes from `classes.txt` (exact names/order).
3. Annotate with Smart Polygon (SAM). Use `guidance.md` for class definitions.
4. Generate a version → Export format **YOLOv8** → download. It includes a
   `data.yaml` equivalent to `dataset.yaml`.

## After labeling — train & deploy

    # in the yolo export venv (see scripts/export-yolo-tfjs.sh)
    yolo segment train model=yolo11n-seg.pt data=/mnt/d/workspace/WebWUI/training-data/labeling/dataset.yaml imgsz=512 epochs=100
    # then convert best.pt -> TF.js for the browser:
    YOLO_WEIGHTS=runs/segment/train/weights/best.pt scripts/export-yolo-tfjs.sh

## Notes

- The pool is light on propane-tank, gutter-debris, combustible-mulch, and
  combustible-fence — prioritize collecting/labeling more of those (app field
  photos are the best source).
- Class order here MUST match the model's: it is taken from HAZARD_TAGS in
  src/shared/types/index.ts. Don't reorder.
