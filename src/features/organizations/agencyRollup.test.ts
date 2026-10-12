import { describe, it, expect } from 'vitest';
import type { AgencyDashboardRow } from './organizationsService';
import { agencyRollup, dashboardFeatures, hasLocation, progressBand } from './agencyRollup';

function row(over: Partial<AgencyDashboardRow> = {}): AgencyDashboardRow {
  return {
    submissionId: 's1',
    assessmentId: 'a1',
    submissionStatus: 'submitted',
    submittedAt: '2026-10-01T00:00:00.000Z',
    address: '1 Test St',
    latitude: 43.6,
    longitude: -116.2,
    recommendationsTotal: 4,
    immediateTotal: 1,
    planned: 0,
    inProgress: 0,
    completed: 0,
    verified: 0,
    immediateOutstanding: 1,
    ...over,
  };
}

describe('progressBand', () => {
  it('is none with no recommendations or nothing started', () => {
    expect(progressBand(row({ recommendationsTotal: 0 }))).toBe('none');
    expect(progressBand(row())).toBe('none');
  });
  it('is underway once anything is planned, in progress or done, until all are done', () => {
    expect(progressBand(row({ planned: 1 }))).toBe('underway');
    expect(progressBand(row({ completed: 3 }))).toBe('underway');
  });
  it('is done when all are done but not all verified, verified when all verified', () => {
    expect(progressBand(row({ completed: 2, verified: 2 }))).toBe('done');
    expect(progressBand(row({ verified: 4 }))).toBe('verified');
  });
});

describe('hasLocation', () => {
  it('rejects missing, non-finite and out-of-range coordinates', () => {
    expect(hasLocation(row())).toBe(true);
    expect(hasLocation(row({ latitude: undefined }))).toBe(false);
    expect(hasLocation(row({ longitude: Number.NaN }))).toBe(false);
    expect(hasLocation(row({ latitude: 91 }))).toBe(false);
  });
});

describe('agencyRollup', () => {
  it('totals properties, statuses, bands and mitigation counts', () => {
    const r = agencyRollup([
      row({ submissionId: 's1', completed: 1, verified: 1, immediateOutstanding: 1 }),
      row({ submissionId: 's2', submissionStatus: 'in_review', verified: 4, immediateOutstanding: 0 }),
      row({ submissionId: 's3', submissionStatus: 'closed', latitude: undefined, recommendationsTotal: 0, immediateOutstanding: 0 }),
    ]);
    expect(r).toMatchObject({
      properties: 3,
      byStatus: { submitted: 1, in_review: 1, closed: 1 },
      byBand: { none: 1, underway: 1, done: 0, verified: 1 },
      recommendations: 8,
      mitigationsDone: 6,
      mitigationsVerified: 5,
      awaitingVerification: 1,
      percentDone: 75,
      immediateOutstanding: 1,
      unmapped: 1,
    });
  });
  it('reports 0% for an empty dashboard', () => {
    expect(agencyRollup([]).percentDone).toBe(0);
  });
});

describe('dashboardFeatures', () => {
  it('emits one [lng, lat] point per located property with its band', () => {
    const fc = dashboardFeatures([row({ verified: 4 }), row({ submissionId: 's2', latitude: undefined })]);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].geometry.coordinates).toEqual([-116.2, 43.6]);
    expect(fc.features[0].properties).toMatchObject({ band: 'verified', done: 4, total: 4 });
  });
});
