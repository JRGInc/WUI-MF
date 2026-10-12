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

export interface ReviewQueueItem {
  submission: AssessmentSubmission;
  organizationName: string;
  address?: string;
  overallScore?: number;
  assessmentStatus?: string;
}

/** Assessments submitted to any organization the user belongs to, newest first. */
export async function fetchReviewQueue(organizationIds: string[]): Promise<ReviewQueueItem[]> {
  if (organizationIds.length === 0) return [];
  const { data, error } = await supabase
    .from('assessment_submissions')
    .select('*, organizations(name), assessments(overall_score, status, properties(address))')
    .in('organization_id', organizationIds)
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown> & {
      organizations: { name: string } | null;
      assessments: {
        overall_score: number | null;
        status: string | null;
        properties: { address: string | null } | null;
      } | null;
    };
    return {
      submission: submissionFromRow(row),
      organizationName: row.organizations?.name ?? '',
      address: row.assessments?.properties?.address ?? undefined,
      overallScore: row.assessments?.overall_score ?? undefined,
      assessmentStatus: row.assessments?.status ?? undefined,
    };
  });
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
