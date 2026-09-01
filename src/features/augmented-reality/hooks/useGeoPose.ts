import { useCallback, useEffect, useRef, useState } from 'react';
import type { GeoCoordinates } from '@/shared/types';
import {
  AngleSmoother,
  GpsFilter,
  HeadingFilter,
  clampHeadingTrim,
  fixToCoords,
  getScreenAngle,
  loadHeadingTrim,
  magneticDeclination,
  normalizeDeg,
  saveHeadingTrim,
} from '../utils/poseFilters';

/**
 * Device geo-pose for location-based AR: where the phone is (GPS) and which way
 * it points (compass heading). This is the enabler the Map ⇄ AR bridge needs —
 * geoEnu turns an annotation's lat/lng into a local position only once we know
 * the user's position and heading.
 *
 * Raw sensor values are filtered before they reach consumers (see poseFilters):
 * GPS fixes are accuracy-gated and blended, the compass is warm-up-averaged and
 * low-passed, and heading is corrected for magnetic declination and the screen
 * orientation angle. `heading` is therefore the true-north direction of the
 * camera view, valid in any screen orientation.
 *
 * Both compass sources are magnetic-north referenced — iOS exposes
 * `webkitCompassHeading` (magnetic, per Apple's docs), elsewhere we derive from
 * `deviceorientationabsolute` `alpha`. iOS also gates orientation behind a
 * user-gesture permission, so call `requestPermission()` from a tap before
 * relying on heading.
 */

export interface GeoPose {
  coords: GeoCoordinates | null; // filtered position
  accuracy: number | null; // GPS horizontal accuracy of the latest raw fix, metres
  heading: number | null; // smoothed true-north view heading, degrees clockwise
  headingAccuracy: number | null;
  // Smoothed device tilt for AR pitch/roll. beta ≈ 90° when the phone is held
  // upright facing the horizon; gamma is left/right roll. Both in degrees.
  beta: number | null;
  gamma: number | null;
  // Screen orientation angle (0 portrait / 90 / 180 / 270) the heading was
  // corrected with — camera math needs it to reconstruct device-frame angles.
  screenAngle: number;
  // Magnetic declination applied to heading (east-positive), null until the
  // model resolves (heading is magnetic-referenced in the meantime).
  declination: number | null;
  // User-dialed compass-bias correction (degrees, persisted per device),
  // already folded into `heading`.
  headingTrim: number;
  // Accepted GPS fixes at or under the accuracy gate — consumers use this to
  // decide when a geo anchor is trustworthy enough to freeze.
  goodFixCount: number;
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
    screenAngle: 0,
    declination: null,
    headingTrim: loadHeadingTrim(),
    goodFixCount: 0,
    permission: 'unknown',
    error: null,
  });

  const watchIdRef = useRef<number | null>(null);
  const gpsFilterRef = useRef(new GpsFilter());
  const headingFilterRef = useRef(new HeadingFilter());
  const betaSmootherRef = useRef(new AngleSmoother());
  const gammaSmootherRef = useRef(new AngleSmoother());
  // Once absolute orientation events flow, plain (non-absolute) events are
  // ignored entirely — previously both listeners wrote beta/gamma and the
  // relative event could overwrite the absolute one (last-writer-wins).
  const hasAbsoluteRef = useRef(false);
  const declinationRef = useRef<number | null>(null);
  const headingTrimRef = useRef(loadHeadingTrim());

  // Adjust the per-device compass-bias trim (relative delta, clamped ±30°,
  // persisted). The next orientation events pick it up via the ref; the
  // adaptive heading filter converges on small steps in a few frames.
  const adjustHeadingTrim = useCallback((deltaDeg: number) => {
    const next = clampHeadingTrim(headingTrimRef.current + deltaDeg);
    headingTrimRef.current = next;
    saveHeadingTrim(next);
    setPose((prev) => ({ ...prev, headingTrim: next }));
  }, []);

  // --- orientation handler (shared by both event names) ---
  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    const e = event as OrientationEventIOS;
    const isIOS = typeof e.webkitCompassHeading === 'number';

    if (e.type === 'deviceorientationabsolute' && typeof e.alpha === 'number') {
      hasAbsoluteRef.current = true;
    } else if (e.type === 'deviceorientation' && hasAbsoluteRef.current && !isIOS) {
      return; // absolute source is active; drop the relative duplicate
    }

    // Magnetic heading of the device top, degrees clockwise from magnetic north.
    let magHeading: number | null = null;
    let headingAccuracy: number | null = null;
    if (isIOS) {
      magHeading = e.webkitCompassHeading!;
      headingAccuracy = e.webkitCompassAccuracy ?? null;
    } else if (typeof e.alpha === 'number' && e.absolute) {
      // Spec: alpha is degrees counter-clockwise from north → convert.
      magHeading = (360 - e.alpha) % 360;
    }

    const screenAngle = getScreenAngle();
    let heading: number | null = null;
    if (magHeading !== null) {
      // True view heading: magnetic + declination + user trim, rotated into
      // the screen frame. Filtered in this (view) domain so a physical screen
      // rotation — where raw device heading and screen angle change together
      // but the view doesn't — stays continuous through the filter.
      const viewRaw = normalizeDeg(
        magHeading + (declinationRef.current ?? 0) + headingTrimRef.current + screenAngle
      );
      heading = headingFilterRef.current.push(viewRaw);
    }

    const beta = typeof e.beta === 'number' ? betaSmootherRef.current.push(e.beta) : null;
    const gamma = typeof e.gamma === 'number' ? gammaSmootherRef.current.push(e.gamma) : null;

    setPose((prev) => ({
      ...prev,
      heading: heading ?? prev.heading,
      headingAccuracy: heading !== null ? headingAccuracy : prev.headingAccuracy,
      beta: beta ?? prev.beta,
      gamma: gamma ?? prev.gamma,
      screenAngle,
      declination: declinationRef.current,
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

    let cancelled = false;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const filtered = gpsFilterRef.current.push(
          {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            altitude: position.coords.altitude ?? undefined,
            accuracy: position.coords.accuracy,
          },
          position.timestamp
        );

        if (!filtered) {
          // Rejected by the gate/throttle — still surface the raw accuracy so
          // the HUD chip reflects real signal quality, not the last good fix.
          setPose((prev) => ({ ...prev, accuracy: position.coords.accuracy, error: null }));
          return;
        }

        setPose((prev) => ({
          ...prev,
          coords: fixToCoords(filtered),
          accuracy: position.coords.accuracy,
          goodFixCount: gpsFilterRef.current.goodFixCount,
          error: null,
        }));

        // Resolve declination once we know roughly where we are (cached by
        // distance inside magneticDeclination; cheap to call per accept).
        magneticDeclination(filtered.latitude, filtered.longitude).then((decl) => {
          if (cancelled || decl === null || decl === declinationRef.current) return;
          declinationRef.current = decl;
          setPose((prev) => ({ ...prev, declination: decl }));
        });
      },
      (err) => setPose((prev) => ({ ...prev, error: err.message })),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
    );

    return () => {
      cancelled = true;
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled]);

  // --- orientation listeners ---
  useEffect(() => {
    if (!enabled) return;
    // Prefer the absolute variant (magnetic-north referenced); the plain event
    // is the fallback and is ignored once absolute events are observed.
    window.addEventListener('deviceorientationabsolute', handleOrientation as EventListener);
    window.addEventListener('deviceorientation', handleOrientation as EventListener);
    return () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientation as EventListener);
      window.removeEventListener('deviceorientation', handleOrientation as EventListener);
    };
  }, [enabled, handleOrientation]);

  return { ...pose, requestPermission, adjustHeadingTrim };
}
