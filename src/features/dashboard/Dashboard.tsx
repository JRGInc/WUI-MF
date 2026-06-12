import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardDocumentCheckIcon,
  MapIcon,
  AcademicCapIcon,
  PlusIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/app/providers/AuthProvider';
import { supabase } from '@/shared/services/supabaseClient';
import { LoadingSpinner } from '@/shared/components/LoadingScreen';
import type { Assessment, Property, RiskLevel } from '@/shared/types';

interface DashboardStats {
  totalAssessments: number;
  completedAssessments: number;
  averageRiskScore: number;
  pendingActions: number;
}

function getRiskLevelFromScore(score: number): RiskLevel {
  if (score >= 8) return 'low';
  if (score >= 6) return 'moderate';
  if (score >= 4) return 'high';
  return 'extreme';
}

function getRiskColor(level: RiskLevel): string {
  switch (level) {
    case 'low':
      return 'text-green-600 bg-green-100 dark:bg-green-900/20';
    case 'moderate':
      return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20';
    case 'high':
      return 'text-orange-600 bg-orange-100 dark:bg-orange-900/20';
    case 'extreme':
      return 'text-red-600 bg-red-100 dark:bg-red-900/20';
  }
}

export default function Dashboard() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [_properties, setProperties] = useState<Property[]>([]);
  const [recentAssessments, setRecentAssessments] = useState<Assessment[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalAssessments: 0,
    completedAssessments: 0,
    averageRiskScore: 0,
    pendingActions: 0,
  });

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  async function loadDashboardData() {
    setIsLoading(true);
    try {
      // Try to load from Supabase
      const { data: propertiesData, error: propError } = await supabase
        .from('properties')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (!propError && propertiesData) {
        setProperties(propertiesData as unknown as Property[]);
      }

      const { data: assessmentsData, error: assError } = await supabase
        .from('assessments')
        .select('*, properties!inner(*)')
        .eq('properties.user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!assError && assessmentsData) {
        setRecentAssessments(assessmentsData as unknown as Assessment[]);

        // Calculate stats
        const completed = assessmentsData.filter((a: { status: string }) => a.status === 'completed');
        const totalScore = completed.reduce((sum: number, a: { overall_score?: number }) => sum + (a.overall_score || 0), 0);

        setStats({
          totalAssessments: assessmentsData.length,
          completedAssessments: completed.length,
          averageRiskScore: completed.length > 0 ? totalScore / completed.length : 0,
          pendingActions: assessmentsData.filter((a: { status: string }) => a.status === 'in_progress').length,
        });
      } else {
        // Use demo data if Supabase is not configured
        console.log('Using demo data (Supabase not configured)');
        setStats({
          totalAssessments: 0,
          completedAssessments: 0,
          averageRiskScore: 0,
          pendingActions: 0,
        });
      }
    } catch (error) {
      console.log('Using demo mode - Supabase not configured');
      // Set empty state for demo mode
      setStats({
        totalAssessments: 0,
        completedAssessments: 0,
        averageRiskScore: 0,
        pendingActions: 0,
      });
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Welcome back! Here's an overview of your wildfire risk assessments.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          to="/assessment/new"
          className="relative flex items-center space-x-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-5 shadow-sm hover:border-fire-500 hover:ring-1 hover:ring-fire-500 transition-all"
        >
          <div className="flex-shrink-0">
            <div className="h-10 w-10 rounded-full bg-fire-100 dark:bg-fire-900/20 flex items-center justify-center">
              <PlusIcon className="h-6 w-6 text-fire-600" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <span className="absolute inset-0" aria-hidden="true" />
            <p className="text-sm font-medium text-gray-900 dark:text-white">New Assessment</p>
            <p className="truncate text-sm text-gray-500 dark:text-gray-400">
              Start a new property assessment
            </p>
          </div>
        </Link>

        <Link
          to="/map"
          className="relative flex items-center space-x-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-5 shadow-sm hover:border-fire-500 hover:ring-1 hover:ring-fire-500 transition-all"
        >
          <div className="flex-shrink-0">
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
              <MapIcon className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <span className="absolute inset-0" aria-hidden="true" />
            <p className="text-sm font-medium text-gray-900 dark:text-white">View Risk Map</p>
            <p className="truncate text-sm text-gray-500 dark:text-gray-400">
              Explore fire risk in your area
            </p>
          </div>
        </Link>

        <Link
          to="/training"
          className="relative flex items-center space-x-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-5 shadow-sm hover:border-fire-500 hover:ring-1 hover:ring-fire-500 transition-all"
        >
          <div className="flex-shrink-0">
            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
              <AcademicCapIcon className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <span className="absolute inset-0" aria-hidden="true" />
            <p className="text-sm font-medium text-gray-900 dark:text-white">Training</p>
            <p className="truncate text-sm text-gray-500 dark:text-gray-400">
              Learn wildfire preparedness
            </p>
          </div>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="card p-6">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Assessments</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
            {stats.totalAssessments}
          </p>
        </div>
        <div className="card p-6">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Completed</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
            {stats.completedAssessments}
          </p>
        </div>
        <div className="card p-6">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Average Score</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
            {stats.averageRiskScore.toFixed(1)}
          </p>
        </div>
        <div className="card p-6">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">In Progress</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
            {stats.pendingActions}
          </p>
        </div>
      </div>

      {/* Recent Assessments */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Recent Assessments</h2>
        </div>
        {recentAssessments.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <ClipboardDocumentCheckIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
              No assessments yet
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Get started by creating your first property assessment.
            </p>
            <div className="mt-6">
              <Link to="/assessment/new" className="btn-primary">
                <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                New Assessment
              </Link>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {recentAssessments.map((assessment) => {
              const riskLevel = getRiskLevelFromScore(assessment.overallScore || 0);
              return (
                <li key={assessment.id}>
                  <Link
                    to={`/assessment/${assessment.id}`}
                    className="block hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <div className="px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div
                            className={`flex-shrink-0 w-2.5 h-2.5 rounded-full ${
                              assessment.status === 'completed'
                                ? 'bg-green-500'
                                : 'bg-yellow-500'
                            }`}
                          />
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            Property Assessment
                          </p>
                        </div>
                        <div className="flex items-center space-x-4">
                          {assessment.overallScore !== undefined && (
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getRiskColor(
                                riskLevel
                              )}`}
                            >
                              Score: {assessment.overallScore}/10
                            </span>
                          )}
                          <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                        </div>
                      </div>
                      <div className="mt-2 flex items-center text-sm text-gray-500 dark:text-gray-400">
                        <span>
                          {new Date(assessment.createdAt).toLocaleDateString()}
                        </span>
                        <span className="mx-2">•</span>
                        <span className="capitalize">{assessment.status.replace('_', ' ')}</span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Risk Alert (if applicable) */}
      {stats.averageRiskScore > 0 && stats.averageRiskScore < 6 && (
        <div className="rounded-md bg-orange-50 dark:bg-orange-900/20 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <ExclamationTriangleIcon
                className="h-5 w-5 text-orange-400"
                aria-hidden="true"
              />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-orange-800 dark:text-orange-200">
                Attention needed
              </h3>
              <div className="mt-2 text-sm text-orange-700 dark:text-orange-300">
                <p>
                  Your average risk score indicates elevated wildfire risk. Consider reviewing
                  your assessments and implementing recommended improvements.
                </p>
              </div>
              <div className="mt-4">
                <div className="-mx-2 -my-1.5 flex">
                  <Link
                    to="/training"
                    className="rounded-md bg-orange-50 dark:bg-orange-900/30 px-2 py-1.5 text-sm font-medium text-orange-800 dark:text-orange-200 hover:bg-orange-100 dark:hover:bg-orange-900/50"
                  >
                    View Training
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
