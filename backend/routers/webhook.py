import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from geoalchemy2.elements import WKTElement

from database import get_db
from models import Incident, Hospital, PoliceStation, Dispatch, IncidentType, IncidentStatus
from schemas import (
    IncidentCreate,
    IncidentResponse,
    HospitalResponse,
    PoliceStationResponse,
    ResourcesSummaryResponse,
    DispatchResponse,
    AgentDispatchPayload
)
from agent_engine import run_eoa_agent
from ws_manager import ws_manager

logger = logging.getLogger("webhook_router")
router = APIRouter(tags=["Incidents & Webhook"])

def parse_incident_type(raw_type: str) -> IncidentType:
    """Normalizes string inputs to the IncidentType enum."""
    val = raw_type.strip().upper()
    if "FIRE" in val or "حريق" in raw_type:
        return IncidentType.FIRE
    elif "CRIME" in val or "جريمة" in raw_type:
        return IncidentType.CRIME
    elif "HAZMAT" in val or "كيماو" in raw_type:
        return IncidentType.HAZMAT
    elif "MED" in val or "طبي" in raw_type:
        return IncidentType.MEDICAL
    return IncidentType.CRASH

@router.post("/webhook/incident", response_model=AgentDispatchPayload, status_code=status.HTTP_200_OK)
async def receive_incident_webhook(payload: IncidentCreate, db: Session = Depends(get_db)):
    """
    Global Webhook Ingestion Point:
    1. Validates payload using Pydantic.
    2. Persists Incident to PostGIS database as WGS 84 Point (POINT(lon lat)).
    3. Triggers Autonomous EOA AI Agent (ReAct cycle with ST_DWithin queries).
    4. Records atomic resource dispatches.
    5. Broadcasts live dispatch payload via WebSocket to React dashboard.
    6. Returns structured operational response.
    """
    logger.info(f"Incoming emergency webhook at ({payload.lat}, {payload.lon}) - Type: {payload.type}")

    # Edge security check
    if payload.security_token and payload.security_token.startswith("invalid"):
        override_payload = {
            "status": "MANUAL_OVERRIDE",
            "incident_id": 0,
            "incident_type": payload.type,
            "severity_level": payload.severity_level,
            "incident_summary": payload.description,
            "coordinates": {"lat": payload.lat, "lon": payload.lon},
            "dispatches": [],
            "units_assigned": {},
            "response_time_eta_max_minutes": 0,
            "trace_log": [{"step": "EDGE_SECURITY_FAULT", "content": "Security token verification failed."}]
        }
        await ws_manager.broadcast(override_payload)
        return override_payload

    # 1. Create Point Geometry in PostGIS (CRITICAL: POINT(Longitude Latitude))
    point_geom = WKTElement(f"POINT({payload.lon} {payload.lat})", srid=4326)
    inc_type = parse_incident_type(payload.type)

    # 2. Persist raw incident with OPEN status
    incident = Incident(
        type=inc_type,
        severity_level=payload.severity_level,
        status=IncidentStatus.OPEN,
        description=payload.description,
        location=point_geom
    )
    db.add(incident)
    db.commit()
    db.refresh(incident)

    # 3. Prepare payload for the AI Agent
    agent_input = payload.model_dump()
    agent_input["incident_id"] = incident.id
    agent_input["type"] = inc_type.value

    # 4. Invoke Autonomous ReAct Agent
    agent_response = await run_eoa_agent(agent_input, db)

    # 5. Broadcast live dispatch decision to WebSocket clients
    await ws_manager.broadcast(agent_response)

    return agent_response

@router.get("/incidents", response_model=List[IncidentResponse])
def get_all_incidents(db: Session = Depends(get_db)):
    """Retrieves all logged incidents with coordinates and status."""
    incidents = db.query(Incident).order_by(Incident.id.desc()).all()
    results = []
    for inc in incidents:
        results.append(IncidentResponse(
            id=inc.id,
            type=inc.type.value if hasattr(inc.type, 'value') else str(inc.type),
            severity_level=inc.severity_level,
            status=inc.status.value if hasattr(inc.status, 'value') else str(inc.status),
            description=inc.description,
            latitude=inc.latitude,
            longitude=inc.longitude,
            created_at=inc.created_at,
            dispatches_count=len(inc.dispatches)
        ))
    return results

@router.get("/dispatches", response_model=List[DispatchResponse])
def get_recent_dispatches(db: Session = Depends(get_db)):
    """Retrieves recent dispatches with unit names and ETAs."""
    dispatches = db.query(Dispatch).order_by(Dispatch.id.desc()).limit(100).all()
    results = []
    for d in dispatches:
        results.append(DispatchResponse(
            id=d.id,
            incident_id=d.incident_id,
            institution_id=d.institution_id,
            institution_name=d.institution.name if d.institution else None,
            resource_type=d.resource_type,
            eta_minutes=d.eta_minutes,
            timestamp=d.timestamp
        ))
    return results

@router.get("/resources/hospitals", response_model=List[HospitalResponse])
def get_hospitals(db: Session = Depends(get_db)):
    """Lists all registered hospitals with ICU bed availability."""
    hospitals = db.query(Hospital).all()
    return hospitals

@router.get("/resources/police", response_model=List[PoliceStationResponse])
def get_police_stations(db: Session = Depends(get_db)):
    """Lists all registered police stations with active patrol counts."""
    police = db.query(PoliceStation).all()
    return police

@router.get("/resources/all", response_model=ResourcesSummaryResponse)
def get_all_resources(db: Session = Depends(get_db)):
    """Consolidated summary of all available emergency institutions."""
    hospitals = db.query(Hospital).all()
    police = db.query(PoliceStation).all()
    return {
        "hospitals": hospitals,
        "police_stations": police
    }
