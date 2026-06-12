import { useState, useCallback } from 'react';
import type { MapLayer } from '@/shared/types';

const DEFAULT_LAYERS: MapLayer[] = [
  {
    id: 'defensible-zones',
    name: 'Defensible Space',
    type: 'risk-zone',
    visible: true,
    opacity: 1,
  },
  {
    id: 'fire-history',
    name: 'Fire History',
    type: 'fire-history',
    visible: false,
    opacity: 0.7,
  },
  {
    id: 'vegetation',
    name: 'Vegetation/Fuel',
    type: 'vegetation',
    visible: false,
    opacity: 0.6,
  },
  {
    id: 'terrain',
    name: 'Slope Analysis',
    type: 'terrain',
    visible: false,
    opacity: 0.5,
  },
];

export function useMapLayers() {
  const [layers, setLayers] = useState<MapLayer[]>(DEFAULT_LAYERS);

  const toggleLayer = useCallback((layerId: string) => {
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
      )
    );
  }, []);

  const setLayerOpacity = useCallback((layerId: string, opacity: number) => {
    setLayers((prev) =>
      prev.map((layer) =>
        layer.id === layerId ? { ...layer, opacity: Math.max(0, Math.min(1, opacity)) } : layer
      )
    );
  }, []);

  const addLayer = useCallback((layer: MapLayer) => {
    setLayers((prev) => {
      if (prev.some((l) => l.id === layer.id)) {
        return prev;
      }
      return [...prev, layer];
    });
  }, []);

  const removeLayer = useCallback((layerId: string) => {
    setLayers((prev) => prev.filter((l) => l.id !== layerId));
  }, []);

  const addFireHistoryLayer = useCallback(
    (map: mapboxgl.Map | null) => {
      if (!map) return;

      // Add fire history data source (placeholder - would use real CalFire data)
      if (!map.getSource('fire-history')) {
        map.addSource('fire-history', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [], // Would be populated with actual fire perimeter data
          },
        });

        map.addLayer({
          id: 'fire-history-fill',
          type: 'fill',
          source: 'fire-history',
          paint: {
            'fill-color': [
              'interpolate',
              ['linear'],
              ['get', 'year'],
              2000,
              '#fee2e2',
              2010,
              '#fca5a5',
              2020,
              '#ef4444',
              2024,
              '#991b1b',
            ],
            'fill-opacity': 0.5,
          },
        });

        map.addLayer({
          id: 'fire-history-outline',
          type: 'line',
          source: 'fire-history',
          paint: {
            'line-color': '#991b1b',
            'line-width': 1,
          },
        });
      }
    },
    []
  );

  const addRiskZoneLayer = useCallback(
    (map: mapboxgl.Map | null, riskData: GeoJSON.FeatureCollection) => {
      if (!map) return;

      if (!map.getSource('risk-zones')) {
        map.addSource('risk-zones', {
          type: 'geojson',
          data: riskData,
        });

        map.addLayer({
          id: 'risk-zones-fill',
          type: 'fill',
          source: 'risk-zones',
          paint: {
            'fill-color': [
              'match',
              ['get', 'riskLevel'],
              'extreme',
              '#dc2626',
              'high',
              '#f97316',
              'moderate',
              '#eab308',
              'low',
              '#22c55e',
              '#gray',
            ],
            'fill-opacity': 0.4,
          },
        });
      }
    },
    []
  );

  const addVegetationLayer = useCallback(
    (map: mapboxgl.Map | null) => {
      if (!map) return;

      // Add LANDFIRE vegetation data (placeholder)
      if (!map.getSource('vegetation')) {
        map.addSource('vegetation', {
          type: 'raster',
          tiles: [
            // Would use actual LANDFIRE tiles
            'https://api.example.com/vegetation/{z}/{x}/{y}.png',
          ],
          tileSize: 256,
        });

        map.addLayer({
          id: 'vegetation-layer',
          type: 'raster',
          source: 'vegetation',
          paint: {
            'raster-opacity': 0.6,
          },
        });
      }
    },
    []
  );

  const addTerrainLayer = useCallback(
    (map: mapboxgl.Map | null) => {
      if (!map) return;

      // Add terrain/slope analysis
      map.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
        maxzoom: 14,
      });

      map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
    },
    []
  );

  const getVisibleLayers = useCallback(() => {
    return layers.filter((l) => l.visible);
  }, [layers]);

  const getLayerById = useCallback(
    (id: string) => {
      return layers.find((l) => l.id === id);
    },
    [layers]
  );

  return {
    layers,
    toggleLayer,
    setLayerOpacity,
    addLayer,
    removeLayer,
    addFireHistoryLayer,
    addRiskZoneLayer,
    addVegetationLayer,
    addTerrainLayer,
    getVisibleLayers,
    getLayerById,
  };
}
