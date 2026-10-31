import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin, require_staff_or_admin
from app.models.auth import User
from app.schemas.catalog import (
    PlanCreate,
    PlanPublic,
    PlanUpdate,
    TaxAssignmentRequest,
    TaxRulePublic,
)
from app.schemas.common import PaginatedResponse
from app.services.catalog_service import (
    assign_plan_taxes,
    create_plan,
    deactivate_plan,
    get_plan_by_id,
    get_plan_taxes,
    list_plans,
    update_plan,
)

router = APIRouter(prefix="/plans", tags=["Subscription Plans"])


@router.post("/", response_model=PlanPublic, status_code=status.HTTP_201_CREATED)
def create_new_plan(
    payload: PlanCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Admin endpoint to create a subscription plan."""
    plan = create_plan(
        db=db,
        data=payload,
        actor_user=admin_user,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return PlanPublic.model_validate(plan)


@router.get("/", response_model=PaginatedResponse[PlanPublic])
def list_all_plans(
    search: Optional[str] = Query(None, description="Search plan name or description"),
    billing_interval: Optional[str] = Query(None, description="Filter by interval: DAILY, WEEKLY, MONTHLY, YEARLY"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(require_staff_or_admin),
):
    """Staff/Admin endpoint to list plans."""
    items, total = list_plans(
        db=db,
        search=search,
        billing_interval=billing_interval,
        is_active=is_active,
        page=page,
        page_size=page_size,
    )
    pages = (total + page_size - 1) // page_size if total > 0 else 0
    return PaginatedResponse(
        items=[PlanPublic.model_validate(p) for p in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.get("/{plan_id}", response_model=PlanPublic)
def get_plan(
    plan_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff_or_admin),
):
    """Staff/Admin endpoint to get plan details."""
    plan = get_plan_by_id(db, plan_id)
    return PlanPublic.model_validate(plan)


@router.put("/{plan_id}", response_model=PlanPublic)
def update_existing_plan(
    plan_id: uuid.UUID,
    payload: PlanUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Admin endpoint to update plan details."""
    plan = update_plan(
        db=db,
        plan_id=plan_id,
        data=payload,
        actor_user=admin_user,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return PlanPublic.model_validate(plan)


@router.delete("/{plan_id}", response_model=PlanPublic)
def deactivate_existing_plan(
    plan_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Admin endpoint to deactivate a plan."""
    plan = deactivate_plan(
        db=db,
        plan_id=plan_id,
        actor_user=admin_user,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return PlanPublic.model_validate(plan)


@router.put("/{plan_id}/taxes", response_model=List[TaxRulePublic])
def set_plan_taxes(
    plan_id: uuid.UUID,
    payload: TaxAssignmentRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Admin endpoint to assign tax rules to a plan."""
    rules = assign_plan_taxes(
        db=db,
        plan_id=plan_id,
        tax_rule_ids=payload.tax_rule_ids,
        actor_user=admin_user,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return [TaxRulePublic.model_validate(r) for r in rules]


@router.get("/{plan_id}/taxes", response_model=List[TaxRulePublic])
def list_plan_taxes(
    plan_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff_or_admin),
):
    """Staff/Admin endpoint to view applicable taxes for a plan."""
    rules = get_plan_taxes(db, plan_id)
    return [TaxRulePublic.model_validate(r) for r in rules]
