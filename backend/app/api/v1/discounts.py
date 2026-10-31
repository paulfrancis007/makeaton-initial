import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin, require_staff_or_admin
from app.models.auth import User
from app.models.discount import DiscountRule
from app.schemas.common import PaginatedResponse
from app.schemas.discount import (
    DiscountEvaluationRequest,
    DiscountEvaluationResponse,
    DiscountRuleCreate,
    DiscountRulePublic,
    DiscountRuleUpdate,
)
from app.services.discount_service import (
    create_discount_rule,
    deactivate_discount_rule,
    evaluate_discount,
    get_discount_rule_by_id,
    list_discount_rules,
    update_discount_rule,
)

router = APIRouter(prefix="/discounts", tags=["Discount Rules"])


def _to_public_schema(rule: DiscountRule) -> DiscountRulePublic:
    eligible_pids = [drp.product_id for drp in rule.products] if rule.products else []
    return DiscountRulePublic(
        id=rule.id,
        code=rule.code,
        name=rule.name,
        discount_type=rule.discount_type,
        discount_value=rule.discount_value,
        scope=rule.scope,
        application_frequency=rule.application_frequency,
        max_cycles=rule.max_cycles,
        minimum_purchase_amount=rule.minimum_purchase_amount,
        minimum_quantity=rule.minimum_quantity,
        valid_from=rule.valid_from,
        valid_until=rule.valid_until,
        max_uses=rule.max_uses,
        current_uses=rule.current_uses,
        is_active=rule.is_active,
        created_at=rule.created_at,
        updated_at=rule.updated_at,
        eligible_product_ids=eligible_pids,
    )


@router.post("/", response_model=DiscountRulePublic, status_code=status.HTTP_201_CREATED)
def create_new_discount_rule(
    payload: DiscountRuleCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Admin endpoint to create a discount rule."""
    rule = create_discount_rule(
        db=db,
        data=payload,
        actor_user=admin_user,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return _to_public_schema(rule)


@router.get("/", response_model=PaginatedResponse[DiscountRulePublic])
def list_all_discount_rules(
    search: Optional[str] = Query(None, description="Search discount code or name"),
    discount_type: Optional[str] = Query(None, description="Filter by PERCENTAGE or FIXED_AMOUNT"),
    scope: Optional[str] = Query(None, description="Filter by ORDER or PRODUCT_SELECTION"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(require_staff_or_admin),
):
    """Staff/Admin endpoint to list discount rules."""
    items, total = list_discount_rules(
        db=db,
        search=search,
        discount_type=discount_type,
        scope=scope,
        is_active=is_active,
        page=page,
        page_size=page_size,
    )
    pages = (total + page_size - 1) // page_size if total > 0 else 0
    return PaginatedResponse(
        items=[_to_public_schema(r) for r in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.get("/{discount_rule_id}", response_model=DiscountRulePublic)
def get_discount_rule(
    discount_rule_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff_or_admin),
):
    """Staff/Admin endpoint to get discount rule details."""
    rule = get_discount_rule_by_id(db, discount_rule_id)
    return _to_public_schema(rule)


@router.put("/{discount_rule_id}", response_model=DiscountRulePublic)
def update_existing_discount_rule(
    discount_rule_id: uuid.UUID,
    payload: DiscountRuleUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Admin endpoint to update discount rule details."""
    rule = update_discount_rule(
        db=db,
        discount_rule_id=discount_rule_id,
        data=payload,
        actor_user=admin_user,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return _to_public_schema(rule)


@router.delete("/{discount_rule_id}", response_model=DiscountRulePublic)
def deactivate_existing_discount_rule(
    discount_rule_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Admin endpoint to deactivate a discount rule."""
    rule = deactivate_discount_rule(
        db=db,
        discount_rule_id=discount_rule_id,
        actor_user=admin_user,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return _to_public_schema(rule)


@router.post("/evaluate", response_model=DiscountEvaluationResponse)
def evaluate_discount_rule(
    payload: DiscountEvaluationRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff_or_admin),
):
    """Staff/Admin endpoint to evaluate discount code eligibility and calculate discount amount."""
    result = evaluate_discount(db, payload)
    return result
