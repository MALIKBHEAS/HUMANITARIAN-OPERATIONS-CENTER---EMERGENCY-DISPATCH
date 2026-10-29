from pydantic import BaseModel, Field, ConfigDict, model_validator
from typing import Optional, List, Dict, Any, Union
from datetime import datetime

# ==========================================
# 1. INCIDENT SCHEMAS
# ==========================================

class Coordinates(BaseModel):
    lat: float
    lon: float

class IncidentCreate(BaseModel):
    type: str = Field(default="CRASH", description="Incident type: FIRE, CRASH, CRIME, etc.")
    severity_level: int = Field(default=3, ge=1, le=5, description="Severity from 1 to 5")
    description: str = Field(..., min_length=3, description="Incident description payload")
    lat: Optional[float] = Field(default=None, description="Latitude")
    lon: Optional[float] = Field(default=None, description="Longitude")
    coordinates: Optional[Coordinates] = Field(default=None, description="Optional nested coordinate object")
    required_beds: Optional[int] = Field(default=1, ge=0, description="Required ICU beds")
    security_token: Optional[str] = Field(default=None, description="Edge security authorization token")

    @model_validator(mode='after')
    def resolve_coordinates(self):
        # If coordinates object was provided, resolve lat/lon if not provided at top-level
        if self.coordinates:
            if self.lat is None:
                self.lat = self.coordinates.lat
            if self.lon is None:
                self.lon = self.coordinates.lon
        return self

class IncidentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: str
    severity_level: int
    status: str
    description: Optional[str] = None
    location_lat: float
    location_lon: float
    created_at: datetime
    dispatches_count: Optional[int] = 0

# ==========================================
# 2. INSTITUTION SCHEMAS
# ==========================================

class InstitutionBaseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    location_lat: float
    location_lon: float
    contact_info: Optional[str] = None
    institution_type: str

class HospitalResponse(InstitutionBaseResponse):
    icu_beds_available: int
    blood_units_available: int

class PoliceStationResponse(InstitutionBaseResponse):
    patrols_available: int
    security_level: str

class ResourcesSummaryResponse(BaseModel):
    hospitals: List[HospitalResponse]
    police_stations: List[PoliceStationResponse]

# ==========================================
# 3. DISPATCH & AGENT SCHEMAS
# ==========================================

class DispatchRecord(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    status: str = "success"
    dispatch_id: int
    incident_id: int
    institution_id: int
    institution_name: Optional[str] = None
    resource_type: str
    eta_minutes: int
    dispatched_at: str

class DispatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    incident_id: int
    institution_id: int
    institution_name: Optional[str] = None
    resource_type: str
    eta_minutes: int
    timestamp: datetime

class AgentDispatchPayload(BaseModel):
    """Strict JSON output from Emergency Orchestrator Agent (EOA)."""
    status: str = Field(..., description="'DISPATCHED' or 'MANUAL_OVERRIDE'")
    incident_id: Optional[int] = None
    incident_type: Optional[str] = None
    severity_level: Optional[int] = None
    incident_summary: Optional[str] = None
    coordinates: Optional[Dict[str, Any]] = None
    required_resources: Optional[Dict[str, Any]] = None
    dispatches: List[Dict[str, Any]] = Field(default_factory=list)
    units_assigned: Dict[str, Any] = Field(default_factory=dict)
    response_time_eta_max_minutes: Optional[int] = 0
    trace_log: Optional[List[Dict[str, Any]]] = None
