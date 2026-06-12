import { useEffect, useRef, useState } from 'react';
import { getActiveAnalyzer } from '../services/frameAnalyzer';
import {
  clipBoundingBox,
  isIdentityRect,
  mapBoundingBox,
  type FrameRect,
} from '../utils/frameMapping';
import type { DetectedRisk } from '@/shared/types';

export type FrameSource = HTMLCanvasElement | ImageBitmap;
// Capture may return a bare frame (assumed to coincide with the container) or
// a frame plus the FrameRect describing where that frame sits on the
// container, so detections land on the pixels they describe even when the
// display crops the frame (e.g. object-fit: cover).
export interface CaptureResult {
  source: FrameSource;
  mapping?: FrameRect;
}
export type CaptureFn = () =>
  | FrameSource
  | CaptureResult
  | null
  | Promise<FrameSource | CaptureResult | null>;

interface UseFrameAnalysisLoopOptions {
  enabled: boolean;
  intervalMs?: number;
}

export interface FrameAnalysisState {
  risks: DetectedRisk[];
  coverage: number;
  lastAnalyzedAt: number | null;
  isAnalyzing: boolean;
  error: string | null;
}

const DEFAULT_INTERVAL_MS = 2500;

const EMPTY: FrameAnalysisState = {
  risks: [],
  coverage: 0,
  lastAnalyzedAt: null,
  isAnalyzing: false,
  error: null,
};

// Drives the segmenter on a polling interval. The captureFn decides what gets
// fed to the model (a video frame, an XR camera image, a manually-captured
// canvas). Concurrency-safe — skips ticks while a previous run is in flight.
export function useFrameAnalysisLoop(
  captureFn: CaptureFn,
  { enabled, intervalMs = DEFAULT_INTERVAL_MS }: UseFrameAnalysisLoopOptions
): FrameAnalysisState {
  const [state, setState] = useState<FrameAnalysisState>(EMPTY);
  const runningRef = useRef(false);
  const captureFnRef = useRef(captureFn);
  captureFnRef.current = captureFn;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let timerId: number | null = null;

    const runOnce = async () => {
      if (cancelled || runningRef.current) return;
      if (document.visibilityState === 'hidden') return;

      let captured: FrameSource | CaptureResult | null = null;
      try {
        captured = await captureFnRef.current();
      } catch (err) {
        if (!cancelled) {
          setState((s) => ({
            ...s,
            error: err instanceof Error ? err.message : 'Capture failed',
          }));
        }
        return;
      }
      if (!captured || cancelled) return;
      const source = 'source' in captured ? captured.source : captured;
      const mapping = 'source' in captured ? captured.mapping : undefined;

      runningRef.current = true;
      setState((s) => ({ ...s, isAnalyzing: true }));

      try {
        const analyzer = getActiveAnalyzer();
        const { risks, coverage, inferenceMs } = await analyzer.analyze(source);
        if (cancelled) return;
        if (import.meta.env.DEV) {
          console.debug(
            `[cv] ${analyzer.name}: ${Math.round(inferenceMs)}ms, ${risks.length} risk(s), coverage ${coverage}%`
          );
        }
        setState({
          risks: mapping ? mapRisksToContainer(risks, mapping) : risks,
          coverage,
          lastAnalyzedAt: Date.now(),
          isAnalyzing: false,
          error: null,
        });
      } catch (err) {
        if (!cancelled) {
          setState((s) => ({
            ...s,
            isAnalyzing: false,
            error: err instanceof Error ? err.message : 'Analysis failed',
          }));
        }
      } finally {
        runningRef.current = false;
      }
    };

    runOnce();
    timerId = window.setInterval(runOnce, intervalMs);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') runOnce();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      if (timerId !== null) window.clearInterval(timerId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled, intervalMs]);

  useEffect(() => {
    if (!enabled) {
      setState((s) => (s.risks.length === 0 && !s.isAnalyzing ? s : EMPTY));
    }
  }, [enabled]);

  return state;
}

// Re-express frame-normalized boxes in container coordinates and clip them to
// the visible area. Risks whose box falls entirely in the cropped-away region
// are dropped — the user can't see what they refer to. Frame-level risks
// (no bounding box) pass through untouched.
function mapRisksToContainer(
  risks: DetectedRisk[],
  mapping: FrameRect
): DetectedRisk[] {
  if (isIdentityRect(mapping)) return risks;
  const mapped: DetectedRisk[] = [];
  for (const risk of risks) {
    if (!risk.boundingBox) {
      mapped.push(risk);
      continue;
    }
    const box = clipBoundingBox(mapBoundingBox(risk.boundingBox, mapping));
    if (box) mapped.push({ ...risk, boundingBox: box });
  }
  return mapped;
}
