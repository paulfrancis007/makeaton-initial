from typing import Optional
import uuid
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.db.session import get_db
from app.models.auth import User
from app.models.governance import AuditLog
from app.schemas.audit import AuditLogPublic
from app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/audit", tags=["Audit & Governance"])


@router.get("/", response_model=PaginatedResponse[AuditLogPublic])
def list_audit_logs(
    action: Optional[str] = Query(None),
    entity_name: Optional[str] = Query(None),
    entity_id: Optional[uuid.UUID] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Retrieve audit trail logs (ADMIN only)."""
    query = db.query(AuditLog)

    if action:
        query = query.filter(AuditLog.action == action)
    if entity_name:
        query = query.filter(AuditLog.entity_name == entity_name)
    if entity_id:
        query = query.filter(AuditLog.entity_id == entity_id)

    total = query.count()
    logs = (
        query.order_by(AuditLog.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
        .all()
    )

    pages = (total + size - 1) // size if total > 0 else 0

    return PaginatedResponse(
        items=logs,
        total=total,
        page=page,
        size=size,
        pages=pages,
    )
