import { describe, expect, it } from 'vitest';
import {
  clipBoundingBox,
  coverMapping,
  IDENTITY_RECT,
  isIdentityRect,
  mapBoundingBox,
} from './frameMapping';

describe('coverMapping', () => {
  it('is identity when frame and container aspects match', () => {
    expect(coverMapping(1920, 1080, 960, 540)).toEqual(IDENTITY_RECT);
  });

  it('crops a landscape frame shown in a portrait container (phone case)', () => {
    // 1920×1080 stream, 390×693 portrait container. Cover scales by height:
    // scale = 693/1080; displayed width = 1920 * 693/1080 = 1232 px.
    const rect = coverMapping(1920, 1080, 390, 693);
    expect(rect.height).toBeCloseTo(1);
    expect(rect.width).toBeCloseTo(1232 / 390);
    // Centered: equal overflow on both sides.
    expect(rect.left).toBeCloseTo((1 - 1232 / 390) / 2);
    expect(rect.top).toBeCloseTo(0);
  });

  it('crops a portrait frame shown in a landscape container', () => {
    const rect = coverMapping(1080, 1920, 800, 450);
    expect(rect.width).toBeCloseTo(1);
    expect(rect.height).toBeGreaterThan(1);
    expect(rect.top).toBeLessThan(0);
    expect(rect.top).toBeCloseTo((1 - rect.height) / 2);
  });

  it('falls back to identity on degenerate dimensions', () => {
    expect(coverMapping(0, 1080, 390, 693)).toEqual(IDENTITY_RECT);
    expect(coverMapping(1920, 1080, 0, 0)).toEqual(IDENTITY_RECT);
  });
});

describe('mapBoundingBox', () => {
  it('passes boxes through an identity rect unchanged', () => {
    const box = { x: 0.25, y: 0.5, width: 0.2, height: 0.1 };
    expect(mapBoundingBox(box, IDENTITY_RECT)).toEqual(box);
  });

  it('maps the frame center to the container center under cover crop', () => {
    const rect = coverMapping(1920, 1080, 390, 693);
    const center = mapBoundingBox(
      { x: 0.5, y: 0.5, width: 0, height: 0 },
      rect
    );
    expect(center.x).toBeCloseTo(0.5);
    expect(center.y).toBeCloseTo(0.5);
  });

  it('pushes a frame-edge box outside the visible container', () => {
    // Wide frame in a narrow container: the frame's left edge is cropped away.
    const rect = coverMapping(1920, 1080, 390, 693);
    const atLeftEdge = mapBoundingBox(
      { x: 0, y: 0.4, width: 0.05, height: 0.2 },
      rect
    );
    expect(atLeftEdge.x).toBeLessThan(0);
  });
});

describe('clipBoundingBox', () => {
  it('keeps a fully visible box unchanged', () => {
    const box = { x: 0.1, y: 0.1, width: 0.3, height: 0.3 };
    const clipped = clipBoundingBox(box);
    expect(clipped?.x).toBeCloseTo(box.x);
    expect(clipped?.y).toBeCloseTo(box.y);
    expect(clipped?.width).toBeCloseTo(box.width);
    expect(clipped?.height).toBeCloseTo(box.height);
  });

  it('trims a box straddling the container edge', () => {
    const clipped = clipBoundingBox({ x: -0.2, y: 0.5, width: 0.4, height: 0.2 });
    expect(clipped?.x).toBeCloseTo(0);
    expect(clipped?.y).toBeCloseTo(0.5);
    expect(clipped?.width).toBeCloseTo(0.2);
    expect(clipped?.height).toBeCloseTo(0.2);
  });

  it('drops a box entirely outside the container', () => {
    expect(
      clipBoundingBox({ x: -0.5, y: 0.2, width: 0.3, height: 0.3 })
    ).toBeNull();
    expect(
      clipBoundingBox({ x: 1.1, y: 0.2, width: 0.3, height: 0.3 })
    ).toBeNull();
  });
});

describe('isIdentityRect', () => {
  it('recognizes the identity rect', () => {
    expect(isIdentityRect(IDENTITY_RECT)).toBe(true);
    expect(isIdentityRect({ left: -0.1, top: 0, width: 1.2, height: 1 })).toBe(
      false
    );
  });
});
