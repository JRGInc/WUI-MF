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
        optionalFeatures: [
          'dom-overlay',
          'anchors',
          'light-estimation',
          'depth-sensing',
          'camera-access',
        ],
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
