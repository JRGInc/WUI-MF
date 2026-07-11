import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useWebXR } from '../hooks/useWebXR';
import { useHitTest } from '../hooks/useHitTest';
import { useARMeasurement } from '../hooks/useARMeasurement';
import { useXRCameraCapture } from '../hooks/useXRCameraCapture';
import { useFrameAnalysisLoop } from '@/features/computer-vision/hooks/useFrameAnalysisLoop';
import { geoToEnu, enuToThree } from '../utils/geoEnu';
import { makeMarkerSprite, disposeMarkerSprite } from '../utils/markerSprite';
import { annotationRisk } from '@/shared/utils/annotationStyle';
import { zoneOuterRing } from '@/shared/utils/defensibleZones';
import type { GeoPose } from '../hooks/useGeoPose';
import type { DetectedRisk, MapAnnotation } from '@/shared/types';

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
  // Experimental: geo-anchored map markers inside the XR scene. Positioned by
  // geoToEnu from the device GPS fix and continuously yaw-aligned to the compass
  // heading. Accuracy is GPS/compass-bound and depends on orientation permission.
  geoAnnotations?: MapAnnotation[];
  geoPose?: GeoPose;
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
  defensibleZones,
}: WebXRSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const reticleRef = useRef<THREE.Mesh | null>(null);
  const pointMeshesRef = useRef<THREE.Mesh[]>([]);
  const lineRef = useRef<THREE.Line | null>(null);
  const currentFrameRef = useRef<XRFrame | null>(null);

  // Geo-marker group + the sprites in it; pose read via a ref so the animation
  // loop (set up once) always sees the latest fix without re-binding.
  const geoGroupRef = useRef<THREE.Group | null>(null);
  const geoMarkersRef = useRef<{ sprite: THREE.Sprite; annotation: MapAnnotation }[]>([]);
  const geoPoseRef = useRef<GeoPose | undefined>(geoPose);
  geoPoseRef.current = geoPose;

  // Defensible-space zone outlines: a yaw-aligned group of LineLoops whose
  // vertices are re-projected from the GPS fix each frame (same as geo markers).
  const zonesGroupRef = useRef<THREE.Group | null>(null);
  const zoneLinesRef = useRef<ZoneLine[]>([]);

  const { isSupported, session, referenceSpace, startSession, endSession } = useWebXR();
  const measurement = useARMeasurement();
  const measurementRef = useRef(measurement);
  measurementRef.current = measurement;

  const [startError, setStartError] = useState<string | null>(null);

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

    const geoGroup = new THREE.Group();
    scene.add(geoGroup);

    const zonesGroup = new THREE.Group();
    scene.add(zonesGroup);

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    reticleRef.current = reticle;
    lineRef.current = line;
    geoGroupRef.current = geoGroup;
    zonesGroupRef.current = zonesGroup;

    return () => {
      pointMeshesRef.current.forEach((m) => {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
        scene.remove(m);
      });
      pointMeshesRef.current = [];
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
      geoGroupRef.current = null;
      zonesGroupRef.current = null;
    };
  }, []);

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
      geoMarkersRef.current.push({ sprite, annotation });
    }
  }, [geoAnnotations]);

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
      zline.frustumCulled = false; // verts are rewritten each frame from GPS
      group.add(zline);
      zoneLinesRef.current.push({ line: zline, ring, positions });
    }
  }, [defensibleZones]);

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

      const pointGeom = new THREE.SphereGeometry(0.03, 16, 16);
      const pointMat = new THREE.MeshBasicMaterial({ color: 0xdc2626 });
      const pointMesh = new THREE.Mesh(pointGeom, pointMat);
      pointMesh.position.set(x, y, z);
      scene.add(pointMesh);
      pointMeshesRef.current.push(pointMesh);

      measurementRef.current.addPoint({ x, y, z });

      const points = pointMeshesRef.current;
      if (points.length >= 2) {
        const a = points[points.length - 2].position;
        const b = points[points.length - 1].position;
        (line.geometry as THREE.BufferGeometry).setFromPoints([a, b]);
        line.visible = true;
      }
    };
    session.addEventListener('select', handleSelect);

    renderer.setAnimationLoop((_, frame) => {
      currentFrameRef.current = frame ?? null;

      const hit = latestHitRef.current;
      if (hit) {
        reticle.visible = true;
        reticle.matrix.fromArray(hit.matrix);
      } else {
        reticle.visible = false;
      }

      // Fulfil any pending XR camera capture request inside the frame.
      if (frame) xrCapture.tick(frame);

      // Experimental geo markers: position each by geoToEnu and continuously
      // yaw-align the group so ENU-north maps to the compass heading relative to
      // the XR camera's current yaw. (Approximate — XR space has no true north.)
      const group = geoGroupRef.current;
      const pose = geoPoseRef.current;
      if (group && pose?.coords && geoMarkersRef.current.length > 0) {
        for (const { sprite, annotation } of geoMarkersRef.current) {
          const enu = geoToEnu(pose.coords, annotation.coordinates);
          const dist = Math.hypot(enu.east, enu.north) || 1;
          const k = Math.min(XR_MAX_DIST, Math.max(XR_MIN_DIST, dist)) / dist;
          const p = enuToThree({ east: enu.east * k, north: enu.north * k, up: 0 }, 0);
          sprite.position.set(p.x, p.y, p.z);
        }
        if (pose.heading !== null) {
          const camYaw = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ').y;
          group.rotation.y = camYaw + THREE.MathUtils.degToRad(pose.heading);
        }
      }

      // Defensible-space zones: re-project each ring vertex onto the floor plane
      // (local-floor → y = 0) from the current GPS fix, and yaw-align the group
      // like the markers. The zone outlines follow the building footprint.
      const zGroup = zonesGroupRef.current;
      if (zGroup && pose?.coords && zoneLinesRef.current.length > 0) {
        for (const { line: zline, ring, positions } of zoneLinesRef.current) {
          for (let i = 0; i < ring.length; i++) {
            const enu = geoToEnu(pose.coords, { latitude: ring[i][1], longitude: ring[i][0] });
            const p = enuToThree({ east: enu.east, north: enu.north, up: 0 }, 0);
            positions[i * 3] = p.x;
            positions[i * 3 + 1] = 0; // local-floor reference space: y = 0 is the floor
            positions[i * 3 + 2] = p.z;
          }
          (zline.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
        }
        if (pose.heading !== null) {
          const camYaw = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ').y;
          zGroup.rotation.y = camYaw + THREE.MathUtils.degToRad(pose.heading);
        }
      }

      renderer.render(scene, camera);
    });

    return () => {
      session.removeEventListener('select', handleSelect);
      renderer.setAnimationLoop(null);
      currentFrameRef.current = null;
    };
  }, [session, latestHitRef, xrCapture]);

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

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
    />
  );
}
