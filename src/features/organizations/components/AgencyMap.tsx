import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useTheme } from '@/app/providers/ThemeProvider';
import { PROGRESS_BAND_COLORS, type ProgressBand } from '../agencyRollup';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

const SOURCE = 'agency-properties';
const LAYER = 'agency-properties-circles';

interface AgencyMapProps {
  features: GeoJSON.FeatureCollection<GeoJSON.Point>;
  onSelect: (assessmentId: string) => void;
}

/**
 * Submitted properties as points coloured by mitigation progress band. Points
 * are property locations, not parcel boundaries (no parcel geometry yet).
 */
export function AgencyMap({ features, onSelect }: AgencyMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!container.current) return;
    const m = new mapboxgl.Map({
      container: container.current,
      style:
        resolvedTheme === 'dark'
          ? 'mapbox://styles/mapbox/dark-v11'
          : 'mapbox://styles/mapbox/light-v11',
      center: [-98.5, 39.8],
      zoom: 3,
    });
    map.current = m;
    m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

    m.on('load', () => {
      m.addSource(SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      const color: mapboxgl.Expression = ['match', ['get', 'band']];
      for (const [band, hex] of Object.entries(PROGRESS_BAND_COLORS) as [ProgressBand, string][]) {
        color.push(band, hex);
      }
      color.push('#6b7280');
      m.addLayer({
        id: LAYER,
        type: 'circle',
        source: SOURCE,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 5, 12, 9, 16, 12],
          'circle-color': color,
          'circle-stroke-width': 2,
          'circle-stroke-color': resolvedTheme === 'dark' ? '#111827' : '#ffffff',
        },
      });
      m.on('click', LAYER, (e) => {
        const id = e.features?.[0]?.properties?.assessmentId;
        if (typeof id === 'string') onSelectRef.current(id);
      });
      m.on('mouseenter', LAYER, () => (m.getCanvas().style.cursor = 'pointer'));
      m.on('mouseleave', LAYER, () => (m.getCanvas().style.cursor = ''));

      const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false, offset: 10 });
      m.on('mousemove', LAYER, (e) => {
        const f = e.features?.[0];
        if (!f || f.geometry.type !== 'Point') return;
        const p = f.properties ?? {};
        const text = document.createElement('div');
        text.className = 'text-xs text-gray-900';
        text.textContent = `${p.address} · ${p.done}/${p.total} done`;
        popup
          .setLngLat(f.geometry.coordinates as [number, number])
          .setDOMContent(text)
          .addTo(m);
      });
      m.on('mouseleave', LAYER, () => popup.remove());

      m.fire('agency:ready');
    });

    return () => {
      m.remove();
      map.current = null;
    };
  }, [resolvedTheme]);

  // Push data (and fit to it) whenever it changes, once the style has loaded.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const apply = () => {
      const source = m.getSource(SOURCE) as mapboxgl.GeoJSONSource | undefined;
      if (!source) return;
      source.setData(features);
      if (features.features.length === 0) return;
      const bounds = new mapboxgl.LngLatBounds();
      for (const f of features.features) bounds.extend(f.geometry.coordinates as [number, number]);
      m.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 0 });
    };
    if (m.getSource(SOURCE)) apply();
    else m.once('agency:ready', apply);
  }, [features, resolvedTheme]);

  return (
    <div
      ref={container}
      className="h-72 sm:h-96 w-full rounded-lg overflow-hidden"
      role="region"
      aria-label="Map of submitted properties coloured by mitigation progress"
    />
  );
}
