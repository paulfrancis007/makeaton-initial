import datetime
import re
from typing import Any, Dict, Optional
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHashError

from app.core.config import settings

_ph = PasswordHasher()


def hash_password(password: str) -> str:
    """Hash a plaintext password using Argon2id."""
    return _ph.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against an Argon2id hash."""
    try:
        return _ph.verify(hashed_password, plain_password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def validate_password_strength(password: str) -> None:
    """
    Validate password strength per Brightloop security rules:
    - More than 8 characters (at least 9 chars).
    - At least one uppercase character.
    - At least one lowercase character.
    - At least one special character.
    """
    if len(password) <= 8:
        raise ValueError("Password must be more than 8 characters long.")
    if not any(c.isupper() for c in password):
        raise ValueError("Password must contain at least one uppercase character.")
    if not any(c.islower() for c in password):
        raise ValueError("Password must contain at least one lowercase character.")
    if not any(not c.isalnum() for c in password):
        raise ValueError("Password must contain at least one special character.")


def create_access_token(subject: str | Dict[str, Any], expires_delta: Optional[datetime.timedelta] = None) -> str:
    """Create a signed JWT access token."""
    now = datetime.datetime.now(datetime.timezone.utc)
    expire = now + (expires_delta or datetime.timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))

    payload: Dict[str, Any] = {
        "exp": expire,
        "iat": now,
        "nbf": now,
    }
    if isinstance(subject, str):
        payload["sub"] = subject
    else:
        payload.update(subject)

    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decode and validate a signed JWT access token."""
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
