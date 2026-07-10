import { useEffect, useRef } from 'react';
// `mapboxgl.Map` etc. resolve via mapbox-gl's UMD global type namespace —
// no value import needed in this file.
import { whenStyleReady } from '../utils/whenStyleReady';

interface VegetationLayerProps {
  map: mapboxgl.Map | null;
  visible: boolean;
  opacity?: number;
}

// LANDFIRE (USGS/USFS) Scott & Burgan 40 Fire Behavior Fuel Models, served as a
// public GeoServer WMS. We request Web Mercator (EPSG:3857) tiles so Mapbox can
// consume the WMS directly as a raster source via the `{bbox-epsg-3857}` token
// — verified to return PNG colormap tiles. Coverage is CONUS only.
const LANDFIRE_WMS_URL =
  'https://edcintl.cr.usgs.gov/geoserver/landfire/conus_sf/ows';
// Summer FBFM40 (2025). The seasonal-fuels workspace exposes early-season /
// spring / summer variants; summer is the most representative default.
const LANDFIRE_FUEL_LAYER = 'LF2025_FBFM40_SU26';

const VEGETATION_TILE_URL =
  `${LANDFIRE_WMS_URL}?service=WMS&version=1.1.1&request=GetMap` +
  `&layers=${LANDFIRE_FUEL_LAYER}&styles=` +
  `&bbox={bbox-epsg-3857}&width=256&height=256&srs=EPSG:3857` +
  `&format=image/png&transparent=true`;

export function VegetationLayer({
  map,
  visible,
  opacity = 0.6,
}: VegetationLayerProps) {
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

      if (!map.getSource('vegetation')) {
        map.addSource('vegetation', {
          type: 'raster',
          tiles: [VEGETATION_TILE_URL],
          tileSize: 256,
          attribution: 'Fuel data: LANDFIRE / USGS',
        });
      }

      if (!map.getLayer('vegetation-layer')) {
        // Insert beneath the base style's first symbol layer so place labels
        // stay readable, and so the app's vector overlays (fire perimeters,
        // defensible zones) — added without a beforeId — render on top.
        const firstSymbolId = map
          .getStyle()
          ?.layers?.find((l) => l.type === 'symbol')?.id;

        map.addLayer(
          {
            id: 'vegetation-layer',
            type: 'raster',
            source: 'vegetation',
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
      if (map.getLayer('vegetation-layer')) {
        map.removeLayer('vegetation-layer');
      }
      if (map.getSource('vegetation')) {
        map.removeSource('vegetation');
      }
    };
  }, [map]);

  // Update visibility
  useEffect(() => {
    if (!map) return;
    if (map.getLayer('vegetation-layer')) {
      map.setLayoutProperty(
        'vegetation-layer',
        'visibility',
        visible ? 'visible' : 'none'
      );
    }
  }, [map, visible]);

  // Update opacity
  useEffect(() => {
    if (!map) return;
    if (map.getLayer('vegetation-layer')) {
      map.setPaintProperty('vegetation-layer', 'raster-opacity', opacity);
    }
  }, [map, opacity]);

  return null;
}
