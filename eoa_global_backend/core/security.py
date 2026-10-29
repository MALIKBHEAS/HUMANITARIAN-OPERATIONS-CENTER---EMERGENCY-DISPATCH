"""
EOA Global - Security and Cryptography Module
Handles Bcrypt password hashing and JWT token issuance with embedded multi-tenant claims.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Union
from passlib.context import CryptContext

# Support both python-jose and PyJWT seamlessly
try:
    from jose import JWTError, jwt
except ImportError:
    import jwt
    from jwt.exceptions import PyJWTError as JWTError

import bcrypt
from eoa_global_backend.core.config import settings

# Password hashing context with bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a plain text password against the hashed representation stored in the database.
    Directly leverages native bcrypt with 72-byte truncation safe guards.
    """
    try:
        plain_bytes = (plain_password or "").encode("utf-8")[:72]
        hashed_bytes = (hashed_password or "").encode("utf-8")
        return bcrypt.checkpw(plain_bytes, hashed_bytes)
    except Exception:
        try:
            return pwd_context.verify(plain_password, hashed_password)
        except Exception:
            return False


def get_password_hash(password: str) -> str:
    """
    Generates a secure Bcrypt hash for a plain text password.
    Directly leverages native bcrypt with 72-byte truncation safe guards.
    """
    try:
        pwd_bytes = (password or "default123").encode("utf-8")[:72]
        salt = bcrypt.gensalt(rounds=12)
        return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")
    except Exception:
        return pwd_context.hash(password)


def create_access_token(
    subject: Union[str, Any],
    tenant_id: str,
    expires_delta: Optional[timedelta] = None,
    extra_claims: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Creates an enterprise JWT access token embedding:
      - sub: The subject identity (typically the user email or primary identifier).
      - tenant_id: The mandatory tenant identifier for strict multi-tenant boundary isolation.
      - iat: Issued at timestamp.
      - exp: Expiration timestamp.
      - Any additional custom claims (e.g. role, permissions).
    """
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    payload: Dict[str, Any] = {
        "sub": str(subject),
        "tenant_id": str(tenant_id),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }

    if extra_claims:
        payload.update(extra_claims)

    encoded_jwt = jwt.encode(
        payload,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )
    # PyJWT returns string in v2+, python-jose returns string as well
    return encoded_jwt


def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Decodes and cryptographically validates a JWT token using the system secret key and algorithm.
    Raises JWTError if invalid, expired, or tampered with.
    """
    return jwt.decode(
        token,
        settings.SECRET_KEY,
        algorithms=[settings.ALGORITHM],
    )
