import uuid
from typing import Any, Dict, Optional
from sqlalchemy.orm import Session

from app.models.governance import AuditLog

_SENSITIVE_KEYS = {"password", "token", "secret", "hashed_password", "token_hash", "bootstrap_token"}


def _sanitize_details(data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not data:
        return {}
    sanitized = {}
    for k, v in data.items():
        if any(sens in k.lower() for sens in _SENSITIVE_KEYS):
            continue
        if isinstance(v, dict):
            sanitized[k] = _sanitize_details(v)
        else:
            sanitized[k] = v
    return sanitized


def log_audit_event(
    db: Session,
    action: str,
    entity_name: str,
    entity_id: Optional[uuid.UUID] = None,
    actor_user_id: Optional[uuid.UUID] = None,
    ip_address: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
) -> AuditLog:
    """Record an immutable audit log entry in the current transaction."""
    clean_details = _sanitize_details(details)
    audit = AuditLog(
        actor_user_id=actor_user_id,
        action=action,
        entity_name=entity_name,
        entity_id=entity_id,
        ip_address=ip_address,
        details=clean_details,
    )
    db.add(audit)
    db.flush()
    return audit
