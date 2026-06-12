import { useCallback, useRef } from 'react';
import {
  useFrameAnalysisLoop,
  type CaptureResult,
  type FrameAnalysisState,
} from './useFrameAnalysisLoop';
import { coverMapping } from '../utils/frameMapping';

interface UseLiveFrameAnalysisOptions {
  enabled: boolean;
  intervalMs?: number;
  maxInputDim?: number;
}

const DEFAULT_MAX_INPUT_DIM = 512;

export function useLiveFrameAnalysis(
  videoRef: React.RefObject<HTMLVideoElement>,
  { enabled, intervalMs, maxInputDim = DEFAULT_MAX_INPUT_DIM }: UseLiveFrameAnalysisOptions
): FrameAnalysisState {
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const captureFn = useCallback((): CaptureResult | null => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0) return null;

    if (!captureCanvasRef.current) {
      captureCanvasRef.current = document.createElement('canvas');
    }
    const canvas = captureCanvasRef.current;
    const srcW = video.videoWidth;
    const srcH = video.videoHeight;
    const scale = Math.min(1, maxInputDim / Math.max(srcW, srcH));
    canvas.width = Math.round(srcW * scale);
    canvas.height = Math.round(srcH * scale);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // The video renders with `object-fit: cover`, so the screen shows a
    // center-crop of the frame the model analyzes. Record the frame's actual
    // on-screen placement so detections land on the pixels they describe. The
    // video element fills the annotation container (both are inset-0), so its
    // client size doubles as the container size.
    const mapping = coverMapping(
      srcW,
      srcH,
      video.clientWidth,
      video.clientHeight
    );
    return { source: canvas, mapping };
  }, [videoRef, maxInputDim]);

  return useFrameAnalysisLoop(captureFn, { enabled, intervalMs });
}
