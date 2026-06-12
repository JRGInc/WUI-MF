import { useState, useRef, useEffect } from 'react';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useImageAnalysis } from '../hooks/useImageAnalysis';
import { RiskOverlay, RiskLegend } from './RiskOverlay';
import type { CVAnalysisResult } from '@/shared/types';

interface ImageAnalyzerProps {
  imageUrl: string;
  onAnalysisComplete?: (result: CVAnalysisResult) => void;
  autoAnalyze?: boolean;
}

export function ImageAnalyzer({
  imageUrl,
  onAnalysisComplete,
  autoAnalyze = true,
}: ImageAnalyzerProps) {
  const { analyzeImage, isAnalyzing, isModelLoaded } = useImageAnalysis();
  const [analysisResult, setAnalysisResult] = useState<CVAnalysisResult | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [error, setError] = useState<string | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoAnalyze && isModelLoaded && imageUrl) {
      runAnalysis();
    }
  }, [imageUrl, isModelLoaded, autoAnalyze]);

  const runAnalysis = async () => {
    setError(null);

    try {
      // Fetch the image as blob
      const response = await fetch(imageUrl);
      const blob = await response.blob();

      const result = await analyzeImage(blob);

      if (result) {
        setAnalysisResult(result);
        onAnalysisComplete?.(result);
      } else {
        setError('Analysis failed. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    }
  };

  const handleImageLoad = () => {
    if (imageRef.current) {
      setImageSize({
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight,
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Image container */}
      <div ref={containerRef} className="relative rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
        <img
          ref={imageRef}
          src={imageUrl}
          alt="Analysis target"
          className="w-full h-auto"
          onLoad={handleImageLoad}
        />

        {/* Analysis overlay */}
        {analysisResult && (
          <RiskOverlay
            analysisResult={analysisResult}
            imageWidth={imageSize.width}
            imageHeight={imageSize.height}
          />
        )}

        {/* Loading overlay */}
        {isAnalyzing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="flex flex-col items-center gap-2 text-white">
              <ArrowPathIcon className="w-8 h-8 animate-spin" />
              <span className="text-sm">Analyzing image...</span>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <RiskLegend />

        <button
          onClick={runAnalysis}
          disabled={isAnalyzing || !isModelLoaded}
          className="btn-outline text-sm flex items-center gap-2"
        >
          <ArrowPathIcon className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
          {isAnalyzing ? 'Analyzing...' : 'Re-analyze'}
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-4 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Results summary */}
      {analysisResult && (
        <div className="card p-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Analysis Results
          </h3>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Vegetation Coverage</span>
              <div className="mt-1 flex items-center gap-2">
                <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      analysisResult.vegetationCoverage > 60
                        ? 'bg-red-500'
                        : analysisResult.vegetationCoverage > 30
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${analysisResult.vegetationCoverage}%` }}
                  />
                </div>
                <span className="font-medium text-gray-900 dark:text-white">
                  {analysisResult.vegetationCoverage}%
                </span>
              </div>
            </div>

            <div>
              <span className="text-gray-500 dark:text-gray-400">Risk Score</span>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`text-2xl font-bold ${
                    analysisResult.vegetationScore >= 8
                      ? 'text-green-600'
                      : analysisResult.vegetationScore >= 6
                      ? 'text-yellow-600'
                      : analysisResult.vegetationScore >= 4
                      ? 'text-orange-600'
                      : 'text-red-600'
                  }`}
                >
                  {analysisResult.vegetationScore}
                </span>
                <span className="text-gray-400">/10</span>
              </div>
            </div>
          </div>

          {/* Detected risks list */}
          {analysisResult.detectedRisks.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                Detected Risks
              </h4>
              <ul className="space-y-2">
                {analysisResult.detectedRisks.map((risk, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300"
                  >
                    <ExclamationTriangleIcon
                      className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                        risk.severity === 'extreme' || risk.severity === 'high'
                          ? 'text-red-500'
                          : risk.severity === 'moderate'
                          ? 'text-yellow-500'
                          : 'text-green-500'
                      }`}
                    />
                    <span>
                      <strong>{risk.type}</strong> - {risk.description}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Processing info */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-1">
              <CheckCircleIcon className="w-4 h-4 text-green-500" />
              Analyzed on device
            </div>
            <span>
              Processed in {Math.round(analysisResult.processingTime)}ms
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
