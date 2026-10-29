import pytest
from database import init_db, SessionLocal
from models import Hospital, PoliceStation, Incident, IncidentType, IncidentStatus, Institution, Dispatch
from skills import (
    get_incident_details,
    find_nearest_hospitals,
    find_nearest_police,
    dispatch_resource,
    request_manual_override
)
from orchestrator import EmergencyOrchestratorAgent

@pytest.fixture(autouse=True)
def setup_db():
    init_db()
    db = SessionLocal()
    # Clean
    db.query(Dispatch).delete()
    db.query(Hospital).delete()
    db.query(PoliceStation).delete()
    db.query(Institution).delete()
    db.query(Incident).delete()
    db.commit()

    # Create Hospital
    h = Hospital(
        name="Test City Hospital",
        location_lat=24.7136,
        location_lon=46.6753,
        contact_info="123456",
        icu_beds_available=10,
        blood_units_available=20
    )
    # Create Police Station
    p = PoliceStation(
        name="Test Station 1",
        location_lat=24.7180,
        location_lon=46.6800,
        contact_info="999",
        patrols_available=4,
        security_level="High"
    )
    # Create Incident
    inc = Incident(
        type=IncidentType.CRASH,
        severity_level=4,
        status=IncidentStatus.OPEN,
        location_lat=24.7140,
        location_lon=46.6760
    )
    db.add_all([h, p, inc])
    db.commit()
    db.close()

def test_polymorphic_inheritance():
    db = SessionLocal()
    institutions = db.query(Institution).all()
    assert len(institutions) == 2
    types = {type(inst).__name__ for inst in institutions}
    assert "Hospital" in types
    assert "PoliceStation" in types
    db.close()

def test_skills_execution():
    db = SessionLocal()
    inc = db.query(Incident).first()
    db.close()

    # Skill 1
    details = get_incident_details(inc.id)
    assert details["status"] == "success"
    assert details["incident_id"] == inc.id

    # Skill 2
    hospitals = find_nearest_hospitals(inc.location_lat, inc.location_lon, required_beds=3)
    assert hospitals["status"] == "success"
    assert hospitals["found_count"] >= 1
    assert hospitals["hospitals"][0]["icu_beds_available"] >= 3

    # Skill 3
    police = find_nearest_police(inc.location_lat, inc.location_lon)
    assert police["status"] == "success"
    assert police["found_count"] >= 1

    # Skill 4
    h_id = hospitals["hospitals"][0]["hospital_id"]
    dispatch_res = dispatch_resource(h_id, inc.id, "Ambulance")
    assert dispatch_res["status"] == "success"
    assert dispatch_res["incident_id"] == inc.id

def test_edge_rule_missing_geolocation():
    agent = EmergencyOrchestratorAgent()
    payload = {
        "incident_id": 99,
        "description": "Explosion reported somewhere in downtown",
        "lat": None,
        "lon": None
    }
    result = agent.process_incident(payload)
    assert result["status"] == "MANUAL_OVERRIDE"
    assert "MISSING_GEOLOCATION" in result["dashboard_output"]["reason"]

def test_end_to_end_react_loop():
    agent = EmergencyOrchestratorAgent()
    db = SessionLocal()
    inc = db.query(Incident).first()
    db.close()

    payload = {
        "incident_id": inc.id,
        "description": "Highway Collision with 4 injured",
        "lat": inc.location_lat,
        "lon": inc.location_lon,
        "required_beds": 2,
        "severity": 4
    }
    result = agent.process_incident(payload)
    assert result["status"] == "DISPATCHED"
    assert len(result["dispatches"]) >= 1
    assert "trace_log" in result
    steps = [item["step"] for item in result["trace_log"]]
    assert "OBSERVATION_1" in steps
    assert "THOUGHT_1" in steps
    assert "ACTION_1" in steps
    assert "ACTION_2" in steps
    assert "OBSERVATION_2" in steps
    assert "THOUGHT_2" in steps
