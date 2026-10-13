import type { AgencyDashboardRow, AgencyExportRow, FireExposure } from './organizationsService';
import { hasLocation, PROGRESS_BAND_LABELS, progressBand } from './agencyRollup';

// Pure export builders (no DOM), so they are unit-testable. Field names are
// snake_case and stable: grant templates and GIS layers will key on them.

type Cell = string | number | boolean | null | undefined;

/**
 * One CSV field (RFC 4180). Text that a spreadsheet would run as a formula
 * (leading = + - @ tab or CR) is prefixed with an apostrophe: addresses and
 * notes are user-entered, so an export must never carry a live formula
 * (CSV injection). Numbers are written as-is, so -116.2 stays a number.
 */
export function csvCell(value: Cell): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV text with a header row; CRLF line endings and a BOM so Excel reads UTF-8. */
export function toCsv(header: string[], rows: Cell[][]): string {
  const lines = [header, ...rows].map((r) => r.map(csvCell).join(','));
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

const date = (iso?: string) => (iso ? iso.slice(0, 10) : undefined);

export const PROPERTY_COLUMNS = [
  'address',
  'parcel_id',
  'latitude',
  'longitude',
  'review_status',
  'submitted_on',
  'progress',
  'recommendations',
  'not_started',
  'planned',
  'in_progress',
  'done_unverified',
  'verified',
  'percent_done',
  'immediate_outstanding',
  'overall_score',
  'assessment_id',
];

function propertyRecord(r: AgencyDashboardRow): Cell[] {
  const done = r.completed + r.verified;
  const notStarted = r.recommendationsTotal - done - r.planned - r.inProgress;
  return [
    r.address,
    r.parcelId,
    hasLocation(r) ? r.latitude : undefined,
    hasLocation(r) ? r.longitude : undefined,
    r.submissionStatus,
    date(r.submittedAt),
    PROGRESS_BAND_LABELS[progressBand(r)],
    r.recommendationsTotal,
    notStarted,
    r.planned,
    r.inProgress,
    r.completed,
    r.verified,
    r.recommendationsTotal === 0 ? 0 : Math.round((done / r.recommendationsTotal) * 100),
    r.immediateOutstanding,
    r.overallScore,
    r.assessmentId,
  ];
}

/** One row per submitted property with its mitigation progress. */
export function propertiesCsv(rows: AgencyDashboardRow[]): string {
  return toCsv(PROPERTY_COLUMNS, rows.map(propertyRecord));
}

export const ACTION_COLUMNS = [
  'address',
  'parcel_id',
  'recommendation',
  'category',
  'priority',
  'status',
  'completed_on',
  'verified_on',
  'verified_by',
  'verification_note',
  'owner_notes',
  'evidence_photos',
  'review_status',
  'assessment_id',
  'recommendation_id',
];

/** One row per recommendation (grant reporting: what was done, when, and who verified it). */
export function actionsCsv(rows: AgencyExportRow[]): string {
  return toCsv(
    ACTION_COLUMNS,
    rows.map((r) => [
      r.address,
      r.parcelId,
      r.title,
      r.category,
      r.priority,
      r.status,
      date(r.completedAt),
      date(r.verifiedAt),
      r.verifierOrganization,
      r.verificationNote,
      r.ownerNotes,
      r.evidencePhotos,
      r.submissionStatus,
      r.assessmentId,
      r.recommendationId,
    ])
  );
}

/**
 * GeoJSON (RFC 7946) points for GIS: one feature per located property, with the
 * same fields as the properties CSV. Properties without a location are omitted.
 */
export function propertiesGeoJson(
  rows: AgencyDashboardRow[],
  meta: { organization: string; generatedAt: string }
): string {
  const features = rows.filter(hasLocation).map((r) => {
    const values = propertyRecord(r);
    const properties = Object.fromEntries(
      PROPERTY_COLUMNS.map((k, i) => [k, values[i] ?? null]).filter(
        ([k]) => k !== 'latitude' && k !== 'longitude'
      )
    );
    return {
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [r.longitude as number, r.latitude as number] },
      properties,
    };
  });
  return JSON.stringify(
    {
      type: 'FeatureCollection',
      name: `${meta.organization} mitigation progress`,
      generated_at: meta.generatedAt,
      features,
    },
    null,
    2
  );
}

export const EXPOSURE_COLUMNS = [
  'address',
  'parcel_id',
  'fire',
  'incident_id',
  'discovered_on',
  'acres',
  'relation',
  'recommendations',
  'done_at_fire_start',
  'verified_at_fire_start',
  'immediate_open_at_fire_start',
  'source',
  'detected_on',
  'assessment_id',
];

/**
 * One row per (property, fire). done_at_fire_start is owner-reported;
 * verified_at_fire_start is inspector-verified (server-stamped).
 */
export function exposuresCsv(exposures: FireExposure[], rows: AgencyDashboardRow[]): string {
  const byAssessment = new Map(rows.map((r) => [r.assessmentId, r]));
  return toCsv(
    EXPOSURE_COLUMNS,
    exposures.map((e) => [
      byAssessment.get(e.assessmentId)?.address,
      byAssessment.get(e.assessmentId)?.parcelId,
      e.incidentName,
      e.incidentId,
      date(e.discoveredAt),
      e.acres,
      e.relation,
      e.recommendationsTotal,
      e.doneAtStart,
      e.verifiedAtStart,
      e.immediateOutstandingAtStart,
      e.source,
      date(e.detectedAt),
      e.assessmentId,
    ])
  );
}
