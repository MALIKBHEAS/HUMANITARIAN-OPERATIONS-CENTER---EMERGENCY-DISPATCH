import math
import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Float
from geoalchemy2 import Geography
from geoalchemy2.elements import WKTElement
from langchain_core.tools import tool

from database import SessionLocal
from models import Hospital, PoliceStation

logger = logging.getLogger("spatial_skills")

def estimate_eta_minutes(distance_km: float, average_speed_kmh: float = 65.0) -> int:
    """Estimates vehicle transit time in minutes given distance in kilometers."""
    if distance_km <= 0:
        return 2
    return max(2, int(round((distance_km / average_speed_kmh) * 60)))

def haversine_fallback(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance fallback in kilometers for non-PostGIS local testing."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)

def get_nearest_hospitals(lat: float, lon: float, min_beds: int = 1, radius_km: int = 15) -> List[Dict[str, Any]]:
    """
    Queries PostGIS to find all hospitals within radius_km having at least min_beds available.
    Uses true spherical distance (WGS 84 SRID=4326 via ST_DWithin on Geography).
    
    Args:
        lat: Latitude of incident (-90.0 to 90.0)
        lon: Longitude of incident (-180.0 to 180.0)
        min_beds: Minimum required ICU beds
        radius_km: Search perimeter in kilometers (default 15 km)
    """
    db: Session = SessionLocal()
    try:
        # Global PostGIS Point: POINT(Longitude Latitude)
        point_wkt = WKTElement(f"POINT({lon} {lat})", srid=4326)
        radius_meters = float(radius_km * 1000)

        results = []
        try:
            # PostGIS true spherical query using ST_DWithin and ST_Distance on Geography
            hospitals_query = (
                db.query(
                    Hospital,
                    func.ST_Distance(
                        cast(Hospital.location, Geography),
                        cast(point_wkt, Geography)
                    ).label("distance_meters")
                )
                .filter(Hospital.icu_beds_available >= min_beds)
                .filter(
                    func.ST_DWithin(
                        cast(Hospital.location, Geography),
                        cast(point_wkt, Geography),
                        radius_meters
                    )
                )
                .order_by("distance_meters")
                .all()
            )

            for hospital, dist_meters in hospitals_query:
                dist_km = round(float(dist_meters) / 1000.0, 2)
                results.append({
                    "hospital_id": hospital.id,
                    "name": hospital.name,
                    "distance_km": dist_km,
                    "icu_beds_available": hospital.icu_beds_available,
                    "blood_units_available": hospital.blood_units_available,
                    "contact_info": hospital.contact_info,
                    "estimated_eta_minutes": estimate_eta_minutes(dist_km),
                    "coordinates": {
                        "lat": hospital.latitude,
                        "lon": hospital.longitude
                    }
                })
        except Exception as spatial_err:
            logger.warning(f"PostGIS spatial query fallback activated: {spatial_err}")
            candidates = db.query(Hospital).filter(Hospital.icu_beds_available >= min_beds).all()
            for h in candidates:
                dist_km = haversine_fallback(lat, lon, h.latitude, h.longitude)
                if dist_km <= radius_km:
                    results.append({
                        "hospital_id": h.id,
                        "name": h.name,
                        "distance_km": dist_km,
                        "icu_beds_available": h.icu_beds_available,
                        "blood_units_available": h.blood_units_available,
                        "contact_info": h.contact_info,
                        "estimated_eta_minutes": estimate_eta_minutes(dist_km),
                        "coordinates": {"lat": h.latitude, "lon": h.longitude}
                    })
            results.sort(key=lambda x: x["distance_km"])

        return results
    finally:
        db.close()

def get_nearest_police(lat: float, lon: float, radius_km: int = 15) -> List[Dict[str, Any]]:
    """
    Queries PostGIS to find all police stations within radius_km with active patrols available.
    Uses true spherical distance (WGS 84 SRID=4326 via ST_DWithin on Geography).
    
    Args:
        lat: Latitude of incident (-90.0 to 90.0)
        lon: Longitude of incident (-180.0 to 180.0)
        radius_km: Search perimeter in kilometers (default 15 km)
    """
    db: Session = SessionLocal()
    try:
        point_wkt = WKTElement(f"POINT({lon} {lat})", srid=4326)
        radius_meters = float(radius_km * 1000)

        results = []
        try:
            police_query = (
                db.query(
                    PoliceStation,
                    func.ST_Distance(
                        cast(PoliceStation.location, Geography),
                        cast(point_wkt, Geography)
                    ).label("distance_meters")
                )
                .filter(PoliceStation.patrols_available > 0)
                .filter(
                    func.ST_DWithin(
                        cast(PoliceStation.location, Geography),
                        cast(point_wkt, Geography),
                        radius_meters
                    )
                )
                .order_by("distance_meters")
                .all()
            )

            for station, dist_meters in police_query:
                dist_km = round(float(dist_meters) / 1000.0, 2)
                results.append({
                    "station_id": station.id,
                    "name": station.name,
                    "distance_km": dist_km,
                    "patrols_available": station.patrols_available,
                    "security_level": station.security_level,
                    "contact_info": station.contact_info,
                    "estimated_eta_minutes": estimate_eta_minutes(dist_km),
                    "coordinates": {
                        "lat": station.latitude,
                        "lon": station.longitude
                    }
                })
        except Exception as spatial_err:
            logger.warning(f"PostGIS spatial query fallback activated: {spatial_err}")
            candidates = db.query(PoliceStation).filter(PoliceStation.patrols_available > 0).all()
            for p in candidates:
                dist_km = haversine_fallback(lat, lon, p.latitude, p.longitude)
                if dist_km <= radius_km:
                    results.append({
                        "station_id": p.id,
                        "name": p.name,
                        "distance_km": dist_km,
                        "patrols_available": p.patrols_available,
                        "security_level": p.security_level,
                        "contact_info": p.contact_info,
                        "estimated_eta_minutes": estimate_eta_minutes(dist_km),
                        "coordinates": {"lat": p.latitude, "lon": p.longitude}
                    })
            results.sort(key=lambda x: x["distance_km"])

        return results
    finally:
        db.close()

# Export LangChain Tools
get_nearest_hospitals_tool = tool(get_nearest_hospitals)
get_nearest_police_tool = tool(get_nearest_police)

# Also attach LangChain invoke method to the base functions for polymorphic compatibility
get_nearest_hospitals.invoke = lambda kwargs: get_nearest_hospitals(**kwargs)
get_nearest_police.invoke = lambda kwargs: get_nearest_police(**kwargs)
