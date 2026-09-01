import { useCallback, useState } from 'react';

/**
 * Two-point AR tape measure (WebXR path). Every select while in measurement
 * mode places a point: the first becomes the pending start, the second
 * completes a segment. Distances are stored canonically in metres and
 * formatted per the display unit, so toggling units never mutates data.
 *
 * The previous version gated addPoint behind a startMeasurement() call that
 * no UI ever made, so it could never produce a measurement.
 *
 * The state transition (addPointTo) is a pure exported function so the
 * point-pairing logic is unit-testable without a DOM.
 */

export interface MeasurePoint {
  x: number;
  y: number;
  z: number;
}

export interface Measurement {
  id: string;
  start: MeasurePoint;
  end: MeasurePoint;
  distanceM: number;
}

export interface MeasureState {
  pendingPoint: MeasurePoint | null;
  measurements: Measurement[];
}

export type MeasureUnit = 'feet' | 'meters';

const UNIT_STORAGE_KEY = 'ar-measure-unit';
const M_TO_FT = 3.28084;

export const EMPTY_MEASURE_STATE: MeasureState = { pendingPoint: null, measurements: [] };

/** Pure transition: first point becomes pending, second completes a segment. */
export function addPointTo(state: MeasureState, point: MeasurePoint): MeasureState {
  if (!state.pendingPoint) {
    return { ...state, pendingPoint: point };
  }
  return {
    pendingPoint: null,
    measurements: [
      ...state.measurements,
      {
        id: `${Date.now()}-${state.measurements.length}`,
        start: state.pendingPoint,
        end: point,
        distanceM: pointDistance(state.pendingPoint, point),
      },
    ],
  };
}

export function pointDistance(a: MeasurePoint, b: MeasurePoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}

export function formatDistance(distanceM: number, unit: MeasureUnit): string {
  return unit === 'feet' ? `${(distanceM * M_TO_FT).toFixed(1)} ft` : `${distanceM.toFixed(2)} m`;
}

function loadUnit(): MeasureUnit {
  try {
    return localStorage.getItem(UNIT_STORAGE_KEY) === 'meters' ? 'meters' : 'feet';
  } catch {
    return 'feet'; // defensible-space rules are written in feet
  }
}

export function useARMeasurement() {
  const [state, setState] = useState<MeasureState>(EMPTY_MEASURE_STATE);
  const [unit, setUnit] = useState<MeasureUnit>(loadUnit);

  const addPoint = useCallback((point: MeasurePoint) => {
    setState((prev) => addPointTo(prev, point));
  }, []);

  const clearAll = useCallback(() => {
    setState(EMPTY_MEASURE_STATE);
  }, []);

  const toggleUnit = useCallback(() => {
    setUnit((prev) => {
      const next: MeasureUnit = prev === 'feet' ? 'meters' : 'feet';
      try {
        localStorage.setItem(UNIT_STORAGE_KEY, next);
      } catch {
        // Private browsing / blocked storage — the toggle still works this session.
      }
      return next;
    });
  }, []);

  const format = useCallback((distanceM: number) => formatDistance(distanceM, unit), [unit]);

  return {
    pendingPoint: state.pendingPoint,
    measurements: state.measurements,
    unit,
    addPoint,
    clearAll,
    toggleUnit,
    format,
  };
}
