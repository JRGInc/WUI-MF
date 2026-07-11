import { useEffect, useRef } from 'react';
// `mapboxgl.Map` etc. resolve via mapbox-gl's UMD global type namespace —
// no value import needed in this file.
import { whenStyleReady } from '../utils/whenStyleReady';

interface FireHistoryLayerProps {
  map: mapboxgl.Map | null;
  visible: boolean;
  opacity?: number;
}

// Below this zoom the viewport bbox covers too much area — the query would blow
// past the service's 2000-record cap and return a huge payload for little
// visual value. We clear the layer instead.
const MIN_FETCH_ZOOM = 7;
// Cap how far back we pull, to keep payloads reasonable in dense fire regions.
const MIN_YEAR = 1990;
// Both services' maxRecordCount (confirmed via the layer metadata).
const MAX_RECORDS = 2000;
// Debounce viewport-change refetches so a pan/zoom gesture triggers one call.
const REFETCH_DEBOUNCE_MS = 500;

const EMPTY_FC: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
};

// A fire-perimeter FeatureServer, normalized to the props the layers render
// (name / year / acres). Both services answer anonymous `f=geojson` queries and
// use ArcGIS snake_case field names we map to the camelCase the paint/label
// expressions expect (see the CLAUDE.md note on the snake_case boundary).
interface FireSource {
  label: string;
  queryUrl: string;
  where: string;
  outFields: string;
  toProps: (p: Record<string, unknown>) => { name: string; year: number; acres: number };
}

// CAL FIRE (FRAP) statewide perimeters — the most CA-current dataset.
const CALFIRE_SOURCE: FireSource = {
  label: 'CAL FIRE',
  queryUrl:
    'https://services2.arcgis.com/cFEFS0EWrhfDeVw9/arcgis/rest/services/California_Fire_Perimeters/FeatureServer/1/query',
  where: `YEAR_ >= '${MIN_YEAR}'`, // YEAR_ is a string field
  outFields: 'YEAR_,FIRE_NAME,GIS_ACRES',
  toProps: (p) => ({
    name: (p.FIRE_NAME as string)?.trim() || 'Unnamed fire',
    year: Number(p.YEAR_) || 0,
    acres: Math.round((p.GIS_ACRES as number) ?? 0),
  }),
};

// NIFC / WFIGS InterAgencyFirePerimeterHistory — national coverage (and it
// already includes CalFire data, so CA fires still show near state borders).
const NIFC_SOURCE: FireSource = {
  label: 'NIFC',
  queryUrl:
    'https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/InterAgencyFirePerimeterHistory_All_Years_View/FeatureServer/0/query',
  where: `FIRE_YEAR_INT >= ${MIN_YEAR}`, // numeric year field
  outFields: 'INCIDENT,FIRE_YEAR_INT,GIS_ACRES',
  toProps: (p) => ({
    name: (p.INCIDENT as string)?.trim() || 'Unnamed fire',
    year: Number(p.FIRE_YEAR_INT) || 0,
    acres: Math.round((p.GIS_ACRES as number) ?? 0),
  }),
};

// California bounding box. When the whole viewport sits inside it, use CAL FIRE
// for the most CA-current perimeters; otherwise use NIFC's national history.
// NIFC includes CalFire data, so a border-straddling view still shows CA fires
// (sourced from NIFC) — no duplicate perimeters. Caveat: the CA bbox clips
// slivers of NV/AZ/OR, so a view deep inside CA near those corners could miss a
// few out-of-state fires; acceptable for a history overlay.
const CA_BBOX = { west: -124.5, south: 32.5, east: -114.1, north: 42.0 };

function sourceForBounds(bounds: mapboxgl.LngLatBounds): FireSource {
  const insideCalifornia =
    bounds.getWest() >= CA_BBOX.west &&
    bounds.getEast() <= CA_BBOX.east &&
    bounds.getSouth() >= CA_BBOX.south &&
    bounds.getNorth() <= CA_BBOX.north;
  return insideCalifornia ? CALFIRE_SOURCE : NIFC_SOURCE;
}

// Fetch perimeters intersecting `bounds` from the source appropriate to the
// region, normalized to the props the layers render. Throws on a non-OK
// response so callers can fall back to whatever is already on the map
// (important offline / in the field).
async function fetchFireHistoryData(
  bounds: mapboxgl.LngLatBounds,
  signal?: AbortSignal
): Promise<GeoJSON.FeatureCollection> {
  const source = sourceForBounds(bounds);
  const params = new URLSearchParams({
    where: source.where,
    geometry: `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`,
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: source.outFields,
    outSR: '4326',
    returnGeometry: 'true',
    geometryPrecision: '5', // trim coordinate decimals to shrink the payload
    resultRecordCount: String(MAX_RECORDS),
    f: 'geojson',
  });

  const response = await fetch(`${source.queryUrl}?${params.toString()}`, { signal });
  if (!response.ok) {
    throw new Error(`${source.label} request failed: ${response.status}`);
  }

  const raw = (await response.json()) as GeoJSON.FeatureCollection;
  const features = (raw.features ?? []).map((feature) => ({
    ...feature,
    properties: source.toProps((feature.properties ?? {}) as Record<string, unknown>),
  }));

  return { type: 'FeatureCollection', features };
}

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
  // Most recently fetched perimeters. Kept in a ref so addLayer (which may be
  // deferred to style.load) seeds the source with whatever we already have,
  // and so a style switch that rebuilds the source doesn't lose the data.
  const dataRef = useRef<GeoJSON.FeatureCollection>(EMPTY_FC);

  useEffect(() => {
    if (!map) return;

    const addLayer = () => {
      const visibility = visibleRef.current ? 'visible' : 'none';
      // Add source if it doesn't exist
      if (!map.getSource('fire-history')) {
        map.addSource('fire-history', {
          type: 'geojson',
          data: dataRef.current,
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
              1990,
              '#fde68a',
              2005,
              '#fbbf24',
              2015,
              '#f97316',
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
            'line-width': 1,
          },
        });
      }

      // Add labels
      if (!map.getLayer('fire-history-labels')) {
        map.addLayer({
          id: 'fire-history-labels',
          type: 'symbol',
          source: 'fire-history',
          minzoom: 9, // avoid label clutter when zoomed out
          layout: {
            visibility,
            'text-field': [
              'concat',
              ['get', 'name'],
              ' (',
              ['to-string', ['get', 'year']],
              ')',
            ],
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
      if (map.getLayer('fire-history-labels')) {
        map.removeLayer('fire-history-labels');
      }
      if (map.getLayer('fire-history-outline')) {
        map.removeLayer('fire-history-outline');
      }
      if (map.getLayer('fire-history-fill')) {
        map.removeLayer('fire-history-fill');
      }
      if (map.getSource('fire-history')) {
        map.removeSource('fire-history');
      }
    };
  }, [map]);

  // Fetch live CAL FIRE perimeters for the current viewport whenever the layer
  // is visible, and refetch (debounced) as the user pans/zooms. Only runs while
  // visible, so hidden layers cost no network — matters offline in the field.
  useEffect(() => {
    if (!map || !visible) return;

    const controller = new AbortController();
    let debounce: ReturnType<typeof setTimeout> | undefined;

    const applyData = (data: GeoJSON.FeatureCollection) => {
      dataRef.current = data;
      const source = map.getSource('fire-history') as
        | mapboxgl.GeoJSONSource
        | undefined;
      // If the source isn't ready yet (addLayer deferred to style.load),
      // dataRef seeds it when it is created.
      source?.setData(data);
    };

    const load = async () => {
      if (map.getZoom() < MIN_FETCH_ZOOM) {
        applyData(EMPTY_FC);
        return;
      }
      const bounds = map.getBounds();
      if (!bounds) return;
      try {
        const data = await fetchFireHistoryData(bounds, controller.signal);
        applyData(data);
      } catch (error) {
        // Offline or a service hiccup: keep whatever is already displayed.
        if ((error as Error).name !== 'AbortError') {
          console.warn('Failed to load CAL FIRE fire history:', error);
        }
      }
    };

    const onMoveEnd = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => void load(), REFETCH_DEBOUNCE_MS);
    };

    void load();
    map.on('moveend', onMoveEnd);

    return () => {
      controller.abort();
      clearTimeout(debounce);
      map.off('moveend', onMoveEnd);
    };
  }, [map, visible]);

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
