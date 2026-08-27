import { Fragment, useState } from 'react';
import { QuestionMarkCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import {
  MITIGATION_ICONS,
  MITIGATION_ICON_CATEGORIES,
  mitigationIconUrl,
  type MitigationIconCategory,
  type MitigationIconDef,
} from '@/shared/utils/mitigationIcons';

interface MitigationIconPaletteProps {
  selectedId: string | null;
  onSelect: (icon: MitigationIconDef | null) => void;
}

const CATEGORY_ORDER = Object.keys(MITIGATION_ICON_CATEGORIES) as MitigationIconCategory[];

/**
 * BFMA-style quick-place palette: a horizontal strip of the original NAPSG-style
 * mitigation icons, grouped by category. Selecting one arms placement mode —
 * each map tap drops that icon — until it is tapped again. The "?" button opens
 * a legend explaining each icon and when to use it. Mirrors the Unity app's
 * mitigation icon scrollbar.
 */
export function MitigationIconPalette({ selectedId, onSelect }: MitigationIconPaletteProps) {
  const [showHelp, setShowHelp] = useState(false);
  const selected = MITIGATION_ICONS.find((icon) => icon.id === selectedId);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      {showHelp && (
        <div className="p-3 border-b border-gray-200 dark:border-gray-700 max-h-72 overflow-y-auto">
          <div className="flex items-start justify-between gap-2 mb-2">
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
          {CATEGORY_ORDER.map((category) => (
            <div key={category} className="mb-3 last:mb-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">
                {MITIGATION_ICON_CATEGORIES[category]}
              </p>
              <div className="space-y-2">
                {MITIGATION_ICONS.filter((icon) => icon.category === category).map((icon) => (
                  <div key={icon.id} className="flex gap-2">
                    <img
                      src={mitigationIconUrl(icon.id)}
                      alt=""
                      className="w-6 h-6 mt-0.5 shrink-0"
                    />
                    <div>
                      <p className="text-xs font-medium text-gray-900 dark:text-white">
                        {icon.label}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{icon.guidance}</p>
                    </div>
                  </div>
                ))}
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
      <div className="p-1 flex items-stretch gap-1 overflow-x-auto">
        {CATEGORY_ORDER.map((category, i) => (
          <Fragment key={category}>
            {i > 0 && <div className="w-px self-stretch bg-gray-200 dark:bg-gray-700 shrink-0" />}
            {MITIGATION_ICONS.filter((icon) => icon.category === category).map((icon) => {
              const isSelected = icon.id === selectedId;
              return (
                <button
                  key={icon.id}
                  onClick={() => onSelect(isSelected ? null : icon)}
                  title={`${icon.label} — ${icon.description}`}
                  aria-pressed={isSelected}
                  className={`flex flex-col items-center px-1.5 py-1 rounded min-w-[3.75rem] shrink-0 ${
                    isSelected
                      ? 'bg-forest-100 dark:bg-forest-900/40 ring-1 ring-forest-600'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <img src={mitigationIconUrl(icon.id)} alt="" className="w-7 h-7" />
                  <span
                    className={`text-[9px] mt-0.5 leading-tight text-center ${
                      isSelected
                        ? 'text-forest-700 dark:text-forest-300'
                        : 'text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {icon.label}
                  </span>
                </button>
              );
            })}
          </Fragment>
        ))}
        <button
          onClick={() => setShowHelp((h) => !h)}
          title="What do these icons mean?"
          aria-expanded={showHelp}
          className={`flex items-center px-1.5 rounded shrink-0 ${
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
