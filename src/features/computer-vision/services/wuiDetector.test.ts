import { describe, expect, it } from 'vitest';
import {
  IOU_THRESHOLD,
  SCORE_THRESHOLD,
  WUI_CLASSES,
  WUI_CLASS_INFO,
  floatToHalfBits,
  halfBitsToFloat,
  halfToFloatArray,
  iou,
  letterboxGeometry,
  nonMaxSuppression,
  parseYoloOutput,
  toDetectedRisks,
  vegetationCoverage,
  type RawDetection,
} from './wuiDetector';

const det = (partial: Partial<RawDetection>): RawDetection => ({
  classId: 0,
  score: 0.9,
  x1: 0,
  y1: 0,
  x2: 10,
  y2: 10,
  ...partial,
});

describe('WUI class map', () => {
  it('covers all 19 model classes — no detection can hit a missing key', () => {
    // Regression for BFMA's KeyNotFoundException: its Unity class→category
    // dictionary was missing `stairs`, so that detection crashed the app.
    expect(WUI_CLASSES).toHaveLength(19);
    for (const c of WUI_CLASSES) {
      expect(WUI_CLASS_INFO[c], `missing class info for ${c}`).toBeDefined();
      expect(WUI_CLASS_INFO[c].label.length).toBeGreaterThan(0);
      expect(WUI_CLASS_INFO[c].description.length).toBeGreaterThan(0);
    }
  });

  it('keeps confidence and IoU thresholds as separate knobs', () => {
    // BFMA passed its confidence threshold into NMS as the IoU cutoff,
    // conflating the two. Assert they exist independently and differ.
    expect(SCORE_THRESHOLD).not.toBe(IOU_THRESHOLD);
  });
});

describe('float16 conversion', () => {
  it('round-trips representative values within half precision', () => {
    for (const v of [0, 1, 0.5, 114 / 255, 0.30078125, -0.25, 640]) {
      expect(halfBitsToFloat(floatToHalfBits(v))).toBeCloseTo(v, 2);
    }
  });

  it('handles specials', () => {
    expect(halfBitsToFloat(floatToHalfBits(Infinity))).toBe(Infinity);
    expect(halfBitsToFloat(floatToHalfBits(-Infinity))).toBe(-Infinity);
    expect(halfBitsToFloat(floatToHalfBits(NaN))).toBeNaN();
    expect(halfBitsToFloat(floatToHalfBits(1e6))).toBe(Infinity); // overflow
    expect(halfBitsToFloat(floatToHalfBits(1e-9))).toBe(0); // underflow
  });

  it('converts arrays', () => {
    const src = new Uint16Array([floatToHalfBits(0.25), floatToHalfBits(2)]);
    const out = halfToFloatArray(src);
    expect(out[0]).toBeCloseTo(0.25, 5);
    expect(out[1]).toBeCloseTo(2, 5);
  });
});

describe('letterboxGeometry', () => {
  it('computes the 1920×1080 → 640 letterbox', () => {
    const g = letterboxGeometry(1920, 1080);
    expect(g.scale).toBeCloseTo(1 / 3, 10);
    expect(g.newW).toBe(640);
    expect(g.newH).toBe(360);
    expect(g.padL).toBe(0);
    expect(g.padT).toBe(140);
  });

  it('pads portrait sources horizontally', () => {
    const g = letterboxGeometry(1080, 1920);
    expect(g.padT).toBe(0);
    expect(g.padL).toBe(140);
  });
});

describe('parseYoloOutput', () => {
  // Layout [4 + C, A]: row-major, value(row, anchor) = data[row * A + a].
  function buildOutput(anchors: { cx: number; cy: number; w: number; h: number; scores: number[] }[]) {
    const numClasses = anchors[0].scores.length;
    const A = anchors.length;
    const data = new Float32Array((4 + numClasses) * A);
    anchors.forEach((an, a) => {
      data[a] = an.cx;
      data[A + a] = an.cy;
      data[2 * A + a] = an.w;
      data[3 * A + a] = an.h;
      an.scores.forEach((s, c) => {
        data[(4 + c) * A + a] = s;
      });
    });
    return { data, numClasses, A };
  }

  it('decodes boxes and picks the argmax class above threshold', () => {
    const { data, numClasses, A } = buildOutput([
      { cx: 100, cy: 200, w: 40, h: 60, scores: [0.1, 0.8, 0.2] },
      { cx: 300, cy: 300, w: 20, h: 20, scores: [0.05, 0.1, 0.08] }, // below threshold
    ]);
    const dets = parseYoloOutput(data, numClasses, A, 0.3);
    expect(dets).toHaveLength(1);
    expect(dets[0].classId).toBe(1);
    expect(dets[0].score).toBeCloseTo(0.8, 6);
    expect(dets[0].x1).toBeCloseTo(80, 6);
    expect(dets[0].y1).toBeCloseTo(170, 6);
    expect(dets[0].x2).toBeCloseTo(120, 6);
    expect(dets[0].y2).toBeCloseTo(230, 6);
  });
});

describe('iou / nonMaxSuppression', () => {
  it('computes IoU for identical and disjoint boxes', () => {
    const a = det({});
    expect(iou(a, det({}))).toBeCloseTo(1, 10);
    expect(iou(a, det({ x1: 20, x2: 30 }))).toBe(0);
  });

  it('suppresses overlapping same-class boxes, keeping the higher score', () => {
    const kept = nonMaxSuppression(
      [det({ score: 0.6, x1: 1, y1: 1, x2: 11, y2: 11 }), det({ score: 0.9 })],
      0.45
    );
    expect(kept).toHaveLength(1);
    expect(kept[0].score).toBe(0.9);
  });

  it('is class-aware: overlapping boxes of different classes both survive', () => {
    const kept = nonMaxSuppression([det({ classId: 4, score: 0.9 }), det({ classId: 5, score: 0.8 })], 0.45);
    expect(kept).toHaveLength(2);
  });

  it('caps the number of detections', () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      det({ x1: i * 100, x2: i * 100 + 10, score: 0.5 })
    );
    expect(nonMaxSuppression(many, 0.45, 25)).toHaveLength(25);
  });
});

describe('toDetectedRisks', () => {
  const geom = letterboxGeometry(1920, 1080);

  it('un-letterboxes to source-normalized coordinates', () => {
    // A box spanning the full letterboxed content area maps to the full frame.
    const risks = toDetectedRisks(
      [det({ classId: WUI_CLASSES.indexOf('firewood'), x1: 0, y1: 140, x2: 640, y2: 500 })],
      geom,
      1920,
      1080
    );
    expect(risks).toHaveLength(1);
    expect(risks[0].type).toBe(WUI_CLASS_INFO.firewood.label);
    expect(risks[0].severity).toBe('high');
    const b = risks[0].boundingBox!;
    expect(b.x).toBeCloseTo(0, 6);
    expect(b.y).toBeCloseTo(0, 6);
    expect(b.width).toBeCloseTo(1, 6);
    expect(b.height).toBeCloseTo(1, 6);
  });

  it('skips out-of-range class ids instead of throwing', () => {
    expect(toDetectedRisks([det({ classId: 99 })], geom, 1920, 1080)).toHaveLength(0);
  });

  it('drops boxes fully outside the frame after clamping', () => {
    const risks = toDetectedRisks(
      [det({ x1: -200, y1: 0, x2: -100, y2: 100 })],
      geom,
      1920,
      1080
    );
    expect(risks).toHaveLength(0);
  });
});

describe('vegetationCoverage', () => {
  const geom = letterboxGeometry(640, 640); // no padding, scale 1

  it('reports the union area of tree/plant boxes', () => {
    const tree = det({ classId: WUI_CLASSES.indexOf('tree'), x1: 0, y1: 0, x2: 320, y2: 640 });
    expect(vegetationCoverage([tree], geom)).toBe(50);
  });

  it('ignores non-vegetation classes', () => {
    const fence = det({ classId: WUI_CLASSES.indexOf('fence'), x1: 0, y1: 0, x2: 640, y2: 640 });
    expect(vegetationCoverage([fence], geom)).toBe(0);
  });

  it('does not double-count overlapping vegetation boxes', () => {
    const a = det({ classId: WUI_CLASSES.indexOf('tree'), x1: 0, y1: 0, x2: 320, y2: 640 });
    const b = det({ classId: WUI_CLASSES.indexOf('plant'), x1: 0, y1: 0, x2: 320, y2: 640 });
    expect(vegetationCoverage([a, b], geom)).toBe(50);
  });
});
