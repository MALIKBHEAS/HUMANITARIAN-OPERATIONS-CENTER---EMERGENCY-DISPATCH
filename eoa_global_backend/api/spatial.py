"""
EOA Global - Sovereign Spatial Intelligence & Routing Module (Phase 2)
Provides self-hosted facility search (PostGIS), tenant-isolated road closures,
and offline vehicle routing via Valhalla.
"""

from __future__ import annotations

import json
import hashlib
import os
from pathlib import Path
from typing import Any, Dict, List, Optional
import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from eoa_global_backend.core.config import settings
from eoa_global_backend.core.broker import broker_manager
from eoa_global_backend.core.security import decode_access_token
from eoa_global_backend.db.database import get_db_session
from eoa_global_backend.api.dependencies import get_current_tenant, get_current_user
from eoa_global_backend.db.models import User

router = APIRouter(tags=["Sovereign Spatial & Routing"])

# ---------------------------------------------------------------------------
# Coverage Single Source of Truth Loader
# ---------------------------------------------------------------------------
COVERAGE_FILE = Path(__file__).resolve().parent.parent.parent / "config" / "coverage.json"

def get_coverage_bounds() -> Dict[str, Any]:
    """Loads canonical operational coverage bounding box from single source of truth."""
    if not COVERAGE_FILE.exists():
        # Default fallback to verified Israel/Palestine osmium bounds
        return {
            "min_lon": 33.999936,
            "min_lat": 29.439598,
            "max_lon": 35.915310,
            "max_lat": 33.454362,
            "region_id": "israel-and-palestine"
        }
    with open(COVERAGE_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
        return {
            "min_lon": data["bbox"]["min_lon"],
            "min_lat": data["bbox"]["min_lat"],
            "max_lon": data["bbox"]["max_lon"],
            "max_lat": data["bbox"]["max_lat"],
            "region_id": data.get("region_id", "israel-and-palestine")
        }

COVERAGE = get_coverage_bounds()

def is_point_in_coverage(lon: float, lat: float) -> bool:
    """Validates if coordinates fall within operational coverage area."""
    return (
        COVERAGE["min_lon"] <= lon <= COVERAGE["max_lon"]
        and COVERAGE["min_lat"] <= lat <= COVERAGE["max_lat"]
    )


# ---------------------------------------------------------------------------
# Pydantic Request / Response Models
# ---------------------------------------------------------------------------
class LatLonPoint(BaseModel):
    lat: float = Field(..., ge=-90.0, le=90.0)
    lon: float = Field(..., ge=-180.0, le=180.0)

class RouteDirectionsRequest(BaseModel):
    start: LatLonPoint
    destination: LatLonPoint
    traffic_factor: float = Field(0.85, ge=0.5, le=2.5, description="Operator multiplier for regular road vehicle baseline")
    hazard_avoidance: bool = Field(True, description="Avoid active tenant hazard / road closure zones")

class RoadClosureCreate(BaseModel):
    incident_id: Optional[str] = None
    reason: str = Field(..., min_length=3, max_length=255)
    closure_type: str = Field("polygon", description="polygon or circle")
    coordinates: List[List[float]] = Field(..., description="Array of [lon, lat] coordinates forming polygon ring")
    radius_meters: Optional[float] = Field(0.0, ge=0.0, le=5000.0)


# ---------------------------------------------------------------------------
# 1. OSINT Facilities Discovery (Replaces public Overpass)
# ---------------------------------------------------------------------------
@router.get(
    "/osint/facilities",
    summary="Query Emergency Facilities within Operational Radius (Self-Hosted PostGIS)",
    response_description="GeoJSON FeatureCollection with spatial distance and bilingual names",
)
async def get_emergency_facilities(
    lat: float = Query(..., ge=-90.0, le=90.0, description="Latitude of incident"),
    lon: float = Query(..., ge=-180.0, le=180.0, description="Longitude of incident"),
    radius_km: float = Query(5.0, ge=0.1, le=25.0, description="Search radius in kilometers"),
    types: Optional[str] = Query(None, description="Comma-separated facility types: hospital,clinic,fire_station,police,pharmacy,shelter"),
    db: AsyncSession = Depends(get_db_session),
):
    """
    Sovereign OSINT facility discovery using local PostGIS spatial index.
    Features:
    - Zero WAN dependency.
    - PostGIS ST_DWithin + KNN (<->) spatial ordering.
    - Bilingual English / Arabic names normalized from OSM.
    - Boundary guard returning HTTP 200 with OUT_OF_COVERAGE code when out of operational boundary.
    - Redis query cache (TTL: 300s).
    """
    # 1. Boundary Guard Check
    if not is_point_in_coverage(lon, lat):
        return {
            "type": "FeatureCollection",
            "code": "OUT_OF_COVERAGE",
            "message": "Incident coordinates fall outside operational coverage boundaries.",
            "features": [],
            "meta": {
                "coverage_region": COVERAGE["region_id"],
                "data_freshness": "2026-10-28T21:21:02Z",
                "total_count": 0
            }
        }

    # 2. Redis Cache Lookup
    type_list = [t.strip().lower() for t in types.split(",")] if types else []
    type_hash = hashlib.md5(",".join(sorted(type_list)).encode()).hexdigest()[:8]
    cache_key = f"facilities:{round(lat, 3)}:{round(lon, 3)}:{radius_km}:{type_hash}"

    try:
        cached_result = await broker_manager.get_cached_value(cache_key)
        if cached_result:
            return json.loads(cached_result)
    except Exception:
        pass

    # 3. Spatial PostGIS Query
    radius_meters = radius_km * 1000.0
    sql_query = text("""
        SELECT 
            osm_id,
            osm_type,
            facility_type,
            name,
            name_ar,
            name_en,
            operator,
            phone,
            ST_X(geom) AS lon,
            ST_Y(geom) AS lat,
            ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography) AS distance_meters
        FROM osm_facilities
        WHERE ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography, :radius_meters)
          AND (:has_types = FALSE OR facility_type = ANY(:types_array))
        ORDER BY geom <-> ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)
        LIMIT 100;
    """)

    params = {
        "lon": lon,
        "lat": lat,
        "radius_meters": radius_meters,
        "has_types": len(type_list) > 0,
        "types_array": type_list if type_list else ["all"]
    }

    result = await db.execute(sql_query, params)
    rows = result.fetchall()

    # 4. Replication Freshness Metadata
    freshness = "2026-10-28T21:21:02Z"
    try:
        freshness_res = await db.execute(text("SELECT osmosis_replication_timestamp FROM osm_replication_status ORDER BY id DESC LIMIT 1;"))
        f_val = freshness_res.scalar()
        if f_val:
            freshness = f_val.isoformat()
    except Exception:
        pass

    features = []
    for r in rows:
        display_name = r.name or r.name_en or r.name_ar or f"{r.facility_type.capitalize()} (OSM:{r.osm_id})"
        features.append({
            "type": "Feature",
            "id": f"{r.osm_type}:{r.osm_id}",
            "geometry": {
                "type": "Point",
                "coordinates": [float(r.lon), float(r.lat)]
            },
            "properties": {
                "osm_id": r.osm_id,
                "osm_type": r.osm_type,
                "facility_type": r.facility_type,
                "name": display_name,
                "name_ar": r.name_ar or display_name,
                "name_en": r.name_en or display_name,
                "operator": r.operator,
                "phone": r.phone,
                "distance_meters": round(float(r.distance_meters), 1),
                "distance_km": round(float(r.distance_meters) / 1000.0, 2)
            }
        })

    response_payload = {
        "type": "FeatureCollection",
        "code": "SUCCESS",
        "features": features,
        "meta": {
            "coverage_region": COVERAGE["region_id"],
            "data_freshness": freshness,
            "total_count": len(features),
            "search_radius_km": radius_km,
            "center": {"lat": lat, "lon": lon}
        }
    }

    # Cache for 300s
    try:
        await broker_manager.set_cached_value(cache_key, json.dumps(response_payload), ttl=300)
    except Exception:
        pass

    return response_payload


# ---------------------------------------------------------------------------
# 2. Tenant-Isolated Road Closures & Hazard Zones
# ---------------------------------------------------------------------------
@router.post(
    "/spatial/road-closures",
    summary="Create Tenant-Isolated Road Closure / Obstacle Polygon",
    status_code=status.HTTP_201_CREATED
)
async def create_road_closure(
    payload: RoadClosureCreate,
    current_tenant: str = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Registers an obstacle or perimeter zone with PostgreSQL RLS and strict tenant isolation.
    """
    coords = payload.coordinates
    if len(coords) < 3:
        raise HTTPException(status_code=400, detail="Polygon must contain at least 3 coordinate pairs.")

    # Ensure ring is closed
    if coords[0] != coords[-1]:
        coords.append(coords[0])

    wkt_coords = ", ".join([f"{pt[0]} {pt[1]}" for pt in coords])
    wkt_polygon = f"POLYGON(({wkt_coords}))"

    # Enforce RLS session context
    await db.execute(text("SET LOCAL app.current_tenant = :tenant_id;"), {"tenant_id": current_tenant})

    insert_sql = text("""
        INSERT INTO road_closures (tenant_id, incident_id, reason, closure_type, geom, radius_meters, is_active)
        VALUES (:tenant_id, :incident_id, :reason, :closure_type, ST_GeomFromText(:wkt, 4326), :radius_meters, true)
        RETURNING id, tenant_id, incident_id, reason, closure_type, is_active, created_at;
    """)

    result = await db.execute(insert_sql, {
        "tenant_id": current_tenant,
        "incident_id": payload.incident_id,
        "reason": payload.reason,
        "closure_type": payload.closure_type,
        "wkt": wkt_polygon,
        "radius_meters": payload.radius_meters or 0.0
    })
    await db.commit()
    row = result.fetchone()

    return {
        "id": row.id,
        "tenant_id": row.tenant_id,
        "incident_id": row.incident_id,
        "reason": row.reason,
        "closure_type": row.closure_type,
        "is_active": row.is_active,
        "created_at": row.created_at.isoformat()
    }


@router.get(
    "/spatial/road-closures",
    summary="List Active Road Closures for Current Tenant (RLS Enforced)"
)
async def list_road_closures(
    current_tenant: str = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Retrieves active closures restricted strictly to the caller's tenant.
    """
    # Enforce RLS session context
    await db.execute(text("SET LOCAL app.current_tenant = :tenant_id;"), {"tenant_id": current_tenant})

    query_sql = text("""
        SELECT id, tenant_id, incident_id, reason, closure_type, ST_AsGeoJSON(geom) AS geom_json, radius_meters, created_at
        FROM road_closures
        WHERE is_active = true AND tenant_id = :tenant_id
        ORDER BY created_at DESC;
    """)
    result = await db.execute(query_sql, {"tenant_id": current_tenant})
    rows = result.fetchall()

    closures = []
    for r in rows:
        closures.append({
            "id": r.id,
            "tenant_id": r.tenant_id,
            "incident_id": r.incident_id,
            "reason": r.reason,
            "closure_type": r.closure_type,
            "geometry": json.loads(r.geom_json),
            "radius_meters": r.radius_meters,
            "created_at": r.created_at.isoformat()
        })

    return {"tenant_id": current_tenant, "closures": closures}


# ---------------------------------------------------------------------------
# Optional Tenant Resolver for Spatial Routing
# ---------------------------------------------------------------------------
async def get_optional_tenant(
    authorization: Optional[str] = Header(None)
) -> Optional[str]:
    """Resolves tenant ID if caller provides valid JWT, otherwise returns None for unauthenticated access."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split("Bearer ", 1)[1].strip()
    try:
        payload = decode_access_token(token)
        return payload.get("tenant_id")
    except Exception:
        return None


# ---------------------------------------------------------------------------
# 3. Sovereign Vehicle Routing via Valhalla (Profile "auto" + traffic_factor)
# ---------------------------------------------------------------------------
VALHALLA_HOST = os.getenv("VALHALLA_HOST", "eoa-valhalla-router")
VALHALLA_URL = f"http://{VALHALLA_HOST}:8002/route"

@router.post(
    "/routing/directions",
    summary="Compute Sovereign Route with Dynamic Obstacle Avoidance (Valhalla)",
)
async def compute_routing_directions(
    payload: RouteDirectionsRequest,
    current_tenant: Optional[str] = Depends(get_optional_tenant),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Computes vehicle route using self-hosted Valhalla container.
    Enforces:
    1. Operational coverage check: returns HTTP 200 with OUT_OF_COVERAGE if points are outside.
    2. Dynamic hazard avoidance: injects tenant's active road closure polygons into Valhalla exclude_polygons.
    3. Profile auto + operator traffic_factor: strictly labeled as estimated regular vehicle baseline.
    """
    # 1. Operational Coverage Guard
    if not is_point_in_coverage(payload.start.lon, payload.start.lat) or not is_point_in_coverage(payload.destination.lon, payload.destination.lat):
        return {
            "code": "OUT_OF_COVERAGE",
            "message": "Start or destination coordinates fall outside operational coverage boundaries.",
            "routes": [],
            "meta": {
                "coverage_region": COVERAGE["region_id"]
            }
        }

    # 2. Query Active Tenant Closures for Polygon Avoidance
    exclude_polygons = []
    if payload.hazard_avoidance and current_tenant:
        await db.execute(text("SET LOCAL app.current_tenant = :tenant_id;"), {"tenant_id": current_tenant})
        closure_res = await db.execute(
            text("SELECT ST_AsGeoJSON(geom) AS geom_json FROM road_closures WHERE tenant_id = :tenant_id AND is_active = true LIMIT 25;"),
            {"tenant_id": current_tenant}
        )
        for c in closure_res.fetchall():
            try:
                g = json.loads(c.geom_json)
                if g.get("type") == "Polygon" and g.get("coordinates"):
                    ring = g["coordinates"][0][:32]  # Cap at 32 vertices
                    exclude_polygons.append(ring)
            except Exception:
                continue

    # 3. Build Valhalla Payload
    valhalla_body: Dict[str, Any] = {
        "locations": [
            {"lat": payload.start.lat, "lon": payload.start.lon},
            {"lat": payload.destination.lat, "lon": payload.destination.lon}
        ],
        "costing": "auto",
        "directions_options": {
            "units": "kilometers",
            "language": "ar-XA"
        }
    }

    if exclude_polygons:
        valhalla_body["costing_options"] = {
            "auto": {
                "exclude_polygons": exclude_polygons
            }
        }

    # 4. Call Local Valhalla Service
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(VALHALLA_URL, json=valhalla_body)
            if resp.status_code != 200:
                raise HTTPException(status_code=502, detail=f"Valhalla routing engine returned status {resp.status_code}: {resp.text}")
            valhalla_data = resp.json()
    except httpx.ConnectError:
        raise HTTPException(
            status_code=503,
            detail="Valhalla routing service is currently unreachable on internal network."
        )

    # 5. Extract and Format Route with Mandatory Operator Disclaimers
    trip = valhalla_data.get("trip", {})
    summary = trip.get("summary", {})
    legs = trip.get("legs", [])

    time_regular_sec = summary.get("time", 0)
    adjusted_time_sec = round(time_regular_sec * payload.traffic_factor)
    distance_km = summary.get("length", 0.0)

    # Decode Polyline6 or return leg shape
    shape_str = legs[0].get("shape") if legs else None

    return {
        "code": "SUCCESS",
        "routes": [
            {
                "distance_km": round(distance_km, 2),
                "distance_meters": round(distance_km * 1000.0, 1),
                "eta_regular_vehicle_seconds": round(time_regular_sec),
                "eta_adjusted_seconds": adjusted_time_sec,
                "eta_label": "estimated, regular vehicle with traffic_factor",
                "traffic_factor_applied": payload.traffic_factor,
                "operator_notice": "ETA is estimated for a standard road vehicle with operator traffic factor. Does not simulate priority traffic preemption or emergency signal overrides.",
                "geometry_encoded": shape_str,
                "legs": legs
            }
        ],
        "meta": {
            "engine": "valhalla-3.4.0-sovereign",
            "routing_profile": "auto",
            "hazard_polygons_avoided": len(exclude_polygons),
            "coverage_region": COVERAGE["region_id"]
        }
    }
