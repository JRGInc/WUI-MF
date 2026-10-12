import type { AgencyDashboardRow } from './organizationsService';

// Pure agency-dashboard logic (no Supabase/Mapbox), so it is unit-testable.

/**
 * Where a property stands, for map colour and filtering:
 * - none: no recommendations, or nothing started
 * - underway: some planned / in progress / done, not all done
 * - done: every recommendation done, not all verified
 * - verified: every recommendation verified
 */
export type ProgressBand = 'none' | 'underway' | 'done' | 'verified';

export const PROGRESS_BAND_LABELS: Record<ProgressBand, string> = {
  none: 'Not started',
  underway: 'Under way',
  done: 'All done',
  verified: 'All verified',
};

/** Hex colours shared by the map circles and the legend (readable on light and dark maps). */
export const PROGRESS_BAND_COLORS: Record<ProgressBand, string> = {
  none: '#dc2626',
  underway: '#f59e0b',
  done: '#2563eb',
  verified: '#16a34a',
};

export function progressBand(row: AgencyDashboardRow): ProgressBand {
  const total = row.recommendationsTotal;
  const done = row.completed + row.verified;
  if (total === 0 || done + row.planned + row.inProgress === 0) return 'none';
  if (row.verified === total) return 'verified';
  if (done === total) return 'done';
  return 'underway';
}

export interface AgencyRollup {
  properties: number;
  byStatus: Record<AgencyDashboardRow['submissionStatus'], number>;
  byBand: Record<ProgressBand, number>;
  recommendations: number;
  /** Recommendations completed or verified. */
  mitigationsDone: number;
  mitigationsVerified: number;
  /** mitigationsDone / recommendations, 0-100 rounded; 0 when there are none. */
  percentDone: number;
  /** Done items awaiting verification (completed, not verified). */
  awaitingVerification: number;
  immediateOutstanding: number;
  /** Properties with no usable location (not on the map). */
  unmapped: number;
}

export function hasLocation(row: AgencyDashboardRow): boolean {
  return (
    row.latitude !== undefined &&
    row.longitude !== undefined &&
    Number.isFinite(row.latitude) &&
    Number.isFinite(row.longitude) &&
    Math.abs(row.latitude) <= 90 &&
    Math.abs(row.longitude) <= 180
  );
}

export function agencyRollup(rows: AgencyDashboardRow[]): AgencyRollup {
  const r: AgencyRollup = {
    properties: rows.length,
    byStatus: { submitted: 0, in_review: 0, closed: 0 },
    byBand: { none: 0, underway: 0, done: 0, verified: 0 },
    recommendations: 0,
    mitigationsDone: 0,
    mitigationsVerified: 0,
    percentDone: 0,
    awaitingVerification: 0,
    immediateOutstanding: 0,
    unmapped: 0,
  };
  for (const row of rows) {
    r.byStatus[row.submissionStatus]++;
    r.byBand[progressBand(row)]++;
    r.recommendations += row.recommendationsTotal;
    r.mitigationsDone += row.completed + row.verified;
    r.mitigationsVerified += row.verified;
    r.awaitingVerification += row.completed;
    r.immediateOutstanding += row.immediateOutstanding;
    if (!hasLocation(row)) r.unmapped++;
  }
  r.percentDone =
    r.recommendations === 0 ? 0 : Math.round((r.mitigationsDone / r.recommendations) * 100);
  return r;
}

/** GeoJSON points for the map: one per located property, carrying its band and ids. */
export function dashboardFeatures(
  rows: AgencyDashboardRow[]
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: rows.filter(hasLocation).map((row) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [row.longitude as number, row.latitude as number] },
      properties: {
        assessmentId: row.assessmentId,
        address: row.address,
        band: progressBand(row),
        done: row.completed + row.verified,
        total: row.recommendationsTotal,
      },
    })),
  };
}
