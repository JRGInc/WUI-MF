import { v5 as uuidv5 } from 'uuid';
import type {
  MitigationAction,
  MitigationStatus,
  Recommendation,
} from '@/shared/types';

// Pure mitigation-tracking logic (no Dexie/Supabase), so it is unit-testable.

// Fixed namespace for deterministic action ids. Deriving the id from
// (assessmentId, recommendationId) means two devices acting on the same
// recommendation write the same row instead of colliding on the unique
// (assessment_id, recommendation_id) constraint. Never change this value.
const MITIGATION_ID_NAMESPACE = '6f1c2b8e-4d3a-5e7f-9a0b-1c2d3e4f5a6b';

export function mitigationActionId(assessmentId: string, recommendationId: string): string {
  return uuidv5(`${assessmentId}:${recommendationId}`, MITIGATION_ID_NAMESPACE);
}

/** Statuses a property owner may set. 'verified' is third-party only. */
export const OWNER_SETTABLE_STATUSES: readonly MitigationStatus[] = [
  'planned',
  'in_progress',
  'completed',
];

export const STATUS_LABELS: Record<MitigationStatus | 'not_started', string> = {
  not_started: 'To do',
  planned: 'Planned',
  in_progress: 'In progress',
  completed: 'Done',
  verified: 'Verified',
};

/** A verified action is locked: only the verifier's side may change it. */
export function isLocked(action: MitigationAction | undefined): boolean {
  return action?.status === 'verified';
}

export class MitigationChangeError extends Error {}

interface ChangeContext {
  assessmentId: string;
  userId?: string;
  now?: string;
}

/**
 * Return the action record after an owner sets `status` on `rec`.
 * - Creates the record on first change (deterministic id).
 * - completedAt is stamped when the action first becomes completed and cleared
 *   if the owner moves it back.
 * Throws MitigationChangeError for an owner trying to verify, or to edit a
 * verified (locked) action.
 */
export function applyStatusChange(
  existing: MitigationAction | undefined,
  rec: Recommendation,
  status: MitigationStatus,
  ctx: ChangeContext
): MitigationAction {
  if (!OWNER_SETTABLE_STATUSES.includes(status)) {
    throw new MitigationChangeError('Only an inspector or agency can verify a mitigation.');
  }
  if (isLocked(existing)) {
    throw new MitigationChangeError('This mitigation has been verified and can no longer be changed.');
  }
  const now = ctx.now ?? new Date().toISOString();
  const completedAt =
    status === 'completed' ? existing?.completedAt ?? now : undefined;

  return {
    id: existing?.id ?? mitigationActionId(ctx.assessmentId, rec.id),
    assessmentId: ctx.assessmentId,
    recommendationId: rec.id,
    category: rec.category,
    priority: rec.priority,
    title: rec.title,
    status,
    notes: existing?.notes,
    evidencePhotoIds: existing?.evidencePhotoIds ?? [],
    completedAt,
    createdBy: existing?.createdBy ?? ctx.userId,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

/** Return the action with updated notes (created as 'planned' if none exists). */
export function applyNotesChange(
  existing: MitigationAction | undefined,
  rec: Recommendation,
  notes: string,
  ctx: ChangeContext
): MitigationAction {
  if (isLocked(existing)) {
    throw new MitigationChangeError('This mitigation has been verified and can no longer be changed.');
  }
  const base = existing ?? applyStatusChange(undefined, rec, 'planned', ctx);
  const trimmed = notes.trim();
  return {
    ...base,
    notes: trimmed.length > 0 ? trimmed : undefined,
    updatedAt: ctx.now ?? new Date().toISOString(),
  };
}

/** Return the action with an evidence photo attached (created as 'planned' if none exists). */
export function addEvidencePhoto(
  existing: MitigationAction | undefined,
  rec: Recommendation,
  photoId: string,
  ctx: ChangeContext
): MitigationAction {
  if (isLocked(existing)) {
    throw new MitigationChangeError('This mitigation has been verified and can no longer be changed.');
  }
  const base = existing ?? applyStatusChange(undefined, rec, 'planned', ctx);
  if (base.evidencePhotoIds.includes(photoId)) return base;
  return {
    ...base,
    evidencePhotoIds: [...base.evidencePhotoIds, photoId],
    updatedAt: ctx.now ?? new Date().toISOString(),
  };
}

export interface MitigationSummary {
  total: number;
  notStarted: number;
  planned: number;
  inProgress: number;
  completed: number; // includes verified
  verified: number;
  /** completed (incl. verified) / total, 0-100, rounded. 0 when total is 0. */
  percentDone: number;
  /** 'immediate' recommendations not yet completed or verified. */
  immediateOutstanding: number;
}

/**
 * Summarize progress over an assessment's recommendations. Actions whose
 * recommendation no longer exists on the assessment are ignored.
 */
export function summarizeMitigation(
  recommendations: Recommendation[],
  actions: MitigationAction[]
): MitigationSummary {
  const byRec = new Map(actions.map((a) => [a.recommendationId, a]));
  const s: MitigationSummary = {
    total: recommendations.length,
    notStarted: 0,
    planned: 0,
    inProgress: 0,
    completed: 0,
    verified: 0,
    percentDone: 0,
    immediateOutstanding: 0,
  };
  for (const rec of recommendations) {
    const status = byRec.get(rec.id)?.status;
    const done = status === 'completed' || status === 'verified';
    if (!status) s.notStarted++;
    else if (status === 'planned') s.planned++;
    else if (status === 'in_progress') s.inProgress++;
    if (done) s.completed++;
    if (status === 'verified') s.verified++;
    if (rec.priority === 'immediate' && !done) s.immediateOutstanding++;
  }
  s.percentDone = s.total === 0 ? 0 : Math.round((s.completed / s.total) * 100);
  return s;
}

/**
 * True when the server's copy must replace the local one regardless of local
 * edits: verification is third-party and authoritative. Either the server
 * verified it (the owner's local edit can never land — RLS locks the row), or
 * the local copy is verified and the server's is not (an inspector revoked it;
 * an owner can never produce a local verified record).
 */
export function remoteVerificationWins(
  remote: MitigationAction,
  local: MitigationAction | undefined
): boolean {
  if (!local) return true;
  return remote.status === 'verified' || local.status === 'verified';
}

/**
 * Merge remote and local action lists by id. Local wins (it holds edits the
 * sync queue has not pushed yet), except where verification decides — see
 * remoteVerificationWins.
 */
export function mergeActions(
  remote: MitigationAction[],
  local: MitigationAction[]
): MitigationAction[] {
  const remoteById = new Map(remote.map((a) => [a.id, a]));
  const merged = new Map(remote.map((a) => [a.id, a]));
  for (const a of local) {
    const r = remoteById.get(a.id);
    if (!r || !remoteVerificationWins(r, a)) merged.set(a.id, a);
  }
  return [...merged.values()];
}
