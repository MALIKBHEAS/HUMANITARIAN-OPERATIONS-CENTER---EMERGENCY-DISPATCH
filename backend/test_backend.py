import pytest
import sys
import os

# Add backend directory to path
backend_dir = os.path.abspath(os.path.dirname(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi.testclient import TestClient
from main import app
from database import init_db, SessionLocal
from seed_global_data import seed
from models import Incident, Hospital, PoliceStation, Dispatch
from spatial_skills import get_nearest_hospitals, get_nearest_police
from agent_engine import run_eoa_agent

@pytest.fixture(scope="module", autouse=True)
def setup_backend_db():
    init_db()
    seed()

def test_health():
    client = TestClient(app)
    res = client.get("/")
    assert res.status_code == 200
    assert res.json()["status"] == "OPERATIONAL"

def test_spatial_query_tokyo():
    """Test PostGIS / spatial tools query around Shinjuku, Tokyo."""
    # Tokyo coordinates: 35.6938, 139.6917
    hospitals = get_nearest_hospitals(lat=35.6938, lon=139.6917, min_beds=5, radius_km=15)
    assert len(hospitals) >= 1
    assert "Tokyo Medical University" in hospitals[0]["name"]
    assert hospitals[0]["distance_km"] < 5.0

    police = get_nearest_police(lat=35.6938, lon=139.6917, radius_km=15)
    assert len(police) >= 1
    assert "Shinjuku Police" in police[0]["name"]

def test_spatial_query_madrid():
    """Test spatial tools around Madrid, Spain."""
    # Madrid coordinates: 40.4816, -3.6872
    hospitals = get_nearest_hospitals(lat=40.4816, lon=-3.6872, min_beds=10, radius_km=15)
    assert len(hospitals) >= 1
    assert "La Paz" in hospitals[0]["name"]

    police = get_nearest_police(lat=40.4816, lon=-3.6872, radius_km=15)
    assert len(police) >= 1

def test_spatial_query_hebron():
    """Test spatial tools around Hebron, Palestine."""
    # Hebron Industrial Zone coordinates: 31.5273, 35.0946
    hospitals = get_nearest_hospitals(lat=31.5273, lon=35.0946, min_beds=10, radius_km=15)
    assert len(hospitals) >= 1
    assert "Al-Ahli" in hospitals[0]["name"]

    police = get_nearest_police(lat=31.5273, lon=35.0946, radius_km=15)
    assert len(police) >= 1

def test_webhook_tokyo_incident_e2e():
    """Test full webhook triggering autonomous agent dispatch in Tokyo."""
    client = TestClient(app)
    payload = {
        "type": "FIRE",
        "severity_level": 5,
        "description": "Explosion and major fire reported at Shinjuku high-rise. 10 casualties requiring ICU care.",
        "lat": 35.6938,
        "lon": 139.6917,
        "required_beds": 10,
        "security_token": "valid_global_token_tokyo"
    }

    res = client.post("/api/webhook/incident", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "DISPATCHED"
    assert len(data["dispatches"]) >= 1
    assert data["units_assigned"]["hospital"] is not None
    assert "Tokyo" in data["units_assigned"]["hospital"]["name"]

def test_websocket_broadcast():
    """Test real-time WebSocket live feed receives dispatch events."""
    client = TestClient(app)
    with client.websocket_connect("/ws/live-feed") as ws:
        # Verify ping-pong
        ws.send_text("ping")
        assert ws.receive_text() == "pong"

        # Dispatch Madrid incident
        payload = {
            "type": "CRASH",
            "severity_level": 4,
            "description": "Multi-car highway collision on M-30 Madrid with 5 injured.",
            "lat": 40.4816,
            "lon": -3.6872,
            "required_beds": 5,
            "security_token": "valid_token_madrid"
        }
        res = client.post("/api/webhook/incident", json=payload)
        assert res.status_code == 200

        # Receive real-time push from WebSocket
        ws_event = ws.receive_json()
        assert ws_event["status"] == "DISPATCHED"
        assert "dispatches" in ws_event
