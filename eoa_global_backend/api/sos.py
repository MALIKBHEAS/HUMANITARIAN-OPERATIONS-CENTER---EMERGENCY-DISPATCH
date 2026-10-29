"""
EOA Global - High-Velocity Emergency SOS Ingestion Endpoint
Allows dispatchers, mobile field agents, and automated IoT webhooks to trigger SOS events asynchronously.
"""

from __future__ import annotations

from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field

from eoa_global_backend.api.dependencies import get_current_tenant, get_current_user
from eoa_global_backend.db.models import User
from eoa_global_backend.services.event_stream import publish_incident

router = APIRouter(prefix="/sos", tags=["SOS Event Ingestion"])


class SOSTriggerRequest(BaseModel):
    """
    Emergency SOS alert payload for high-velocity real-time ingestion.
    """
    title: str = Field(..., description="Emergency title, e.g. 'Massive Wildfire Outbreak Sector 4'")
    incident_type: str = Field(..., description="Type: WILDFIRE, FLOOD, EARTHQUAKE, HAZMAT, MEDICAL")
    severity: str = Field(default="HIGH", description="Severity: LOW, MEDIUM, HIGH, CRITICAL")
    description: Optional[str] = Field(None, description="Detailed situation report or sensor data")
    latitude: float = Field(..., ge=-90.0, le=90.0, description="PostGIS Point Latitude")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="PostGIS Point Longitude")
    casualties_reported: int = Field(default=0, ge=0)
    requires_evacuation: bool = Field(default=False)


class SOSTriggerResponse(BaseModel):
    """
    Asynchronous acknowledgement returned within single-digit milliseconds.
    """
    status: str = "QUEUED_FOR_ORCHESTRATION"
    event_id: str
    tenant_id: str
    message: str


@router.post(
    "/trigger",
    response_model=SOSTriggerResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Ingest Emergency SOS Event",
    description="Asynchronously queues an SOS alert for immediate AI triage and real-time tenant WebSocket broadcast.",
)
async def trigger_emergency_sos(
    sos_in: SOSTriggerRequest,
    current_user: User = Depends(get_current_user),
    current_tenant: str = Depends(get_current_tenant),
) -> SOSTriggerResponse:
    """
    Receives SOS alert, enriches with user caller identity, and pushes to isolated tenant queue.
    """
    incident_data: Dict[str, Any] = sos_in.model_dump()
    incident_data["reported_by"] = current_user.email
    incident_data["reporter_name"] = current_user.full_name or current_user.email

    # Queue into message broker
    event_id = await publish_incident(current_tenant, incident_data)

    return SOSTriggerResponse(
        status="QUEUED_FOR_ORCHESTRATION",
        event_id=event_id,
        tenant_id=current_tenant,
        message=f"SOS alert successfully queued for tenant partition '{current_tenant}'. Live WebSocket dispatch triggered.",
    )
