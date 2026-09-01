import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ArrowsRightLeftIcon, MapPinIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useWebXR } from '../hooks/useWebXR';
import { useHitTest } from '../hooks/useHitTest';
import { useARMeasurement } from '../hooks/useARMeasurement';
import { useXRCameraCapture } from '../hooks/useXRCameraCapture';
import { useFrameAnalysisLoop } from '@/features/computer-vision/hooks/useFrameAnalysisLoop';
import { geoToEnu, enuToThree, threeToEnu, enuToGeo } from '../utils/geoEnu';
import { GroundHeightEstimator, YawAligner } from '../utils/poseFilters';
import { makeMarkerSprite, makeTextPillSprite, disposeMarkerSprite } from '../utils/markerSprite';
import { annotationRisk } from '@/shared/utils/annotationStyle';
import { zoneOuterRing } from '@/shared/utils/defensibleZones';
import { track } from '@/shared/services/analytics';
import type { GeoPose } from '../hooks/useGeoPose';
import type { DetectedRisk, GeoCoordinates, MapAnnotation } from '@/shared/types';

// XR markers nearer/farther than this are depth-clamped (XR far plane is 50 m).
const XR_MIN_DIST = 2;
const XR_MAX_DIST = 40;

// Defensible-space zone outline colors (match the map + legend).
const ZONE_COLORS: Record<number, number> = { 0: 0xef4444, 1: 0xf97316, 2: 0xeab308 };

interface ZoneLine {
  line: THREE.LineLoop;
  ring: number[][]; // lng/lat pairs, re-projected to floor coords each frame
  positions: Float32Array;
}

interface WebXRSceneProps {
  domOverlayRoot: HTMLElement | null;
  onSessionEnd?: () => void;
  // Live-CV opt-in. Requires the session to have been granted camera-access.
  enableLiveScan?: boolean;
  scanIntervalMs?: number;
  onRisks?: (risks: DetectedRisk[]) => void;
  onScanState?: (state: { isAnalyzing: boolean; cameraAccessAvailable: boolean }) => void;
  // Geo-anchored map markers inside the XR scene. North alignment is settled
  // once from a filtered compass average, the geo origin is stamped from the
  // gated GPS fix, and the content is then held by an XRAnchor (static
  // transform where anchors are unsupported) — the compass never steers the
  // scene after settle. Accuracy is GPS/compass-bound at stamp time.
  geoAnnotations?: MapAnnotation[];
  geoPose?: GeoPose;
  // Called with the real-world coordinate of the reticle hit when the user
  // drops a marker — the XR twin of the compass path's onPlace, but placed
  // where the user actually aimed (hit-test point → group-local ENU → lat/lng).
  onPlace?: (coords: GeoCoordinates) => void;
  // Re-stamp the zone center at the aimed reticle position ("aim at the
  // structure's base and tap") — the XR calibration for a bad first fix.
  onRecenterZones?: (coords: GeoCoordinates) => void;
  // Defensible-space zone polygons (GeoJSON, `zone` property 0/1/2) from the
  // shared `footprintZoneFeatures`/`circleZoneFeatures`. Drawn as ground outlines
  // on the local-floor plane, projected from the device GPS fix and yaw-aligned
  // to the compass — same bridge as the geo markers. Reuses the map's geometry.
  defensibleZones?: GeoJSON.Feature[];
}

export function WebXRScene({
  domOverlayRoot,
  onSessionEnd,
  enableLiveScan = false,
  scanIntervalMs = 2500,
  onRisks,
  onScanState,
  geoAnnotations,
  geoPose,
  onPlace,
  onRecenterZones,
  defensibleZones,
}: WebXRSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const reticleRef = useRef<THREE.Mesh | null>(null);
  // All measurement visuals (endpoint spheres, segment lines, distance labels)
  // live in one group, rebuilt declaratively from the hook's state.
  const measureGroupRef = useRef<THREE.Group | null>(null);
  // Rubber-band preview from the pending point to the current reticle hit.
  const lineRef = useRef<THREE.Line | null>(null);
  const currentFrameRef = useRef<XRFrame | null>(null);
  // Detected ground height (from floor hit-test results) — `local-floor`'s
  // y = 0 is only the UA's estimate; this tracks where the ground actually is.
  const groundRef = useRef(new GroundHeightEstimator(0));

  // Geo content (markers + zones) lives under one group whose transform is the
  // XR-space pose of the geo origin: settled once from the compass, then held
  // by an XRAnchor (or a static transform where anchors are unsupported) so
  // the VIO tracker — not the compass — keeps it stable. Pose is read via a
  // ref so the animation loop (set up once) always sees the latest fix.
  const geoContentGroupRef = useRef<THREE.Group | null>(null);
  const geoGroupRef = useRef<THREE.Group | null>(null);
  const geoMarkersRef = useRef<
    { sprite: THREE.Sprite; annotation: MapAnnotation; local: THREE.Vector3 }[]
  >([]);
  const geoPoseRef = useRef<GeoPose | undefined>(geoPose);
  geoPoseRef.current = geoPose;

  // North alignment + anchoring state (reset per session).
  const alignerRef = useRef(new YawAligner());
  const geoOriginRef = useRef<GeoCoordinates | null>(null);
  const anchorRef = useRef<XRAnchor | null>(null);
  const anchorRequestedRef = useRef(false);
  const [aligned, setAligned] = useState(false);

  // Defensible-space zone outlines: LineLoops whose vertices are laid out once
  // relative to the geo origin (see layoutGeoContent).
  const zonesGroupRef = useRef<THREE.Group | null>(null);
  const zoneLinesRef = useRef<ZoneLine[]>([]);

  const { isSupported, session, referenceSpace, startSession, endSession } = useWebXR();
  const measurement = useARMeasurement();
  const { measurements, pendingPoint, format } = measurement;
  const measurementRef = useRef(measurement);
  measurementRef.current = measurement;

  const [startError, setStartError] = useState<string | null>(null);
  // True once the session delivers GPU depth data (three.js then runs its
  // occlusion depth prepass automatically). Surfaced so testers can tell
  // depth-capable devices from ones where the feature wasn't granted.
  const [occlusionActive, setOcclusionActive] = useState(false);

  const getFrame = useCallback(() => currentFrameRef.current, []);
  const latestHitRef = useHitTest({
    session,
    referenceSpace,
    getFrame,
    enabled: !!session,
  });

  const xrCapture = useXRCameraCapture({
    rendererRef,
    session,
    refSpace: referenceSpace,
  });

  // The capture function the analysis loop calls. The XR animation loop
  // fulfils each request on its next tick via xrCapture.tick(frame).
  const liveScanState = useFrameAnalysisLoop(xrCapture.captureFn, {
    enabled: enableLiveScan && !!session,
    intervalMs: scanIntervalMs,
  });

  // Notify parent of risks + camera-access availability whenever they change.
  useEffect(() => {
    onRisks?.(liveScanState.risks);
  }, [liveScanState.risks, onRisks]);

  useEffect(() => {
    onScanState?.({
      isAnalyzing: liveScanState.isAnalyzing,
      cameraAccessAvailable: xrCapture.isAvailable(),
    });
  }, [liveScanState.isAnalyzing, xrCapture, onScanState]);

  // --- Scene setup ---
  useEffect(() => {
    if (!canvasRef.current) return;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 50);

    const reticleGeom = new THREE.RingGeometry(0.07, 0.09, 32).rotateX(-Math.PI / 2);
    const reticleMat = new THREE.MeshBasicMaterial({ color: 0xdc2626 });
    const reticle = new THREE.Mesh(reticleGeom, reticleMat);
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    const lineMat = new THREE.LineBasicMaterial({ color: 0xdc2626 });
    const lineGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
    ]);
    const line = new THREE.Line(lineGeom, lineMat);
    line.visible = false;
    scene.add(line);

    // Hidden until the north alignment settles — showing content while the
    // compass average converges would flash visibly-wrong placement.
    const geoContentGroup = new THREE.Group();
    geoContentGroup.visible = false;
    scene.add(geoContentGroup);

    const geoGroup = new THREE.Group();
    geoContentGroup.add(geoGroup);

    const zonesGroup = new THREE.Group();
    geoContentGroup.add(zonesGroup);

    const measureGroup = new THREE.Group();
    scene.add(measureGroup);

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    reticleRef.current = reticle;
    lineRef.current = line;
    geoContentGroupRef.current = geoContentGroup;
    geoGroupRef.current = geoGroup;
    zonesGroupRef.current = zonesGroup;
    measureGroupRef.current = measureGroup;

    return () => {
      disposeMeasureVisuals(measureGroup);
      reticleGeom.dispose();
      reticleMat.dispose();
      lineGeom.dispose();
      lineMat.dispose();
      geoMarkersRef.current.forEach(({ sprite }) => {
        geoGroup.remove(sprite);
        disposeMarkerSprite(sprite);
      });
      geoMarkersRef.current = [];
      zoneLinesRef.current.forEach(({ line: zline }) => {
        zonesGroup.remove(zline);
        zline.geometry.dispose();
        (zline.material as THREE.Material).dispose();
      });
      zoneLinesRef.current = [];
      renderer.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      reticleRef.current = null;
      lineRef.current = null;
      geoContentGroupRef.current = null;
      geoGroupRef.current = null;
      zonesGroupRef.current = null;
      measureGroupRef.current = null;
    };
  }, []);

  // Lay out geo content in group-local ENU coordinates relative to the frozen
  // geo origin (BFMA-style: the origin is stamped once at alignment settle and
  // never chases later GPS fixes — the tracker owns stability from there).
  const layoutGeoContent = useCallback(() => {
    const origin = geoOriginRef.current;
    if (!origin) return;
    for (const marker of geoMarkersRef.current) {
      const enu = geoToEnu(origin, marker.annotation.coordinates);
      const p = enuToThree({ east: enu.east, north: enu.north, up: 0 }, 0);
      marker.local.set(p.x, 0, p.z);
    }
    for (const { line: zline, ring, positions } of zoneLinesRef.current) {
      for (let i = 0; i < ring.length; i++) {
        const enu = geoToEnu(origin, { latitude: ring[i][1], longitude: ring[i][0] });
        const p = enuToThree({ east: enu.east, north: enu.north, up: 0 }, 0);
        positions[i * 3] = p.x;
        positions[i * 3 + 1] = 0; // group carries the detected ground height
        positions[i * 3 + 2] = p.z;
      }
      (zline.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    }
  }, []);

  // Rebuild the measurement visuals whenever the measurement state changes:
  // spheres at every placed point, a line + billboard distance label per
  // completed segment. Counts stay small, so a full rebuild is the simple,
  // leak-proof option (unit changes re-render the labels too).
  useEffect(() => {
    const group = measureGroupRef.current;
    if (!group) return;
    disposeMeasureVisuals(group);

    const addSphere = (p: { x: number; y: number; z: number }) => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.03, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xdc2626 })
      );
      mesh.position.set(p.x, p.y, p.z);
      group.add(mesh);
    };

    for (const m of measurements) {
      addSphere(m.start);
      addSphere(m.end);

      const start = new THREE.Vector3(m.start.x, m.start.y, m.start.z);
      const end = new THREE.Vector3(m.end.x, m.end.y, m.end.z);
      const segLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([start, end]),
        new THREE.LineBasicMaterial({ color: 0xdc2626 })
      );
      group.add(segLine);

      const label = makeTextPillSprite(format(m.distanceM));
      label.position.copy(start).add(end).multiplyScalar(0.5);
      label.position.y += 0.12;
      group.add(label);
    }
    if (pendingPoint) addSphere(pendingPoint);
  }, [measurements, pendingPoint, format]);

  // Analytics: one event per completed segment.
  const trackedCountRef = useRef(0);
  useEffect(() => {
    const count = measurements.length;
    if (count > trackedCountRef.current) {
      const last = measurements[count - 1];
      void track('ar_measurement_completed', { distanceM: Number(last.distanceM.toFixed(2)) });
    }
    trackedCountRef.current = count;
  }, [measurements]);

  // (Re)build geo-marker sprites when the annotation set changes.
  useEffect(() => {
    const group = geoGroupRef.current;
    if (!group) return;

    geoMarkersRef.current.forEach(({ sprite }) => {
      group.remove(sprite);
      disposeMarkerSprite(sprite);
    });
    geoMarkersRef.current = [];

    for (const annotation of geoAnnotations ?? []) {
      const sprite = makeMarkerSprite(annotation.content.title, annotationRisk(annotation.content));
      group.add(sprite);
      geoMarkersRef.current.push({ sprite, annotation, local: new THREE.Vector3() });
    }
    layoutGeoContent();
  }, [geoAnnotations, layoutGeoContent]);

  // (Re)build zone LineLoops when the zone polygons change. Vertices are filled
  // in each frame from the live GPS fix (see the render loop).
  useEffect(() => {
    const group = zonesGroupRef.current;
    if (!group) return;

    zoneLinesRef.current.forEach(({ line: zline }) => {
      group.remove(zline);
      zline.geometry.dispose();
      (zline.material as THREE.Material).dispose();
    });
    zoneLinesRef.current = [];

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
      const zline = new THREE.LineLoop(geom, mat);
      zline.frustumCulled = false; // verts are laid out after the origin settles
      group.add(zline);
      zoneLinesRef.current.push({ line: zline, ring, positions });
    }
    layoutGeoContent();
  }, [defensibleZones, layoutGeoContent]);

  // Real-world coordinate of the current reticle hit. The anchored content
  // group's local frame *is* the ENU frame around the frozen geo origin
  // (layoutGeoContent builds content with enuToThree at heading 0), so
  // world → group-local → threeToEnu → enuToGeo inverts the whole bridge.
  const reticleHitToGeo = useCallback((): GeoCoordinates | null => {
    const hit = latestHitRef.current;
    const group = geoContentGroupRef.current;
    const origin = geoOriginRef.current;
    if (!hit || !group || !origin) return null;
    const p = new THREE.Vector3(hit.position[0], hit.position[1], hit.position[2]);
    group.updateMatrixWorld();
    group.worldToLocal(p);
    const enu = threeToEnu({ x: p.x, y: p.y, z: p.z }, 0);
    return enuToGeo(origin, enu.east, enu.north);
  }, [latestHitRef]);

  const handleDropAtReticle = useCallback(() => {
    const coords = reticleHitToGeo();
    if (coords && onPlace) onPlace(coords);
  }, [reticleHitToGeo, onPlace]);

  const handleRecenterAtReticle = useCallback(() => {
    const coords = reticleHitToGeo();
    if (coords && onRecenterZones) onRecenterZones(coords);
  }, [reticleHitToGeo, onRecenterZones]);

  // Discard the settled alignment and anchor, and re-settle from the live
  // compass — the XR remedy when content looks rotated relative to reality.
  const handleRealign = useCallback(() => {
    alignerRef.current.reset();
    anchorRef.current?.delete?.();
    anchorRef.current = null;
    anchorRequestedRef.current = false;
    geoOriginRef.current = null;
    setAligned(false);
    if (geoContentGroupRef.current) geoContentGroupRef.current.visible = false;
  }, []);

  // Alignment and anchor state is per-session: reset when the session ends so
  // a new session re-settles from scratch.
  useEffect(() => {
    if (!session) return;
    const aligner = alignerRef.current;
    return () => {
      aligner.reset();
      anchorRef.current?.delete?.();
      anchorRef.current = null;
      anchorRequestedRef.current = false;
      geoOriginRef.current = null;
      setAligned(false);
      setOcclusionActive(false);
      if (geoContentGroupRef.current) geoContentGroupRef.current.visible = false;
    };
  }, [session]);

  // --- Start the XR session ---
  useEffect(() => {
    if (!isSupported || !rendererRef.current || session) return;
    let cancelled = false;
    (async () => {
      const s = await startSession({ domOverlayRoot });
      if (cancelled || !s || !rendererRef.current) return;
      try {
        await rendererRef.current.xr.setSession(s);
      } catch (err) {
        console.error('renderer.xr.setSession failed:', err);
        setStartError('Could not attach renderer to XR session.');
        return;
      }
      s.addEventListener('end', () => onSessionEnd?.());
    })();
    return () => {
      cancelled = true;
    };
  }, [isSupported, session, startSession, domOverlayRoot, onSessionEnd]);

  // --- Render loop, reticle, select handler, XR capture tick ---
  useEffect(() => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const reticle = reticleRef.current;
    const line = lineRef.current;
    if (!renderer || !scene || !camera || !reticle || !line || !session) return;

    const handleSelect = () => {
      const hit = latestHitRef.current;
      if (!hit) return;
      const [x, y, z] = hit.position;
      // Visuals are rebuilt declaratively from the measurement state.
      measurementRef.current.addPoint({ x, y, z });
    };
    session.addEventListener('select', handleSelect);

    // Scratch vector for the per-frame camera→group-local conversion.
    const camLocal = new THREE.Vector3();
    // Per-effect-run latch so setOcclusionActive fires once, not per frame.
    let occlusionFlipped = false;

    renderer.setAnimationLoop((_, frame) => {
      currentFrameRef.current = frame ?? null;

      const hit = latestHitRef.current;
      if (hit) {
        reticle.visible = true;
        reticle.matrix.fromArray(hit.matrix);
        // Every plausible floor hit refines the detected ground height.
        groundRef.current.update(hit.position[1], camera.position.y);
      } else {
        reticle.visible = false;
      }
      const groundY = groundRef.current.value;

      // Rubber-band preview: pending measurement point → current reticle hit.
      const pending = measurementRef.current.pendingPoint;
      if (pending && hit) {
        (line.geometry as THREE.BufferGeometry).setFromPoints([
          new THREE.Vector3(pending.x, pending.y, pending.z),
          new THREE.Vector3(hit.position[0], hit.position[1], hit.position[2]),
        ]);
        line.visible = true;
      } else {
        line.visible = false;
      }

      // Fulfil any pending XR camera capture request inside the frame.
      if (frame) xrCapture.tick(frame);

      // Flip the occlusion indicator once depth data starts flowing.
      if (!occlusionFlipped && renderer.xr.hasDepthSensing()) {
        occlusionFlipped = true;
        setOcclusionActive(true);
      }

      // Geo content (markers + zones): settle the north alignment once, then
      // hold it — first with a static transform, upgraded to an XRAnchor pose
      // when the session grants one — so the VIO tracker keeps content stable
      // instead of the compass re-steering it every frame.
      const contentGroup = geoContentGroupRef.current;
      const pose = geoPoseRef.current;
      const aligner = alignerRef.current;
      if (contentGroup) {
        if (!aligner.isSettled) {
          // Sample (camera yaw, filtered heading) pairs while the device is
          // roughly upright (the heading→view mapping degrades pointing down)
          // and a GPS fix exists to stamp the origin from.
          const upright = pose?.beta == null || (pose.beta > 40 && pose.beta < 140);
          if (pose?.heading != null && pose.coords && upright) {
            const camYaw = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ').y;
            aligner.push(camYaw, pose.heading);
            if (aligner.isSettled) {
              geoOriginRef.current = pose.coords;
              contentGroup.rotation.set(0, aligner.offsetRad!, 0);
              contentGroup.position.set(camera.position.x, groundY, camera.position.z);
              contentGroup.visible = true;
              layoutGeoContent();
              setAligned(true);
            }
          }
        } else {
          const anchor = anchorRef.current;
          if (anchor && frame && referenceSpace) {
            // Anchored: follow the anchor's tracked pose (tracker corrections
            // move content with the world instead of drifting off it).
            const anchorPose = frame.getPose(anchor.anchorSpace, referenceSpace);
            if (anchorPose) {
              const { position: ap, orientation: ao } = anchorPose.transform;
              contentGroup.position.set(ap.x, groundY, ap.z);
              contentGroup.quaternion.set(ao.x, ao.y, ao.z, ao.w);
            }
          } else {
            contentGroup.position.y = groundY;
            // Request the anchor once at the settled pose.
            if (!anchorRequestedRef.current && frame?.createAnchor && referenceSpace) {
              anchorRequestedRef.current = true;
              const q = new THREE.Quaternion().setFromEuler(contentGroup.rotation);
              frame
                .createAnchor(
                  new XRRigidTransform(
                    { x: contentGroup.position.x, y: 0, z: contentGroup.position.z, w: 1 },
                    { x: q.x, y: q.y, z: q.z, w: q.w }
                  ),
                  referenceSpace
                )
                .then((a) => {
                  anchorRef.current = a;
                })
                .catch(() => {
                  // Anchors unavailable — the static settled transform stands.
                });
            }
          }

          // Markers: keep the depth clamp so far-away pins stay inside the
          // 50 m far plane — clamped along the line of sight in group-local
          // space, driven by the tracked camera position (not GPS).
          if (geoMarkersRef.current.length > 0) {
            contentGroup.updateMatrixWorld();
            camLocal.copy(camera.position);
            contentGroup.worldToLocal(camLocal);
            for (const { sprite, local } of geoMarkersRef.current) {
              const dx = local.x - camLocal.x;
              const dz = local.z - camLocal.z;
              const dist = Math.hypot(dx, dz) || 1;
              const k = Math.min(XR_MAX_DIST, Math.max(XR_MIN_DIST, dist)) / dist;
              sprite.position.set(camLocal.x + dx * k, 0, camLocal.z + dz * k);
            }
          }
        }
      }

      renderer.render(scene, camera);
    });

    return () => {
      session.removeEventListener('select', handleSelect);
      renderer.setAnimationLoop(null);
      currentFrameRef.current = null;
    };
  }, [session, latestHitRef, xrCapture, referenceSpace, layoutGeoContent]);

  // End session on unmount
  useEffect(() => {
    return () => {
      endSession();
    };
  }, [endSession]);

  if (startError) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white p-4 text-center">
        {startError}
      </div>
    );
  }

  const latest = measurement.measurements[measurement.measurements.length - 1];
  const totalM = measurement.measurements.reduce((sum, m) => sum + m.distanceM, 0);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />

      {/* Measurement HUD — rendered via dom-overlay, so it stays visible
          inside the immersive session. */}
      {/* North-alignment status — geo content stays hidden until the compass
          average settles (~1.5 s of holding the phone upright). */}
      {session &&
        !aligned &&
        ((geoAnnotations?.length ?? 0) > 0 || (defensibleZones?.length ?? 0) > 0) && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
            <div className="px-4 py-2 rounded-full bg-black/70 text-white text-sm">
              Aligning to north — hold the phone upright…
            </div>
          </div>
        )}

      {/* Depth-occlusion indicator — depth-tested content (zones, reticle,
          measurements) hides behind real geometry on devices that grant it. */}
      {session && occlusionActive && (
        <div className="absolute bottom-6 left-4 z-10 pointer-events-none">
          <div className="px-2.5 py-1 rounded-full bg-black/55 text-white/80 text-xs">
            Occlusion on
          </div>
        </div>
      )}

      {session && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2 pointer-events-none">
          <div className="px-4 py-2 rounded-full bg-black/70 text-white text-sm">
            {measurement.pendingPoint
              ? 'Tap to place the second point'
              : 'Aim the reticle at the ground and tap to measure'}
          </div>

          {/* Drop a marker at the reticle — where the user actually aimed,
              unlike the compass path's heading-projected drop. Needs the geo
              origin, so it appears once north alignment settles. */}
          {onPlace && aligned && !measurement.pendingPoint && (
            <button
              onClick={handleDropAtReticle}
              className="pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-full bg-fire-600 text-white text-sm font-semibold shadow-lg"
            >
              <MapPinIcon className="w-4 h-4" />
              Drop marker at reticle
            </button>
          )}

          {/* Calibration row: re-stamp the zone center at the reticle, or
              throw away the settled north alignment and re-settle. */}
          {aligned && !measurement.pendingPoint && (
            <div className="flex items-center gap-2">
              {onRecenterZones && (defensibleZones?.length ?? 0) > 0 && (
                <button
                  onClick={handleRecenterAtReticle}
                  className="pointer-events-auto px-3 py-1.5 rounded-full bg-black/70 text-white text-xs font-medium"
                >
                  Center zones at reticle
                </button>
              )}
              <button
                onClick={handleRealign}
                className="pointer-events-auto px-3 py-1.5 rounded-full bg-black/70 text-white text-xs font-medium"
              >
                Re-align north
              </button>
            </div>
          )}

          {latest && (
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-black/70 backdrop-blur text-white pointer-events-auto">
              <span className="text-xl font-semibold tabular-nums">
                {measurement.format(latest.distanceM)}
              </span>
              {measurement.measurements.length > 1 && (
                <span className="text-xs text-white/70 tabular-nums">
                  {measurement.measurements.length} segments · total{' '}
                  {measurement.format(totalM)}
                </span>
              )}
              <button
                onClick={measurement.toggleUnit}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium"
                title="Switch units"
              >
                <ArrowsRightLeftIcon className="w-3.5 h-3.5" />
                {measurement.unit === 'feet' ? 'ft' : 'm'}
              </button>
              <button
                onClick={measurement.clearAll}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20"
                title="Clear measurements"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// Remove and free every measurement visual in the group (spheres, lines, labels).
function disposeMeasureVisuals(group: THREE.Group): void {
  for (const child of [...group.children]) {
    group.remove(child);
    if (child instanceof THREE.Sprite) {
      disposeMarkerSprite(child);
    } else if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
      child.geometry.dispose();
      (child.material as THREE.Material).dispose();
    }
  }
}
