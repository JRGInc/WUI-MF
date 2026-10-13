import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ShareIcon,
  MapIcon,
  CameraIcon,
  PencilIcon,
  PrinterIcon,
} from '@heroicons/react/24/outline';
import { shareClient, supabase } from '@/shared/services/supabaseClient';
import { ShareTokenContext } from '@/shared/services/dataClient';
import { getLocalAssessment, getLocalProperty, fromRow } from '@/shared/services/offlineStorage';
import { printPage } from '@/shared/utils/print';
import { PhotoGallery } from './components/PhotoGallery';
import { guidelineProfileById } from './content/guidelines';
import { LoadingSpinner } from '@/shared/components/LoadingScreen';
import { ShareDialog } from '@/features/sharing/components/ShareDialog';
import { RecommendationTracker } from '@/features/mitigation/components/RecommendationTracker';
import { useMyMemberships } from '@/features/organizations/hooks/useMyMemberships';
import { fetchSubmissions } from '@/features/organizations/organizationsService';
import { verifyingMembership } from '@/features/organizations/organizations';
import { useAuth } from '@/app/providers/AuthProvider';
import type { Assessment, AssessmentSubmission, Property, RiskLevel } from '@/shared/types';

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
  const [submissions, setSubmissions] = useState<AssessmentSubmission[]>([]);
  const { user } = useAuth();
  const memberships = useMyMemberships();
  const isSharedView = !!token;
  // Someone else's assessment, readable because it was submitted to an
  // organization the viewer belongs to (RLS: *_select_reviewer).
  const isReviewer = !isSharedView && !!property && !!user && property.userId !== user.id;
  const verifyAs = isReviewer ? verifyingMembership(memberships, submissions) : undefined;
  const readOnlyView = isSharedView || isReviewer;

  useEffect(() => {
    if (!isReviewer || !assessment) return;
    fetchSubmissions(assessment.id)
      .then(setSubmissions)
      .catch((error) => console.error('Error loading submissions:', error));
  }, [isReviewer, assessment]);

  useEffect(() => {
    loadAssessment();
  }, [id, token]);

  async function loadAssessment() {
    setIsLoading(true);
    try {
      if (isSharedView && token) {
        // Load from shared report
        // Token-scoped client: RLS only exposes the report this token names.
        const { data: sharedReport } = await shareClient(token)
          .from('shared_reports')
          .select('*, assessments(*)')
          .eq('access_token', token)
          .single();

        if (sharedReport?.assessments) {
          setAssessment(fromRow<Assessment>('assessments', sharedReport.assessments));
        }
      } else if (id) {
        // Try local first
        const localAssessment = await getLocalAssessment(id);
        if (localAssessment) {
          setAssessment(localAssessment);
          // The address heads the report (and its printout).
          setProperty((await getLocalProperty(localAssessment.propertyId)) ?? null);
        } else {
          // Load from Supabase
          const { data } = await supabase
            .from('assessments')
            .select('*, properties(*)')
            .eq('id', id)
            .single();

          if (data) {
            setAssessment(fromRow<Assessment>('assessments', data));
            if (data.properties) {
              setProperty(fromRow<Property>('properties', data.properties as Record<string, unknown>));
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
    <ShareTokenContext.Provider value={token}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Print-only masthead */}
        <div className="hidden print:block border-b border-gray-300 pb-2 text-xs text-gray-600">
          FireRisk wildfire property assessment report · generated{' '}
          {new Date().toLocaleDateString()}
        </div>

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            {!isSharedView && (
              <Link
                to="/"
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 print:hidden"
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
              {assessment.guidelineProfileId &&
                (() => {
                  const profile = guidelineProfileById(assessment.guidelineProfileId);
                  return (
                    <div className="text-xs text-gray-400 dark:text-gray-500">
                      <p>
                        Assessed against{' '}
                        {profile.stateCode
                          ? `${profile.label} guidelines`
                          : 'national composite guidelines'}
                        {' · '}
                        {profile.authority}
                      </p>
                      <p>
                        Sources:{' '}
                        {profile.sources.map((source, i) => (
                          <span key={source.url}>
                            {i > 0 && ' · '}
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline hover:text-gray-600 dark:hover:text-gray-300"
                            >
                              {source.title}
                            </a>
                          </span>
                        ))}
                      </p>
                    </div>
                  );
                })()}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {isReviewer && (
              <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 print:hidden">
                {verifyAs ? `Reviewing for ${verifyAs.organization.name}` : 'Read-only review'}
              </span>
            )}
            <button
              type="button"
              onClick={() => void printPage()}
              className="btn-outline flex items-center gap-2 print:hidden"
              aria-label="Print or save as PDF"
            >
              <PrinterIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Print / Save as PDF</span>
              <span className="sm:hidden">PDF</span>
            </button>
            {!readOnlyView && (
              <>
                <button
                  onClick={() => setShowShareDialog(true)}
                  className="btn-outline flex items-center gap-2 print:hidden"
                >
                  <ShareIcon className="w-4 h-4" />
                  Share
                </button>
                <Link
                  to={`/assessment/${assessment.id}/edit`}
                  className="btn-outline flex items-center gap-2 print:hidden"
                >
                  <PencilIcon className="w-4 h-4" />
                  Edit
                </Link>
              </>
            )}
          </div>
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
        {!readOnlyView && (
          <div className="grid grid-cols-2 gap-4 print:hidden">
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

        {/* Recommendations, with mitigation progress tracking */}
        {assessment.recommendations && assessment.recommendations.length > 0 && (
          <RecommendationTracker
            assessmentId={assessment.id}
            recommendations={assessment.recommendations}
            readOnly={readOnlyView}
            verifyAs={verifyAs}
          />
        )}

        {/* Photos */}
        <PhotoGallery assessmentId={assessment.id} />

        {/* Metadata */}
        <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
          Assessment completed on{' '}
          {new Date(assessment.completedAt || assessment.createdAt).toLocaleDateString()}
        </div>

        {/* Share Dialog */}
        {showShareDialog && (
          <ShareDialog
            assessmentId={assessment.id}
            stateCode={
              assessment.guidelineProfileId
                ? guidelineProfileById(assessment.guidelineProfileId).stateCode ?? undefined
                : undefined
            }
            onClose={() => setShowShareDialog(false)}
          />
        )}
      </div>
    </ShareTokenContext.Provider>
  );
}
