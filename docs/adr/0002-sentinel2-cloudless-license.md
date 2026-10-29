# ADR 0002: Sovereign Satellite Layer Licensing, Legal Audit, and Production Strategy

## Status
Accepted

## Context
Mission-critical Emergency Operations Centers (EOC) require aerial and satellite imagery to evaluate terrain, building density, roadblocks, and accessibility. 
Previous iterations referenced proprietary raster endpoints (such as Esri World Imagery) without commercial licensing, introducing severe operational and legal risks.

The EOA Global system is treated as a commercial public safety product. Consequently, zero uncontracted or non-commercial third-party imagery may be shipped in the production path.

## Official License Audit: EOX Sentinel-2 Cloudless
- **Data Source**: European Union Copernicus Sentinel-2 Programme.
- **Provider / Processor**: EOX IT Services GmbH, Vienna, Austria.
- **Official Source URLs**:
  - `https://cloudless.eox.at/`
  - `https://s2maps.eu/`
- **Retrieval Date**: October 29, 2026

### Verified License Terms
1. **Non-Commercial Use**:
   - Governed by the **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License (CC BY-NC-SA 4.0)**.
   - Permitted free of charge for non-commercial evaluation, academic research, and humanitarian use.
2. **Commercial Use**:
   - Utilizing EOX Sentinel-2 Cloudless within commercial systems (including monetized products, commercial government contracts, and enterprise operations) **requires the "EOX Commercial Attribution-RestrictedUse License"**.
   - Characteristics of EOX Commercial License: perpetual license grant, permits offline tile bundling and caching, prohibits sub-licensing, prohibits resale as a standalone competing tile service.
3. **Mandatory Attribution String**:
   > `"EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus Sentinel data [year])"`
   *(For web interfaces, the text must include active hyperlinks to `https://cloudless.eox.at` or `https://s2maps.eu`).*

### License Distribution Across Release Years
- **Historical 2016 Dataset**: Originally documented under CC BY 4.0 [UNVERIFIED: exact transition date between CC BY and CC BY-NC-SA across interim years 2017–2019 is not explicitly codified on the current single-page portal].
- **Current Production Mosaics**: The active multi-year and annual cloudless mosaics hosted on `cloudless.eox.at` are governed by CC BY-NC-SA 4.0 for open endpoints.
- **Year Pinning Decision**: **No release year is pinned in Phase 1.** EOA does not bundle or ship any pre-packaged EOX tiles in the production release.

## Source Data vs. Processed Mosaic Distinction
1. **Raw Copernicus Sentinel-2 Granules**:
   - Governed directly by the **Copernicus Open Access Policy** (Regulation (EU) No 1159/2013).
   - Commercial and non-commercial use is unconditionally free and permitted under EU law.
2. **EOX Cloudless Processed Product**:
   - The value-add atmospheric correction, cloud detection, sorting, and seamless blending algorithms performed by EOX constitute a proprietary derivative work governed by EOX's copyright and dual-licensing scheme.

## Architectural Decisions for EOA Global
1. **Zero Runtime EOX Ingestion in Production**:
   - No EOX-hosted tile service endpoints may be queried by default in production.
   - Direct remote EOX WMTS streaming is strictly gated behind the developer-only feature flag: `VITE_DEV_ONLY_REMOTE_EOX=true` (disabled by default).
2. **Production Satellite Options for Sovereign Deployments**:
   - **Option A (Commercial Provider Slot)**: Use licensed commercial satellite tile feeds via `VITE_COMMERCIAL_SATELLITE_URL` (MapTiler Satellite first, or Maxar/Planet feeds).
   - **Option B (EOX Enterprise Commercial License)**: Procure the perpetual *EOX Commercial Attribution-RestrictedUse License* to legally bundle pre-rendered offline PMTiles.
   - **Option C (Self-Built from Raw Copernicus Data)**: Ingest raw Level-2A bottom-of-atmosphere granules directly from the Copernicus Data Space Ecosystem (CDSE) and generate self-hosted raster PMTiles using GDAL and `go-pmtiles`.
3. **Tool Provenance**:
   - The slicing binary `tools/pmtiles.exe` (go-pmtiles v1.31.2 for Windows x86_64) is verified from its official release:
     - URL: `https://github.com/protomaps/go-pmtiles/releases/download/v1.31.2/go-pmtiles_1.31.2_windows_x86_64.zip`
     - SHA256: `5D6FE5B31E5626FE894C150456558100FAA0FF6B6346AF7A3158D503741D13DB`
