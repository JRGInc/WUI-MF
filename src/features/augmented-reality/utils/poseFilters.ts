import type { GeoCoordinates } from '@/shared/types';
import { distanceMeters } from './geoEnu';

/**
 * Sensor filtering for the AR geo-pose. Raw GPS and compass readings are far
 * too jittery to drive a camera directly — content swims with every fix and
 * compass twitch. These filters port the anchoring discipline of the BFMA
 * Unity app (AR+GPS Location asset): gate GPS fixes on accuracy, smooth
 * positions instead of jumping, and low-pass the compass with a warm-up
 * average before trusting it.
 *
 * Everything here is pure and framework-free so it can be unit-tested; the
 * stateful hook (useGeoPose) owns the instances.
 */

// GPS fixes worse than this are rejected once we have a usable position
// (BFMA rejects at 25 m). A worse fix is still accepted when it *improves*
// on what we have, or when the current fix has gone stale.
export const GPS_ACCURACY_GATE_M = 25;
// Minimum interval between applied GPS updates (BFMA uses 2 s; 1 s keeps the
// walk-around feel responsive while still suppressing per-callback jitter).
export const GPS_MIN_UPDATE_MS = 1000;
// If nothing has been accepted for this long, take whatever we can get.
export const GPS_STALE_MS = 10_000;
// Displacements beyond max(this, 2× accuracy) snap instead of blending —
// the user actually moved; blending would drag content behind them.
export const GPS_SNAP_M = 30;
// Fraction of the remaining error corrected per accepted update.
const GPS_BLEND = 0.35;

// Compass warm-up: circular-average this many samples before switching to the
// low-pass filter (BFMA averages 150 at Unity's sensor rate; ~30 events at the
// browser's ~60 Hz covers a comparable real-time window without a long wait).
export const HEADING_WARMUP_SAMPLES = 30;

/** Normalize an angle to [0, 360). */
export function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Signed shortest angular difference a − b, in (−180, 180]. */
export function angleDiffDeg(a: number, b: number): number {
  const d = normalizeDeg(a - b);
  return d > 180 ? d - 360 : d;
}

/**
 * Adaptive circular low-pass for the compass heading. Small changes (sensor
 * jitter) are smoothed hard; large changes (the user actually turning) track
 * fast, so panning doesn't lag. Internally blends on the unit vector so the
 * 359° ↔ 1° wrap needs no special cases.
 */
export class HeadingFilter {
  private x = 0;
  private y = 0;
  private samples = 0;
  private smoothed: number | null = null;

  private static readonly ALPHA_MIN = 0.04; // heavy suppression for jitter
  private static readonly ALPHA_MAX = 0.5; // fast tracking for real turns
  private static readonly ALPHA_GAIN_DEG = 60; // diff at which alpha maxes out

  push(rawDeg: number): number {
    const rad = (normalizeDeg(rawDeg) * Math.PI) / 180;
    const cx = Math.sin(rad);
    const cy = Math.cos(rad);

    if (this.samples < HEADING_WARMUP_SAMPLES) {
      // Warm-up: running circular mean, published as it converges.
      this.x += cx;
      this.y += cy;
      this.samples += 1;
      if (this.samples === HEADING_WARMUP_SAMPLES) {
        const norm = Math.hypot(this.x, this.y) || 1;
        this.x /= norm;
        this.y /= norm;
      }
    } else {
      const diff = Math.abs(angleDiffDeg(rawDeg, this.smoothed ?? rawDeg));
      const alpha = Math.min(
        HeadingFilter.ALPHA_MAX,
        Math.max(HeadingFilter.ALPHA_MIN, diff / HeadingFilter.ALPHA_GAIN_DEG)
      );
      this.x = this.x * (1 - alpha) + cx * alpha;
      this.y = this.y * (1 - alpha) + cy * alpha;
      const norm = Math.hypot(this.x, this.y) || 1;
      this.x /= norm;
      this.y /= norm;
    }

    this.smoothed = normalizeDeg((Math.atan2(this.x, this.y) * 180) / Math.PI);
    return this.smoothed;
  }

  get isWarm(): boolean {
    return this.samples >= HEADING_WARMUP_SAMPLES;
  }

  reset(): void {
    this.x = 0;
    this.y = 0;
    this.samples = 0;
    this.smoothed = null;
  }
}

/**
 * Adaptive low-pass for tilt angles (beta/gamma). Same idea as HeadingFilter
 * but scalar, with a lighter touch — tilt drives pitch/roll, where lag is more
 * visible than jitter.
 */
export class AngleSmoother {
  private smoothed: number | null = null;

  private static readonly ALPHA_MIN = 0.1;
  private static readonly ALPHA_MAX = 0.7;
  private static readonly ALPHA_GAIN_DEG = 30;

  push(rawDeg: number): number {
    if (this.smoothed === null) {
      this.smoothed = rawDeg;
      return rawDeg;
    }
    const diff = angleDiffDeg(rawDeg, this.smoothed);
    const alpha = Math.min(
      AngleSmoother.ALPHA_MAX,
      Math.max(AngleSmoother.ALPHA_MIN, Math.abs(diff) / AngleSmoother.ALPHA_GAIN_DEG)
    );
    this.smoothed += diff * alpha;
    return this.smoothed;
  }

  reset(): void {
    this.smoothed = null;
  }
}

export interface RawGpsFix {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy: number;
}

export interface FilteredGpsFix extends RawGpsFix {}

/**
 * GPS accuracy gate + position smoothing. Accepts the first fix regardless
 * (so AR can start), then rejects fixes worse than the gate unless they
 * improve on the current accuracy or the position has gone stale. Accepted
 * fixes are blended toward, not jumped to, unless the displacement says the
 * user genuinely moved.
 */
export class GpsFilter {
  private current: FilteredGpsFix | null = null;
  private lastAcceptMs = 0;
  /** Count of accepted fixes at or under the accuracy gate — callers use this
   *  to decide when an anchor (e.g. the zone center) is trustworthy to freeze. */
  goodFixCount = 0;

  push(fix: RawGpsFix, nowMs: number): FilteredGpsFix | null {
    if (!this.current) {
      this.current = { ...fix };
      this.lastAcceptMs = nowMs;
      if (fix.accuracy <= GPS_ACCURACY_GATE_M) this.goodFixCount += 1;
      return { ...this.current };
    }

    if (nowMs - this.lastAcceptMs < GPS_MIN_UPDATE_MS) return null;

    const stale = nowMs - this.lastAcceptMs > GPS_STALE_MS;
    if (fix.accuracy > GPS_ACCURACY_GATE_M && fix.accuracy >= this.current.accuracy && !stale) {
      return null;
    }

    const displacement = distanceMeters(this.current, fix);
    const snapDist = Math.max(GPS_SNAP_M, 2 * fix.accuracy);
    if (displacement > snapDist) {
      this.current = { ...fix };
    } else {
      this.current = {
        latitude: this.current.latitude + (fix.latitude - this.current.latitude) * GPS_BLEND,
        longitude: this.current.longitude + (fix.longitude - this.current.longitude) * GPS_BLEND,
        altitude: fix.altitude ?? this.current.altitude,
        accuracy: fix.accuracy,
      };
    }
    this.lastAcceptMs = nowMs;
    if (fix.accuracy <= GPS_ACCURACY_GATE_M) this.goodFixCount += 1;
    return { ...this.current };
  }

  reset(): void {
    this.current = null;
    this.lastAcceptMs = 0;
    this.goodFixCount = 0;
  }
}

// Manual heading trim: a per-device compass-bias correction the user dials in
// when AR content is visibly rotated relative to reality (declination is
// already applied automatically; this covers residual hard/soft-iron bias,
// typically well under 30°). Persisted per device.
export const HEADING_TRIM_STEP_DEG = 2;
export const HEADING_TRIM_MAX_DEG = 30;
export const HEADING_TRIM_STORAGE_KEY = 'ar-heading-trim-deg';

export function clampHeadingTrim(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  return Math.max(-HEADING_TRIM_MAX_DEG, Math.min(HEADING_TRIM_MAX_DEG, deg));
}

export function loadHeadingTrim(): number {
  try {
    return clampHeadingTrim(Number(localStorage.getItem(HEADING_TRIM_STORAGE_KEY)));
  } catch {
    return 0;
  }
}

export function saveHeadingTrim(deg: number): void {
  try {
    localStorage.setItem(HEADING_TRIM_STORAGE_KEY, String(deg));
  } catch {
    // blocked storage — the trim still applies this session
  }
}

// Yaw-alignment settle window: how many (camera yaw, compass heading) sample
// pairs to average before freezing the XR world's north alignment. ~1.5 s at
// 60 Hz — the same idea as BFMA's 150-sample average with MaxNumberOfUpdates.
export const YAW_ALIGN_SAMPLES = 90;

/**
 * North alignment for the WebXR path. XR space has an arbitrary yaw, so geo
 * content must be rotated by an offset θ such that content-north points at
 * true north: θ = cameraYaw + viewHeading (both at the same instant).
 *
 * The old approach recomputed θ from the live camera yaw + live compass every
 * frame, so compass noise wobbled the whole scene forever. This settles θ
 * once — circular average over the settle window — then freezes it, and the
 * VIO tracker (not the compass) keeps content stable from then on.
 */
export class YawAligner {
  private x = 0;
  private y = 0;
  private samples = 0;

  push(cameraYawRad: number, viewHeadingDeg: number): void {
    if (this.isSettled) return;
    const theta = cameraYawRad + (viewHeadingDeg * Math.PI) / 180;
    this.x += Math.cos(theta);
    this.y += Math.sin(theta);
    this.samples += 1;
  }

  /** Running circular mean while settling; frozen once settled. Null before the first sample. */
  get offsetRad(): number | null {
    if (this.samples === 0) return null;
    return Math.atan2(this.y, this.x);
  }

  get isSettled(): boolean {
    return this.samples >= YAW_ALIGN_SAMPLES;
  }

  reset(): void {
    this.x = 0;
    this.y = 0;
    this.samples = 0;
  }
}

// Ground-height plausibility window: a hit is only treated as "the ground"
// when it sits this far below the camera (BFMA clamps 0.4–3.0 m — closer is a
// tabletop/wall hit, farther is a downhill outlier or a tracking glitch).
export const GROUND_MIN_DROP_M = 0.4;
export const GROUND_MAX_DROP_M = 3.0;
// Fraction of the remaining error corrected per accepted hit (per frame at
// ~60 Hz; BFMA uses 0.05).
const GROUND_SMOOTHING = 0.05;

/**
 * Ground-plane height estimator for the WebXR path. `local-floor` puts y = 0
 * at the UA's floor *estimate*, which is often emulated at a fixed offset;
 * hit-test results give the actually detected ground. Feed it every floor hit
 * and read `value` for the y to draw ground content at: the first plausible
 * hit snaps, later hits are smoothed, implausible hits (walls, tabletops,
 * glitches) are ignored.
 */
export class GroundHeightEstimator {
  private y: number;
  private hasHit = false;

  constructor(initialY = 0) {
    this.y = initialY;
  }

  update(hitY: number, cameraY: number): number {
    const drop = cameraY - hitY;
    if (drop < GROUND_MIN_DROP_M || drop > GROUND_MAX_DROP_M) return this.y;
    if (!this.hasHit) {
      this.y = hitY;
      this.hasHit = true;
    } else {
      this.y += (hitY - this.y) * GROUND_SMOOTHING;
    }
    return this.y;
  }

  get value(): number {
    return this.y;
  }

  reset(initialY = 0): void {
    this.y = initialY;
    this.hasHit = false;
  }
}

/**
 * Screen orientation angle in degrees (0 portrait, 90 landscape-left, …).
 * Device-orientation angles are reported in the *device* frame; the camera
 * view is in the *screen* frame, so every consumer must correct by this.
 */
export function getScreenAngle(): number {
  if (typeof screen !== 'undefined' && screen.orientation && typeof screen.orientation.angle === 'number') {
    return screen.orientation.angle;
  }
  const legacy = typeof window !== 'undefined' ? (window as { orientation?: unknown }).orientation : undefined;
  return typeof legacy === 'number' ? legacy : 0;
}

// Declination changes slowly with position — recompute only after moving this far.
const DECLINATION_REUSE_KM = 50;

let declCache: { latitude: number; longitude: number; value: number } | null = null;

/**
 * Magnetic declination (degrees, east-positive) at a coordinate, from the
 * World Magnetic Model (`geomagnetism`, lazy-loaded so it stays out of the
 * critical path). Both compass sources are magnetic-north referenced — iOS
 * `webkitCompassHeading` (per Apple's docs, despite a widespread belief it is
 * true north) and Android's absolute `alpha` — so true heading = magnetic
 * heading + declination. Returns null if the model can't be loaded; callers
 * fall back to magnetic heading, which is what the app always used before.
 */
export async function magneticDeclination(latitude: number, longitude: number): Promise<number | null> {
  if (
    declCache &&
    distanceMeters(declCache, { latitude, longitude }) < DECLINATION_REUSE_KM * 1000
  ) {
    return declCache.value;
  }
  try {
    const mod = await import('geomagnetism');
    const geomagnetism = mod.default ?? mod;
    // allowOutOfBoundsModel: keep working past the bundled model's 5-year
    // validity window — declination drifts well under compass noise per year.
    const model = geomagnetism.model(new Date(), { allowOutOfBoundsModel: true });
    const value = model.point([latitude, longitude]).decl;
    declCache = { latitude, longitude, value };
    return value;
  } catch {
    return null;
  }
}

/** Test hook: clear the module-level declination cache. */
export function resetDeclinationCache(): void {
  declCache = null;
}

/** GeoCoordinates view of a filtered fix (altitude omitted when unknown). */
export function fixToCoords(fix: FilteredGpsFix): GeoCoordinates {
  return {
    latitude: fix.latitude,
    longitude: fix.longitude,
    altitude: fix.altitude,
  };
}
