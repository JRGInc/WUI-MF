import type {
  AssessmentSubmission,
  Organization,
  OrganizationKind,
  OrganizationMembership,
  OrganizationRole,
} from '@/shared/types';

// Pure organization/role logic (no Supabase), so it is unit-testable.

/** Roles that may verify (and revoke) mitigations. 'viewer' only reads. */
export const VERIFYING_ROLES: readonly OrganizationRole[] = ['admin', 'inspector'];

export const ORGANIZATION_KIND_LABELS: Record<OrganizationKind, string> = {
  fire_agency: 'Fire agency',
  local_government: 'Local government',
  state_agency: 'State agency',
  insurer: 'Insurer',
  ngo: 'Nonprofit',
  other: 'Other',
};

export function organizationFromRow(r: Record<string, unknown>): Organization {
  return {
    id: r.id as string,
    name: r.name as string,
    kind: r.kind as OrganizationKind,
    stateCode: (r.state_code as string | null) ?? undefined,
  };
}

export function submissionFromRow(r: Record<string, unknown>): AssessmentSubmission {
  return {
    id: r.id as string,
    assessmentId: r.assessment_id as string,
    organizationId: r.organization_id as string,
    submittedBy: (r.submitted_by as string | null) ?? undefined,
    status: r.status as AssessmentSubmission['status'],
    submittedAt: r.submitted_at as string,
  };
}

/**
 * The membership the current user verifies under for an assessment: an
 * admin/inspector role in an organization the assessment was submitted to.
 * Mirrors the check in verify_mitigation_action(); the server stays the
 * authority. Prefers 'inspector' over 'admin', then the earliest submission.
 */
export function verifyingMembership(
  memberships: OrganizationMembership[],
  submissions: AssessmentSubmission[]
): OrganizationMembership | undefined {
  const submittedTo = submissions
    .slice()
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
    .map((s) => s.organizationId);
  const candidates = memberships.filter(
    (m) => VERIFYING_ROLES.includes(m.role) && submittedTo.includes(m.organization.id)
  );
  candidates.sort((a, b) => {
    if (a.role !== b.role) return a.role === 'inspector' ? -1 : 1;
    return submittedTo.indexOf(a.organization.id) - submittedTo.indexOf(b.organization.id);
  });
  return candidates[0];
}

/**
 * Organizations offered when a homeowner submits an assessment: those not
 * already submitted to, in-state first, then by name.
 */
export function submissionChoices(
  organizations: Organization[],
  submissions: AssessmentSubmission[],
  stateCode?: string
): Organization[] {
  const taken = new Set(submissions.map((s) => s.organizationId));
  return organizations
    .filter((o) => !taken.has(o.id))
    .sort((a, b) => {
      const aLocal = stateCode !== undefined && a.stateCode === stateCode;
      const bLocal = stateCode !== undefined && b.stateCode === stateCode;
      if (aLocal !== bLocal) return aLocal ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

/**
 * Map a Postgres error from the verification functions to a user-facing
 * message. The functions raise readable messages; RLS/permission errors do not.
 */
export function verificationErrorMessage(error: { code?: string; message?: string }): string {
  if (error.code === '42501' && error.message && !error.message.startsWith('permission denied')) {
    return error.message;
  }
  if (error.code === '22023' || error.code === 'P0002') return error.message ?? 'Cannot verify this item.';
  if (error.code === '28000') return 'Sign in to verify mitigations.';
  return 'Verification failed. Check your connection and try again.';
}
