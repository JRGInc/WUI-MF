import { useEffect, useState } from 'react';
import type { GeoCoordinates } from '@/shared/types';

export interface UserLocation {
  coords: GeoCoordinates | null;
  accuracy: number | null; // meters
  error: string | null;
}

// Watches the device position (the browser shows its permission prompt on the
// first call). Returns null coords until the first fix, or after a denial.
export function useUserLocation(enabled = true): UserLocation {
  const [location, setLocation] = useState<UserLocation>({
    coords: null,
    accuracy: null,
    error: null,
  });

  useEffect(() => {
    if (!enabled || !('geolocation' in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          accuracy: position.coords.accuracy,
          error: null,
        });
      },
      (err) => {
        // Denied or unavailable — the map simply stays on its default center.
        setLocation((prev) => ({ ...prev, error: err.message }));
      },
      { enableHighAccuracy: true, maximumAge: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled]);

  return location;
}
