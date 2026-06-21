import type { GeoCoordinates } from '@/shared/types';

/**
 * Geographic ⇄ local-tangent-plane (ENU: East-North-Up) conversion, the core of
 * the Map ⇄ AR bridge. We use the equirectangular (flat-earth) approximation
 * around a local origin: accurate to well under a metre across the tens-to-
 * hundreds of metres an AR scene spans, and far cheaper than full geodesics.
 *
 * Frame: +East = +X, +North = +Y (metres). To map into three.js, use
 * (x = east, y = up, z = -north) and rotate by the device heading — see
 * enuToThree / headingRotate below.
 */

const EARTH_RADIUS_M = 6_378_137; // WGS-84 equatorial radius
const DEG = Math.PI / 180;

export interface Enu {
  east: number;
  north: number;
  up: number;
}

/** Metres east/north of `origin` for the `target` coordinate. */
export function geoToEnu(origin: GeoCoordinates, target: GeoCoordinates): Enu {
  const dLat = (target.latitude - origin.latitude) * DEG;
  const dLng = (target.longitude - origin.longitude) * DEG;
  const meanLat = ((target.latitude + origin.latitude) / 2) * DEG;

  return {
    east: dLng * Math.cos(meanLat) * EARTH_RADIUS_M,
    north: dLat * EARTH_RADIUS_M,
    up: (target.altitude ?? 0) - (origin.altitude ?? 0),
  };
}

/** Inverse of geoToEnu: the lat/lng `east`/`north` metres from `origin`. */
export function enuToGeo(
  origin: GeoCoordinates,
  east: number,
  north: number,
  up = 0
): GeoCoordinates {
  const dLat = north / EARTH_RADIUS_M;
  const meanLat = (origin.latitude * DEG) + dLat / 2;
  const dLng = east / (Math.cos(meanLat) * EARTH_RADIUS_M);

  return {
    latitude: origin.latitude + dLat / DEG,
    longitude: origin.longitude + dLng / DEG,
    altitude: (origin.altitude ?? 0) + up,
  };
}

/**
 * Rotate an ENU vector by a compass heading (radians clockwise from north) into
 * the device's local frame, where the camera faces -Z (three.js convention).
 * Returns three.js coordinates {x, y, z}.
 */
export function enuToThree(enu: Enu, headingRad: number): { x: number; y: number; z: number } {
  const cos = Math.cos(headingRad);
  const sin = Math.sin(headingRad);
  // Rotate (east, north) by -heading so "north" aligns with the device forward.
  const e = enu.east * cos - enu.north * sin;
  const n = enu.east * sin + enu.north * cos;
  return { x: e, y: enu.up, z: -n };
}

/** Inverse of enuToThree: three.js local coords back to an ENU vector. */
export function threeToEnu(
  pos: { x: number; y: number; z: number },
  headingRad: number
): Enu {
  const e = pos.x;
  const n = -pos.z;
  const cos = Math.cos(headingRad);
  const sin = Math.sin(headingRad);
  return {
    east: e * cos + n * sin,
    north: -e * sin + n * cos,
    up: pos.y,
  };
}

/** Great-circle-ish planar distance in metres between two coordinates. */
export function distanceMeters(a: GeoCoordinates, b: GeoCoordinates): number {
  const { east, north } = geoToEnu(a, b);
  return Math.hypot(east, north);
}
