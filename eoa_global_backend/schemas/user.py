"""
EOA Global - Pydantic v2 Schemas for Authentication, Users & Multi-Tenancy
Provides data validation, serialization, and OpenAPI contracts.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


# -----------------------------------------------------------------------------
# Security & Token Schemas
# -----------------------------------------------------------------------------

class Token(BaseModel):
    """
    Standard OAuth2 JWT access token response with multi-tenant metadata.
    """
    access_token: str = Field(..., description="Signed JSON Web Token")
    token_type: str = Field("bearer", description="Token schema type")
    tenant_id: str = Field(..., description="Organization tenant identity")
    expires_in_seconds: int = Field(..., description="Token lifespan in seconds")


class TokenPayload(BaseModel):
    """
    Decoded JWT token claims structure.
    """
    sub: Optional[str] = Field(None, description="Subject email identifier")
    tenant_id: Optional[str] = Field(None, description="Multi-tenant boundary partition")
    role: Optional[str] = Field(None, description="User role authorization level")
    exp: Optional[int] = Field(None, description="Expiration UNIX epoch")
    iat: Optional[int] = Field(None, description="Issued at UNIX epoch")


# -----------------------------------------------------------------------------
# User Schemas
# -----------------------------------------------------------------------------

class UserBase(BaseModel):
    """
    Base attributes for user representation across the system.
    """
    email: EmailStr = Field(..., description="Unique user email within the tenant domain")
    full_name: Optional[str] = Field(None, description="Full name or callsign")
    role: str = Field(
        default="OPERATOR",
        description="Role: SUPERADMIN, AGENCY_ADMIN, DISPATCHER, FIRST_RESPONDER, OPERATOR"
    )
    is_active: bool = Field(default=True, description="Active account indicator")
    tenant_id: str = Field(..., description="Designated tenant organization ID")


class UserCreate(UserBase):
    """
    Payload for creating/registering a new tenant user.
    """
    password: str = Field(..., min_length=8, description="Raw secret password (minimum 8 characters)")


class UserUpdate(BaseModel):
    """
    Payload for modifying an existing user's attributes.
    """
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    password: Optional[str] = Field(None, min_length=8)
    role: Optional[str] = None
    is_active: Optional[bool] = None


class UserResponse(UserBase):
    """
    Safe public user response schema (excluding password hash).
    """
    id: str = Field(..., description="UUID identifier of the user")
    is_superuser: bool = Field(default=False, description="Global superadmin status")
    created_at: datetime = Field(..., description="Creation UTC timestamp")
    updated_at: datetime = Field(..., description="Last update UTC timestamp")

    model_config = ConfigDict(from_attributes=True)


# -----------------------------------------------------------------------------
# Enterprise SSO Simulation Schemas
# -----------------------------------------------------------------------------

class SSOLoginRequest(BaseModel):
    """
    Payload for federated Single Sign-On (SSO) simulation (SAML 2.0 / OIDC).
    Simulates identity providers from agencies (e.g. FEMA, INTERPOL, WHO, UN).
    """
    provider: str = Field(..., description="Identity Provider: FEMA_SAML, INTERPOL_OIDC, UN_OCHA, RED_CROSS_AD")
    identity_token: str = Field(..., description="Simulated SAML assertion or OIDC bearer token")
    email: EmailStr = Field(..., description="Federated identity email")
    tenant_id: str = Field(..., description="Target agency tenant ID")
    full_name: Optional[str] = Field(None, description="Display name from IdP assertions")
    role: Optional[str] = Field(default="OPERATOR", description="IdP asserted security group / role")
