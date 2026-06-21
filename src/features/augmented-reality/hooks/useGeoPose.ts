import { useCallback, useEffect, useRef, useState } from 'react';
import type { GeoCoordinates } from '@/shared/types';

/**
 * Device geo-pose for location-based AR: where the phone is (GPS) and which way
 * it points (compass heading). This is the enabler the Map ⇄ AR bridge needs —
 * geoEnu turns an annotation's lat/lng into a local position only once we know
 * the user's position and heading.
 *
 * Heading is degrees clockwise from true north. iOS exposes it directly via
 * `webkitCompassHeading`; elsewhere we derive it from `deviceorientationabsolute`
 * `alpha`. iOS also gates orientation behind a user-gesture permission, so call
 * `requestPermission()` from a tap before relying on heading.
 */

export interface GeoPose {
  coords: GeoCoordinates | null;
  accuracy: number | null; // GPS horizontal accuracy, metres
  heading: number | null; // degrees from true north, clockwise
  headingAccuracy: number | null;
  // Device tilt for AR pitch/roll. beta ≈ 90° when the phone is held upright
  // facing the horizon; gamma is left/right roll. Both in degrees.
  beta: number | null;
  gamma: number | null;
  permission: 'unknown' | 'granted' | 'denied' | 'unsupported';
  error: string | null;
}

interface OrientationEventIOS extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
}

type DeviceOrientationEventStatic = {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

export function useGeoPose(enabled: boolean) {
  const [pose, setPose] = useState<GeoPose>({
    coords: null,
    accuracy: null,
    heading: null,
    headingAccuracy: null,
    beta: null,
    gamma: null,
    permission: 'unknown',
    error: null,
  });

  const watchIdRef = useRef<number | null>(null);

  // --- orientation handler (shared by both event names) ---
  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    const e = event as OrientationEventIOS;
    let heading: number | null = null;
    let headingAccuracy: number | null = null;

    if (typeof e.webkitCompassHeading === 'number') {
      // iOS: already degrees clockwise from true north.
      heading = e.webkitCompassHeading;
      headingAccuracy = e.webkitCompassAccuracy ?? null;
    } else if (typeof e.alpha === 'number' && e.absolute) {
      // Spec: alpha is degrees counter-clockwise from north → convert.
      heading = (360 - e.alpha) % 360;
    }

    const beta = typeof e.beta === 'number' ? e.beta : null;
    const gamma = typeof e.gamma === 'number' ? e.gamma : null;

    setPose((prev) => ({
      ...prev,
      heading: heading ?? prev.heading,
      headingAccuracy: heading !== null ? headingAccuracy : prev.headingAccuracy,
      beta: beta ?? prev.beta,
      gamma: gamma ?? prev.gamma,
    }));
  }, []);

  // --- request iOS motion/orientation permission (must be called from a gesture) ---
  const requestPermission = useCallback(async (): Promise<boolean> => {
    const DOE = (window as unknown as { DeviceOrientationEvent?: DeviceOrientationEventStatic })
      .DeviceOrientationEvent;

    if (DOE && typeof DOE.requestPermission === 'function') {
      try {
        const result = await DOE.requestPermission();
        const granted = result === 'granted';
        setPose((prev) => ({ ...prev, permission: granted ? 'granted' : 'denied' }));
        return granted;
      } catch {
        setPose((prev) => ({ ...prev, permission: 'denied' }));
        return false;
      }
    }
    // Non-iOS: no explicit permission required.
    setPose((prev) => ({ ...prev, permission: 'granted' }));
    return true;
  }, []);

  // --- GPS watch ---
  useEffect(() => {
    if (!enabled) return;
    if (!('geolocation' in navigator)) {
      setPose((prev) => ({ ...prev, permission: 'unsupported', error: 'Geolocation unavailable' }));
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setPose((prev) => ({
          ...prev,
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            altitude: position.coords.altitude ?? undefined,
          },
          accuracy: position.coords.accuracy,
          error: null,
        }));
      },
      (err) => setPose((prev) => ({ ...prev, error: err.message })),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled]);

  // --- orientation listeners ---
  useEffect(() => {
    if (!enabled) return;
    // Prefer the absolute variant (true north); fall back to the plain event.
    window.addEventListener('deviceorientationabsolute', handleOrientation as EventListener);
    window.addEventListener('deviceorientation', handleOrientation as EventListener);
    return () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientation as EventListener);
      window.removeEventListener('deviceorientation', handleOrientation as EventListener);
    };
  }, [enabled, handleOrientation]);

  return { ...pose, requestPermission };
}
