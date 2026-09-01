import * as tf from '@tensorflow/tfjs';
// Side-effect import: registers the 'webgpu' backend factory. The package
// only registers when WebGPU is actually available (navigator.gpu), so this
// is a no-op in unsupported browsers and in tests.
import '@tensorflow/tfjs-backend-webgpu';

// Preference order. WebGPU (Metal-backed on iOS 26 Safari, also Chrome
// desktop/Android) is typically ~3x faster than WebGL on conv models and
// lighter on CPU/battery; webgl is the universal fallback.
const BACKEND_ORDER = ['webgpu', 'webgl', 'cpu'];

// A/B override for on-device latency tests, mirroring the cvModel switch in
// frameAnalyzer.ts:
//   - URL:          /ar?tfBackend=webgl
//   - or persisted: localStorage.setItem('tf-backend', 'webgl')
function requestedOverride(): string | null {
  try {
    return (
      new URLSearchParams(window.location.search).get('tfBackend') ??
      window.localStorage.getItem('tf-backend')
    );
  } catch {
    return null; // non-browser context (tests)
  }
}

let initPromise: Promise<string> | null = null;

// Pick the best available backend, once per session. Every model-loading
// path must await this before creating tensors — whichever backend is active
// when the first op runs wins, so a late setBackend would strand loaded
// models' warm state.
export function initTfBackend(): Promise<string> {
  if (!initPromise) {
    initPromise = (async () => {
      await tf.ready();
      const override = requestedOverride();
      const order = override
        ? [override, ...BACKEND_ORDER.filter((b) => b !== override)]
        : BACKEND_ORDER;
      for (const backend of order) {
        try {
          // Two distinct failure modes: setBackend THROWS for a backend name
          // that was never registered (e.g. 'webgpu' without navigator.gpu),
          // and resolves FALSE for a registered backend whose async init
          // fails (e.g. the WebGPU adapter request is denied). Fall through
          // to the next candidate on either.
          if (await tf.setBackend(backend)) break;
        } catch {
          // not registered in this environment — try the next one
        }
      }
      console.log(`TensorFlow.js backend: ${tf.getBackend()}`);
      return tf.getBackend();
    })();
  }
  return initPromise;
}
