import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { MapPinIcon } from '@heroicons/react/24/outline';
import { useGeoPose } from '../hooks/useGeoPose';
import { geoToEnu, enuToGeo, enuToThree, distanceMeters } from '../utils/geoEnu';
import { makeMarkerSprite, disposeMarkerSprite } from '../utils/markerSprite';
import { RISK_CSS, annotationRisk } from '@/shared/utils/annotationStyle';
import type { GeoCoordinates, MapAnnotation } from '@/shared/types';

// How far ahead of the user a dropped marker lands, along the current heading.
const DROP_AHEAD_M = 10;

// Tailwind text color for a GPS accuracy reading (metres): green good, amber
// usable, red rough — so the metres-not-centimetres caveat is visible, not hidden.
function accuracyClass(acc: number | null): string {
  if (acc == null) return 'text-white';
  if (acc <= 10) return 'text-green-400';
  if (acc <= 25) return 'text-amber-400';
  return 'text-red-400';
}

// Markers nearer/farther than this are clamped in depth so they stay visible.
const MIN_DIST = 4;
const MAX_DIST = 120;

interface GeoMarkerOverlayProps {
  annotations: MapAnnotation[];
  active: boolean;
  // Phase 4: called with the computed coordinate when the user drops a marker
  // in AR. The parent captures details and persists it as a MapAnnotation.
  onPlace?: (coords: GeoCoordinates) => void;
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
export function GeoMarkerOverlay({ annotations, active, onPlace }: GeoMarkerOverlayProps) {
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
      disposeMarkerSprite(sprite);
    }
    markersRef.current = [];

    for (const annotation of annotations) {
      const sprite = makeMarkerSprite(annotation.content.title, annotationRisk(annotation.content));
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
      const { coords, heading, beta, gamma } = poseRef.current;

      if (renderer && scene && camera) {
        // Orient the camera from the device pose (rotation order YXZ = yaw→pitch→roll):
        //  - yaw from the compass heading (0 = north → look down −Z),
        //  - pitch from beta (90° = upright at the horizon),
        //  - roll from gamma.
        // Signs are the common portrait mapping; calibrate per device if inverted.
        if (heading !== null) camera.rotation.y = -THREE.MathUtils.degToRad(heading);
        if (beta !== null) camera.rotation.x = THREE.MathUtils.degToRad(beta - 90);
        if (gamma !== null) camera.rotation.z = THREE.MathUtils.degToRad(-gamma);

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

  // Drop a marker ahead of the user along the current heading (Phase 4). With no
  // compass we fall back to the user's exact GPS position.
  const handleDrop = () => {
    const { coords, heading } = poseRef.current;
    if (!coords) return;
    let placed: GeoCoordinates = coords;
    if (heading !== null) {
      const h = THREE.MathUtils.degToRad(heading);
      placed = enuToGeo(coords, Math.sin(h) * DROP_AHEAD_M, Math.cos(h) * DROP_AHEAD_M);
    }
    onPlace?.(placed);
  };

  // Live distance list for the HUD (cheap; recomputed only when pose/annotations change).
  const ranked = useMemo(() => {
    if (!pose.coords) return [];
    return annotations
      .map((a) => ({ a, dist: distanceMeters(pose.coords!, a.coordinates) }))
      .sort((x, y) => x.dist - y.dist);
  }, [annotations, pose.coords]);

  if (!active) return null;

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
            {annotations.length > 0
              ? `Show ${annotations.length} marker${annotations.length === 1 ? '' : 's'} in AR`
              : 'Enable AR positioning'}
          </button>
        ) : (
          <div className="px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur text-white text-xs font-mono">
            {pose.coords ? (
              <span className={accuracyClass(pose.accuracy)}>
                GPS ±{Math.round(pose.accuracy ?? 0)}m
              </span>
            ) : (
              'Acquiring GPS…'
            )}
            {pose.heading !== null ? ` · ${Math.round(pose.heading)}°` : ' · no compass'}
          </div>
        )}
      </div>

      {/* Drop a marker ahead (Phase 4: AR → map) */}
      {enabled && onPlace && pose.coords && (
        <button
          onClick={handleDrop}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-full bg-fire-600 text-white text-sm font-semibold shadow-lg"
        >
          <MapPinIcon className="w-4 h-4" />
          Drop marker {DROP_AHEAD_M}m ahead
        </button>
      )}

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
                style={{ background: RISK_CSS[annotationRisk(a.content)] }}
              />
              {a.content.title} · {dist < 1000 ? `${Math.round(dist)}m` : `${(dist / 1000).toFixed(1)}km`}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
