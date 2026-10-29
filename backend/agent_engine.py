import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from models import Incident, Hospital, PoliceStation, Dispatch, IncidentStatus
from spatial_skills import get_nearest_hospitals, get_nearest_police

logger = logging.getLogger("agent_engine")

SYSTEM_PROMPT = """You are the Global Emergency Orchestrator Agent (EOA).
When an incident arrives anywhere on Earth, use your spatial PostGIS tools to find nearby resources based on the incident's WGS 84 coordinates.
Never assume availability. Always query real-time capacity before dispatching.
Select the nearest equipped hospital with sufficient ICU beds and the closest police station with active patrols.
Dispatch the optimal resources and output a strict JSON payload."""

async def run_eoa_agent(incident_data: Dict[str, Any], db_session: Session) -> Dict[str, Any]:
    """
    Autonomous AI Agent executing the ReAct (Reasoning + Action) spatial dispatch loop.
    Interacts with PostGIS spatial tools and commits atomic dispatch decisions to the database.
    """
    execution_trace = []
    
    incident_id = incident_data.get("incident_id")
    description = incident_data.get("description", "Emergency incident reported.")
    inc_type = incident_data.get("type", "CRASH")
    severity = incident_data.get("severity_level", 3)
    required_beds = incident_data.get("required_beds", 1)
    
    lat = float(incident_data.get("lat", 0.0))
    lon = float(incident_data.get("lon", 0.0))

    # --- STEP 1: OBSERVATION ---
    obs_1 = (
        f"[OBSERVATION]: Incident #{incident_id} ({inc_type}, Severity: {severity}/5) "
        f"reported at WGS84 coordinates ({lat:.4f}, {lon:.4f}). "
        f"Casualty payload requires {required_beds} ICU bed(s). Description: '{description}'."
    )
    execution_trace.append({"step": "OBSERVATION_1", "content": obs_1})

    # --- STEP 2: THOUGHT ---
    thought_1 = (
        f"[THOUGHT]: Executing global spatial scan via PostGIS ST_DWithin within a 15km perimeter of "
        f"Point({lon:.4f} {lat:.4f}). Must identify hospitals with >= {required_beds} ICU beds "
        f"and police units with active patrols."
    )
    execution_trace.append({"step": "THOUGHT_1", "content": thought_1})

    # --- STEP 3: ACTION (PostGIS Spatial Tools) ---
    # Call LangChain tool functions directly
    try:
        if hasattr(get_nearest_hospitals, "invoke"):
            hospitals_found = get_nearest_hospitals.invoke({
                "lat": lat, "lon": lon, "min_beds": required_beds, "radius_km": 15
            })
        else:
            hospitals_found = get_nearest_hospitals(
                lat=lat, lon=lon, min_beds=required_beds, radius_km=15
            )
    except Exception as e:
        logger.error(f"Error executing get_nearest_hospitals tool: {e}")
        hospitals_found = []

    try:
        if hasattr(get_nearest_police, "invoke"):
            police_found = get_nearest_police.invoke({
                "lat": lat, "lon": lon, "radius_km": 15
            })
        else:
            police_found = get_nearest_police(lat=lat, lon=lon, radius_km=15)
    except Exception as e:
        logger.error(f"Error executing get_nearest_police tool: {e}")
        police_found = []

    execution_trace.append({
        "step": "ACTION_1",
        "tool": "get_nearest_hospitals",
        "parameters": {"lat": lat, "lon": lon, "min_beds": required_beds, "radius_km": 15},
        "output": hospitals_found
    })
    execution_trace.append({
        "step": "ACTION_2",
        "tool": "get_nearest_police",
        "parameters": {"lat": lat, "lon": lon, "radius_km": 15},
        "output": police_found
    })

    # --- STEP 4: OBSERVATION ---
    obs_2 = (
        f"[OBSERVATION]: Spatial query resolved: {len(hospitals_found)} hospital(s) with sufficient ICU beds, "
        f"and {len(police_found)} police station(s) with available patrol units."
    )
    execution_trace.append({"step": "OBSERVATION_2", "content": obs_2})

    # --- STEP 5: THOUGHT ---
    best_hospital = hospitals_found[0] if hospitals_found else None
    best_police = police_found[0] if police_found else None

    if not best_hospital and not best_police:
        thought_fail = "[THOUGHT]: Zero matching emergency institutions within 15km perimeter. Escalating to MANUAL OVERRIDE."
        execution_trace.append({"step": "THOUGHT_2", "content": thought_fail})
        
        return {
            "status": "MANUAL_OVERRIDE",
            "incident_id": incident_id,
            "incident_type": inc_type,
            "severity_level": severity,
            "incident_summary": description,
            "coordinates": {"lat": lat, "lon": lon},
            "dispatches": [],
            "units_assigned": {},
            "response_time_eta_max_minutes": 0,
            "trace_log": execution_trace
        }

    thought_2 = (
        f"[THOUGHT]: Optimal dispatch determined: "
        f"Medical: {best_hospital['name'] if best_hospital else 'NONE'} ({best_hospital['distance_km'] if best_hospital else 'N/A'} km, ETA {best_hospital['estimated_eta_minutes'] if best_hospital else 'N/A'}m). "
        f"Police: {best_police['name'] if best_police else 'NONE'} ({best_police['distance_km'] if best_police else 'N/A'} km, ETA {best_police['estimated_eta_minutes'] if best_police else 'N/A'}m)."
    )
    execution_trace.append({"step": "THOUGHT_2", "content": thought_2})

    # --- STEP 6: ACTION (Atomic Database Dispatches & Inventory Reservation) ---
    dispatches_list = []

    # 1. Dispatch Medical Resources
    if best_hospital and incident_id:
        h_record = db_session.query(Hospital).filter(Hospital.id == best_hospital["hospital_id"]).first()
        if h_record:
            beds_assigned = min(required_beds, h_record.icu_beds_available)
            h_record.icu_beds_available = max(0, h_record.icu_beds_available - beds_assigned)

            h_disp = Dispatch(
                institution_id=h_record.id,
                incident_id=incident_id,
                resource_type=f"Ambulance Fleet & ICU Reservation ({beds_assigned} Beds)",
                eta_minutes=best_hospital["estimated_eta_minutes"],
                timestamp=datetime.utcnow()
            )
            db_session.add(h_disp)
            db_session.flush()

            disp_payload = {
                "status": "success",
                "dispatch_id": h_disp.id,
                "incident_id": incident_id,
                "institution_id": h_record.id,
                "institution_name": h_record.name,
                "resource_type": h_disp.resource_type,
                "eta_minutes": h_disp.eta_minutes,
                "contact_info": h_record.contact_info,
                "dispatched_at": h_disp.timestamp.isoformat()
            }
            dispatches_list.append(disp_payload)
            execution_trace.append({
                "step": "ACTION_3",
                "tool": "dispatch_resource",
                "parameters": {"institution_id": h_record.id, "resource": h_disp.resource_type},
                "output": disp_payload
            })

    # 2. Dispatch Police Units
    if best_police and incident_id:
        p_record = db_session.query(PoliceStation).filter(PoliceStation.id == best_police["station_id"]).first()
        if p_record:
            if p_record.patrols_available > 0:
                p_record.patrols_available -= 1

            p_disp = Dispatch(
                institution_id=p_record.id,
                incident_id=incident_id,
                resource_type="Perimeter Security & Highway Escort",
                eta_minutes=best_police["estimated_eta_minutes"],
                timestamp=datetime.utcnow()
            )
            db_session.add(p_disp)
            db_session.flush()

            disp_payload = {
                "status": "success",
                "dispatch_id": p_disp.id,
                "incident_id": incident_id,
                "institution_id": p_record.id,
                "institution_name": p_record.name,
                "resource_type": p_disp.resource_type,
                "eta_minutes": p_disp.eta_minutes,
                "contact_info": p_record.contact_info,
                "dispatched_at": p_disp.timestamp.isoformat()
            }
            dispatches_list.append(disp_payload)
            execution_trace.append({
                "step": "ACTION_4",
                "tool": "dispatch_resource",
                "parameters": {"institution_id": p_record.id, "resource": p_disp.resource_type},
                "output": disp_payload
            })

    # Transition Incident Status
    if incident_id:
        inc_record = db_session.query(Incident).filter(Incident.id == incident_id).first()
        if inc_record:
            inc_record.status = IncidentStatus.IN_PROGRESS

    db_session.commit()

    # --- STEP 7: FINAL ANSWER ---
    max_eta = max([d.get("eta_minutes", 0) for d in dispatches_list]) if dispatches_list else 0

    return {
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
