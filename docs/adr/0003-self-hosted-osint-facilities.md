# ADR 0003: Self-Hosted OSINT Emergency Facilities Architecture

## Status
Accepted

## Context
The EOA Global system historically relied on the public Overpass API (`https://overpass-api.de/api/interpreter`) to dynamically query emergency facilities (hospitals, clinics, police stations, fire stations, pharmacies, civil defense stations) within a 5 km operational incident radius.

In an EOC/PSAP mission-critical context, public Overpass introduces fatal vulnerabilities:
1. **Unpredictable Latency & Throttling**: Overpass servers enforce strict rate limits (HTTP 429), memory limits, and slot throttling during peak load.
2. **Operational Opacity & WAN Failure**: In an air-gapped sovereign EOC or under communications disruption, external WAN routing is disabled, leaving dispatchers blind to nearby emergency infrastructure.
3. **Data Freshness and Auditability**: No deterministic SLA or local audit trail for facility data updates.

## Decision

We replace external Overpass queries with a fully self-hosted, sovereign spatial facilities subsystem running on the local PostgreSQL 16 + PostGIS 3.4 container.

### 1. Ingestion Pipeline & Flex Lua Filter
OSM PBF data (Geofabrik extract) is ingested using `osm2pgsql` in flex mode via a dedicated `facilities.lua` profile. Ingestion filters strictly to critical emergency facility types:
- **Medical**: `amenity IN ('hospital', 'clinic', 'doctors', 'pharmacy')`
- **Fire & Rescue**: `amenity = 'fire_station'`, `emergency = 'fire_hydrant'` (optional high-density filter)
- **Law Enforcement**: `amenity = 'police'`
- **Civil Defense & Humanitarian**: `emergency IN ('ambulance_station', 'disaster_help_point', 'shelter')`, `amenity = 'shelter'`
- **Arabic / English Bilingual Normalization**: Extracts `name`, `name:ar`, and `name:en` into dedicated columns, falling back to `name`.

### 2. PostGIS Schema & Indexing Strategy
To avoid schema locks and ensure idempotent zero-downtime updates:
- **Table Structure**:
  ```sql
  CREATE TABLE IF NOT EXISTS osm_facilities (
      id BIGSERIAL PRIMARY KEY,
      osm_id BIGINT NOT NULL,
      osm_type CHAR(1) NOT NULL, -- 'N' (Node), 'W' (Way), 'R' (Relation)
      facility_type VARCHAR(50) NOT NULL, -- 'hospital', 'fire_station', etc.
      name TEXT,
      name_ar TEXT,
      name_en TEXT,
      operator TEXT,
      phone TEXT,
      emergency_services JSONB,
      geom GEOMETRY(Point, 4326) NOT NULL,
      last_osm_timestamp TIMESTAMPTZ,
      imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ```
- **Indexes**:
  - Spatial GiST Index: `CREATE INDEX idx_osm_facilities_geom ON osm_facilities USING GIST (geom);`
  - B-tree Index on OSM ID: `CREATE UNIQUE INDEX idx_osm_facilities_osm_id_type ON osm_facilities (osm_id, osm_type);`
  - Facility Type Index: `CREATE INDEX idx_osm_facilities_type ON osm_facilities (facility_type);`

- **Re-import / Versioning Strategy**:
  Full re-imports run into a staging table (`osm_facilities_staging`), followed by atomic rename within a single transaction (`BEGIN; DROP TABLE IF EXISTS osm_facilities_old; ALTER TABLE osm_facilities RENAME TO osm_facilities_old; ALTER TABLE osm_facilities_staging RENAME TO osm_facilities; COMMIT;`), ensuring zero query disruption.

### 3. Incremental Replication & Freshness Tracking
- **Replication Worker**: Scheduled cron or continuous sidecar container executing `osm2pgsql-replication update` with state tracking.
- **Freshness Metric**: The database maintains `osm_replication_status(last_applied_timestamp, last_sequence_number)`. Every API response delivers `data_freshness: ISO8601` in its metadata envelope.

### 4. API Query Contract & Boundary Guard
Endpoint: `GET /api/v1/osint/facilities`
Parameters:
- `lat` (float, required): Latitude of incident epicenter.
- `lon` (float, required): Longitude of incident epicenter.
- `radius_km` (float, default 5.0, max 25.0): Search radius.
- `types` (string list, optional): Comma-separated facility filter.

#### SQL Execution:
```sql
SELECT 
    osm_id, facility_type, name, name_ar, name_en, operator, phone,
    ST_AsGeoJSON(geom)::json AS geometry,
    ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography) AS distance_meters
FROM osm_facilities
WHERE ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography, :radius_meters)
  AND (:types IS NULL OR facility_type = ANY(:types_array))
ORDER BY geom <-> ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)
LIMIT 50;
```

#### Boundary Guard & Out-of-Coverage Contract:
If coordinates fall outside `config/coverage.json`:
- Returns **HTTP 200** (NOT 400/404) with structured JSON payload:
```json
{
  "type": "FeatureCollection",
  "code": "OUT_OF_COVERAGE",
  "message": "Incident coordinates fall outside high-detail operational coverage area.",
  "features": [],
  "meta": {
    "data_freshness": "2026-10-28T04:00:00Z",
    "coverage_region": "levant-operational-core",
    "query": { "lat": 40.7128, "lon": -74.0060, "radius_km": 5.0 }
  }
}
```

### 5. Caching Layer
Redis cache key: `facilities:{round(lat, 3)}:{round(lon, 3)}:{radius_km}:{hash(types)}`
TTL: 300 seconds (5 minutes). Stored as compressed GeoJSON.

## Consequences
- Positive: Zero external internet dependency; deterministic sub-15ms local query latency; multi-tenant spatial query isolation.
- Negative: Requires initial ~120MB PBF download and PostGIS disk footprint (~45MB for Levant extract).
