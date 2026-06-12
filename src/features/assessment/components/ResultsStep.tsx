import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import type { CategoryScores, Finding, RiskLevel } from '@/shared/types';

interface ResultsStepProps {
  categoryScores: CategoryScores;
  findings: Finding[];
  overallScore: number;
}

function getScoreLevel(score: number): RiskLevel {
  if (score >= 8) return 'low';
  if (score >= 6) return 'moderate';
  if (score >= 4) return 'high';
  return 'extreme';
}

function getScoreColor(level: RiskLevel): string {
  switch (level) {
    case 'low':
      return 'text-green-600 dark:text-green-400';
    case 'moderate':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'high':
      return 'text-orange-600 dark:text-orange-400';
    case 'extreme':
      return 'text-red-600 dark:text-red-400';
  }
}

function getScoreBg(level: RiskLevel): string {
  switch (level) {
    case 'low':
      return 'bg-green-100 dark:bg-green-900/30';
    case 'moderate':
      return 'bg-yellow-100 dark:bg-yellow-900/30';
    case 'high':
      return 'bg-orange-100 dark:bg-orange-900/30';
    case 'extreme':
      return 'bg-red-100 dark:bg-red-900/30';
  }
}

function ScoreIcon({ level }: { level: RiskLevel }) {
  switch (level) {
    case 'low':
      return <CheckCircleIcon className="w-6 h-6" />;
    case 'moderate':
      return <ExclamationTriangleIcon className="w-6 h-6" />;
    case 'high':
    case 'extreme':
      return <XCircleIcon className="w-6 h-6" />;
  }
}

const categoryInfo: Record<
  keyof CategoryScores,
  { name: string; description: string }
> = {
  defensibleSpace: {
    name: 'Defensible Space',
    description: 'Clearance and vegetation management around your home',
  },
  roofAndStructure: {
    name: 'Roof & Structure',
    description: 'Fire-resistant building materials and maintenance',
  },
  vegetationManagement: {
    name: 'Vegetation',
    description: 'Plant selection and landscape maintenance',
  },
  accessAndEvacuation: {
    name: 'Access & Evacuation',
    description: 'Emergency access and evacuation readiness',
  },
  waterSupply: {
    name: 'Water Supply',
    description: 'Water availability for firefighting',
  },
  emberIntrusion: {
    name: 'Ember Protection',
    description: 'Protection against ember intrusion',
  },
};

export function ResultsStep({
  categoryScores,
  findings,
  overallScore,
}: ResultsStepProps) {
  const overallLevel = getScoreLevel(overallScore);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Assessment Results
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Here's a summary of your property's wildfire risk assessment.
        </p>
      </div>

      {/* Overall Score */}
      <div
        className={`rounded-2xl p-8 text-center ${getScoreBg(overallLevel)}`}
      >
        <div className="flex justify-center mb-4">
          <div
            className={`w-24 h-24 rounded-full flex items-center justify-center ${
              overallLevel === 'low'
                ? 'bg-green-200 dark:bg-green-800'
                : overallLevel === 'moderate'
                ? 'bg-yellow-200 dark:bg-yellow-800'
                : overallLevel === 'high'
                ? 'bg-orange-200 dark:bg-orange-800'
                : 'bg-red-200 dark:bg-red-800'
            }`}
          >
            <span
              className={`text-4xl font-bold ${getScoreColor(overallLevel)}`}
            >
              {overallScore}
            </span>
          </div>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Overall Risk Score
        </h3>
        <p className={`text-sm font-medium capitalize ${getScoreColor(overallLevel)}`}>
          {overallLevel} Risk
        </p>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 max-w-md mx-auto">
          {overallLevel === 'low' && 'Your property shows good wildfire preparedness.'}
          {overallLevel === 'moderate' &&
            'Your property has room for improvement in fire safety.'}
          {overallLevel === 'high' &&
            'Your property needs attention to reduce wildfire risk.'}
          {overallLevel === 'extreme' &&
            'Immediate action recommended to improve fire safety.'}
        </p>
      </div>

      {/* Category Scores */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Category Breakdown
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {(Object.entries(categoryScores) as [keyof CategoryScores, number][]).map(
            ([key, score]) => {
              const level = getScoreLevel(score);
              const info = categoryInfo[key];
              return (
                <div
                  key={key}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${getScoreBg(level)}`}>
                        <ScoreIcon level={level} />
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                          {info.name}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {info.description}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-2xl font-bold ${getScoreColor(level)}`}
                      >
                        {score}
                      </span>
                      <span className="text-sm text-gray-400">/10</span>
                    </div>
                  </div>
                  {/* Score bar */}
                  <div className="mt-3 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        level === 'low'
                          ? 'bg-green-500'
                          : level === 'moderate'
                          ? 'bg-yellow-500'
                          : level === 'high'
                          ? 'bg-orange-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${score * 10}%` }}
                    />
                  </div>
                </div>
              );
            }
          )}
        </div>
      </div>

      {/* Findings */}
      {findings.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Key Findings
          </h3>
          <div className="space-y-3">
            {findings.slice(0, 5).map((finding) => {
              const severityColors = {
                low: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20',
                moderate:
                  'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20',
                high: 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20',
                extreme: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20',
              };
              return (
                <div
                  key={finding.id}
                  className={`rounded-lg border p-4 ${severityColors[finding.severity]}`}
                >
                  <div className="flex items-start gap-3">
                    <ExclamationTriangleIcon
                      className={`w-5 h-5 flex-shrink-0 ${
                        finding.severity === 'extreme' || finding.severity === 'high'
                          ? 'text-red-500'
                          : finding.severity === 'moderate'
                          ? 'text-yellow-500'
                          : 'text-green-500'
                      }`}
                    />
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                        {finding.title}
                      </h4>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                        {finding.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Next Steps */}
      <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-6">
        <div className="flex items-start gap-4">
          <ShieldCheckIcon className="w-8 h-8 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <div>
            <h3 className="text-lg font-medium text-blue-900 dark:text-blue-100">
              Next Steps
            </h3>
            <ul className="mt-2 text-sm text-blue-800 dark:text-blue-200 space-y-2">
              <li>
                • Review the detailed recommendations after completing the assessment
              </li>
              <li>• Share this report with your local fire agency for guidance</li>
              <li>
                • Complete our training modules to learn more about wildfire preparedness
              </li>
              <li>• Schedule regular follow-up assessments (recommended: annually)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
