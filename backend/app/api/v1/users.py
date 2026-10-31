import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin
from app.models.auth import User
from app.schemas.auth import UserCreateAdmin, UserPublic, UserUpdate
from app.schemas.common import PaginatedResponse
from app.services.audit_service import log_audit_event
from app.services.auth_service import create_staff_or_admin_user

router = APIRouter(prefix="/users", tags=["User Management"])


@router.post("/", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
def create_privileged_user(
    payload: UserCreateAdmin,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Admin-only endpoint to provision STAFF or ADMIN accounts."""
    new_user = create_staff_or_admin_user(
        db=db,
        data=payload,
        actor_user=admin_user,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return UserPublic.model_validate(new_user)


@router.get("/", response_model=PaginatedResponse[UserPublic])
def list_users(
    search: Optional[str] = Query(None, description="Search by email or name"),
    role: Optional[str] = Query(None, pattern="^(ADMIN|STAFF|CUSTOMER)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Admin-only endpoint to list and search users."""
    query = db.query(User)
    if role:
        query = query.filter(User.role == role)
    if search:
        search_pattern = f"%{search.strip().lower()}%"
        query = query.filter(
            (User.email.ilike(search_pattern)) | (User.full_name.ilike(search_pattern))
        )

    total = query.count()
    offset = (page - 1) * page_size
    items = query.order_by(User.created_at.desc()).offset(offset).limit(page_size).all()
    pages = (total + page_size - 1) // page_size if page_size else 1

    return PaginatedResponse[UserPublic](
        items=[UserPublic.model_validate(u) for u in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.get("/{user_id}", response_model=UserPublic)
def get_user(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Admin-only endpoint to retrieve any user by ID."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )
    return UserPublic.model_validate(user)


@router.patch("/{user_id}", response_model=UserPublic)
def update_user(
    user_id: uuid.UUID,
    payload: UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Admin-only endpoint to update user status or name."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    # Protect against admin self-deactivation
    if user.id == admin_user.id and payload.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot deactivate their own active account.",
        )

    update_dict = payload.model_dump(exclude_unset=True)
    for field, val in update_dict.items():
        setattr(user, field, val)

    db.flush()
    log_audit_event(
        db=db,
        action="USER_UPDATED",
        entity_name="users",
        entity_id=user.id,
        actor_user_id=admin_user.id,
        ip_address=request.client.host if request.client else None,
        details={"updated_fields": list(update_dict.keys())},
    )
    db.commit()
    return UserPublic.model_validate(user)
