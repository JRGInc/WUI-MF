import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import type { GeoCoordinates, RiskLevel } from '@/shared/types';

interface PropertyMarkerProps {
  map: mapboxgl.Map | null;
  coordinates: GeoCoordinates;
  riskLevel?: RiskLevel;
  label?: string;
  onClick?: () => void;
}

export function PropertyMarker({
  map,
  coordinates,
  riskLevel = 'moderate',
  label,
  onClick,
}: PropertyMarkerProps) {
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!map) return;

    // Create marker element
    const el = document.createElement('div');
    el.className = 'property-marker';
    el.innerHTML = `
      <div class="marker-container ${getRiskClass(riskLevel)}">
        <div class="marker-pulse"></div>
        <div class="marker-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
            <path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.06l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.061 1.06l8.69-8.69z" />
            <path d="M12 5.432l8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.625a1.875 1.875 0 01-1.875-1.875v-6.198a2.29 2.29 0 00.091-.086L12 5.43z" />
          </svg>
        </div>
        ${label ? `<div class="marker-label">${label}</div>` : ''}
      </div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .property-marker {
        cursor: pointer;
      }
      .marker-container {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .marker-icon {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        z-index: 1;
      }
      .marker-icon svg {
        width: 24px;
        height: 24px;
      }
      .marker-pulse {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 60px;
        height: 60px;
        border-radius: 50%;
        animation: pulse 2s ease-out infinite;
      }
      .marker-label {
        margin-top: 4px;
        padding: 2px 8px;
        background: #ffffff;
        color: #1f2937;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 500;
        white-space: nowrap;
        box-shadow: 0 1px 4px rgba(0,0,0,0.2);
      }

      .marker-container.risk-low .marker-icon {
        background: #22c55e;
        color: white;
      }
      .marker-container.risk-low .marker-pulse {
        background: rgba(34, 197, 94, 0.3);
      }

      .marker-container.risk-moderate .marker-icon {
        background: #eab308;
        color: white;
      }
      .marker-container.risk-moderate .marker-pulse {
        background: rgba(234, 179, 8, 0.3);
      }

      .marker-container.risk-high .marker-icon {
        background: #f97316;
        color: white;
      }
      .marker-container.risk-high .marker-pulse {
        background: rgba(249, 115, 22, 0.3);
      }

      .marker-container.risk-extreme .marker-icon {
        background: #dc2626;
        color: white;
      }
      .marker-container.risk-extreme .marker-pulse {
        background: rgba(220, 38, 38, 0.3);
      }

      @keyframes pulse {
        0% {
          transform: translate(-50%, -50%) scale(0.5);
          opacity: 1;
        }
        100% {
          transform: translate(-50%, -50%) scale(1.5);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);

    if (onClick) {
      el.addEventListener('click', onClick);
    }

    // Create marker
    markerRef.current = new mapboxgl.Marker(el)
      .setLngLat([coordinates.longitude, coordinates.latitude])
      .addTo(map);

    return () => {
      markerRef.current?.remove();
      style.remove();
    };
  }, [map, coordinates, riskLevel, label, onClick]);

  return null;
}

function getRiskClass(level: RiskLevel): string {
  return `risk-${level}`;
}
