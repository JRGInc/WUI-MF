# Software Bill of Materials (SBOM)

Project: **wildfire-risk-assessment** (WUI-MF) · version 1.0.0
Generated: 2026-07-11 · Format: human-readable (direct dependencies)

This lists the **direct** dependencies declared in `package.json` with their
installed versions and licenses. The full resolved tree is ~471 packages; for a
machine-readable transitive SBOM, generate CycloneDX with
`npx @cyclonedx/cyclonedx-npm --output-file docs/sbom.cdx.json`.

## Runtime (production) dependencies

| Package | Version | License | Purpose |
| --- | --- | --- | --- |
| react | 18.3.1 | MIT | UI framework |
| react-dom | 18.3.1 | MIT | React DOM renderer |
| react-router-dom | 6.30.4 | MIT | Routing |
| zustand | 4.5.7 | MIT | State store |
| @headlessui/react | 2.2.10 | MIT | Accessible UI primitives (modals, menus) |
| @heroicons/react | 2.2.0 | MIT | Icon set |
| framer-motion | 11.18.2 | MIT | Animations |
| mapbox-gl | 3.25.0 | **Mapbox TOS (proprietary)** | Interactive map rendering |
| @mapbox/mapbox-gl-geocoder | 5.1.2 | ISC | Address geocoding control |
| @mapbox/vector-tile | 3.0.0 | BSD-3-Clause | Decode Mapbox vector tiles (off-map building footprints for AR) |
| pbf | 5.1.2 | BSD-3-Clause | Protocol-buffer decoder (pairs with @mapbox/vector-tile) |
| @turf/buffer | 7.3.5 | MIT | Buffer building footprints into defensible-space zones |
| three | 0.166.1 | MIT | 3D / WebXR / AR rendering |
| @tensorflow/tfjs | 4.22.0 | Apache-2.0 | On-device computer-vision inference |
| @supabase/supabase-js | 2.108.2 | MIT | Supabase client (auth, Postgres, Storage) |
| dexie | 4.4.4 | Apache-2.0 | IndexedDB wrapper (offline store) |
| dexie-react-hooks | 1.1.7 | Apache-2.0 | React bindings for Dexie |
| uuid | 10.0.0 | MIT | ID generation |

## Development / build dependencies

| Package | Version | License |
| --- | --- | --- |
| typescript | 5.9.3 | Apache-2.0 |
| vite | 8.0.16 | MIT |
| @vitejs/plugin-react | 6.0.2 | MIT |
| vite-plugin-pwa | 1.3.0 | MIT |
| workbox-window | 7.4.1 | MIT |
| tailwindcss | 3.4.19 | MIT |
| postcss | 8.5.15 | MIT |
| autoprefixer | 10.5.0 | MIT |
| eslint | 8.57.1 | MIT |
| @typescript-eslint/eslint-plugin | 7.18.0 | MIT |
| @typescript-eslint/parser | 7.18.0 | BSD-2-Clause |
| eslint-plugin-react-hooks | 4.6.2 | MIT |
| eslint-plugin-react-refresh | 0.4.26 | MIT |
| vitest | 4.1.9 | MIT |
| @playwright/test | 1.61.0 | Apache-2.0 |
| @types/node | 20.19.43 | MIT |
| @types/react | 18.3.31 | MIT |
| @types/react-dom | 18.3.7 | MIT |
| @types/three | 0.166.0 | MIT |
| @types/mapbox-gl | 3.4.1 | MIT |
| @types/uuid | 10.0.0 | MIT |
| @types/webxr | 0.5.24 | MIT |

## Licensing notes

- The vast majority of dependencies are permissively licensed (MIT / Apache-2.0
  / BSD / ISC).
- **`mapbox-gl` (v3) is NOT open source** — it is governed by the Mapbox Terms
  of Service and billed per map load against the `VITE_MAPBOX_TOKEN`. This is
  the one dependency with commercial terms; review Mapbox pricing/ToS before
  distribution.
- `npm audit` reports advisories that are predominantly in dev tooling. Do **not**
  run `npm audit fix --force` — it breaks the PWA build (see project notes).

## External runtime services & data sources

Not npm packages, but "materials" the app depends on at runtime. All data
sources below are free and public-domain / open unless noted.

| Service / dataset | Used for | Terms |
| --- | --- | --- |
| Mapbox (tiles, Geocoding, Vector Tiles) | Base map, address search, building footprints | Mapbox ToS (token, billed) |
| Supabase | Auth, Postgres (RLS), Storage | Your Supabase plan |
| CAL FIRE (FRAP) FeatureServer | Fire History in California | Public / open data |
| NIFC InterAgencyFirePerimeterHistory | Fire History nationally | Public / open data |
| LANDFIRE WMS (USGS/USFS) | Vegetation / fuel raster | Public domain |
| USGS 3DEP ImageServer | Slope analysis raster | Public domain |
