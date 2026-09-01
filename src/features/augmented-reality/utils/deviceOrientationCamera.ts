import * as THREE from 'three';

/**
 * Device-orientation → camera quaternion, the standard W3C mapping (as used by
 * three.js's DeviceOrientationControls): world-frame Euler (beta, alpha, −gamma)
 * in YXZ order, times a −90° X rotation (the camera looks out the device's
 * back, not its top), times a −screenAngle Z rotation so landscape holds work.
 *
 * This replaces the previous per-axis Euler assignment, which was only valid
 * in portrait and treated pitch/roll as independent of yaw (they aren't once
 * the device rolls).
 *
 * Heading convention: `viewHeadingDeg` is the smoothed true-north heading of
 * the camera view direction as published by useGeoPose — already corrected for
 * declination and screen angle. The device-frame alpha is reconstructed here
 * by *removing* the screen angle, then the final Z rotation adds it back in
 * the correct frame, so heading stays continuous when the screen rotates.
 */

const EULER = new THREE.Euler();
const Q_TMP = new THREE.Quaternion();
const Q_SCREEN = new THREE.Quaternion();
const Z_AXIS = new THREE.Vector3(0, 0, 1);
// −90° about X: tilt the frame from "device flat, screen up" to "camera out the back".
const Q_CAMERA = new THREE.Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2);

const DEG = Math.PI / 180;

export function applyDevicePoseToCamera(
  camera: THREE.Object3D,
  viewHeadingDeg: number,
  betaDeg: number,
  gammaDeg: number,
  screenAngleDeg: number
): void {
  // Device-frame alpha (CCW from north) from the view heading (CW from north).
  const alphaRad = -(viewHeadingDeg - screenAngleDeg) * DEG;
  EULER.set(betaDeg * DEG, alphaRad, -gammaDeg * DEG, 'YXZ');
  Q_TMP.setFromEuler(EULER);
  Q_TMP.multiply(Q_CAMERA);
  Q_TMP.multiply(Q_SCREEN.setFromAxisAngle(Z_AXIS, -screenAngleDeg * DEG));
  camera.quaternion.copy(Q_TMP);
}
