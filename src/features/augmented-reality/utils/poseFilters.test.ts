import { describe, expect, it } from 'vitest';
import {
  AngleSmoother,
  GPS_ACCURACY_GATE_M,
  GpsFilter,
  GroundHeightEstimator,
  HEADING_TRIM_MAX_DEG,
  HEADING_WARMUP_SAMPLES,
  clampHeadingTrim,
  HeadingFilter,
  YAW_ALIGN_SAMPLES,
  YawAligner,
  angleDiffDeg,
  magneticDeclination,
  normalizeDeg,
  resetDeclinationCache,
} from './poseFilters';
import { enuToGeo } from './geoEnu';

const BOISE = { latitude: 43.6153, longitude: -116.2015 };

describe('angle helpers', () => {
  it('normalizes into [0, 360)', () => {
    expect(normalizeDeg(-10)).toBe(350);
    expect(normalizeDeg(370)).toBe(10);
    expect(normalizeDeg(360)).toBe(0);
  });

  it('computes signed shortest difference across the wrap', () => {
    expect(angleDiffDeg(350, 10)).toBe(-20);
    expect(angleDiffDeg(10, 350)).toBe(20);
    expect(angleDiffDeg(180, 0)).toBe(180);
  });
});

describe('HeadingFilter', () => {
  it('averages across the 0/360 wrap during warm-up', () => {
    const f = new HeadingFilter();
    let out = 0;
    for (let i = 0; i < HEADING_WARMUP_SAMPLES; i++) {
      out = f.push(i % 2 === 0 ? 358 : 2);
    }
    // Circular mean of {358, 2} is 0, never ~180 (the naive-mean failure).
    expect(Math.abs(angleDiffDeg(out, 0))).toBeLessThan(1);
    expect(f.isWarm).toBe(true);
  });

  it('suppresses jitter after warm-up', () => {
    const f = new HeadingFilter();
    for (let i = 0; i < HEADING_WARMUP_SAMPLES; i++) f.push(180);
    let maxDev = 0;
    for (let i = 0; i < 60; i++) {
      const out = f.push(180 + (i % 2 === 0 ? 4 : -4));
      maxDev = Math.max(maxDev, Math.abs(angleDiffDeg(out, 180)));
    }
    // ±4° of sensor noise should shrink well below the raw amplitude.
    expect(maxDev).toBeLessThan(2);
  });

  it('tracks a real turn quickly', () => {
    const f = new HeadingFilter();
    for (let i = 0; i < HEADING_WARMUP_SAMPLES; i++) f.push(0);
    let out = 0;
    for (let i = 0; i < 30; i++) out = f.push(90); // 30 events ≈ 0.5 s at 60 Hz
    expect(Math.abs(angleDiffDeg(out, 90))).toBeLessThan(5);
  });
});

describe('AngleSmoother', () => {
  it('passes the first sample through and damps oscillation', () => {
    const s = new AngleSmoother();
    expect(s.push(45)).toBe(45);
    let maxDev = 0;
    for (let i = 0; i < 40; i++) {
      const out = s.push(45 + (i % 2 === 0 ? 3 : -3));
      maxDev = Math.max(maxDev, Math.abs(out - 45));
    }
    expect(maxDev).toBeLessThan(2);
  });
});

describe('GpsFilter', () => {
  const fix = (coords: { latitude: number; longitude: number }, accuracy: number) => ({
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy,
  });

  it('accepts the first fix regardless of accuracy', () => {
    const g = new GpsFilter();
    const out = g.push(fix(BOISE, 80), 0);
    expect(out).not.toBeNull();
    expect(out!.latitude).toBe(BOISE.latitude);
    expect(g.goodFixCount).toBe(0); // 80 m is over the gate
  });

  it('rejects fixes worse than the gate that do not improve accuracy', () => {
    const g = new GpsFilter();
    g.push(fix(BOISE, 40), 0);
    expect(g.push(fix(BOISE, 90), 2000)).toBeNull();
  });

  it('accepts an over-gate fix that improves on the current accuracy', () => {
    const g = new GpsFilter();
    g.push(fix(BOISE, 80), 0);
    expect(g.push(fix(BOISE, 40), 2000)).not.toBeNull();
  });

  it('accepts anything once the position is stale', () => {
    const g = new GpsFilter();
    g.push(fix(BOISE, 40), 0);
    expect(g.push(fix(BOISE, 90), 15_000)).not.toBeNull();
  });

  it('throttles updates arriving faster than the minimum interval', () => {
    const g = new GpsFilter();
    g.push(fix(BOISE, 10), 0);
    expect(g.push(fix(BOISE, 5), 500)).toBeNull();
    expect(g.push(fix(BOISE, 5), 1500)).not.toBeNull();
  });

  it('blends small displacements instead of jumping', () => {
    const g = new GpsFilter();
    g.push(fix(BOISE, 10), 0);
    const jittered = enuToGeo(BOISE, 8, 0); // 8 m east — typical GPS wander
    const out = g.push(fix(jittered, 10), 2000)!;
    // Should move a fraction of the way, not all of it.
    const movedFraction =
      (out.longitude - BOISE.longitude) / (jittered.longitude - BOISE.longitude);
    expect(movedFraction).toBeGreaterThan(0.2);
    expect(movedFraction).toBeLessThan(0.6);
  });

  it('snaps on a large displacement (the user actually moved)', () => {
    const g = new GpsFilter();
    g.push(fix(BOISE, 10), 0);
    const far = enuToGeo(BOISE, 100, 0);
    const out = g.push(fix(far, 10), 2000)!;
    expect(out.latitude).toBeCloseTo(far.latitude, 10);
    expect(out.longitude).toBeCloseTo(far.longitude, 10);
  });

  it('counts only gate-passing fixes as good', () => {
    const g = new GpsFilter();
    g.push(fix(BOISE, 80), 0);
    g.push(fix(BOISE, GPS_ACCURACY_GATE_M), 2000);
    g.push(fix(BOISE, 10), 4000);
    expect(g.goodFixCount).toBe(2);
  });
});

describe('clampHeadingTrim', () => {
  it('clamps to the ± window and zeroes non-finite input', () => {
    expect(clampHeadingTrim(8)).toBe(8);
    expect(clampHeadingTrim(45)).toBe(HEADING_TRIM_MAX_DEG);
    expect(clampHeadingTrim(-45)).toBe(-HEADING_TRIM_MAX_DEG);
    expect(clampHeadingTrim(NaN)).toBe(0);
  });
});

describe('YawAligner', () => {
  const DEG = Math.PI / 180;

  it('settles on the mean of camYaw + heading', () => {
    const a = new YawAligner();
    // Camera yaw −30° while the compass says the view heading is 120°:
    // content must be rotated by −30° + 120° = 90°.
    for (let i = 0; i < YAW_ALIGN_SAMPLES; i++) a.push(-30 * DEG, 120);
    expect(a.isSettled).toBe(true);
    expect(a.offsetRad!).toBeCloseTo(90 * DEG, 6);
  });

  it('averages noisy headings across the wrap without a naive-mean failure', () => {
    const a = new YawAligner();
    // Offsets alternating around ±180° must average to 180°, not 0°.
    for (let i = 0; i < YAW_ALIGN_SAMPLES; i++) a.push(0, i % 2 === 0 ? 178 : -178);
    const deviation = Math.abs(Math.atan2(Math.sin(a.offsetRad! - Math.PI), Math.cos(a.offsetRad! - Math.PI)));
    expect(deviation).toBeLessThan(2 * DEG);
  });

  it('freezes once settled — later samples are ignored', () => {
    const a = new YawAligner();
    for (let i = 0; i < YAW_ALIGN_SAMPLES; i++) a.push(0, 90);
    const settled = a.offsetRad!;
    a.push(0, 270); // wildly different sample after settle
    expect(a.offsetRad).toBe(settled);
  });

  it('reports null before any sample and a running mean while settling', () => {
    const a = new YawAligner();
    expect(a.offsetRad).toBeNull();
    a.push(0, 45);
    expect(a.isSettled).toBe(false);
    expect(a.offsetRad!).toBeCloseTo(45 * DEG, 6);
  });
});

describe('GroundHeightEstimator', () => {
  const CAMERA_Y = 1.6; // typical handheld height above local-floor origin

  it('snaps to the first plausible floor hit', () => {
    const g = new GroundHeightEstimator(0);
    expect(g.update(-0.3, CAMERA_Y)).toBe(-0.3);
  });

  it('ignores implausible hits (tabletop above, glitch below)', () => {
    const g = new GroundHeightEstimator(0);
    g.update(-0.2, CAMERA_Y); // ground established at −0.2
    expect(g.update(1.4, CAMERA_Y)).toBe(-0.2); // drop 0.2 m — a tabletop/wall
    expect(g.update(-2.0, CAMERA_Y)).toBe(-0.2); // drop 3.6 m — outlier
  });

  it('smooths toward a new plausible level instead of jumping', () => {
    const g = new GroundHeightEstimator(0);
    g.update(0, CAMERA_Y);
    const next = g.update(-0.5, CAMERA_Y);
    expect(next).toBeLessThan(0);
    expect(next).toBeGreaterThan(-0.1); // one 5% step, not the full 0.5 m
    for (let i = 0; i < 300; i++) g.update(-0.5, CAMERA_Y);
    expect(g.value).toBeCloseTo(-0.5, 1); // converges with repeated hits
  });

  it('holds the initial guess until a plausible hit arrives', () => {
    const g = new GroundHeightEstimator(0);
    expect(g.update(1.5, CAMERA_Y)).toBe(0);
    expect(g.value).toBe(0);
  });
});

describe('magneticDeclination', () => {
  it('returns a plausible WMM declination for Boise (~12–13° E)', async () => {
    resetDeclinationCache();
    const decl = await magneticDeclination(BOISE.latitude, BOISE.longitude);
    expect(decl).not.toBeNull();
    expect(decl!).toBeGreaterThan(10);
    expect(decl!).toBeLessThan(16);
  });

  it('serves nearby lookups from the cache', async () => {
    resetDeclinationCache();
    const a = await magneticDeclination(BOISE.latitude, BOISE.longitude);
    const b = await magneticDeclination(BOISE.latitude + 0.01, BOISE.longitude);
    expect(b).toBe(a);
  });
});
