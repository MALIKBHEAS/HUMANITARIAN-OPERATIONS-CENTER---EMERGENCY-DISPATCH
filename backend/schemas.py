from pydantic import BaseModel, Field, ConfigDict, model_validator
from typing import Optional, List, Dict, Any
from datetime import datetime

# ============================================================================
# 1. INPUT SCHEMAS
# ============================================================================
class Coordinates(BaseModel):
    lat: float = Field(..., ge=-90.0, le=90.0, description="Latitude in WGS 84")
    lon: float = Field(..., ge=-180.0, le=180.0, description="Longitude in WGS 84")

class IncidentCreate(BaseModel):
    type: str = Field(default="CRASH", description="Emergency Type: FIRE, CRASH, CRIME, MEDICAL, HAZMAT")
    severity_level: int = Field(default=3, ge=1, le=5, description="Severity rating 1 to 5")
    description: str = Field(..., min_length=3, description="Incident operational description")
    lat: Optional[float] = Field(default=None, ge=-90.0, le=90.0, description="WGS 84 Latitude")
    lon: Optional[float] = Field(default=None, ge=-180.0, le=180.0, description="WGS 84 Longitude")
    coordinates: Optional[Coordinates] = Field(default=None, description="Optional nested coordinate object")
    required_beds: Optional[int] = Field(default=1, ge=0, description="Required ICU beds")
    security_token: Optional[str] = Field(default=None, description="Edge authentication token")

    @model_validator(mode='after')
    def resolve_geo_coordinates(self):
        if self.coordinates:
            if self.lat is None:
                self.lat = self.coordinates.lat
            if self.lon is None:
                self.lon = self.coordinates.lon
        if self.lat is None or self.lon is None:
            raise ValueError("Incident coordinates (lat, lon) are strictly required for spatial dispatch.")
        return self

# ============================================================================
# 2. OUTPUT SCHEMAS
# ============================================================================
class InstitutionBaseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    contact_info: Optional[str] = None
    institution_type: str
    latitude: float
    longitude: float

class HospitalResponse(InstitutionBaseResponse):
    icu_beds_available: int
    blood_units_available: int

class PoliceStationResponse(InstitutionBaseResponse):
    patrols_available: int
    security_level: str

class DispatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    incident_id: int
    institution_id: int
    institution_name: Optional[str] = None
    resource_type: str
    eta_minutes: int
    timestamp: datetime

class IncidentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: str
    severity_level: int
    status: str
    description: Optional[str] = None
    latitude: float
    longitude: float
    created_at: datetime
    dispatches_count: Optional[int] = 0

class ResourcesSummaryResponse(BaseModel):
    hospitals: List[HospitalResponse]
    police_stations: List[PoliceStationResponse]

# ============================================================================
# 3. AI AGENT DISPATCH PAYLOAD
# ============================================================================
class AgentDispatchPayload(BaseModel):
    status: str = Field(..., description="'DISPATCHED' or 'MANUAL_OVERRIDE'")
    incident_id: int
    incident_type: str
    severity_level: int
    incident_summary: str
    coordinates: Dict[str, float]
    required_resources: Optional[Dict[str, Any]] = None
    dispatches: List[Dict[str, Any]] = Field(default_factory=list)
    units_assigned: Dict[str, Any] = Field(default_factory=dict)
    response_time_eta_max_minutes: int = 0
    trace_log: Optional[List[Dict[str, Any]]] = None
