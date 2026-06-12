import type { GeoCoordinates } from '@/shared/types';

// Approximate a metric circle as a GeoJSON polygon. The equirectangular
// meters→degrees conversion is plenty accurate at property/neighborhood scale.
export function createCircleFeature(
  center: GeoCoordinates,
  radiusMeters: number,
  properties: GeoJSON.GeoJsonProperties = {}
): GeoJSON.Feature {
  const points = 64;
  const coordinates: number[][] = [];

  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dx = radiusMeters * Math.cos(angle);
    const dy = radiusMeters * Math.sin(angle);

    const lat = center.latitude + dy / 111320;
    const lng =
      center.longitude + dx / (111320 * Math.cos((center.latitude * Math.PI) / 180));

    coordinates.push([lng, lat]);
  }

  return {
    type: 'Feature',
    properties,
    geometry: {
      type: 'Polygon',
      coordinates: [coordinates],
    },
  };
}
