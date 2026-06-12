import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import type { GeoCoordinates } from '@/shared/types';

interface UserLocationMarkerProps {
  map: mapboxgl.Map | null;
  coordinates: GeoCoordinates;
}

// Classic blue "you are here" dot. The marker is created once and moved with
// setLngLat on updates so the pulse animation doesn't restart on every GPS fix.
export function UserLocationMarker({ map, coordinates }: UserLocationMarkerProps) {
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!map) return;

    const el = document.createElement('div');
    el.innerHTML = `
      <div class="user-location-marker">
        <div class="user-location-pulse"></div>
        <div class="user-location-dot"></div>
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      .user-location-marker {
        position: relative;
        width: 22px;
        height: 22px;
      }
      .user-location-dot {
        position: absolute;
        inset: 4px;
        border-radius: 50%;
        background: #3b82f6;
        border: 2px solid white;
        box-shadow: 0 1px 4px rgba(0,0,0,0.4);
      }
      .user-location-pulse {
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background: rgba(59, 130, 246, 0.4);
        animation: user-location-pulse 2.5s ease-out infinite;
      }
      @keyframes user-location-pulse {
        0% { transform: scale(0.6); opacity: 1; }
        100% { transform: scale(2.2); opacity: 0; }
      }
    `;
    document.head.appendChild(style);

    markerRef.current = new mapboxgl.Marker({ element: el })
      .setLngLat([coordinates.longitude, coordinates.latitude])
      .addTo(map);

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      style.remove();
    };
    // Created once per map; position updates are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    markerRef.current?.setLngLat([coordinates.longitude, coordinates.latitude]);
  }, [coordinates.latitude, coordinates.longitude]);

  return null;
}
