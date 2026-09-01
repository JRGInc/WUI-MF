import { useState, useCallback, useEffect, useRef } from 'react';
import {
  vegetationSegmenter,
  risksFromClassMap,
} from '../services/vegetationSegmenter';
import { wuiDetector } from '../services/wuiDetector';
import type { CVAnalysisResult, DetectedRisk } from '@/shared/types';

type AnalyzerMode = 'model' | 'heuristic';

export function useImageAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const modeRef = useRef<AnalyzerMode>('model');

  useEffect(() => {
    let cancelled = false;
    vegetationSegmenter
      .load((f) => {
        if (!cancelled) setLoadingProgress(Math.round(f * 100));
      })
      .then(() => {
        if (!cancelled) setIsModelLoaded(true);
      })
      .catch((err) => {
        console.warn('DeepLab load failed, using RGB heuristic fallback:', err);
        modeRef.current = 'heuristic';
        if (!cancelled) {
          setIsModelLoaded(true);
          setLoadingProgress(100);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const analyzeImage = useCallback(
    async (imageBlob: Blob): Promise<CVAnalysisResult | null> => {
      setIsAnalyzing(true);
      const startTime = performance.now();
      try {
        const imageBitmap = await createImageBitmap(imageBlob);
        if (modeRef.current === 'model') {
          try {
            return await analyzeWithModel(imageBitmap, startTime);
          } catch (err) {
            console.warn('Segmentation failed mid-flight, falling back:', err);
            modeRef.current = 'heuristic';
          }
        }
        return analyzeWithHeuristic(imageBitmap, startTime);
      } catch (err) {
        console.error('Error analyzing image:', err);
        return null;
      } finally {
        setIsAnalyzing(false);
      }
    },
    []
  );

  return { analyzeImage, isAnalyzing, isModelLoaded, loadingProgress };
}

// ---------- Model path (WUI detector + DeepLab ADE20K) ----------

// The WUI detector (19 real home-ignition-zone classes) is best-effort here:
// its detections lead the findings list, while DeepLab keeps providing the
// vegetation coverage/score/debris estimates a detector can't. If the WUI
// model can't load (offline first launch), the DeepLab result stands alone.
let wuiStillUnavailable = false;

async function wuiRisks(imageBitmap: ImageBitmap): Promise<DetectedRisk[]> {
  if (wuiStillUnavailable) return [];
  try {
    return (await wuiDetector.analyze(imageBitmap)).risks;
  } catch (err) {
    wuiStillUnavailable = true;
    console.warn('WUI detector unavailable for photo analysis:', err);
    return [];
  }
}

async function analyzeWithModel(
  imageBitmap: ImageBitmap,
  startTime: number
): Promise<CVAnalysisResult> {
  const [segmented, wuiDetections] = await Promise.all([
    vegetationSegmenter.segment(imageBitmap),
    wuiRisks(imageBitmap),
  ]);
  const { classMap, width, height } = segmented;
  const { risks: segRisks, coverage } = risksFromClassMap(classMap, width, height);
  const detectedRisks = [...wuiDetections, ...segRisks];

  const vegetationScore = Math.max(1, Math.round((1 - coverage / 100) * 10));
  const debrisLevel: 'none' | 'light' | 'moderate' | 'heavy' =
    coverage < 10 ? 'none' : coverage < 25 ? 'light' : coverage < 50 ? 'moderate' : 'heavy';

  return {
    vegetationScore,
    vegetationCoverage: Math.round(coverage),
    detectedRisks,
    debrisLevel,
    confidence: detectedRisks.length
      ? detectedRisks.reduce((a, r) => a + r.confidence, 0) / detectedRisks.length
      : 0.7,
    processingTime: performance.now() - startTime,
  };
}

// ---------- Heuristic fallback (RGB color thresholding) ----------
// Kept for first-launch offline + browsers where the model load fails.

// Coverage is a ratio, so the heuristic doesn't need full resolution — a 4K
// photo was ~8M pixel iterations on the main thread for the same answer.
const HEURISTIC_MAX_DIM = 512;

function analyzeWithHeuristic(
  imageBitmap: ImageBitmap,
  startTime: number
): CVAnalysisResult | null {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const scale = Math.min(1, HEURISTIC_MAX_DIM / Math.max(imageBitmap.width, imageBitmap.height));
  canvas.width = Math.max(1, Math.round(imageBitmap.width * scale));
  canvas.height = Math.max(1, Math.round(imageBitmap.height * scale));
  ctx.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const veg = countVegetationPixels(imageData);
  const detectedRisks = heuristicRisks(veg);
  const vegetationScore = Math.max(1, Math.round((1 - veg.coverage / 100) * 10));

  return {
    vegetationScore,
    vegetationCoverage: veg.coverage,
    detectedRisks,
    debrisLevel: heuristicDebrisLevel(veg),
    confidence: 0.55,
    processingTime: performance.now() - startTime,
  };
}

interface HeuristicVeg {
  coverage: number;
  greenPixels: number;
  brownPixels: number;
  totalPixels: number;
  density: 'low' | 'medium' | 'high';
}

function countVegetationPixels(imageData: ImageData): HeuristicVeg {
  const { data, width, height } = imageData;
  const totalPixels = width * height;
  let greenPixels = 0;
  let brownPixels = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (g > r && g > b && g > 50) greenPixels++;
    if (r > 100 && g > 60 && g < 150 && b < 100 && r > g) brownPixels++;
  }
  const coverage = Math.round(((greenPixels + brownPixels) / totalPixels) * 100);
  const density: 'low' | 'medium' | 'high' =
    coverage < 30 ? 'low' : coverage < 60 ? 'medium' : 'high';
  return { coverage, greenPixels, brownPixels, totalPixels, density };
}

function heuristicRisks(veg: HeuristicVeg): DetectedRisk[] {
  const risks: DetectedRisk[] = [];
  if (veg.coverage > 60) {
    risks.push({
      type: 'High Vegetation Density',
      confidence: 0.6,
      severity: veg.coverage > 80 ? 'high' : 'moderate',
      description: `Vegetation covers approximately ${veg.coverage}% of the visible area.`,
    });
  }
  const brownRatio = veg.brownPixels / veg.totalPixels;
  if (brownRatio > 0.15) {
    risks.push({
      type: 'Dead / Dry Vegetation',
      confidence: 0.5,
      severity: brownRatio > 0.3 ? 'high' : 'moderate',
      description: 'Brown / dead vegetation detected. Dead material is highly flammable.',
    });
  }
  return risks;
}

function heuristicDebrisLevel(
  veg: HeuristicVeg
): 'none' | 'light' | 'moderate' | 'heavy' {
  const brownRatio = veg.brownPixels / veg.totalPixels;
  if (brownRatio < 0.05) return 'none';
  if (brownRatio < 0.15) return 'light';
  if (brownRatio < 0.3) return 'moderate';
  return 'heavy';
}
