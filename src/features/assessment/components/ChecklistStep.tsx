import { useState } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';
import type { CategoryScores, RiskCategory } from '@/shared/types';

interface ChecklistStepProps {
  responses: Record<string, boolean | string>;
  onUpdate: (responses: Record<string, boolean | string>, scores: Partial<CategoryScores>) => void;
}

interface ChecklistItem {
  id: string;
  category: RiskCategory;
  question: string;
  helpText?: string;
  weight: number;
  positiveLabel?: string;
  negativeLabel?: string;
  // Authoritative standard backing the item (shown as a small provenance tag).
  standard?: string;
}

const checklistItems: ChecklistItem[] = [
  // Defensible Space — Zone 0 (0-5 ft) is the highest-impact zone
  {
    id: 'zone0-clear',
    category: 'defensible-space',
    question:
      'Is the 0-5 ft "ember-resistant zone" cleared to bare mineral soil or noncombustible hardscape, with NO plants?',
    helpText:
      'Gravel, pavers, concrete, or decomposed granite only. Remove ALL plants within 5 ft — even ones labeled "fire-resistant" are still combustible and can carry embers to the wall.',
    weight: 3,
    standard: 'IBHS Zone 0 · CA AB 3074 (phasing in)',
  },
  {
    id: 'zone0-mulch',
    category: 'defensible-space',
    question: 'Is all combustible mulch removed from within 5 ft of the home?',
    helpText:
      'Bark, wood chips, and rubber mulch ignite readily from embers. Replace with gravel or other noncombustible groundcover in the 0-5 ft zone.',
    weight: 2,
    standard: 'IBHS Zone 0 · CA AB 3074',
  },
  {
    id: 'fence-attachment',
    category: 'defensible-space',
    question:
      'Where a wood or vinyl fence meets the house, is there a 5-ft noncombustible section at the connection?',
    helpText:
      'Combustible fences act as a wick, carrying fire directly to the wall — a documented structure-to-structure ignition path. Use metal or masonry for the last 5 ft, and keep combustible fences/gates out of Zone 0.',
    weight: 2,
    standard: 'IBHS WFPH · NIST TN 2228',
  },
  {
    id: 'zone1-maintained',
    category: 'defensible-space',
    question: 'Is vegetation in Zone 1 (5-30 feet) properly spaced and maintained?',
    helpText: 'Trees should be 10 feet apart, shrubs limited in size',
    weight: 2,
    standard: 'CAL FIRE PRC 4291',
  },
  {
    id: 'zone2-reduced',
    category: 'defensible-space',
    question: 'Has fuel been reduced in Zone 2 (30-100 feet)?',
    helpText: 'Dead plants removed, grass kept short, spacing maintained',
    weight: 2,
    standard: 'CAL FIRE PRC 4291',
  },

  // Roof & Structure — includes attached decks (part of the building footprint)
  {
    id: 'roof-rated',
    category: 'roof-structure',
    question: 'Is your roof made of Class A fire-rated material?',
    helpText: 'Metal, tile, or composition shingles (not wood shake)',
    weight: 3,
    standard: 'CBC Chapter 7A',
  },
  {
    id: 'gutters-clean',
    category: 'roof-structure',
    question: 'Are gutters and roof clear of debris?',
    helpText: 'Leaves, needles, and other combustibles removed; noncombustible gutter guards help',
    weight: 2,
  },
  {
    id: 'siding-noncombustible',
    category: 'roof-structure',
    question: 'Is your siding made of fire-resistant material?',
    helpText: 'Stucco, brick, fiber cement, or treated wood',
    weight: 2,
    standard: 'CBC Chapter 7A',
  },
  {
    id: 'deck-under-clear',
    category: 'roof-structure',
    question:
      'Is the area under and within 5 ft of attached decks/porches free of combustibles?',
    helpText:
      'Attached decks count as part of the structure and need their own 0-5 ft noncombustible zone. Remove stored items, vegetation, and mulch from beneath and beside the deck.',
    weight: 2,
    standard: 'CA AB 3074 · IBHS WFPH',
  },
  {
    id: 'deck-surface',
    category: 'roof-structure',
    question:
      'Are deck surfaces ignition-resistant, with metal flashing where the deck meets the wall?',
    helpText:
      'Walking surfaces within 10 ft of the home should be ignition-resistant/noncombustible (ASTM E2632/E2726), with 6-inch metal flashing at deck-to-wall intersections.',
    weight: 1,
    standard: 'CBC Chapter 7A §709A',
  },

  // Vegetation Management
  {
    id: 'veg-dead-removed',
    category: 'vegetation',
    question: 'Has all dead and dying vegetation been removed from the property?',
    helpText: 'Dead plants, dry grass, fallen leaves, and needles are easily ignited by embers',
    weight: 2,
    standard: 'CAL FIRE PRC 4291',
  },
  {
    id: 'veg-tree-spacing',
    category: 'vegetation',
    question: 'Are tree canopies spaced apart and limbed up from the ground?',
    helpText:
      'Maintain ~10 ft between canopies and remove lower limbs (6-10 ft up) to break up "ladder fuels" that carry fire from the ground into the crowns.',
    weight: 2,
    standard: 'CAL FIRE PRC 4291',
  },
  {
    id: 'veg-overhang',
    category: 'vegetation',
    question: 'Are branches cut back from the roof and chimney?',
    helpText: 'No limbs overhanging the roof; keep branches at least 10 ft from the chimney',
    weight: 2,
    standard: 'CAL FIRE PRC 4291',
  },

  // Ember Intrusion
  {
    id: 'vents-screened',
    category: 'ember-intrusion',
    question:
      'Are vents WUI-rated ember- and flame-resistant (not just covered with mesh)?',
    helpText:
      'Standard 1/8-inch mesh slows but does not stop wind-driven embers. Use vents tested to ASTM E2886 / listed by the State Fire Marshal. Where only mesh is possible, use 1/16-1/8 inch noncombustible, corrosion-resistant metal mesh.',
    weight: 3,
    standard: 'CBC Chapter 7A §706A · IBHS WFPH',
  },
  {
    id: 'gaps-sealed',
    category: 'ember-intrusion',
    question: 'Are gaps in eaves and soffits sealed?',
    helpText: 'No openings for embers to enter',
    weight: 2,
  },
  {
    id: 'windows-multiPane',
    category: 'ember-intrusion',
    question: 'Do you have dual-pane or tempered glass windows?',
    helpText: 'Single-pane windows can break from radiant heat',
    weight: 2,
    standard: 'CBC Chapter 7A',
  },

  // Access & Evacuation
  {
    id: 'driveway-clearance',
    category: 'access-evacuation',
    question: 'Is your driveway at least 12 feet wide with vertical clearance?',
    helpText: 'Fire trucks need clearance for access',
    weight: 2,
  },
  {
    id: 'address-visible',
    category: 'access-evacuation',
    question: 'Is your address clearly visible from the road?',
    helpText: 'Use reflective numbers at least 4 inches tall',
    weight: 1,
  },
  {
    id: 'evacuation-plan',
    category: 'access-evacuation',
    question: 'Does your household have an evacuation plan?',
    helpText: 'Including multiple routes and meeting points',
    weight: 2,
  },

  // Water Supply
  {
    id: 'water-source',
    category: 'water-supply',
    question: 'Is there a reliable water source for firefighting?',
    helpText: 'Pool, pond, cistern, or hydrant within 1000 feet',
    weight: 2,
  },
  {
    id: 'hose-available',
    category: 'water-supply',
    question: 'Do you have a garden hose that can reach all areas of your home?',
    helpText: 'At least 100 feet of hose with proper fittings',
    weight: 1,
  },
];

export function ChecklistStep({ responses, onUpdate }: ChecklistStepProps) {
  const [expandedHelp, setExpandedHelp] = useState<string | null>(null);

  const handleResponse = (itemId: string, value: boolean) => {
    const newResponses = { ...responses, [itemId]: value };
    const scores = calculateScores(newResponses);
    onUpdate(newResponses, scores);
  };

  const calculateScores = (resp: Record<string, boolean | string>): Partial<CategoryScores> => {
    const categoryTotals: Record<string, { score: number; maxScore: number }> = {};

    checklistItems.forEach((item) => {
      if (!categoryTotals[item.category]) {
        categoryTotals[item.category] = { score: 0, maxScore: 0 };
      }

      categoryTotals[item.category].maxScore += item.weight;

      if (resp[item.id] === true) {
        categoryTotals[item.category].score += item.weight;
      }
    });

    const scores: Partial<CategoryScores> = {};

    Object.entries(categoryTotals).forEach(([category, totals]) => {
      const normalizedScore = Math.round((totals.score / totals.maxScore) * 10);
      switch (category) {
        case 'defensible-space':
          scores.defensibleSpace = normalizedScore;
          break;
        case 'roof-structure':
          scores.roofAndStructure = normalizedScore;
          break;
        case 'vegetation':
          scores.vegetationManagement = normalizedScore;
          break;
        case 'ember-intrusion':
          scores.emberIntrusion = normalizedScore;
          break;
        case 'access-evacuation':
          scores.accessAndEvacuation = normalizedScore;
          break;
        case 'water-supply':
          scores.waterSupply = normalizedScore;
          break;
      }
    });

    return scores;
  };

  const groupedItems = checklistItems.reduce(
    (acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    },
    {} as Record<string, ChecklistItem[]>
  );

  const categoryNames: Record<RiskCategory, string> = {
    'defensible-space': 'Defensible Space',
    'roof-structure': 'Roof & Structure',
    vegetation: 'Vegetation Management',
    'ember-intrusion': 'Ember Intrusion Prevention',
    'access-evacuation': 'Access & Evacuation',
    'water-supply': 'Water Supply',
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Inspection Checklist
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Answer these questions to assess your property's fire readiness.
        </p>
      </div>

      <div className="space-y-8">
        {Object.entries(groupedItems).map(([category, items]) => (
          <div key={category}>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              {categoryNames[category as RiskCategory]}
            </h3>
            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {item.question}
                      </p>
                      {item.standard && (
                        <span className="mt-1 inline-block text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                          {item.standard}
                        </span>
                      )}
                      {item.helpText && (
                        <button
                          onClick={() =>
                            setExpandedHelp(expandedHelp === item.id ? null : item.id)
                          }
                          className="mt-1 inline-flex items-center text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          <QuestionMarkCircleIcon className="w-4 h-4 mr-1" />
                          {expandedHelp === item.id ? 'Hide help' : 'More info'}
                        </button>
                      )}
                      {expandedHelp === item.id && item.helpText && (
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-2 rounded">
                          {item.helpText}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleResponse(item.id, true)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                          responses[item.id] === true
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                        }`}
                      >
                        <CheckCircleIcon className="w-4 h-4" />
                        {item.positiveLabel || 'Yes'}
                      </button>
                      <button
                        onClick={() => handleResponse(item.id, false)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                          responses[item.id] === false
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                        }`}
                      >
                        <XCircleIcon className="w-4 h-4" />
                        {item.negativeLabel || 'No'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Progress</span>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {Object.keys(responses).length} / {checklistItems.length} answered
          </span>
        </div>
        <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-fire-500 rounded-full transition-all"
            style={{
              width: `${(Object.keys(responses).length / checklistItems.length) * 100}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
