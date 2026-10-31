import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin, require_staff_or_admin
from app.models.auth import User
from app.schemas.catalog import (
    TaxRuleCreate,
    TaxRulePublic,
    TaxRuleUpdate,
)
from app.schemas.common import PaginatedResponse
from app.services.catalog_service import (
    create_tax_rule,
    deactivate_tax_rule,
    get_tax_rule_by_id,
    list_tax_rules,
    update_tax_rule,
)

router = APIRouter(prefix="/taxes", tags=["Tax Rules"])


@router.post("/", response_model=TaxRulePublic, status_code=status.HTTP_201_CREATED)
def create_new_tax_rule(
    payload: TaxRuleCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Admin endpoint to create a tax rule."""
    tax_rule = create_tax_rule(
        db=db,
        data=payload,
        actor_user=admin_user,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return TaxRulePublic.model_validate(tax_rule)


@router.get("/", response_model=PaginatedResponse[TaxRulePublic])
def list_all_tax_rules(
    search: Optional[str] = Query(None, description="Search tax rule name"),
    tax_scope: Optional[str] = Query(None, description="Filter by tax scope"),
    jurisdiction_country: Optional[str] = Query(None, description="Filter by 2-letter country code"),
    jurisdiction_state: Optional[str] = Query(None, description="Filter by state name"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(require_staff_or_admin),
):
    """Staff/Admin endpoint to list tax rules."""
    items, total = list_tax_rules(
        db=db,
        search=search,
        tax_scope=tax_scope,
        jurisdiction_country=jurisdiction_country,
        jurisdiction_state=jurisdiction_state,
        is_active=is_active,
        page=page,
        page_size=page_size,
    )
    pages = (total + page_size - 1) // page_size if total > 0 else 0
    return PaginatedResponse(
        items=[TaxRulePublic.model_validate(t) for t in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.get("/{tax_rule_id}", response_model=TaxRulePublic)
def get_tax_rule(
    tax_rule_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff_or_admin),
):
    """Staff/Admin endpoint to get tax rule details."""
    tax_rule = get_tax_rule_by_id(db, tax_rule_id)
    return TaxRulePublic.model_validate(tax_rule)


@router.put("/{tax_rule_id}", response_model=TaxRulePublic)
def update_existing_tax_rule(
    tax_rule_id: uuid.UUID,
    payload: TaxRuleUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Admin endpoint to update tax rule details."""
    tax_rule = update_tax_rule(
        db=db,
        tax_rule_id=tax_rule_id,
        data=payload,
        actor_user=admin_user,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return TaxRulePublic.model_validate(tax_rule)


@router.delete("/{tax_rule_id}", response_model=TaxRulePublic)
def deactivate_existing_tax_rule(
    tax_rule_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Admin endpoint to deactivate a tax rule."""
    tax_rule = deactivate_tax_rule(
        db=db,
        tax_rule_id=tax_rule_id,
        actor_user=admin_user,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return TaxRulePublic.model_validate(tax_rule)
