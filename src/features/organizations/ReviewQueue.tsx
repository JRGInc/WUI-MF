import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import { LoadingSpinner } from '@/shared/components/LoadingScreen';
import { useOffline } from '@/app/providers/OfflineProvider';
import { useMyMemberships } from './hooks/useMyMemberships';
import { fetchReviewQueue, type ReviewQueueItem } from './organizationsService';

/**
 * Assessments homeowners submitted to the organizations the user belongs to.
 * Opening one shows the report read-only, with Verify on completed items for
 * inspectors/admins. (The full agency dashboard — map, rollups, status — is a
 * separate workstream.)
 */
export default function ReviewQueue() {
  const memberships = useMyMemberships();
  const { isOnline } = useOffline();
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const orgIds = memberships.map((m) => m.organization.id).join(',');

  useEffect(() => {
    if (!orgIds) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    fetchReviewQueue(orgIds.split(','))
      .then(setItems)
      .catch((error) => console.error('Error loading review queue:', error))
      .finally(() => setIsLoading(false));
  }, [orgIds]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inspections</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {memberships.length > 0
            ? `Assessments submitted to ${memberships.map((m) => m.organization.name).join(', ')}`
            : 'You are not a member of any organization.'}
        </p>
      </div>

      {!isOnline && (
        <p className="text-sm text-yellow-700 dark:text-yellow-300">
          You are offline. Submissions load when you reconnect.
        </p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : items.length === 0 ? (
        <div className="card p-8 text-center text-gray-500 dark:text-gray-400">
          <ClipboardDocumentListIcon className="w-10 h-10 mx-auto mb-2" aria-hidden="true" />
          No submitted assessments yet.
        </div>
      ) : (
        <ul className="card divide-y divide-gray-200 dark:divide-gray-700">
          {items.map((item) => (
            <li key={item.submission.id}>
              <Link
                to={`/assessment/${item.submission.assessmentId}`}
                className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">
                    {item.address ?? 'Address not provided'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {memberships.length > 1 && `${item.organizationName} · `}
                    Submitted {new Date(item.submission.submittedAt).toLocaleDateString()}
                  </p>
                </div>
                {item.overallScore !== undefined && (
                  <span className="text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    Score {item.overallScore}/10
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
