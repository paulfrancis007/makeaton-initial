import datetime
from decimal import Decimal
import logging
from typing import List, Optional, Tuple
import uuid
from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.auth import User
from app.models.billing import Invoice, Payment
from app.models.customer import Customer, CustomerUser
from app.schemas.billing import PaymentCreateRequest
from app.services.audit_service import log_audit_event

logger = logging.getLogger(__name__)


def _generate_payment_number(db: Session, payment_date: datetime.date) -> str:
    date_prefix = payment_date.strftime("%Y%m%d")
    unique_suffix = uuid.uuid4().hex[:6].upper()
    return f"PAY-{date_prefix}-{unique_suffix}"


def record_payment(
    db: Session,
    data: PaymentCreateRequest,
    current_user: User,
    ip_address: Optional[str] = None,
) -> Payment:
    """
    Record payment against an invoice with row-level locking (SELECT ... FOR UPDATE)
    to prevent race conditions, overpayment, and invalid status transitions.
    """
    # 1. Enforce RBAC
    if current_user.role not in ("ADMIN", "STAFF"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Customers cannot record or modify payments.",
        )

    # 2. Lock invoice row
    invoice = (
        db.query(Invoice)
        .filter(Invoice.id == data.invoice_id)
        .with_for_update()
        .first()
    )
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invoice {data.invoice_id} not found.",
        )

    # 3. Check invoice status
    if invoice.status == "CANCELLED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot record payment against CANCELLED invoice {invoice.invoice_number}.",
        )

    if invoice.status == "PAID" or invoice.balance_due <= Decimal("0.00"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invoice {invoice.invoice_number} is already fully paid.",
        )

    # 4. Calculate existing successful payments
    current_paid = (
        db.query(func.coalesce(func.sum(Payment.amount), Decimal("0.00")))
        .filter(Payment.invoice_id == invoice.id, Payment.status == "SUCCESS")
        .scalar()
    )
    remaining_balance = invoice.total_amount - current_paid

    # 5. Overpayment prevention
    if data.amount > remaining_balance:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Payment amount ({data.amount}) exceeds outstanding balance ({remaining_balance}) "
                f"for invoice {invoice.invoice_number}. Overpayment is strictly rejected."
            ),
        )

    # 6. Insert Payment record
    pay_date = data.payment_date or datetime.datetime.now(datetime.timezone.utc)
    payment_number = _generate_payment_number(db, pay_date.date())

    payment = Payment(
        payment_number=payment_number,
        invoice_id=invoice.id,
        customer_id=invoice.customer_id,
        amount=data.amount,
        payment_method=data.payment_method,
        status="SUCCESS",
        payment_date=pay_date,
        reference_number=data.reference_number,
        notes=data.notes,
        recorded_by_user_id=current_user.id,
    )
    db.add(payment)
    db.flush()

    # 7. Update Invoice amount_paid and balance_due
    new_amount_paid = current_paid + data.amount
    invoice.amount_paid = new_amount_paid
    invoice.balance_due = invoice.total_amount - new_amount_paid

    if invoice.balance_due == Decimal("0.00"):
        invoice.status = "PAID"
    else:
        invoice.status = "PARTIALLY_PAID"

    db.flush()

    # 8. Audit log
    log_audit_event(
        db=db,
        action="PAYMENT_RECORDED",
        entity_name="Payment",
        entity_id=payment.id,
        actor_user_id=current_user.id,
        ip_address=ip_address,
        details={
            "payment_number": payment.payment_number,
            "invoice_number": invoice.invoice_number,
            "amount": str(payment.amount),
            "payment_method": payment.payment_method,
            "new_invoice_status": invoice.status,
            "new_balance_due": str(invoice.balance_due),
        },
    )

    db.commit()
    db.refresh(payment)
    return payment


def void_payment(
    db: Session,
    payment_id: uuid.UUID,
    void_reason: str,
    current_user: User,
    ip_address: Optional[str] = None,
) -> Payment:
    """
    Void a payment atomically, locking both payment and invoice,
    recalculating invoice balances and status without deleting records.
    """
    if current_user.role not in ("ADMIN", "STAFF"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Customers cannot void payments.",
        )

    # 1. Lock payment
    payment = (
        db.query(Payment)
        .filter(Payment.id == payment_id)
        .with_for_update()
        .first()
    )
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment {payment_id} not found.",
        )

    if payment.status == "VOIDED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment {payment.payment_number} has already been voided.",
        )

    # 2. Lock invoice
    invoice = (
        db.query(Invoice)
        .filter(Invoice.id == payment.invoice_id)
        .with_for_update()
        .first()
    )
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invoice {payment.invoice_id} associated with payment not found.",
        )

    # 3. Mark payment as VOIDED
    payment.status = "VOIDED"
    payment.voided_at = datetime.datetime.now(datetime.timezone.utc)
    payment.voided_by_user_id = current_user.id
    payment.void_reason = void_reason
    db.flush()

    # 4. Recalculate invoice amounts from remaining SUCCESS payments
    recalculated_paid = (
        db.query(func.coalesce(func.sum(Payment.amount), Decimal("0.00")))
        .filter(Payment.invoice_id == invoice.id, Payment.status == "SUCCESS")
        .scalar()
    )

    invoice.amount_paid = recalculated_paid
    invoice.balance_due = invoice.total_amount - recalculated_paid

    if recalculated_paid == Decimal("0.00"):
        invoice.status = "CONFIRMED"
    elif invoice.balance_due == Decimal("0.00"):
        invoice.status = "PAID"
    else:
        invoice.status = "PARTIALLY_PAID"

    db.flush()

    # 5. Audit log
    log_audit_event(
        db=db,
        action="PAYMENT_VOIDED",
        entity_name="Payment",
        entity_id=payment.id,
        actor_user_id=current_user.id,
        ip_address=ip_address,
        details={
            "payment_number": payment.payment_number,
            "invoice_number": invoice.invoice_number,
            "voided_amount": str(payment.amount),
            "void_reason": void_reason,
            "new_invoice_status": invoice.status,
            "new_amount_paid": str(recalculated_paid),
            "new_balance_due": str(invoice.balance_due),
        },
    )

    db.commit()
    db.refresh(payment)
    return payment


def get_payment_by_id(
    db: Session,
    payment_id: uuid.UUID,
    current_user: User,
) -> Payment:
    """Get payment with customer tenant isolation."""
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment {payment_id} not found.",
        )

    if current_user.role == "CUSTOMER":
        user_customer_ids = {
            cu.customer_id for cu in current_user.customer_memberships if cu.status == "ACTIVE"
        }
        if payment.customer_id not in user_customer_ids:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Payment {payment_id} not found.",
            )

    return payment


def list_payments(
    db: Session,
    current_user: User,
    invoice_id: Optional[uuid.UUID] = None,
    customer_id: Optional[uuid.UUID] = None,
    status_filter: Optional[str] = None,
    payment_method: Optional[str] = None,
    page: int = 1,
    size: int = 20,
) -> Tuple[List[Payment], int]:
    """List payments with tenant isolation, filtering, and pagination."""
    query = db.query(Payment)

    if current_user.role == "CUSTOMER":
        user_customer_ids = {
            cu.customer_id for cu in current_user.customer_memberships if cu.status == "ACTIVE"
        }
        query = query.filter(Payment.customer_id.in_(user_customer_ids))
    elif customer_id:
        query = query.filter(Payment.customer_id == customer_id)

    if invoice_id:
        query = query.filter(Payment.invoice_id == invoice_id)

    if status_filter:
        query = query.filter(Payment.status == status_filter.upper())

    if payment_method:
        query = query.filter(Payment.payment_method == payment_method.upper())

    total = query.count()
    payments = (
        query.order_by(Payment.payment_date.desc(), Payment.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
        .all()
    )

    return payments, total
