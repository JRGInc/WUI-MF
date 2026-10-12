import { describe, it, expect } from 'vitest';
import type { AssessmentSubmission, Organization, OrganizationMembership } from '@/shared/types';
import {
  submissionChoices,
  verificationErrorMessage,
  verifyingMembership,
} from './organizations';

function org(id: string, name: string, stateCode?: string): Organization {
  return { id, name, kind: 'fire_agency', stateCode };
}

function sub(organizationId: string, submittedAt: string): AssessmentSubmission {
  return {
    id: `s-${organizationId}`,
    assessmentId: 'a1',
    organizationId,
    status: 'submitted',
    submittedAt,
  };
}

const boise = org('o1', 'Boise FD', 'ID');
const ada = org('o2', 'Ada County', 'ID');
const calfire = org('o3', 'CAL FIRE', 'CA');

describe('verifyingMembership', () => {
  const asInspector = (o: Organization): OrganizationMembership => ({ organization: o, role: 'inspector' });

  it('returns nothing without a submission to one of the user\'s orgs', () => {
    expect(verifyingMembership([asInspector(boise)], [sub('o2', '2026-10-01')])).toBeUndefined();
  });

  it('ignores viewer memberships', () => {
    expect(
      verifyingMembership([{ organization: boise, role: 'viewer' }], [sub('o1', '2026-10-01')])
    ).toBeUndefined();
  });

  it('prefers an inspector role over admin, then the earliest submission', () => {
    const memberships: OrganizationMembership[] = [
      { organization: boise, role: 'admin' },
      asInspector(ada),
      asInspector(calfire),
    ];
    const subs = [sub('o3', '2026-10-05'), sub('o1', '2026-10-01'), sub('o2', '2026-10-03')];
    expect(verifyingMembership(memberships, subs)?.organization.id).toBe('o2');
    expect(verifyingMembership(memberships.slice(0, 1), subs)?.role).toBe('admin');
  });
});

describe('submissionChoices', () => {
  it('drops organizations already submitted to and lists in-state first, then by name', () => {
    const choices = submissionChoices([calfire, boise, ada], [sub('o1', '2026-10-01')], 'ID');
    expect(choices.map((o) => o.id)).toEqual(['o2', 'o3']);
    expect(submissionChoices([calfire, boise, ada], [], 'CA').map((o) => o.id)).toEqual([
      'o3',
      'o2',
      'o1',
    ]);
  });

  it('sorts by name when the state is unknown', () => {
    expect(submissionChoices([calfire, boise, ada], []).map((o) => o.name)).toEqual([
      'Ada County',
      'Boise FD',
      'CAL FIRE',
    ]);
  });
});

describe('verificationErrorMessage', () => {
  it('passes through the readable messages raised by the verification functions', () => {
    expect(
      verificationErrorMessage({ code: '42501', message: 'You cannot verify mitigation on your own property' })
    ).toBe('You cannot verify mitigation on your own property');
    expect(
      verificationErrorMessage({ code: '22023', message: 'Only completed mitigations can be verified (status is planned)' })
    ).toMatch(/Only completed/);
  });

  it('hides raw permission and network errors', () => {
    expect(
      verificationErrorMessage({ code: '42501', message: 'permission denied for function verify_mitigation_action' })
    ).toMatch(/Verification failed/);
    expect(verificationErrorMessage({ message: 'Failed to fetch' })).toMatch(/Verification failed/);
  });
});
