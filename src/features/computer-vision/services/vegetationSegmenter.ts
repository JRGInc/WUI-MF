import * as tf from '@tensorflow/tfjs';
import type { DetectedRisk, RiskLevel } from '@/shared/types';

// DeepLab v3 ADE20K (int16 quantized, ~13 MB). Direct GraphModel load — bypasses
// the abandoned @tensorflow-models/deeplab wrapper whose hardcoded URLs are dead.
const MODEL_URL =
  'https://www.kaggle.com/models/tensorflow/deeplab/tfjs/ade20k-1-quantized/2/model.json?tfjs-format=file';
const IDB_KEY = 'indexeddb://deeplab-ade20k-q2';

// ADE20K has 151 classes. Full label list:
// https://github.com/tensorflow/tfjs-models/blob/master/deeplab/src/config.ts
// IDs below are the indices we care about for wildfire defensible-space analysis.
export const ADE20K = {
  // Vegetation: tree, grass, plant, flower, palm
  VEGETATION: new Set([4, 9, 17, 66, 72]),
  // Structures: building, house
  STRUCTURE: new Set([1, 25]),
  // Ground / open: road, earth, sand, field, dirt-track
  GROUND: new Set([6, 13, 46, 29, 91]),
} as const;

// Cap input dimension; the model is fully convolutional but a 4K phone photo
// would emit a 4K class map. 513² is DeepLab's training resolution.
const MAX_INPUT_DIM = 513;

export interface SegmentationOutput {
  classMap: Uint8Array; // length = width * height, value = ADE20K class id
  width: number;
  height: number;
}

class VegetationSegmenter {
  private model: tf.GraphModel | null = null;
  private loadPromise: Promise<tf.GraphModel> | null = null;

  isLoaded(): boolean {
    return this.model !== null;
  }

  async load(onProgress?: (fraction: number) => void): Promise<tf.GraphModel> {
    if (this.model) return this.model;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      onProgress?.(0.05);
      try {
        const cached = await tf.loadGraphModel(IDB_KEY);
        onProgress?.(1);
        return cached;
      } catch {
        // Cache miss — fetch from CDN and persist for next launch.
      }
      const model = await tf.loadGraphModel(MODEL_URL, {
        onProgress: (f) => onProgress?.(0.1 + f * 0.85),
      });
      try {
        await model.save(IDB_KEY);
      } catch (err) {
        console.warn('Failed to cache DeepLab model in IndexedDB:', err);
      }
      onProgress?.(1);
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

  async segment(
    image: ImageBitmap | HTMLImageElement | HTMLCanvasElement
  ): Promise<SegmentationOutput> {
    const model = await this.load();

    const srcW = 'naturalWidth' in image ? image.naturalWidth : image.width;
    const srcH = 'naturalHeight' in image ? image.naturalHeight : image.height;
    const scale = Math.min(1, MAX_INPUT_DIM / Math.max(srcW, srcH));
    const w = Math.round(srcW * scale);
    const h = Math.round(srcH * scale);

    const argmax = tf.tidy(() => {
      const pixels = tf.browser.fromPixels(image);
      const resized =
        scale < 1
          ? tf.image.resizeBilinear(pixels, [h, w])
          : pixels;
      // The model's ImageTensor input expects int32 (raw 0-255 pixel values).
      // resizeBilinear outputs float32, so cast after resizing.
      const batched = resized.cast('int32').expandDims(0);
      const output = model.predict(batched) as tf.Tensor;
      // The ade20k-quantized variant emits SemanticPredictions [1,H,W] —
      // already argmaxed class IDs. Argmax only if a variant emits logits.
      const classes =
        output.rank === 4 ? (output as tf.Tensor4D).argMax(3) : output;
      return classes.squeeze() as tf.Tensor2D;
    });

    const data = (await argmax.data()) as Int32Array;
    argmax.dispose();

    const classMap = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) classMap[i] = data[i];

    return { classMap, width: w, height: h };
  }

  dispose() {
    this.model?.dispose();
    this.model = null;
    this.loadPromise = null;
  }
}

export const vegetationSegmenter = new VegetationSegmenter();

// ---------- Analysis helpers (pure, exported for the hook to compose) ----------

export function coverageOf(classMap: Uint8Array, classIds: ReadonlySet<number>): number {
  let count = 0;
  for (let i = 0; i < classMap.length; i++) {
    if (classIds.has(classMap[i])) count++;
  }
  return (count / classMap.length) * 100;
}

// True if vegetation pixels lie in the lower 2/3 of the frame *and* are adjacent
// to ground pixels — proxy for ground fuel vs distant canopy.
export function hasGroundFuel(
  classMap: Uint8Array,
  width: number,
  height: number
): boolean {
  const topCutoff = Math.floor(height / 3);
  for (let y = topCutoff; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!ADE20K.VEGETATION.has(classMap[i])) continue;
      // Check 4-neighborhood for ground
      const neighbors = [
        y > 0 ? classMap[i - width] : -1,
        y < height - 1 ? classMap[i + width] : -1,
        x > 0 ? classMap[i - 1] : -1,
        x < width - 1 ? classMap[i + 1] : -1,
      ];
      if (neighbors.some((c) => ADE20K.GROUND.has(c))) return true;
    }
  }
  return false;
}

// Minimum Chebyshev pixel distance between any structure pixel and any vegetation
// pixel, normalized to [0,1] over the larger image dimension. Returns 1 if either
// class is absent. Coarse: samples every 4th pixel for both masks.
export function vegToStructureProximity(
  classMap: Uint8Array,
  width: number,
  height: number
): number {
  const veg: number[] = [];
  const struct: number[] = [];
  for (let i = 0; i < classMap.length; i += 4) {
    if (ADE20K.VEGETATION.has(classMap[i])) veg.push(i);
    else if (ADE20K.STRUCTURE.has(classMap[i])) struct.push(i);
  }
  if (veg.length === 0 || struct.length === 0) return 1;

  let minDist = Infinity;
  for (const v of veg) {
    const vx = v % width;
    const vy = (v / width) | 0;
    for (const s of struct) {
      const sx = s % width;
      const sy = (s / width) | 0;
      const d = Math.max(Math.abs(vx - sx), Math.abs(vy - sy));
      if (d < minDist) minDist = d;
      if (minDist === 0) return 0;
    }
  }
  return minDist / Math.max(width, height);
}

// Connected-component bounding boxes for a given class set. Iterative flood fill,
// 4-connectivity. Returns boxes in normalized [0,1] coords. Skips components
// smaller than minPixels (default 0.5% of frame).
export function classBoundingBoxes(
  classMap: Uint8Array,
  width: number,
  height: number,
  classIds: ReadonlySet<number>,
  minPixels?: number
): { x: number; y: number; width: number; height: number; size: number }[] {
  const threshold = minPixels ?? Math.floor(classMap.length * 0.005);
  const seen = new Uint8Array(classMap.length);
  const boxes: { x: number; y: number; width: number; height: number; size: number }[] = [];
  const stack: number[] = [];

  for (let start = 0; start < classMap.length; start++) {
    if (seen[start] || !classIds.has(classMap[start])) continue;
    let minX = width, maxX = 0, minY = height, maxY = 0, count = 0;
    stack.push(start);
    while (stack.length) {
      const i = stack.pop()!;
      if (seen[i] || !classIds.has(classMap[i])) continue;
      seen[i] = 1;
      const x = i % width;
      const y = (i / width) | 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      count++;
      if (x > 0) stack.push(i - 1);
      if (x < width - 1) stack.push(i + 1);
      if (y > 0) stack.push(i - width);
      if (y < height - 1) stack.push(i + width);
    }
    if (count >= threshold) {
      boxes.push({
        x: minX / width,
        y: minY / height,
        width: (maxX - minX + 1) / width,
        height: (maxY - minY + 1) / height,
        size: count,
      });
    }
  }
  return boxes;
}

// Shared analysis: given an ADE20K class map, return DetectedRisk items + a
// scalar vegetation coverage. Used by both single-image (useImageAnalysis) and
// live-frame (useLiveFrameAnalysis) paths so they stay in lockstep.
export function risksFromClassMap(
  classMap: Uint8Array,
  width: number,
  height: number
): { risks: DetectedRisk[]; coverage: number } {
  const coverage = coverageOf(classMap, ADE20K.VEGETATION);
  const structureCoverage = coverageOf(classMap, ADE20K.STRUCTURE);
  const groundFuelPresent = hasGroundFuel(classMap, width, height);
  const proximity =
    structureCoverage > 0 ? vegToStructureProximity(classMap, width, height) : 1;

  const risks: DetectedRisk[] = [];
  const vegBoxes = classBoundingBoxes(classMap, width, height, ADE20K.VEGETATION);

  for (const box of vegBoxes) {
    const inLowerTwoThirds = box.y + box.height > 0.33;
    const severity: RiskLevel =
      box.size / classMap.length > 0.25 && inLowerTwoThirds
        ? 'high'
        : inLowerTwoThirds
        ? 'moderate'
        : 'low';
    risks.push({
      type: inLowerTwoThirds ? 'Ground / Mid-level Vegetation' : 'Overhead Canopy',
      confidence: 0.85,
      severity,
      description: inLowerTwoThirds
        ? 'Vegetation in the lower frame is a likely fuel-load source.'
        : 'Vegetation appears to be overhead canopy; lower priority than ground fuel.',
      boundingBox: {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      },
    });
  }

  if (structureCoverage > 1 && proximity < 0.05) {
    risks.push({
      type: 'Vegetation Adjacent to Structure',
      confidence: 0.8,
      severity: 'high',
      description:
        'Vegetation is touching or nearly touching a building edge. Verify Zone 0 clearance.',
    });
  }

  if (groundFuelPresent && coverage > 20) {
    risks.push({
      type: 'Ground Fuel Load',
      confidence: 0.75,
      severity: coverage > 50 ? 'high' : 'moderate',
      description:
        'Continuous vegetation on the ground plane was detected. Consider removing low fuels.',
    });
  }

  return { risks, coverage };
}
