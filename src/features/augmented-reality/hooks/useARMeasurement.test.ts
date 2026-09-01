import { describe, expect, it } from 'vitest';
import {
  EMPTY_MEASURE_STATE,
  addPointTo,
  formatDistance,
  pointDistance,
  type MeasureState,
} from './useARMeasurement';

describe('formatDistance', () => {
  it('formats feet from canonical metres', () => {
    expect(formatDistance(3.048, 'feet')).toBe('10.0 ft');
  });

  it('formats metres', () => {
    expect(formatDistance(4.257, 'meters')).toBe('4.26 m');
  });
});

describe('pointDistance', () => {
  it('computes 3D euclidean distance', () => {
    expect(pointDistance({ x: 0, y: 0, z: 0 }, { x: 3, y: 0, z: 4 })).toBeCloseTo(5, 10);
  });
});

describe('addPointTo', () => {
  it('produces a measurement from two points — the shipped-broken regression', () => {
    let state: MeasureState = EMPTY_MEASURE_STATE;

    state = addPointTo(state, { x: 0, y: 0, z: 0 });
    expect(state.pendingPoint).toEqual({ x: 0, y: 0, z: 0 });
    expect(state.measurements).toHaveLength(0);

    state = addPointTo(state, { x: 3, y: 0, z: 4 });
    expect(state.pendingPoint).toBeNull();
    expect(state.measurements).toHaveLength(1);
    expect(state.measurements[0].distanceM).toBeCloseTo(5, 10);
  });

  it('chains segments: every two points complete one', () => {
    let state: MeasureState = EMPTY_MEASURE_STATE;
    state = addPointTo(state, { x: 0, y: 0, z: 0 });
    state = addPointTo(state, { x: 1, y: 0, z: 0 });
    state = addPointTo(state, { x: 1, y: 0, z: 0 });
    state = addPointTo(state, { x: 1, y: 2, z: 0 });
    expect(state.measurements.map((m) => m.distanceM)).toEqual([1, 2]);
  });

  it('keeps prior measurements when starting a new segment', () => {
    let state: MeasureState = EMPTY_MEASURE_STATE;
    state = addPointTo(state, { x: 0, y: 0, z: 0 });
    state = addPointTo(state, { x: 1, y: 0, z: 0 });
    const after = addPointTo(state, { x: 5, y: 5, z: 5 });
    expect(after.measurements).toEqual(state.measurements);
    expect(after.pendingPoint).toEqual({ x: 5, y: 5, z: 5 });
  });
});
