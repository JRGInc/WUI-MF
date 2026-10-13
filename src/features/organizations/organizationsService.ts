import { supabase } from '@/shared/services/supabaseClient';
import { mitigationFromRow } from '@/shared/services/mitigationRows';
import type {
  AssessmentSubmission,
  MitigationAction,
  Organization,
  OrganizationMembership,
  OrganizationRole,
} from '@/shared/types';
import { organizationFromRow, submissionFromRow, verificationErrorMessage } from './organizations';

// Online-only: organizations, memberships, submissions, and verification are
// server-authoritative (RLS + SECURITY DEFINER functions), so none of this goes
// through the offline sync queue.

export class VerificationError extends Error {}

export async function fetchOrganizations(): Promise<Organization[]> {
  const { data, error } = await supabase.from('organizations').select('id, name, kind, state_code');
  if (error) throw error;
  return (data ?? []).map((r) => organizationFromRow(r as Record<string, unknown>));
}

/** The signed-in user's memberships (RLS returns only their own rows). */
export async function fetchMyMemberships(userId: string): Promise<OrganizationMembership[]> {
  const { data, error } = await supabase
    .from('organization_members')
    .select('role, organizations(id, name, kind, state_code)')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).flatMap((r) => {
    // Many-to-one embed: PostgREST returns an object (the untyped client
    // infers an array), hence the cast through unknown.
    const org = (r as unknown as { organizations: Record<string, unknown> | null }).organizations;
    if (!org) return [];
    return [{ organization: organizationFromRow(org), role: r.role as OrganizationRole }];
  });
}

/** Submissions of one assessment visible to the caller (owner: all; member: their orgs'). */
export async function fetchSubmissions(assessmentId: string): Promise<AssessmentSubmission[]> {
  const { data, error } = await supabase
    .from('assessment_submissions')
    .select('*')
    .eq('assessment_id', assessmentId);
  if (error) throw error;
  return (data ?? []).map((r) => submissionFromRow(r as Record<string, unknown>));
}

export async function submitAssessment(
  assessmentId: string,
  organizationId: string,
  userId: string
): Promise<AssessmentSubmission> {
  const { data, error } = await supabase
    .from('assessment_submissions')
    .insert({ assessment_id: assessmentId, organization_id: organizationId, submitted_by: userId })
    .select('*')
    .single();
  if (error) throw error;
  return submissionFromRow(data as Record<string, unknown>);
}

export async function withdrawSubmission(submissionId: string): Promise<void> {
  const { error } = await supabase.from('assessment_submissions').delete().eq('id', submissionId);
  if (error) throw error;
}

export async function verifyMitigation(
  actionId: string,
  organizationId: string,
  note?: string
): Promise<MitigationAction> {
  const { data, error } = await supabase.rpc('verify_mitigation_action', {
    p_action_id: actionId,
    p_organization_id: organizationId,
    p_note: note ?? null,
  });
  if (error) throw new VerificationError(verificationErrorMessage(error));
  return mitigationFromRow(data as Record<string, unknown>);
}

export async function revokeVerification(actionId: string): Promise<MitigationAction> {
  const { data, error } = await supabase.rpc('revoke_mitigation_verification', {
    p_action_id: actionId,
  });
  if (error) throw new VerificationError(verificationErrorMessage(error));
  return mitigationFromRow(data as Record<string, unknown>);
}

export interface AgencyDashboardRow {
  submissionId: string;
  assessmentId: string;
  submissionStatus: AssessmentSubmission['status'];
  submittedAt: string;
  statusChangedAt?: string;
  address: string;
  parcelId?: string;
  latitude?: number;
  longitude?: number;
  overallScore?: number;
  assessmentCompletedAt?: string;
  recommendationsTotal: number;
  immediateTotal: number;
  planned: number;
  inProgress: number;
  /** Completed and not (yet) verified. */
  completed: number;
  verified: number;
  immediateOutstanding: number;
}

/** One row per assessment submitted to the org (RLS decides visibility). */
export async function fetchAgencyDashboard(organizationId: string): Promise<AgencyDashboardRow[]> {
  const { data, error } = await supabase.rpc('agency_dashboard', {
    p_organization_id: organizationId,
  });
  if (error) throw error;
  const num = (v: unknown) => (v === null || v === undefined ? undefined : Number(v));
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    submissionId: r.submission_id as string,
    assessmentId: r.assessment_id as string,
    submissionStatus: r.submission_status as AssessmentSubmission['status'],
    submittedAt: r.submitted_at as string,
    statusChangedAt: (r.status_changed_at as string | null) ?? undefined,
    address: r.address as string,
    parcelId: (r.parcel_id as string | null) ?? undefined,
    latitude: num(r.latitude),
    longitude: num(r.longitude),
    overallScore: num(r.overall_score),
    assessmentCompletedAt: (r.assessment_completed_at as string | null) ?? undefined,
    recommendationsTotal: Number(r.recommendations_total),
    immediateTotal: Number(r.immediate_total),
    planned: Number(r.planned),
    inProgress: Number(r.in_progress),
    completed: Number(r.completed),
    verified: Number(r.verified),
    immediateOutstanding: Number(r.immediate_outstanding),
  }));
}

export async function setSubmissionStatus(
  submissionId: string,
  status: AssessmentSubmission['status']
): Promise<AssessmentSubmission> {
  const { data, error } = await supabase.rpc('set_submission_status', {
    p_submission_id: submissionId,
    p_status: status,
  });
  if (error) throw new VerificationError(verificationErrorMessage(error));
  return submissionFromRow(data as Record<string, unknown>);
}

export interface AgencyExportRow {
  submissionId: string;
  assessmentId: string;
  submissionStatus: AssessmentSubmission['status'];
  address: string;
  parcelId?: string;
  recommendationId: string;
  title: string;
  category: string;
  priority: string;
  /** A MitigationStatus, or 'not_started' when there is no record. */
  status: string;
  ownerNotes?: string;
  evidencePhotos: number;
  completedAt?: string;
  verifiedAt?: string;
  verifierOrganization?: string;
  verificationNote?: string;
}

/** One row per current recommendation on each submitted assessment (grant reporting). */
export async function fetchAgencyExport(organizationId: string): Promise<AgencyExportRow[]> {
  const { data, error } = await supabase.rpc('agency_mitigation_export', {
    p_organization_id: organizationId,
  });
  if (error) throw error;
  const opt = (v: unknown) => (v === null || v === undefined ? undefined : String(v));
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    submissionId: r.submission_id as string,
    assessmentId: r.assessment_id as string,
    submissionStatus: r.submission_status as AssessmentSubmission['status'],
    address: r.address as string,
    parcelId: opt(r.parcel_id),
    recommendationId: r.recommendation_id as string,
    title: (r.title as string | null) ?? '',
    category: (r.category as string | null) ?? '',
    priority: (r.priority as string | null) ?? '',
    status: r.status as string,
    ownerNotes: opt(r.owner_notes),
    evidencePhotos: Number(r.evidence_photos),
    completedAt: opt(r.completed_at),
    verifiedAt: opt(r.verified_at),
    verifierOrganization: opt(r.verifier_organization),
    verificationNote: opt(r.verification_note),
  }));
}

export interface FireExposure {
  id: string;
  organizationId: string;
  assessmentId: string;
  incidentId: string;
  incidentName: string;
  discoveredAt?: string;
  acres?: number;
  relation: 'inside' | 'near';
  source: string;
  recommendationsTotal: number;
  /** Done (self-reported completion, or verified) by the fire's discovery. */
  doneAtStart: number;
  /** Verified (server-stamped) by the fire's discovery. */
  verifiedAtStart: number;
  immediateOutstandingAtStart: number;
  detectedAt: string;
}

function exposureFromRow(r: Record<string, unknown>): FireExposure {
  const opt = (v: unknown) => (v === null || v === undefined ? undefined : v);
  return {
    id: r.id as string,
    organizationId: r.organization_id as string,
    assessmentId: r.assessment_id as string,
    incidentId: r.incident_id as string,
    incidentName: r.incident_name as string,
    discoveredAt: opt(r.discovered_at) as string | undefined,
    acres: opt(r.acres) === undefined ? undefined : Number(r.acres),
    relation: r.relation as 'inside' | 'near',
    source: r.source as string,
    recommendationsTotal: Number(r.recommendations_total),
    doneAtStart: Number(r.done_at_start),
    verifiedAtStart: Number(r.verified_at_start),
    immediateOutstandingAtStart: Number(r.immediate_outstanding_at_start),
    detectedAt: r.detected_at as string,
  };
}

export async function fetchFireExposures(organizationId: string): Promise<FireExposure[]> {
  const { data, error } = await supabase
    .from('fire_exposures')
    .select('*')
    .eq('organization_id', organizationId)
    .order('discovered_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => exposureFromRow(r as Record<string, unknown>));
}

/** Record one exposure; the server computes the mitigation snapshot. */
export async function recordFireExposure(
  organizationId: string,
  hit: { assessmentId: string; relation: 'inside' | 'near'; fire: { incidentId: string; incidentName: string; discoveredAt?: string; acres?: number } },
  source: string
): Promise<FireExposure> {
  const { data, error } = await supabase.rpc('record_fire_exposure', {
    p_organization_id: organizationId,
    p_assessment_id: hit.assessmentId,
    p_incident_id: hit.fire.incidentId,
    p_incident_name: hit.fire.incidentName,
    p_discovered_at: hit.fire.discoveredAt ?? null,
    p_acres: hit.fire.acres ?? null,
    p_relation: hit.relation,
    p_source: source,
  });
  if (error) throw error;
  return exposureFromRow(data as Record<string, unknown>);
}
