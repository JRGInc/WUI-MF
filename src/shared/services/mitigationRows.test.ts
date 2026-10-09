import { describe, it, expect } from 'vitest';
import type { MitigationAction } from '../types';
import { mitigationFromRow, mitigationToRow } from './mitigationRows';

const action: MitigationAction = {
  id: 'a1',
  assessmentId: 'as1',
  recommendationId: 'r1',
  category: 'roof-structure',
  priority: 'immediate',
  title: 'Clear gutters',
  status: 'in_progress',
  evidencePhotoIds: ['p1'],
  createdBy: 'u1',
  createdAt: '2026-10-09T00:00:00.000Z',
  updatedAt: '2026-10-09T00:00:00.000Z',
};

describe('mitigationToRow', () => {
  it('sends null for cleared optional fields so an upsert clears them', () => {
    const row = mitigationToRow(action);
    expect(row.completed_at).toBeNull();
    expect(row.notes).toBeNull();
    expect('completed_at' in row && 'notes' in row).toBe(true);
  });

  it('never sends verification or updated_at fields', () => {
    const row = mitigationToRow({ ...action, verifiedAt: 'x', verifiedBy: 'y' });
    expect(row).not.toHaveProperty('verified_at');
    expect(row).not.toHaveProperty('verified_by');
    expect(row).not.toHaveProperty('updated_at');
  });
});

describe('mitigationFromRow', () => {
  it('round-trips and maps nulls to undefined', () => {
    const row = {
      ...mitigationToRow(action),
      verified_at: null,
      verified_by: null,
      updated_at: action.updatedAt,
    };
    const back = mitigationFromRow(row);
    expect(back).toEqual({
      ...action,
      notes: undefined,
      completedAt: undefined,
      verifiedAt: undefined,
      verifiedBy: undefined,
    });
  });

  it('defaults a null photo list to empty', () => {
    const back = mitigationFromRow({ ...mitigationToRow(action), evidence_photo_ids: null });
    expect(back.evidencePhotoIds).toEqual([]);
  });
});
