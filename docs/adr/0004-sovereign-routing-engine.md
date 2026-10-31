# ADR 0004: Sovereign Routing Engine Architecture (Valhalla Integration)

## Status
Accepted

## Context
Emergency dispatch in EOA Global previously routed vehicles via the public demo endpoint `https://router.project-osrm.org/route/v1`. This created severe reliability risks: public server downtime, lack of air-gapped sovereignty, rate limits, and zero capability for dynamic tactical obstacle / hazard zone avoidance.

A sovereign EOC routing engine must operate locally in Docker Compose, execute routing queries in under 50ms, and support dynamic hazard avoidance (e.g. active shooter zones, gas leaks, road collapses).

## Decision

We adopt **Valhalla 3.4.0** (`ghcr.io/gis-ops/docker-valhalla/valhalla:3.4.0`) as the sovereign routing engine for EOA Global.

### 1. Engine Selection: Valhalla vs OSRM Justification
| Feature | Valhalla | OSRM | EOC Evaluation |
| :--- | :--- | :--- | :--- |
| **Dynamic Obstacle Avoidance** | Native support via `exclude_polygons` parameter on standard queries | Requires MLD rebuild or custom node penalties; Contraction Hierarchies (CH) cannot do dynamic exclusions | **Valhalla is mandatory** for real-time tactical hazard zone circumvention |
| **Memory Footprint** | Dynamic routing tiles loaded on demand (~150MB RAM for Levant) | Entire graph loaded in RAM (~500MB+ for Levant MLD) | Valhalla scales efficiently on single-node edge appliances |
| **Dynamic Costing Parameters** | Dynamic query-time costing options (speed limits, maneuver penalties) | Static lua profiles baked into graph build | Valhalla allows per-tenant / per-vehicle dynamic configuration |
| **Turn-by-Turn Bilingual Maneuvers** | Built-in localization support (Arabic `ar-XA`, English `en-US`) | Requires custom translation strings or OSRM-text-instructions | Native Arabic maneuver generation |

### 2. Vehicle Costing & ETA Realism (Mandatory Clarification)
**Valhalla has NO "emergency" costing profile.**
Emergency vehicles operate under privileged dispatch conditions (sirens, right-of-way, contraflow), which OSM graph data and Valhalla routing algorithms do not model.

To prevent dangerous operational misrepresentation:
1. **Routing Profile**: EOA uses the `auto` profile with a configurable `traffic_factor` operator multiplier (default `0.85` representing light traffic / partial siren priority).
2. **Naming & Operator Disclosure**:
   - The API response explicitly returns `eta_regular_vehicle_seconds` and `eta_adjusted_seconds`, alongside `traffic_factor_applied: 0.85`.
   - The UI tactical sidebar will display: *"Estimated Time: X min (Standard road vehicle baseline with operator factor 0.85. Does not simulate priority traffic preemption or signal overrides.)"*

### 3. Hazard Avoidance (`exclude_polygons`) & Service Limits
Valhalla supports geometric exclusion polygons via its `costing_options.auto.exclude_polygons` request array.

#### Operational Safety Bounds:
- **Maximum Exclusion Polygons**: Capped at **25 polygons** per route query.
- **Maximum Polygon Vertex Count**: Capped at **32 vertices** per polygon.
- **Closure Radius Cap**: Maximum hazard buffer radius is capped at **5.0 km** per incident to avoid complete routing graph disconnects.

#### Latency Impact Analysis (Empirical Benchmark Results from Tel Aviv -> Jerusalem 65.8 km Route):
- **Service Limits Parameter**: `max_exclude_polygons_length: 10000` (verified in `valhalla.json:202`).
- **0 Polygons**: p50 = 100.51 ms | p95 = 134.52 ms (initial cache load).
- **1 Hazard Polygon**: p50 = 65.23 ms | p95 = 77.64 ms.
- **10 Hazard Polygons**: p50 = 68.63 ms | p95 = 80.91 ms.
- **100 Hazard Polygons**: p50 = 65.16 ms | p95 = 89.51 ms.
- **Operational Recommendation**: Enforce application cap of 25 polygons and 32 vertices per polygon to prevent edge-case path starvation and maintain sub-80ms p95 latency.

### 4. Levant Operational & Cross-Border Routing Constraints
1. **Cross-Border Disconnects**: OpenStreetMap tags border checkpoints with `barrier=border_control`, `access=no`, or physical separation fences. Routes between Palestine/Israel, Jordan, and Lebanon cannot cross borders without custom access exemptions.
2. **Administrative Access**: Roads tagged with administrative vehicle restrictions (e.g., security checkpoints) are navigated using standard passenger car rules unless explicitly unflagged in routing parameters.

### 5. Boundary Guard & API Contract
Endpoint: `POST /api/v1/routing/directions`
Input:
```json
{
  "start": {"lat": 32.0853, "lon": 34.7818},
  "destination": {"lat": 32.0741, "lon": 34.7922},
  "traffic_factor": 0.85,
  "hazard_zones": [
    {
      "incident_id": "INC-8821",
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[34.785, 32.080], [34.788, 32.080], [34.788, 32.084], [34.785, 32.084], [34.785, 32.080]]]
      }
    }
  ]
}
```

#### Out-of-Coverage Contract:
If either start or destination falls outside the single source of truth (`config/coverage.json`):
- Returns **HTTP 200** with:
```json
{
  "code": "OUT_OF_COVERAGE",
  "message": "Start or destination coordinates fall outside the high-detail operational coverage area.",
  "routes": [],
  "meta": {
    "coverage_region": "levant-operational-core"
  }
}
```

## Consequences
- Positive: Self-hosted deterministic routing; dynamic polygon avoidance for incident hazard perimeters; offline turn-by-turn navigation with Arabic speech cues.
- Negative: Additional Valhalla container build step (~3-5 minutes on initial extract import) and ~150-300MB RAM.
