import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownTrayIcon, FireIcon } from '@heroicons/react/24/outline';
import { showErrorToast, showSuccessToast } from '@/shared/stores/toastStore';
import { track } from '@/shared/services/analytics';
import { downloadTextFile, fileSlug } from '@/shared/utils/download';
import {
  fetchFireExposures,
  recordFireExposure,
  type AgencyDashboardRow,
  type FireExposure,
} from '../organizationsService';
import { exposureSummary, hasLocation } from '../agencyRollup';
import { checkPropertiesForFires, FIRE_SOURCE, NEAR_DISTANCE_M } from '../fireCheck';
import { exposuresCsv } from '../exports';

interface FireExposurePanelProps {
  organizationId: string;
  organizationName: string;
  rows: AgencyDashboardRow[];
  /** Inspector/admin: may run the check and record exposures. */
  canRecord: boolean;
  isOnline: boolean;
}

/**
 * Effectiveness monitoring (WFCA C5-2 KSA-7): which submitted properties a
 * current-year wildfire reached or came within 1 km of, and how their
 * mitigation stood when the fire was discovered.
 */
export function FireExposurePanel({
  organizationId,
  organizationName,
  rows,
  canRecord,
  isOnline,
}: FireExposurePanelProps) {
  const [exposures, setExposures] = useState<FireExposure[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [lastCheck, setLastCheck] = useState<{ at: string; failed: number } | null>(null);

  const load = useCallback(async () => {
    try {
      setExposures(await fetchFireExposures(organizationId));
    } catch (error) {
      console.error('Error loading fire exposures:', error);
    }
  }, [organizationId]);

  useEffect(() => {
    setLastCheck(null);
    void load();
  }, [load]);

  const summary = useMemo(() => exposureSummary(exposures), [exposures]);
  const byAssessment = useMemo(() => new Map(rows.map((r) => [r.assessmentId, r])), [rows]);
  const located = rows.filter(hasLocation);

  async function runCheck() {
    setProgress({ done: 0, total: located.length });
    try {
      const { hits, failed } = await checkPropertiesForFires(
        located.map((r) => ({
          assessmentId: r.assessmentId,
          latitude: r.latitude as number,
          longitude: r.longitude as number,
        })),
        { onProgress: (done, total) => setProgress({ done, total }) }
      );
      let recordFailures = 0;
      for (const hit of hits) {
        try {
          await recordFireExposure(organizationId, hit, FIRE_SOURCE);
        } catch (error) {
          recordFailures++;
          console.error('Error recording exposure:', error);
        }
      }
      await load();
      setLastCheck({ at: new Date().toISOString(), failed: failed.length + recordFailures });
      void track('fire_exposure_check', { properties: located.length, hits: hits.length, failed: failed.length });
      showSuccessToast(
        'Fire check complete',
        hits.length === 0
          ? 'No 2026 wildfire perimeters reached or came near these properties.'
          : `${new Set(hits.map((h) => h.assessmentId)).size} properties near or inside a fire perimeter.`
      );
    } catch (error) {
      console.error('Fire check failed:', error);
      showErrorToast('Fire check failed', 'Check your connection and try again.');
    } finally {
      setProgress(null);
    }
  }

  function exportCsv() {
    downloadTextFile(
      `${fileSlug(organizationName)}-fire-exposures-${new Date().toISOString().slice(0, 10)}.csv`,
      exposuresCsv(exposures, rows),
      'text/csv;charset=utf-8'
    );
  }

  return (
    <div className="card p-4 space-y-4 break-inside-avoid">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-gray-900 dark:text-white inline-flex items-center gap-2">
            <FireIcon className="w-5 h-5 text-fire-600" aria-hidden="true" />
            Fire exposure
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
            Properties a 2026 wildfire perimeter reached or came within {NEAR_DISTANCE_M / 1000} km
            of (NIFC WFIGS, prescribed burns excluded), with their mitigation as it stood when the
            fire was discovered.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          {exposures.length > 0 && (
            <button type="button" onClick={exportCsv} className="btn-outline text-sm inline-flex items-center gap-1">
              <ArrowDownTrayIcon className="w-4 h-4" aria-hidden="true" />
              Exposures (CSV)
            </button>
          )}
          {canRecord && (
            <button
              type="button"
              onClick={() => void runCheck()}
              disabled={progress !== null || !isOnline || located.length === 0}
              title={isOnline ? undefined : 'Connect to the internet to check fire perimeters'}
              className="btn-primary text-sm disabled:opacity-50"
            >
              {progress
                ? `Checking ${progress.done}/${progress.total}…`
                : 'Check against fire perimeters'}
            </button>
          )}
        </div>
      </div>

      {lastCheck && lastCheck.failed > 0 && (
        <p className="text-sm text-yellow-700 dark:text-yellow-300">
          {lastCheck.failed} {lastCheck.failed === 1 ? 'property' : 'properties'} could not be
          checked or recorded. Run the check again to retry.
        </p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Properties exposed" value={summary.properties} sub={`${summary.fires} fires`} />
        <Stat label="Reached by a perimeter" value={summary.inside} sub="inside, not just near" />
        <Stat
          label="Fully done at fire start"
          value={summary.properties === 0 ? '–' : `${summary.fullyDoneAtStart}/${summary.properties}`}
          sub="owner-reported"
        />
        <Stat
          label="Fully verified at fire start"
          value={summary.properties === 0 ? '–' : `${summary.fullyVerifiedAtStart}/${summary.properties}`}
          sub="inspector-verified"
        />
      </div>

      {exposures.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No exposures recorded.
          {canRecord
            ? ' Run the check to compare these properties with current-year fire perimeters.'
            : ' An inspector or admin can run the check.'}
        </p>
      ) : (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {exposures.map((e) => {
            const row = byAssessment.get(e.assessmentId);
            return (
              <li key={e.id} className="py-3 flex flex-wrap items-center gap-3 text-sm">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    e.relation === 'inside'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200'
                  }`}
                >
                  {e.relation === 'inside' ? 'Inside' : 'Within 1 km'}
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/assessment/${e.assessmentId}`}
                    className="font-medium text-gray-900 dark:text-white hover:text-fire-600"
                  >
                    {row?.address ?? 'Property'}
                  </Link>
                  <p className="text-gray-500 dark:text-gray-400">
                    {e.incidentName}
                    {e.discoveredAt && ` · discovered ${new Date(e.discoveredAt).toLocaleDateString()}`}
                    {e.acres !== undefined && ` · ${e.acres.toLocaleString()} acres`}
                  </p>
                </div>
                <p className="text-gray-700 dark:text-gray-300">
                  At fire start: {e.doneAtStart}/{e.recommendationsTotal} done, {e.verifiedAtStart}{' '}
                  verified
                  {e.immediateOutstandingAtStart > 0 && (
                    <span className="text-red-700 dark:text-red-300">
                      {' '}
                      · {e.immediateOutstandingAtStart} immediate open
                    </span>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number | string; sub: string }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-xl font-semibold text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{sub}</p>
    </div>
  );
}
