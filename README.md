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
| **Fire History**    | CAL FIRE (FRAP) in CA + NIFC InterAgencyFirePerimeterHistory nationally, ArcGIS FeatureServers | US | Viewport bbox query (`f=geojson`), refetched on pan/zoom → GeoJSON source |
| **Vegetation/Fuel** | LANDFIRE Scott & Burgan 40 fuel models (USGS/USFS WMS) | CONUS    | WMS `GetMap` raster tiles (EPSG:3857) |
| **Slope Analysis**  | USGS 3DEP elevation, "Slope Map" rendering rule (ArcGIS ImageServer) | CONUS (+HI/territories) | `exportImage` raster tiles (EPSG:3857) |
| **Defensible Space**| Building footprint buffered 5 / 30 / 100 ft (per CAL FIRE PRC 4291); circle fallback | US | `@turf/buffer` over the Mapbox building footprint → GeoJSON |

Notes:
- **Fire History is hybrid**: the source is chosen per viewport — CAL FIRE
  (FRAP) when the whole view sits inside California (most CA-current data),
  otherwise NIFC's national history. NIFC already includes CalFire data, so a
  border-straddling view still shows CA fires (from NIFC) with no duplicate
  perimeters. Both are bbox-limited and only fetch at zoom ≥ 7 (2000-record
  cap). Field mapping differs per source (`FIRE_NAME`/`YEAR_` vs
  `INCIDENT`/`FIRE_YEAR_INT`), normalized to `name`/`year`/`acres`.
- The raster overlays (Vegetation, Slope) request Web Mercator tiles via
  Mapbox's `{bbox-epsg-3857}` token and sit beneath base-map labels so the
  vector overlays stay on top.
- All layer fetches are visibility-gated (no network when a layer is off) and
  fail gracefully offline, keeping whatever is already drawn.
- **Defensible Space** is drawn around a *focused* property — tap a property
  marker, use the Locate button, select a property (below), or open the map
  from an assessment. When the layer is on but nothing is focused yet, it falls
  back to the user's GPS location (or map center if location is denied), so
  toggling it always shows something. Circles draw instantly, then — once the
  map settles at zoom 17 — the zones **upgrade to the building's outline**: the
  Mapbox building footprint under the point is buffered outward 5 / 30 / 100 ft
  (`@turf/buffer`). Where no footprint exists (rural areas, low zoom, missing
  map data) the circles remain. The rings are a real 100 ft buffer, so they
  look small until you zoom in.
- **Legend**: a per-layer key (`MapLegend`) shows one card per *visible* layer,
  bottom-left — a layer's key appears only while that layer is on. The
  Vegetation key is representative (LANDFIRE FBFM40 has 40 classes).
- **Location on iOS**: WebKit only shows the geolocation prompt for a
  gesture-initiated request, so the map auto-attempt on load is silently
  ignored there. Tap the **Locate** button or the **Enable location** banner
  (mirrors the AR view's "Enable AR positioning" tap) to trigger the prompt.

### Selecting a property

The **Select a property** button (🔍 in the map control stack) opens a modal
with two ways to choose a location:

- **Search by address** — geocoded with the **Mapbox Geocoding API**
  (`geocoding/v5`), biased to the US and to the current map center (`proximity`).
- **Pick on the map** — tap to drop the point (crosshair cursor + cancel hint).

The chosen point is pinned (labeled with the resolved address) and focused —
the map flies to zoom 17 and draws its defensible-space zones — with a **Clear**
option. Geocoding reuses the existing `VITE_MAPBOX_TOKEN`; no extra config.

## Computer vision

On-device inference runs in the browser with **TensorFlow.js** on its default
backend (WebGL). Models are fetched once, then cached in IndexedDB via TF.js's
`indexeddb://` scheme so later loads are offline; the service worker
additionally caches `.wasm`/`.tflite` assets. Code lives in
`src/features/computer-vision/`.

### Two runtime pipelines

| Pipeline | Entry | Model | Input | IndexedDB cache key |
| -------- | ----- | ----- | ----- | ------------------- |
| **Still assessment photos** | `useImageAnalysis` (assessment `PhotoCaptureStep`, `ImageAnalyzer`) | DeepLab v3 **ADE20K** semantic segmentation | 513² | `indexeddb://deeplab-ade20k-q2` |
| **Live AR scan** | `useLiveFrameAnalysis` → `useFrameAnalysisLoop` → `getActiveAnalyzer()` (`ARViewer`) | DeepLab ADE20K (default) **or** YOLO11n-seg COCO (opt-in prototype) | 513² / 512² | `…deeplab-ade20k-q2` / `indexeddb://yolo11n-seg-coco-512` |

The live loop's analyzer is selectable at runtime for A/B latency tests:
`?cvModel=yolo` in the URL, or `localStorage['cv-model'] = 'yolo'`; otherwise it
defaults to DeepLab (`frameAnalyzer.ts`).

The DeepLab path produces an ADE20K class map, which `vegetationSegmenter.ts`
turns into `DetectedRisk`s via helpers: `coverageOf`, `hasGroundFuel`,
`vegToStructureProximity`, `classBoundingBoxes`, and `risksFromClassMap`.

> **Note — legacy scaffolding, not imported anywhere:**
> `services/inferenceService.ts` (an `InferenceService` class with
> `runVegetationSegmentation` / `runRoofClassification` / `runDebrisDetection` /
> `analyzeCompleteImage`) and `hooks/useModelLoader.ts` (which selects a
> `webgpu → webgl → wasm → cpu` backend) both have no importers. The live code
> paths are the two pipelines above; treat these as reference, not the active
> API. (A future task could route the active pipelines through the WebGPU-
> preferring loader.)

### Hazard taxonomy

The label taxonomy is a single source of truth — `HAZARD_TAGS` in
`src/shared/types/index.ts` — **11 hazard classes** plus a `no-hazards-visible`
negative tag: `dry-dead-vegetation`, `ground-fuels`, `overhanging-vegetation`,
`vegetation-near-structure`, `woodpile-lumber`, `propane-tank`,
`wood-shake-roof`, `roof-debris`, `gutter-debris`, `combustible-fence`,
`combustible-mulch`. Class indices 0–8 are frozen (the last two were appended)
so already-labeled data stays valid. The training scripts parse `HAZARD_TAGS`
directly rather than duplicating the list.

### Training-data & labeling workflow

Custom (YOLO-seg) models are trained out-of-band; the scripts prepare data for
labeling and convert the result back for the browser:

1. **Gather images** into the training pool (`training-data/`):
   - `node scripts/harvest-images.mjs` — scrape commercially-usable
     (CC0 / PDM / CC BY) WUI-hazard photos from Wikimedia Commons + Openverse.
   - `npm run import:photos` — import a local folder of field photos
     (imported as triage `keep`).
   - `npm run export:training` — pull **training-consented** assessment photos
     from Supabase into a YOLO dataset layout (uses `SUPABASE_SERVICE_ROLE_KEY`
     if set, else the anon key).
2. `npm run label:prepare` — build a **SAM-assisted** labeling bundle from the
   triaged-keep pool: `classes.txt`, Ultralytics `dataset.yaml`, and a
   Label-Studio PolygonLabels config + tasks (tool-agnostic; also works with
   CVAT / Roboflow).
3. **Label** the instance masks (self-hosted CVAT + GPU SAM in this project's
   setup). `scripts/make-labeling-examples.py` generates the good-vs-loose mask
   example for the labeling guide.
4. **Train** YOLO11n-seg (Ultralytics), then
   `scripts/export-yolo-tfjs.sh` converts it to a TF.js graph model
   (PyTorch → ONNX → TF SavedModel → TF.js) for the browser. `imgsz` must match
   `INPUT_SIZE` in `yoloSegmenter.ts`, and the model is served from
   `/models/yolo11n-seg_web_model/`.

## Auth — DEV_MODE

`src/app/providers/AuthProvider.tsx` has a top-level `DEV_MODE` flag that
bypasses Supabase auth with a mock user. Flip it to `false` to exercise the real
auth flow.

## PWA / offline caching

Configured in `vite.config.ts` via `vite-plugin-pwa` (`registerType:
'autoUpdate'`). Runtime caches: Mapbox tiles, Supabase responses, images, and
`.wasm`/`.tflite` model files. Because the service worker auto-updates, a new
deploy is picked up on the next reload.
