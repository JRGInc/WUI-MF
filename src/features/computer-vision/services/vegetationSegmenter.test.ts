import { describe, expect, it } from 'vitest';
import {
  ADE20K,
  classBoundingBoxes,
  coverageOf,
  hasGroundFuel,
  risksFromClassMap,
  vegToStructureProximity,
} from './vegetationSegmenter';

/**
 * Unit tests for the pure risk-derivation helpers — the logic behind every
 * user-visible DeepLab finding. These were shipped untested; a silent
 * off-by-one here mis-scores real assessments.
 */

const TREE = 4; // ADE20K vegetation
const BUILDING = 1; // ADE20K structure
const ROAD = 6; // ADE20K ground

function makeMap(width: number, height: number, fill = 0): Uint8Array {
  return new Uint8Array(width * height).fill(fill);
}

function fillRect(
  map: Uint8Array,
  width: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  classId: number
) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) map[y * width + x] = classId;
}

describe('coverageOf', () => {
  it('reports the exact pixel fraction as a percentage', () => {
    const map = makeMap(8, 8);
    fillRect(map, 8, 0, 0, 7, 3, TREE); // top half
    expect(coverageOf(map, ADE20K.VEGETATION)).toBe(50);
  });

  it('is zero when the class set is absent', () => {
    expect(coverageOf(makeMap(8, 8), ADE20K.VEGETATION)).toBe(0);
  });
});

describe('hasGroundFuel', () => {
  it('detects vegetation touching ground in the lower two-thirds', () => {
    const map = makeMap(9, 9);
    map[6 * 9 + 4] = TREE;
    map[6 * 9 + 5] = ROAD; // right neighbor
    expect(hasGroundFuel(map, 9, 9)).toBe(true);
  });

  it('ignores canopy in the top third even when adjacent to ground', () => {
    const map = makeMap(9, 9);
    map[0 * 9 + 4] = TREE;
    map[0 * 9 + 5] = ROAD;
    expect(hasGroundFuel(map, 9, 9)).toBe(false);
  });

  it('requires ground adjacency, not just low vegetation', () => {
    const map = makeMap(9, 9);
    map[6 * 9 + 4] = TREE; // surrounded by background
    expect(hasGroundFuel(map, 9, 9)).toBe(false);
  });
});

describe('vegToStructureProximity', () => {
  it('returns 1 when either class is absent', () => {
    const map = makeMap(8, 8);
    expect(vegToStructureProximity(map, 8, 8)).toBe(1);
    map[0] = TREE;
    expect(vegToStructureProximity(map, 8, 8)).toBe(1);
  });

  it('reports smaller distances for closer vegetation', () => {
    const near = makeMap(32, 32);
    near[5 * 32 + 4] = TREE;
    near[6 * 32 + 4] = BUILDING; // one row below, same column
    const far = makeMap(32, 32);
    far[0] = TREE;
    far[31 * 32 + 28] = BUILDING; // opposite corner (sampled index)
    const dNear = vegToStructureProximity(near, 32, 32);
    const dFar = vegToStructureProximity(far, 32, 32);
    expect(dNear).toBeCloseTo(1 / 32, 6);
    expect(dFar).toBeGreaterThan(dNear * 10);
  });
});

describe('classBoundingBoxes', () => {
  it('finds a connected component with correct normalized bounds', () => {
    const map = makeMap(16, 16);
    fillRect(map, 16, 4, 8, 7, 11, TREE); // 4×4 blob
    const boxes = classBoundingBoxes(map, 16, 16, ADE20K.VEGETATION);
    expect(boxes).toHaveLength(1);
    expect(boxes[0]).toEqual({ x: 4 / 16, y: 8 / 16, width: 4 / 16, height: 4 / 16, size: 16 });
  });

  it('separates disconnected components', () => {
    const map = makeMap(16, 16);
    fillRect(map, 16, 0, 0, 2, 2, TREE);
    fillRect(map, 16, 10, 10, 13, 13, TREE);
    expect(classBoundingBoxes(map, 16, 16, ADE20K.VEGETATION)).toHaveLength(2);
  });

  it('drops components below the minimum size', () => {
    const map = makeMap(16, 16);
    map[0] = TREE; // single pixel
    expect(classBoundingBoxes(map, 16, 16, ADE20K.VEGETATION, 2)).toHaveLength(0);
  });
});

describe('risksFromClassMap', () => {
  it('flags vegetation adjacent to a structure', () => {
    const map = makeMap(32, 32);
    fillRect(map, 32, 0, 8, 31, 11, BUILDING); // 12.5% structure
    fillRect(map, 32, 0, 12, 31, 15, TREE); // vegetation directly below it
    const { risks, coverage } = risksFromClassMap(map, 32, 32);
    expect(coverage).toBeCloseTo(12.5, 5);
    expect(risks.map((r) => r.type)).toContain('Vegetation Adjacent to Structure');
  });

  it('reports no adjacency risk when vegetation is far from the structure', () => {
    const map = makeMap(64, 64);
    fillRect(map, 64, 0, 0, 63, 7, BUILDING); // top band
    fillRect(map, 64, 0, 56, 63, 63, TREE); // bottom band, 48 px away
    const { risks } = risksFromClassMap(map, 64, 64);
    expect(risks.map((r) => r.type)).not.toContain('Vegetation Adjacent to Structure');
  });
});
