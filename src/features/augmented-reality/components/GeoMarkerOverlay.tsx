import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { MapPinIcon } from '@heroicons/react/24/outline';
import { useGeoPose } from '../hooks/useGeoPose';
import { geoToEnu, enuToGeo, enuToThree, distanceMeters } from '../utils/geoEnu';
import { makeMarkerSprite, disposeMarkerSprite } from '../utils/markerSprite';
import { zoneOuterRing } from '@/shared/utils/defensibleZones';
import { RISK_CSS, annotationRisk } from '@/shared/utils/annotationStyle';
import type { GeoCoordinates, MapAnnotation } from '@/shared/types';

// Defensible-space zone outline colors (match the map + legend).
const ZONE_COLORS: Record<number, number> = { 0: 0xef4444, 1: 0xf97316, 2: 0xeab308 };
// Approx handheld phone height — drop the ground plane below the camera so the
// zone outlines lie on the ground rather than at eye level.
const ZONE_GROUND_DROP_M = 1.5;

// Top-down radar fill/stroke per zone, and its range (≈100 ft + margin).
const ZONE_RADAR: Record<number, { fill: string; stroke: string }> = {
  0: { fill: 'rgba(239,68,68,0.38)', stroke: '#ef4444' },
  1: { fill: 'rgba(249,115,22,0.30)', stroke: '#f97316' },
  2: { fill: 'rgba(234,179,8,0.22)', stroke: '#eab308' },
};
const RADAR_RANGE_M = 34;

interface ZoneLine {
  line: THREE.LineLoop;
  ring: number[][]; // lng/lat pairs, re-projected each frame from the GPS fix
  positions: Float32Array;
  zone: number;
}

// Draw a heading-up top-down radar of the zones around the user — always
// visible regardless of AR pitch/tracking (the reliable iOS view). Reads the
// zone polygons straight from the prop, so it can't fall out of sync with the
// WebGL rebuild.
function drawZoneRadar(
  canvas: HTMLCanvasElement | null,
  pose: { coords: GeoCoordinates | null; heading: number | null },
  zones: GeoJSON.Feature[] | undefined
) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const c = w / 2;
  ctx.clearRect(0, 0, w, w);
  ctx.fillStyle = 'rgba(12,10,9,0.55)';
  ctx.beginPath();
  ctx.arc(c, c, c, 0, Math.PI * 2);
  ctx.fill();
  if (!pose.coords || !zones) return;

  const h = ((pose.heading ?? 0) * Math.PI) / 180;
  const cos = Math.cos(h);
  const sin = Math.sin(h);
  const scale = (c - 4) / RADAR_RANGE_M;
  for (const feature of zones) {
    const ring = zoneOuterRing(feature);
    if (!ring || ring.length < 2) continue;
    const zone = Number(feature.properties?.zone ?? 2);
    ctx.beginPath();
    for (let i = 0; i < ring.length; i++) {
      const enu = geoToEnu(pose.coords, { latitude: ring[i][1], longitude: ring[i][0] });
      const right = enu.east * cos - enu.north * sin;
      const fwd = enu.east * sin + enu.north * cos;
      const x = c + right * scale;
      const y = c - fwd * scale; // forward → up
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    const col = ZONE_RADAR[zone] ?? ZONE_RADAR[2];
    ctx.fillStyle = col.fill;
    ctx.fill();
    ctx.strokeStyle = col.stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // user dot + forward pointer
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(c, c, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(c, 5);
  ctx.lineTo(c - 4, 14);
  ctx.lineTo(c + 4, 14);
  ctx.closePath();
  ctx.fill();
}

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
  // Defensible-space zone polygons (shared geometry). Drawn as ground outlines
  // via the same GPS/compass projection as the markers — this is the iOS path,
  // since WebXR is Android-only.
  defensibleZones?: GeoJSON.Feature[];
  // Single source of pose for the whole AR view, owned by ARViewer. Passing it
  // in (rather than each overlay creating its own useGeoPose) keeps the zone
  // geometry's center and the renderer on the *same* GPS fix.
  pose: ReturnType<typeof useGeoPose>;
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
export function GeoMarkerOverlay({
  annotations,
  active,
  onPlace,
  defensibleZones,
  pose,
}: GeoMarkerOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const markersRef = useRef<MarkerObj[]>([]);
  const zoneLinesRef = useRef<ZoneLine[]>([]);
  const radarRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  // Latest zone polygons for the radar loop (which is set up once).
  const zonesPropRef = useRef(defensibleZones);
  zonesPropRef.current = defensibleZones;

  // Live pose kept in a ref so the render loop reads the latest without
  // re-binding. Pose is owned by ARViewer and passed in (single watcher).
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

  // --- (re)build defensible-space zone LineLoops when the polygons change ---
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const built: ZoneLine[] = [];
    for (const feature of defensibleZones ?? []) {
      const ring = zoneOuterRing(feature);
      if (!ring || ring.length < 2) continue;
      const zone = Number(feature.properties?.zone ?? 2);
      const positions = new Float32Array(ring.length * 3);
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.LineBasicMaterial({
        color: ZONE_COLORS[zone] ?? 0xeab308,
        transparent: true,
        opacity: 0.95,
      });
      const line = new THREE.LineLoop(geom, mat);
      line.frustumCulled = false; // verts are rewritten each frame from GPS
      scene.add(line);
      built.push({ line, ring, positions, zone });
    }
    zoneLinesRef.current = built;

    return () => {
      for (const { line } of built) {
        scene.remove(line);
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
      }
      zoneLinesRef.current = [];
    };
  }, [defensibleZones]);

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

          // Defensible-space zones: project each ring vertex at true ENU (no
          // depth clamp — they're real ground geometry) onto the dropped ground
          // plane. The camera is rotated by the pose, so no per-vertex heading.
          for (const { line: zline, ring, positions } of zoneLinesRef.current) {
            for (let i = 0; i < ring.length; i++) {
              const enu = geoToEnu(coords, { latitude: ring[i][1], longitude: ring[i][0] });
              const p = enuToThree({ east: enu.east, north: enu.north, up: -ZONE_GROUND_DROP_M }, 0);
              positions[i * 3] = p.x;
              positions[i * 3 + 1] = p.y;
              positions[i * 3 + 2] = p.z;
            }
            (zline.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
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

  // Radar draw loop — gated only by `enabled`, independent of the WebGL/camera
  // path, so the top-down zone view is reliable even where AR tracking isn't.
  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const draw = () => {
      drawZoneRadar(radarRef.current, poseRef.current, zonesPropRef.current);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [enabled]);

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

  // NOTE: always render the container + canvas (even when inactive) so the
  // three.js scene sets up on mount. Returning null while the camera warms up
  // left the scene uninitialized (the setup effect ran with no canvas and never
  // re-ran), so markers/zones never built. HUD elements are gated on `active`.
  return (
    <div ref={containerRef} className="absolute inset-0 z-[6] pointer-events-none">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Enable / status chip (only once the camera is streaming) */}
      {active && (
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
            {pose.beta !== null ? ` · P${Math.round(pose.beta)}°` : ''}
            {defensibleZones && defensibleZones.length > 0
              ? ` · ${defensibleZones.length} zones`
              : ''}
          </div>
        )}
      </div>
      )}

      {/* Top-down zone radar — always-visible view of the zones around you,
          independent of AR pitch/tracking (the reliable path on iOS). */}
      {enabled && (
        <canvas
          ref={radarRef}
          width={180}
          height={180}
          className="absolute top-4 right-4 rounded-full pointer-events-none"
          style={{ width: 92, height: 92 }}
        />
      )}

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
