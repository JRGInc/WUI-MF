import { useState } from 'react';
import { CameraIcon, CheckBadgeIcon } from '@heroicons/react/24/outline';
import { showErrorToast, showSuccessToast } from '@/shared/stores/toastStore';
import { useOffline } from '@/app/providers/OfflineProvider';
import type { MitigationAction, OrganizationMembership, Recommendation } from '@/shared/types';
import { useOrganizations } from '@/features/organizations/hooks/useOrganizations';
import { VerificationError } from '@/features/organizations/organizationsService';
import { useMitigationActions, type StatusChoice } from '../hooks/useMitigationActions';
import {
  MitigationChangeError,
  STATUS_LABELS,
  summarizeMitigation,
} from '../mitigationProgress';

interface RecommendationTrackerProps {
  assessmentId: string;
  recommendations: Recommendation[];
  /** Shared /report/:token view or a reviewer: show progress, no owner controls. */
  readOnly?: boolean;
  /**
   * Inspector/admin reviewing a submitted assessment: offer Verify on completed
   * items and Revoke on items their organization verified. Implies readOnly.
   */
  verifyAs?: OrganizationMembership;
}

const OWNER_CHOICES: StatusChoice[] = ['not_started', 'planned', 'in_progress', 'completed'];

const PRIORITY_CLASS: Record<Recommendation['priority'], string> = {
  immediate: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
  'short-term': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
  'long-term': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
};

const STATUS_BADGE_CLASS: Record<StatusChoice, string> = {
  not_started: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  planned: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
  in_progress: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
  verified: 'bg-green-600 text-white',
};

function reportError(error: unknown) {
  if (error instanceof MitigationChangeError || error instanceof VerificationError) {
    showErrorToast('Cannot change this item', error.message);
  } else {
    console.error('Mitigation update failed:', error);
    showErrorToast('Could not save', 'Your change was not saved. Please try again.');
  }
}

/**
 * The report's Recommendations section with mitigation tracking: a progress
 * summary, then each recommendation with its status, notes, and evidence
 * photos. Implements the "track completed and planned mitigation" effect of
 * WFCA Phase 2 capability C5-2.
 */
export function RecommendationTracker({
  assessmentId,
  recommendations,
  readOnly = false,
  verifyAs,
}: RecommendationTrackerProps) {
  const { actions, actionFor, setStatus, setNotes, attachEvidence, verify, revoke } =
    useMitigationActions(assessmentId, readOnly || verifyAs !== undefined);
  const { isOnline } = useOffline();
  // Only needed to name the verifying organization; skip the fetch otherwise.
  const organizations = useOrganizations(actions.some((a) => a.verifierOrganizationId));
  const orgName = (id?: string) => organizations.find((o) => o.id === id)?.name;

  if (recommendations.length === 0) return null;

  const summary = summarizeMitigation(recommendations, actions);

  return (
    <div className="card">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white">Recommendations</h2>
        <div>
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-gray-700 dark:text-gray-300">
              {summary.completed} of {summary.total} done
              {summary.verified > 0 && `, ${summary.verified} verified`}
            </span>
            <span className="text-gray-500 dark:text-gray-400">{summary.percentDone}%</span>
          </div>
          <div
            className="mt-1 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden"
            role="progressbar"
            aria-label="Mitigation progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={summary.percentDone}
          >
            <div
              className="h-full bg-green-500 transition-all"
              style={{ width: `${summary.percentDone}%` }}
            />
          </div>
          {summary.immediateOutstanding > 0 && (
            <p className="mt-2 text-sm text-red-700 dark:text-red-300">
              {summary.immediateOutstanding} immediate{' '}
              {summary.immediateOutstanding === 1 ? 'item needs' : 'items need'} attention
            </p>
          )}
        </div>
      </div>

      <ul className="divide-y divide-gray-200 dark:divide-gray-700">
        {recommendations.map((rec) => (
          <RecommendationRow
            key={rec.id}
            rec={rec}
            action={actionFor(rec.id)}
            readOnly={readOnly || verifyAs !== undefined}
            verifierName={orgName(actionFor(rec.id)?.verifierOrganizationId)}
            review={
              verifyAs && {
                organizationId: verifyAs.organization.id,
                online: isOnline,
                onVerify: (note) =>
                  verify(rec, verifyAs.organization.id, note)
                    .then(() => showSuccessToast('Verified', rec.title))
                    .catch(reportError),
                onRevoke: () => revoke(rec).catch(reportError),
              }
            }
            onStatus={(choice) => setStatus(rec, choice).catch(reportError)}
            onNotes={(notes) => setNotes(rec, notes).catch(reportError)}
            onEvidence={(file) => attachEvidence(rec, file).catch(reportError)}
          />
        ))}
      </ul>
    </div>
  );
}

interface ReviewControls {
  organizationId: string;
  online: boolean;
  onVerify: (note: string) => Promise<void>;
  onRevoke: () => Promise<void>;
}

interface RecommendationRowProps {
  rec: Recommendation;
  action: MitigationAction | undefined;
  readOnly: boolean;
  verifierName?: string;
  review?: ReviewControls;
  onStatus: (choice: StatusChoice) => void;
  onNotes: (notes: string) => void;
  onEvidence: (file: File) => void;
}

function RecommendationRow({
  rec,
  action,
  readOnly,
  verifierName,
  review,
  onStatus,
  onNotes,
  onEvidence,
}: RecommendationRowProps) {
  const status: StatusChoice = action?.status ?? 'not_started';
  const locked = status === 'verified';
  const [notesDraft, setNotesDraft] = useState(action?.notes ?? '');
  const [showNotes, setShowNotes] = useState(false);
  const photoCount = action?.evidencePhotoIds.length ?? 0;
  const inputId = `evidence-${rec.id}`;

  return (
    <li className="px-6 py-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-gray-900 dark:text-white">{rec.title}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_CLASS[rec.priority]}`}>
              {rec.priority}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{rec.description}</p>
        </div>
        {rec.estimatedCost && (
          <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap ml-4">
            {rec.estimatedCost}
          </span>
        )}
      </div>

      {readOnly || locked ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span
            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE_CLASS[status]}`}
          >
            {locked && <CheckBadgeIcon className="w-4 h-4" aria-hidden="true" />}
            {STATUS_LABELS[status]}
          </span>
          {action?.completedAt && (
            <span className="text-gray-500 dark:text-gray-400">
              Done {new Date(action.completedAt).toLocaleDateString()}
            </span>
          )}
          {action?.verifiedAt && (
            <span className="text-gray-500 dark:text-gray-400">
              Verified {new Date(action.verifiedAt).toLocaleDateString()}
              {verifierName && ` by ${verifierName}`}
            </span>
          )}
          {photoCount > 0 && (
            <span className="text-gray-500 dark:text-gray-400">
              {photoCount} evidence {photoCount === 1 ? 'photo' : 'photos'}
            </span>
          )}
          {action?.notes && (
            <p className="w-full text-gray-600 dark:text-gray-300">{action.notes}</p>
          )}
          {action?.verificationNote && (
            <p className="w-full text-gray-600 dark:text-gray-300">
              <span className="font-medium">Inspector note:</span> {action.verificationNote}
            </p>
          )}
          {review && action && <ReviewActions action={action} review={review} />}
        </div>
      ) : (
        <>
          <div
            role="group"
            aria-label={`Progress on ${rec.title}`}
            className="grid grid-cols-4 gap-1 max-w-md"
          >
            {OWNER_CHOICES.map((choice) => {
              const active = status === choice;
              return (
                <button
                  key={choice}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onStatus(choice)}
                  className={`text-xs px-1 py-1.5 rounded-full border text-center whitespace-nowrap transition-colors ${
                    active
                      ? `${STATUS_BADGE_CLASS[choice]} border-transparent font-medium`
                      : 'border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800'
                  }`}
                >
                  {STATUS_LABELS[choice]}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label
              htmlFor={inputId}
              className="inline-flex items-center gap-1 cursor-pointer text-fire-600 hover:text-fire-700 dark:text-fire-400"
            >
              <CameraIcon className="w-4 h-4" aria-hidden="true" />
              Add photo
            </label>
            <input
              id={inputId}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onEvidence(file);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => {
                // Re-seed from the saved note on open: actions load async, so
                // the initial draft may predate them, and a stale empty draft
                // would erase the note on blur.
                if (!showNotes) setNotesDraft(action?.notes ?? '');
                setShowNotes((v) => !v);
              }}
              aria-expanded={showNotes}
              className="text-fire-600 hover:text-fire-700 dark:text-fire-400"
            >
              {action?.notes ? 'Edit note' : 'Add note'}
            </button>
            {photoCount > 0 && (
              <span className="text-gray-500 dark:text-gray-400">
                {photoCount} evidence {photoCount === 1 ? 'photo' : 'photos'}
              </span>
            )}
            {action?.completedAt && (
              <span className="text-gray-500 dark:text-gray-400">
                Done {new Date(action.completedAt).toLocaleDateString()}
              </span>
            )}
          </div>

          {!showNotes && action?.notes && (
            <p className="text-sm text-gray-600 dark:text-gray-300">{action.notes}</p>
          )}
          {showNotes && (
            <div>
              <label htmlFor={`notes-${rec.id}`} className="sr-only">
                Note for {rec.title}
              </label>
              <textarea
                id={`notes-${rec.id}`}
                className="input w-full text-sm"
                rows={2}
                placeholder="What was done, by whom, and when"
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                onBlur={() => onNotes(notesDraft)}
              />
            </div>
          )}
        </>
      )}
    </li>
  );
}

function ReviewActions({ action, review }: { action: MitigationAction; review: ReviewControls }) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const offlineHint = review.online ? undefined : 'Connect to the internet to verify';

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  if (action.status === 'verified') {
    if (action.verifierOrganizationId !== review.organizationId) return null;
    return (
      <button
        type="button"
        disabled={busy || !review.online}
        title={offlineHint}
        onClick={() => {
          if (window.confirm('Revoke this verification? The item returns to "Done" and the owner can edit it again.')) {
            void run(review.onRevoke);
          }
        }}
        className="text-sm text-gray-600 hover:text-red-700 dark:text-gray-300 disabled:opacity-50"
      >
        Revoke verification
      </button>
    );
  }

  if (action.status !== 'completed') return null;

  if (!noteOpen) {
    return (
      <button
        type="button"
        disabled={!review.online}
        title={offlineHint}
        onClick={() => setNoteOpen(true)}
        className="btn-primary text-sm inline-flex items-center gap-1 disabled:opacity-50"
      >
        <CheckBadgeIcon className="w-4 h-4" aria-hidden="true" />
        Verify
      </button>
    );
  }

  return (
    <div className="w-full space-y-2">
      <label htmlFor={`verify-note-${action.id}`} className="block text-sm text-gray-700 dark:text-gray-300">
        Verification note (optional)
      </label>
      <textarea
        id={`verify-note-${action.id}`}
        className="input w-full text-sm"
        rows={2}
        placeholder="How it was checked, e.g. on-site inspection"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || !review.online}
          title={offlineHint}
          onClick={() => void run(() => review.onVerify(note))}
          className="btn-primary text-sm disabled:opacity-50"
        >
          Confirm verification
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setNoteOpen(false);
            setNote('');
          }}
          className="btn-outline text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
