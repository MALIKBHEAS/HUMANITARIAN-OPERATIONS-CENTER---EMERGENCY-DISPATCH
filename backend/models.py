import enum
from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    DateTime,
    Enum,
    Float
)
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from database import Base

# --- Spatial Coordinate SRID Constant ---
WGS84_SRID = 4326

# --- Incident Enums ---
class IncidentStatus(str, enum.Enum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    CLOSED = "CLOSED"

class IncidentType(str, enum.Enum):
    FIRE = "FIRE"
    CRASH = "CRASH"
    CRIME = "CRIME"
    MEDICAL = "MEDICAL"
    HAZMAT = "HAZMAT"

# ============================================================================
# 1. SUPERCLASS: Institution (Joined Table Inheritance)
# ============================================================================
class Institution(Base):
    __tablename__ = "institutions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    contact_info = Column(String(100), nullable=True)
    institution_type = Column(String(50), nullable=False)

    # Global WGS 84 Point Geometry (Longitude Latitude, SRID=4326)
    location = Column(Geometry(geometry_type='POINT', srid=WGS84_SRID), nullable=False)

    # Dispatches relationship
    dispatches = relationship("Dispatch", back_populates="institution", cascade="all, delete-orphan")

    __mapper_args__ = {
        "polymorphic_identity": "institution",
        "polymorphic_on": institution_type,
    }

    @property
    def longitude(self) -> float:
        if self.location is None:
            return 0.0
        try:
            from geoalchemy2.shape import to_shape
            return float(to_shape(self.location).x)
        except Exception:
            return 0.0

    @property
    def latitude(self) -> float:
        if self.location is None:
            return 0.0
        try:
            from geoalchemy2.shape import to_shape
            return float(to_shape(self.location).y)
        except Exception:
            return 0.0

# ============================================================================
# 2. SUBCLASS 1: Hospital
# ============================================================================
class Hospital(Institution):
    __tablename__ = "hospitals"

    id = Column(Integer, ForeignKey("institutions.id", ondelete="CASCADE"), primary_key=True)
    icu_beds_available = Column(Integer, default=0, nullable=False)
    blood_units_available = Column(Integer, default=0, nullable=False)

    __mapper_args__ = {
        "polymorphic_identity": "hospital",
    }

# ============================================================================
# 3. SUBCLASS 2: PoliceStation
# ============================================================================
class PoliceStation(Institution):
    __tablename__ = "police_stations"

    id = Column(Integer, ForeignKey("institutions.id", ondelete="CASCADE"), primary_key=True)
    patrols_available = Column(Integer, default=0, nullable=False)
    security_level = Column(String(50), default="Standard", nullable=False)

    __mapper_args__ = {
        "polymorphic_identity": "police_station",
    }

# ============================================================================
# 4. INCIDENT ENTITY
# ============================================================================
class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(Enum(IncidentType), nullable=False, default=IncidentType.CRASH)
    severity_level = Column(Integer, nullable=False, default=3)
    status = Column(Enum(IncidentStatus), nullable=False, default=IncidentStatus.OPEN)
    description = Column(String(1000), nullable=True)

    # Global WGS 84 Point Geometry
    location = Column(Geometry(geometry_type='POINT', srid=WGS84_SRID), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    dispatches = relationship("Dispatch", back_populates="incident", cascade="all, delete-orphan")

    @property
    def longitude(self) -> float:
        if self.location is None:
            return 0.0
        try:
            from geoalchemy2.shape import to_shape
            return float(to_shape(self.location).x)
        except Exception:
            return 0.0

    @property
    def latitude(self) -> float:
        if self.location is None:
            return 0.0
        try:
            from geoalchemy2.shape import to_shape
            return float(to_shape(self.location).y)
        except Exception:
            return 0.0

# ============================================================================
# 5. DISPATCH ASSOCIATION ENTITY
# ============================================================================
class Dispatch(Base):
    __tablename__ = "dispatches"

    id = Column(Integer, primary_key=True, index=True)
    institution_id = Column(Integer, ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False)
    incident_id = Column(Integer, ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    resource_type = Column(String(100), nullable=False)
    eta_minutes = Column(Integer, default=5, nullable=False)

    incident = relationship("Incident", back_populates="dispatches")
    institution = relationship("Institution", back_populates="dispatches")
