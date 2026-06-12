import { useState, useRef, useCallback } from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';

interface Point {
  x: number;
  y: number;
}

interface Measurement {
  start: Point;
  end: Point;
  distance: number;
}

interface MeasurementToolProps {
  onMeasure: (distance: number) => void;
  scale?: number; // pixels per foot (approximate)
}

export function MeasurementTool({ onMeasure, scale = 50 }: MeasurementToolProps) {
  const [points, setPoints] = useState<Point[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [isActive, setIsActive] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!isActive || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const point = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      setPoints((prev) => {
        const newPoints = [...prev, point];

        if (newPoints.length === 2) {
          const [start, end] = newPoints;
          const pixelDistance = Math.sqrt(
            Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
          );
          const distance = pixelDistance / scale;

          const measurement: Measurement = {
            start,
            end,
            distance,
          };

          setMeasurements((prev) => [...prev, measurement]);
          onMeasure(distance);

          return [];
        }

        return newPoints;
      });
    },
    [isActive, scale, onMeasure]
  );

  const clearAll = () => {
    setPoints([]);
    setMeasurements([]);
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 cursor-crosshair"
      onClick={handleClick}
    >
      {/* SVG overlay for lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {/* Active measurement line */}
        {points.length === 1 && (
          <g>
            <circle
              cx={points[0].x}
              cy={points[0].y}
              r="8"
              fill="none"
              stroke="#ef4444"
              strokeWidth="2"
              className="animate-pulse"
            />
            <circle cx={points[0].x} cy={points[0].y} r="3" fill="#ef4444" />
          </g>
        )}

        {/* Completed measurements */}
        {measurements.map((m, index) => (
          <g key={index}>
            {/* Line */}
            <line
              x1={m.start.x}
              y1={m.start.y}
              x2={m.end.x}
              y2={m.end.y}
              stroke="#ef4444"
              strokeWidth="2"
              strokeDasharray="5,5"
            />

            {/* Start point */}
            <circle cx={m.start.x} cy={m.start.y} r="6" fill="#ef4444" />

            {/* End point */}
            <circle cx={m.end.x} cy={m.end.y} r="6" fill="#ef4444" />

            {/* Distance label */}
            <foreignObject
              x={(m.start.x + m.end.x) / 2 - 40}
              y={(m.start.y + m.end.y) / 2 - 15}
              width="80"
              height="30"
            >
              <div className="flex items-center justify-center h-full">
                <span className="bg-black/80 text-white text-sm font-medium px-2 py-1 rounded">
                  {m.distance.toFixed(1)} ft
                </span>
              </div>
            </foreignObject>
          </g>
        ))}
      </svg>

      {/* Instructions */}
      <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 pointer-events-none">
        <div className="bg-black/70 text-white text-sm px-4 py-2 rounded-full">
          {points.length === 0
            ? 'Tap to place first point'
            : 'Tap to place second point'}
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 pointer-events-auto">
        {measurements.length > 0 && (
          <button
            onClick={clearAll}
            className="flex items-center gap-2 bg-black/70 text-white text-sm px-4 py-2 rounded-full hover:bg-black/90"
          >
            <TrashIcon className="w-4 h-4" />
            Clear All
          </button>
        )}
        <button
          onClick={() => setIsActive(!isActive)}
          className={`flex items-center gap-2 text-sm px-4 py-2 rounded-full ${
            isActive
              ? 'bg-fire-600 text-white'
              : 'bg-black/70 text-white hover:bg-black/90'
          }`}
        >
          {isActive ? 'Active' : 'Paused'}
        </button>
      </div>

      {/* Measurement summary */}
      {measurements.length > 0 && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white text-sm px-4 py-2 rounded-lg pointer-events-none">
          <div className="flex items-center gap-4">
            <span>{measurements.length} measurement(s)</span>
            <span className="opacity-70">
              Total: {measurements.reduce((sum, m) => sum + m.distance, 0).toFixed(1)} ft
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
