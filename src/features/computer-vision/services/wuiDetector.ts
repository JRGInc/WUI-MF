import type { DetectedRisk, RiskLevel } from '@/shared/types';
import type { AnalyzableSource, FrameAnalysis } from './frameAnalyzer';

/**
 * WUI hazard detector — JANUS's own YOLOv8s trained for BFMA on a 19-class
 * home-ignition-zone taxonomy (structures, attachments, vegetation, stored
 * combustibles), run in the browser via onnxruntime-web. This is the first
 * purpose-built hazard model in WebWUI; the DeepLab path remains the fallback.
 *
 * The ONNX is copied verbatim from bfma_gold (fast_yolo_v8_s.onnx, Ultralytics
 * 8.2.76, imgsz 640, task detect, input "images", output "output0"
 * [1, 4+19, 8400]). The decode here deliberately fixes the defects in BFMA's
 * Unity parser: confidence and NMS-IoU thresholds are separate knobs (BFMA
 * passed its confidence value as the IoU cutoff), the class map covers all 19
 * classes (BFMA threw on `stairs`), and boxes are decoded without coordinate
 * offset hacks. Licensing note: the model metadata carries Ultralytics'
 * AGPL-3.0 tag — tracked in docs/SBOM.md pending a JANUS determination.
 *
 * Decode helpers are pure and exported for unit tests.
 */

export const WUI_MODEL_URL = '/models/bfma-yolov8s-wui/model.onnx';
// onnxruntime-web is loaded at runtime from its self-hosted wasm-only build in
// public/ort/ (runtime .mjs + wasm binary + loader .mjs), NOT via the npm
// package: bundling the package makes Vite emit its 28 MB WebGPU wasm as a
// dist asset. The npm dependency stays for TypeScript types and as the source
// of these files — after upgrading it, re-run `npm run sync:ort`.
const ORT_RUNTIME_URL = '/ort/ort.wasm.min.mjs';
const ORT_WASM_PATH = '/ort/';

export const INPUT_SIZE = 640; // must match the imgsz baked into the export
// BFMA's fast-tier confidence; IoU is the standard Ultralytics default. Kept
// as two distinct values on purpose — see the header note.
export const SCORE_THRESHOLD = 0.3;
export const IOU_THRESHOLD = 0.45;
export const MAX_DETECTIONS = 25;

// Exact ONNX `names` order — index is the class id.
// prettier-ignore
export const WUI_CLASSES = [
  'solar_panel', 'garage', 'pergola', 'trellis', 'fence', 'tree', 'window',
  'plant', 'door', 'vehicle', 'roof', 'skylight', 'firewood', 'furniture',
  'siding', 'deck', 'gutter', 'vent', 'stairs',
] as const;
export type WuiClass = (typeof WUI_CLASSES)[number];

export interface WuiClassInfo {
  label: string; // user-facing detection title
  severity: RiskLevel;
  description: string; // why it matters in the home-ignition zone
}

// Severities follow home-ignition-zone practice (IBHS / NFPA 1140): stored
// combustibles high; combustible attachments, vegetation, and ember entry
// points moderate; structure features informational (low). Complete over all
// 19 classes — a detection can never hit a missing key.
export const WUI_CLASS_INFO: Record<WuiClass, WuiClassInfo> = {
  solar_panel: {
    label: 'Solar panel',
    severity: 'low',
    description: 'Debris accumulating under panels can ignite from embers — keep the roof around them clear.',
  },
  garage: {
    label: 'Garage',
    severity: 'low',
    description: 'Garage detected — check door seals and stored fuels; garages commonly hold combustibles.',
  },
  pergola: {
    label: 'Pergola',
    severity: 'moderate',
    description: 'Combustible attached structure — can carry flame directly to the building.',
  },
  trellis: {
    label: 'Trellis',
    severity: 'moderate',
    description: 'Combustible trellis acts as a ladder fuel against the wall, especially with vegetation on it.',
  },
  fence: {
    label: 'Fence',
    severity: 'moderate',
    description: 'A combustible fence that connects to the structure can wick fire to it — check the last 5 ft.',
  },
  tree: {
    label: 'Tree',
    severity: 'moderate',
    description: 'Tree near the structure — check canopy clearance from the roof and 10 ft from chimneys.',
  },
  window: {
    label: 'Window',
    severity: 'low',
    description: 'Radiant-heat exposure point — single-pane glass fails early; keep fuels away from windows.',
  },
  plant: {
    label: 'Vegetation',
    severity: 'moderate',
    description: 'Vegetation near the structure — Zone 0 (0–5 ft) should be free of combustible plantings.',
  },
  door: {
    label: 'Door',
    severity: 'low',
    description: 'Entry point — check weather-stripping and gaps that could admit embers.',
  },
  vehicle: {
    label: 'Vehicle',
    severity: 'low',
    description: 'A parked vehicle is a fuel package — avoid parking against the structure during fire weather.',
  },
  roof: {
    label: 'Roof',
    severity: 'low',
    description: 'Roof detected — verify covering class and clear debris from the field and valleys.',
  },
  skylight: {
    label: 'Skylight',
    severity: 'low',
    description: 'Skylights can fail under radiant heat — check for debris accumulation around the curb.',
  },
  firewood: {
    label: 'Firewood / stored combustibles',
    severity: 'high',
    description: 'Stored combustibles near the structure are a primary ignition source — move at least 30 ft away.',
  },
  furniture: {
    label: 'Outdoor furniture',
    severity: 'moderate',
    description: 'Combustible furniture on or near the structure catches embers — relocate during fire weather.',
  },
  siding: {
    label: 'Siding',
    severity: 'low',
    description: 'Siding detected — verify material class and clearance from grade to the first course.',
  },
  deck: {
    label: 'Deck',
    severity: 'moderate',
    description: 'Combustible deck attached to the structure — clear fuels beneath and consider enclosure.',
  },
  gutter: {
    label: 'Gutter',
    severity: 'moderate',
    description: 'Gutters collect fine dead fuels that embers ignite — clean them and consider metal guards.',
  },
  vent: {
    label: 'Vent',
    severity: 'moderate',
    description: 'Ember entry point — screen with 1/8 in metal mesh or upgrade to ember-resistant vents.',
  },
  stairs: {
    label: 'Stairs',
    severity: 'low',
    description: 'Combustible steps attached to the structure — keep the area beneath clear of debris.',
  },
};

// Classes that count toward the vegetation-coverage estimate.
const VEGETATION_CLASS_IDS = new Set([WUI_CLASSES.indexOf('tree'), WUI_CLASSES.indexOf('plant')]);

// ---------- float16 (the export is half-precision) ----------
// BFMA exported the model with half=True: input and output tensors are
// float16, which JS represents as uint16 bit patterns (Float16Array is too
// new to rely on across mobile browsers).

const f32Scratch = new Float32Array(1);
const u32Scratch = new Uint32Array(f32Scratch.buffer);

export function floatToHalfBits(value: number): number {
  f32Scratch[0] = value;
  const x = u32Scratch[0];
  const sign = (x >>> 16) & 0x8000;
  const exp = (x >>> 23) & 0xff;
  let mant = x & 0x7fffff;
  if (exp === 0xff) return sign | 0x7c00 | (mant ? 1 : 0); // Inf / NaN
  const e = exp - 127 + 15;
  if (e >= 0x1f) return sign | 0x7c00; // overflow → Inf
  if (e <= 0) {
    if (e < -10) return sign; // underflow → signed zero
    mant = (mant | 0x800000) >> (1 - e);
    return sign | (mant >> 13);
  }
  return sign | (e << 10) | (mant >> 13);
}

export function halfBitsToFloat(bits: number): number {
  const sign = bits & 0x8000 ? -1 : 1;
  const exp = (bits >> 10) & 0x1f;
  const mant = bits & 0x3ff;
  if (exp === 0) return sign * mant * 2 ** -24;
  if (exp === 0x1f) return mant ? NaN : sign * Infinity;
  return sign * (1 + mant / 1024) * 2 ** (exp - 15);
}

export function halfToFloatArray(src: Uint16Array): Float32Array {
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i++) out[i] = halfBitsToFloat(src[i]);
  return out;
}

// Pixels only take 256 values scaled by /255 — precompute their half bits so
// the per-frame pack is a table lookup instead of 1.2 M bit-twiddles.
const HALF_LUT = new Uint16Array(256);
for (let i = 0; i < 256; i++) HALF_LUT[i] = floatToHalfBits(i / 255);

// ---------- pure decode helpers (unit-tested) ----------

export interface LetterboxGeometry {
  scale: number;
  newW: number;
  newH: number;
  padL: number;
  padT: number;
}

export function letterboxGeometry(srcW: number, srcH: number, inputSize = INPUT_SIZE): LetterboxGeometry {
  const scale = Math.min(inputSize / srcW, inputSize / srcH);
  const newW = Math.round(srcW * scale);
  const newH = Math.round(srcH * scale);
  return {
    scale,
    newW,
    newH,
    padL: Math.floor((inputSize - newW) / 2),
    padT: Math.floor((inputSize - newH) / 2),
  };
}

export interface RawDetection {
  classId: number;
  score: number;
  // Corners in input (letterboxed) pixels.
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Decode a YOLOv8 detect head laid out [1, 4 + numClasses, numAnchors]:
 * rows 0–3 are cx, cy, w, h (input pixels); rows 4+ are per-class scores.
 */
export function parseYoloOutput(
  data: Float32Array,
  numClasses: number,
  numAnchors: number,
  scoreThreshold = SCORE_THRESHOLD
): RawDetection[] {
  const out: RawDetection[] = [];
  for (let a = 0; a < numAnchors; a++) {
    let best = 0;
    let bestClass = -1;
    for (let c = 0; c < numClasses; c++) {
      const s = data[(4 + c) * numAnchors + a];
      if (s > best) {
        best = s;
        bestClass = c;
      }
    }
    if (best < scoreThreshold) continue;
    const cx = data[a];
    const cy = data[numAnchors + a];
    const w = data[2 * numAnchors + a];
    const h = data[3 * numAnchors + a];
    out.push({
      classId: bestClass,
      score: best,
      x1: cx - w / 2,
      y1: cy - h / 2,
      x2: cx + w / 2,
      y2: cy + h / 2,
    });
  }
  return out;
}

export function iou(a: RawDetection, b: RawDetection): number {
  const ix = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1));
  const iy = Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
  const inter = ix * iy;
  const union =
    (a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - inter;
  return union > 0 ? inter / union : 0;
}

/** Greedy class-aware NMS (boxes of different classes never suppress each other). */
export function nonMaxSuppression(
  dets: RawDetection[],
  iouThreshold = IOU_THRESHOLD,
  maxDetections = MAX_DETECTIONS
): RawDetection[] {
  const sorted = [...dets].sort((a, b) => b.score - a.score);
  const kept: RawDetection[] = [];
  for (const det of sorted) {
    if (kept.length >= maxDetections) break;
    if (kept.some((k) => k.classId === det.classId && iou(k, det) > iouThreshold)) continue;
    kept.push(det);
  }
  return kept;
}

/** Un-letterbox to source-normalized [0, 1] boxes and map to DetectedRisks. */
export function toDetectedRisks(
  dets: RawDetection[],
  geom: LetterboxGeometry,
  srcW: number,
  srcH: number
): DetectedRisk[] {
  const risks: DetectedRisk[] = [];
  for (const det of dets) {
    const className = WUI_CLASSES[det.classId];
    if (!className) continue; // out-of-range class id — skip, never throw
    const info = WUI_CLASS_INFO[className];
    const x = Math.max(0, Math.min(1, (det.x1 - geom.padL) / geom.scale / srcW));
    const y = Math.max(0, Math.min(1, (det.y1 - geom.padT) / geom.scale / srcH));
    const x2 = Math.max(0, Math.min(1, (det.x2 - geom.padL) / geom.scale / srcW));
    const y2 = Math.max(0, Math.min(1, (det.y2 - geom.padT) / geom.scale / srcH));
    if (x2 - x <= 0 || y2 - y <= 0) continue;
    risks.push({
      type: info.label,
      confidence: det.score,
      severity: info.severity,
      description: info.description,
      sourceClass: className,
      boundingBox: { x, y, width: x2 - x, height: y2 - y },
    });
  }
  return risks;
}

/**
 * Vegetation coverage % — union of tree/plant boxes rasterized on a coarse
 * grid (a detector has no masks; this approximates what the DeepLab path
 * reports so downstream consumers keep working).
 */
export function vegetationCoverage(
  dets: RawDetection[],
  geom: LetterboxGeometry,
  gridSize = 64
): number {
  const grid = new Uint8Array(gridSize * gridSize);
  for (const det of dets) {
    if (!VEGETATION_CLASS_IDS.has(det.classId)) continue;
    const gx1 = Math.max(0, Math.floor(((det.x1 - geom.padL) / geom.newW) * gridSize));
    const gy1 = Math.max(0, Math.floor(((det.y1 - geom.padT) / geom.newH) * gridSize));
    const gx2 = Math.min(gridSize, Math.ceil(((det.x2 - geom.padL) / geom.newW) * gridSize));
    const gy2 = Math.min(gridSize, Math.ceil(((det.y2 - geom.padT) / geom.newH) * gridSize));
    for (let y = gy1; y < gy2; y++) {
      for (let x = gx1; x < gx2; x++) grid[y * gridSize + x] = 1;
    }
  }
  let covered = 0;
  for (let i = 0; i < grid.length; i++) covered += grid[i];
  return Math.round((covered / grid.length) * 100);
}

// ---------- runtime ----------

type OrtSession = import('onnxruntime-web').InferenceSession;
type OrtModule = typeof import('onnxruntime-web');

class WuiDetector {
  private ort: OrtModule | null = null;
  private session: OrtSession | null = null;
  private loadPromise: Promise<OrtSession> | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private inputBuf: Uint16Array | null = null;

  isLoaded(): boolean {
    return this.session !== null;
  }

  async load(): Promise<OrtSession> {
    if (this.session) return this.session;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      // Served from our own origin so the detector works offline once the
      // service worker has cached the runtime, wasm, and model.
      const ort = (await import(/* @vite-ignore */ ORT_RUNTIME_URL)) as OrtModule;
      ort.env.wasm.wasmPaths = ORT_WASM_PATH;
      this.ort = ort;
      return ort.InferenceSession.create(WUI_MODEL_URL, {
        executionProviders: ['wasm'],
      });
    })();

    try {
      this.session = await this.loadPromise;
      return this.session;
    } catch (err) {
      this.loadPromise = null;
      throw err;
    }
  }

  async analyze(source: AnalyzableSource): Promise<FrameAnalysis> {
    const session = await this.load();
    const ort = this.ort!;

    const srcW = source.width;
    const srcH = source.height;
    const geom = letterboxGeometry(srcW, srcH);

    const t0 = performance.now();

    // Letterbox onto a reused canvas (Ultralytics gray padding), then pack
    // RGB into the reused NCHW float buffer.
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = INPUT_SIZE;
      this.canvas.height = INPUT_SIZE;
    }
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.fillStyle = 'rgb(114,114,114)';
    ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
    ctx.drawImage(source, geom.padL, geom.padT, geom.newW, geom.newH);
    const { data } = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);

    const n = INPUT_SIZE * INPUT_SIZE;
    if (!this.inputBuf) this.inputBuf = new Uint16Array(3 * n);
    const buf = this.inputBuf;
    for (let i = 0; i < n; i++) {
      buf[i] = HALF_LUT[data[i * 4]];
      buf[n + i] = HALF_LUT[data[i * 4 + 1]];
      buf[2 * n + i] = HALF_LUT[data[i * 4 + 2]];
    }

    const input = new ort.Tensor('float16', buf, [1, 3, INPUT_SIZE, INPUT_SIZE]);
    const outputs = await session.run({ images: input });
    const output = outputs.output0;
    const [, channels, anchors] = output.dims;
    const numClasses = channels - 4;
    // float16 output arrives as raw bit patterns (Uint16Array) on platforms
    // without Float16Array, but as already-converted float *values* (a native
    // Float16Array) where the platform has one — the two need different
    // handling, and conflating them zeroes every score.
    const rawOut = output.data;
    const outData: Float32Array =
      rawOut instanceof Float32Array
        ? rawOut
        : rawOut instanceof Uint16Array
          ? halfToFloatArray(rawOut)
          : Float32Array.from(rawOut as unknown as ArrayLike<number>);

    const dets = nonMaxSuppression(parseYoloOutput(outData, numClasses, anchors));
    const risks = toDetectedRisks(dets, geom, srcW, srcH);
    const coverage = vegetationCoverage(dets, geom);

    return { risks, coverage, inferenceMs: performance.now() - t0 };
  }

  dispose(): void {
    void this.session?.release();
    this.session = null;
    this.loadPromise = null;
  }
}

export const wuiDetector = new WuiDetector();
