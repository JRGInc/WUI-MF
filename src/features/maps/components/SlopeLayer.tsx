import { useEffect, useRef } from 'react';
// `mapboxgl.Map` etc. resolve via mapbox-gl's UMD global type namespace —
// no value import needed in this file.
import { whenStyleReady } from '../utils/whenStyleReady';

interface SlopeLayerProps {
  map: mapboxgl.Map | null;
  visible: boolean;
  opacity?: number;
}

// USGS 3DEP elevation, served as a public ArcGIS ImageServer. Its "Slope Map"
// raster function renders steepness as a colormap (flat = pale, steep =
// red-brown) — directly relevant to fire behavior, which accelerates upslope.
// The service is natively EPSG:3857 and exports PNG via exportImage, so Mapbox
// can consume it as a raster source with the `{bbox-epsg-3857}` token.
// Coverage is CONUS (plus HI/territories); no key required. Verified live.
const DEP3_IMAGESERVER_URL =
  'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage';
// URL-encoded {"rasterFunction":"Slope Map"} — one of the service's named
// raster functions (confirmed via the ImageServer metadata).
const SLOPE_RENDERING_RULE = '%7B%22rasterFunction%22%3A%22Slope%20Map%22%7D';

const SLOPE_TILE_URL =
  `${DEP3_IMAGESERVER_URL}?bbox={bbox-epsg-3857}` +
  `&bboxSR=3857&imageSR=3857&size=256,256` +
  `&format=png&transparent=true&f=image` +
  `&renderingRule=${SLOPE_RENDERING_RULE}`;

export function SlopeLayer({ map, visible, opacity = 0.5 }: SlopeLayerProps) {
  // Latest props for the (possibly deferred) addLayer call, so the layer is
  // created with the correct initial visibility/opacity even if whenStyleReady
  // defers until after a prop change.
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;

  useEffect(() => {
    if (!map) return;

    const addLayer = () => {
      const visibility = visibleRef.current ? 'visible' : 'none';

      if (!map.getSource('slope')) {
        map.addSource('slope', {
          type: 'raster',
          tiles: [SLOPE_TILE_URL],
          tileSize: 256,
          attribution: 'Elevation: USGS 3DEP',
        });
      }

      if (!map.getLayer('slope-layer')) {
        // Insert beneath the base style's first symbol layer so place labels
        // stay readable, and so the app's vector overlays render on top.
        const firstSymbolId = map
          .getStyle()
          ?.layers?.find((l) => l.type === 'symbol')?.id;

        map.addLayer(
          {
            id: 'slope-layer',
            type: 'raster',
            source: 'slope',
            layout: { visibility },
            paint: { 'raster-opacity': opacityRef.current },
          },
          firstSymbolId
        );
      }
    };

    const cancel = whenStyleReady(map, addLayer);

    return () => {
      cancel();
      if (map.getLayer('slope-layer')) {
        map.removeLayer('slope-layer');
      }
      if (map.getSource('slope')) {
        map.removeSource('slope');
      }
    };
  }, [map]);

  // Update visibility
  useEffect(() => {
    if (!map) return;
    if (map.getLayer('slope-layer')) {
      map.setLayoutProperty(
        'slope-layer',
        'visibility',
        visible ? 'visible' : 'none'
      );
    }
  }, [map, visible]);

  // Update opacity
  useEffect(() => {
    if (!map) return;
    if (map.getLayer('slope-layer')) {
      map.setPaintProperty('slope-layer', 'raster-opacity', opacity);
    }
  }, [map, opacity]);

  return null;
}
