# Wildfire Risk Assessment — End-User Test Plan

Manual, end-to-end test plan covering every user-facing feature. Written to be
run by a tester with no knowledge of the code. Work top to bottom; the setup and
auth suites are prerequisites for everything else.

- **App under test:** `wildfire-risk-assessment` PWA (Vite + React + TypeScript)
- **Primary target:** mobile browser (field use), with desktop as secondary
- **Legend:** ✅ pass · ❌ fail (file a bug) · ⚠️ pass with notes · ⏭️ blocked/skipped

---

## 1. Test environment & prerequisites

The app has a few hard dependencies. Confirm these **before** testing or whole
suites will appear "broken" when they're really just unconfigured.

| Dependency | Why it matters | How to confirm |
|---|---|---|
| **Supabase project** (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) | Auth, data, sync. Placeholder values let the UI boot but every backend call fails. | Registration/login actually work (Suite 2). |
| **Email confirmation policy** | New users can't log in until they confirm by email, unless **autoconfirm** is on. | Supabase dashboard → Authentication → Email. For testing, enable autoconfirm or use a real inbox. |
| **Mapbox token** (`VITE_MAPBOX_TOKEN`) | Risk Map and the AR↔map markers. Without it the map shows a "Map Not Configured" screen. | Map renders tiles (Suite 5). |
| **HTTPS origin** | Camera (AR) and Geolocation (Map/AR) require a secure context. `localhost` counts; a LAN IP does **not**. | Use the production build over an HTTPS tunnel for device testing. |
| **Two browsers/devices** | Cross-device sync (Suite 12) needs two clients signed into the same account. | — |

### Build/run modes
- **Dev:** `npm run dev` — fast, but unbundled; slow over a tunnel.
- **Production preview (recommended for device testing):** `npm run build` then
  `npm run preview`. Serves the real PWA (service worker, chunking).
- **PWA install:** test from the production preview over HTTPS.

### Auth mode note
`AuthProvider` has a `DEV_MODE` flag. It must be **`false`** for real auth/sync
testing (it injects a mock user that won't match Supabase rows). If the app never
asks you to log in and the dashboard is pre-populated with a "Dev User," DEV_MODE
is on — stop and switch it off before testing Suites 2, 11, 12.

### Test data to prepare
- One **test account** (email + password ≥ 8 chars).
- A second account (or second browser) for sharing/sync tests.
- A property **address** with known coordinates, ideally near your physical
  location so GPS/AR can be exercised outdoors.

---

## 2. Authentication & access control

| ID | Test | Steps | Expected |
|---|---|---|---|
| AUTH-01 | Guard redirects when signed out | In a fresh browser, open `/` (or `/map`, `/settings`). | Redirected to `/login`; protected content not shown. |
| AUTH-02 | Register — validation | On `/register`, submit with mismatched passwords, then a <8-char password. | Inline error toast for each; no account created. |
| AUTH-03 | Register — success | Fill name/email/password, accept Terms, submit. | "Account created — check your email to verify"; routed to `/login`. A `profiles` row is created server-side (no error). |
| AUTH-04 | Email confirmation gate | Try to log in before confirming (if autoconfirm is **off**). | Login is refused until the emailed link is clicked. (If autoconfirm on, login works immediately.) |
| AUTH-05 | Login — success | Enter confirmed credentials. | Lands on the dashboard. |
| AUTH-06 | Login — bad credentials | Enter a wrong password. | "Login failed" toast; stays on `/login`. |
| AUTH-07 | Return-to after login | While signed out, open `/settings`; get redirected to login; then log in. | After login you land on `/settings` (the originally requested page), not `/`. |
| AUTH-08 | Sign out | Settings → Sign Out. | Returned to a signed-out state; protected routes redirect again. |
| AUTH-09 | Terms/Privacy reachable pre-login | From `/login` and `/register`, click the Terms and Privacy links. | `/terms` and `/privacy` open and render (Suite 10). |

---

## 3. Dashboard

| ID | Test | Steps | Expected |
|---|---|---|---|
| DASH-01 | Loads without hanging | Sign in and land on `/`. | Dashboard renders; no infinite spinner, even for a new account with no data. |
| DASH-02 | Empty state | New account. | Stats show 0; "No assessments yet" with a New Assessment CTA. |
| DASH-03 | Stats populate | After completing assessments (Suite 4). | Total / Completed / Average Score / In Progress reflect real data. |
| DASH-04 | Quick actions | Click New Assessment, View Risk Map, Training tiles. | Navigate to `/assessment/new`, `/map`, `/training`. |
| DASH-05 | Recent list | With ≥1 assessment. | Recent assessments list; tapping one opens its detail. |
| DASH-06 | Risk alert banner | With a low average score (<6). | "Attention needed" banner with a link to Training. |

---

## 4. Assessment wizard (4 steps: Property Info → Photo Capture → Inspection → Results)

| ID | Test | Steps | Expected |
|---|---|---|---|
| WIZ-01 | Start | Dashboard → New Assessment (`/assessment/new`). | Step 1 "Property Info" with a 4-step progress indicator. |
| WIZ-02 | Step gating | Try Next with required fields blank. | Cannot advance until the step is valid. |
| WIZ-03 | Property info | Enter address/details; Next. | Advances to Photo Capture. |
| WIZ-04 | Photo capture — add | Capture or upload photos into categories. | Photos appear with thumbnails; per-category counts update. |
| WIZ-05 | Training consent OFF (default) | Leave "Contribute photos…" unchecked. | Copy states photos are used only for your assessment; hazard tagging not required. |
| WIZ-06 | Training consent ON | Check the consent box; read the copy. | Copy discloses training **and** possible use in JANUS research/presentations; Privacy Policy link opens in a new tab; hazard tags can be added. |
| WIZ-07 | Inspection checklist | Complete the checklist across the six categories. | Category scores compute; can proceed to Results. |
| WIZ-08 | Results & findings | Review Results step. | Overall score, per-category breakdown, findings, and recommendations shown. |
| WIZ-09 | Save / complete | Save the assessment. | Persists; appears on the dashboard and in the property's assessments. |
| WIZ-10 | Edit existing | Open `/assessment/:id/edit`. | Wizard pre-loads saved data; edits save back. |
| WIZ-11 | Offline create | Go offline (Suite 11), run WIZ-01..09. | Works fully; queued for sync; visible immediately from local storage. |
| WIZ-12 | Photos visible in detail | Open a saved assessment's detail (`/assessment/:id`). | A Photos section shows captured photos. After sync (blob cleared), they still display via the Storage URL. |

---

## 5. Risk Map

| ID | Test | Steps | Expected |
|---|---|---|---|
| MAP-01 | Map loads | Open `/map`. | Mapbox tiles render. (If "Map Not Configured" shows, the token is missing — fix before continuing.) |
| MAP-02 | Property markers | With scored assessments. | House-shaped markers, colored by risk level; tapping focuses/zooms. |
| MAP-03 | Style switch | Toggle Satellite / Streets / Terrain. | Base map switches; custom layers/markers redraw correctly after the switch. |
| MAP-04 | Layer toggles | Toggle Fire History / other layers. | Layers show/hide with correct legend swatches. |
| MAP-05 | Locate me | Tap the locate control; grant location. | Map centers on your GPS position; a "you are here" marker + accuracy halo appear. |
| MAP-06 | GPS denied | Deny location. | Graceful "Location unavailable" message; no crash. |
| MAP-07 | Place annotation | Open `/map/:assessmentId`; tap "Place marker"; tap the map. | Crosshair cursor; tap opens the new-marker form (title/type/risk). |
| MAP-08 | Save annotation | Fill the form; Save. | Diamond tag marker appears at the tapped point, colored by risk; toast confirms. |
| MAP-09 | Annotation detail/remove | Tap a placed marker. | Detail popup with title/type/risk and a Remove action; remove deletes it. |
| MAP-10 | Place gated to assessment | Open bare `/map` (no assessment). | No "Place marker" button (annotations are assessment-scoped). |
| MAP-11 | Screenshot | Tap screenshot control. | A PNG of the current map downloads. |
| MAP-12 | Share | Tap share. | Native share sheet, or link copied to clipboard with a toast. |
| MAP-13 | Select property by address | Tap 🔍 "Select a property"; search an address of a suburban house. | Flies in and drops a labeled pin; defensible-space zones draw around it. |
| MAP-14 | Select property by map tap | In the modal, "Pick on the map"; tap a rooftop. | Crosshair cursor; the tapped point is pinned and focused. |
| MAP-15 | Zones follow footprint | Focus a property over a mapped building (zoom 17). | Zones **trace the building outline** (Zone 0/1/2 at 5/30/100 ft), not circles. Rural / no footprint falls back to circles. |
| MAP-16 | Hybrid fire history | Toggle Fire History; view inside CA, then a non-CA state (zoom ≥ 7). | CA shows CAL FIRE perimeters; elsewhere shows NIFC national perimeters; refetches on pan/zoom. |
| MAP-17 | Per-layer legend | Toggle layers on/off; use each key's chevron. | A key card appears **only** for visible layers; the chevron hides/unhides each key; keys sit above the scale bar. |
| MAP-18 | Enable-location (iOS) | On iOS, tap the "Enable location" button (or Locate). | The iOS location prompt appears (it won't auto-prompt); on denial a toast explains how to enable. |

---

## 6. AR viewer

Requires HTTPS + camera permission. Best tested outdoors on a phone.

| ID | Test | Steps | Expected |
|---|---|---|---|
| AR-01 | Camera starts | Open `/ar`; grant camera. | Live camera feed with viewfinder corners. |
| AR-02 | Camera denied | Deny camera. | Clear error with a "Try Again" action; no crash. |
| AR-03 | Live hazard scan | Point at vegetation/structures; wait for scan ticks. | Detected-risk overlays appear with type/confidence/severity. |
| AR-04 | Capture finding | Open AR from an assessment (`/ar/:assessmentId`); capture a detection. | "Saved to assessment" toast; it becomes a finding on that assessment; the detection dismisses. |
| AR-05 | Capture without assessment | Open bare `/ar`; capture. | "Open AR from an assessment to save it" message (recorded, not attached). |
| AR-06 | Mode switch | Switch camera-overlay / 3D / measurement modes. | Modes switch; on WebXR-capable devices, measurement may enter an XR session. |
| AR-07 | Clear / dismiss | Dismiss individual and all detections. | Overlays clear as expected. |
| AR-08 | Defensible-space zones (iOS / all) | Camera-overlay or 3D-model mode → "Enable AR positioning"; grant motion + location; tilt down and pan. | Filled translucent **bands** (red/orange/yellow = Zone 0/1/2) appear **on the ground** around you and **hold position** as you turn. Over a building they follow its footprint; in the open they're circles. |
| AR-09 | Zone radar HUD | With positioning enabled. | A top-right **top-down radar** shows the zones around you (you at center), **rotating heading-up** as you turn — visible even without tilting down. |
| AR-10 | Show/hide defensible space | Tap the **"Defensible space"** eye toggle (left, below the mode selector). | Hides/shows the ground bands **and** the radar together; toggles back on. |
| AR-11 | Footprint vs circle | Stand on/near a mapped building, then in an open area. | On a building the zones trace its footprint (fetched from the Mapbox vector tile); with no footprint they fall back to circles. |
| AR-12 | Defensible-space zones (Android / WebXR) | On a WebXR device, enter measurement mode; grant motion + location. | The same zones render on the floor plane via the XR session (drift-free vs the compass path). ⚠️ Device-only — not verifiable on iOS or desktop. |

---

## 7. Map ⇄ AR marker bridge (Phases 3–4)

Requires HTTPS, camera, GPS, and ideally a compass (mobile). Test outdoors.

| ID | Test | Steps | Expected |
|---|---|---|---|
| BRIDGE-01 | Map → AR | Place a marker on `/map/:assessmentId`; open `/ar/:assessmentId`; tap "Show N markers in AR" and grant motion/orientation. | A risk-tinted 3D pin + label appears over the camera in roughly the marker's real-world direction. |
| BRIDGE-02 | Accuracy chip | Observe the GPS/heading chip in AR. | Shows `GPS ±Xm` colored by quality (green/amber/red) and a heading or "no compass". |
| BRIDGE-03 | Nearest HUD | With several markers. | Bottom HUD lists the nearest markers with live distances. |
| BRIDGE-04 | AR → Map | In AR, tap "Drop marker 10m ahead"; complete the form; Save. | Marker saved (source: AR); toast confirms. |
| BRIDGE-05 | Live cross-view sync | Keep the map open in one tab and AR in another (same account/assessment). Drop a marker in AR. | It appears on the map **without reload** (and map-placed markers appear in AR). |
| BRIDGE-06 | No-compass fallback | On a device without a compass. | Dropping falls back to placing at your GPS position; AR shows "no compass". |
| BRIDGE-07 | Pitch/roll tracking | With markers shown in AR, tilt the phone up/down and roll it side to side. | Markers track the tilt (move down as you raise the phone, etc.), not just left/right. ⚠️ Experimental — if motion feels inverted on your device, note it (sign calibration). |
| BRIDGE-08 | XR geo markers (experimental) | On a WebXR-capable device (e.g. Android Chrome), enter measurement mode with markers present and grant motion. | Markers render in the XR scene roughly in their real-world direction. ⚠️ Experimental/approximate — XR space has no true north; expect drift. Not expected to work on iOS. |

---

## 8. Training

| ID | Test | Steps | Expected |
|---|---|---|---|
| TRAIN-01 | Hub loads | Open `/training`. | Courses (e.g. "Understanding Wildfire Risk", "Defensible Space") with per-course progress and an overall completion figure. |
| TRAIN-02 | Open lesson | Open a course → lesson (`/training/:courseId/:lessonId`). | Lesson content renders. |
| TRAIN-03 | Quiz | Complete a lesson quiz. | Answers graded; lesson marked complete. |
| TRAIN-04 | Progress persists | Complete a lesson, return to the hub, reload. | Progress and course % reflect the completion. |
| TRAIN-05 | Badges | Complete a course's lessons. | The course badge/award reflects completion. |

---

## 9. Settings

| ID | Test | Steps | Expected |
|---|---|---|---|
| SET-01 | Profile load/save | Edit name/phone/address; Save. | "Profile updated" toast; values persist on reload. |
| SET-02 | Theme | Switch Light / Dark / System. | Theme changes immediately and persists; dark mode styles correct app-wide. |
| SET-03 | Notifications | Toggle Fire Alerts / Reminders / Training Updates. | Toggles reflect and hold their state. |
| SET-04 | Sync status | Observe the Data & Sync section. | Shows synced / N pending / offline accurately. |
| SET-05 | Sync now | With pending items online, tap Sync Now. | Pending count drops to 0; last-sync updates. |
| SET-06 | Clear local data | Tap Clear Local Data; confirm. | Local cache cleared after the confirm prompt; app recovers. |
| SET-07 | Export my data | Tap Export. | A JSON file downloads containing account + assessments + photo **metadata** (no raw image blobs). |
| SET-08 | Request deletion | Tap Request data deletion; confirm. | Opens a prefilled email to the privacy contact stating completion within 30 days. |
| SET-09 | Legal links | Tap Privacy Policy / Terms. | Open `/privacy` and `/terms`. |

---

## 10. Legal pages

| ID | Test | Steps | Expected |
|---|---|---|---|
| LEGAL-01 | Privacy renders | Open `/privacy`. | JANUS Research Group LLC; covers data collected, AI/ML training, public-safety sharing, planned insurer/advertiser sharing, the photo carve-out, under-18 clause, 30-day deletion, and full contact block. |
| LEGAL-02 | Terms renders | Open `/terms`. | "Use at your own risk" banner, informational-only/AS-IS disclaimers, Georgia governing law, contact. |
| LEGAL-03 | Public access | Open both while signed out. | Both load without login. |
| LEGAL-04 | Cross-links | From Terms, click the Privacy link and vice versa. | Navigation works. |

---

## 11. Offline-first behavior

Use browser devtools (Network → Offline) or airplane mode.

| ID | Test | Steps | Expected |
|---|---|---|---|
| OFF-01 | Offline indicator | Go offline. | App reflects offline status (header/Settings). |
| OFF-02 | Offline reads | While offline, browse dashboard, assessments, map markers. | Previously loaded data still displays (served from local storage). |
| OFF-03 | Offline writes | While offline, create/edit an assessment and place markers. | Saved locally and visible immediately; queued for sync; pending count rises. |
| OFF-04 | Auto-flush on reconnect | Go back online. | Queue flushes automatically; pending count returns to 0; data reaches the backend. |
| OFF-05 | Retry/backoff | Force a sync failure (e.g. brief bad network), then recover. | Failed ops retry (up to 5×) rather than vanish; on recovery they sync. |
| OFF-06 | Photo upload + blob clear | Create an assessment with photos offline, then sync. | Photos upload to storage on sync; local blobs cleared to save space; images still viewable via remote URL. |

---

## 12. Cross-device / read-sync

Two browsers (A and B) signed into the **same** account.

| ID | Test | Steps | Expected |
|---|---|---|---|
| SYNC-01 | Pull on open | On A, create + sync a property/assessment. Open the app fresh on B (online). | B pulls and shows the record created on A. |
| SYNC-02 | Annotation pull | On A, place a map marker on an assessment and sync. Reload B. | The marker appears on B's map for that assessment. |
| SYNC-03 | No clobber of local edits | On B (offline), edit a record A also changed. Bring B online. | B's unpushed local edit is **not** overwritten by the pull; it pushes on reconnect. |
| SYNC-04 | Sign-in triggers pull | Sign in on a fresh browser. | Existing account data is pulled into the new client. |
| SYNC-05 | Photo pull | On A, capture photos on an assessment and sync. Open the assessment on B. | B shows the photos in the detail Photos section (fetched from Storage; blobs aren't transferred, the metadata + URL are). |
| SYNC-06 | Training progress pull | On A, complete a lesson. Open fresh on B. | B reflects the completed lesson / course progress. |

> Note: photo **blobs** themselves aren't copied between devices — B loads images
> from Storage via URL. Conflict policy is last-write-wins with a dirty-skip guard.

---

## 13. Shared report view

| ID | Test | Steps | Expected |
|---|---|---|---|
| SHARE-01 | Open shared report | Open a valid `/report/:token` link. | Read-only assessment report renders without login. |
| SHARE-02 | Invalid/expired token | Open a bad token. | Graceful "not found/expired" state; no crash, no data leak. |
| SHARE-03 | Photos in shared report | Open a valid `/report/:token` for an assessment that has photos, in a browser not signed into the owner account. | Photos appear (fetched from Supabase under the shared-read RLS policy). |

---

## 14. PWA, performance & cross-cutting

| ID | Test | Steps | Expected |
|---|---|---|---|
| PWA-01 | Install | From the production build over HTTPS, install to home screen. | Installs; launches standalone with icon/splash. |
| PWA-02 | Offline launch | Launch the installed app offline. | App shell loads from cache. |
| PWA-03 | Update | Deploy a new build; reopen. | Service worker updates (may need a second refresh to take effect). |
| PWA-04 | Map tile caching | Pan the map online, then go offline and revisit. | Previously viewed tiles render from cache. |
| RESP-01 | Mobile layout | Exercise key screens at phone width. | No horizontal scroll; controls reachable; nav usable. |
| RESP-02 | Dark mode pass | Toggle dark mode and walk every screen. | No unreadable/low-contrast text; no white flashes. |
| PERF-01 | First load | Load the production build fresh. | Reasonable load; no console errors that break features. |

---

## 15. Known limitations / out of scope

These are **expected** behaviors — not bugs. Don't file them.

- **AR positioning accuracy:** GPS ±metres and compass drift; markers can be
  several metres off and swing when turning. Not survey-grade.
- **AR pitch/roll is approximate & unverified per device:** tilt tracking uses a
  conventional portrait sign mapping; an inverted axis on a given device is a
  calibration note (BRIDGE-07), not a release blocker.
- **WebXR geo markers are experimental:** the XR scene has no true north, so the
  alignment is approximate and drifts; non-XR overlay is the primary path.
- **AR defensible-space zones center on where you stand:** the structure center
  is stamped from the first GPS fix, not yet a pre-selected property; an explicit
  "set / nudge structure" control is planned.
- **AR zone ground height is approximate:** the ground plane is dropped a fixed
  ~1.5 m (handheld height); the on-ground bands may sit slightly high/low on a
  given device. The **radar HUD** is the pitch-independent, reliable view.
- **iOS has no WebXR:** iPhone/iPad use the compass/GPS overlay (metres accuracy,
  some drift). WebXR (Android) is the higher-fidelity path; both draw the same
  shared zone geometry. The Android/WebXR path (AR-12) is device-only and not
  verified on iOS/desktop.
- **Photo blobs aren't copied between devices:** metadata + Storage URL sync;
  the image bytes are served from Storage, not transferred device-to-device.
- **Account deletion is request-based:** the in-app control sends an email
  request (completed within 30 days), not an instant self-service hard delete.
- **Insurer/advertiser data sharing is not active** — disclosed as planned/future
  in the Privacy Policy only.

---

## 16. Bug report template

```
ID / Title:
Test case ID (e.g. MAP-08):
Severity: blocker / major / minor / cosmetic
Environment: device, OS, browser, build (dev/preview), online/offline
Account / DEV_MODE: 
Preconditions:
Steps to reproduce:
  1.
Expected:
Actual:
Console errors / screenshots:
```

---

## 17. Smoke test (quick pre-release subset)

Run this short path to sanity-check a build before deeper testing:

1. **AUTH-05** log in → **DASH-01** dashboard loads
2. **WIZ-01→09** create and save an assessment
3. **MAP-01** map loads → **MAP-07/08** place a marker
4. **AR-01** camera starts → **BRIDGE-01** marker shows in AR
5. **SET-05** Sync Now clears pending
6. **OFF-03/04** create offline, reconnect, syncs
7. **AUTH-08** sign out

If all seven pass, the core path is healthy.
