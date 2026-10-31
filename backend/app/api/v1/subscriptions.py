from typing import Optional
import uuid
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import (
    get_current_user,
    get_db,
    require_staff_or_admin,
)
from app.models.auth import User
from app.models.subscription import Subscription
from app.schemas.common import PaginatedResponse
from app.schemas.subscription import (
    CloseSubscriptionRequest,
    ConvertQuotationRequest,
    PauseSubscriptionRequest,
    ResumeSubscriptionRequest,
    SubscriptionDetailPublic,
    SubscriptionPublic,
)
from app.services.subscription_service import (
    activate_subscription,
    close_subscription,
    convert_quotation_to_subscription,
    get_subscription_by_id,
    list_subscriptions,
    pause_subscription,
    resume_subscription,
)

router = APIRouter(prefix="/subscriptions", tags=["Subscription Lifecycle"])


@router.post("/from-quotation/{quotation_id}", response_model=SubscriptionPublic, status_code=status.HTTP_201_CREATED)
def create_subscription_from_quotation(
    quotation_id: uuid.UUID,
    payload: ConvertQuotationRequest,
    request: Request,
    db: Session = Depends(get_db),
    actor_user: User = Depends(require_staff_or_admin),
):
    """
    Convert an approved/confirmed quotation into an active subscription.
    Enforces atomic transaction, idempotency, and preserves commercial snapshots.
    """
    sub = convert_quotation_to_subscription(
        db=db,
        quotation_id=quotation_id,
        data=payload,
        actor_user=actor_user,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return SubscriptionPublic.model_validate(sub)


@router.get("/", response_model=PaginatedResponse[SubscriptionPublic])
def list_all_subscriptions(
    customer_id: Optional[uuid.UUID] = Query(None, description="Filter by customer organization"),
    status: Optional[str] = Query(None, description="Filter by status: ACTIVE, PAUSED, CLOSED, etc."),
    search: Optional[str] = Query(None, description="Search subscription number or plan name"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List subscriptions.
    - ADMIN/STAFF: view all or filtered by customer.
    - CUSTOMER: view only subscriptions for authenticated organization.
    """
    items, total = list_subscriptions(
        db=db,
        current_user=current_user,
        customer_id=customer_id,
        status_filter=status,
        search=search,
        page=page,
        page_size=page_size,
    )
    pages = (total + page_size - 1) // page_size if total > 0 else 0
    return PaginatedResponse(
        items=[SubscriptionPublic.model_validate(s) for s in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.get("/{subscription_id}", response_model=SubscriptionDetailPublic)
def get_subscription(
    subscription_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get subscription detail with lines, taxes, and pause history."""
    sub = get_subscription_by_id(db, subscription_id, current_user)
    detail = SubscriptionDetailPublic.model_validate(sub)
    detail.customer_company_name = sub.customer.company_name if sub.customer else None
    return detail


@router.post("/{subscription_id}/activate", response_model=SubscriptionPublic)
def activate_sub(
    subscription_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    actor_user: User = Depends(require_staff_or_admin),
):
    """Staff/Admin endpoint to activate a confirmed subscription."""
    sub = activate_subscription(
        db=db,
        subscription_id=subscription_id,
        actor_user=actor_user,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return SubscriptionPublic.model_validate(sub)


@router.post("/{subscription_id}/pause", response_model=SubscriptionPublic)
def pause_sub(
    subscription_id: uuid.UUID,
    payload: PauseSubscriptionRequest,
    request: Request,
    db: Session = Depends(get_db),
    actor_user: User = Depends(require_staff_or_admin),
):
    """Staff/Admin endpoint to pause an active subscription."""
    sub = pause_subscription(
        db=db,
        subscription_id=subscription_id,
        data=payload,
        actor_user=actor_user,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return SubscriptionPublic.model_validate(sub)


@router.post("/{subscription_id}/resume", response_model=SubscriptionPublic)
def resume_sub(
    subscription_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    actor_user: User = Depends(require_staff_or_admin),
):
    """Staff/Admin endpoint to resume a paused subscription."""
    sub = resume_subscription(
        db=db,
        subscription_id=subscription_id,
        actor_user=actor_user,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return SubscriptionPublic.model_validate(sub)


@router.post("/{subscription_id}/close", response_model=SubscriptionPublic)
def close_sub(
    subscription_id: uuid.UUID,
    payload: CloseSubscriptionRequest,
    request: Request,
    db: Session = Depends(get_db),
    actor_user: User = Depends(require_staff_or_admin),
):
    """Staff/Admin endpoint to cancel/close a subscription."""
    sub = close_subscription(
        db=db,
        subscription_id=subscription_id,
        data=payload,
        actor_user=actor_user,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return SubscriptionPublic.model_validate(sub)
