import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { MapPinIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useGeoPose } from '../hooks/useGeoPose';
import { HEADING_TRIM_MAX_DEG, HEADING_TRIM_STEP_DEG, angleDiffDeg } from '../utils/poseFilters';
import { applyDevicePoseToCamera } from '../utils/deviceOrientationCamera';
import { geoToEnu, enuToGeo, enuToThree, distanceMeters, bearingDeg } from '../utils/geoEnu';
import { makeMarkerSprite, disposeMarkerSprite } from '../utils/markerSprite';
import { zoneOuterRing } from '@/shared/utils/defensibleZones';
import { RISK_CSS, annotationRisk } from '@/shared/utils/annotationStyle';
import type { GeoCoordinates, MapAnnotation } from '@/shared/types';

// Defensible-space zone outline colors (match the map + legend).
const ZONE_COLORS: Record<number, number> = { 0: 0xef4444, 1: 0xf97316, 2: 0xeab308 };
// Ground plane below the camera. Without depth sensing this path can't detect
// the ground, so it starts at a typical handheld height and the user nudges it
// until the bands sit on the ground (persisted; clamped like BFMA's 0.4–3 m).
const GROUND_DROP_DEFAULT_M = 1.5;
const GROUND_DROP_MIN_M = 0.5;
const GROUND_DROP_MAX_M = 3.0;
const GROUND_DROP_STEP_M = 0.25;
const GROUND_DROP_STORAGE_KEY = 'ar-ground-drop-m';

function loadGroundDrop(): number {
  try {
    const v = Number(localStorage.getItem(GROUND_DROP_STORAGE_KEY));
    if (Number.isFinite(v) && v >= GROUND_DROP_MIN_M && v <= GROUND_DROP_MAX_M) return v;
  } catch {
    // blocked storage — fall through to the default
  }
  return GROUND_DROP_DEFAULT_M;
}

// Top-down radar fill/stroke per zone, and its range (≈100 ft + margin).
const ZONE_RADAR: Record<number, { fill: string; stroke: string }> = {
  0: { fill: 'rgba(239,68,68,0.38)', stroke: '#ef4444' },
  1: { fill: 'rgba(249,115,22,0.30)', stroke: '#f97316' },
  2: { fill: 'rgba(234,179,8,0.22)', stroke: '#eab308' },
};
const RADAR_RANGE_M = 34;

// On-ground filled-band opacity per zone (rendered largest-first, so the inner,
// brighter zones read on top — same idea as the map's stacked fills).
const ZONE_FILL_OPACITY: Record<number, number> = { 0: 0.35, 1: 0.28, 2: 0.2 };

// Rough geographic centroid of a lng/lat ring — the local origin the filled
// zone meshes are built around (so we triangulate once, then move the group).
function ringCentroidGeo(ring: number[][]): GeoCoordinates {
  let sx = 0;
  let sy = 0;
  for (const [lng, lat] of ring) {
    sx += lng;
    sy += lat;
  }
  return { longitude: sx / ring.length, latitude: sy / ring.length };
}

// Draw a heading-up top-down radar of the zones around the user — always
// visible regardless of AR pitch/tracking (the reliable iOS view). Reads the
// zone polygons straight from the prop, so it can't fall out of sync with the
// WebGL rebuild.
function drawZoneRadar(
  canvas: HTMLCanvasElement | null,
  pose: { coords: GeoCoordinates | null; heading: number | null },
  zones: GeoJSON.Feature[] | undefined,
  target?: GeoCoordinates | null
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
  // wayfinding target: heading-up dot, clamped to the radar rim when beyond range
  if (target && pose.coords) {
    const enu = geoToEnu(pose.coords, target);
    let right = enu.east * cos - enu.north * sin;
    let fwd = enu.east * sin + enu.north * cos;
    const d = Math.hypot(right, fwd);
    const maxR = (c - 8) / scale;
    if (d > maxR && d > 0) {
      right *= maxR / d;
      fwd *= maxR / d;
    }
    ctx.fillStyle = '#fb923c';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(c + right * scale, c - fwd * scale, 4, 0, Math.PI * 2);
    ctx.fill();
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
// User-adjustable per drop (this path has no depth, so distance is the one
// thing the user must supply); the default matches the old fixed behavior.
const DROP_AHEAD_DEFAULT_M = 10;
const DROP_AHEAD_MIN_M = 2.5;
const DROP_AHEAD_MAX_M = 50;
const DROP_AHEAD_STEP_M = 2.5;

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
  // Re-stamp the zone center at the user's current position ("stand at the
  // structure and tap") — the calibration for a bad first fix.
  onRecenter?: () => void;
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
 * see the design note. The pose arrives pre-filtered (accuracy-gated GPS,
 * low-passed compass, declination + screen-orientation corrected) from
 * useGeoPose, and full yaw/pitch/roll is applied via the standard
 * device-orientation quaternion.
 */
export function GeoMarkerOverlay({
  annotations,
  active,
  onPlace,
  defensibleZones,
  pose,
  onRecenter,
}: GeoMarkerOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const markersRef = useRef<MarkerObj[]>([]);
  // Filled defensible-space zones: meshes built once relative to a local origin;
  // the group is repositioned each frame from the GPS fix.
  const zonesGroupRef = useRef<THREE.Group | null>(null);
  const zoneMeshesRef = useRef<THREE.Mesh[]>([]);
  const zoneOriginRef = useRef<GeoCoordinates | null>(null);
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
  const [showZones, setShowZones] = useState(true);
  // User-calibrated ground height (metres below the camera); ref-mirrored for
  // the render loop, persisted across sessions.
  const [groundDrop, setGroundDrop] = useState(loadGroundDrop);
  const groundDropRef = useRef(groundDrop);
  groundDropRef.current = groundDrop;

  const nudgeGround = (deltaM: number) => {
    setGroundDrop((prev) => {
      const next = Math.min(
        GROUND_DROP_MAX_M,
        Math.max(GROUND_DROP_MIN_M, Math.round((prev + deltaM) / GROUND_DROP_STEP_M) * GROUND_DROP_STEP_M)
      );
      try {
        localStorage.setItem(GROUND_DROP_STORAGE_KEY, String(next));
      } catch {
        // blocked storage — the nudge still applies this session
      }
      return next;
    });
  };

  // Toggle the on-ground filled zones with the show/hide control.
  useEffect(() => {
    if (zonesGroupRef.current) zonesGroupRef.current.visible = showZones;
  }, [showZones]);

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

    const zonesGroup = new THREE.Group();
    scene.add(zonesGroup);

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    zonesGroupRef.current = zonesGroup;

    return () => {
      window.removeEventListener('resize', resize);
      for (const m of zoneMeshesRef.current) {
        zonesGroup.remove(m);
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
      zoneMeshesRef.current = [];
      renderer.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      zonesGroupRef.current = null;
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

  // --- (re)build filled defensible-space zone meshes when the polygons change.
  // Triangulate each zone once, relative to a shared local origin (its centroid);
  // the render loop then just repositions the group from the live GPS fix. ---
  useEffect(() => {
    const group = zonesGroupRef.current;
    if (!group) return;

    const dispose = () => {
      for (const m of zoneMeshesRef.current) {
        group.remove(m);
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
      zoneMeshesRef.current = [];
    };
    dispose();

    const zones = defensibleZones ?? [];
    const originRing = zones.length ? zoneOuterRing(zones[0]) : null;
    if (!originRing || originRing.length < 2) {
      zoneOriginRef.current = null;
      return dispose;
    }
    const origin = ringCentroidGeo(originRing);
    zoneOriginRef.current = origin;

    for (const feature of zones) {
      const ring = zoneOuterRing(feature);
      if (!ring || ring.length < 2) continue;
      const zone = Number(feature.properties?.zone ?? 2);
      const shape = new THREE.Shape();
      for (let i = 0; i < ring.length; i++) {
        const enu = geoToEnu(origin, { latitude: ring[i][1], longitude: ring[i][0] });
        if (i === 0) shape.moveTo(enu.east, enu.north);
        else shape.lineTo(enu.east, enu.north);
      }
      const geom = new THREE.ShapeGeometry(shape);
      geom.rotateX(-Math.PI / 2); // lay the shape flat on the ground plane
      const mat = new THREE.MeshBasicMaterial({
        color: ZONE_COLORS[zone] ?? 0xeab308,
        transparent: true,
        opacity: ZONE_FILL_OPACITY[zone] ?? 0.2,
        side: THREE.DoubleSide,
        depthTest: false, // coplanar fills — order by renderOrder, no z-fighting
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.renderOrder = 2 - zone; // draw Zone 2 first, Zone 0 on top
      mesh.frustumCulled = false;
      group.add(mesh);
      zoneMeshesRef.current.push(mesh);
    }

    return dispose;
  }, [defensibleZones]);

  // --- render loop ---
  useEffect(() => {
    if (!enabled || !active) return;

    const loop = () => {
      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const { coords, heading, beta, gamma, screenAngle } = poseRef.current;

      if (renderer && scene && camera) {
        // Orient the camera from the (filtered) device pose using the standard
        // W3C quaternion mapping — valid in any screen orientation, unlike the
        // previous portrait-only per-axis Euler assignment.
        if (heading !== null && beta !== null && gamma !== null) {
          applyDevicePoseToCamera(camera, heading, beta, gamma, screenAngle);
        } else if (heading !== null) {
          // Compass only (no tilt yet): yaw toward the heading at the horizon.
          camera.rotation.set(0, -THREE.MathUtils.degToRad(heading), 0);
        }

        if (coords) {
          for (const { sprite, annotation } of markersRef.current) {
            const enu = geoToEnu(coords, annotation.coordinates);
            // Clamp depth so very near/far markers stay on screen.
            const dist = Math.hypot(enu.east, enu.north) || 1;
            const k = Math.min(MAX_DIST, Math.max(MIN_DIST, dist)) / dist;
            const p = enuToThree({ east: enu.east * k, north: enu.north * k, up: 0 }, 0);
            sprite.position.set(p.x, p.y, p.z);
          }

          // Defensible-space zones: reposition the filled group so its local
          // origin sits at the origin's real-world offset from the user, on the
          // dropped ground plane. The camera is rotated by the pose.
          const zGroup = zonesGroupRef.current;
          const origin = zoneOriginRef.current;
          if (zGroup && origin) {
            const enu = geoToEnu(coords, origin);
            const p = enuToThree({ east: enu.east, north: enu.north, up: -groundDropRef.current }, 0);
            zGroup.position.set(p.x, p.y, p.z);
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
      drawZoneRadar(radarRef.current, poseRef.current, zonesPropRef.current, targetCoordsRef.current);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [enabled]);

  // Drop a marker ahead of the user along the current heading (Phase 4). The
  // distance is user-adjustable; with no compass we fall back to the user's
  // exact GPS position.
  const [dropAhead, setDropAhead] = useState(DROP_AHEAD_DEFAULT_M);
  const nudgeDropAhead = (deltaM: number) => {
    setDropAhead((prev) =>
      Math.min(DROP_AHEAD_MAX_M, Math.max(DROP_AHEAD_MIN_M, prev + deltaM))
    );
  };
  const handleDrop = () => {
    const { coords, heading } = poseRef.current;
    if (!coords) return;
    let placed: GeoCoordinates = coords;
    if (heading !== null) {
      const h = THREE.MathUtils.degToRad(heading);
      placed = enuToGeo(coords, Math.sin(h) * dropAhead, Math.cos(h) * dropAhead);
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

  // Wayfinding target: tap a marker chip to navigate to it. The pointer chip
  // shows the relative bearing (rotating arrow) + live distance; the radar
  // draws the target as a dot (rim-clamped when out of range).
  const [targetId, setTargetId] = useState<string | null>(null);
  const target = useMemo(
    () => (targetId ? annotations.find((a) => a.id === targetId) ?? null : null),
    [annotations, targetId]
  );
  useEffect(() => {
    if (targetId && !annotations.some((a) => a.id === targetId)) setTargetId(null);
  }, [annotations, targetId]);
  const targetCoordsRef = useRef<GeoCoordinates | null>(null);
  targetCoordsRef.current = target?.coordinates ?? null;

  // Relative bearing (degrees, + = clockwise/right) and distance to the target.
  const targetNav = useMemo(() => {
    if (!target || !pose.coords) return null;
    const dist = distanceMeters(pose.coords, target.coordinates);
    const rel =
      pose.heading !== null
        ? angleDiffDeg(bearingDeg(pose.coords, target.coordinates), pose.heading)
        : null;
    return { dist, rel };
  }, [target, pose.coords, pose.heading]);

  // Chips: the target stays pinned first even when it falls out of the top 4.
  const displayChips = useMemo(() => {
    if (!targetId) return ranked.slice(0, 4);
    const t = ranked.find((r) => r.a.id === targetId);
    const rest = ranked.filter((r) => r.a.id !== targetId).slice(0, 3);
    return t ? [t, ...rest] : rest;
  }, [ranked, targetId]);

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

      {/* Show/hide defensible space (ground fills + radar). Sits below the AR
          mode selector (top-4 left) so it isn't covered by it. Only shown when
          zones are supplied (i.e. the 3D-model mode, not live scan). */}
      {active && enabled && (
        <div className="absolute top-20 left-4 z-10 flex flex-col gap-1.5">
          {(defensibleZones?.length ?? 0) > 0 && (
            <button
              onClick={() => setShowZones((v) => !v)}
              className="pointer-events-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/55 backdrop-blur text-white text-xs font-medium shadow-lg"
            >
              {showZones ? <EyeIcon className="w-4 h-4" /> : <EyeSlashIcon className="w-4 h-4" />}
              Defensible space
            </button>
          )}

          {/* Ground-height calibration: nudge the ground plane until the zone
              bands sit on the real ground (no depth sensing on this path). */}
          {(defensibleZones?.length ?? 0) > 0 && showZones && (
            <div className="pointer-events-auto flex items-center gap-1 px-2 py-1 rounded-lg bg-black/55 backdrop-blur text-white text-xs shadow-lg">
              <span className="pr-1">Ground {groundDrop.toFixed(2).replace(/\.?0+$/, '')}m</span>
              <button
                onClick={() => nudgeGround(-GROUND_DROP_STEP_M)}
                disabled={groundDrop <= GROUND_DROP_MIN_M}
                className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 disabled:opacity-40 font-mono"
                title="Raise the ground plane"
                aria-label="Raise the ground plane"
              >
                ▲
              </button>
              <button
                onClick={() => nudgeGround(GROUND_DROP_STEP_M)}
                disabled={groundDrop >= GROUND_DROP_MAX_M}
                className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 disabled:opacity-40 font-mono"
                title="Lower the ground plane"
                aria-label="Lower the ground plane"
              >
                ▼
              </button>
            </div>
          )}

          {/* North calibration: rotate the AR world in small steps until
              markers/zones line up with reality (persisted per device —
              corrects residual compass bias beyond automatic declination). */}
          {pose.heading !== null && (
            <div className="pointer-events-auto flex items-center gap-1 px-2 py-1 rounded-lg bg-black/55 backdrop-blur text-white text-xs shadow-lg">
              <span className="pr-1">
                North{pose.headingTrim !== 0 ? ` ${pose.headingTrim > 0 ? '+' : ''}${pose.headingTrim}°` : ''}
              </span>
              <button
                onClick={() => pose.adjustHeadingTrim(-HEADING_TRIM_STEP_DEG)}
                disabled={pose.headingTrim <= -HEADING_TRIM_MAX_DEG}
                className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 disabled:opacity-40 font-mono"
                title="Rotate AR content counter-clockwise"
                aria-label="Rotate AR content counter-clockwise"
              >
                ◀
              </button>
              <button
                onClick={() => pose.adjustHeadingTrim(HEADING_TRIM_STEP_DEG)}
                disabled={pose.headingTrim >= HEADING_TRIM_MAX_DEG}
                className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 disabled:opacity-40 font-mono"
                title="Rotate AR content clockwise"
                aria-label="Rotate AR content clockwise"
              >
                ▶
              </button>
            </div>
          )}

          {/* Re-stamp the zone center at the user's position ("stand at the
              structure"). Closes the long-standing set/nudge-center TODO. */}
          {(defensibleZones?.length ?? 0) > 0 && showZones && onRecenter && pose.coords && (
            <button
              onClick={onRecenter}
              className="pointer-events-auto px-2.5 py-1.5 rounded-lg bg-black/55 backdrop-blur text-white text-xs font-medium shadow-lg text-left"
            >
              Center zones here
            </button>
          )}
        </div>
      )}

      {/* Top-down zone radar — always-visible view of the zones around you,
          independent of AR pitch/tracking (the reliable path on iOS). */}
      {enabled && showZones && (defensibleZones?.length ?? 0) > 0 && (
        <canvas
          ref={radarRef}
          width={180}
          height={180}
          className="absolute top-4 right-4 rounded-full pointer-events-none"
          style={{ width: 92, height: 92 }}
        />
      )}

      {/* Drop a marker ahead (Phase 4: AR → map), at a user-chosen distance. */}
      {enabled && onPlace && pose.coords && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 pointer-events-auto flex items-center gap-1.5">
          <button
            onClick={() => nudgeDropAhead(-DROP_AHEAD_STEP_M)}
            disabled={dropAhead <= DROP_AHEAD_MIN_M}
            className="px-2.5 py-2.5 rounded-full bg-black/55 backdrop-blur text-white text-sm font-semibold shadow-lg disabled:opacity-40"
            title="Drop closer"
            aria-label="Decrease drop distance"
          >
            −
          </button>
          <button
            onClick={handleDrop}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-fire-600 text-white text-sm font-semibold shadow-lg"
          >
            <MapPinIcon className="w-4 h-4" />
            Drop marker {dropAhead % 1 === 0 ? dropAhead : dropAhead.toFixed(1)}m ahead
          </button>
          <button
            onClick={() => nudgeDropAhead(DROP_AHEAD_STEP_M)}
            disabled={dropAhead >= DROP_AHEAD_MAX_M}
            className="px-2.5 py-2.5 rounded-full bg-black/55 backdrop-blur text-white text-sm font-semibold shadow-lg disabled:opacity-40"
            title="Drop farther"
            aria-label="Increase drop distance"
          >
            +
          </button>
        </div>
      )}

      {/* Wayfinding pointer: rotating bearing arrow + live distance to the
          selected marker. Pitch-independent, like the radar. Tap to clear. */}
      {enabled && target && targetNav && (
        <button
          onClick={() => setTargetId(null)}
          className="absolute top-28 left-1/2 -translate-x-1/2 z-10 pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur text-white text-xs shadow-lg"
          title="Tap to stop navigating"
        >
          {targetNav.rel !== null ? (
            <svg
              viewBox="0 0 24 24"
              className="w-4 h-4 text-fire-500"
              style={{ transform: `rotate(${Math.round(targetNav.rel)}deg)` }}
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 2 L18 20 L12 16 L6 20 Z" />
            </svg>
          ) : (
            <span className="text-white/60">no compass ·</span>
          )}
          <span className="font-medium">{target.content.title}</span>
          <span className="text-white/70 tabular-nums">
            {targetNav.dist < 1000
              ? `${Math.round(targetNav.dist)}m`
              : `${(targetNav.dist / 1000).toFixed(1)}km`}
            {targetNav.rel !== null && Math.abs(targetNav.rel) <= 20 ? ' · ahead' : ''}
          </span>
        </button>
      )}

      {/* Nearest-markers HUD — tap a chip to navigate to that marker. */}
      {enabled && displayChips.length > 0 && (
        <div className="absolute bottom-4 left-4 right-4 flex gap-2 overflow-x-auto pointer-events-none">
          {displayChips.map(({ a, dist }) => (
            <button
              key={a.id}
              onClick={() => setTargetId((prev) => (prev === a.id ? null : a.id))}
              className={`pointer-events-auto flex items-center gap-2 px-2.5 py-1.5 rounded-lg backdrop-blur text-white text-xs whitespace-nowrap ${
                a.id === targetId ? 'bg-fire-600' : 'bg-black/55'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: RISK_CSS[annotationRisk(a.content)] }}
              />
              {a.content.title} · {dist < 1000 ? `${Math.round(dist)}m` : `${(dist / 1000).toFixed(1)}km`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
