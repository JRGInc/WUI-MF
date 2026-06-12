import type { DetectedRisk } from '@/shared/types';
import { vegetationSegmenter, risksFromClassMap } from './vegetationSegmenter';
import { yoloSegmenter } from './yoloSegmenter';

// Pluggable frame-analysis backends for the live scan loop. The default is
// the DeepLab ADE20K segmenter; the YOLO11n-seg COCO prototype can be
// selected at runtime for A/B latency and plumbing tests:
//   - URL:          /ar?cvModel=yolo
//   - or persisted: localStorage.setItem('cv-model', 'yolo')

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

const yoloAnalyzer: FrameAnalyzer = {
  name: 'yolo11n-seg-coco',
  analyze: (source) => yoloSegmenter.analyze(source),
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
  return choice === 'yolo' ? yoloAnalyzer : deeplabAnalyzer;
}
