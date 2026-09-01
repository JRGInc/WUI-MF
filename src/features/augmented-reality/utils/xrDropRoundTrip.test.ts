import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { geoToEnu, enuToThree, threeToEnu, enuToGeo } from './geoEnu';

/**
 * The XR drop-at-reticle bridge: geo content is laid out in an anchored group
 * whose local frame is ENU around a frozen origin (enuToThree at heading 0),
 * and a reticle hit is converted back world → group-local → threeToEnu →
 * enuToGeo. This test proves that inversion is exact for arbitrary group
 * transforms (any settled yaw + XR-space position).
 */
describe('XR drop-at-reticle round trip', () => {
  const ORIGIN = { latitude: 43.6153, longitude: -116.2015 };

  it.each([
    [0, 0, 0],
    [37, 4.2, -8.9],
    [180, -12.5, 3.1],
    [291, 0.4, 25.0],
  ])('recovers the geo coordinate through a group at yaw %d°', (yawDeg, gx, gz) => {
    const group = new THREE.Group();
    group.rotation.y = THREE.MathUtils.degToRad(yawDeg);
    group.position.set(gx, 0, gz);
    group.updateMatrixWorld();

    // A real-world point 18 m NE of the origin, placed the way layoutGeoContent does.
    const target = enuToGeo(ORIGIN, 13, 12.5);
    const enu = geoToEnu(ORIGIN, target);
    const local = enuToThree({ east: enu.east, north: enu.north, up: 0 }, 0);
    const world = group.localToWorld(new THREE.Vector3(local.x, 0, local.z));

    // Invert: the same math handleDropAtReticle runs on a hit position.
    const p = world.clone();
    group.worldToLocal(p);
    const back = threeToEnu({ x: p.x, y: p.y, z: p.z }, 0);
    const recovered = enuToGeo(ORIGIN, back.east, back.north);

    expect(recovered.latitude).toBeCloseTo(target.latitude, 9);
    expect(recovered.longitude).toBeCloseTo(target.longitude, 9);
  });
});
