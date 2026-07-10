# WUI-MF — Wildland Urban Interface Mitigation Framework

A mobile-first Progressive Web App for assessing wildfire risk on a property.
Built to work **offline in the field** and sync back to Supabase when a
connection returns.

- **Stack:** Vite · React 18 · TypeScript
- **Mapping:** Mapbox GL
- **On-device CV:** TensorFlow.js
- **AR viewer:** Three.js / WebXR
- **Offline store:** Dexie (IndexedDB) with a sync queue
- **Backend:** Supabase (auth, Postgres + RLS, Storage)

## Getting started

```bash
npm install
cp .env.example .env   # then fill in the values below
npm run dev            # Vite dev server
```

### Environment variables

| Variable                 | Purpose                          |
| ------------------------ | -------------------------------- |
| `VITE_SUPABASE_URL`      | Supabase project URL             |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key         |
| `VITE_MAPBOX_TOKEN`      | Mapbox GL access token           |

`supabaseClient.ts` falls back to placeholder values if the Supabase vars are
missing, so the app boots for local UI work — but Supabase calls will fail. The
map shows a configuration prompt if `VITE_MAPBOX_TOKEN` is unset.

## Commands

```bash
npm run dev        # Vite dev server
npm run build      # tsc (typecheck) then vite build
npm run preview    # serve the production build
npm run lint       # eslint (max-warnings 0)
npm run test       # vitest
npm run test:e2e   # playwright

npm run export:training   # pull training-consented photos into a YOLO dataset
npm run label:prepare     # build a SAM-assisted labeling bundle
npm run import:photos     # import local photos
```

Run a single test file: `npm run test -- path/to/file.test.ts`.
Run a single test by name: `npm run test -- -t "test name"`.

## Architecture

- `src/app/` — root `App.tsx` (router + provider tree) and `providers/`
  (auth, offline, theme).
- `src/features/<feature>/` — feature modules, each owning its `components/`,
  `hooks/`, and sometimes `services/`. Lazy-loaded from `App.tsx` for code
  splitting.
- `src/shared/` — cross-feature `components/`, `services/` (Supabase client,
  Dexie offline storage), `stores/` (Zustand), and `types/`.

Path aliases: `@/*` → `src/*`, plus `@features/*`, `@shared/*`, `@lib/*`.

**Offline-first:** Dexie is the source of truth while offline. Writes go through
`saveXLocally()` / `updateXLocally()` helpers that update Dexie and enqueue a
sync operation; `OfflineProvider` flushes the queue when the network returns.
Photos are stored as Blobs locally and uploaded to Supabase Storage on sync.

## Risk scoring

An assessment is scored across **six categories**, each on a **0–10** integer
scale, from a weighted Yes/No inspection checklist in the assessment wizard
(`ChecklistStep.tsx`).

> **Higher score = safer.** The scale measures preparedness/mitigation, so a
> high score means *lower* wildfire risk.

### Category score

Every checklist item belongs to one category and carries an integer `weight`.
For each category, `calculateScores()` computes:

```
categoryScore = round( (Σ weight of items answered "Yes") / (Σ weight of ALL items in the category) × 10 )
```

Key details:

- Only a **"Yes"** earns that item's weight. A **"No"** *and an unanswered
  item* both contribute 0 — the denominator always includes every item in the
  category, so skipping questions lowers the score exactly like a "No".
- The result is rounded to the nearest integer in **0–10**.

There are **21 items** across the six categories, with these maximum weighted
points (the denominator per category):

| Category (checklist key)          | Items | Max weight | Highest-weighted items (weight 3) |
| --------------------------------- | ----- | ---------- | --------------------------------- |
| Defensible space (`defensible-space`) | 5 | 11 | Zone 0 cleared to bare soil/hardscape |
| Roof & structure (`roof-structure`)   | 5 | 10 | Class A fire-rated roof |
| Vegetation management (`vegetation`)  | 3 | 6  | — (all weight 2) |
| Ember intrusion (`ember-intrusion`)   | 3 | 7  | WUI-rated ember/flame-resistant vents |
| Access & evacuation (`access-evacuation`) | 3 | 5 | — (max weight 2) |
| Water supply (`water-supply`)         | 2 | 3  | — (max weight 2) |

Each checklist item also carries an optional `standard` provenance tag
(e.g. `CAL FIRE PRC 4291`, `CBC Chapter 7A`, `IBHS WFPH`) shown in the UI.

### Overall score

The **overall score** is the **unweighted average of the six category scores**,
rounded to one decimal place (`calculateOverallScore` in `AssessmentWizard.tsx`)
— note the categories themselves are *not* re-weighted against each other. It
maps to a risk level:

| Overall score | Risk level |
| ------------- | ---------- |
| ≥ 8           | Low        |
| ≥ 6           | Moderate   |
| ≥ 4           | High       |
| < 4           | Extreme    |

Risk levels drive the `risk-{low,moderate,high,extreme}` Tailwind colors and
`.risk-badge-*` classes, and color the property markers on the Risk Map
(thresholds are in `getRiskLevel`, `AssessmentDetail.tsx`).

## Risk Map data layers

The Risk Map (`src/features/maps/`) supports four toggleable layers, each backed
by a live, public, no-cost data source (only the Mapbox token is required):

| Layer               | Source                                   | Coverage | How it's consumed |
| ------------------- | ---------------------------------------- | -------- | ----------------- |
| **Fire History**    | CAL FIRE (FRAP) fire perimeters, ArcGIS FeatureServer | California | Viewport bbox query (`f=geojson`), refetched on pan/zoom → GeoJSON source |
| **Vegetation/Fuel** | LANDFIRE Scott & Burgan 40 fuel models (USGS/USFS WMS) | CONUS    | WMS `GetMap` raster tiles (EPSG:3857) |
| **Slope Analysis**  | USGS 3DEP elevation, "Slope Map" rendering rule (ArcGIS ImageServer) | CONUS (+HI/territories) | `exportImage` raster tiles (EPSG:3857) |
| **Defensible Space**| Computed per-property (0–5 / 5–30 / 30–100 ft rings per CAL FIRE PRC 4291) | Any      | Local GeoJSON buffers |

Notes:
- Fire History is **California-only** (CAL FIRE's dataset); it renders nothing
  outside CA and only fetches at zoom ≥ 7 to respect the service's 2000-record
  cap.
- The raster overlays (Vegetation, Slope) request Web Mercator tiles via
  Mapbox's `{bbox-epsg-3857}` token and sit beneath base-map labels so the
  vector overlays stay on top.
- All layer fetches are visibility-gated (no network when a layer is off) and
  fail gracefully offline, keeping whatever is already drawn.

## Auth — DEV_MODE

`src/app/providers/AuthProvider.tsx` has a top-level `DEV_MODE` flag that
bypasses Supabase auth with a mock user. Flip it to `false` to exercise the real
auth flow.

## PWA / offline caching

Configured in `vite.config.ts` via `vite-plugin-pwa` (`registerType:
'autoUpdate'`). Runtime caches: Mapbox tiles, Supabase responses, images, and
`.wasm`/`.tflite` model files. Because the service worker auto-updates, a new
deploy is picked up on the next reload.
