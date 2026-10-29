# ADR 0001: Adoption of MapLibre GL JS and Protomaps PMTiles for Air-Gapped Vector Basemaps

## Status
Accepted

## Context
The legacy emergency dashboard relied on Leaflet 1.9 with third-party raster tile servers:
1. Carto Dark (`basemaps.cartocdn.com`) — uncontracted free tier with usage quotas.
2. Stadia Maps (`tiles.stadiamaps.com`) — requires API keys and returns HTTP 401 without authentication.
3. Esri World Imagery (`server.arcgisonline.com`) — proprietary commercial imagery unlicensed for non-Esri production applications.
4. OpenStreetMap standard tiles (`tile.openstreetmap.org`) — violates OSM tile usage policy when used in production applications.

Furthermore, raster tiles make client-side styling, dynamic language switching (Arabic RTL vs. English LTR), and air-gapped hosting expensive and brittle. Running a traditional tile rendering stack (PostGIS + Mapnik / TileServer GL) in single-node emergency deployments introduces heavy operational overhead, RAM footprint, and moving parts.

## Decision
1. **Replace Leaflet with MapLibre GL JS**:
   - Native WebGL-accelerated vector rendering.
   - Dynamic client-side styling without re-downloading raster tiles.
   - Dynamic font and text shaping with bi-directional Arabic support via local `@mapbox/mapbox-gl-rtl-text`.

2. **Self-Host Basemaps via Protomaps PMTiles**:
   - Package vector tiles as a single static `.pmtiles` archive (`public/tiles/basemap.pmtiles`).
   - Serve directly from Nginx using standard HTTP Byte-Range requests (`Range: bytes=...`, HTTP 206 Partial Content).
   - Zero tile server daemon; zero database dependencies for base map display.
   - Target extract: Global low-zoom (z0–z6) + High-detail regional extract for Palestine/Levant (z7–z16).

3. **Complete Removal of Leaflet**:
   - Leaflet and Leaflet Routing Machine are completely removed from the production runtime.
   - Temporary public OSRM and Overpass lookups are maintained behind a feature flag (`VITE_FEATURE_TEMP_PUBLIC_OSINT=true`) using native `fetch()`, rendered directly as MapLibre GeoJSON line and symbol layers until Phase 2 delivers self-hosted PostGIS facility queries and OSRM/Valhalla containers.

4. **Temporary Phase 1 External Call Exemption**:
   - The following external calls remain temporarily during Phase 1 under feature flags and are explicitly scheduled for elimination in Phase 2:
     - Public Overpass API (`overpass-api.de`): scheduled for replacement by self-hosted PostGIS GiST-indexed OSM tables in Phase 2.
     - Public OSRM routing (`router.project-osrm.org`): scheduled for replacement by self-hosted OSRM/Valhalla container in Phase 2.
     - Optional commercial satellite provider: active only if licensed key is configured; Sentinel-2 Cloudless is the open default.

## Consequences
- **Positive**:
  - The map renders completely offline with external internet blocked.
  - Zero external tile requests at runtime.
  - Initial map load on LAN drops to under 2 seconds.
  - Arabic and English labels dynamically adapt to `i18n.language`.
- **Negative / Operational Needs**:
  - Regional PMTiles extracts must be bundled into deployment images or volume mounts.
  - Glyphs and RTL text plugins must be locally hosted and bundled.
