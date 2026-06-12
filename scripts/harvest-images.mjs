// Harvest commercially-usable (CC0 / Public Domain / CC BY) unlabeled photos
// of residential-WUI hazard scenes into a local directory for SAM-assisted
// labeling.
//
//   node scripts/harvest-images.mjs [--out training-data/harvest] [--per-keyword 25]
//
// Sources (per the June 2026 licensing research):
//   - Wikimedia Commons API: per-image machine-readable license metadata,
//     no API key, generous limits.
//   - Openverse API: aggregates Flickr/Commons/etc with a server-side
//     license filter (cc0, pdm, by). Anonymous access is rate-limited, so
//     failures here are tolerated.
//
// License policy: ONLY CC0, Public Domain, and plain CC BY are accepted —
// no NC (non-commercial), ND (no derivatives: labeling creates derivatives),
// or SA (copyleft risk for a commercial model). Attribution is recorded per
// image in manifest.jsonl as CC BY requires.
//
// NOTE: CC covers copyright only. Before training, triage the pool manually
// and drop images with identifiable people, license plates, or house numbers.

import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  appendFileSync,
} from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const UA = 'wildfire-risk-assessment-dataset-builder/1.0 (training-data collection; contact: dev team)';

const argv = process.argv;
const outDir = resolve(
  ROOT,
  argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : 'training-data/harvest'
);
const PER_KEYWORD = argv.includes('--per-keyword')
  ? parseInt(argv[argv.indexOf('--per-keyword') + 1], 10)
  : 25;

// Openverse OAuth2 credentials (optional). Authenticated requests get much
// higher rate limits than anonymous — the anonymous tier is what got
// 403/429-throttled in earlier runs. Read from the environment first, then
// from an untracked .env.local / .env so the secret never lives in the repo.
function readCreds() {
  let id = process.env.OPENVERSE_CLIENT_ID;
  let secret = process.env.OPENVERSE_CLIENT_SECRET;
  for (const name of ['.env.local', '.env']) {
    if (id && secret) break;
    const p = join(ROOT, name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*(OPENVERSE_CLIENT_ID|OPENVERSE_CLIENT_SECRET)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const val = m[2].replace(/^['"]|['"]$/g, '');
      if (m[1] === 'OPENVERSE_CLIENT_ID') id ||= val;
      else secret ||= val;
    }
  }
  return { id, secret };
}

// Exchange client credentials for a bearer token (valid ~12h). Returns null on
// any failure so harvesting degrades gracefully to the anonymous tier.
async function getOpenverseToken() {
  const { id, secret } = readCreds();
  if (!id || !secret) return null;
  try {
    const res = await fetch('https://api.openverse.org/v1/auth_tokens/token/', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': UA },
      body: new URLSearchParams({
        client_id: id,
        client_secret: secret,
        grant_type: 'client_credentials',
      }),
    });
    if (!res.ok) {
      console.warn(`  Openverse token request failed (HTTP ${res.status}) — using anonymous tier`);
      return null;
    }
    return (await res.json()).access_token ?? null;
  } catch (err) {
    console.warn(`  Openverse token request errored (${err.message}) — using anonymous tier`);
    return null;
  }
}

// Keyword battery, mapped to the hazard classes each is meant to feed.
const SEARCHES = [
  // dry / dead vegetation + ground fuels
  { q: 'dry grass house', cls: 'dry-dead-vegetation' },
  { q: 'dead grass lawn drought', cls: 'dry-dead-vegetation' },
  { q: 'dead shrubs garden', cls: 'dry-dead-vegetation' },
  { q: 'leaf litter yard', cls: 'ground-fuels' },
  { q: 'pine needles ground forest floor', cls: 'ground-fuels' },
  { q: 'brush pile', cls: 'ground-fuels' },
  // vegetation vs structures
  { q: 'tree overhanging roof', cls: 'overhanging-vegetation' },
  { q: 'branches over house roof', cls: 'overhanging-vegetation' },
  { q: 'overgrown garden house', cls: 'vegetation-near-structure' },
  { q: 'shrubs against house wall', cls: 'vegetation-near-structure' },
  // woodpiles / lumber
  { q: 'firewood stack', cls: 'woodpile-lumber' },
  { q: 'woodpile house', cls: 'woodpile-lumber' },
  { q: 'stacked lumber backyard', cls: 'woodpile-lumber' },
  // propane tanks
  { q: 'propane tank house', cls: 'propane-tank' },
  { q: 'LPG gas tank garden', cls: 'propane-tank' },
  // roofs + gutters
  { q: 'wood shake roof', cls: 'wood-shake-roof' },
  { q: 'cedar shingle roof house', cls: 'wood-shake-roof' },
  { q: 'leaves on roof', cls: 'roof-debris' },
  { q: 'clogged rain gutter leaves', cls: 'gutter-debris' },
  { q: 'gutter cleaning leaves', cls: 'gutter-debris' },
  // general defensible-space / WUI scenes
  { q: 'defensible space wildfire', cls: 'general-wui' },
  { q: 'wildfire mitigation home', cls: 'general-wui' },
  { q: 'wildland urban interface house', cls: 'general-wui' },
  // top-up keywords for under-represented classes
  { q: 'rain gutter debris', cls: 'gutter-debris' },
  { q: 'blocked gutter moss', cls: 'gutter-debris' },
  { q: 'gutter autumn leaves house', cls: 'gutter-debris' },
  { q: 'propane cylinder outdoor', cls: 'propane-tank' },
  { q: 'gas bottle house wall', cls: 'propane-tank' },
  { q: 'residential propane tank yard', cls: 'propane-tank' },
  // combustible fence (structure-to-structure ignition path)
  { q: 'wooden fence house', cls: 'combustible-fence' },
  { q: 'wood privacy fence backyard', cls: 'combustible-fence' },
  { q: 'vinyl fence yard', cls: 'combustible-fence' },
  { q: 'wood fence attached house', cls: 'combustible-fence' },
  // combustible mulch in the 0-5 ft zone
  { q: 'bark mulch garden bed', cls: 'combustible-mulch' },
  { q: 'wood chip mulch landscaping', cls: 'combustible-mulch' },
  { q: 'mulch around house foundation', cls: 'combustible-mulch' },
  { q: 'landscaping mulch flower bed', cls: 'combustible-mulch' },
  // Generic residential scenes — multi-instance context images. Each typically
  // contains several hazard classes at once (fence + mulch + vegetation + roof),
  // which is ideal for instance segmentation. Tagged 'residential-context' =
  // "label whatever hazards appear." Expect a higher triage drop rate.
  { q: 'suburban house backyard', cls: 'residential-context' },
  { q: 'residential front yard landscaping', cls: 'residential-context' },
  { q: 'house exterior yard', cls: 'residential-context' },
  { q: 'home garden backyard', cls: 'residential-context' },
  { q: 'single family home exterior', cls: 'residential-context' },
  { q: 'residential property yard', cls: 'residential-context' },
  { q: 'house side yard garden', cls: 'residential-context' },
  { q: 'backyard patio landscaping', cls: 'residential-context' },
];

// Accept: CC0, public domain marks, plain CC BY. Reject NC / ND / SA.
function licenseAccepted(shortName) {
  const s = (shortName ?? '').toLowerCase();
  if (/(nc|nd|sa)\b|non-?commercial|no\s*deriv/.test(s)) return false;
  return /^cc0\b|^cc[- ]by\b|public domain|^pdm\b|^attribution\b|no restrictions/.test(s);
}

function stripHtml(html) {
  return (html ?? '').replace(/<[^>]*>/g, '').trim();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url, extraHeaders = {}) {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, accept: 'application/json', ...extraHeaders },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

// --- providers ---------------------------------------------------------------

async function searchCommons(query, limit) {
  const url =
    'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*' +
    `&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=${limit}` +
    '&prop=imageinfo&iiprop=url|extmetadata|mime&iiurlwidth=1280';
  const data = await fetchJson(url);
  const pages = Object.values(data?.query?.pages ?? {});
  const results = [];
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    const meta = info?.extmetadata ?? {};
    if (!info || !/^image\/(jpeg|png)$/.test(info.mime ?? '')) continue;
    const license = meta.LicenseShortName?.value ?? '';
    if (!licenseAccepted(license)) continue;
    results.push({
      source: 'wikimedia-commons',
      id: `commons-${page.pageid}`,
      title: page.title,
      license,
      attribution: stripHtml(meta.Artist?.value),
      landingUrl: info.descriptionurl,
      imageUrl: info.thumburl ?? info.url, // 1280px thumb keeps sizes sane
      ext: (info.mime ?? '').includes('png') ? 'png' : 'jpg',
    });
  }
  return results;
}

async function searchOpenverse(query, limit, token = null) {
  // Anonymous page_size is effectively capped low and throttled; an
  // authenticated token allows larger pages and far higher request rates.
  const pageSize = token ? Math.min(limit, 100) : Math.min(limit, 20);
  const url =
    'https://api.openverse.org/v1/images/' +
    `?q=${encodeURIComponent(query)}&license=cc0,pdm,by&page_size=${pageSize}`;
  const data = await fetchJson(url, token ? { authorization: `Bearer ${token}` } : {});
  return (data?.results ?? [])
    .filter((r) => r.url && /(jpe?g|png)(\?|$)/i.test(r.url))
    .map((r) => ({
      source: `openverse:${r.source ?? 'unknown'}`,
      id: `openverse-${r.id}`,
      title: r.title ?? '',
      license: `${(r.license ?? '').toUpperCase()} ${r.license_version ?? ''}`.trim(),
      attribution: r.attribution ?? '',
      landingUrl: r.foreign_landing_url ?? '',
      imageUrl: r.url,
      ext: /png(\?|$)/i.test(r.url) ? 'png' : 'jpg',
    }));
}

// --- harvest -----------------------------------------------------------------

mkdirSync(join(outDir, 'images'), { recursive: true });
const manifestPath = join(outDir, 'manifest.jsonl');

// "Seen" = anything already harvested OR already triaged-out. Built from the
// manifest (authoritative) plus the images/ and dropped/ dirs. Without the
// manifest + dropped/ sources, a re-run re-downloads images that triage moved
// to dropped/ and appends duplicate manifest lines.
const stem = (f) => f.replace(/\.[a-z]+$/, '');
const existing = new Set([
  ...readdirSync(join(outDir, 'images')).map(stem),
  ...(existsSync(join(outDir, 'dropped'))
    ? readdirSync(join(outDir, 'dropped')).map(stem)
    : []),
]);
if (existsSync(manifestPath)) {
  for (const line of readFileSync(manifestPath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      existing.add(JSON.parse(line).id);
    } catch {
      // skip malformed line
    }
  }
} else {
  writeFileSync(manifestPath, '');
}

const openverseToken = await getOpenverseToken();
console.log(
  openverseToken
    ? 'Openverse: authenticated (higher rate limits)'
    : 'Openverse: anonymous tier (set OPENVERSE_CLIENT_ID/SECRET for higher limits)'
);
// Client-credentials tokens take a moment to propagate; a search fired
// immediately after issuance can 401. Give it a beat before the first use.
if (openverseToken) await sleep(3000);

// Soft-disable Openverse only after several consecutive failures, and retry a
// transient failure once — so one propagation 401 or blip doesn't drop the
// whole run back to the (archival-heavy) Commons-only tier.
let openverseFails = 0;
let downloaded = 0;
let skipped = 0;
let rejected = 0;
const perClass = {};

for (const { q, cls } of SEARCHES) {
  const candidates = [];
  try {
    candidates.push(...(await searchCommons(q, PER_KEYWORD * 2)));
  } catch (err) {
    console.warn(`  commons search failed for "${q}": ${err.message}`);
  }
  if (openverseFails < 3) {
    try {
      candidates.push(...(await searchOpenverse(q, PER_KEYWORD, openverseToken)));
      openverseFails = 0;
    } catch (err) {
      // Retry once after a pause (covers token propagation / transient 429).
      try {
        await sleep(3000);
        candidates.push(...(await searchOpenverse(q, PER_KEYWORD, openverseToken)));
        openverseFails = 0;
      } catch (err2) {
        openverseFails++;
        console.warn(`  openverse search failed for "${q}" (${err2.message})`);
        if (openverseFails >= 3) {
          console.warn('  openverse disabled after 3 consecutive failures — Commons only');
        }
      }
    }
  }

  let kept = 0;
  for (const c of candidates) {
    if (kept >= PER_KEYWORD) break;
    if (existing.has(c.id)) {
      skipped++;
      continue;
    }
    try {
      let res = await fetch(c.imageUrl, { headers: { 'user-agent': UA } });
      if (res.status === 429) {
        // Throttled by the image CDN — back off once, then retry.
        await sleep(8000);
        res = await fetch(c.imageUrl, { headers: { 'user-agent': UA } });
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 10_000) {
        rejected++; // tiny thumbnails are useless for segmentation
        continue;
      }
      writeFileSync(join(outDir, 'images', `${c.id}.${c.ext}`), buf);
      appendFileSync(
        manifestPath,
        JSON.stringify({
          id: c.id,
          file: `images/${c.id}.${c.ext}`,
          keyword: q,
          targetClass: cls,
          source: c.source,
          license: c.license,
          attribution: c.attribution,
          landingUrl: c.landingUrl,
          harvestedAt: new Date().toISOString(),
        }) + '\n'
      );
      existing.add(c.id);
      downloaded++;
      kept++;
      perClass[cls] = (perClass[cls] ?? 0) + 1;
    } catch (err) {
      rejected++;
      console.warn(`  download failed (${c.id}): ${err.message}`);
    }
    await sleep(500); // be polite — Commons' CDN 429s aggressive download bursts
  }
  console.log(`"${q}" -> ${kept} new image(s)`);
  await sleep(400);
}

console.log(`\ndownloaded ${downloaded}, skipped ${skipped} already-present, rejected ${rejected}`);
console.log('new images per target class:');
for (const [cls, n] of Object.entries(perClass)) console.log(`  ${cls.padEnd(28)} ${n}`);
console.log(`\nPool written to ${outDir}`);
console.log('Triage before labeling: drop images with identifiable people/plates/house numbers.');
