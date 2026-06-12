import { useState } from 'react';
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import type { DetectedRisk, RiskLevel } from '@/shared/types';

interface RiskAnnotationProps {
  annotation: DetectedRisk;
  onRemove?: () => void;
}

function getSeverityColor(severity: RiskLevel): string {
  switch (severity) {
    case 'low':
      return 'bg-green-500';
    case 'moderate':
      return 'bg-yellow-500';
    case 'high':
      return 'bg-orange-500';
    case 'extreme':
      return 'bg-red-500';
  }
}

function getSeverityBorder(severity: RiskLevel): string {
  switch (severity) {
    case 'low':
      return 'border-green-500';
    case 'moderate':
      return 'border-yellow-500';
    case 'high':
      return 'border-orange-500';
    case 'extreme':
      return 'border-red-500';
  }
}

export function RiskAnnotation({ annotation, onRemove }: RiskAnnotationProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!annotation.boundingBox) return null;

  const { x, y, width, height } = annotation.boundingBox;

  return (
    <div
      className="absolute pointer-events-auto"
      style={{
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        width: `${width * 100}%`,
        height: `${height * 100}%`,
      }}
    >
      {/* Bounding box */}
      <div
        className={`absolute inset-0 border-2 rounded ${getSeverityBorder(
          annotation.severity
        )} animate-pulse`}
        style={{
          backgroundColor: `${
            annotation.severity === 'extreme'
              ? 'rgba(220, 38, 38, 0.2)'
              : annotation.severity === 'high'
              ? 'rgba(249, 115, 22, 0.2)'
              : annotation.severity === 'moderate'
              ? 'rgba(234, 179, 8, 0.2)'
              : 'rgba(34, 197, 94, 0.2)'
          }`,
        }}
      />

      {/* Label */}
      <div
        className="absolute -top-8 left-0 flex items-center gap-1 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div
          className={`${getSeverityColor(
            annotation.severity
          )} text-white text-xs font-medium px-2 py-1 rounded flex items-center gap-1 shadow-lg`}
        >
          <ExclamationTriangleIcon className="w-3 h-3" />
          {annotation.type}
          <span className="opacity-70">({Math.round(annotation.confidence * 100)}%)</span>
        </div>

        {onRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="p-1 rounded bg-black/50 text-white/70 hover:text-white"
          >
            <XMarkIcon className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Expanded info */}
      {isExpanded && (
        <div className="absolute top-full left-0 mt-2 w-48 bg-black/80 backdrop-blur text-white text-xs p-3 rounded-lg shadow-lg z-50">
          <p className="font-medium mb-1">{annotation.type}</p>
          <p className="text-white/70 mb-2">{annotation.description}</p>
          <div className="flex items-center justify-between text-white/50">
            <span className="capitalize">{annotation.severity} risk</span>
            <span>{Math.round(annotation.confidence * 100)}% confident</span>
          </div>
        </div>
      )}
    </div>
  );
}
