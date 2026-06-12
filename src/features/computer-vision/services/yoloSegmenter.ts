import * as tf from '@tensorflow/tfjs';
import type { DetectedRisk, RiskLevel } from '@/shared/types';
import type { FrameAnalysis } from './frameAnalyzer';

// PROTOTYPE: YOLO11n-seg with pretrained COCO weights, exported to a TF.js
// graph model (see scripts/export-yolo-tfjs.sh). This de-risks the runtime
// path (letterbox → inference → NMS decode → DetectedRisk boxes) ahead of
// fine-tuning on real wildfire-hazard classes — COCO has no vegetation/fuel
// classes, so detections here are stand-ins, not real hazard findings.

const MODEL_URL = '/models/yolo11n-seg_web_model/model.json';
const IDB_KEY = 'indexeddb://yolo11n-seg-coco-512';

// Must match the imgsz used at export time.
const INPUT_SIZE = 512;
const SCORE_THRESHOLD = 0.3;
const IOU_THRESHOLD = 0.45;
const MAX_DETECTIONS = 20;
const NUM_CLASSES = 80;
const PAD_VALUE = 114 / 255; // Ultralytics letterbox gray

// prettier-ignore
const COCO_CLASSES = [
  'person','bicycle','car','motorcycle','airplane','bus','train','truck','boat','traffic light',
  'fire hydrant','stop sign','parking meter','bench','bird','cat','dog','horse','sheep','cow',
  'elephant','bear','zebra','giraffe','backpack','umbrella','handbag','tie','suitcase','frisbee',
  'skis','snowboard','sports ball','kite','baseball bat','baseball glove','skateboard','surfboard',
  'tennis racket','bottle','wine glass','cup','fork','knife','spoon','bowl','banana','apple',
  'sandwich','orange','broccoli','carrot','hot dog','pizza','donut','cake','chair','couch',
  'potted plant','bed','dining table','toilet','tv','laptop','mouse','remote','keyboard',
  'cell phone','microwave','oven','toaster','sink','refrigerator','book','clock','vase',
  'scissors','teddy bear','hair drier','toothbrush',
];

// Stand-in severities so the AR overlay has something meaningful to render.
const CLASS_SEVERITY: Record<string, RiskLevel> = {
  'potted plant': 'moderate', // closest thing COCO has to vegetation
  bench: 'moderate', // combustible material near structures
  chair: 'moderate',
  couch: 'high', // upholstered fuel
  car: 'low',
  truck: 'low',
};

class YoloSegmenter {
  private model: tf.GraphModel | null = null;
  private loadPromise: Promise<tf.GraphModel> | null = null;

  isLoaded(): boolean {
    return this.model !== null;
  }

  async load(): Promise<tf.GraphModel> {
    if (this.model) return this.model;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      try {
        return await tf.loadGraphModel(IDB_KEY);
      } catch {
        // Cache miss — fetch from our own origin and persist.
      }
      let model: tf.GraphModel;
      try {
        model = await tf.loadGraphModel(MODEL_URL);
      } catch (err) {
        throw new Error(
          `YOLO prototype model not found at ${MODEL_URL} — run scripts/export-yolo-tfjs.sh first (${err})`
        );
      }
      try {
        await model.save(IDB_KEY);
      } catch (err) {
        console.warn('Failed to cache YOLO model in IndexedDB:', err);
      }
      return model;
    })();

    try {
      this.model = await this.loadPromise;
      return this.model;
    } catch (err) {
      this.loadPromise = null;
      throw err;
    }
  }

  async analyze(
    image: ImageBitmap | HTMLImageElement | HTMLCanvasElement
  ): Promise<FrameAnalysis> {
    const model = await this.load();

    const srcW = 'naturalWidth' in image ? image.naturalWidth : image.width;
    const srcH = 'naturalHeight' in image ? image.naturalHeight : image.height;

    // Letterbox geometry (needed afterwards to map boxes back to the frame).
    const scale = Math.min(INPUT_SIZE / srcW, INPUT_SIZE / srcH);
    const newW = Math.round(srcW * scale);
    const newH = Math.round(srcH * scale);
    const padL = Math.floor((INPUT_SIZE - newW) / 2);
    const padT = Math.floor((INPUT_SIZE - newH) / 2);

    const t0 = performance.now();

    // Forward pass + detection-head reshape. The export emits two tensors:
    // detections [1, 4+80+32, anchors] (rank 3) and mask protos (rank 4).
    // Tensors that outlive the tidy scope are tf.keep'd and returned as an
    // array (a TensorContainer; protos may be absent).
    const kept = tf.tidy(() => {
      const img = tf.browser.fromPixels(image);
      const resized = tf.image.resizeBilinear(img, [newH, newW]).div(255);
      const padded = tf.pad(
        resized,
        [
          [padT, INPUT_SIZE - newH - padT],
          [padL, INPUT_SIZE - newW - padL],
          [0, 0],
        ],
        PAD_VALUE
      );
      const outputs = model.execute(padded.expandDims(0)) as tf.Tensor | tf.Tensor[];
      const outArr = Array.isArray(outputs) ? outputs : [outputs];
      const dets = outArr.find((t) => t.rank === 3);
      const protosOut = outArr.find((t) => t.rank === 4);
      if (!dets) throw new Error('YOLO output missing rank-3 detections tensor');

      const t = dets.squeeze([0]).transpose() as tf.Tensor2D; // [anchors, 116]
      const xywh = t.slice([0, 0], [-1, 4]);
      const classScores = t.slice([0, 4], [-1, NUM_CLASSES]);
      const maskCoeffs = t.slice([0, 4 + NUM_CLASSES], [-1, -1]);

      // xywh (center, input px) → [y1, x1, y2, x2] for NMS.
      const [cx, cy, w, h] = tf.split(xywh, 4, 1);
      const x1 = cx.sub(w.div(2));
      const y1 = cy.sub(h.div(2));
      const boxes = tf.concat([y1, x1, y1.add(h), x1.add(w)], 1) as tf.Tensor2D;

      const out: tf.Tensor[] = [
        tf.keep(boxes),
        tf.keep(classScores.max(1)),
        tf.keep(classScores.argMax(1)),
        tf.keep(maskCoeffs),
      ];
      if (protosOut) out.push(tf.keep(protosOut));
      return out;
    });
    const boxesXYXY = kept[0] as tf.Tensor2D;
    const scores = kept[1] as tf.Tensor1D;
    const classIds = kept[2] as tf.Tensor1D;
    const coeffs = kept[3] as tf.Tensor2D;
    const protos: tf.Tensor | null = kept[4] ?? null;

    try {
      const nms = await tf.image.nonMaxSuppressionAsync(
        boxesXYXY,
        scores,
        MAX_DETECTIONS,
        IOU_THRESHOLD,
        SCORE_THRESHOLD
      );

      const [selIdx, allBoxes, allScores, allClasses] = await Promise.all([
        nms.data() as Promise<Int32Array>,
        boxesXYXY.data() as Promise<Float32Array>,
        scores.data() as Promise<Float32Array>,
        classIds.data() as Promise<Int32Array>,
      ]);

      // Approximate scene coverage from the union of instance masks
      // (exercises the proto-matmul path that real hazard masks will need).
      let coverage = 0;
      if (protos && selIdx.length > 0) {
        const coverageT = tf.tidy(() => {
          const sel = tf.gather(coeffs, tf.tensor1d(selIdx, 'int32')); // [k, 32]
          const protoDim = protos.shape[3] as number;
          const flat = protos.squeeze([0]).reshape([-1, protoDim]); // [ph*pw, 32]
          const masks = flat.matMul(sel, false, true).sigmoid(); // [ph*pw, k]
          return masks.greater(0.5).max(1).mean(); // union fraction
        });
        coverage = Math.round((await coverageT.data())[0] * 100);
        coverageT.dispose();
      }
      nms.dispose();

      const inferenceMs = performance.now() - t0;

      const risks: DetectedRisk[] = [];
      for (const i of selIdx) {
        const className = COCO_CLASSES[allClasses[i]] ?? `class ${allClasses[i]}`;
        // Un-letterbox: input px → source-frame normalized [0, 1].
        const x = (allBoxes[i * 4 + 1] - padL) / scale / srcW;
        const y = (allBoxes[i * 4] - padT) / scale / srcH;
        const x2 = (allBoxes[i * 4 + 3] - padL) / scale / srcW;
        const y2 = (allBoxes[i * 4 + 2] - padT) / scale / srcH;
        const cx0 = Math.max(0, Math.min(1, x));
        const cy0 = Math.max(0, Math.min(1, y));
        risks.push({
          type: className,
          confidence: allScores[i],
          severity: CLASS_SEVERITY[className] ?? 'low',
          description: `YOLO11n-seg COCO prototype detection — stand-in class, not a real hazard finding.`,
          boundingBox: {
            x: cx0,
            y: cy0,
            width: Math.max(0, Math.min(1, x2) - cx0),
            height: Math.max(0, Math.min(1, y2) - cy0),
          },
        });
      }

      return { risks, coverage, inferenceMs };
    } finally {
      boxesXYXY.dispose();
      scores.dispose();
      classIds.dispose();
      coeffs.dispose();
      protos?.dispose();
    }
  }

  dispose() {
    this.model?.dispose();
    this.model = null;
    this.loadPromise = null;
  }
}

export const yoloSegmenter = new YoloSegmenter();
