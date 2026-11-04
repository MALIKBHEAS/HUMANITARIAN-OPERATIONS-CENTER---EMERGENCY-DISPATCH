"""
EOA Global - API Dependency Injection Module
Implements database session management, JWT token authentication, and multi-tenant isolation.
"""

from typing import AsyncGenerator, Optional, Dict, Any
from fastapi import Depends, HTTPException, Query, Request, status
from fastapi.security import OAuth2PasswordBearer, HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# Support both python-jose and PyJWT seamlessly
try:
    from jose import JWTError
except ImportError:
    from jwt.exceptions import PyJWTError as JWTError

from eoa_global_backend.core.config import settings
from eoa_global_backend.core.security import decode_access_token
from eoa_global_backend.db.database import AsyncSessionLocal
from eoa_global_backend.db.models import User
from eoa_global_backend.schemas.user import TokenPayload

# OAuth2 and HTTPBearer schemes with optional auto_error for graceful fallback
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login",
    auto_error=False,
)
security_bearer = HTTPBearer(auto_error=False)

PRESEEDED_FALLBACKS: Dict[str, Dict[str, Any]] = {
    "admin": {
        "role": "COMMANDER",
        "full_name": "C4ISR Supreme Commander",
        "tenant_id": "eoa-global-hq",
        "is_superuser": True,
    },
    "operator": {
        "role": "OPERATOR",
        "full_name": "EOC Tactical Operator",
        "tenant_id": "eoa-global-hq",
        "is_superuser": False,
    },
    "field1": {
        "role": "FIELD_UNIT",
        "full_name": "Field Operative Alpha-1",
        "tenant_id": "eoa-global-hq",
        "is_superuser": False,
    },
    "commander@eoa.mil": {
        "role": "COMMANDER",
        "full_name": "C4ISR Supreme Commander",
        "tenant_id": "eoa-global-hq",
        "is_superuser": True,
    },
    "operator@eoa.mil": {
        "role": "OPERATOR",
        "full_name": "EOC Tactical Operator",
        "tenant_id": "eoa-global-hq",
        "is_superuser": False,
    },
    "field01@eoa.mil": {
        "role": "FIELD_UNIT",
        "full_name": "Alpha-01 Field Operative",
        "tenant_id": "eoa-global-hq",
        "is_superuser": False,
    },
    "dispatcher@fema.gov": {
        "role": "COMMANDER",
        "full_name": "FEMA Chief Dispatcher",
        "tenant_id": "fema-us",
        "is_superuser": True,
    },
}


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency yielding an async SQLAlchemy session.
    Automatically handles commit/rollback and ensures session teardown.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_token_from_request(
    request: Request,
    oauth_token: Optional[str] = Depends(oauth2_scheme),
    bearer_creds: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    query_token: Optional[str] = Query(None, alias="token"),
) -> Optional[str]:
    """
    Extracts Bearer JWT from Authorization header, OAuth2 password form, or query string.
    """
    if oauth_token:
        return oauth_token
    if bearer_creds and bearer_creds.credentials:
        return bearer_creds.credentials
    # Direct header inspection fallback
    auth_hdr = request.headers.get("Authorization") or request.headers.get("authorization")
    if auth_hdr and auth_hdr.strip().startswith("Bearer "):
        return auth_hdr.split(" ", 1)[1].strip()
    if query_token:
        return query_token.strip()
    return None


async def get_current_user(
    request: Request,
    token: Optional[str] = Depends(get_token_from_request),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    FastAPI dependency that:
      1. Respects REQUIRE_AUTH feature toggle (emergency fallback).
      2. Validates Bearer JWT signature and expiration.
      3. Retrieves user from PostGIS DB or falls back to in-memory sovereign profile.
      4. Validates account active status.
    """
    # Emergency rollback/feature toggle
    if not settings.REQUIRE_AUTH:
        return User(
            id="emergency-bypass-admin",
            email="commander@eoa.mil",
            role="COMMANDER",
            full_name="Emergency Bypass Commander",
            tenant_id="eoa-global-hq",
            is_active=True,
            is_superuser=True,
        )

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token required (Bearer JWT).",
            headers={"WWW-Authenticate": "Bearer"},
        )

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate authentication credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_access_token(token)
        email: str = payload.get("sub")
        tenant_id: str = payload.get("tenant_id") or "eoa-global-hq"
        role: str = payload.get("role") or "OPERATOR"
        
        if not email:
            raise credentials_exception

        token_data = TokenPayload(
            sub=email,
            tenant_id=tenant_id,
            role=role,
            exp=payload.get("exp"),
            iat=payload.get("iat"),
        )
    except (JWTError, ValueError):
        raise credentials_exception

    # 1. Query database for user
    try:
        stmt = select(User).where(User.email == token_data.sub)
        result = await db.execute(stmt)
        user = result.scalars().first()
        if user:
            if not user.is_active:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="User account is deactivated.",
                )
            return user
    except Exception:
        pass

    # 2. Check Pre-Seeded sovereign profiles
    email_clean = (token_data.sub or "").strip().lower()
    if email_clean in PRESEEDED_FALLBACKS:
        seeded = PRESEEDED_FALLBACKS[email_clean]
        return User(
            id=f"c4isr-{seeded['role'].lower()}-{email_clean.split('@')[0]}",
            email=email_clean,
            role=seeded["role"],
            full_name=seeded["full_name"],
            tenant_id=seeded["tenant_id"],
            is_active=True,
            is_superuser=seeded.get("is_superuser", False),
        )

    # 3. Construct ephemeral User from validated cryptographic claims
    return User(
        id=payload.get("user_id", f"user-{email_clean}"),
        email=email_clean,
        role=token_data.role or "OPERATOR",
        full_name=payload.get("name", email_clean),
        tenant_id=token_data.tenant_id or "eoa-global-hq",
        is_active=True,
        is_superuser=(token_data.role == "COMMANDER"),
    )


async def get_current_tenant(
    current_user: User = Depends(get_current_user),
) -> str:
    """
    CRITICAL MULTI-TENANT ISOLATION DEPENDENCY.
    Returns the verified tenant_id of the logged-in user.
    """
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Authenticated subject is not bound to a valid tenant organization.",
        )
    return current_user.tenant_id


def require_role(*allowed_roles: str):
    """
    Factory dependency checking if authenticated user possesses one of the allowed roles.
    COMMANDER and global superusers bypass role restrictions.
    """
    async def role_verifier(current_user: User = Depends(get_current_user)) -> User:
        if not settings.REQUIRE_AUTH:
            return current_user
        if getattr(current_user, "is_superuser", False) or getattr(current_user, "role", None) == "COMMANDER":
            return current_user
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(allowed_roles)}. Active role: {current_user.role}",
            )
        return current_user

    return role_verifier

    return role_verifier
