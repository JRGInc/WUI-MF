import type { GeoCoordinates } from '@/shared/types';
import { fetchBuildingFootprint } from '@/shared/utils/buildingFootprint';

/** The slice of mapboxgl.Map the footprint lookup needs (fakeable in tests). */
export interface FootprintMap {
  project(lngLat: [number, number]): { x: number; y: number };
  queryRenderedFeatures(
    box: [[number, number], [number, number]]
  ): { sourceLayer?: string; geometry: GeoJSON.Geometry }[];
}

/**
 * The building footprint the map is currently drawing under a point, if any.
 * Only styles that render buildings can answer: Streets and Outdoors do from
 * zoom 15, but Satellite (satellite-streets-v12) has no building layer at all.
 */
export function renderedFootprintAt(map: FootprintMap, coords: GeoCoordinates): GeoJSON.Feature | null {
  const p = map.project([coords.longitude, coords.latitude]);
  const pad = 12; // small pixel box, to catch a footprint the point sits just off
  let feats;
  try {
    feats = map.queryRenderedFeatures([
      [p.x - pad, p.y - pad],
      [p.x + pad, p.y + pad],
    ]);
  } catch {
    return null;
  }
  const building = feats.find(
    (f) =>
      f.sourceLayer === 'building' &&
      (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')
  );
  return building ? { type: 'Feature', properties: {}, geometry: building.geometry } : null;
}

/**
 * The footprint to draw defensible-space zones around: the rendered one when
 * the style draws buildings, otherwise the same Mapbox Streets data fetched as
 * a vector tile (what the AR view uses). The fallback makes outlines work on
 * Satellite and at low zoom. null → keep the circles.
 */
export async function findFootprint(
  map: FootprintMap,
  coords: GeoCoordinates,
  accessToken: string,
  fetchOffMap: typeof fetchBuildingFootprint = fetchBuildingFootprint
): Promise<GeoJSON.Feature | null> {
  const rendered = renderedFootprintAt(map, coords);
  if (rendered) return rendered;
  try {
    return await fetchOffMap(coords, accessToken);
  } catch {
    return null; // offline / tile error: circles stay
  }
}
