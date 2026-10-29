from datetime import datetime
import enum
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    ForeignKey,
    DateTime,
    Enum,
    create_engine
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

# --- Enums ---
class IncidentStatus(str, enum.Enum):
    OPEN = "مفتوح"
    IN_PROGRESS = "قيد المعالجة"
    CLOSED = "مغلق"

class IncidentType(str, enum.Enum):
    FIRE = "حريق"
    CRASH = "حادث سير"
    CRIME = "جريمة جنائية"

# --- Superclass: Institution ---
class Institution(Base):
    __tablename__ = "institutions"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    location_lat = Column(Float, nullable=False)
    location_lon = Column(Float, nullable=False)
    contact_info = Column(String(100), nullable=True)
    institution_type = Column(String(50), nullable=False)
    
    # Relationship to Dispatches
    dispatches = relationship("Dispatch", back_populates="institution", cascade="all, delete-orphan")

    __mapper_args__ = {
        "polymorphic_identity": "institution",
        "polymorphic_on": institution_type,
    }

# --- Subclass 1: Hospital ---
class Hospital(Institution):
    __tablename__ = "hospitals"
    
    id = Column(Integer, ForeignKey("institutions.id", ondelete="CASCADE"), primary_key=True)
    icu_beds_available = Column(Integer, default=0, nullable=False)
    blood_units_available = Column(Integer, default=0, nullable=False)
    
    __mapper_args__ = {
        "polymorphic_identity": "hospital",
    }

# --- Subclass 2: PoliceStation ---
class PoliceStation(Institution):
    __tablename__ = "police_stations"
    
    id = Column(Integer, ForeignKey("institutions.id", ondelete="CASCADE"), primary_key=True)
    patrols_available = Column(Integer, default=0, nullable=False)
    security_level = Column(String(50), default="Medium", nullable=False)
    
    __mapper_args__ = {
        "polymorphic_identity": "police_station",
    }

# --- Incident Entity ---
class Incident(Base):
    __tablename__ = "incidents"
    
    id = Column(Integer, primary_key=True, index=True)
    type = Column(Enum(IncidentType), nullable=False, default=IncidentType.CRASH)
    severity_level = Column(Integer, nullable=False, default=3)
    status = Column(Enum(IncidentStatus), nullable=False, default=IncidentStatus.OPEN)
    description = Column(String(1000), nullable=True)
    location_lat = Column(Float, nullable=False)
    location_lon = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    dispatches = relationship("Dispatch", back_populates="incident", cascade="all, delete-orphan")

# --- Dispatch Join Entity ---
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
