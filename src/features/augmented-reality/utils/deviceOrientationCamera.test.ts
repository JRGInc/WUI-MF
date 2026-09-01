import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyDevicePoseToCamera } from './deviceOrientationCamera';

// View direction (world frame) after applying a pose to a camera.
function viewDir(heading: number, beta: number, gamma: number, screenAngle = 0): THREE.Vector3 {
  const cam = new THREE.Object3D();
  applyDevicePoseToCamera(cam, heading, beta, gamma, screenAngle);
  return new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
}

describe('applyDevicePoseToCamera', () => {
  it('upright portrait facing north looks down −Z', () => {
    const d = viewDir(0, 90, 0);
    expect(d.x).toBeCloseTo(0, 5);
    expect(d.y).toBeCloseTo(0, 5);
    expect(d.z).toBeCloseTo(-1, 5);
  });

  it('upright portrait facing east looks down +X', () => {
    const d = viewDir(90, 90, 0);
    expect(d.x).toBeCloseTo(1, 5);
    expect(d.y).toBeCloseTo(0, 5);
    expect(d.z).toBeCloseTo(0, 5);
  });

  it('tilting the device up raises the view', () => {
    const level = viewDir(0, 90, 0);
    const up = viewDir(0, 120, 0);
    expect(up.y).toBeGreaterThan(level.y + 0.3);
  });

  it('matches the legacy portrait Euler mapping when roll is zero', () => {
    // The previous implementation: rotation.order YXZ with
    // y=−heading, x=beta−90, z=−gamma. Equivalent at gamma=0.
    for (const [heading, beta] of [
      [0, 90],
      [45, 75],
      [200, 100],
      [315, 60],
    ]) {
      const legacy = new THREE.Object3D();
      legacy.rotation.order = 'YXZ';
      legacy.rotation.y = -THREE.MathUtils.degToRad(heading);
      legacy.rotation.x = THREE.MathUtils.degToRad(beta - 90);
      const legacyDir = new THREE.Vector3(0, 0, -1).applyQuaternion(legacy.quaternion);

      const d = viewDir(heading, beta, 0);
      expect(d.distanceTo(legacyDir)).toBeLessThan(1e-6);
    }
  });

  it('keeps the view direction when the screen rotates with the device', () => {
    // Physically rotating the phone to landscape-left rolls the device 90°
    // (gamma −90 with beta 0 in the device frame at the horizon) while the
    // screen angle becomes 90. useGeoPose keeps the published view heading
    // continuous through that rotation, so the same heading must yield the
    // same world view direction in both holds.
    const portrait = viewDir(90, 90, 0, 0);
    const landscape = viewDir(90, 0, -90, 90);
    expect(portrait.distanceTo(landscape)).toBeLessThan(1e-5);
  });
});
