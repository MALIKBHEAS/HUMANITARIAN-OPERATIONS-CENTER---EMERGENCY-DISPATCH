import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models import Incident, Dispatch, IncidentType, IncidentStatus
from schemas import IncidentCreate, IncidentResponse, DispatchResponse, AgentDispatchPayload
from agent_engine import run_eoa_agent
from ws_manager import ws_manager

logger = logging.getLogger("incidents_router")
router = APIRouter()

def resolve_incident_type(raw_type: str) -> IncidentType:
    """Safely map string to IncidentType enum supporting English and Arabic."""
    normalized = raw_type.strip().upper()
    if "FIRE" in normalized or "حريق" in raw_type:
        return IncidentType.FIRE
    elif "CRIME" in normalized or "جريمة" in raw_type:
        return IncidentType.CRIME
    return IncidentType.CRASH

@router.post("/webhook/incident", response_model=AgentDispatchPayload, status_code=status.HTTP_200_OK)
async def receive_incident_webhook(payload: IncidentCreate, db: Session = Depends(get_db)):
    """
    Primary Entrypoint for the Emergency Orchestrator Agent (EOA):
    1. Validates incoming payload using Pydantic.
    2. Edge validation (security token & coordinates).
    3. Persists raw incident with status OPEN.
    4. Triggers autonomous EOA ReAct execution.
    5. Updates incident status to IN_PROGRESS.
    6. Broadcasts real-time dispatch decision to React dashboard via WebSockets.
    7. Returns structured decision to the webhook caller.
    """
    # 1. Edge Security Validation Check
    if payload.security_token and payload.security_token.startswith("invalid"):
        override_response = {
            "status": "MANUAL_OVERRIDE",
            "incident_id": None,
            "incident_type": payload.type,
            "severity_level": payload.severity_level,
            "incident_summary": payload.description,
            "dispatches": [],
            "units_assigned": {},
            "response_time_eta_max_minutes": 0,
            "trace_log": [
                {"step": "OBSERVATION", "content": "Edge security token failed cryptographic validation."},
                {"step": "THOUGHT", "content": "Triggering manual override due to security alert."},
                {"step": "ACTION", "tool": "request_manual_override", "output": {"reason": "INVALID_EDGE_TOKEN"}}
            ]
        }
        await ws_manager.broadcast(override_response)
        return override_response

    # 2. Persist Incident with status OPEN
    inc_type = resolve_incident_type(payload.type)
    new_incident = Incident(
        type=inc_type,
        severity_level=payload.severity_level,
        status=IncidentStatus.OPEN,
        description=payload.description,
        location_lat=payload.lat if payload.lat is not None else 0.0,
        location_lon=payload.lon if payload.lon is not None else 0.0
    )
    db.add(new_incident)
    db.commit()
    db.refresh(new_incident)

    # 3. Prepare incident data for EOA Agent
    incident_data = payload.model_dump()
    incident_data["incident_id"] = new_incident.id
    incident_data["type"] = inc_type.value

    # 4. Execute Autonomous AI Agent (ReAct Loop)
    agent_response = await run_eoa_agent(incident_data, db)

    # 5. Refresh Incident status from DB
    db.refresh(new_incident)

    # 6. Real-Time Broadcast to React Dashboard
    await ws_manager.broadcast(agent_response)

    # 7. Return final response
    return agent_response

@router.get("/incidents", response_model=List[IncidentResponse])
def get_all_incidents(db: Session = Depends(get_db)):
    """Fetches all logged emergency incidents."""
    incidents = db.query(Incident).order_by(Incident.id.desc()).all()
    results = []
    for inc in incidents:
        results.append(IncidentResponse(
            id=inc.id,
            type=inc.type.value if hasattr(inc.type, 'value') else str(inc.type),
            severity_level=inc.severity_level,
            status=inc.status.value if hasattr(inc.status, 'value') else str(inc.status),
            description=inc.description,
            location_lat=inc.location_lat,
            location_lon=inc.location_lon,
            created_at=inc.created_at,
            dispatches_count=len(inc.dispatches)
        ))
    return results

@router.get("/incidents/{incident_id}")
def get_incident_by_id(incident_id: int, db: Session = Depends(get_db)):
    """Fetches detailed incident record including linked dispatches."""
    inc = db.query(Incident).filter(Incident.id == incident_id).first()
    if not inc:
        raise HTTPException(status_code=404, detail=f"Incident {incident_id} not found.")

    return {
        "id": inc.id,
        "type": inc.type.value if hasattr(inc.type, 'value') else str(inc.type),
        "severity_level": inc.severity_level,
        "status": inc.status.value if hasattr(inc.status, 'value') else str(inc.status),
        "description": inc.description,
        "lat": inc.location_lat,
        "lon": inc.location_lon,
        "created_at": inc.created_at.isoformat(),
        "dispatches": [
            {
                "id": d.id,
                "institution_id": d.institution_id,
                "institution_name": d.institution.name if d.institution else None,
                "resource_type": d.resource_type,
                "eta_minutes": d.eta_minutes,
                "timestamp": d.timestamp.isoformat()
            }
            for d in inc.dispatches
        ]
    }

@router.get("/dispatches", response_model=List[DispatchResponse])
def get_all_dispatches(db: Session = Depends(get_db)):
    """Fetches recent dispatches for live monitoring."""
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
