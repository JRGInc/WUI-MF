import { describe, it, expect, vi } from 'vitest';
import { findFootprint, renderedFootprintAt, type FootprintMap } from './footprint';

const coords = { latitude: 43.6, longitude: -116.2 };
const square: GeoJSON.Polygon = {
  type: 'Polygon',
  coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
};
const tileFootprint: GeoJSON.Feature = { type: 'Feature', properties: {}, geometry: square };

function fakeMap(features: { sourceLayer?: string; geometry: GeoJSON.Geometry }[], throws = false): FootprintMap {
  return {
    project: () => ({ x: 100, y: 100 }),
    queryRenderedFeatures: () => {
      if (throws) throw new Error('style not loaded');
      return features;
    },
  };
}

describe('renderedFootprintAt', () => {
  it('returns the rendered building polygon under the point', () => {
    const map = fakeMap([
      { sourceLayer: 'road', geometry: { type: 'LineString', coordinates: [] } },
      { sourceLayer: 'building', geometry: square },
    ]);
    expect(renderedFootprintAt(map, coords)?.geometry).toEqual(square);
  });

  it('is null when the style draws no buildings (e.g. Satellite) or the query throws', () => {
    expect(renderedFootprintAt(fakeMap([{ sourceLayer: 'road', geometry: square }]), coords)).toBeNull();
    expect(renderedFootprintAt(fakeMap([], true), coords)).toBeNull();
  });
});

describe('findFootprint', () => {
  it('uses the rendered footprint without fetching when the style has one', async () => {
    const fetchOffMap = vi.fn();
    const result = await findFootprint(fakeMap([{ sourceLayer: 'building', geometry: square }]), coords, 'tok', fetchOffMap);
    expect(result?.geometry).toEqual(square);
    expect(fetchOffMap).not.toHaveBeenCalled();
  });

  it('falls back to the Mapbox Streets vector tile when nothing is rendered (Satellite)', async () => {
    const fetchOffMap = vi.fn().mockResolvedValue(tileFootprint);
    const result = await findFootprint(fakeMap([]), coords, 'tok', fetchOffMap);
    expect(fetchOffMap).toHaveBeenCalledWith(coords, 'tok');
    expect(result).toBe(tileFootprint);
  });

  it('returns null (circles stay) when the tile has no building or the fetch fails', async () => {
    expect(await findFootprint(fakeMap([]), coords, 'tok', vi.fn().mockResolvedValue(null))).toBeNull();
    expect(await findFootprint(fakeMap([]), coords, 'tok', vi.fn().mockRejectedValue(new Error('offline')))).toBeNull();
  });
});
