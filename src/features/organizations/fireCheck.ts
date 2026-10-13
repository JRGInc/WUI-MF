// Fire-perimeter check for the agency dashboard (WFCA C5-2 KSA-7): which
// submitted properties a current-year wildfire reached or came near. Queries
// NIFC's WFIGS Interagency Perimeters (year to date) — anonymous, CORS-open,
// with a fire discovery date — one property at a time. Prescribed burns (RX)
// are excluded. Network and parsing only; recording is record_fire_exposure().

export const WFIGS_YTD_QUERY_URL =
  'https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters_YearToDate/FeatureServer/0/query';
export const FIRE_SOURCE = 'wfigs_ytd';
/** A property within this distance of a perimeter counts as 'near'. */
export const NEAR_DISTANCE_M = 1000;
const DEFAULT_CONCURRENCY = 4;

export interface FireIncident {
  incidentId: string;
  incidentName: string;
  discoveredAt?: string;
  acres?: number;
}

export interface FireHit {
  assessmentId: string;
  relation: 'inside' | 'near';
  fire: FireIncident;
}

export interface PropertyPoint {
  assessmentId: string;
  latitude: number;
  longitude: number;
}

/** Query URL for wildfire perimeters containing the point (or within `distanceM` of it). */
export function wfigsQueryUrl(point: { latitude: number; longitude: number }, distanceM?: number): string {
  const params = new URLSearchParams({
    geometry: JSON.stringify({ x: point.longitude, y: point.latitude }),
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    where: "attr_IncidentTypeCategory = 'WF'",
    outFields:
      'OBJECTID,poly_IncidentName,poly_IRWINID,attr_UniqueFireIdentifier,attr_FireDiscoveryDateTime,poly_GISAcres',
    returnGeometry: 'false',
    f: 'json',
  });
  if (distanceM !== undefined) {
    params.set('distance', String(distanceM));
    params.set('units', 'esriSRUnit_Meter');
  }
  return `${WFIGS_YTD_QUERY_URL}?${params}`;
}

/** Parse an ArcGIS query response into incidents. Throws on an ArcGIS error body. */
export function parseWfigs(json: unknown): FireIncident[] {
  const body = json as { error?: { message?: string }; features?: { attributes?: Record<string, unknown> }[] };
  if (body?.error) throw new Error(`WFIGS query failed: ${body.error.message ?? 'unknown error'}`);
  return (body?.features ?? []).flatMap(({ attributes: a }) => {
    if (!a) return [];
    const id =
      (typeof a.poly_IRWINID === 'string' && a.poly_IRWINID.trim()) ||
      (typeof a.attr_UniqueFireIdentifier === 'string' && a.attr_UniqueFireIdentifier.trim()) ||
      (a.OBJECTID !== undefined && a.OBJECTID !== null ? `wfigs:${a.OBJECTID}` : '');
    if (!id) return [];
    const discovered = typeof a.attr_FireDiscoveryDateTime === 'number' ? a.attr_FireDiscoveryDateTime : undefined;
    const acres = typeof a.poly_GISAcres === 'number' ? Math.round(a.poly_GISAcres) : undefined;
    return [
      {
        incidentId: id,
        incidentName: (typeof a.poly_IncidentName === 'string' && a.poly_IncidentName.trim()) || 'Unnamed fire',
        discoveredAt: discovered !== undefined ? new Date(discovered).toISOString() : undefined,
        acres,
      },
    ];
  });
}

type Fetch = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

async function query(fetchImpl: Fetch, url: string, signal?: AbortSignal): Promise<FireIncident[]> {
  const res = await fetchImpl(url, { signal });
  if (!res.ok) throw new Error(`WFIGS query failed: HTTP ${res.status}`);
  return parseWfigs(await res.json());
}

/** Fires near one property: a 1 km query first, and an exact one only if that found anything. */
export async function checkProperty(
  point: PropertyPoint,
  fetchImpl: Fetch,
  signal?: AbortSignal
): Promise<FireHit[]> {
  const near = await query(fetchImpl, wfigsQueryUrl(point, NEAR_DISTANCE_M), signal);
  if (near.length === 0) return [];
  const inside = new Set((await query(fetchImpl, wfigsQueryUrl(point), signal)).map((f) => f.incidentId));
  return near.map((fire) => ({
    assessmentId: point.assessmentId,
    relation: inside.has(fire.incidentId) ? 'inside' : 'near',
    fire,
  }));
}

export interface FireCheckResult {
  hits: FireHit[];
  /** Properties whose queries failed (network/service errors). */
  failed: string[];
}

/** Check every property, a few at a time. A failure for one property doesn't stop the rest. */
export async function checkPropertiesForFires(
  points: PropertyPoint[],
  options: {
    fetchImpl?: Fetch;
    concurrency?: number;
    signal?: AbortSignal;
    onProgress?: (done: number, total: number) => void;
  } = {}
): Promise<FireCheckResult> {
  const fetchImpl = options.fetchImpl ?? ((url, init) => fetch(url, init));
  const concurrency = Math.max(1, options.concurrency ?? DEFAULT_CONCURRENCY);
  const hits: FireHit[] = [];
  const failed: string[] = [];
  let next = 0;
  let done = 0;

  async function worker() {
    while (next < points.length) {
      if (options.signal?.aborted) return;
      const point = points[next++];
      try {
        hits.push(...(await checkProperty(point, fetchImpl, options.signal)));
      } catch {
        failed.push(point.assessmentId);
      }
      options.onProgress?.(++done, points.length);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, points.length) }, worker));
  return { hits, failed };
}
