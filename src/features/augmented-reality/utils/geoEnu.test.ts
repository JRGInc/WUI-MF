import { describe, it, expect } from 'vitest';
import {
  geoToEnu,
  enuToGeo,
  enuToThree,
  threeToEnu,
  distanceMeters,
} from './geoEnu';
import type { GeoCoordinates } from '@/shared/types';

// Boise, ID — the app's reference area.
const ORIGIN: GeoCoordinates = { latitude: 43.615, longitude: -116.2023 };

describe('geoEnu', () => {
  it('maps a point due north to +north, ~0 east', () => {
    // 0.001° latitude ≈ 111.3 m north.
    const target = { latitude: ORIGIN.latitude + 0.001, longitude: ORIGIN.longitude };
    const enu = geoToEnu(ORIGIN, target);
    expect(enu.north).toBeCloseTo(111.32, 0);
    expect(Math.abs(enu.east)).toBeLessThan(0.01);
  });

  it('maps a point due east to +east, ~0 north', () => {
    const target = { latitude: ORIGIN.latitude, longitude: ORIGIN.longitude + 0.001 };
    const enu = geoToEnu(ORIGIN, target);
    expect(enu.east).toBeGreaterThan(0);
    expect(Math.abs(enu.north)).toBeLessThan(0.01);
  });

  it('round-trips geo → ENU → geo within a millimetre', () => {
    const target: GeoCoordinates = { latitude: 43.6182, longitude: -116.1975 };
    const enu = geoToEnu(ORIGIN, target);
    const back = enuToGeo(ORIGIN, enu.east, enu.north, enu.up);
    expect(back.latitude).toBeCloseTo(target.latitude, 7);
    expect(back.longitude).toBeCloseTo(target.longitude, 7);
  });

  it('round-trips ENU → three → ENU at several headings', () => {
    const enu = { east: 12.4, north: -31.7, up: 1.5 };
    for (const headingDeg of [0, 45, 90, 180, 270]) {
      const h = (headingDeg * Math.PI) / 180;
      const three = enuToThree(enu, h);
      const back = threeToEnu(three, h);
      expect(back.east).toBeCloseTo(enu.east, 6);
      expect(back.north).toBeCloseTo(enu.north, 6);
      expect(back.up).toBeCloseTo(enu.up, 6);
    }
  });

  it('places north ahead (−Z) when heading is 0', () => {
    const enu = { east: 0, north: 50, up: 0 };
    const three = enuToThree(enu, 0);
    expect(three.z).toBeCloseTo(-50, 6); // forward
    expect(three.x).toBeCloseTo(0, 6);
  });

  it('facing east (heading 90°) puts a northward point to the left (−X)', () => {
    // Camera looks down −Z with +X to the right, so when the device faces east
    // a point due north sits to the left → −X.
    const enu = { east: 0, north: 50, up: 0 };
    const three = enuToThree(enu, Math.PI / 2);
    expect(three.x).toBeCloseTo(-50, 4);
    expect(three.z).toBeCloseTo(0, 4);
  });

  it('distanceMeters matches a hand-computed offset', () => {
    const target = { latitude: ORIGIN.latitude + 0.001, longitude: ORIGIN.longitude };
    expect(distanceMeters(ORIGIN, target)).toBeCloseTo(111.32, 0);
  });

  it('full bridge: map annotation → AR local → back to the same lat/lng', () => {
    const user = ORIGIN;
    const annotation: GeoCoordinates = { latitude: 43.6156, longitude: -116.2015 };
    const heading = (30 * Math.PI) / 180;

    // MAP → AR
    const enu = geoToEnu(user, annotation);
    const local = enuToThree(enu, heading);

    // AR → MAP
    const enuBack = threeToEnu(local, heading);
    const geoBack = enuToGeo(user, enuBack.east, enuBack.north, enuBack.up);

    expect(geoBack.latitude).toBeCloseTo(annotation.latitude, 6);
    expect(geoBack.longitude).toBeCloseTo(annotation.longitude, 6);
  });
});
