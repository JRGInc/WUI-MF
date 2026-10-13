import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowDownTrayIcon,
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  PrinterIcon,
} from '@heroicons/react/24/outline';
import { LoadingSpinner } from '@/shared/components/LoadingScreen';
import { useOffline } from '@/app/providers/OfflineProvider';
import { showErrorToast, showSuccessToast } from '@/shared/stores/toastStore';
import { track } from '@/shared/services/analytics';
import { downloadTextFile, fileSlug } from '@/shared/utils/download';
import { printPage } from '@/shared/utils/print';
import type { AssessmentSubmission } from '@/shared/types';
import { useMyMembershipsState } from './hooks/useMyMemberships';
import { VERIFYING_ROLES } from './organizations';
import {
  fetchAgencyDashboard,
  fetchAgencyExport,
  setSubmissionStatus,
  VerificationError,
  type AgencyDashboardRow,
} from './organizationsService';
import {
  agencyRollup,
  dashboardFeatures,
  PROGRESS_BAND_COLORS,
  PROGRESS_BAND_LABELS,
  progressBand,
  type ProgressBand,
} from './agencyRollup';
import { AgencyMap } from './components/AgencyMap';
import { actionsCsv, propertiesCsv, propertiesGeoJson } from './exports';

type Status = AssessmentSubmission['status'];

const STATUS_LABELS: Record<Status, string> = {
  submitted: 'New',
  in_review: 'In review',
  closed: 'Closed',
};

const STATUS_BADGE: Record<Status, string> = {
  submitted: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
  in_review: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
  closed: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

/** The next status actions offered for a submission. */
const NEXT_ACTIONS: Record<Status, { to: Status; label: string }[]> = {
  submitted: [
    { to: 'in_review', label: 'Start review' },
    { to: 'closed', label: 'Close' },
  ],
  in_review: [{ to: 'closed', label: 'Close' }],
  closed: [{ to: 'in_review', label: 'Reopen' }],
};

/**
 * Agency view of assessments submitted to the user's organizations (WFCA
 * Phase 2 C5-2): rollups, a map of properties coloured by mitigation
 * progress, and the submission list with review status. Opening a property
 * shows the report read-only, with Verify for inspectors/admins.
 */
export default function AgencyDashboard() {
  const { memberships, loaded: membershipsLoaded } = useMyMembershipsState();
  const { isOnline } = useOffline();
  const navigate = useNavigate();
  const [orgId, setOrgId] = useState<string>('');
  const [rows, setRows] = useState<AgencyDashboardRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('all');
  const [bandFilter, setBandFilter] = useState<ProgressBand | 'all'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Default to the first organization once memberships load.
  useEffect(() => {
    if (!orgId && memberships.length > 0) setOrgId(memberships[0].organization.id);
  }, [memberships, orgId]);

  const membership = memberships.find((m) => m.organization.id === orgId);
  const canAct = membership !== undefined && VERIFYING_ROLES.includes(membership.role);

  const load = useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    try {
      setRows(await fetchAgencyDashboard(orgId));
    } catch (error) {
      console.error('Error loading agency dashboard:', error);
      showErrorToast('Could not load submissions');
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (!membershipsLoaded) return;
    if (memberships.length === 0) {
      setIsLoading(false);
      return;
    }
    void load();
  }, [load, membershipsLoaded, memberships.length]);

  const rollup = useMemo(() => agencyRollup(rows), [rows]);
  // The map follows the progress filter (not the review-status filter).
  const features = useMemo(
    () => dashboardFeatures(bandFilter === 'all' ? rows : rows.filter((r) => progressBand(r) === bandFilter)),
    [rows, bandFilter]
  );
  const visible = rows.filter(
    (r) =>
      (statusFilter === 'all' || r.submissionStatus === statusFilter) &&
      (bandFilter === 'all' || progressBand(r) === bandFilter)
  );

  // Exports always cover every submission to the organization, not the
  // on-screen filters, so a grant report can't silently omit properties.
  type ExportKind = 'properties' | 'actions' | 'geojson';
  async function exportData(kind: ExportKind) {
    if (!membership) return;
    const stem = `${fileSlug(membership.organization.name)}-${
      kind === 'actions' ? 'mitigation-actions' : 'properties'
    }-${new Date().toISOString().slice(0, 10)}`;
    setExporting(true);
    try {
      if (kind === 'properties') {
        downloadTextFile(`${stem}.csv`, propertiesCsv(rows), 'text/csv;charset=utf-8');
      } else if (kind === 'geojson') {
        downloadTextFile(
          `${stem}.geojson`,
          propertiesGeoJson(rows, {
            organization: membership.organization.name,
            generatedAt: new Date().toISOString(),
          }),
          'application/geo+json'
        );
      } else {
        const actions = await fetchAgencyExport(membership.organization.id);
        downloadTextFile(`${stem}.csv`, actionsCsv(actions), 'text/csv;charset=utf-8');
        showSuccessToast('Export ready', `${actions.length} recommendations exported`);
      }
      void track('agency_export', { kind, rows: rows.length });
    } catch (error) {
      console.error('Export failed:', error);
      showErrorToast('Export failed', 'Check your connection and try again.');
    } finally {
      setExporting(false);
    }
  }

  async function changeStatus(row: AgencyDashboardRow, to: Status) {
    setBusyId(row.submissionId);
    try {
      const updated = await setSubmissionStatus(row.submissionId, to);
      setRows((prev) =>
        prev.map((r) =>
          r.submissionId === row.submissionId
            ? { ...r, submissionStatus: updated.status, statusChangedAt: new Date().toISOString() }
            : r
        )
      );
    } catch (error) {
      console.error('Error updating submission status:', error);
      showErrorToast(
        'Could not update status',
        error instanceof VerificationError ? error.message : undefined
      );
    } finally {
      setBusyId(null);
    }
  }

  if (membershipsLoaded && memberships.length === 0) {
    return (
      <div className="max-w-4xl mx-auto card p-8 text-center text-gray-500 dark:text-gray-400">
        You are not a member of any organization.
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="hidden print:block border-b border-gray-300 pb-2 text-xs text-gray-600">
        {membership?.organization.name} · mitigation progress report · generated{' '}
        {new Date().toLocaleDateString()}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inspections</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Assessments homeowners submitted for review
            {membership && ` · your role: ${membership.role}`}
          </p>
        </div>
        {memberships.length > 1 && (
          <div className="print:hidden">
            <label htmlFor="org-select" className="sr-only">
              Organization
            </label>
            <select
              id="org-select"
              className="input"
              value={orgId}
              onChange={(e) => {
                setOrgId(e.target.value);
                setStatusFilter('all');
                setBandFilter('all');
              }}
            >
              {memberships.map((m) => (
                <option key={m.organization.id} value={m.organization.id}>
                  {m.organization.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {!isOnline && (
        <p className="text-sm text-yellow-700 dark:text-yellow-300">
          You are offline. The dashboard loads when you reconnect.
        </p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <>
          {/* Exports (grant reporting / GIS) */}
          <div className="flex flex-wrap items-center gap-2 print:hidden" role="group" aria-label="Export">
            <span className="text-sm text-gray-500 dark:text-gray-400 mr-1">Export all:</span>
            <ExportButton disabled={exporting || rows.length === 0} onClick={() => void exportData('properties')}>
              Properties (CSV)
            </ExportButton>
            <ExportButton
              disabled={exporting || rows.length === 0 || !isOnline}
              onClick={() => void exportData('actions')}
              title={isOnline ? undefined : 'Connect to the internet to export mitigation actions'}
            >
              Mitigation actions (CSV)
            </ExportButton>
            <ExportButton
              disabled={exporting || rows.length - rollup.unmapped === 0}
              onClick={() => void exportData('geojson')}
            >
              Map points (GeoJSON)
            </ExportButton>
            <button
              type="button"
              onClick={() => void printPage()}
              className="btn-outline text-sm inline-flex items-center gap-1"
            >
              <PrinterIcon className="w-4 h-4" aria-hidden="true" />
              Print / Save as PDF
            </button>
          </div>

          {/* Rollups */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Tile label="Properties" value={rollup.properties} sub={`${rollup.byStatus.submitted} new · ${rollup.byStatus.in_review} in review`} />
            <Tile
              label="Mitigations done"
              value={`${rollup.percentDone}%`}
              sub={`${rollup.mitigationsDone} of ${rollup.recommendations}`}
            />
            <Tile label="Verified" value={rollup.mitigationsVerified} sub="by an inspector" />
            <Tile label="Awaiting verification" value={rollup.awaitingVerification} sub="done, not yet verified" />
            <Tile
              label="Immediate outstanding"
              value={rollup.immediateOutstanding}
              sub="high-priority items not done"
              alert={rollup.immediateOutstanding > 0}
            />
          </div>

          {/* Map */}
          <div className="card p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2 print:hidden" role="group" aria-label="Filter by progress">
              <FilterChip active={bandFilter === 'all'} onClick={() => setBandFilter('all')}>
                All ({rows.length})
              </FilterChip>
              {(Object.keys(PROGRESS_BAND_LABELS) as ProgressBand[]).map((band) => (
                <FilterChip key={band} active={bandFilter === band} onClick={() => setBandFilter(band)}>
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle"
                    style={{ backgroundColor: PROGRESS_BAND_COLORS[band] }}
                    aria-hidden="true"
                  />
                  {PROGRESS_BAND_LABELS[band]} ({rollup.byBand[band]})
                </FilterChip>
              ))}
            </div>
            <AgencyMap
              features={features}
              onSelect={(id) => navigate(`/assessment/${id}`)}
            />
            {rollup.unmapped > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {rollup.unmapped} {rollup.unmapped === 1 ? 'property has' : 'properties have'} no
                location and {rollup.unmapped === 1 ? 'is' : 'are'} listed below only.
              </p>
            )}
          </div>

          {/* List */}
          <div className="card">
            <div
              className="flex flex-wrap gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700 print:hidden"
              role="group"
              aria-label="Filter by review status"
            >
              <FilterChip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
                All
              </FilterChip>
              {(Object.keys(STATUS_LABELS) as Status[]).map((s) => (
                <FilterChip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>
                  {STATUS_LABELS[s]} ({rollup.byStatus[s]})
                </FilterChip>
              ))}
            </div>

            {visible.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <ClipboardDocumentListIcon className="w-10 h-10 mx-auto mb-2" aria-hidden="true" />
                {rows.length === 0 ? 'No submitted assessments yet.' : 'Nothing matches these filters.'}
              </div>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {visible.map((row) => {
                  const band = progressBand(row);
                  const done = row.completed + row.verified;
                  return (
                    <li key={row.submissionId} className="px-4 py-3 flex flex-wrap items-center gap-3">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: PROGRESS_BAND_COLORS[band] }}
                        title={PROGRESS_BAND_LABELS[band]}
                        aria-hidden="true"
                      />
                      <Link to={`/assessment/${row.assessmentId}`} className="min-w-0 flex-1 group">
                        <p className="font-medium text-gray-900 dark:text-white truncate group-hover:text-fire-600">
                          {row.address}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {done}/{row.recommendationsTotal} done
                          {row.verified > 0 && ` · ${row.verified} verified`}
                          {row.completed > 0 && ` · ${row.completed} to verify`}
                          {row.parcelId && ` · Parcel ${row.parcelId}`}
                          {' · '}submitted {new Date(row.submittedAt).toLocaleDateString()}
                        </p>
                        {row.immediateOutstanding > 0 && (
                          <p className="text-sm text-red-700 dark:text-red-300 inline-flex items-center gap-1">
                            <ExclamationTriangleIcon className="w-4 h-4" aria-hidden="true" />
                            {row.immediateOutstanding} immediate outstanding
                          </p>
                        )}
                      </Link>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[row.submissionStatus]}`}>
                        {STATUS_LABELS[row.submissionStatus]}
                      </span>
                      {canAct && (
                        <div className="flex gap-2 print:hidden">
                          {NEXT_ACTIONS[row.submissionStatus].map((a) => (
                            <button
                              key={a.to}
                              type="button"
                              disabled={busyId === row.submissionId || !isOnline}
                              onClick={() => void changeStatus(row, a.to)}
                              className="btn-outline text-xs px-2 py-1 disabled:opacity-50"
                            >
                              {a.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ExportButton({
  disabled,
  onClick,
  title,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      className="btn-outline text-sm inline-flex items-center gap-1 disabled:opacity-50"
    >
      <ArrowDownTrayIcon className="w-4 h-4" aria-hidden="true" />
      {children}
    </button>
  );
}

function Tile({
  label,
  value,
  sub,
  alert = false,
}: {
  label: string;
  value: number | string;
  sub: string;
  alert?: boolean;
}) {
  return (
    <div className="card p-4">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p
        className={`text-2xl font-semibold ${
          alert ? 'text-red-700 dark:text-red-300' : 'text-gray-900 dark:text-white'
        }`}
      >
        {value}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{sub}</p>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`text-xs px-3 py-1 rounded-full border transition-colors ${
        active
          ? 'bg-fire-600 text-white border-transparent'
          : 'border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800'
      }`}
    >
      {children}
    </button>
  );
}
