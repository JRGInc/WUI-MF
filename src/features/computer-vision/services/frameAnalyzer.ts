import type { DetectedRisk } from '@/shared/types';
import { vegetationSegmenter, risksFromClassMap } from './vegetationSegmenter';
import { wuiDetector } from './wuiDetector';

// Pluggable frame-analysis backends for the live scan loop. The default is
// the WUI hazard detector (JANUS's 19-class YOLOv8s from BFMA — real
// home-ignition-zone classes); if its model or runtime fails to load, the
// session falls back to the DeepLab ADE20K segmenter. Backends can also be
// forced at runtime for A/B latency tests:
//   - URL:          /ar?cvModel=wui | deeplab
//   - or persisted: localStorage.setItem('cv-model', 'deeplab')
// (The YOLO11n-seg COCO plumbing prototype was removed 2026-09-01 — its
// pretrained Ultralytics weights were AGPL-3.0; see docs/SBOM.md.)

export type AnalyzableSource = HTMLCanvasElement | ImageBitmap;

export interface FrameAnalysis {
  risks: DetectedRisk[];
  coverage: number;
  inferenceMs: number;
}

export interface FrameAnalyzer {
  name: string;
  analyze(source: AnalyzableSource): Promise<FrameAnalysis>;
}

const deeplabAnalyzer: FrameAnalyzer = {
  name: 'deeplab-ade20k',
  async analyze(source) {
    const t0 = performance.now();
    const { classMap, width, height } = await vegetationSegmenter.segment(source);
    const { risks, coverage } = risksFromClassMap(classMap, width, height);
    return { risks, coverage, inferenceMs: performance.now() - t0 };
  },
};

// Once the WUI detector fails to come up (model missing, wasm blocked), stop
// retrying for the session and route to DeepLab — retrying a 22 MB fetch on
// every 2.5 s scan tick would be hostile to the connection.
let wuiUnavailable = false;

const wuiAnalyzer: FrameAnalyzer = {
  name: 'wui-yolov8s',
  async analyze(source) {
    if (!wuiUnavailable) {
      try {
        return await wuiDetector.analyze(source);
      } catch (err) {
        wuiUnavailable = true;
        console.warn('WUI detector unavailable, falling back to DeepLab:', err);
      }
    }
    return deeplabAnalyzer.analyze(source);
  },
};

export function getActiveAnalyzer(): FrameAnalyzer {
  let choice: string | null = null;
  try {
    choice =
      new URLSearchParams(window.location.search).get('cvModel') ??
      window.localStorage.getItem('cv-model');
  } catch {
    // non-browser context (tests)
  }
  if (choice === 'deeplab') return deeplabAnalyzer;
  return wuiAnalyzer;
}
