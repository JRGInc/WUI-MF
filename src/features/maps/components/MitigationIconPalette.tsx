import { useState } from 'react';
import { QuestionMarkCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { MITIGATION_ICONS, type MitigationIconDef } from '@/shared/utils/mitigationIcons';

interface MitigationIconPaletteProps {
  selectedId: string | null;
  onSelect: (icon: MitigationIconDef | null) => void;
}

/**
 * BFMA-style quick-place palette: a horizontal strip of mitigation icons.
 * Selecting one arms placement mode — each map tap drops that icon — until the
 * icon is tapped again. The "?" button opens a legend explaining each icon and
 * when to use it. Mirrors the Unity app's mitigation icon scrollbar.
 */
export function MitigationIconPalette({ selectedId, onSelect }: MitigationIconPaletteProps) {
  const [showHelp, setShowHelp] = useState(false);
  const selected = MITIGATION_ICONS.find((icon) => icon.id === selectedId);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      {showHelp && (
        <div className="p-3 border-b border-gray-200 dark:border-gray-700 max-h-64 overflow-y-auto space-y-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              Mitigation icons — what to mark
            </p>
            <button
              onClick={() => setShowHelp(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              aria-label="Close icon help"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
          {MITIGATION_ICONS.map((icon) => (
            <div key={icon.id} className="flex gap-2">
              <span className="text-lg leading-none mt-0.5">{icon.glyph}</span>
              <div>
                <p className="text-xs font-medium text-gray-900 dark:text-white">{icon.label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{icon.guidance}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {selected && (
        <p className="px-3 pt-2 text-xs text-forest-700 dark:text-forest-400 font-medium">
          Tap the map to place “{selected.label}” — tap the icon again to stop
        </p>
      )}
      <div className="p-1 flex gap-1 overflow-x-auto">
        {MITIGATION_ICONS.map((icon) => {
          const isSelected = icon.id === selectedId;
          return (
            <button
              key={icon.id}
              onClick={() => onSelect(isSelected ? null : icon)}
              title={`${icon.label} — ${icon.description}`}
              aria-pressed={isSelected}
              className={`flex flex-col items-center px-2 py-1 rounded min-w-[3.5rem] ${
                isSelected
                  ? 'bg-forest-100 text-forest-700 dark:bg-forest-900/40 dark:text-forest-300 ring-1 ring-forest-600'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <span className="text-xl leading-none">{icon.glyph}</span>
              <span className="text-[10px] mt-1 whitespace-nowrap">{icon.label}</span>
            </button>
          );
        })}
        <button
          onClick={() => setShowHelp((h) => !h)}
          title="What do these icons mean?"
          aria-expanded={showHelp}
          className={`flex items-center px-1.5 rounded ${
            showHelp
              ? 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
              : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
          }`}
        >
          <QuestionMarkCircleIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
