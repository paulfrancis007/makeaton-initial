import datetime
from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin, require_staff_or_admin
from app.db.session import get_db
from app.models.auth import User
from app.models.governance import CompanySetting
from app.schemas.billing import (
    BillingRunResult,
    InvoiceDetailResponse,
    InvoiceResponse,
    RunBillingRequest,
)
from app.schemas.common import PaginatedResponse
from app.services.billing_service import (
    cancel_invoice,
    create_invoice_from_subscription,
    get_invoice_by_id,
    list_invoices,
    run_recurring_billing,
)
from app.services.email_service import send_invoice_email
from app.services.pdf_service import generate_invoice_pdf

router = APIRouter(prefix="/invoices", tags=["Invoice Management"])


def _format_invoice_response(inv) -> InvoiceResponse:
    today = datetime.date.today()
    is_overdue = inv.due_date < today and inv.balance_due > 0 and inv.status != "CANCELLED"
    return InvoiceResponse(
        id=inv.id,
        invoice_number=inv.invoice_number,
        subscription_id=inv.subscription_id,
        customer_id=inv.customer_id,
        customer_name=inv.customer.company_name if inv.customer else None,
        subscription_number=inv.subscription.subscription_number if inv.subscription else None,
        status=inv.status,
        issue_date=inv.issue_date,
        due_date=inv.due_date,
        billing_period_start=inv.billing_period_start,
        billing_period_end=inv.billing_period_end,
        subtotal_amount=inv.subtotal_amount,
        discount_amount=inv.discount_amount,
        tax_amount=inv.tax_amount,
        rounding_adjustment=inv.rounding_adjustment,
        total_amount=inv.total_amount,
        amount_paid=inv.amount_paid,
        balance_due=inv.balance_due,
        currency=inv.currency,
        notes=inv.notes,
        is_overdue=is_overdue,
        created_at=inv.created_at,
        updated_at=inv.updated_at,
    )


def _format_invoice_detail_response(inv) -> InvoiceDetailResponse:
    base = _format_invoice_response(inv)
    lines_resp = []
    for l in inv.lines:
        taxes_resp = [
            {
                "id": t.id,
                "invoice_line_id": t.invoice_line_id,
                "tax_rule_id": t.tax_rule_id,
                "tax_name_snapshot": t.tax_name_snapshot,
                "tax_rate_snapshot": t.tax_rate_snapshot,
                "tax_amount": t.tax_amount,
            }
            for t in l.taxes
        ]
        lines_resp.append(
            {
                "id": l.id,
                "invoice_id": l.invoice_id,
                "line_type": l.line_type,
                "product_id": l.product_id,
                "variant_id": l.variant_id,
                "description": l.description,
                "quantity": l.quantity,
                "unit_price": l.unit_price,
                "tax_rate": l.tax_rate,
                "tax_amount": l.tax_amount,
                "discount_amount": l.discount_amount,
                "line_total": l.line_total,
                "taxes": taxes_resp,
            }
        )

    payments_resp = [
        {
            "id": p.id,
            "payment_number": p.payment_number,
            "invoice_id": p.invoice_id,
            "customer_id": p.customer_id,
            "customer_name": inv.customer.company_name if inv.customer else None,
            "invoice_number": inv.invoice_number,
            "amount": p.amount,
            "payment_method": p.payment_method,
            "status": p.status,
            "payment_date": p.payment_date,
            "reference_number": p.reference_number,
            "notes": p.notes,
            "voided_at": p.voided_at,
            "voided_by_user_id": p.voided_by_user_id,
            "void_reason": p.void_reason,
            "recorded_by_user_id": p.recorded_by_user_id,
            "created_at": p.created_at,
        }
        for p in inv.payments
    ]

    return InvoiceDetailResponse(
        **base.model_dump(),
        lines=lines_resp,
        payments=payments_resp,
    )


@router.get("/", response_model=PaginatedResponse[InvoiceResponse])
def get_invoices(
    customer_id: Optional[uuid.UUID] = Query(None),
    subscription_id: Optional[uuid.UUID] = Query(None),
    status: Optional[str] = Query(None),
    overdue_only: bool = Query(False),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List invoices with search, filtering, and tenant isolation."""
    invoices, total = list_invoices(
        db=db,
        current_user=current_user,
        customer_id=customer_id,
        subscription_id=subscription_id,
        status_filter=status,
        overdue_only=overdue_only,
        search=search,
        page=page,
        size=size,
    )

    items = [_format_invoice_response(inv) for inv in invoices]
    pages = (total + size - 1) // size if total > 0 else 0

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=pages,
    )


@router.get("/{invoice_id}", response_model=InvoiceDetailResponse)
def get_invoice(
    invoice_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve full invoice details with line items and payments."""
    inv = get_invoice_by_id(db, invoice_id, current_user)
    return _format_invoice_detail_response(inv)


@router.post("/from-subscription/{subscription_id}", response_model=InvoiceDetailResponse)
def create_invoice_from_subscription_endpoint(
    subscription_id: uuid.UUID,
    billing_date: Optional[datetime.date] = Query(None),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff_or_admin),
):
    """Generate an invoice on-demand for an active subscription (STAFF / ADMIN)."""
    ip = request.client.host if request and request.client else None
    inv, _ = create_invoice_from_subscription(
        db=db,
        subscription_id=subscription_id,
        actor_user=current_user,
        billing_date=billing_date,
        ip_address=ip,
    )
    db.commit()
    db.refresh(inv)
    return _format_invoice_detail_response(inv)


@router.post("/run-billing", response_model=BillingRunResult)
def run_billing_endpoint(
    req: RunBillingRequest = RunBillingRequest(),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff_or_admin),
):
    """Trigger batch recurring billing run for eligible subscriptions (STAFF / ADMIN)."""
    ip = request.client.host if request and request.client else None
    result = run_recurring_billing(
        db=db,
        billing_date=req.billing_date,
        batch_size=req.batch_size,
        actor_user=current_user,
        ip_address=ip,
    )
    return BillingRunResult(**result)


@router.post("/{invoice_id}/cancel", response_model=InvoiceResponse)
def cancel_invoice_endpoint(
    invoice_id: uuid.UUID,
    reason: Optional[str] = Query(None),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff_or_admin),
):
    """Cancel an unpaid invoice (STAFF / ADMIN)."""
    ip = request.client.host if request and request.client else None
    inv = cancel_invoice(
        db=db,
        invoice_id=invoice_id,
        current_user=current_user,
        reason=reason,
        ip_address=ip,
    )
    return _format_invoice_response(inv)


@router.get("/{invoice_id}/pdf")
def download_invoice_pdf(
    invoice_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate and stream a valid PDF invoice document with tenant isolation."""
    inv = get_invoice_by_id(db, invoice_id, current_user)
    company = db.query(CompanySetting).filter(CompanySetting.id == 1).first()
    pdf_bytes = generate_invoice_pdf(inv, company)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="Invoice-{inv.invoice_number}.pdf"',
        },
    )


@router.post("/{invoice_id}/send-email")
def send_invoice_email_endpoint(
    invoice_id: uuid.UUID,
    recipient_email: Optional[str] = Query(None),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dispatch invoice email with attached PDF (gracefully handles unconfigured SMTP)."""
    inv = get_invoice_by_id(db, invoice_id, current_user)
    ip = request.client.host if request and request.client else None
    result = send_invoice_email(
        db=db,
        invoice=inv,
        recipient_email=recipient_email,
        actor_user=current_user,
        ip_address=ip,
    )
    return result

