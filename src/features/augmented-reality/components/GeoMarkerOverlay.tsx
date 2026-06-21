import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { MapPinIcon } from '@heroicons/react/24/outline';
import { useGeoPose } from '../hooks/useGeoPose';
import { geoToEnu, enuToThree, distanceMeters } from '../utils/geoEnu';
import type { MapAnnotation, RiskLevel } from '@/shared/types';

const RISK_HEX: Record<RiskLevel, number> = {
  low: 0x22c55e,
  moderate: 0xeab308,
  high: 0xf97316,
  extreme: 0xdc2626,
};

const RISK_CSS: Record<RiskLevel, string> = {
  low: '#22c55e',
  moderate: '#eab308',
  high: '#f97316',
  extreme: '#dc2626',
};

// Markers nearer/farther than this are clamped in depth so they stay visible.
const MIN_DIST = 4;
const MAX_DIST = 120;

interface GeoMarkerOverlayProps {
  annotations: MapAnnotation[];
  active: boolean;
}

interface MarkerObj {
  sprite: THREE.Sprite;
  annotation: MapAnnotation;
}

/**
 * Phase 3 of the Map ⇄ AR bridge: render assessment MapAnnotations as 3D markers
 * over the live camera. A transparent three.js canvas sits above the video; each
 * annotation is placed by geoToEnu (relative to the device GPS fix) and the
 * camera is yawed by the compass heading so markers sit in the real direction.
 *
 * This is the non-XR path (what most phones use). Accuracy is GPS/compass-bound —
 * see the design note. Pitch/roll are not yet applied, so markers ride the
 * horizon line; turning left/right tracks correctly.
 */
export function GeoMarkerOverlay({ annotations, active }: GeoMarkerOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const markersRef = useRef<MarkerObj[]>([]);
  const rafRef = useRef<number | null>(null);

  // Live pose kept in refs so the render loop reads the latest without re-binding.
  const pose = useGeoPose(active);
  const poseRef = useRef(pose);
  poseRef.current = pose;

  const [enabled, setEnabled] = useState(false);

  // --- scene setup (once) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 500);
    camera.rotation.order = 'YXZ';

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = container;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;

    return () => {
      window.removeEventListener('resize', resize);
      renderer.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
    };
  }, []);

  // --- (re)build marker sprites when the annotation set changes ---
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Tear down previous sprites.
    for (const { sprite } of markersRef.current) {
      scene.remove(sprite);
      sprite.material.map?.dispose();
      sprite.material.dispose();
    }
    markersRef.current = [];

    for (const annotation of annotations) {
      const risk = annotation.content.riskLevel ?? 'moderate';
      const texture = makeLabelTexture(annotation.content.title, risk);
      const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(8, 4, 1);
      scene.add(sprite);
      markersRef.current.push({ sprite, annotation });
    }
  }, [annotations]);

  // --- render loop ---
  useEffect(() => {
    if (!enabled || !active) return;

    const loop = () => {
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const { coords, heading } = poseRef.current;

      if (renderer && scene && camera) {
        // Yaw the camera to match the compass: heading 0 (north) → look down −Z.
        if (heading !== null) camera.rotation.y = -THREE.MathUtils.degToRad(heading);

        if (coords) {
          for (const { sprite, annotation } of markersRef.current) {
            const enu = geoToEnu(coords, annotation.coordinates);
            // Clamp depth so very near/far markers stay on screen.
            const dist = Math.hypot(enu.east, enu.north) || 1;
            const k = Math.min(MAX_DIST, Math.max(MIN_DIST, dist)) / dist;
            const p = enuToThree({ east: enu.east * k, north: enu.north * k, up: 0 }, 0);
            sprite.position.set(p.x, p.y, p.z);
          }
        }
        renderer.render(scene, camera);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [enabled, active]);

  // Live distance list for the HUD (cheap; recomputed only when pose/annotations change).
  const ranked = useMemo(() => {
    if (!pose.coords) return [];
    return annotations
      .map((a) => ({ a, dist: distanceMeters(pose.coords!, a.coordinates) }))
      .sort((x, y) => x.dist - y.dist);
  }, [annotations, pose.coords]);

  if (!active || annotations.length === 0) return null;

  return (
    <div ref={containerRef} className="absolute inset-0 z-[6] pointer-events-none">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Enable / status chip */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 pointer-events-auto">
        {!enabled ? (
          <button
            onClick={async () => {
              const ok = await pose.requestPermission();
              if (ok) setEnabled(true);
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-fire-600 text-white text-sm font-medium shadow-lg"
          >
            <MapPinIcon className="w-4 h-4" />
            Show {annotations.length} marker{annotations.length === 1 ? '' : 's'} in AR
          </button>
        ) : (
          <div className="px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur text-white text-xs font-mono">
            {pose.coords
              ? `GPS ±${Math.round(pose.accuracy ?? 0)}m`
              : 'Acquiring GPS…'}
            {pose.heading !== null ? ` · ${Math.round(pose.heading)}°` : ' · no compass'}
          </div>
        )}
      </div>

      {/* Nearest-markers HUD */}
      {enabled && ranked.length > 0 && (
        <div className="absolute bottom-4 left-4 right-4 flex gap-2 overflow-x-auto pointer-events-none">
          {ranked.slice(0, 4).map(({ a, dist }) => (
            <div
              key={a.id}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-black/55 backdrop-blur text-white text-xs whitespace-nowrap"
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: RISK_CSS[a.content.riskLevel ?? 'moderate'] }}
              />
              {a.content.title} · {dist < 1000 ? `${Math.round(dist)}m` : `${(dist / 1000).toFixed(1)}km`}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Render a marker's label to a canvas texture: a pill with the title, tinted by
// risk. depthTest is off on the sprite so labels never clip into the camera.
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
