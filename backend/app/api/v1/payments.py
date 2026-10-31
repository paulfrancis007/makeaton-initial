from typing import Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin, require_staff_or_admin
from app.db.session import get_db
from app.models.auth import User
from app.schemas.billing import PaymentCreateRequest, PaymentResponse, PaymentVoidRequest
from app.schemas.common import PaginatedResponse
from app.services.payment_service import (
    get_payment_by_id,
    list_payments,
    record_payment,
    void_payment,
)

router = APIRouter(prefix="/payments", tags=["Payment Management"])


def _format_payment_response(p) -> PaymentResponse:
    return PaymentResponse(
        id=p.id,
        payment_number=p.payment_number,
        invoice_id=p.invoice_id,
        customer_id=p.customer_id,
        customer_name=p.customer.company_name if p.customer else None,
        invoice_number=p.invoice.invoice_number if p.invoice else None,
        amount=p.amount,
        payment_method=p.payment_method,
        status=p.status,
        payment_date=p.payment_date,
        reference_number=p.reference_number,
        notes=p.notes,
        voided_at=p.voided_at,
        voided_by_user_id=p.voided_by_user_id,
        void_reason=p.void_reason,
        recorded_by_user_id=p.recorded_by_user_id,
        created_at=p.created_at,
    )


@router.get("/", response_model=PaginatedResponse[PaymentResponse])
def get_payments(
    invoice_id: Optional[uuid.UUID] = Query(None),
    customer_id: Optional[uuid.UUID] = Query(None),
    status: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List payments with filtering and tenant isolation."""
    payments, total = list_payments(
        db=db,
        current_user=current_user,
        invoice_id=invoice_id,
        customer_id=customer_id,
        status_filter=status,
        payment_method=payment_method,
        page=page,
        size=size,
    )

    items = [_format_payment_response(p) for p in payments]
    pages = (total + size - 1) // size if total > 0 else 0

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=pages,
    )


@router.get("/{payment_id}", response_model=PaymentResponse)
def get_payment(
    payment_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve payment details."""
    p = get_payment_by_id(db, payment_id, current_user)
    return _format_payment_response(p)


@router.post("/", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
def record_payment_endpoint(
    req: PaymentCreateRequest,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff_or_admin),
):
    """Record a payment against an invoice (STAFF / ADMIN)."""
    ip = request.client.host if request and request.client else None
    p = record_payment(
        db=db,
        data=req,
        current_user=current_user,
        ip_address=ip,
    )
    return _format_payment_response(p)


@router.post("/{payment_id}/void", response_model=PaymentResponse)
def void_payment_endpoint(
    payment_id: uuid.UUID,
    req: PaymentVoidRequest,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff_or_admin),
):
    """Void a payment record and atomically recalculate invoice balances (STAFF / ADMIN)."""
    ip = request.client.host if request and request.client else None
    p = void_payment(
        db=db,
        payment_id=payment_id,
        void_reason=req.void_reason,
        current_user=current_user,
        ip_address=ip,
    )
    return _format_payment_response(p)
