import json
from typing import Dict, Any, Optional
from skills import (
    get_incident_details,
    find_nearest_hospitals,
    find_nearest_police,
    dispatch_resource,
    request_manual_override
)

class EmergencyOrchestratorAgent:
    """
    Emergency Orchestrator Agent (EOA)
    Autonomous AI system managing critical emergency responses with zero hallucination.
    Strictly follows the ReAct execution loop:
    Observation -> Thought -> Action -> Observation -> Thought -> Action -> Final Answer.
    """

    def process_incident(self, incident_payload: Dict[str, Any]) -> Dict[str, Any]:
        execution_trace = []

        # --- STEP 1: EDGE LAYER / SECURITY & GEO VALIDATION ---
        incident_id = incident_payload.get("incident_id")
        lat = incident_payload.get("lat")
        lon = incident_payload.get("lon")
        required_beds = incident_payload.get("required_beds", 1)
        severity = incident_payload.get("severity", 3)
        description = incident_payload.get("description", "Emergency reported")

        # Edge Rule Check
        if lat is None or lon is None:
            action_result = request_manual_override(
                incident_id=incident_id,
                reason="MISSING_GEOLOCATION: Incident payload lacks latitude/longitude coordinates.",
                details=incident_payload
            )
            return {
                "status": "MANUAL_OVERRIDE",
                "orchestrator_decision": "ABORTED_AUTOMATIC_DISPATCH",
                "reason": "Payload failed Edge Layer security and geolocation validation.",
                "trace": [
                    {"step": "OBSERVATION", "content": f"Incoming payload: {incident_payload}"},
                    {"step": "THOUGHT", "content": "Missing latitude/longitude coordinates required for distance routing."},
                    {"step": "ACTION", "tool": "request_manual_override", "output": action_result}
                ],
                "dashboard_output": action_result
            }

        # --- STEP 2: OBSERVATION 1 ---
        obs_1 = f"Incoming incident payload received. Description: '{description}'. Incident ID: {incident_id}, Lat: {lat}, Lon: {lon}, Required ICU Beds: {required_beds}, Severity: {severity}."
        execution_trace.append({"step": "OBSERVATION_1", "content": obs_1})

        # --- STEP 3: THOUGHT 1 ---
        thought_1 = f"I must verify incident details in the database and query nearby medical and law enforcement facilities. Coordinates ({lat}, {lon}) need medical facilities with at least {required_beds} available ICU bed(s) and nearby police units."
        execution_trace.append({"step": "THOUGHT_1", "content": thought_1})

        # --- STEP 4: ACTION 1 (Find Hospitals) ---
        hospital_res = find_nearest_hospitals(lat=lat, lon=lon, required_beds=required_beds, max_radius_km=15.0)
        execution_trace.append({
            "step": "ACTION_1",
            "tool": "find_nearest_hospitals",
            "parameters": {"lat": lat, "lon": lon, "required_beds": required_beds},
            "output": hospital_res
        })

        # --- STEP 5: ACTION 2 (Find Police) ---
        police_res = find_nearest_police(lat=lat, lon=lon, max_radius_km=15.0)
        execution_trace.append({
            "step": "ACTION_2",
            "tool": "find_nearest_police",
            "parameters": {"lat": lat, "lon": lon},
            "output": police_res
        })

        # --- STEP 6: OBSERVATION 2 ---
        obs_2 = {
            "hospitals_found": hospital_res.get("found_count", 0),
            "police_stations_found": police_res.get("found_count", 0)
        }
        execution_trace.append({"step": "OBSERVATION_2", "content": obs_2})

        # --- STEP 7: THOUGHT 2 ---
        dispatches_executed = []
        best_hospital = hospital_res["hospitals"][0] if hospital_res.get("hospitals") else None
        best_police = police_res["police_stations"][0] if police_res.get("police_stations") else None

        if not best_hospital and not best_police:
            override_res = request_manual_override(
                incident_id=incident_id,
                reason="INSUFFICIENT_RESOURCES: No equipped hospitals or police patrols found within radius."
            )
            return {
                "status": "MANUAL_OVERRIDE",
                "reason": "No available resources matched requirements within radius.",
                "trace": execution_trace,
                "dashboard_output": override_res
            }

        thought_2 = (
            f"Decision strategy: "
            f"Hospital selected: {best_hospital['name'] if best_hospital else 'None'} ({best_hospital['distance_km'] if best_hospital else 'N/A'} km, ETA {best_hospital['estimated_eta_minutes'] if best_hospital else 'N/A'} mins). "
            f"Police unit selected: {best_police['name'] if best_police else 'None'} ({best_police['distance_km'] if best_police else 'N/A'} km, ETA {best_police['estimated_eta_minutes'] if best_police else 'N/A'} mins). "
            f"Proceeding with immediate dispatch actions."
        )
        execution_trace.append({"step": "THOUGHT_2", "content": thought_2})

        # --- STEP 8: ACTION 3 (Dispatch Resources) ---
        if best_hospital and incident_id:
            h_disp = dispatch_resource(
                institution_id=best_hospital["hospital_id"],
                incident_id=incident_id,
                resource_type="Ambulance & ICU Bed Reservation",
                eta_minutes=best_hospital["estimated_eta_minutes"]
            )
            dispatches_executed.append(h_disp)
            execution_trace.append({
                "step": "ACTION_3",
                "tool": "dispatch_resource",
                "parameters": {"institution_id": best_hospital["hospital_id"], "resource": "Ambulance & ICU Bed Reservation"},
                "output": h_disp
            })

        if best_police and incident_id:
            p_disp = dispatch_resource(
                institution_id=best_police["station_id"],
                incident_id=incident_id,
                resource_type="Emergency Police Patrol",
                eta_minutes=best_police["estimated_eta_minutes"]
            )
            dispatches_executed.append(p_disp)
            execution_trace.append({
                "step": "ACTION_4",
                "tool": "dispatch_resource",
                "parameters": {"institution_id": best_police["station_id"], "resource": "Emergency Police Patrol"},
                "output": p_disp
            })

        # --- STEP 9: FINAL ANSWER (Strict JSON for Vite/React Dashboard) ---
        final_answer = {
            "status": "DISPATCHED",
            "incident_id": incident_id,
            "incident_summary": description,
            "severity_level": severity,
            "coordinates": {"lat": lat, "lon": lon},
            "dispatches": dispatches_executed,
            "units_assigned": {
                "hospital": best_hospital,
                "police": best_police
            },
            "response_time_eta_max_minutes": max(
                [d.get("eta_minutes", 0) for d in dispatches_executed] or [0]
            ),
            "trace_log": execution_trace
        }

        return final_answer

if __name__ == "__main__":
    import sys
    if sys.platform == "win32":
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    eoa = EmergencyOrchestratorAgent()
    sample_incident = {
        "incident_id": 1,
        "description": "Massive car crash at Route 60, 5 injured",
        "lat": 24.7150,
        "lon": 46.6780,
        "required_beds": 5,
        "severity": 5
    }
    result = eoa.process_incident(sample_incident)
    print(json.dumps(result, indent=2, ensure_ascii=False))
