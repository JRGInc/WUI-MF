import { useMemo } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid';
import type { CVAnalysisResult, RiskLevel } from '@/shared/types';

interface RiskOverlayProps {
  analysisResult: CVAnalysisResult;
  imageWidth: number;
  imageHeight: number;
  showLabels?: boolean;
}

function getRiskColor(severity: RiskLevel): string {
  switch (severity) {
    case 'low':
      return 'rgba(34, 197, 94, 0.6)'; // green
    case 'moderate':
      return 'rgba(234, 179, 8, 0.6)'; // yellow
    case 'high':
      return 'rgba(249, 115, 22, 0.6)'; // orange
    case 'extreme':
      return 'rgba(220, 38, 38, 0.6)'; // red
  }
}

function getBorderColor(severity: RiskLevel): string {
  switch (severity) {
    case 'low':
      return 'rgb(34, 197, 94)';
    case 'moderate':
      return 'rgb(234, 179, 8)';
    case 'high':
      return 'rgb(249, 115, 22)';
    case 'extreme':
      return 'rgb(220, 38, 38)';
  }
}

export function RiskOverlay({
  analysisResult,
  imageWidth,
  imageHeight,
  showLabels = true,
}: RiskOverlayProps) {
  const { detectedRisks, vegetationCoverage } = analysisResult;

  const sortedRisks = useMemo(() => {
    return [...detectedRisks].sort((a, b) => {
      const severityOrder = { extreme: 0, high: 1, moderate: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }, [detectedRisks]);

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ width: imageWidth, height: imageHeight }}
    >
      {/* Vegetation coverage overlay */}
      {vegetationCoverage > 50 && (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to bottom,
              rgba(34, 197, 94, ${vegetationCoverage / 200}) 0%,
              transparent 50%)`,
          }}
        />
      )}

      {/* Risk bounding boxes */}
      {sortedRisks.map((risk, index) =>
        risk.boundingBox ? (
          <div
            key={index}
            className="absolute"
            style={{
              left: `${risk.boundingBox.x * 100}%`,
              top: `${risk.boundingBox.y * 100}%`,
              width: `${risk.boundingBox.width * 100}%`,
              height: `${risk.boundingBox.height * 100}%`,
              backgroundColor: getRiskColor(risk.severity),
              border: `2px solid ${getBorderColor(risk.severity)}`,
              borderRadius: '4px',
            }}
          >
            {showLabels && (
              <div
                className="absolute -top-6 left-0 flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-white whitespace-nowrap"
                style={{ backgroundColor: getBorderColor(risk.severity) }}
              >
                <ExclamationTriangleIcon className="w-3 h-3" />
                {risk.type}
                <span className="opacity-75">
                  ({Math.round(risk.confidence * 100)}%)
                </span>
              </div>
            )}
          </div>
        ) : null
      )}

      {/* Overall score indicator */}
      <div className="absolute top-2 right-2 pointer-events-auto">
        <div
          className={`px-3 py-1.5 rounded-lg text-white text-sm font-medium shadow-lg ${
            analysisResult.vegetationScore >= 8
              ? 'bg-green-600'
              : analysisResult.vegetationScore >= 6
              ? 'bg-yellow-600'
              : analysisResult.vegetationScore >= 4
              ? 'bg-orange-600'
              : 'bg-red-600'
          }`}
        >
          Score: {analysisResult.vegetationScore}/10
        </div>
      </div>

      {/* Risk count badge */}
      {detectedRisks.length > 0 && (
        <div className="absolute bottom-2 left-2 pointer-events-auto">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/70 text-white text-sm">
            <ExclamationTriangleIcon className="w-4 h-4 text-yellow-400" />
            {detectedRisks.length} risk{detectedRisks.length !== 1 ? 's' : ''} detected
          </div>
        </div>
      )}
    </div>
  );
}

interface RiskLegendProps {
  className?: string;
}

export function RiskLegend({ className = '' }: RiskLegendProps) {
  const levels: { level: RiskLevel; label: string }[] = [
    { level: 'low', label: 'Low' },
    { level: 'moderate', label: 'Moderate' },
    { level: 'high', label: 'High' },
    { level: 'extreme', label: 'Extreme' },
  ];

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <span className="text-sm text-gray-500 dark:text-gray-400">Risk Level:</span>
      {levels.map(({ level, label }) => (
        <div key={level} className="flex items-center gap-1.5">
          <div
            className="w-3 h-3 rounded"
            style={{ backgroundColor: getBorderColor(level) }}
          />
          <span className="text-xs text-gray-600 dark:text-gray-300">{label}</span>
        </div>
      ))}
    </div>
  );
}
