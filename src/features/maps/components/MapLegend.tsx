import { useState } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import type { MapLayer } from '@/shared/types';

// Fire-history year ramp — matches the fill-color interpolate in
// FireHistoryLayer (1990 → 2024).
const FIRE_GRADIENT =
  'linear-gradient(to right, #fde68a, #fbbf24, #f97316, #7f1d1d)';
// USGS 3DEP "Slope Map" reads flat (pale) → steep (red-brown).
const SLOPE_GRADIENT =
  'linear-gradient(to right, #e8e6d5, #fde68a, #fb923c, #7c2d12)';

function SwatchRow({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {swatch}
      <span className="text-xs text-gray-600 dark:text-gray-400">{label}</span>
    </div>
  );
}

function Box({ fill, border }: { fill: string; border: string }) {
  return (
    <span
      className="w-3.5 h-3.5 rounded border shrink-0"
      style={{ backgroundColor: fill, borderColor: border }}
    />
  );
}

function GradientBar({
  gradient,
  from,
  to,
}: {
  gradient: string;
  from: string;
  to: string;
}) {
  return (
    <div className="space-y-1">
      <div className="h-2 w-40 rounded" style={{ background: gradient }} />
      <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400">
        <span>{from}</span>
        <span>{to}</span>
      </div>
    </div>
  );
}

// Per-layer key content. Colors mirror each layer's actual styling.
function LayerKey({ layer }: { layer: MapLayer }) {
  switch (layer.id) {
    case 'defensible-zones':
      return (
        <div className="space-y-1.5">
          <SwatchRow
            swatch={<Box fill="rgba(239,68,68,0.3)" border="#ef4444" />}
            label="Zone 0 (0–5 ft)"
          />
          <SwatchRow
            swatch={<Box fill="rgba(249,115,22,0.2)" border="#f97316" />}
            label="Zone 1 (5–30 ft)"
          />
          <SwatchRow
            swatch={<Box fill="rgba(234,179,8,0.15)" border="#eab308" />}
            label="Zone 2 (30–100 ft)"
          />
        </div>
      );
    case 'fire-history':
      return (
        <div className="space-y-1">
          <GradientBar gradient={FIRE_GRADIENT} from="1990" to="2024" />
          <p className="text-[10px] text-gray-500 dark:text-gray-400">
            Perimeter by burn year
          </p>
        </div>
      );
    case 'vegetation':
      return (
        <div className="space-y-1.5">
          <SwatchRow swatch={<Box fill="#ffffbe" border="#e5e5a0" />} label="Grass" />
          <SwatchRow swatch={<Box fill="#f6b26b" border="#d9944a" />} label="Shrub" />
          <SwatchRow swatch={<Box fill="#93c47d" border="#6fa35a" />} label="Timber" />
          <SwatchRow swatch={<Box fill="#c9c9c9" border="#a3a3a3" />} label="Non-burnable" />
          <p className="text-[10px] text-gray-400 dark:text-gray-500">
            Representative · LANDFIRE FBFM40
          </p>
        </div>
      );
    case 'terrain':
      return <GradientBar gradient={SLOPE_GRADIENT} from="Flat" to="Steep" />;
    default:
      return null;
  }
}

// A stacked key that shows one card per *visible* layer — the key for a layer
// appears only while that layer is turned on. Each card's body can be
// hidden/unhidden independently via its header (the title stays as the handle).
export function MapLegend({ layers }: { layers: MapLayer[] }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const visible = layers.filter((l) => l.visible);
  if (visible.length === 0) return null;

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-2 max-h-[70%] overflow-y-auto">
      {visible.map((layer) => {
        const isCollapsed = collapsed.has(layer.id);
        return (
          <div
            key={layer.id}
            className="bg-white/95 dark:bg-gray-800/95 backdrop-blur rounded-lg shadow-lg p-3"
          >
            <button
              type="button"
              onClick={() => toggle(layer.id)}
              aria-expanded={!isCollapsed}
              title={isCollapsed ? 'Show key' : 'Hide key'}
              className="w-full flex items-center justify-between gap-2 text-left"
            >
              <h3 className="text-xs font-medium text-gray-900 dark:text-white">
                {layer.name}
              </h3>
              {isCollapsed ? (
                <ChevronDownIcon className="w-4 h-4 text-gray-400 shrink-0" />
              ) : (
                <ChevronUpIcon className="w-4 h-4 text-gray-400 shrink-0" />
              )}
            </button>
            {!isCollapsed && (
              <div className="mt-2">
                <LayerKey layer={layer} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
