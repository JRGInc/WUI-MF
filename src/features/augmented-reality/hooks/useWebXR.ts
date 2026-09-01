import { useCallback, useEffect, useState } from 'react';

// WebXR DOM types are ambient in @types/three; we don't redeclare XRSession etc.
// We do define our own state shape since WebXRState isn't exported anywhere.

interface WebXRState {
  isSupported: boolean;
  isSessionActive: boolean;
  session: XRSession | null;
  referenceSpace: XRReferenceSpace | null;
}

interface StartSessionOptions {
  domOverlayRoot?: HTMLElement | null;
}

const INITIAL: WebXRState = {
  isSupported: false,
  isSessionActive: false,
  session: null,
  referenceSpace: null,
};

export function useWebXR() {
  const [state, setState] = useState<WebXRState>(INITIAL);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!('xr' in navigator) || !navigator.xr) return;
      try {
        const ok = await navigator.xr.isSessionSupported('immersive-ar');
        if (!cancelled) setState((s) => ({ ...s, isSupported: ok }));
      } catch {
        if (!cancelled) setState((s) => ({ ...s, isSupported: false }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const startSession = useCallback(
    async (options: StartSessionOptions = {}): Promise<XRSession | null> => {
      if (!navigator.xr) return null;

      const init: XRSessionInit = {
        requiredFeatures: ['hit-test', 'local-floor'],
        // Every optional feature here is consumed: anchors hold the geo
        // content (WebXRScene), camera-access feeds live CV, and depth-sensing
        // drives occlusion. Don't request features nothing uses.
        optionalFeatures: ['dom-overlay', 'anchors', 'depth-sensing', 'camera-access'],
        // Required for depth-sensing to be granted (Chrome rejects the feature
        // without preferences). gpu-optimized + luminance-alpha is what
        // three.js's built-in occlusion path consumes: WebXRManager binds the
        // depth texture and the renderer runs a depth prepass that occludes
        // depth-tested content (zones, reticle, measurements) behind real
        // geometry. Marker pins/labels render with depthTest:false and stay
        // visible through walls by design — same choice BFMA makes for icons.
        depthSensing: {
          usagePreference: ['gpu-optimized'],
          dataFormatPreference: ['luminance-alpha', 'float32'],
        },
      };
      if (options.domOverlayRoot) {
        init.domOverlay = { root: options.domOverlayRoot };
      }

      let session: XRSession;
      try {
        session = await navigator.xr.requestSession('immersive-ar', init);
      } catch (err) {
        console.error('Failed to start XR session:', err);
        return null;
      }

      const referenceSpace = await session.requestReferenceSpace('local-floor');

      const handleEnd = () => {
        setState({ ...INITIAL, isSupported: true });
        session.removeEventListener('end', handleEnd);
      };
      session.addEventListener('end', handleEnd);

      setState({
        isSupported: true,
        isSessionActive: true,
        session,
        referenceSpace,
      });

      return session;
    },
    []
  );

  const endSession = useCallback(async () => {
    if (state.session) {
      try {
        await state.session.end();
      } catch {
        // session may already be ending
      }
    }
  }, [state.session]);

  return { ...state, startSession, endSession };
}
