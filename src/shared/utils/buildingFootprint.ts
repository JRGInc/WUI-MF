import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import type { GeoCoordinates } from '@/shared/types';

/**
 * Fetch a building footprint polygon for a coordinate WITHOUT a rendered map, by
 * pulling the Mapbox Streets vector tile and decoding its `building` layer. This
 * is what lets the AR view use the *same* Mapbox footprints the map does (the
 * map reads them from the rendered style via queryRenderedFeatures; off-map we
 * fetch the tile directly). The Tilequery API can't do this — it returns only a
 * Point marking that a building is nearby, not the outline.
 *
 * Returns the footprint containing the point, else the nearest building within
 * NEAREST_LIMIT_M (GPS/geocode is metres-imprecise), else null so callers fall
 * back to the circle zones.
 */

const TILESET = 'mapbox.mapbox-streets-v8';
const BUILDING_LAYER = 'building';
const TILE_ZOOM = 16; // building footprints are well-resolved by z16
const NEAREST_LIMIT_M = 25;

function lngLatToTile(lng: number, lat: number, z: number) {
  const n = 2 ** z;
  const latRad = (lat * Math.PI) / 180;
  return {
    x: Math.floor(((lng + 180) / 360) * n),
    y: Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n),
    z,
  };
}

// Ray-casting point-in-polygon on a [lng,lat] ring.
function pointInRing(pt: [number, number], ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersects =
      yi > pt[1] !== yj > pt[1] &&
      pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function outerRings(feature: GeoJSON.Feature): number[][][] {
  const g = feature.geometry;
  if (g.type === 'Polygon') return [g.coordinates[0]];
  if (g.type === 'MultiPolygon') return g.coordinates.map((poly) => poly[0]);
  return [];
}

// Rough metres between two [lng,lat] points (equirectangular; fine at this scale).
function metersBetween(a: [number, number], b: [number, number]): number {
  const R = 6_378_137;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const meanLat = (((a[1] + b[1]) / 2) * Math.PI) / 180;
  const east = dLng * Math.cos(meanLat) * R;
  const north = dLat * R;
  return Math.hypot(east, north);
}

function ringCentroid(ring: number[][]): [number, number] {
  let sx = 0;
  let sy = 0;
  for (const [x, y] of ring) {
    sx += x;
    sy += y;
  }
  return [sx / ring.length, sy / ring.length];
}

export async function fetchBuildingFootprint(
  coords: GeoCoordinates,
  accessToken: string,
  signal?: AbortSignal
): Promise<GeoJSON.Feature | null> {
  if (!accessToken) return null;

  const { x, y, z } = lngLatToTile(coords.longitude, coords.latitude, TILE_ZOOM);
  const url =
    `https://api.mapbox.com/v4/${TILESET}/${z}/${x}/${y}.vector.pbf` +
    `?access_token=${accessToken}`;

  const response = await fetch(url, { signal });
  if (!response.ok) return null;

  const buffer = new Uint8Array(await response.arrayBuffer());
  const layer = new VectorTile(new PbfReader(buffer)).layers[BUILDING_LAYER];
  if (!layer) return null;

  const point: [number, number] = [coords.longitude, coords.latitude];
  let nearest: GeoJSON.Feature | null = null;
  let nearestDist = NEAREST_LIMIT_M;

  for (let i = 0; i < layer.length; i++) {
    const feature = layer.feature(i).toGeoJSON(x, y, z) as GeoJSON.Feature;
    const rings = outerRings(feature);
    for (const ring of rings) {
      if (pointInRing(point, ring)) return feature; // exact hit — done
      const d = metersBetween(point, ringCentroid(ring));
      if (d < nearestDist) {
        nearestDist = d;
        nearest = feature;
      }
    }
  }

  return nearest;
}
