import { useState } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  QuestionMarkCircleIcon,
  MapPinIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import type { CategoryScores, RiskCategory } from '@/shared/types';
import { BASIS_LABELS } from '../content/guidelines';
import type { ChecklistItem, GuidelineProfile } from '../content/guidelines';

interface ChecklistStepProps {
  /** Guideline set resolved from the property's state (composite fallback). */
  profile: GuidelineProfile;
  responses: Record<string, boolean | string>;
  onUpdate: (responses: Record<string, boolean | string>, scores: Partial<CategoryScores>) => void;
}


export function ChecklistStep({ profile, responses, onUpdate }: ChecklistStepProps) {
  const [expandedHelp, setExpandedHelp] = useState<string | null>(null);
  const [showProvenance, setShowProvenance] = useState(false);
  const checklistItems = profile.checklistItems;

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

  const answeredCount = checklistItems.filter(
    (item) => responses[item.id] !== undefined
  ).length;

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

      {/* Which jurisdiction's guidelines this checklist follows, with
          expandable provenance (legal status + official sources) */}
      <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3">
        <div className="flex items-start gap-2">
          <MapPinIcon className="w-5 h-5 shrink-0 text-blue-600 dark:text-blue-300" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
              {profile.stateCode
                ? `Using ${profile.label} guidelines`
                : 'Using national composite guidelines'}
              <span className="ml-2 inline-block rounded-full bg-blue-100 dark:bg-blue-800/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-blue-700 dark:text-blue-200">
                {BASIS_LABELS[profile.basis]}
              </span>
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              {profile.stateCode
                ? `Based on the property's location · ${profile.authority}`
                : `No state-specific guidance for this property's location · ${profile.authority}`}
            </p>
            <button
              onClick={() => setShowProvenance(!showProvenance)}
              className="mt-1 text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-100"
            >
              {showProvenance ? 'Hide details' : 'About these guidelines'}
            </button>
            {showProvenance && (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-blue-800 dark:text-blue-200">{profile.basisNote}</p>
                <ul className="space-y-1">
                  {profile.sources.map((source) => (
                    <li key={source.url}>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-700 underline hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100"
                      >
                        <ArrowTopRightOnSquareIcon className="w-3 h-3 shrink-0" />
                        {source.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
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

      {/* Progress — count only items in the active profile, since responses
          may carry answers from a different profile after a location change */}
      <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Progress</span>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {answeredCount} / {checklistItems.length} answered
          </span>
        </div>
        <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-fire-500 rounded-full transition-all"
            style={{
              width: `${(answeredCount / checklistItems.length) * 100}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
