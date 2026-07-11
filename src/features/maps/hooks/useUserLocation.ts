import { useCallback, useEffect, useRef, useState } from 'react';
import type { GeoCoordinates } from '@/shared/types';

export interface UserLocation {
  coords: GeoCoordinates | null;
  accuracy: number | null; // meters
  error: string | null;
  // Starts (or restarts) the position watch. On iOS/WebKit the geolocation
  // prompt only appears for a request tied to a user gesture, so call this from
  // a tap (e.g. the Locate button) — the auto-start on mount is silently
  // ignored by iOS until then.
  request: () => void;
}

// Watches the device position. The browser shows its permission prompt on the
// first call — but iOS only surfaces it when the call originates from a user
// gesture, which is why the map exposes `request()` for the Locate button.
// Returns null coords until the first fix, or after a denial.
export function useUserLocation(enabled = true): UserLocation {
  const [location, setLocation] = useState<Omit<UserLocation, 'request'>>({
    coords: null,
    accuracy: null,
    error: null,
  });
  const watchIdRef = useRef<number | null>(null);

  const clearWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const request = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocation((prev) => ({ ...prev, error: 'Geolocation unavailable' }));
      return;
    }
    // Restart cleanly so a gesture-initiated call re-triggers the iOS prompt
    // rather than reusing a watch that never prompted.
    clearWatch();
    watchIdRef.current = navigator.geolocation.watchPosition(
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
  }, [clearWatch]);

  useEffect(() => {
    if (!enabled) return;
    // Auto-attempt: works on desktop/Android (and if permission is already
    // granted). iOS ignores this until `request()` is called from a gesture.
    request();
    return clearWatch;
  }, [enabled, request, clearWatch]);

  return { ...location, request };
}
