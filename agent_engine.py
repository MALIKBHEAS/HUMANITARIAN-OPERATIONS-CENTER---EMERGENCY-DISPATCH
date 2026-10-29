import math
from datetime import datetime
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from models import Incident, Hospital, PoliceStation, Dispatch, IncidentStatus

def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance between two geographic coordinates in kilometers."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)

def estimate_eta_minutes(distance_km: float, average_speed_kmh: float = 60.0) -> int:
    """Estimates ETA in minutes based on distance and average emergency vehicle speed."""
    if distance_km <= 0:
        return 2
    return max(2, int(round((distance_km / average_speed_kmh) * 60)))

async def run_eoa_agent(incident_data: Dict[str, Any], db_session: Session) -> Dict[str, Any]:
    """
    Autonomous Emergency Orchestrator Agent (EOA) execution engine.
    Executes the strict ReAct loop:
    Observation -> Thought -> Action -> Observation -> Thought -> Action -> Final Answer.
    """
    execution_trace = []
    
    incident_id = incident_data.get("incident_id")
    description = incident_data.get("description", "Emergency reported")
    inc_type = incident_data.get("type", "CRASH")
    severity = incident_data.get("severity_level", 3)
    required_beds = incident_data.get("required_beds", 1)
    
    # Geolocation resolution
    lat = incident_data.get("lat")
    lon = incident_data.get("lon")
    coords = incident_data.get("coordinates")
    if isinstance(coords, dict):
        if lat is None:
            lat = coords.get("lat")
        if lon is None:
            lon = coords.get("lon")

    # --- EDGE / NETWORK LAYER VALIDATION ---
    if lat is None or lon is None:
        override_result = {
            "status": "MANUAL_OVERRIDE",
            "incident_id": incident_id,
            "reason": "MISSING_GEOLOCATION: Geolocation coordinates missing from incident payload.",
            "timestamp": datetime.utcnow().isoformat(),
            "action_required": "HUMAN_OPERATOR_INTERVENTION"
        }
        return {
            "status": "MANUAL_OVERRIDE",
            "incident_id": incident_id,
            "incident_type": inc_type,
            "severity_level": severity,
            "incident_summary": description,
            "dispatches": [],
            "units_assigned": {},
            "response_time_eta_max_minutes": 0,
            "trace_log": [
                {"step": "OBSERVATION", "content": "Edge webhook payload missing lat/lon coordinates."},
                {"step": "THOUGHT", "content": "Cannot calculate Haversine distance without valid coordinates. Aborting automated dispatch."},
                {"step": "ACTION", "tool": "request_manual_override", "output": override_result}
            ]
        }

    # --- STEP 1: OBSERVATION 1 ---
    obs_1 = (
        f"Incoming payload: '{description}'. Incident ID: {incident_id}, Type: {inc_type}, "
        f"Severity: {severity}, Target: ({lat}, {lon}), Required ICU Beds: {required_beds}."
    )
    execution_trace.append({"step": "OBSERVATION_1", "content": obs_1})

    # --- STEP 2: THOUGHT 1 ---
    thought_1 = (
        f"Querying database for emergency resources within 15km of ({lat}, {lon}). "
        f"Searching for hospitals with at least {required_beds} ICU beds and police stations with active patrols."
    )
    execution_trace.append({"step": "THOUGHT_1", "content": thought_1})

    # --- STEP 3: ACTION 1 & 2 (Database Tool Queries) ---
    search_radius_km = 15.0

    # Query Hospitals
    candidate_hospitals = db_session.query(Hospital).filter(Hospital.icu_beds_available >= required_beds).all()
    # Fallback to any hospital with > 0 beds if none match required_beds
    if not candidate_hospitals:
        candidate_hospitals = db_session.query(Hospital).filter(Hospital.icu_beds_available > 0).all()

    hospitals_found = []
    for h in candidate_hospitals:
        dist = haversine_distance_km(lat, lon, h.location_lat, h.location_lon)
        if dist <= search_radius_km:
            hospitals_found.append({
                "hospital_id": h.id,
                "name": h.name,
                "distance_km": dist,
                "icu_beds_available": h.icu_beds_available,
                "blood_units_available": h.blood_units_available,
                "contact_info": h.contact_info,
                "estimated_eta_minutes": estimate_eta_minutes(dist),
                "coordinates": {"lat": h.location_lat, "lon": h.location_lon}
            })
    hospitals_found.sort(key=lambda x: x["distance_km"])

    # Query Police Stations
    candidate_police = db_session.query(PoliceStation).filter(PoliceStation.patrols_available > 0).all()
    police_found = []
    for p in candidate_police:
        dist = haversine_distance_km(lat, lon, p.location_lat, p.location_lon)
        if dist <= search_radius_km:
            police_found.append({
                "station_id": p.id,
                "name": p.name,
                "distance_km": dist,
                "patrols_available": p.patrols_available,
                "security_level": p.security_level,
                "contact_info": p.contact_info,
                "estimated_eta_minutes": estimate_eta_minutes(dist),
                "coordinates": {"lat": p.location_lat, "lon": p.location_lon}
            })
    police_found.sort(key=lambda x: x["distance_km"])

    execution_trace.append({
        "step": "ACTION_1",
        "tool": "find_nearest_hospitals",
        "parameters": {"lat": lat, "lon": lon, "required_beds": required_beds},
        "output": {"found_count": len(hospitals_found), "hospitals": hospitals_found}
    })
    execution_trace.append({
        "step": "ACTION_2",
        "tool": "find_nearest_police",
        "parameters": {"lat": lat, "lon": lon},
        "output": {"found_count": len(police_found), "police_stations": police_found}
    })

    # --- STEP 4: OBSERVATION 2 ---
    obs_2 = {
        "matching_hospitals_count": len(hospitals_found),
        "matching_police_count": len(police_found)
    }
    execution_trace.append({"step": "OBSERVATION_2", "content": obs_2})

    # --- STEP 5: THOUGHT 2 ---
    best_hospital = hospitals_found[0] if hospitals_found else None
    best_police = police_found[0] if police_found else None

    if not best_hospital and not best_police:
        override_res = {
            "status": "MANUAL_OVERRIDE",
            "incident_id": incident_id,
            "reason": "RESOURCE_EXHAUSTION: No qualified hospitals or police stations within operational radius.",
            "timestamp": datetime.utcnow().isoformat()
        }
        return {
            "status": "MANUAL_OVERRIDE",
            "incident_id": incident_id,
            "incident_type": inc_type,
            "severity_level": severity,
            "incident_summary": description,
            "dispatches": [],
            "units_assigned": {},
            "response_time_eta_max_minutes": 0,
            "trace_log": execution_trace
        }

    thought_2 = (
        f"Selected optimal units based on proximity and capacity. "
        f"Hospital: {best_hospital['name'] if best_hospital else 'N/A'} (Distance: {best_hospital['distance_km'] if best_hospital else 'N/A'} km, ETA: {best_hospital['estimated_eta_minutes'] if best_hospital else 'N/A'}m). "
        f"Police: {best_police['name'] if best_police else 'N/A'} (Distance: {best_police['distance_km'] if best_police else 'N/A'} km, ETA: {best_police['estimated_eta_minutes'] if best_police else 'N/A'}m)."
    )
    execution_trace.append({"step": "THOUGHT_2", "content": thought_2})

    # --- STEP 6: ACTION 3 & 4 (Execute DB Dispatches & Update Status) ---
    dispatches_list = []
    
    # 1. Dispatch Hospital
    if best_hospital and incident_id:
        h_obj = db_session.query(Hospital).filter(Hospital.id == best_hospital["hospital_id"]).first()
        if h_obj:
            beds_to_deduct = min(required_beds, h_obj.icu_beds_available)
            h_obj.icu_beds_available = max(0, h_obj.icu_beds_available - beds_to_deduct)
            
            h_dispatch = Dispatch(
                institution_id=h_obj.id,
                incident_id=incident_id,
                resource_type=f"Ambulance Convoy & ICU Bed Reservation ({beds_to_deduct} Beds)",
                eta_minutes=best_hospital["estimated_eta_minutes"],
                timestamp=datetime.utcnow()
            )
            db_session.add(h_dispatch)
            db_session.flush() # Obtain dispatch id
            
            disp_info = {
                "status": "success",
                "dispatch_id": h_dispatch.id,
                "incident_id": incident_id,
                "institution_id": h_obj.id,
                "institution_name": h_obj.name,
                "resource_type": h_dispatch.resource_type,
                "eta_minutes": h_dispatch.eta_minutes,
                "contact_info": h_obj.contact_info,
                "dispatched_at": h_dispatch.timestamp.isoformat()
            }
            dispatches_list.append(disp_info)
            execution_trace.append({
                "step": "ACTION_3",
                "tool": "dispatch_resource",
                "parameters": {"institution_id": h_obj.id, "resource": h_dispatch.resource_type},
                "output": disp_info
            })

    # 2. Dispatch Police
    if best_police and incident_id:
        p_obj = db_session.query(PoliceStation).filter(PoliceStation.id == best_police["station_id"]).first()
        if p_obj:
            if p_obj.patrols_available > 0:
                p_obj.patrols_available -= 1
                
            p_dispatch = Dispatch(
                institution_id=p_obj.id,
                incident_id=incident_id,
                resource_type="Emergency Perimeter Patrol & Escort",
                eta_minutes=best_police["estimated_eta_minutes"],
                timestamp=datetime.utcnow()
            )
            db_session.add(p_dispatch)
            db_session.flush()
            
            disp_info = {
                "status": "success",
                "dispatch_id": p_dispatch.id,
                "incident_id": incident_id,
                "institution_id": p_obj.id,
                "institution_name": p_obj.name,
                "resource_type": p_dispatch.resource_type,
                "eta_minutes": p_dispatch.eta_minutes,
                "contact_info": p_obj.contact_info,
                "dispatched_at": p_dispatch.timestamp.isoformat()
            }
            dispatches_list.append(disp_info)
            execution_trace.append({
                "step": "ACTION_4",
                "tool": "dispatch_resource",
                "parameters": {"institution_id": p_obj.id, "resource": p_dispatch.resource_type},
                "output": disp_info
            })

    # Update Incident status to IN_PROGRESS
    if incident_id:
        inc_obj = db_session.query(Incident).filter(Incident.id == incident_id).first()
        if inc_obj:
            inc_obj.status = IncidentStatus.IN_PROGRESS
    
    db_session.commit()

    # --- STEP 7: FINAL ANSWER ---
    max_eta = max([d.get("eta_minutes", 0) for d in dispatches_list]) if dispatches_list else 0
    final_payload = {
        "status": "DISPATCHED",
        "incident_id": incident_id,
        "incident_type": inc_type,
        "severity_level": severity,
        "incident_summary": description,
        "coordinates": {"lat": lat, "lon": lon},
        "required_resources": {"required_beds": required_beds},
        "dispatches": dispatches_list,
        "units_assigned": {
            "hospital": best_hospital,
            "police": best_police
        },
        "response_time_eta_max_minutes": max_eta,
        "trace_log": execution_trace
    }

    return final_payload
