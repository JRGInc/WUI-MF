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
| AR-03 | Live hazard scan | Point at vegetation/structures; wait for scan ticks. | Detected-risk overlays appear with type/confidence/severity. Default backend is the 19-class WUI detector (real classes: tree, fence, firewood, deck, vent…); on its first ever run it downloads ~36 MB (model + runtime) — subsequent runs are cached. If it can't load, the scan falls back to the DeepLab vegetation segmenter. Force a backend with `?cvModel=wui\|deeplab`. |
| AR-04 | Capture finding | Open AR from an assessment (`/ar/:assessmentId`); capture a detection. | "Saved to assessment" toast; it becomes a finding on that assessment; the detection dismisses. For WUI-detector detections the finding files under the guideline category and its description ends with "Check (\<state\>): \<checklist question\> [standard]" from the assessment's guideline profile (e.g. a firewood detection cites the Zone 0 clearance question). |
| AR-05 | Capture without assessment | Open bare `/ar`; capture. | "Open AR from an assessment to save it" message (recorded, not attached). |
| AR-06 | Mode switch | Switch camera-overlay / 3D / measurement modes. | Modes switch; on WebXR-capable devices, measurement enters an XR session. On devices without WebXR (all iOS), measurement mode shows an "AR measurement isn't available on this device" notice — there is no 2D fallback. |
| AR-06a | AR tape measure (Android / WebXR) | In measurement mode, aim the reticle at the ground and tap twice. | A red line with a floating distance label (e.g. "12.3 ft") connects the two points; a rubber-band preview follows the reticle after the first tap. The HUD shows the latest distance, a ft⇄m toggle (persisted), segment count + running total, and a clear button. |
| AR-07 | Clear / dismiss | Dismiss individual and all detections. | Overlays clear as expected. |
| AR-08 | Defensible-space zones (iOS / all) | Camera-overlay or 3D-model mode → "Enable AR positioning"; grant motion + location; tilt down and pan. | Filled translucent **bands** (red/orange/yellow = Zone 0/1/2) appear **on the ground** around you and **hold position** as you turn. Over a building they follow its footprint; in the open they're circles. |
| AR-09 | Zone radar HUD | With positioning enabled. | A top-right **top-down radar** shows the zones around you (you at center), **rotating heading-up** as you turn — visible even without tilting down. |
| AR-10 | Show/hide defensible space | Tap the **"Defensible space"** eye toggle (left, below the mode selector). | Hides/shows the ground bands **and** the radar together; toggles back on. |
| AR-10a | Ground-height nudge | With zones showing, use the **Ground ▲/▼** control (below the eye toggle). | The zone bands move up/down in 0.25 m steps (clamped 0.5–3 m); the setting persists across sessions. |
| AR-17 | Wayfinding to a marker | With AR positioning enabled and markers present, tap a marker chip (bottom row). | The chip highlights; a pointer chip appears (top) with a rotating arrow toward the marker, its live distance, and "ahead" when roughly in view; the radar shows the target as an orange dot (rim-clamped when out of range). Tapping the pointer or the chip again clears it. The selected chip stays pinned first even when other markers are nearer. |
| AR-14 | North trim (calibration) | With AR positioning enabled and a marker visible but rotated off its real direction, use the **North ◀/▶** control (left column). | Content rotates in 2° steps until it lines up (clamped ±30°); the trim shows in the chip (e.g. "North +6°") and persists across sessions on this device. |
| AR-15 | Re-center zones (compass) | In the 3D-model zone view, walk to the structure and tap **"Center zones here"**. | Zones re-draw around your position (footprint refetches for the new center) and stop auto-adjusting afterwards. |
| AR-16 | Re-center / re-align (Android / WebXR) | In measurement mode after alignment: aim the reticle at the structure's base and tap **"Center zones at reticle"**; separately tap **"Re-align north"**. | Zones re-draw centered where the reticle pointed. Re-align hides content, shows the "Aligning to north" chip again, and re-settles within ~2 s. |
| AR-13 | Depth occlusion (Android / WebXR) | On a depth-capable Android device, enter measurement mode near a wall, car, or tree; place a measurement or view zones so content extends behind the obstacle. | An "Occlusion on" chip appears (bottom-left). Zone outlines, the reticle, and measurement lines/points are **hidden where real objects are in front of them**; marker pins and distance labels intentionally stay visible through obstacles. On devices without depth support, no chip appears and content draws over everything (previous behavior). |
| AR-11 | Footprint vs circle | Stand on/near a mapped building, then in an open area. | On a building the zones trace its footprint (fetched from the Mapbox vector tile); with no footprint they fall back to circles. |
| AR-12 | Defensible-space zones (Android / WebXR) | On a WebXR device, enter measurement mode; grant motion + location. | The same zones render on the **detected ground** via the XR session (drift-free vs the compass path): after aiming the reticle at the floor for a moment, the zone outlines and geo markers settle onto the real ground height rather than the session's floor estimate. ⚠️ Device-only — not verifiable on iOS or desktop. |

---

## 7. Map ⇄ AR marker bridge (Phases 3–4)

Requires HTTPS, camera, GPS, and ideally a compass (mobile). Test outdoors.

| ID | Test | Steps | Expected |
|---|---|---|---|
| BRIDGE-01 | Map → AR | Place a marker on `/map/:assessmentId`; open `/ar/:assessmentId`; tap "Show N markers in AR" and grant motion/orientation. | A risk-tinted 3D pin + label appears over the camera in roughly the marker's real-world direction. |
| BRIDGE-02 | Accuracy chip | Observe the GPS/heading chip in AR. | Shows `GPS ±Xm` colored by quality (green/amber/red) and a heading or "no compass". |
| BRIDGE-03 | Nearest HUD | With several markers. | Bottom HUD lists the nearest markers with live distances. |
| BRIDGE-04 | AR → Map | In AR, tap "Drop marker Xm ahead" (adjust the distance with the − / + buttons, 2.5–50 m); complete the form; Save. | Marker saved (source: AR) at the chosen distance along your heading; toast confirms. |
| BRIDGE-04a | AR → Map at the reticle (Android / WebXR) | In measurement mode (opened from an assessment), wait for north alignment, aim the reticle at a spot on the ground, tap "Drop marker at reticle"; complete the form; Save. | Marker saved at the aimed spot — on the map it appears where the reticle pointed, not a fixed distance ahead. |
| BRIDGE-05 | Live cross-view sync | Keep the map open in one tab and AR in another (same account/assessment). Drop a marker in AR. | It appears on the map **without reload** (and map-placed markers appear in AR). |
| BRIDGE-06 | No-compass fallback | On a device without a compass. | Dropping falls back to placing at your GPS position; AR shows "no compass". |
| BRIDGE-07 | Pitch/roll tracking | With markers shown in AR, tilt the phone up/down and roll it side to side. | Markers track the tilt (move down as you raise the phone, etc.), not just left/right. ⚠️ Experimental — if motion feels inverted on your device, note it (sign calibration). |
| BRIDGE-08 | XR geo markers | On a WebXR-capable device (e.g. Android Chrome), enter measurement mode with markers present and grant motion. | An "Aligning to north" chip shows for ~1.5 s (hold the phone upright), then markers appear in their real-world direction and **hold steady** while panning/walking — after alignment the tracker (not the compass) keeps them in place, via an XR anchor where supported. Placement accuracy is GPS/compass-bound at alignment time. Not expected to work on iOS. |

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
| SHARE-04 | Token-bound access | Signed out, with a valid share link open in one tab, query `/rest/v1/assessments?select=id` and `/rest/v1/shared_reports?select=id` with only the anon key (no `x-share-token` header); then open `/report/<random-uuid>`. | Both queries return `[]` (no listing of shares or shared assessments); the random token shows the not-found state. The valid link still renders its own report, findings, progress and photos. |

---

## 13a. Agency submission & inspector verification

Needs a provisioned organization and an inspector account (see CLAUDE.md, "Organizations & inspector verification"). Use **two accounts**: the homeowner and the inspector.

| ID | Test | Steps | Expected |
|---|---|---|---|
| VER-01 | Submit to an agency | As the homeowner, open a synced assessment → Share → **Agency**, pick the organization, **Submit to Fire Agency**. | Toast "Submitted"; the organization is listed under the picker with a submit date and is removed from the picker. In-state organizations are listed first. |
| VER-02 | Submission is not public | After VER-01, open `/assessment/<id>` signed in as an unrelated third account, and query the assessment while signed out. | Not found / no access. An agency submission does not create a public share link. |
| VER-03 | Inspector sees the dashboard | Sign in as the inspector. | An **Inspections** nav item appears (hidden for accounts with no organization). The dashboard lists the submitted assessment with address, progress and submit date. |
| VER-04 | Read-only review | Open the assessment from Inspections. | Report renders with a "Reviewing for <org>" chip; no Share/Edit, no map/AR shortcuts, no owner status buttons. |
| VER-05 | Verify a completed item | On an item the owner marked **Done**, tap **Verify**, add an optional note, **Confirm verification**. | Toast "Verified"; the item shows the Verified badge, "Verified <date> by <org>", and the inspector note. Items not marked Done have no Verify button. |
| VER-06 | Owner sees the verification | As the homeowner, reload the report (online), then go offline and reload. | The item shows Verified by <org> with the note, and its controls are locked. Still verified offline. |
| VER-07 | Owner edit raced by a verification | As the homeowner, go offline, change the note on a Done item, then (as the inspector, online) verify that item; bring the homeowner back online. | The homeowner's queued edit is dropped, not left as a failed operation; the item shows Verified. |
| VER-08 | Revoke | As the inspector, on an item your org verified, **Revoke verification** → confirm. | The item returns to Done; verification fields clear; the owner can edit it again. |
| VER-09 | Viewer role | Sign in as a **viewer** member of the org and open the submission. | Read-only review; no Verify/Revoke buttons. |
| VER-10 | Own property | As an inspector, submit **your own** assessment to your org and try to verify one of its Done items. | Error toast: "You cannot verify mitigation on your own property". |
| VER-11 | Offline inspector | As the inspector, go offline on a review. | Verify/Revoke are disabled with a "Connect to the internet to verify" hint. |
| VER-12 | Withdraw | As the homeowner, Share → Agency → **Withdraw**. | The submission disappears; the inspector can no longer open the assessment. |

---

## 13b. Agency dashboard

Same setup as 13a. Use at least two submitted assessments from different homeowners, one with a property location and one without.

| ID | Test | Steps | Expected |
|---|---|---|---|
| AGY-01 | Rollups | Open **Inspections** as the inspector. | Tiles show the property count (with new / in-review counts), % of mitigations done (*x of y*), verified, awaiting verification, and immediate outstanding. The numbers match the individual reports' progress bars. |
| AGY-02 | Map | Look at the map. | One point per located property, coloured by progress (red not started, amber under way, blue all done, green all verified); the map fits the points. Hover shows address and *done/total*. A note counts properties with no location. Works in dark mode. |
| AGY-03 | Map click-through | Click a point. | Opens that assessment's read-only review. |
| AGY-04 | Progress filter | Tap a progress chip (e.g. **Under way**). | The map and the list both show only properties in that band; the counts on the chips match. |
| AGY-05 | Review status | As the inspector, **Start review** on a new submission, then **Close**, then **Reopen**. | The status pill updates each time (New → In review → Closed → In review); the status filter counts update. Survives a reload. |
| AGY-06 | Viewer role | Open the dashboard as a **viewer**. | Same rollups, map and list; no status buttons. |
| AGY-07 | Progress reflects verification | Verify an item on one property (VER-05), then return to the dashboard. | Verified +1 and awaiting verification −1; that property's colour changes when all of its items are verified. |
| AGY-08 | Multiple organizations | Use an account in two organizations. | An organization picker appears; switching reloads the rollups, map and list for that organization only. |
| AGY-09 | Offline | Go offline on the dashboard. | An offline notice shows; status buttons are disabled. |

---

## 13c. Reports & exports

| ID | Test | Steps | Expected |
|---|---|---|---|
| EXP-01 | Homeowner PDF | On your own report, tap **Print / Save as PDF** (or Share → **Print / Save as PDF**) and save as PDF. | The PDF has a masthead with the generation date, the address, score, findings, recommendations with their status (as badges, not buttons), notes and photos, including photos below the fold. No sidebar, top bar, buttons or toasts. |
| EXP-02 | PDF in dark mode | Switch to dark mode, then print. | The PDF is the light theme (readable dark text); the app returns to dark mode after the dialog closes. |
| EXP-03 | Shared and reviewer PDF | Print from a `/report/:token` link and from an inspector's review. | Same clean report; no owner-only controls. |
| EXP-04 | Properties CSV | On the agency dashboard, **Properties (CSV)**; open in Excel/Sheets. | One row per submitted property (all of them, regardless of filters); addresses with commas stay in one cell; accented characters display correctly; negative longitudes are numbers. |
| EXP-05 | Mitigation actions CSV | **Mitigation actions (CSV)**. | One row per recommendation per property with status, completed/verified dates, the verifying organization and the note. Untouched items show `not_started`. Disabled while offline. |
| EXP-06 | Formula safety | As a homeowner, put `=1+1` in a mitigation note; export the actions CSV as the inspector and open it in Excel. | The cell shows the text `'=1+1` / `=1+1` as text, not `2`. |
| EXP-07 | GeoJSON | **Map points (GeoJSON)**; load it in QGIS or geojson.io. | Points land on the properties; attributes match the properties CSV; properties without a location are absent. |
| EXP-08 | Dashboard PDF | **Print / Save as PDF** on the dashboard. | Masthead with the organization and date, tiles, the map (not blank), and the list; no filter chips, export buttons or status buttons. |

---

## 13d. Fire exposure

Needs a submitted property whose location is inside or within 1 km of a 2026 wildfire perimeter. Set the property's coordinates on a known fire (e.g. from the NIFC WFIGS map) if no real one is affected. Also have one property far from any fire.

| ID | Test | Steps | Expected |
|---|---|---|---|
| FIRE-01 | Run the check | As an inspector, on the agency dashboard's **Fire exposure** card, **Check against fire perimeters**. | The button shows *Checking n/N* progress, then a toast. The exposed property is listed as **Inside** or **Within 1 km** with the fire's name, discovery date and acres. The far property is not listed. |
| FIRE-02 | Snapshot at fire start | For the exposed property, compare *At fire start: d/t done, v verified* with the items' completed/verified dates. | Only items done (or verified) before the fire's discovery date count. |
| FIRE-03 | No backdating | After FIRE-01, mark another item on that property Done and run the check again. | The snapshot does not change. Only the relation can upgrade (near → inside). |
| FIRE-04 | Tiles | Look at the four tiles. | Properties exposed / reached / fully done / fully verified at fire start match the list. |
| FIRE-05 | Viewer and owner | Open the dashboard as a **viewer**; also check the owner can't see other owners' exposures. | The viewer sees recorded exposures but no check button. |
| FIRE-06 | Exposures CSV | **Exposures (CSV)**. | One row per property and fire, with address, fire, discovery date, relation and the at-start counts. |
| FIRE-07 | Offline / service down | Go offline (or block arcgis.com) and run the check. | The button is disabled offline. If the service fails mid-check, the failures are counted with a "run the check again" note; recorded hits are kept. |

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
