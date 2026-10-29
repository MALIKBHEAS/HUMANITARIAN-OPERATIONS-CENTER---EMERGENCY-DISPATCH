"""
EOA Global - API Dependency Injection Module
Implements database session management, JWT token authentication, and multi-tenant isolation.
"""

from typing import AsyncGenerator
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
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

# Standard OAuth2 scheme pointing to the login endpoint
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login"
)


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


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    FastAPI dependency that:
      1. Cryptographically validates and decodes the JWT access token.
      2. Extracts the subject (user email) and required tenant_id claims.
      3. Retrieves the User record from the database filtered by tenant boundary.
      4. Validates account active status.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate authentication credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_access_token(token)
        email: str = payload.get("sub")
        tenant_id: str = payload.get("tenant_id")
        
        if not email or not tenant_id:
            raise credentials_exception

        token_data = TokenPayload(
            sub=email,
            tenant_id=tenant_id,
            role=payload.get("role"),
            exp=payload.get("exp"),
            iat=payload.get("iat"),
        )
    except (JWTError, ValueError):
        raise credentials_exception

    # Query user ensuring tenant isolation in credential resolution
    stmt = select(User).where(
        User.email == token_data.sub,
        User.tenant_id == token_data.tenant_id,
    )
    result = await db.execute(stmt)
    user = result.scalars().first()

    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated.",
        )

    return user


async def get_current_tenant(
    current_user: User = Depends(get_current_user),
) -> str:
    """
    CRITICAL MULTI-TENANT ISOLATION DEPENDENCY.
    
    Returns the verified tenant_id of the logged-in user.
    Every downstream API route and repository method MUST use this to inject:
        .filter(Model.tenant_id == current_tenant)
    
    This guarantees 100% cryptographic and logical data isolation between 
    different national agencies, jurisdictions, and international organizations.
    """
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Authenticated subject is not bound to a valid tenant organization.",
        )
    return current_user.tenant_id


def require_role(*allowed_roles: str):
    """
    Factory dependency checking if the authenticated user possesses one of the allowed roles.
    Global superusers bypass role restrictions.
    """
    async def role_verifier(current_user: User = Depends(get_current_user)) -> User:
        if current_user.is_superuser:
            return current_user
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(allowed_roles)}",
            )
        return current_user

    return role_verifier
