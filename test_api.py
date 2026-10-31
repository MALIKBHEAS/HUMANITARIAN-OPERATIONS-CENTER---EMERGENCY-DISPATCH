import json
import pytest
from fastapi.testclient import TestClient
from main import app
from database import init_db, SessionLocal
from seed_db import seed

@pytest.fixture(scope="module", autouse=True)
def setup_test_environment():
    init_db()
    seed()

def test_health_check():
    client = TestClient(app)
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "OPERATIONAL"

def test_get_resources():
    client = TestClient(app)
    h_resp = client.get("/api/resources/hospitals")
    assert h_resp.status_code == 200
    assert len(h_resp.json()) > 0
    assert "icu_beds_available" in h_resp.json()[0]

    p_resp = client.get("/api/resources/police")
    assert p_resp.status_code == 200
    assert len(p_resp.json()) > 0
    assert "patrols_available" in p_resp.json()[0]

def test_webhook_incident_dispatch_e2e():
    client = TestClient(app)
    payload = {
        "type": "FIRE",
        "severity_level": 5,
        "description": "Chemical plant explosion and high-rise fire in Hebron sector",
        "lat": 31.5273,
        "lon": 35.0946,
        "required_beds": 5,
        "security_token": "valid_token_123"
    }
    
    response = client.post("/api/webhook/incident", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "DISPATCHED"
    assert len(data["dispatches"]) >= 1
    assert data["units_assigned"]["hospital"] is not None
    assert data["units_assigned"]["police"] is not None

def test_websocket_broadcast_integration():
    client = TestClient(app)
    with client.websocket_connect("/ws/live-feed") as websocket:
        # 1. Parse incoming WebSocket message as JSON
        response = websocket.receive_text()
        data = json.loads(response)

        # 2. Assert telemetry payload structure
        assert "type" in data
        assert data["type"] in ["EOA_SOCKET_INITIALIZED", "EOA Telemetry Stream"]
        assert data.get("status") in ["ONLINE", "CONNECTED", "ALIVE"]

        # 3. Verify ping responsiveness
        websocket.send_text("ping")
        pong = websocket.receive_text()
        assert pong in ["pong", "HEARTBEAT_ACK"] or "pong" in pong or "status" in pong

        # 4. Now send webhook incident through REST
        payload = {
            "type": "CRASH",
            "severity_level": 4,
            "description": "حادث تصادم على طريق 60 بالرياض",
            "lat": 24.7150,
            "lon": 46.6780,
            "required_beds": 2,
            "security_token": "valid_token_123"
        }
        res = client.post("/api/webhook/incident", json=payload)
        assert res.status_code == 200

        # 5. Verify WebSocket received the broadcast message!
        ws_msg = websocket.receive_json()
        assert ws_msg["status"] == "DISPATCHED"
        assert "dispatches" in ws_msg
