import { useEffect, useRef } from 'react';
// `mapboxgl.Map` etc. resolve via mapbox-gl's UMD global type namespace.
import { createCircleFeature } from '../utils/geo';
import { whenStyleReady } from '../utils/whenStyleReady';
import type { GeoCoordinates } from '@/shared/types';

interface UserAccuracyCircleProps {
  map: mapboxgl.Map | null;
  coordinates: GeoCoordinates;
  accuracy: number | null; // meters; null/0 hides the circle
}

const SOURCE_ID = 'user-location-accuracy';
const LAYER_IDS = [`${SOURCE_ID}-fill`, `${SOURCE_ID}-outline`];

function circleData(
  coordinates: GeoCoordinates,
  accuracy: number | null
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features:
      accuracy && accuracy > 0 ? [createCircleFeature(coordinates, accuracy)] : [],
  };
}

// GPS-uncertainty halo around the user-location dot, sized in real meters so
// it scales with zoom. Mount keyed by styleVersion (like FireHistoryLayer) —
// style switches wipe the source/layers and the remount re-adds them.
export function UserAccuracyCircle({
  map,
  coordinates,
  accuracy,
}: UserAccuracyCircleProps) {
  // Latest values for a deferred addLayer call.
  const dataRef = useRef(circleData(coordinates, accuracy));
  dataRef.current = circleData(coordinates, accuracy);

  useEffect(() => {
    if (!map) return;

    const addLayer = () => {
      if (map.getSource(SOURCE_ID)) return;
      map.addSource(SOURCE_ID, { type: 'geojson', data: dataRef.current });
      map.addLayer({
        id: `${SOURCE_ID}-fill`,
        type: 'fill',
        source: SOURCE_ID,
        paint: {
          'fill-color': '#3b82f6',
          'fill-opacity': 0.12,
        },
      });
      map.addLayer({
        id: `${SOURCE_ID}-outline`,
        type: 'line',
        source: SOURCE_ID,
        paint: {
          'line-color': '#3b82f6',
          'line-opacity': 0.35,
          'line-width': 1,
        },
      });
    };

    const cancel = whenStyleReady(map, addLayer);

    return () => {
      cancel();
      LAYER_IDS.forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    };
  }, [map]);

  // Follow position/accuracy updates.
  useEffect(() => {
    const source = map?.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    source?.setData(circleData(coordinates, accuracy));
  }, [map, coordinates, accuracy]);

  return null;
}
