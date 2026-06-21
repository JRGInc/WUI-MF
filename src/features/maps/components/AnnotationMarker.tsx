import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import type { AnnotationType, MapAnnotation, RiskLevel } from '@/shared/types';

const RISK_COLORS: Record<RiskLevel, string> = {
  low: '#22c55e',
  moderate: '#eab308',
  high: '#f97316',
  extreme: '#dc2626',
};

// A glyph per annotation type so the marker reads at a glance. Distinct from
// the house-shaped PropertyMarker — these are diamond tags.
const TYPE_GLYPH: Record<AnnotationType, string> = {
  'risk-marker': '▲',
  measurement: '↔',
  'photo-location': '◎',
  recommendation: '✓',
  note: '✎',
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Injected once for all annotation markers (PropertyMarker injects per-instance;
// these annotations can be numerous, so share a single stylesheet).
function ensureStyle() {
  if (document.getElementById('annotation-marker-style')) return;
  const style = document.createElement('style');
  style.id = 'annotation-marker-style';
  style.textContent = `
    .annotation-marker { cursor: pointer; display: flex; flex-direction: column; align-items: center; }
    .annotation-tag {
      width: 30px; height: 30px; border-radius: 8px 8px 8px 2px;
      transform: rotate(45deg);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      border: 2px solid rgba(255,255,255,0.85);
    }
    .annotation-glyph { transform: rotate(-45deg); color: #fff; font-size: 15px; line-height: 1; font-weight: 700; }
    .annotation-label {
      margin-top: 6px; padding: 1px 7px; background: rgba(17,24,20,0.85); color: #fff;
      border-radius: 4px; font-size: 11px; font-weight: 500; white-space: nowrap; max-width: 160px;
      overflow: hidden; text-overflow: ellipsis;
    }
  `;
  document.head.appendChild(style);
}

interface AnnotationMarkerProps {
  map: mapboxgl.Map | null;
  annotation: MapAnnotation;
  onClick?: () => void;
}

export function AnnotationMarker({ map, annotation, onClick }: AnnotationMarkerProps) {
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!map) return;
    ensureStyle();

    const risk = annotation.content.riskLevel ?? 'moderate';
    const color = RISK_COLORS[risk];
    const glyph = TYPE_GLYPH[annotation.annotationType] ?? '•';

    const el = document.createElement('div');
    el.className = 'annotation-marker';
    el.innerHTML = `
      <div class="annotation-tag" style="background:${color}">
        <span class="annotation-glyph">${glyph}</span>
      </div>
      <div class="annotation-label">${escapeHtml(annotation.content.title)}</div>
    `;
    if (onClick) el.addEventListener('click', onClick);

    markerRef.current = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([annotation.coordinates.longitude, annotation.coordinates.latitude])
      .addTo(map);

    return () => {
      markerRef.current?.remove();
    };
  }, [map, annotation, onClick]);

  return null;
}
