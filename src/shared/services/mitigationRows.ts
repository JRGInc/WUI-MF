import type { MitigationAction, MitigationStatus, RiskCategory, Recommendation } from '../types';

// Explicit row mappers for mitigation_actions. Unlike the generic toRow(),
// these send null for cleared optional fields: an upsert leaves omitted columns
// untouched, so `undefined` would never clear completed_at or notes on the
// server. Pure so they can be unit-tested.

/**
 * Domain → row for client writes. verified_at / verified_by are deliberately
 * never sent: verification is third-party only and RLS rejects owner rows that
 * carry it. updated_at is set by a server trigger.
 */
export function mitigationToRow(a: MitigationAction): Record<string, unknown> {
  return {
    id: a.id,
    assessment_id: a.assessmentId,
    recommendation_id: a.recommendationId,
    category: a.category,
    priority: a.priority ?? null,
    title: a.title,
    status: a.status,
    notes: a.notes ?? null,
    evidence_photo_ids: a.evidencePhotoIds ?? [],
    completed_at: a.completedAt ?? null,
    created_by: a.createdBy ?? null,
    created_at: a.createdAt,
  };
}

/** Row → domain, mapping SQL nulls to undefined. */
export function mitigationFromRow(r: Record<string, unknown>): MitigationAction {
  const opt = <T>(v: unknown) => (v === null || v === undefined ? undefined : (v as T));
  return {
    id: r.id as string,
    assessmentId: r.assessment_id as string,
    recommendationId: r.recommendation_id as string,
    category: r.category as RiskCategory,
    priority: opt<Recommendation['priority']>(r.priority),
    title: r.title as string,
    status: r.status as MitigationStatus,
    notes: opt<string>(r.notes),
    evidencePhotoIds: (r.evidence_photo_ids as string[] | null) ?? [],
    completedAt: opt<string>(r.completed_at),
    verifiedAt: opt<string>(r.verified_at),
    verifiedBy: opt<string>(r.verified_by),
    createdBy: opt<string>(r.created_by),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}
