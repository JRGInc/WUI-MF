import { describe, it, expect } from 'vitest';
import type { AgencyDashboardRow, AgencyExportRow, FireExposure } from './organizationsService';
import {
  ACTION_COLUMNS,
  actionsCsv,
  csvCell,
  EXPOSURE_COLUMNS,
  exposuresCsv,
  PROPERTY_COLUMNS,
  propertiesCsv,
  propertiesGeoJson,
  toCsv,
} from './exports';

const row: AgencyDashboardRow = {
  submissionId: 's1',
  assessmentId: 'a1',
  submissionStatus: 'in_review',
  submittedAt: '2026-10-01T15:00:00.000Z',
  address: '12 Main St, Boise, ID',
  parcelId: 'R123',
  latitude: 43.6,
  longitude: -116.2,
  overallScore: 6,
  recommendationsTotal: 5,
  immediateTotal: 2,
  planned: 1,
  inProgress: 1,
  completed: 1,
  verified: 1,
  immediateOutstanding: 1,
};

function lines(csv: string): string[] {
  return csv.replace(/^\uFEFF/, '').trimEnd().split('\r\n');
}

describe('csvCell', () => {
  it('quotes commas, quotes and newlines (RFC 4180)', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('neutralises spreadsheet formulas in text (CSV injection)', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('-cmd')).toBe("'-cmd");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('writes numbers as numbers, including negatives, and blanks for missing values', () => {
    expect(csvCell(-116.2)).toBe('-116.2');
    expect(csvCell(0)).toBe('0');
    expect(csvCell(Number.NaN)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(null)).toBe('');
  });
});

describe('toCsv', () => {
  it('starts with a UTF-8 BOM and uses CRLF line endings', () => {
    const csv = toCsv(['a', 'b'], [[1, 'x']]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toBe('\uFEFFa,b\r\n1,x\r\n');
  });
});

describe('propertiesCsv', () => {
  it('writes one row per property with derived progress columns', () => {
    const [header, first] = lines(propertiesCsv([row]));
    expect(header).toBe(PROPERTY_COLUMNS.join(','));
    const cells = Object.fromEntries(PROPERTY_COLUMNS.map((c, i) => [c, first.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)[i]]));
    expect(cells).toMatchObject({
      address: '"12 Main St, Boise, ID"',
      longitude: '-116.2',
      review_status: 'in_review',
      submitted_on: '2026-10-01',
      progress: 'Under way',
      not_started: '1',
      done_unverified: '1',
      verified: '1',
      percent_done: '40',
    });
  });

  it('leaves the location blank when it is unusable', () => {
    const [, first] = lines(propertiesCsv([{ ...row, address: 'x', latitude: 200 }]));
    expect(first.split(',').slice(2, 4)).toEqual(['', '']);
  });
});

describe('actionsCsv', () => {
  it('writes one row per recommendation with dates trimmed to days', () => {
    const action: AgencyExportRow = {
      submissionId: 's1',
      assessmentId: 'a1',
      submissionStatus: 'in_review',
      address: '12 Main',
      recommendationId: 'r1',
      title: 'Clear gutters',
      category: 'roof-structure',
      priority: 'immediate',
      status: 'verified',
      evidencePhotos: 2,
      completedAt: '2026-10-02T10:00:00Z',
      verifiedAt: '2026-10-03T10:00:00Z',
      verifierOrganization: 'Boise FD',
      verificationNote: 'Checked on site',
    };
    const [header, first] = lines(actionsCsv([action]));
    expect(header).toBe(ACTION_COLUMNS.join(','));
    expect(first).toBe(
      '12 Main,,Clear gutters,roof-structure,immediate,verified,2026-10-02,2026-10-03,Boise FD,Checked on site,,2,in_review,a1,r1'
    );
  });
});

describe('propertiesGeoJson', () => {
  it('emits RFC 7946 points ([lng, lat]) for located properties only', () => {
    const gj = JSON.parse(
      propertiesGeoJson([row, { ...row, assessmentId: 'a2', latitude: undefined }], {
        organization: 'Boise FD',
        generatedAt: '2026-10-13T00:00:00Z',
      })
    );
    expect(gj.type).toBe('FeatureCollection');
    expect(gj.name).toBe('Boise FD mitigation progress');
    expect(gj.features).toHaveLength(1);
    expect(gj.features[0].geometry).toEqual({ type: 'Point', coordinates: [-116.2, 43.6] });
    expect(gj.features[0].properties).toMatchObject({ address: row.address, verified: 1, percent_done: 40 });
    expect(gj.features[0].properties).not.toHaveProperty('latitude');
  });
});

describe('exposuresCsv', () => {
  it('writes one row per property and fire, joined to the address', () => {
    const e: FireExposure = {
      id: 'e1',
      organizationId: 'o1',
      assessmentId: 'a1',
      incidentId: '{IRWIN}',
      incidentName: 'Big Grass',
      discoveredAt: '2026-07-23T21:30:00.000Z',
      acres: 575163,
      relation: 'inside',
      source: 'wfigs_ytd',
      recommendationsTotal: 5,
      doneAtStart: 2,
      verifiedAtStart: 1,
      immediateOutstandingAtStart: 1,
      detectedAt: '2026-10-13T12:00:00.000Z',
    };
    const [header, first] = lines(exposuresCsv([e], [row]));
    expect(header).toBe(EXPOSURE_COLUMNS.join(','));
    expect(first).toBe(
      '"12 Main St, Boise, ID",R123,Big Grass,{IRWIN},2026-07-23,575163,inside,5,2,1,1,wfigs_ytd,2026-10-13,a1'
    );
  });
});
