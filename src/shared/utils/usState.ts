import type { GeoCoordinates } from '@/shared/types';

/**
 * Offline US-state resolution for a property, used to select state-specific
 * inspection guidelines. Two strategies, GPS first:
 *
 * 1. `stateFromCoordinates` — point-in-polygon against a bundled, simplified
 *    Census state-boundary GeoJSON (~100 m precision). The JSON is lazily
 *    imported so it lands in its own chunk, and the PWA precache makes it
 *    available offline in the field.
 * 2. `stateFromAddress` — parses a USPS state code or full state name out of
 *    the free-text property address.
 */

const STATE_NAMES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
  massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS',
  missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK',
  oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI',
  wyoming: 'WY', 'district of columbia': 'DC', 'puerto rico': 'PR',
};

const STATE_CODES = new Set(Object.values(STATE_NAMES));

interface StateFeatureCollection {
  features: Array<{
    properties: { s: string };
    geometry:
      | { type: 'Polygon'; coordinates: number[][][] }
      | { type: 'MultiPolygon'; coordinates: number[][][][] };
  }>;
}

let statesPromise: Promise<StateFeatureCollection> | null = null;

function loadStateBoundaries(): Promise<StateFeatureCollection> {
  statesPromise ??= import('@/shared/data/usStates.json').then(
    (m) => m.default as unknown as StateFeatureCollection
  );
  return statesPromise;
}

// Standard ray-casting test: count edge crossings of a ray going right from
// the point; odd count = inside.
function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

// Inside the outer ring and not inside any hole ring.
function pointInPolygon(lng: number, lat: number, rings: number[][][]): boolean {
  if (rings.length === 0 || !pointInRing(lng, lat, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(lng, lat, rings[i])) return false;
  }
  return true;
}

/** USPS code of the state containing the coordinates, or null (offshore,
 * outside the US, or right on a simplified boundary edge). */
export async function stateFromCoordinates(
  coords: GeoCoordinates
): Promise<string | null> {
  const { features } = await loadStateBoundaries();
  const { latitude: lat, longitude: lng } = coords;
  for (const feature of features) {
    const { geometry } = feature;
    const polygons =
      geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
    for (const rings of polygons) {
      if (pointInPolygon(lng, lat, rings)) return feature.properties.s;
    }
  }
  return null;
}

/** USPS code parsed from a free-text address ("123 Main St, Sacramento, CA
 * 95814" or "..., California"), or null if none found. */
export function stateFromAddress(address: string | undefined): string | null {
  if (!address) return null;

  // Two-letter code as its own token, optionally followed by a ZIP:
  // ", CA 95814", ", CA", "CA 95814-0001".
  const codeMatch = address.match(/(?:^|[\s,])([A-Za-z]{2})(?:[\s,]+\d{5}(?:-\d{4})?)?\s*\.?\s*$/);
  if (codeMatch) {
    const code = codeMatch[1].toUpperCase();
    if (STATE_CODES.has(code)) return code;
  }

  // Full state name anywhere near the end of the string. Match longest names
  // first so "West Virginia" wins over "Virginia".
  const lower = address.toLowerCase();
  let best: { code: string; index: number; length: number } | null = null;
  for (const [name, code] of Object.entries(STATE_NAMES)) {
    const index = lower.lastIndexOf(name);
    if (index === -1) continue;
    // Require word boundaries around the match.
    const before = lower[index - 1];
    const after = lower[index + name.length];
    if ((before && /[a-z]/.test(before)) || (after && /[a-z]/.test(after))) continue;
    // Prefer the match ending furthest right; on ties the longer name wins
    // ("West Virginia" over the "Virginia" inside it).
    const end = index + name.length;
    const bestEnd = best ? best.index + best.length : -1;
    if (!best || end > bestEnd || (end === bestEnd && name.length > best.length)) {
      best = { code, index, length: name.length };
    }
  }
  return best?.code ?? null;
}

/** Resolve the property's US state: GPS point-in-polygon first (the phone is
 * at the property during an inspection), then the typed address. */
export async function resolveUsState(property: {
  address?: string;
  coordinates?: GeoCoordinates;
}): Promise<string | null> {
  if (property.coordinates) {
    try {
      const fromGps = await stateFromCoordinates(property.coordinates);
      if (fromGps) return fromGps;
    } catch {
      // Boundary chunk failed to load (first visit while offline) — fall
      // through to the address.
    }
  }
  return stateFromAddress(property.address);
}
