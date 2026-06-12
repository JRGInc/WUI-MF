/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_MAPBOX_TOKEN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// WebXR types
interface XRSession {
  requestReferenceSpace(type: XRReferenceSpaceType): Promise<XRReferenceSpace>;
  requestAnimationFrame(callback: XRFrameRequestCallback): number;
  end(): Promise<void>;
}

interface XRFrame {
  session: XRSession;
  getViewerPose(referenceSpace: XRReferenceSpace): XRViewerPose | null;
  getHitTestResults(hitTestSource: XRHitTestSource): XRHitTestResult[];
}

interface Navigator {
  xr?: XRSystem;
}

interface XRSystem {
  isSessionSupported(mode: XRSessionMode): Promise<boolean>;
  requestSession(mode: XRSessionMode, options?: XRSessionInit): Promise<XRSession>;
}

type XRSessionMode = 'inline' | 'immersive-vr' | 'immersive-ar';
type XRReferenceSpaceType = 'viewer' | 'local' | 'local-floor' | 'bounded-floor' | 'unbounded';
