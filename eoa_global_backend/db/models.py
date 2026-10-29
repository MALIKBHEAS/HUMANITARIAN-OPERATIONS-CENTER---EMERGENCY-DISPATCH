"""
EOA Global - Enterprise Multi-Tenant & PostGIS ORM Models
Defines the core database schemas utilizing modern SQLAlchemy 2.0 syntax.
"""

import uuid
from datetime import datetime
from typing import Any, List, Optional
from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from geoalchemy2 import Geometry

from eoa_global_backend.db.database import Base


class TenantBase(Base):
    """
    Abstract multi-tenant base model.
    Mandatory foundation for EVERY table in the EOA Global platform.
    Guarantees strict tenant-level separation and audit timestamps across all agencies and jurisdictions.
    """
    __abstract__ = True

    # Multi-tenant partitioning key (e.g., 'agency-fema-us', 'interpol-hq', 'un-ocha')
    tenant_id: Mapped[str] = mapped_column(
        String(64),
        index=True,
        nullable=False,
        doc="Tenant agency or organizational identifier",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        doc="Timestamp of creation (UTC)",
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        doc="Timestamp of last update (UTC)",
    )


class User(TenantBase):
    """
    User entity bound to a specific tenant organization.
    Supports role-based access control (RBAC) and enterprise SSO authentication.
    """
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("tenant_id", "email", name="uq_tenant_user_email"),
        Index("ix_users_tenant_email", "tenant_id", "email"),
    )

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        doc="Unique UUID primary key",
    )

    email: Mapped[str] = mapped_column(
        String(255),
        index=True,
        nullable=False,
        doc="User email address, unique within tenant",
    )

    hashed_password: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        doc="Bcrypt hashed credentials",
    )

    role: Mapped[str] = mapped_column(
        String(50),
        default="OPERATOR",
        nullable=False,
        doc="Role: SUPERADMIN, AGENCY_ADMIN, DISPATCHER, FIRST_RESPONDER, OPERATOR",
    )

    full_name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        doc="Full display name of user/operator",
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        doc="Account activation status flag",
    )

    is_superuser: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        doc="Platform-wide global superuser privileges",
    )

    # Relationship to reported incidents
    reported_incidents: Mapped[List["Incident"]] = relationship(
        "Incident",
        back_populates="reporter",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email} tenant={self.tenant_id} role={self.role}>"


class Incident(TenantBase):
    """
    Geospatial Emergency Incident model inheriting from TenantBase.
    Stores real-time emergency events with global PostGIS Point coordinates (SRID 4326).
    """
    __tablename__ = "incidents"
    __table_args__ = (
        Index("ix_incidents_tenant_status", "tenant_id", "status"),
        Index("ix_incidents_tenant_severity", "tenant_id", "severity"),
    )

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        doc="Unique Incident UUID",
    )

    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
        doc="Incident headline or code title",
    )

    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        doc="Comprehensive operational description",
    )

    incident_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        doc="Type: WILDFIRE, FLOOD, EARTHQUAKE, HAZMAT, CYBER, MEDICAL, SEARCH_RESCUE",
    )

    severity: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="MEDIUM",
        index=True,
        doc="Severity level: LOW, MEDIUM, HIGH, CRITICAL, CATASTROPHIC",
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="REPORTED",
        index=True,
        doc="Status: REPORTED, DISPATCHED, ACTIVE, CONTAINED, RESOLVED, CLOSED",
    )

    # PostGIS Geospatial Point column (WGS 84 coordinate reference system: SRID 4326)
    location: Mapped[Any] = mapped_column(
        Geometry(
            geometry_type="POINT",
            srid=4326,
            spatial_index=True,
        ),
        nullable=False,
        doc="PostGIS Point (longitude, latitude) with SRID 4326",
    )

    reporter_id: Mapped[Optional[str]] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        doc="User ID of the incident reporter",
    )

    reporter: Mapped[Optional["User"]] = relationship(
        "User",
        back_populates="reported_incidents",
    )

    def __repr__(self) -> str:
        return f"<Incident id={self.id} title={self.title} tenant={self.tenant_id} severity={self.severity}>"
