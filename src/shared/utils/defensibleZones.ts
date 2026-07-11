import buffer from '@turf/buffer';
import type { GeoCoordinates } from '@/shared/types';

/**
 * Defensible-space zone geometry, shared by the Risk Map and the AR view so both
 * draw *identical* zones (per CAL FIRE PRC 4291). Zones are measured outward from
 * the structure: 0–5 ft (Zone 0), 5–30 ft (Zone 1), 30–100 ft (Zone 2).
 *
 * Two builders: `footprintZoneFeatures` buffers a real building footprint (the
 * accurate, shape-following version); `circleZoneFeatures` is the fallback around
 * a point when no footprint is available (rural, low zoom, missing map data).
 * Both return GeoJSON polygons carrying a numeric `zone` property (0/1/2),
 * ordered largest-first so the smaller, brighter zones render on top.
 */

export const DEFENSIBLE_ZONE_SPECS = [
  { zone: 0, radiusFeet: 5 },
  { zone: 1, radiusFeet: 30 },
  { zone: 2, radiusFeet: 100 },
] as const;

const FEET_TO_METERS = 0.3048;

// A closed circle polygon (64-gon) of `radiusMeters` around `center`. Kept local
// (rather than importing the maps-feature helper) so this util stays in the
// shared layer with no feature dependencies.
function circlePolygon(
  center: GeoCoordinates,
  radiusMeters: number,
  properties: GeoJSON.GeoJsonProperties = {}
): GeoJSON.Feature {
  const segments = 64;
  const ring: number[][] = [];
  const latRad = (center.latitude * Math.PI) / 180;
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * 2 * Math.PI;
    const dx = radiusMeters * Math.cos(angle);
    const dy = radiusMeters * Math.sin(angle);
    const lat = center.latitude + dy / 111320;
    const lng = center.longitude + dx / (111320 * Math.cos(latRad));
    ring.push([lng, lat]);
  }
  return { type: 'Feature', properties, geometry: { type: 'Polygon', coordinates: [ring] } };
}

/** Concentric-circle zones around a point — the no-footprint fallback. */
export function circleZoneFeatures(center: GeoCoordinates): GeoJSON.Feature[] {
  return DEFENSIBLE_ZONE_SPECS.map(({ zone, radiusFeet }) =>
    circlePolygon(center, radiusFeet * FEET_TO_METERS, { zone })
  ).reverse();
}

/**
 * Structure-shaped zones: buffer the building footprint outward by each zone
 * distance so the rings follow the building outline. Returns `[]` if buffering
 * fails (degenerate geometry), so callers can keep the circle fallback.
 */
export function footprintZoneFeatures(footprint: GeoJSON.Feature): GeoJSON.Feature[] {
  const out: GeoJSON.Feature[] = [];
  for (const { zone, radiusFeet } of DEFENSIBLE_ZONE_SPECS) {
    const buffered = buffer(
      footprint as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
      radiusFeet,
      { units: 'feet' }
    );
    if (!buffered) return [];
    out.push({ ...(buffered as GeoJSON.Feature), properties: { zone } });
  }
  return out.reverse();
}

/** The outer ring (lng/lat pairs) of a zone polygon, or null if not a polygon. */
export function zoneOuterRing(feature: GeoJSON.Feature): number[][] | null {
  const g = feature.geometry;
  if (g.type === 'Polygon') return g.coordinates[0] ?? null;
  if (g.type === 'MultiPolygon') return g.coordinates[0]?.[0] ?? null;
  return null;
}
