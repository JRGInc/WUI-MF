import { describe, it, expect } from 'vitest';
import type { MitigationAction, Recommendation } from '@/shared/types';
import {
  addEvidencePhoto,
  applyNotesChange,
  applyStatusChange,
  mergeActions,
  MitigationChangeError,
  mitigationActionId,
  remoteVerificationWins,
  summarizeMitigation,
} from './mitigationProgress';

const A = '11111111-1111-4111-8111-111111111111';
const ctx = { assessmentId: A, userId: 'user-1', now: '2026-10-09T12:00:00.000Z' };
const later = { ...ctx, now: '2026-10-10T12:00:00.000Z' };

function rec(id: string, priority: Recommendation['priority'] = 'short-term'): Recommendation {
  return { id, category: 'defensible-space', priority, title: `Rec ${id}`, description: '' };
}

describe('mitigationActionId', () => {
  it('is deterministic per (assessment, recommendation)', () => {
    expect(mitigationActionId(A, 'r1')).toBe(mitigationActionId(A, 'r1'));
    expect(mitigationActionId(A, 'r1')).not.toBe(mitigationActionId(A, 'r2'));
  });
});

describe('applyStatusChange', () => {
  it('creates a record on first change with snapshot fields', () => {
    const a = applyStatusChange(undefined, rec('r1', 'immediate'), 'planned', ctx);
    expect(a).toMatchObject({
      id: mitigationActionId(A, 'r1'),
      assessmentId: A,
      recommendationId: 'r1',
      status: 'planned',
      priority: 'immediate',
      title: 'Rec r1',
      evidencePhotoIds: [],
      createdBy: 'user-1',
      createdAt: ctx.now,
    });
    expect(a.completedAt).toBeUndefined();
  });

  it('stamps completedAt once and keeps the original on repeat', () => {
    const done = applyStatusChange(undefined, rec('r1'), 'completed', ctx);
    expect(done.completedAt).toBe(ctx.now);
    const again = applyStatusChange(done, rec('r1'), 'completed', later);
    expect(again.completedAt).toBe(ctx.now);
    expect(again.updatedAt).toBe(later.now);
  });

  it('clears completedAt when moved back from completed', () => {
    const done = applyStatusChange(undefined, rec('r1'), 'completed', ctx);
    const back = applyStatusChange(done, rec('r1'), 'in_progress', later);
    expect(back.completedAt).toBeUndefined();
    expect(back.createdAt).toBe(ctx.now);
  });

  it('refuses owner verification', () => {
    expect(() => applyStatusChange(undefined, rec('r1'), 'verified', ctx)).toThrow(
      MitigationChangeError
    );
  });

  it('refuses any change to a verified action', () => {
    const verified: MitigationAction = {
      ...applyStatusChange(undefined, rec('r1'), 'completed', ctx),
      status: 'verified',
    };
    expect(() => applyStatusChange(verified, rec('r1'), 'planned', later)).toThrow(
      MitigationChangeError
    );
    expect(() => applyNotesChange(verified, rec('r1'), 'x', later)).toThrow(
      MitigationChangeError
    );
    expect(() => addEvidencePhoto(verified, rec('r1'), 'p1', later)).toThrow(
      MitigationChangeError
    );
  });
});

describe('notes and evidence', () => {
  it('creates a planned record when adding notes first, and trims blanks away', () => {
    const a = applyNotesChange(undefined, rec('r1'), '  cleared gutters  ', ctx);
    expect(a.status).toBe('planned');
    expect(a.notes).toBe('cleared gutters');
    expect(applyNotesChange(a, rec('r1'), '   ', later).notes).toBeUndefined();
  });

  it('attaches evidence photos without duplicates', () => {
    const a = addEvidencePhoto(undefined, rec('r1'), 'p1', ctx);
    const b = addEvidencePhoto(a, rec('r1'), 'p1', later);
    const c = addEvidencePhoto(b, rec('r1'), 'p2', later);
    expect(c.evidencePhotoIds).toEqual(['p1', 'p2']);
  });
});

describe('summarizeMitigation', () => {
  it('counts statuses, percent done, and outstanding immediate items', () => {
    const recs = [rec('r1', 'immediate'), rec('r2', 'immediate'), rec('r3'), rec('r4')];
    const actions: MitigationAction[] = [
      applyStatusChange(undefined, recs[0], 'completed', ctx),
      { ...applyStatusChange(undefined, recs[2], 'completed', ctx), status: 'verified' },
      applyStatusChange(undefined, recs[3], 'in_progress', ctx),
      // Orphan: recommendation not on this assessment — ignored.
      applyStatusChange(undefined, rec('gone'), 'completed', ctx),
    ];
    expect(summarizeMitigation(recs, actions)).toEqual({
      total: 4,
      notStarted: 1,
      planned: 0,
      inProgress: 1,
      completed: 2,
      verified: 1,
      percentDone: 50,
      immediateOutstanding: 1,
    });
  });

  it('handles an assessment with no recommendations', () => {
    expect(summarizeMitigation([], []).percentDone).toBe(0);
  });
});

describe('mergeActions', () => {
  it('prefers local records over remote ones with the same id', () => {
    const remote = applyStatusChange(undefined, rec('r1'), 'planned', ctx);
    const local = applyStatusChange(remote, rec('r1'), 'completed', later);
    const other = applyStatusChange(undefined, rec('r2'), 'planned', ctx);
    const merged = mergeActions([remote, other], [local]);
    expect(merged).toHaveLength(2);
    expect(merged.find((a) => a.recommendationId === 'r1')?.status).toBe('completed');
  });

  it('lets a server verification override a stale local copy', () => {
    const local = applyStatusChange(undefined, rec('r1'), 'completed', ctx);
    const remote: MitigationAction = { ...local, status: 'verified', verifiedAt: later.now };
    expect(mergeActions([remote], [local])[0].status).toBe('verified');
  });

  it('lets a server revoke override a local verified copy', () => {
    const remote = applyStatusChange(undefined, rec('r1'), 'completed', ctx);
    const local: MitigationAction = { ...remote, status: 'verified', verifiedAt: ctx.now };
    expect(mergeActions([remote], [local])[0].status).toBe('completed');
  });
});

describe('remoteVerificationWins', () => {
  const base = applyStatusChange(undefined, rec('r1'), 'completed', ctx);
  const verified: MitigationAction = { ...base, status: 'verified' };
  it('is false when neither side is verified (local edits win)', () => {
    expect(remoteVerificationWins(base, { ...base, status: 'in_progress' })).toBe(false);
  });
  it('is true when either side is verified, or there is no local copy', () => {
    expect(remoteVerificationWins(verified, base)).toBe(true);
    expect(remoteVerificationWins(base, verified)).toBe(true);
    expect(remoteVerificationWins(base, undefined)).toBe(true);
  });
});
