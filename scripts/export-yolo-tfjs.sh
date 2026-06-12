#!/usr/bin/env bash
# Export pretrained YOLO11n-seg (COCO) to a TF.js graph model for the
# browser prototype (src/features/computer-vision/services/yoloSegmenter.ts).
#
# imgsz must stay in sync with INPUT_SIZE in yoloSegmenter.ts.
#
# The TF.js export chain (PyTorch -> ONNX -> TF SavedModel -> TF.js) pulls in
# heavy deps (tensorflow, onnx2tf, tensorflowjs); ultralytics auto-installs
# them into the active environment on first run.
set -euo pipefail

VENV="${YOLO_VENV:-$HOME/yolo-export-venv}"
WORKDIR="${YOLO_WORKDIR:-$HOME/yolo-export}"
DEST="$(cd "$(dirname "$0")/.." && pwd)/public/models/yolo11n-seg_web_model"
IMGSZ=512
# Weights to export. Defaults to the pretrained COCO prototype; after training,
# point at your fine-tuned checkpoint: YOLO_WEIGHTS=runs/segment/train/weights/best.pt
WEIGHTS="${YOLO_WEIGHTS:-yolo11n-seg.pt}"

if [ ! -x "$VENV/bin/yolo" ]; then
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install --quiet ultralytics
fi

# Known-good pins for the converter chain (June 2026):
# - tensorflow 2.19 needs numpy<2.2; ultralytics' auto-update can leave a
#   corrupted numpy + too-new scipy behind.
# - tensorflowjs imports tensorflow_decision_forests, whose protos are built
#   with protobuf 6.31 gencode; the runtime must be >= that (newer runtime
#   with TF's older gencode is fine — ignore pip's pin warning).
"$VENV/bin/pip" install --quiet 'numpy==2.1.3' 'scipy==1.15.3' 'protobuf==6.31.1' || true

mkdir -p "$WORKDIR"
cd "$WORKDIR"

# ultralytics shells out to `tensorflowjs_converter` via /bin/sh — it must be
# on PATH or the tfjs step silently produces an empty export.
export PATH="$VENV/bin:$PATH"

"$VENV/bin/yolo" export model="$WEIGHTS" format=tfjs imgsz=$IMGSZ

# Ultralytics names the output dir after the weights stem (e.g. best_web_model).
WEB_MODEL_DIR="$(basename "${WEIGHTS%.pt}")_web_model"
if [ ! -f "$WEB_MODEL_DIR/model.json" ] && [ -f yolo11n-seg_web_model/model.json ]; then
  WEB_MODEL_DIR="yolo11n-seg_web_model"
fi

if [ ! -f "$WEB_MODEL_DIR/model.json" ]; then
  echo "ERROR: tfjs conversion produced no model.json" >&2
  exit 1
fi

mkdir -p "$DEST"
cp -r "$WEB_MODEL_DIR"/* "$DEST/"
echo "Exported to $DEST:"
ls -lh "$DEST"
