import { useState } from 'react';
import {
  PlusIcon,
  MinusIcon,
  ArrowsPointingOutIcon,
  MapPinIcon,
  CameraIcon,
  ShareIcon,
} from '@heroicons/react/24/outline';

interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onLocate: () => void;
  onScreenshot?: () => void;
  onShare?: () => void;
}

export function MapControls({
  onZoomIn,
  onZoomOut,
  onResetView,
  onLocate,
  onScreenshot,
  onShare,
}: MapControlsProps) {
  return (
    <div className="flex flex-col gap-2">
      {/* Zoom controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        <button
          onClick={onZoomIn}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Zoom in"
        >
          <PlusIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <div className="h-px bg-gray-200 dark:bg-gray-700" />
        <button
          onClick={onZoomOut}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Zoom out"
        >
          <MinusIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      {/* Other controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        <button
          onClick={onResetView}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Reset view"
        >
          <ArrowsPointingOutIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <div className="h-px bg-gray-200 dark:bg-gray-700" />
        <button
          onClick={onLocate}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="My location"
        >
          <MapPinIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      {/* Screenshot and share */}
      {(onScreenshot || onShare) && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          {onScreenshot && (
            <>
              <button
                onClick={onScreenshot}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Take screenshot"
              >
                <CameraIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              {onShare && <div className="h-px bg-gray-200 dark:bg-gray-700" />}
            </>
          )}
          {onShare && (
            <button
              onClick={onShare}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Share map"
            >
              <ShareIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface LayerToggleProps {
  layers: Array<{
    id: string;
    name: string;
    visible: boolean;
    color?: string;
  }>;
  onToggle: (layerId: string) => void;
}

export function LayerToggle({ layers, onToggle }: LayerToggleProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg"
      >
        <span>Layers</span>
        <span className="text-xs text-gray-400">
          {layers.filter((l) => l.visible).length}/{layers.length}
        </span>
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-2">
          {layers.map((layer) => (
            <label
              key={layer.id}
              className="flex items-center gap-2 cursor-pointer group"
            >
              <input
                type="checkbox"
                checked={layer.visible}
                onChange={() => onToggle(layer.id)}
                className="rounded border-gray-300 text-fire-600 focus:ring-fire-500"
              />
              {layer.color && (
                <span
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: layer.color }}
                />
              )}
              <span className="text-sm text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white">
                {layer.name}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
