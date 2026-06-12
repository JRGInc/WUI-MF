import { useEffect, useRef } from 'react';

// Per-frame hit-test against the user's pointer (viewer-space ray). Caller passes
// the active XR session + reference space and a `getFrame()` accessor that returns
// the current XRFrame from the renderer's animation loop (Three.js's
// `renderer.xr.getFrame()` after `setAnimationLoop` is active).
//
// Updates `latestPose` in place each frame; consumers read it via the ref so we
// don't spam React state on every RAF tick.

export interface HitPose {
  position: [number, number, number];
  matrix: Float32Array;
}

interface UseHitTestArgs {
  session: XRSession | null;
  referenceSpace: XRReferenceSpace | null;
  getFrame: () => XRFrame | null | undefined;
  enabled: boolean;
}

export function useHitTest({ session, referenceSpace, getFrame, enabled }: UseHitTestArgs) {
  const latestPoseRef = useRef<HitPose | null>(null);
  const sourceRef = useRef<XRHitTestSource | null>(null);

  useEffect(() => {
    if (!session || !referenceSpace || !enabled) {
      latestPoseRef.current = null;
      return;
    }

    let cancelled = false;
    let rafId = 0;

    (async () => {
      const viewerSpace = await session.requestReferenceSpace('viewer');
      if (cancelled) return;
      const source = await session.requestHitTestSource?.({ space: viewerSpace });
      if (cancelled || !source) return;
      sourceRef.current = source;

      const tick = () => {
        if (cancelled) return;
        const frame = getFrame();
        if (frame && sourceRef.current) {
          const results = frame.getHitTestResults(sourceRef.current);
          if (results.length > 0) {
            const pose = results[0].getPose(referenceSpace);
            if (pose) {
              const { x, y, z } = pose.transform.position;
              latestPoseRef.current = {
                position: [x, y, z],
                matrix: pose.transform.matrix,
              };
            } else {
              latestPoseRef.current = null;
            }
          } else {
            latestPoseRef.current = null;
          }
        }
        rafId = window.requestAnimationFrame(tick);
      };
      rafId = window.requestAnimationFrame(tick);
    })();

    return () => {
      cancelled = true;
      if (rafId) window.cancelAnimationFrame(rafId);
      sourceRef.current?.cancel?.();
      sourceRef.current = null;
      latestPoseRef.current = null;
    };
  }, [session, referenceSpace, getFrame, enabled]);

  return latestPoseRef;
}
