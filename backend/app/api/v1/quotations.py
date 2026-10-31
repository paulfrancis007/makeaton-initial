from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import (
    get_current_user,
    get_db,
    require_admin,
    require_staff_or_admin,
)
from app.models.auth import User
from app.models.quotation import Quotation, QuotationTemplate
from app.schemas.common import PaginatedResponse
from app.schemas.quotation import (
    QuotationCreate,
    QuotationDetailPublic,
    QuotationPublic,
    QuotationStatusUpdate,
    QuotationTemplateCreate,
    QuotationTemplatePublic,
    QuotationTemplateUpdate,
    QuotationUpdate,
)
from app.services.quotation_service import (
    create_quotation,
    create_quotation_template,
    get_quotation_by_id,
    get_quotation_template_by_id,
    list_quotation_templates,
    list_quotations,
    update_quotation,
    update_quotation_status,
)

router = APIRouter(prefix="/quotations", tags=["Quotation Management"])


# ---------------------------------------------------------
# Quotation Templates Endpoints
# ---------------------------------------------------------

@router.post("/templates", response_model=QuotationTemplatePublic, status_code=status.HTTP_201_CREATED)
def create_template(
    payload: QuotationTemplateCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Admin endpoint to create a reusable quotation template."""
    tpl = create_quotation_template(
        db=db,
        data=payload,
        actor_user=admin_user,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return QuotationTemplatePublic.model_validate(tpl)


@router.get("/templates", response_model=PaginatedResponse[QuotationTemplatePublic])
def list_templates(
    search: Optional[str] = Query(None, description="Search template name or description"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(require_staff_or_admin),
):
    """Staff/Admin endpoint to list quotation templates."""
    items, total = list_quotation_templates(
        db=db,
        search=search,
        is_active=is_active,
        page=page,
        page_size=page_size,
    )
    pages = (total + page_size - 1) // page_size if total > 0 else 0
    return PaginatedResponse(
        items=[QuotationTemplatePublic.model_validate(t) for t in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.get("/templates/{template_id}", response_model=QuotationTemplatePublic)
def get_template(
    template_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff_or_admin),
):
    """Staff/Admin endpoint to get template details."""
    tpl = get_quotation_template_by_id(db, template_id)
    return QuotationTemplatePublic.model_validate(tpl)


# ---------------------------------------------------------
# Quotation Endpoints
# ---------------------------------------------------------

@router.post("/", response_model=QuotationPublic, status_code=status.HTTP_201_CREATED)
def create_new_quotation(
    payload: QuotationCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor_user: User = Depends(require_staff_or_admin),
):
    """Staff/Admin endpoint to create a quotation."""
    quote = create_quotation(
        db=db,
        data=payload,
        actor_user=actor_user,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return QuotationPublic.model_validate(quote)


@router.get("/", response_model=PaginatedResponse[QuotationPublic])
def list_all_quotations(
    customer_id: Optional[uuid.UUID] = Query(None, description="Filter by customer organization"),
    status: Optional[str] = Query(None, description="Filter by status: DRAFT, SENT, CONFIRMED, EXPIRED, REJECTED"),
    search: Optional[str] = Query(None, description="Search quotation number or notes"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List accessible quotations.
    - ADMIN/STAFF: view all or filtered by customer.
    - CUSTOMER: view only quotations for authenticated organization.
    """
    items, total = list_quotations(
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
        items=[QuotationPublic.model_validate(q) for q in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.get("/{quotation_id}", response_model=QuotationDetailPublic)
def get_quotation(
    quotation_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get quotation details with itemized lines, taxes, and customer info."""
    quote = get_quotation_by_id(db, quotation_id, current_user)
    detail = QuotationDetailPublic.model_validate(quote)
    detail.plan_name = quote.plan.name if quote.plan else None
    detail.customer_company_name = quote.customer.company_name if quote.customer else None
    return detail


@router.put("/{quotation_id}", response_model=QuotationDetailPublic)
def update_existing_quotation(
    quotation_id: uuid.UUID,
    payload: QuotationUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor_user: User = Depends(require_staff_or_admin),
):
    """Staff/Admin endpoint to update quotation in DRAFT status."""
    quote = update_quotation(
        db=db,
        quotation_id=quotation_id,
        data=payload,
        actor_user=actor_user,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    detail = QuotationDetailPublic.model_validate(quote)
    detail.plan_name = quote.plan.name if quote.plan else None
    detail.customer_company_name = quote.customer.company_name if quote.customer else None
    return detail


@router.post("/{quotation_id}/status", response_model=QuotationPublic)
def transition_quotation_status(
    quotation_id: uuid.UUID,
    payload: QuotationStatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor_user: User = Depends(get_current_user),
):
    """
    Transition quotation status.
    - Staff/Admin: can mark SENT, CONFIRMED, or REJECTED.
    - Customer: can mark CONFIRMED (approve) or REJECTED (decline) for own quotation.
    """
    if actor_user.role == "CUSTOMER" and payload.status not in ("CONFIRMED", "REJECTED"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Customers can only confirm or reject quotations.",
        )

    quote = update_quotation_status(
        db=db,
        quotation_id=quotation_id,
        data=payload,
        actor_user=actor_user,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return QuotationPublic.model_validate(quote)
