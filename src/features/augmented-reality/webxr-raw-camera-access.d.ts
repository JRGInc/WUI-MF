// Ambient augmentation for the WebXR Raw Camera Access module
// (https://immersive-web.github.io/raw-camera-access/) — not yet shipped in
// @types/webxr. Shipping in Chrome on Android since ~Chrome 110.

declare global {
  interface XRCamera {
    readonly width: number;
    readonly height: number;
  }

  interface XRView {
    readonly camera?: XRCamera;
  }

  interface XRWebGLBinding {
    getCameraImage(camera: XRCamera): WebGLTexture | null;
  }
}

export {};
