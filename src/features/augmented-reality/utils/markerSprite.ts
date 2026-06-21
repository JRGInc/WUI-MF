import * as THREE from 'three';
import type { RiskLevel } from '@/shared/types';
import { RISK_HEX } from '@/shared/utils/annotationStyle';

// A billboarded marker sprite (risk-tinted diamond pin + label) used by both the
// non-XR camera overlay and the WebXR scene, so geo markers look the same in
// either AR path. depthTest is off so labels never clip into the near plane.
export function makeMarkerSprite(title: string, risk: RiskLevel): THREE.Sprite {
  const material = new THREE.SpriteMaterial({
    map: makeLabelTexture(title, risk),
    depthTest: false,
    transparent: true,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(8, 4, 1);
  return sprite;
}

/** Free a sprite's texture + material (call after removing it from the scene). */
export function disposeMarkerSprite(sprite: THREE.Sprite): void {
  sprite.material.map?.dispose();
  sprite.material.dispose();
}

function makeLabelTexture(title: string, risk: RiskLevel): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const hex = `#${RISK_HEX[risk].toString(16).padStart(6, '0')}`;

  // pin diamond
  ctx.fillStyle = hex;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 6;
  ctx.save();
  ctx.translate(256, 96);
  ctx.rotate(Math.PI / 4);
  roundRect(ctx, -40, -40, 80, 80, 14);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // label pill
  ctx.font = 'bold 34px ui-sans-serif, system-ui, sans-serif';
  const text = title.length > 22 ? title.slice(0, 21) + '…' : title;
  const w = ctx.measureText(text).width + 40;
  ctx.fillStyle = 'rgba(17,24,20,0.85)';
  roundRect(ctx, 256 - w / 2, 168, w, 56, 12);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 196);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
