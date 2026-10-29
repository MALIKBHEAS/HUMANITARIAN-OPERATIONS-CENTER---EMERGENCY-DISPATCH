import math
from typing import Dict, Any, List, Optional
from datetime import datetime
from database import SessionLocal
from models import Incident, Hospital, PoliceStation, Dispatch, IncidentStatus

def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points on the Earth in kilometers."""
    R = 6371.0  # Earth's radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)

def estimate_eta_minutes(distance_km: float, average_speed_kmh: float = 60.0) -> int:
    """Estimate ETA in minutes assuming urban response average speed."""
    if distance_km <= 0:
        return 2
    hours = distance_km / average_speed_kmh
    return max(2, int(round(hours * 60)))

def get_incident_details(incident_id: int) -> Dict[str, Any]:
    """Skill 1: Fetches the location, type, and severity of the incident."""
    db = SessionLocal()
    try:
        incident = db.query(Incident).filter(Incident.id == incident_id).first()
        if not incident:
            return {
                "status": "error",
                "message": f"Incident with ID {incident_id} not found."
            }
        
        return {
            "status": "success",
            "incident_id": incident.id,
            "type": incident.type.value if hasattr(incident.type, 'value') else str(incident.type),
            "severity_level": incident.severity_level,
            "status_label": incident.status.value if hasattr(incident.status, 'value') else str(incident.status),
            "location": {
                "lat": incident.location_lat,
                "lon": incident.location_lon
            },
            "dispatches_count": len(incident.dispatches)
        }
    finally:
        db.close()

def find_nearest_hospitals(lat: float, lon: float, required_beds: int = 1, max_radius_km: float = 10.0) -> Dict[str, Any]:
    """Skill 2: Queries DB for hospitals within radius that have available ICU beds."""
    db = SessionLocal()
    try:
        hospitals = db.query(Hospital).filter(Hospital.icu_beds_available >= required_beds).all()
        results = []
        for h in hospitals:
            dist = haversine_distance_km(lat, lon, h.location_lat, h.location_lon)
            if dist <= max_radius_km:
                results.append({
                    "hospital_id": h.id,
                    "name": h.name,
                    "distance_km": dist,
                    "icu_beds_available": h.icu_beds_available,
                    "blood_units_available": h.blood_units_available,
                    "contact_info": h.contact_info,
                    "estimated_eta_minutes": estimate_eta_minutes(dist),
                    "coordinates": {"lat": h.location_lat, "lon": h.location_lon}
                })
        
        # Sort by distance
        results.sort(key=lambda x: x["distance_km"])
        
        return {
            "status": "success",
            "search_radius_km": max_radius_km,
            "required_beds": required_beds,
            "found_count": len(results),
            "hospitals": results
        }
    finally:
        db.close()

def find_nearest_police(lat: float, lon: float, max_radius_km: float = 15.0) -> Dict[str, Any]:
    """Skill 3: Queries available police stations and active patrols."""
    db = SessionLocal()
    try:
        stations = db.query(PoliceStation).filter(PoliceStation.patrols_available > 0).all()
        results = []
        for p in stations:
            dist = haversine_distance_km(lat, lon, p.location_lat, p.location_lon)
            if dist <= max_radius_km:
                results.append({
                    "station_id": p.id,
                    "name": p.name,
                    "distance_km": dist,
                    "patrols_available": p.patrols_available,
                    "security_level": p.security_level,
                    "contact_info": p.contact_info,
                    "estimated_eta_minutes": estimate_eta_minutes(dist),
                    "coordinates": {"lat": p.location_lat, "lon": p.location_lon}
                })
        
        results.sort(key=lambda x: x["distance_km"])
        
        return {
            "status": "success",
            "search_radius_km": max_radius_km,
            "found_count": len(results),
            "police_stations": results
        }
    finally:
        db.close()

def dispatch_resource(institution_id: int, incident_id: int, resource_type: str, eta_minutes: Optional[int] = None) -> Dict[str, Any]:
    """Skill 4: Executes the actual dispatch command and updates the DB."""
    db = SessionLocal()
    try:
        incident = db.query(Incident).filter(Incident.id == incident_id).first()
        if not incident:
            return {"status": "error", "message": f"Incident {incident_id} not found."}

        # Check hospital or police station
        hospital = db.query(Hospital).filter(Hospital.id == institution_id).first()
        police = db.query(PoliceStation).filter(PoliceStation.id == institution_id).first()

        institution = hospital or police
        if not institution:
            return {"status": "error", "message": f"Institution {institution_id} not found."}

        # Deduct available resource safely
        if hospital:
            if "icu" in resource_type.lower() or "ambulance" in resource_type.lower():
                if hospital.icu_beds_available > 0:
                    hospital.icu_beds_available -= 1
        elif police:
            if police.patrols_available > 0:
                police.patrols_available -= 1

        if eta_minutes is None:
            dist = haversine_distance_km(incident.location_lat, incident.location_lon, institution.location_lat, institution.location_lon)
            eta_minutes = estimate_eta_minutes(dist)

        dispatch = Dispatch(
            institution_id=institution_id,
            incident_id=incident_id,
            resource_type=resource_type,
            eta_minutes=eta_minutes,
            timestamp=datetime.utcnow()
        )
        db.add(dispatch)

        # Update incident status to IN_PROGRESS
        incident.status = IncidentStatus.IN_PROGRESS
        db.commit()
        db.refresh(dispatch)

        return {
            "status": "success",
            "dispatch_id": dispatch.id,
            "incident_id": incident.id,
            "institution_id": institution.id,
            "institution_name": institution.name,
            "resource_type": resource_type,
            "eta_minutes": eta_minutes,
            "dispatched_at": dispatch.timestamp.isoformat()
        }
    except Exception as e:
        db.rollback()
        return {"status": "error", "message": str(e)}
    finally:
        db.close()

def request_manual_override(incident_id: Optional[int], reason: str, details: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Edge/Safety rule: Triggers manual override if payload fails validation or lacks geolocation."""
    return {
        "status": "manual_override_requested",
        "incident_id": incident_id,
        "reason": reason,
        "details": details or {},
        "timestamp": datetime.utcnow().isoformat(),
        "action_required": "HUMAN_OPERATOR_INTERVENTION"
    }
