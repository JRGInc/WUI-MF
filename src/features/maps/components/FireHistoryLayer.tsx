import { useEffect, useRef } from 'react';
// `mapboxgl.Map` etc. resolve via mapbox-gl's UMD global type namespace —
// no value import needed in this file.
import { whenStyleReady } from '../utils/whenStyleReady';

interface FireHistoryLayerProps {
  map: mapboxgl.Map | null;
  visible: boolean;
  opacity?: number;
}

// Sample fire history data (would be fetched from CalFire API in production)
const SAMPLE_FIRE_DATA: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        name: 'Sample Fire 2023',
        year: 2023,
        acres: 5000,
        cause: 'Lightning',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-118.3, 34.1],
            [-118.2, 34.1],
            [-118.2, 34.0],
            [-118.3, 34.0],
            [-118.3, 34.1],
          ],
        ],
      },
    },
  ],
};

export function FireHistoryLayer({
  map,
  visible,
  opacity = 0.5,
}: FireHistoryLayerProps) {
  // Latest props for the (possibly deferred) addLayer call, so layers are
  // created with the correct initial visibility/opacity.
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;

  useEffect(() => {
    if (!map) return;

    const addLayer = () => {
      const visibility = visibleRef.current ? 'visible' : 'none';
      // Add source if it doesn't exist
      if (!map.getSource('fire-history')) {
        map.addSource('fire-history', {
          type: 'geojson',
          data: SAMPLE_FIRE_DATA,
        });
      }

      // Add fill layer if it doesn't exist
      if (!map.getLayer('fire-history-fill')) {
        map.addLayer({
          id: 'fire-history-fill',
          type: 'fill',
          source: 'fire-history',
          layout: { visibility },
          paint: {
            'fill-color': [
              'interpolate',
              ['linear'],
              ['get', 'year'],
              2015,
              '#fde68a',
              2018,
              '#fb923c',
              2021,
              '#ef4444',
              2024,
              '#7f1d1d',
            ],
            'fill-opacity': opacityRef.current,
          },
        });
      }

      // Add outline layer if it doesn't exist
      if (!map.getLayer('fire-history-outline')) {
        map.addLayer({
          id: 'fire-history-outline',
          type: 'line',
          source: 'fire-history',
          layout: { visibility },
          paint: {
            'line-color': '#7f1d1d',
            'line-width': 2,
          },
        });
      }

      // Add labels
      if (!map.getLayer('fire-history-labels')) {
        map.addLayer({
          id: 'fire-history-labels',
          type: 'symbol',
          source: 'fire-history',
          layout: {
            visibility,
            'text-field': ['concat', ['get', 'name'], '\n', ['get', 'acres'], ' acres'],
            'text-size': 12,
            'text-anchor': 'center',
          },
          paint: {
            'text-color': '#1f2937',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1,
          },
        });
      }
    };

    const cancel = whenStyleReady(map, addLayer);

    return () => {
      cancel();
      if (map.getLayer('fire-history-fill')) {
        map.removeLayer('fire-history-fill');
      }
      if (map.getLayer('fire-history-outline')) {
        map.removeLayer('fire-history-outline');
      }
      if (map.getLayer('fire-history-labels')) {
        map.removeLayer('fire-history-labels');
      }
      if (map.getSource('fire-history')) {
        map.removeSource('fire-history');
      }
    };
  }, [map]);

  // Update visibility
  useEffect(() => {
    if (!map) return;

    const setVisibility = (visibility: 'visible' | 'none') => {
      if (map.getLayer('fire-history-fill')) {
        map.setLayoutProperty('fire-history-fill', 'visibility', visibility);
      }
      if (map.getLayer('fire-history-outline')) {
        map.setLayoutProperty('fire-history-outline', 'visibility', visibility);
      }
      if (map.getLayer('fire-history-labels')) {
        map.setLayoutProperty('fire-history-labels', 'visibility', visibility);
      }
    };

    // getLayer guards make this safe to call regardless of load state.
    setVisibility(visible ? 'visible' : 'none');
  }, [map, visible]);

  // Update opacity
  useEffect(() => {
    if (!map) return;

    if (map.getLayer('fire-history-fill')) {
      map.setPaintProperty('fire-history-fill', 'fill-opacity', opacity);
    }
  }, [map, opacity]);

  return null;
}

// Utility function to fetch real fire history data
export async function fetchFireHistoryData(
  _bounds: mapboxgl.LngLatBounds
): Promise<GeoJSON.FeatureCollection> {
  // In production, this would fetch from CalFire API
  // Example: https://services1.arcgis.com/jUJYIo9tSQP5EBKK/arcgis/rest/services/California_Fire_Perimeters/FeatureServer

  return SAMPLE_FIRE_DATA;
}
