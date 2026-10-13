# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`wildfire-risk-assessment` — a PWA (Vite + React 18 + TypeScript) for assessing wildfire risk on a property. Mobile-first, designed to work offline in the field and sync back to Supabase when a connection returns. Uses Mapbox GL for mapping, onnxruntime-web + TensorFlow.js for on-device computer vision, and Three.js / WebXR for an AR viewer. Beyond the homeowner assessment, it implements WFCA Phase 2 C5-2 for fire agencies: mitigation tracking, organizations with inspector verification, an agency dashboard, grant-reporting exports, and fire-exposure monitoring. See the Mitigation tracking and Organizations sections below, and the README.

## Commands

```bash
npm run dev        # Vite dev server
npm run build      # tsc (typecheck, noEmit) then vite build
npm run preview    # serve the production build
npm run lint       # eslint . --ext ts,tsx (max-warnings 0)
npm run test       # vitest (watch mode)
npm run test:e2e   # playwright
npm run export:training  # pull training-consented photos from Supabase into a YOLO dataset layout (training-data/)
npm run import:consented # fold exported consented photos into the labeling pool (training-data/harvest/)
npm run flywheel         # export:training + import:consented — the scheduled data-collection loop
npm run label:prepare    # build a SAM-assisted labeling bundle from triaged-keep images (training-data/labeling/)
npm run eval:detector    # golden-image evaluation of the WUI hazard detector (per-class recall vs recorded baseline)
npm run sync:ort         # re-copy onnxruntime-web runtime/wasm into public/ort/ after upgrading the package
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

- **Dexie (IndexedDB)** is the source of truth while offline. `src/shared/services/offlineStorage.ts` defines the `WildfireRiskDB` schema (properties, assessments, photos with `Blob`s, annotations, training progress, sync queue, cached training content, analytics events, mitigation actions). Current version is **v5**: v4 dropped the never-used `cachedModels` table, and v5 added `mitigationActions`. The order matters, because production devices passed through v4 first. Dexie deletes any table a version step doesn't declare, so never reorder or rewrite past versions; append a new one.
- **Sync queue pattern**: writes go through `saveXLocally()` / `updateXLocally()` helpers, which both update Dexie and `queueSyncOperation()` an entry into `syncQueue`. Reads come straight from Dexie.
- **OfflineProvider** (`src/app/providers/OfflineProvider.tsx`) watches `navigator.onLine`, polls the queue every 5s, exposes `useOffline()` (with `syncNow`, `queueOperation`, `pendingOperations`), and auto-flushes via `syncPendingOperations()` when the app comes back online. Each operation retries up to 5 times before being marked failed (`lastError` set, kept in queue).
- **Photos** are stored locally as Blobs in Dexie, uploaded to Supabase Storage bucket `assessment-photos` on sync, then the blob is cleared to save space (`syncPhoto()` in `offlineStorage.ts`). Object paths must stay `<assessmentId>/<photoId>.jpg`: Storage RLS (`20261012120000_photo_storage_owner_scoped.sql`, tests in `supabase/tests/photo_storage_rls.sql`) lets only the assessment's owner write under that folder, and only the owner or a reviewer list it. Public URLs (`getPhotoUrl`) bypass RLS by design.
- **Service worker / PWA**: configured in `vite.config.ts` via `vite-plugin-pwa`. Runtime caches: Mapbox tiles (CacheFirst, 30d), Supabase (NetworkFirst, 1d), images (CacheFirst, 30d), `model-cache` for `/ort/`, `/models/` and `.wasm`/`.tflite`/`.onnx` files (CacheFirst, 90d), and `tfjs-model-cache` for TF.js model shards (CacheFirst, 90d). The plugin generates `sw.js`; `main.tsx` also has a manual `navigator.serviceWorker.register('/sw.js')` call.

When adding a new persisted entity: extend the Dexie schema (bump `version()` in `offlineStorage.ts`), add `saveXLocally` + `updateXLocally` helpers that queue sync ops, and add a case to `executeSyncOperation()` if the table name needs special handling.

### Auth — DEV_MODE flag

`src/app/providers/AuthProvider.tsx` has a top-level `const DEV_MODE` flag. When `true`, it bypasses Supabase auth entirely and injects a mock user/session; real Supabase auth code lives behind `if (DEV_MODE)` early-returns. It is currently `false` (real Supabase auth is active) — flip to `true` to bypass auth for local UI work, but never ship it `true`, as that auto-logs-in a mock user for every visitor.

### Computer vision

`src/features/computer-vision/` runs two in-browser inference runtimes. The default hazard detector is `wuiDetector.ts` — JANUS's 19-class YOLOv8s (ONNX, fp16) via onnxruntime-web, with the runtime self-hosted in `public/ort/` (re-copy with `npm run sync:ort` after upgrading the package); its classes map to guideline checklist items via `detectionGuidance.ts`. The DeepLab ADE20K segmenter (`vegetationSegmenter.ts`, TensorFlow.js) provides vegetation coverage and the fallback when the detector can't load; analyzers are registered in `frameAnalyzer.ts` (`?cvModel=` override). Model caching: TF.js models in TF.js's own IndexedDB store (`indexeddb://` keys), the ONNX + wasm via the service worker's `model-cache` runtime rule. `@tensorflow/tfjs` is included in `optimizeDeps` (prebundled in dev — excluding it serves ~1200 raw modules and breaks on CJS files) and split into its own manual chunk in production builds; onnxruntime-web is deliberately NOT bundled (its runtime is loaded from `/ort/` at runtime — bundling it drags a 28 MB WebGPU wasm into dist).

### Defensible space & AR (shared geometry)

Defensible-space zone geometry lives in `src/shared/utils/defensibleZones.ts` (`circleZoneFeatures`, `footprintZoneFeatures`, `DEFENSIBLE_ZONE_SPECS`) and is imported by **both** the Risk Map and the AR view, so the two always draw identical zones. `footprintZoneFeatures` buffers a building footprint (`@turf/buffer`); `circleZoneFeatures` is the point fallback. The map gets the footprint through `findFootprint` (`src/features/maps/utils/footprint.ts`). It first reads the rendered style (`queryRenderedFeatures`), then falls back to `src/shared/utils/buildingFootprint.ts`, which fetches the Mapbox Streets vector tile and decodes its `building` layer (`@mapbox/vector-tile` + `pbf`). AR uses the tile path directly. The Tilequery API can't do this: it returns only a point, not the outline.
- The fallback matters because **Satellite (`satellite-streets-v12`) has no building layer at all**. Streets and Outdoors draw buildings only from zoom 15.
- `RiskMap` always waits for `idle` before the lookup. Right after a style switch, the new style's buildings aren't drawn yet. AR renders the zones as ground `LineLoop`s two ways: `GeoMarkerOverlay` (compass overlay, all platforms incl. iOS) and `WebXRScene` (WebXR, Android only). WebXR `immersive-ar` is unsupported on iOS.

### State-localized inspection guidelines

The assessment checklist and recommendation rules are data, not component code: `src/features/assessment/content/guidelines/` holds one `GuidelineProfile` per jurisdiction (24 states as of Aug 2026 — every state with a mandate or its own published numbers, per a 50-state survey) plus the national `composite.ts` fallback, registered in `index.ts` (`resolveGuidelineProfile(stateCode)`). Most state profiles are small deltas built with `deriveProfile(compositeProfile, {...})` (`derive.ts`) so baseline improvements flow through; only CA and GA are fully hand-written. The wizard resolves the property's state fully offline via `src/shared/utils/usState.ts` — GPS point-in-polygon against a bundled simplified Census states GeoJSON (`src/shared/data/usStates.json`, lazily imported so it's its own precached chunk), falling back to parsing the address string. The chosen profile drives the checklist UI, scoring, and recommendations, and is persisted as `Assessment.guidelineProfileId` (`assessments.guideline_profile` column). To add a state: create `content/guidelines/<state>.ts` covering **all six** risk categories (a missing category zeroes its score — `guidelines.test.ts` enforces this) and add it to `STATE_GUIDELINE_PROFILES`. Every profile must declare user-facing provenance — `basis` (mandatory / partial-mandate / guidance / baseline), a `basisNote` sentence, and official `sources` links (also test-enforced); the checklist shows these in an "About these guidelines" panel. Reuse composite item `id`s for unchanged questions so answers survive a mid-wizard state change.

### Mitigation tracking

`src/features/mitigation/` tracks progress on each assessment recommendation (WFCA Phase 2 capability C5-2). One `MitigationAction` per (assessment, recommendation), stored in Dexie `mitigationActions` and the `mitigation_actions` table; no record means "to do". Ids are deterministic (`mitigationActionId`, uuid v5) so two devices converge on one row. Status is `planned | in_progress | completed | verified`; `verified` is third-party only — RLS rejects owner writes that set it and locks a row once verified, and `applyStatusChange` mirrors that client-side. Sync for this table **upserts the full record and throws on error** (special case in `executeSyncOperation`), using the explicit mappers in `mitigationRows.ts` that send `null` for cleared fields. Pure logic lives in `mitigationProgress.ts`; the report UI is `RecommendationTracker`. RLS tests: `supabase/tests/run-rls-tests.sh` (Docker; runs every migration on plain Postgres with stubbed `auth`/`storage` schemas, then each `*_rls.sql`).

### Shared reports (token-bound)

`/report/:token` reads through `shareClient(token)` (`supabaseClient.ts`), which sends the token in an `x-share-token` header. `assessment_is_shared(aid)` matches only a live share for that assessment **with that token** (`request_share_token()` reads PostgREST's `request.headers`), so the `*_select_shared` policies expose exactly one report per token, and share rows aren't publicly listable (migration `20261012110000_share_token_bound_reads.sql`). Components rendered inside the shared view must read via `useDataClient()` (`dataClient.ts`, `ShareTokenContext`), not the `supabase` singleton, or RLS returns nothing. RLS tests: `supabase/tests/share_links_rls.sql`.

### Organizations & inspector verification

`src/features/organizations/` + migration `20261012100000_organizations_inspector_verification.sql`. Tables: `organizations` (public names), `organization_members` (`admin | inspector | viewer`, **service-role writes only** — no self-serve path to inspector), `assessment_submissions` (homeowner → one org; owner inserts/deletes, org members read). Members of an org an assessment was submitted to get **read-only** access via the `*_select_reviewer` policies (`user_can_review_assessment`). Agency submissions deliberately do **not** use `shared_reports`: a share row makes the report public (`assessment_is_shared`). Verification never goes through table writes. Inspectors have no write policy on `mitigation_actions`; they call the SECURITY DEFINER functions `verify_mitigation_action(action, org, note)` / `revoke_mitigation_verification(action)`. These check role, submission, `status = 'completed'` and conflict of interest (no verifying your own property), then stamp `verified_by` / `verified_at` / `verifier_organization_id` / `verification_note` server-side. Verification is online-only. On the owner's device a server verification beats local edits: `remoteVerificationWins` in `mergeActions`, the pull keeps verified rows even when dirty, and the sync path drops an owner upsert that RLS rejects because the row is now verified. UI: the Share dialog's Agency tab (org picker), `/inspections` (`AgencyDashboard`, nav item only for members — see below), reviewer mode in `AssessmentDetail`, Verify/Revoke in `RecommendationTracker` (`verifyAs`). RLS tests: `supabase/tests/organizations_rls.sql`.

The agency dashboard (`AgencyDashboard.tsx`, migration `20261012140000_agency_dashboard.sql`) reads one row per submission from `agency_dashboard(org)`. That function is **SECURITY INVOKER**: the reviewer policies decide visibility, so it adds no access logic of its own. Its mitigation counts cover only the assessment's *current* recommendations, the same rule as `summarizeMitigation`. Rollups and the map's progress bands are pure functions in `agencyRollup.ts`. The map is `components/AgencyMap.tsx` and shows property points, not parcel boundaries. Review status (`submitted → in_review → closed`) changes only through `set_submission_status()`, inspector/admin only. There is deliberately no UPDATE policy on `assessment_submissions`. New public-schema functions must `revoke … from public, anon`: Supabase grants anon EXECUTE explicitly, and the test stub mirrors that.

Exports and printing (WFCA C5-2 "support grant reporting"):
- **Dashboard exports** come from pure builders in `exports.ts`: properties CSV, a per-recommendation mitigation-actions CSV, and GeoJSON points (RFC 7946, `[lng, lat]`).
  - The actions CSV reads `agency_mitigation_export(org)` (migration `20261013100000`), an invoker function like `agency_dashboard`.
  - Field names are snake_case and stable, because downstream templates key on them.
  - `csvCell` neutralises spreadsheet formulas in text (CSV injection), so keep all CSV output going through it.
  - Exports always cover every submission, ignoring the on-screen filters.
- **PDFs are the browser's print dialog** (`printPage()` in `shared/utils/print.ts`); there is no PDF library.
  - `printPage()` loads lazy images and prints in the light theme.
  - Use Tailwind `print:` variants to hide chrome; `Layout` already hides the sidebar and top bar.
  - `AgencyMap` sets `preserveDrawingBuffer` so the map canvas prints.

Fire exposure (WFCA C5-2 KSA-7, effectiveness monitoring):
- **The check runs on demand:** inspectors and admins click it in the dashboard (`components/FireExposurePanel.tsx`). Nothing schedules it.
- **Querying:** `fireCheck.ts` asks NIFC's WFIGS year-to-date perimeters, from the browser, which wildfires contain each located property or lie within 1 km. Prescribed burns are excluded.
- **Recording:** hits are written only through `record_fire_exposure()` (migration `20261013110000`). It snapshots the mitigation **as of the fire's discovery**:
  - `verified_at_start` uses server-stamped `verified_at`, so it is trustworthy;
  - `done_at_start` uses the owner's `completed_at`, so it is self-reported;
  - the snapshot is written once and never recomputed, so marking items done after a fire can't improve the record;
  - re-detection only upgrades near → inside.
- **Why store results:** the YTD service resets every January.

Provision an organization and inspector (SQL editor / service role):

```sql
insert into public.organizations (name, kind, state_code) values ('Boise Fire Department', 'fire_agency', 'ID') returning id;
insert into public.organization_members (organization_id, user_id, role)
  select '<org id>', id, 'inspector' from auth.users where email = 'inspector@example.gov';
```

### Build chunking

`vite.config.ts` splits these into separate chunks: `tensorflow`, `mapbox`, `three`, and a `vendor` chunk for react/router/zustand. Keep heavy libraries out of shared modules that are eagerly imported.

### Styling

Tailwind with `darkMode: 'class'` and a shadcn-style HSL CSS-variable theme defined in `src/index.css` (`--background`, `--primary`, etc., plus a `.dark` override). Custom palettes: `fire-*`, `forest-*`, and `risk-{low,moderate,high,extreme}`. Reusable component classes (`.btn`, `.btn-primary`, `.card`, `.input`, `.risk-badge-*`) are defined in `@layer components` in `index.css` — prefer these over re-creating button/input styles ad hoc.

### Domain model

Domain types in `src/shared/types/index.ts`. Core flow: `Property` → `Assessment` (status `in_progress` | `completed` | `archived`, with `CategoryScores` across six categories: defensible space, roof/structure, vegetation, access/evacuation, water supply, ember intrusion) → `Finding[]` + `Recommendation[]` + `AssessmentPhoto[]` + `MapAnnotation[]`. Risk levels are `low | moderate | high | extreme` and map to the Tailwind `risk-*` colors and `.risk-badge-*` classes.

Supabase row shapes use `snake_case` (`src/shared/types/database.ts`); domain types use `camelCase`. There is no automatic mapper — code that crosses the boundary translates field names manually (see `syncPhoto` in `offlineStorage.ts` for the pattern).

## Notes

- Docs live in `docs/`:
  - `USER_GUIDE.md`: end-user guide, including a section for agencies and inspectors.
  - `TEST_PLAN.md`: end-user tests. Suites 13a–13d cover verification, the dashboard, exports and fire exposure.
  - `INSPECTION_GUIDELINES.md`: state-by-state guideline record.
  - `SBOM.md`: dependencies, licenses and data sources. It includes the unresolved Ultralytics AGPL flag on the WUI detector weights.
  - `TAXONOMY.md`: the proposal unifying the detector's 19 object classes with the 11 hazard-condition tags. Read it before merging labeled data or training.
- The README has the security model, the migration list and the rollout order.
  - New migrations are applied by hand in the Supabase SQL editor (no CLI).
  - Additive migrations go before the deploy; behavior-changing ones go after it.
- Placeholders that look real but aren't: the Share dialog's "send via email" creates a share link but sends nothing.
- `supabase/tests/run-rls-tests.sh` runs every `*_rls.sql` against all migrations (needs Docker running). Each test file gets a fresh copy of a migrated template database, so fixtures never leak between files.
- `nul` in repo root is a stray Windows artifact (likely a `> nul` redirect on the wrong platform) — safe to ignore/delete.
- `src/lib/` is aliased as `@lib` but does not exist yet.
