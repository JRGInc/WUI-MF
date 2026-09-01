import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  INPUT_SIZE,
  WUI_CLASSES,
  floatToHalfBits,
  halfToFloatArray,
  nonMaxSuppression,
  parseYoloOutput,
} from './wuiDetector';

/**
 * Shape-contract test against the real committed ONNX via onnxruntime-node:
 * proves the model loads, accepts the exact input we build in the browser
 * ("images", [1, 3, 640, 640] float32), and emits the output layout the
 * decoder assumes ("output0", [1, 4 + 19, anchors]). Skipped if the model
 * file is absent (e.g. a checkout without the binary).
 */
const MODEL_PATH = resolve(__dirname, '../../../../public/models/bfma-yolov8s-wui/model.onnx');

describe.skipIf(!existsSync(MODEL_PATH))('WUI detector ONNX contract', () => {
  // onnxruntime-common 1.29 wraps float16 data in Float16Array when the
  // platform provides it (Node ≥ 24), but onnxruntime-node's native binding
  // can't marshal Float16Array yet ("not enough space" at run time). Hide the
  // global so ORT keeps Uint16Array storage — the same representation the
  // browser code uses.
  beforeAll(() => {
    vi.stubGlobal('Float16Array', undefined);
  });
  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it(
    'loads, runs, and matches the decoder layout',
    { timeout: 60_000 },
    async () => {
      const ort = await import('onnxruntime-node');
      const session = await ort.InferenceSession.create(MODEL_PATH);

      expect(session.inputNames).toContain('images');
      expect(session.outputNames).toContain('output0');

      // The export is half-precision: feed a uniform gray (Ultralytics pad
      // value) frame as float16 bits, exactly as the browser path does.
      const gray = floatToHalfBits(114 / 255);
      const input = new ort.Tensor(
        'float16',
        new Uint16Array(3 * INPUT_SIZE * INPUT_SIZE).fill(gray),
        [1, 3, INPUT_SIZE, INPUT_SIZE]
      );
      const outputs = await session.run({ images: input });
      const out = outputs.output0;

      expect(out.dims[0]).toBe(1);
      expect(out.dims[1]).toBe(4 + WUI_CLASSES.length); // 23 channels
      expect(out.dims[2]).toBeGreaterThan(1000); // 8400 anchors at 640²

      // The decoder must run cleanly over real model output; a blank frame
      // should produce few-to-no confident detections.
      const data =
        out.type === 'float16'
          ? halfToFloatArray(out.data as Uint16Array)
          : (out.data as Float32Array);
      const dets = nonMaxSuppression(parseYoloOutput(data, out.dims[1] - 4, out.dims[2]));
      expect(Array.isArray(dets)).toBe(true);
      expect(dets.length).toBeLessThan(10);
    }
  );
});
