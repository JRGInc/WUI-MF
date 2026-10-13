import { describe, it, expect } from 'vitest';
import {
  checkPropertiesForFires,
  checkProperty,
  NEAR_DISTANCE_M,
  parseWfigs,
  wfigsQueryUrl,
} from './fireCheck';

const bigGrass = {
  OBJECTID: 56631,
  poly_IncidentName: 'Big Grass',
  poly_IRWINID: '{6B0C72B3-0E12-4695-9022-E1113C0AA8D1}',
  attr_FireDiscoveryDateTime: 1784838600000,
  poly_GISAcres: 575163.45,
};
const nearby = { OBJECTID: 7, poly_IncidentName: 'Nearby', attr_UniqueFireIdentifier: '2026-IDBOD-1' };

function json(body: unknown, ok = true, status = 200) {
  return Promise.resolve({ ok, status, json: () => Promise.resolve(body) });
}

describe('wfigsQueryUrl', () => {
  it('queries wildfires (not prescribed burns) at a lng/lat point, without geometry', () => {
    const url = new URL(wfigsQueryUrl({ latitude: 42.5, longitude: -116.9 }));
    expect(JSON.parse(url.searchParams.get('geometry')!)).toEqual({ x: -116.9, y: 42.5 });
    expect(url.searchParams.get('where')).toBe("attr_IncidentTypeCategory = 'WF'");
    expect(url.searchParams.get('returnGeometry')).toBe('false');
    expect(url.searchParams.has('distance')).toBe(false);
  });
  it('adds a metre distance for the near query', () => {
    const url = new URL(wfigsQueryUrl({ latitude: 1, longitude: 2 }, NEAR_DISTANCE_M));
    expect(url.searchParams.get('distance')).toBe('1000');
    expect(url.searchParams.get('units')).toBe('esriSRUnit_Meter');
  });
});

describe('parseWfigs', () => {
  it('maps IRWIN id, name, ISO discovery date and rounded acres', () => {
    expect(parseWfigs({ features: [{ attributes: bigGrass }] })).toEqual([
      {
        incidentId: '{6B0C72B3-0E12-4695-9022-E1113C0AA8D1}',
        incidentName: 'Big Grass',
        discoveredAt: new Date(1784838600000).toISOString(),
        acres: 575163,
      },
    ]);
  });
  it('falls back to the unique fire id, then OBJECTID', () => {
    expect(parseWfigs({ features: [{ attributes: nearby }] })[0].incidentId).toBe('2026-IDBOD-1');
    expect(parseWfigs({ features: [{ attributes: { OBJECTID: 9 } }] })[0]).toMatchObject({
      incidentId: 'wfigs:9',
      incidentName: 'Unnamed fire',
    });
  });
  it('throws on an ArcGIS error body', () => {
    expect(() => parseWfigs({ error: { message: 'Invalid query' } })).toThrow(/Invalid query/);
  });
});

describe('checkProperty', () => {
  const point = { assessmentId: 'a1', latitude: 42.5, longitude: -116.9 };

  it('skips the exact query when nothing is within 1 km', async () => {
    const calls: string[] = [];
    const hits = await checkProperty(point, (url) => {
      calls.push(url);
      return json({ features: [] });
    });
    expect(hits).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it('labels fires containing the point inside, the rest near', async () => {
    const hits = await checkProperty(point, (url) =>
      url.includes('distance=')
        ? json({ features: [{ attributes: bigGrass }, { attributes: nearby }] })
        : json({ features: [{ attributes: bigGrass }] })
    );
    expect(hits.map((h) => [h.fire.incidentName, h.relation])).toEqual([
      ['Big Grass', 'inside'],
      ['Nearby', 'near'],
    ]);
  });
});

describe('checkPropertiesForFires', () => {
  it('checks every property, reports progress, and isolates failures', async () => {
    const points = ['a1', 'a2', 'a3'].map((id, i) => ({ assessmentId: id, latitude: i, longitude: i }));
    const progress: number[] = [];
    const result = await checkPropertiesForFires(points, {
      concurrency: 2,
      onProgress: (done) => progress.push(done),
      fetchImpl: (url) => {
        const x = JSON.parse(new URL(url).searchParams.get('geometry')!).x;
        if (x === 1) return json({}, false, 503);
        return json({ features: x === 2 ? [{ attributes: bigGrass }] : [] });
      },
    });
    expect(result.failed).toEqual(['a2']);
    expect(result.hits.map((h) => [h.assessmentId, h.relation])).toEqual([['a3', 'inside']]);
    expect(progress.sort()).toEqual([1, 2, 3]);
  });
});
