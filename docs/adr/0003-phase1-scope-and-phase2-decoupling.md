# ADR 0003: Phase 1 Scope Boundary and Phase 2 Scheduled Network Decoupling

## Status
Accepted

## Context
Phase 1 of the EOA Global production transition achieves complete air-gap readiness for the core map rendering stack: basemap vector tiles, styling, font glyphs, UI typography, and Arabic bi-directional text shaping.

To avoid breaking operational dispatch capability during this incremental refactoring phase, the existing dynamic facility discovery (hospitals, emergency points of interest) and street routing services are maintained using clean, direct `fetch()` calls behind an explicit feature flag (`VITE_FEATURE_TEMP_PUBLIC_OSINT=true`).

## Phase 1 Acceptance Scope (Strict Air-Gap)
Phase 1 acceptance strictly guarantees **zero external network requests** for all foundational map assets:
1. **Basemap Vector Tiles**: Served entirely from local PMTiles archive (`/tiles/basemap.pmtiles`) via HTTP 206 byte ranges.
2. **MapLibre Style Specification**: Self-hosted at `/styles/tactical-dark.json`.
3. **Glyphs / PBF Fonts**: Stored locally in `/fonts/glyphs/{fontstack}/{range}.pbf` covering ASCII, Latin, and Arabic character sets (`0-255.pbf`, `256-511.pbf`, `1536-1791.pbf`, `1792-2047.pbf`).
4. **UI Typography**: Hosted locally in `/fonts/` (`Cairo`, `Inter`, `JetBrains Mono`) with zero calls to Google Fonts.
5. **RTL Text Plugin**: Self-hosted standalone bundle at `/vendor/mapbox-gl-rtl-text.js` initialized via `maplibregl.setRTLTextPlugin()`.
6. **Leaflet & PouchDB Removal**: Complete excision of Leaflet, React-Leaflet, and Leaflet Routing Machine from dependencies.

## Scheduled Phase 2 Network Decoupling Inventory
The following three runtime external network endpoints are isolated and scheduled for full local replacement in Phase 2:

| External Service | Current Endpoint | Phase 1 Status | Phase 2 Production Replacement Plan |
| :--- | :--- | :--- | :--- |
| **Overpass API** | `https://overpass-api.de/api/interpreter` | Gated by `VITE_FEATURE_TEMP_PUBLIC_OSINT=true`; fallbacks to local offset coordinates if unreachable. | **Local PostGIS GiST Index**: Ingest OSM POI extract (hospitals, police stations, fire brigades) into PostgreSQL/PostGIS. Backend provides `/api/v1/spatial/facilities/nearest` query using `ST_DWithin` and `ST_Distance`. |
| **OSRM Public Routing** | `https://router.project-osrm.org/route/v1` | Gated by `VITE_FEATURE_TEMP_PUBLIC_OSINT=true`; fallbacks to calculated orthogonal polyline if offline. | **Self-Hosted Routing Engine**: Run local OSRM or Valhalla container in Docker Compose pre-built with Palestine/Levant routing graph. Backend or frontend queries local instance. |
| **Satellite Imagery** | `https://tiles.maps.eox.at/wmts/...` | EOX Sentinel-2 Cloudless (CC BY 4.0 verified, default) + optional commercial slot (`VITE_COMMERCIAL_SATELLITE_URL`). | **Local GeoTIFF/MBTiles Cache / Offline Tile Server**: Pre-tile or cache high-interest AOI satellite imagery locally into PMTiles raster or local MBTiles server for zero-WAN deployment. |

## Feature Flag Safeguards
The temporary external integrations are controlled by:
- `VITE_FEATURE_TEMP_PUBLIC_OSINT` (Default: `true` in dev, `false` in strict air-gap test mode).
When disabled or when the network is absent, the system degrades gracefully to simulated spatial routing using local geometric algorithms without throwing runtime uncaught exceptions or halting the dispatcher interface.
