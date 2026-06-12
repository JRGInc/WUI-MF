import { useCallback, useEffect, useRef } from 'react';
import type * as THREE from 'three';
import type { CaptureFn } from '@/features/computer-vision/hooks/useFrameAnalysisLoop';

// Bridges the WebXR camera-access API to our CV pipeline. The camera-image
// WebGLTexture is only valid inside an XR animation frame, so the public
// captureFn defers via a Promise that the in-loop `tick` resolves on the next
// XR frame with a fully-CPU-side 2D canvas of pixels.
//
// Coordinate note: per the raw-camera-access spec, the camera image is
// "perfectly aligned with the XRView from which it was obtained" — the view's
// projectionMatrix is valid for the camera image regardless of its pixel
// aspect. In handheld immersive-ar the single view fills the screen and
// dom-overlay fullscreens the annotation container, so frame-normalized
// detections map 1:1 onto the overlay (identity FrameRect — no mapping is
// attached to the capture). If field testing shows drift on some device,
// return a CaptureResult with an explicit mapping from here instead.

interface PendingRequest {
  resolve: (canvas: HTMLCanvasElement | null) => void;
  timeoutId: number;
}

interface UseXRCameraCaptureArgs {
  rendererRef: React.RefObject<THREE.WebGLRenderer | null>;
  session: XRSession | null;
  refSpace: XRReferenceSpace | null;
  maxInputDim?: number;
}

interface UseXRCameraCaptureReturn {
  captureFn: CaptureFn;
  tick: (frame: XRFrame) => void;
  isAvailable: () => boolean;
}

const DEFAULT_MAX_INPUT_DIM = 512;
const CAPTURE_TIMEOUT_MS = 1000;

export function useXRCameraCapture({
  rendererRef,
  session,
  refSpace,
  maxInputDim = DEFAULT_MAX_INPUT_DIM,
}: UseXRCameraCaptureArgs): UseXRCameraCaptureReturn {
  const bindingRef = useRef<XRWebGLBinding | null>(null);
  const pendingRef = useRef<PendingRequest | null>(null);
  const fboRef = useRef<WebGLFramebuffer | null>(null);
  const pixelsRef = useRef<Uint8Array | null>(null);
  const fullCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dstCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Create the XRWebGLBinding once per session against the renderer's GL ctx.
  useEffect(() => {
    if (!session || !rendererRef.current) return;
    const gl = rendererRef.current.getContext();
    try {
      // XRWebGLBinding requires WebGL2 in practice on Chrome Android; Three.js
      // 0.166 uses WebGL2 by default.
      bindingRef.current = new XRWebGLBinding(session, gl);
    } catch (err) {
      console.warn('XRWebGLBinding unavailable — camera-access likely not granted:', err);
      bindingRef.current = null;
    }
    return () => {
      bindingRef.current = null;
      if (fboRef.current) {
        try {
          gl.deleteFramebuffer(fboRef.current);
        } catch {
          // gl context may already be lost
        }
        fboRef.current = null;
      }
    };
  }, [session, rendererRef]);

  const isAvailable = useCallback(
    () => !!session && !!refSpace && !!bindingRef.current,
    [session, refSpace]
  );

  const captureFn = useCallback<CaptureFn>(() => {
    if (!isAvailable()) return Promise.resolve(null);

    // Cancel any prior in-flight request — the freshest one wins.
    if (pendingRef.current) {
      window.clearTimeout(pendingRef.current.timeoutId);
      pendingRef.current.resolve(null);
      pendingRef.current = null;
    }

    return new Promise<HTMLCanvasElement | null>((resolve) => {
      const timeoutId = window.setTimeout(() => {
        if (pendingRef.current?.resolve === resolve) {
          pendingRef.current = null;
          resolve(null);
        }
      }, CAPTURE_TIMEOUT_MS);
      pendingRef.current = { resolve, timeoutId };
    });
  }, [isAvailable]);

  const tick = useCallback(
    (frame: XRFrame) => {
      const pending = pendingRef.current;
      if (!pending) return;

      // Clear pending immediately so re-entrancy can't double-resolve.
      pendingRef.current = null;
      window.clearTimeout(pending.timeoutId);

      const renderer = rendererRef.current;
      const binding = bindingRef.current;
      if (!renderer || !binding || !refSpace) {
        pending.resolve(null);
        return;
      }

      const pose = frame.getViewerPose(refSpace);
      if (!pose || pose.views.length === 0) {
        pending.resolve(null);
        return;
      }

      // First view with a camera attached — phones return exactly one.
      const view = pose.views.find((v) => v.camera);
      const xrCamera = view?.camera;
      if (!xrCamera) {
        pending.resolve(null);
        return;
      }

      const texture = binding.getCameraImage(xrCamera);
      if (!texture) {
        pending.resolve(null);
        return;
      }

      const srcW = xrCamera.width;
      const srcH = xrCamera.height;
      if (srcW <= 0 || srcH <= 0) {
        pending.resolve(null);
        return;
      }

      const gl = renderer.getContext();
      const prevFbo = gl.getParameter(gl.FRAMEBUFFER_BINDING) as WebGLFramebuffer | null;

      if (!fboRef.current) {
        fboRef.current = gl.createFramebuffer();
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, fboRef.current);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        texture,
        0
      );

      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, prevFbo);
        pending.resolve(null);
        return;
      }

      const byteLen = srcW * srcH * 4;
      if (!pixelsRef.current || pixelsRef.current.length < byteLen) {
        pixelsRef.current = new Uint8Array(byteLen);
      }
      gl.readPixels(0, 0, srcW, srcH, gl.RGBA, gl.UNSIGNED_BYTE, pixelsRef.current);
      gl.bindFramebuffer(gl.FRAMEBUFFER, prevFbo);

      // CPU side: Y-flip into a full-res canvas, then downscale to dst canvas.
      if (!fullCanvasRef.current) {
        fullCanvasRef.current = document.createElement('canvas');
      }
      const fullCanvas = fullCanvasRef.current;
      if (fullCanvas.width !== srcW || fullCanvas.height !== srcH) {
        fullCanvas.width = srcW;
        fullCanvas.height = srcH;
      }
      const fullCtx = fullCanvas.getContext('2d');
      if (!fullCtx) {
        pending.resolve(null);
        return;
      }
      const imageData = fullCtx.createImageData(srcW, srcH);
      const rowSize = srcW * 4;
      const src = pixelsRef.current;
      for (let row = 0; row < srcH; row++) {
        const srcStart = row * rowSize;
        const dstStart = (srcH - 1 - row) * rowSize;
        imageData.data.set(src.subarray(srcStart, srcStart + rowSize), dstStart);
      }
      fullCtx.putImageData(imageData, 0, 0);

      const scale = Math.min(1, maxInputDim / Math.max(srcW, srcH));
      const dstW = Math.max(1, Math.round(srcW * scale));
      const dstH = Math.max(1, Math.round(srcH * scale));

      if (!dstCanvasRef.current) {
        dstCanvasRef.current = document.createElement('canvas');
      }
      const dst = dstCanvasRef.current;
      if (dst.width !== dstW || dst.height !== dstH) {
        dst.width = dstW;
        dst.height = dstH;
      }
      const dstCtx = dst.getContext('2d', { willReadFrequently: true });
      if (!dstCtx) {
        pending.resolve(null);
        return;
      }
      dstCtx.drawImage(fullCanvas, 0, 0, dstW, dstH);

      pending.resolve(dst);
    },
    [rendererRef, refSpace, maxInputDim]
  );

  return { captureFn, tick, isAvailable };
}
