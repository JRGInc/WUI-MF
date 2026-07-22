# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`wildfire-risk-assessment` — a PWA (Vite + React 18 + TypeScript) for assessing wildfire risk on a property. Mobile-first, designed to work offline in the field and sync back to Supabase when a connection returns. Uses Mapbox GL for mapping, TensorFlow.js for on-device computer vision, and Three.js / WebXR for an AR viewer.

## Commands

```bash
npm run dev        # Vite dev server
npm run build      # tsc (typecheck, noEmit) then vite build
npm run preview    # serve the production build
npm run lint       # eslint . --ext ts,tsx (max-warnings 0)
npm run test       # vitest (watch mode)
npm run test:e2e   # playwright
npm run export:training  # pull training-consented photos from Supabase into a YOLO dataset layout (training-data/)
npm run label:prepare    # build a SAM-assisted labeling bundle from triaged-keep images (training-data/labeling/)
```

Run a single Vitest file: `npm run test -- path/to/file.test.ts`. Run a single test: `npm run test -- -t "test name"`. Playwright single spec: `npx playwright test path/to/spec.ts`.

Required env vars (see `.env.example`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_MAPBOX_TOKEN`. `supabaseClient.ts` falls back to placeholder values if missing, so the app boots without Supabase configured — useful for local UI work but Supabase calls will fail.

## Architecture

### Layered layout

- `src/app/` — root `App.tsx` (router + provider tree) and `providers/` (auth, offline, theme contexts).
- `src/features/<feature>/` — feature modules; each owns its own `components/`, `hooks/`, and sometimes `services/` or `content/`. Features are imported only via lazy `import()` from `App.tsx` (code splitting).
- `src/shared/` — cross-feature code: `components/` (Layout, LoadingScreen, ToastContainer), `services/` (Supabase client, Dexie/offline storage), `stores/` (Zustand), `types/` (domain types in `index.ts`, generated-style Supabase types in `database.ts`).

Path aliases (configured in both `vite.config.ts` and `tsconfig.json`): `@/*` → `src/*`, `@features/*`, `@shared/*`, `@lib/*` (note: `@lib` is aliased but `src/lib/` does not currently exist).

### Routing

All routes live in `src/app/App.tsx`. Public: `/login`, `/register`, `/report/:token` (token-gated share view). Everything else is nested under a `<Layout />` route (Dashboard, AssessmentWizard at `/assessment/new` and `/assessment/:id/edit`, RiskMap, ARViewer, TrainingHub, Settings). All feature components are `lazy()`-loaded behind a `<Suspense fallback={<LoadingScreen />}>`.

### Offline-first data flow (important)

The app is built around the assumption that the user is often offline in the field. Key pieces:

- **Dexie (IndexedDB)** is the source of truth while offline. `src/shared/services/offlineStorage.ts` defines the `WildfireRiskDB` schema (properties, assessments, photos with `Blob`s, annotations, training progress, sync queue, cached ML models, cached training content).
- **Sync queue pattern**: writes go through `saveXLocally()` / `updateXLocally()` helpers, which both update Dexie and `queueSyncOperation()` an entry into `syncQueue`. Reads come straight from Dexie.
- **OfflineProvider** (`src/app/providers/OfflineProvider.tsx`) watches `navigator.onLine`, polls the queue every 5s, exposes `useOffline()` (with `syncNow`, `queueOperation`, `pendingOperations`), and auto-flushes via `syncPendingOperations()` when the app comes back online. Each operation retries up to 5 times before being marked failed (`lastError` set, kept in queue).
- **Photos** are stored locally as Blobs in Dexie, uploaded to Supabase Storage bucket `assessment-photos` on sync, then the blob is cleared to save space (`syncPhoto()` in `offlineStorage.ts`).
- **Service worker / PWA**: configured in `vite.config.ts` via `vite-plugin-pwa`. Runtime caches: Mapbox tiles (CacheFirst, 30d), Supabase (NetworkFirst, 1d), images (CacheFirst, 30d), `.wasm`/`.tflite` model files (CacheFirst, 90d). The plugin generates `sw.js`; `main.tsx` also has a manual `navigator.serviceWorker.register('/sw.js')` call.

When adding a new persisted entity: extend the Dexie schema (bump `version()` in `offlineStorage.ts`), add `saveXLocally` + `updateXLocally` helpers that queue sync ops, and add a case to `executeSyncOperation()` if the table name needs special handling.

### Auth — DEV_MODE flag

`src/app/providers/AuthProvider.tsx` has a top-level `const DEV_MODE` flag. When `true`, it bypasses Supabase auth entirely and injects a mock user/session; real Supabase auth code lives behind `if (DEV_MODE)` early-returns. It is currently `false` (real Supabase auth is active) — flip to `true` to bypass auth for local UI work, but never ship it `true`, as that auto-logs-in a mock user for every visitor.

### Computer vision

`src/features/computer-vision/` runs TensorFlow.js models in the browser. `inferenceService.ts` exposes preprocessing (`preprocessImage`) and per-task inference (e.g. `runVegetationSegmentation`) using `tf.tidy()` for memory management. Models are cached in Dexie's `cachedModels` table by name+version. `@tensorflow/tfjs` is included in `optimizeDeps` (prebundled in dev — excluding it serves ~1200 raw modules and breaks on CJS files) and split into its own manual chunk in production builds.

### Defensible space & AR (shared geometry)

Defensible-space zone geometry lives in `src/shared/utils/defensibleZones.ts` (`circleZoneFeatures`, `footprintZoneFeatures`, `DEFENSIBLE_ZONE_SPECS`) and is imported by **both** the Risk Map and the AR view, so the two always draw identical zones. `footprintZoneFeatures` buffers a building footprint (`@turf/buffer`); `circleZoneFeatures` is the point fallback. The map reads the footprint from the rendered style (`buildingFootprintAt` in `RiskMap.tsx`, via `queryRenderedFeatures`); off-map (AR) uses `src/shared/utils/buildingFootprint.ts`, which fetches the Mapbox Streets vector tile and decodes its `building` layer (`@mapbox/vector-tile` + `pbf`) — the Tilequery API returns only a point, not the outline. AR renders the zones as ground `LineLoop`s two ways: `GeoMarkerOverlay` (compass overlay, all platforms incl. iOS) and `WebXRScene` (WebXR, Android only). WebXR `immersive-ar` is unsupported on iOS.

### Build chunking

`vite.config.ts` splits these into separate chunks: `tensorflow`, `mapbox`, `three`, and a `vendor` chunk for react/router/zustand. Keep heavy libraries out of shared modules that are eagerly imported.

### Styling

Tailwind with `darkMode: 'class'` and a shadcn-style HSL CSS-variable theme defined in `src/index.css` (`--background`, `--primary`, etc., plus a `.dark` override). Custom palettes: `fire-*`, `forest-*`, and `risk-{low,moderate,high,extreme}`. Reusable component classes (`.btn`, `.btn-primary`, `.card`, `.input`, `.risk-badge-*`) are defined in `@layer components` in `index.css` — prefer these over re-creating button/input styles ad hoc.

### Domain model

Domain types in `src/shared/types/index.ts`. Core flow: `Property` → `Assessment` (status `in_progress` | `completed` | `archived`, with `CategoryScores` across six categories: defensible space, roof/structure, vegetation, access/evacuation, water supply, ember intrusion) → `Finding[]` + `Recommendation[]` + `AssessmentPhoto[]` + `MapAnnotation[]`. Risk levels are `low | moderate | high | extreme` and map to the Tailwind `risk-*` colors and `.risk-badge-*` classes.

Supabase row shapes use `snake_case` (`src/shared/types/database.ts`); domain types use `camelCase`. There is no automatic mapper — code that crosses the boundary translates field names manually (see `syncPhoto` in `offlineStorage.ts` for the pattern).

## Notes

- Docs live in `docs/`: `TEST_PLAN.md` (end-user tests) and `SBOM.md` (dependencies/licenses/data sources).
- `nul` in repo root is a stray Windows artifact (likely a `> nul` redirect on the wrong platform) — safe to ignore/delete.
- `src/lib/` is aliased as `@lib` but does not exist yet.
