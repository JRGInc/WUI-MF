import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ShareIcon,
  MapIcon,
  CameraIcon,
  PencilIcon,
} from '@heroicons/react/24/outline';
import { supabase } from '@/shared/services/supabaseClient';
import { getLocalAssessment } from '@/shared/services/offlineStorage';
import { LoadingSpinner } from '@/shared/components/LoadingScreen';
import { ShareDialog } from '@/features/sharing/components/ShareDialog';
import type { Assessment, Property, RiskLevel } from '@/shared/types';

function getRiskLevel(score: number): RiskLevel {
  if (score >= 8) return 'low';
  if (score >= 6) return 'moderate';
  if (score >= 4) return 'high';
  return 'extreme';
}

function getRiskBadgeClass(level: RiskLevel): string {
  switch (level) {
    case 'low':
      return 'risk-badge-low';
    case 'moderate':
      return 'risk-badge-moderate';
    case 'high':
      return 'risk-badge-high';
    case 'extreme':
      return 'risk-badge-extreme';
  }
}

export default function AssessmentDetail() {
  const { id, token } = useParams();
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const isSharedView = !!token;

  useEffect(() => {
    loadAssessment();
  }, [id, token]);

  async function loadAssessment() {
    setIsLoading(true);
    try {
      if (isSharedView && token) {
        // Load from shared report
        const { data: sharedReport } = await supabase
          .from('shared_reports')
          .select('*, assessments(*)')
          .eq('access_token', token)
          .single();

        if (sharedReport?.assessments) {
          setAssessment(sharedReport.assessments as unknown as Assessment);
        }
      } else if (id) {
        // Try local first
        const localAssessment = await getLocalAssessment(id);
        if (localAssessment) {
          setAssessment(localAssessment);
        } else {
          // Load from Supabase
          const { data } = await supabase
            .from('assessments')
            .select('*, properties(*)')
            .eq('id', id)
            .single();

          if (data) {
            setAssessment(data as unknown as Assessment);
            if (data.properties) {
              setProperty(data.properties as unknown as Property);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading assessment:', error);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Assessment not found
        </h2>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          The assessment you're looking for doesn't exist or you don't have access.
        </p>
        {!isSharedView && (
          <Link to="/" className="btn-primary mt-4 inline-flex">
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
        )}
      </div>
    );
  }

  const riskLevel = getRiskLevel(assessment.overallScore || 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {!isSharedView && (
            <Link
              to="/"
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </Link>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Property Assessment
            </h1>
            {property && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {property.address}
              </p>
            )}
          </div>
        </div>

        {!isSharedView && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowShareDialog(true)}
              className="btn-outline flex items-center gap-2"
            >
              <ShareIcon className="w-4 h-4" />
              Share
            </button>
            <Link
              to={`/assessment/${assessment.id}/edit`}
              className="btn-outline flex items-center gap-2"
            >
              <PencilIcon className="w-4 h-4" />
              Edit
            </Link>
          </div>
        )}
      </div>

      {/* Score Card */}
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Overall Risk Score</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-4xl font-bold text-gray-900 dark:text-white">
                {assessment.overallScore}
              </span>
              <span className="text-lg text-gray-400">/10</span>
            </div>
          </div>
          <span className={`${getRiskBadgeClass(riskLevel)} text-sm px-4 py-2`}>
            {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} Risk
          </span>
        </div>

        {/* Category Scores */}
        {assessment.categoryScores && (
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
            {Object.entries(assessment.categoryScores).map(([key, value]) => (
              <div key={key} className="text-center">
                <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {value}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      {!isSharedView && (
        <div className="grid grid-cols-2 gap-4">
          <Link
            to={`/map/${assessment.id}`}
            className="card p-4 hover:border-fire-500 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <MapIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">View on Map</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  See risk visualization
                </p>
              </div>
            </div>
          </Link>
          <Link
            to={`/ar/${assessment.id}`}
            className="card p-4 hover:border-fire-500 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <CameraIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">AR View</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Augmented reality overlay
                </p>
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* Findings */}
      {assessment.findings && assessment.findings.length > 0 && (
        <div className="card">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              Findings
            </h2>
          </div>
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {assessment.findings.map((finding) => (
              <li key={finding.id} className="px-6 py-4">
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                      finding.severity === 'extreme' || finding.severity === 'high'
                        ? 'bg-red-500'
                        : finding.severity === 'moderate'
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                  />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {finding.title}
                    </p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {finding.description}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {assessment.recommendations && assessment.recommendations.length > 0 && (
        <div className="card">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              Recommendations
            </h2>
          </div>
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {assessment.recommendations.map((rec) => (
              <li key={rec.id} className="px-6 py-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {rec.title}
                      </p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          rec.priority === 'immediate'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                            : rec.priority === 'short-term'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                        }`}
                      >
                        {rec.priority}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {rec.description}
                    </p>
                  </div>
                  {rec.estimatedCost && (
                    <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap ml-4">
                      {rec.estimatedCost}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Metadata */}
      <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
        Assessment completed on{' '}
        {new Date(assessment.completedAt || assessment.createdAt).toLocaleDateString()}
      </div>

      {/* Share Dialog */}
      {showShareDialog && (
        <ShareDialog
          assessmentId={assessment.id}
          onClose={() => setShowShareDialog(false)}
        />
      )}
    </div>
  );
}
