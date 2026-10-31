import calendar
import datetime
from decimal import Decimal, ROUND_HALF_UP
import logging
from typing import Any, Dict, List, Optional, Tuple
import uuid
from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.auth import User
from app.models.billing import Invoice, InvoiceLine, InvoiceLineTax
from app.models.customer import Customer, CustomerUser
from app.models.governance import CompanySetting
from app.models.subscription import Subscription, SubscriptionLine
from app.services.audit_service import log_audit_event

logger = logging.getLogger(__name__)

ROUND_FACTOR = Decimal("0.01")
FOUR_DECIMALS = Decimal("0.0001")


def _add_months(source_date: datetime.date, months: int) -> datetime.date:
    month = source_date.month - 1 + months
    year = source_date.year + month // 12
    month = month % 12 + 1
    day = min(source_date.day, calendar.monthrange(year, month)[1])
    return datetime.date(year, month, day)


def calculate_next_billing_date(
    current_start: datetime.date,
    billing_interval: str,
    interval_count: int,
    anchor_day: int,
) -> datetime.date:
    """Calculate the next period end / billing date respecting billing anchor day."""
    if billing_interval == "DAILY":
        return current_start + datetime.timedelta(days=interval_count)
    elif billing_interval == "WEEKLY":
        return current_start + datetime.timedelta(weeks=interval_count)
    elif billing_interval == "MONTHLY":
        month = current_start.month - 1 + interval_count
        year = current_start.year + month // 12
        month = month % 12 + 1
        max_days = calendar.monthrange(year, month)[1]
        day = min(anchor_day, max_days)
        return datetime.date(year, month, day)
    elif billing_interval == "YEARLY":
        year = current_start.year + interval_count
        month = current_start.month
        max_days = calendar.monthrange(year, month)[1]
        day = min(anchor_day, max_days)
        return datetime.date(year, month, day)
    else:
        return _add_months(current_start, interval_count)


def _generate_invoice_number(db: Session, issue_date: datetime.date) -> str:
    date_prefix = issue_date.strftime("%Y%m%d")
    unique_suffix = uuid.uuid4().hex[:6].upper()
    return f"INV-{date_prefix}-{unique_suffix}"


def create_invoice_from_subscription(
    db: Session,
    subscription_id: uuid.UUID,
    actor_user: Optional[User] = None,
    billing_date: Optional[datetime.date] = None,
    ip_address: Optional[str] = None,
) -> Tuple[Invoice, bool]:
    """
    Generate an invoice from a subscription for its eligible billing period.
    Returns (invoice, created_flag). If already billed for this period, returns existing invoice with created=False.
    """
    target_date = billing_date or datetime.date.today()

    # 1. Lock subscription row
    sub = (
        db.query(Subscription)
        .filter(Subscription.id == subscription_id)
        .with_for_update()
        .first()
    )
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Subscription {subscription_id} not found.",
        )

    # 2. Check eligibility
    if sub.status not in ("ACTIVE", "CONFIRMED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Subscription {sub.subscription_number} is in '{sub.status}' state and is not eligible for billing.",
        )

    if sub.expiry_date and sub.current_period_start >= sub.expiry_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Subscription {sub.subscription_number} has reached its expiry date ({sub.expiry_date}).",
        )

    # 3. Determine billing period
    # Check if invoice already exists for current period [current_period_start, current_period_end)
    period_start = sub.current_period_start
    period_end = sub.current_period_end

    existing_current = (
        db.query(Invoice)
        .filter(
            Invoice.subscription_id == sub.id,
            Invoice.billing_period_start == period_start,
            Invoice.billing_period_end == period_end,
            Invoice.status != "CANCELLED",
        )
        .first()
    )

    if existing_current:
        # Check if due for the next cycle
        if sub.next_billing_date > target_date:
            # Not due for next cycle yet, return current invoice idempotently
            return existing_current, False

        # Advance to next cycle
        period_start = sub.current_period_end
        period_end = calculate_next_billing_date(
            period_start,
            sub.billing_interval_snapshot,
            sub.interval_count_snapshot,
            sub.billing_anchor_day,
        )

        # Check if already billed for that next cycle
        existing_next = (
            db.query(Invoice)
            .filter(
                Invoice.subscription_id == sub.id,
                Invoice.billing_period_start == period_start,
                Invoice.billing_period_end == period_end,
                Invoice.status != "CANCELLED",
            )
            .first()
        )
        if existing_next:
            return existing_next, False

    # 4. Due date
    due_date = target_date + datetime.timedelta(days=sub.payment_terms_days)

    # 5. Clone lines and calculate totals
    sub_lines = (
        db.query(SubscriptionLine)
        .filter(SubscriptionLine.subscription_id == sub.id)
        .all()
    )

    if not sub_lines:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Subscription {sub.subscription_number} has no line items.",
        )

    invoice_number = _generate_invoice_number(db, target_date)

    inv = Invoice(
        invoice_number=invoice_number,
        subscription_id=sub.id,
        customer_id=sub.customer_id,
        status="CONFIRMED",
        issue_date=target_date,
        due_date=due_date,
        billing_period_start=period_start,
        billing_period_end=period_end,
        subtotal_amount=Decimal("0.00"),
        discount_amount=Decimal("0.00"),
        tax_amount=Decimal("0.00"),
        rounding_adjustment=Decimal("0.00"),
        total_amount=Decimal("0.00"),
        amount_paid=Decimal("0.00"),
        balance_due=Decimal("0.00"),
        currency=sub.currency,
        notes=f"Recurring billing invoice for subscription {sub.subscription_number} for period {period_start} to {period_end}.",
    )
    db.add(inv)
    db.flush()

    line_subtotals_sum = Decimal("0.00")
    line_discounts_sum = Decimal("0.00")
    line_taxes_sum = Decimal("0.00")
    unrounded_line_totals_sum = Decimal("0.0000")

    for sline in sub_lines:
        qty = Decimal(str(sline.quantity))
        uprice = Decimal(str(sline.unit_price_snapshot))
        raw_line_subtotal = (qty * uprice).quantize(FOUR_DECIMALS, rounding=ROUND_HALF_UP)
        raw_line_discount = Decimal("0.0000")

        # Sum line taxes from subscription line tax snapshots
        raw_line_tax = Decimal("0.0000")
        line_tax_objects = []

        for stax in sline.taxes:
            t_rate = Decimal(str(stax.tax_rate_snapshot))
            t_amt = (raw_line_subtotal * t_rate).quantize(FOUR_DECIMALS, rounding=ROUND_HALF_UP)
            raw_line_tax += t_amt
            line_tax_objects.append((stax.tax_rule_id, stax.tax_name_snapshot, t_rate, t_amt))

        raw_line_total = raw_line_subtotal - raw_line_discount + raw_line_tax

        inv_line = InvoiceLine(
            invoice_id=inv.id,
            line_type=sline.line_type,
            product_id=sline.product_id,
            variant_id=sline.variant_id,
            description=sline.description_snapshot,
            quantity=sline.quantity,
            unit_price=uprice,
            tax_rate=Decimal(str(sline.tax_rate_snapshot)),
            tax_amount=raw_line_tax,
            discount_amount=raw_line_discount,
            line_total=raw_line_total,
        )
        db.add(inv_line)
        db.flush()

        for tax_rule_id, tax_name, t_rate, t_amt in line_tax_objects:
            ilt = InvoiceLineTax(
                invoice_line_id=inv_line.id,
                tax_rule_id=tax_rule_id,
                tax_name_snapshot=tax_name,
                tax_rate_snapshot=t_rate,
                tax_amount=t_amt,
            )
            db.add(ilt)

        line_subtotals_sum += raw_line_subtotal.quantize(ROUND_FACTOR, rounding=ROUND_HALF_UP)
        line_discounts_sum += raw_line_discount.quantize(ROUND_FACTOR, rounding=ROUND_HALF_UP)
        line_taxes_sum += raw_line_tax.quantize(ROUND_FACTOR, rounding=ROUND_HALF_UP)
        unrounded_line_totals_sum += raw_line_total

    # Header calculations
    final_total = unrounded_line_totals_sum.quantize(ROUND_FACTOR, rounding=ROUND_HALF_UP)
    calc_sum = line_subtotals_sum - line_discounts_sum + line_taxes_sum
    rounding_adj = final_total - calc_sum

    if abs(rounding_adj) > Decimal("0.02"):
        logger.warning(f"Rounding adjustment {rounding_adj} exceeds 0.02. Clamping to 0.02.")
        rounding_adj = Decimal("0.02") if rounding_adj > 0 else Decimal("-0.02")
        final_total = calc_sum + rounding_adj

    inv.subtotal_amount = line_subtotals_sum
    inv.discount_amount = line_discounts_sum
    inv.tax_amount = line_taxes_sum
    inv.rounding_adjustment = rounding_adj
    inv.total_amount = final_total
    inv.amount_paid = Decimal("0.00")
    inv.balance_due = final_total

    # 6. Update subscription state and next billing date
    sub.current_period_start = period_start
    sub.current_period_end = period_end
    sub.next_billing_date = period_end

    if sub.status == "CONFIRMED":
        sub.status = "ACTIVE"

    if sub.expiry_date and sub.next_billing_date >= sub.expiry_date:
        if sub.auto_close_snapshot:
            sub.status = "CLOSED"
        else:
            sub.status = "EXPIRED"

    db.flush()

    actor_id = actor_user.id if actor_user else None
    log_audit_event(
        db=db,
        action="INVOICE_GENERATED",
        entity_name="Invoice",
        entity_id=inv.id,
        actor_user_id=actor_id,
        ip_address=ip_address,
        details={
            "invoice_number": inv.invoice_number,
            "subscription_number": sub.subscription_number,
            "billing_period_start": str(period_start),
            "billing_period_end": str(period_end),
            "total_amount": str(final_total),
        },
    )

    return inv, True


def run_recurring_billing(
    db: Session,
    billing_date: Optional[datetime.date] = None,
    batch_size: int = 100,
    actor_user: Optional[User] = None,
    ip_address: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Find all active subscriptions due for billing on or before billing_date,
    and generate their invoices in batch with savepoints to isolate failures.
    """
    target_date = billing_date or datetime.date.today()

    # Query eligible subscriptions
    eligible_subs = (
        db.query(Subscription)
        .filter(
            Subscription.status.in_(("ACTIVE", "CONFIRMED")),
            Subscription.next_billing_date <= target_date,
            or_(
                Subscription.expiry_date.is_(None),
                Subscription.next_billing_date <= Subscription.expiry_date,
            ),
        )
        .order_by(Subscription.next_billing_date.asc(), Subscription.created_at.asc())
        .limit(batch_size)
        .all()
    )

    total_evaluated = len(eligible_subs)
    created_count = 0
    skipped_count = 0
    failure_count = 0
    created_invoices = []
    errors = []

    for sub in eligible_subs:
        try:
            # Use nested transaction savepoint to isolate subscription failure
            with db.begin_nested():
                inv, created = create_invoice_from_subscription(
                    db=db,
                    subscription_id=sub.id,
                    actor_user=actor_user,
                    billing_date=target_date,
                    ip_address=ip_address,
                )
                if created:
                    created_count += 1
                    created_invoices.append(
                        {
                            "invoice_id": str(inv.id),
                            "invoice_number": inv.invoice_number,
                            "subscription_id": str(sub.id),
                            "subscription_number": sub.subscription_number,
                            "customer_id": str(sub.customer_id),
                            "total_amount": str(inv.total_amount),
                            "due_date": str(inv.due_date),
                        }
                    )
                else:
                    skipped_count += 1
        except Exception as e:
            logger.error(
                f"Billing failed for subscription {sub.subscription_number}: {e}",
                exc_info=True,
            )
            failure_count += 1
            errors.append(
                {
                    "subscription_id": str(sub.id),
                    "subscription_number": sub.subscription_number,
                    "error": str(e),
                }
            )

    db.commit()

    return {
        "billing_date": target_date,
        "subscriptions_evaluated": total_evaluated,
        "invoices_created": created_count,
        "invoices_skipped": skipped_count,
        "failures": failure_count,
        "created_invoices": created_invoices,
        "errors": errors,
    }


def get_invoice_by_id(
    db: Session,
    invoice_id: uuid.UUID,
    current_user: User,
) -> Invoice:
    """Retrieve an invoice enforcing tenant isolation."""
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not inv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invoice {invoice_id} not found.",
        )

    if current_user.role == "CUSTOMER":
        user_customer_ids = {
            cu.customer_id for cu in current_user.customer_memberships if cu.status == "ACTIVE"
        }
        if inv.customer_id not in user_customer_ids:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Invoice {invoice_id} not found.",
            )

    return inv


def list_invoices(
    db: Session,
    current_user: User,
    customer_id: Optional[uuid.UUID] = None,
    subscription_id: Optional[uuid.UUID] = None,
    status_filter: Optional[str] = None,
    overdue_only: bool = False,
    search: Optional[str] = None,
    page: int = 1,
    size: int = 20,
) -> Tuple[List[Invoice], int]:
    """List invoices with filtering, pagination and tenant isolation."""
    query = db.query(Invoice)

    if current_user.role == "CUSTOMER":
        user_customer_ids = {
            cu.customer_id for cu in current_user.customer_memberships if cu.status == "ACTIVE"
        }
        query = query.filter(Invoice.customer_id.in_(user_customer_ids))
    elif customer_id:
        query = query.filter(Invoice.customer_id == customer_id)

    if subscription_id:
        query = query.filter(Invoice.subscription_id == subscription_id)

    if status_filter:
        query = query.filter(Invoice.status == status_filter.upper())

    if overdue_only:
        today = datetime.date.today()
        query = query.filter(
            Invoice.due_date < today,
            Invoice.balance_due > 0,
            Invoice.status != "CANCELLED",
        )

    if search:
        search_pattern = f"%{search}%"
        query = query.join(Customer).filter(
            or_(
                Invoice.invoice_number.ilike(search_pattern),
                Customer.company_name.ilike(search_pattern),
            )
        )

    total = query.count()
    invoices = (
        query.order_by(Invoice.issue_date.desc(), Invoice.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
        .all()
    )

    return invoices, total


def cancel_invoice(
    db: Session,
    invoice_id: uuid.UUID,
    current_user: User,
    reason: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> Invoice:
    """Cancel an unpaid invoice."""
    inv = db.query(Invoice).filter(Invoice.id == invoice_id).with_for_update().first()
    if not inv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invoice {invoice_id} not found.",
        )

    if inv.status == "CANCELLED":
        return inv

    if inv.status == "PAID" or inv.amount_paid > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invoice {inv.invoice_number} cannot be cancelled because payments have been recorded. Void payments first.",
        )

    inv.status = "CANCELLED"
    db.flush()

    log_audit_event(
        db=db,
        action="INVOICE_CANCELLED",
        entity_name="Invoice",
        entity_id=inv.id,
        actor_user_id=current_user.id,
        ip_address=ip_address,
        details={
            "invoice_number": inv.invoice_number,
            "reason": reason or "Cancelled by user",
        },
    )

    db.commit()
    return inv
