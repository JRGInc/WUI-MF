import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { decode as decodeJpeg } from 'jpeg-js';
import {
  SCORE_THRESHOLD,
  WUI_CLASSES,
  halfToFloatArray,
  nonMaxSuppression,
  parseYoloOutput,
  toDetectedRisks,
  type WuiClass,
} from '../services/wuiDetector';
import { letterboxRgbaToHalfNchw } from './preprocess';
import manifest from './fixtures/manifest.json';

/**
 * Golden-image evaluation of the WUI detector: runs the real ONNX over a
 * curated, human-labeled fixture set and reports per-class recall (image
 * level: was an expected class detected anywhere in the image?). Neither
 * WebWUI nor BFMA previously had ANY accuracy measurement — this is the
 * regression floor. The thresholds below are the observed baseline of the
 * committed model (fast_yolo_v8_s); raise them when the model improves,
 * and a failure means a change made detection WORSE.
 *
 * Weak labels: `expect` lists classes clearly visible to a human, not an
 * exhaustive box annotation — so precision is only reported informationally
 * (unexpected classes may genuinely be present).
 *
 * Run standalone with a readable report: `npm run eval:detector`.
 */

const MODEL_PATH = resolve(__dirname, '../../../../public/models/bfma-yolov8s-wui/model.onnx');

// Observed baseline (2026-09-01, fast_yolo_v8_s.onnx as shipped by BFMA):
// 9/26 expected classes detected (35%) at conf ≥ 0.3. Node results were
// cross-validated against the browser path (identical scores on the Boise
// fixture), so misses are the model, not the harness. Notable findings the
// baseline encodes: BOTH full-frame firewood close-ups miss (the flagship
// hazard class — likely a training-distribution gap, close-ups vs
// house-context scenes; input for the item-5 retraining), and the night
// gutter shot and out-of-distribution stone church miss entirely.
// A regression drops these numbers; an improved model should raise them.
const MIN_OVERALL_RECALL = 0.34;
const MIN_HITS_PER_CLASS: Partial<Record<WuiClass, number>> = {
  deck: 2,
  plant: 1,
  roof: 2,
  tree: 1,
  window: 3,
};

interface Fixture {
  file: string;
  expect: string[];
  note: string;
}

describe.skipIf(!existsSync(MODEL_PATH))('WUI detector golden-image evaluation', () => {
  beforeAll(() => {
    // onnxruntime-node 1.29 can't marshal Node's native Float16Array; keep
    // fp16 tensors as Uint16Array bit patterns (see wuiDetector.integration).
    vi.stubGlobal('Float16Array', undefined);
  });
  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('meets the recorded per-class recall baseline', { timeout: 300_000 }, async () => {
    const ort = await import('onnxruntime-node');
    const session = await ort.InferenceSession.create(MODEL_PATH);

    const fixtures = manifest.fixtures as Fixture[];
    const expectedTotal = new Map<string, number>();
    const expectedHit = new Map<string, number>();
    const unexpected = new Map<string, number>();
    const rows: string[] = [];

    for (const fixture of fixtures) {
      const jpegData = readFileSync(resolve(__dirname, 'fixtures', fixture.file));
      const img = decodeJpeg(jpegData, { useTArray: true, maxMemoryUsageInMB: 1024 });
      const { data, geom } = letterboxRgbaToHalfNchw(img.data, img.width, img.height);

      const out = (
        await session.run({
          images: new ort.Tensor('float16', data, [1, 3, 640, 640]),
        })
      ).output0;
      const raw =
        out.data instanceof Uint16Array
          ? halfToFloatArray(out.data)
          : (out.data as Float32Array);
      const dets = nonMaxSuppression(parseYoloOutput(raw, out.dims[1] - 4, out.dims[2]));
      const risks = toDetectedRisks(dets, geom, img.width, img.height);
      expect(risks.length).toBe(dets.length); // decode must not drop valid boxes

      const detected = new Set(dets.map((d) => WUI_CLASSES[d.classId]));
      for (const cls of fixture.expect) {
        expectedTotal.set(cls, (expectedTotal.get(cls) ?? 0) + 1);
        if (detected.has(cls as WuiClass)) expectedHit.set(cls, (expectedHit.get(cls) ?? 0) + 1);
      }
      for (const cls of detected) {
        if (!fixture.expect.includes(cls)) unexpected.set(cls, (unexpected.get(cls) ?? 0) + 1);
      }
      const hits = fixture.expect.filter((c) => detected.has(c as WuiClass));
      rows.push(
        `${fixture.file.padEnd(52)} expect [${fixture.expect.join(', ')}] → hit [${hits.join(', ')}]` +
          ` | all: ${[...detected].join(', ') || '(none)'}`
      );
    }

    // ---- report ----
    let totalExpected = 0;
    let totalHit = 0;
    const classRows: string[] = [];
    for (const [cls, total] of [...expectedTotal.entries()].sort()) {
      const hit = expectedHit.get(cls) ?? 0;
      totalExpected += total;
      totalHit += hit;
      classRows.push(`  ${cls.padEnd(14)} recall ${hit}/${total}`);
    }
    const overallRecall = totalHit / totalExpected;
    console.log(
      [
        '',
        `WUI detector evaluation — ${fixtures.length} fixtures, conf ≥ ${SCORE_THRESHOLD}`,
        ...rows,
        '',
        'Per-class image-level recall:',
        ...classRows,
        `  ${'OVERALL'.padEnd(14)} ${totalHit}/${totalExpected} = ${(overallRecall * 100).toFixed(0)}%`,
        `Unexpected-class detections (informational): ${
          [...unexpected.entries()].map(([c, n]) => `${c}×${n}`).join(', ') || '(none)'
        }`,
        '',
      ].join('\n')
    );

    // ---- baseline assertions ----
    expect(overallRecall).toBeGreaterThanOrEqual(MIN_OVERALL_RECALL);
    for (const [cls, min] of Object.entries(MIN_HITS_PER_CLASS)) {
      expect(
        expectedHit.get(cls) ?? 0,
        `class '${cls}' fell below its recall baseline`
      ).toBeGreaterThanOrEqual(min!);
    }
  });
});
