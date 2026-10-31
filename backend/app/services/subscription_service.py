import calendar
import datetime
from decimal import Decimal
from typing import List, Optional, Tuple
import uuid
from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.auth import User
from app.models.catalog import Plan
from app.models.customer import Customer
from app.models.discount import DiscountRedemption
from app.models.quotation import Quotation, QuotationLine, QuotationLineTax
from app.models.subscription import (
    Subscription,
    SubscriptionLine,
    SubscriptionLineTax,
    SubscriptionPauseHistory,
)
from app.schemas.subscription import (
    CloseSubscriptionRequest,
    ConvertQuotationRequest,
    PauseSubscriptionRequest,
)
from app.services.audit_service import log_audit_event


def _add_months(source_date: datetime.date, months: int) -> datetime.date:
    month = source_date.month - 1 + months
    year = source_date.year + month // 12
    month = month % 12 + 1
    day = min(source_date.day, calendar.monthrange(year, month)[1])
    return datetime.date(year, month, day)


def calculate_period_end(
    start_date: datetime.date,
    billing_interval: str,
    interval_count: int,
) -> datetime.date:
    if billing_interval == "DAILY":
        return start_date + datetime.timedelta(days=interval_count)
    elif billing_interval == "WEEKLY":
        return start_date + datetime.timedelta(weeks=interval_count)
    elif billing_interval == "MONTHLY":
        return _add_months(start_date, interval_count)
    elif billing_interval == "YEARLY":
        return _add_months(start_date, interval_count * 12)
    else:
        return _add_months(start_date, 1)


def _generate_subscription_number(db: Session) -> str:
    month_prefix = datetime.date.today().strftime("%Y%m")
    unique_suffix = uuid.uuid4().hex[:6].upper()
    return f"SUB-{month_prefix}-{unique_suffix}"


def convert_quotation_to_subscription(
    db: Session,
    quotation_id: uuid.UUID,
    data: ConvertQuotationRequest,
    actor_user: User,
    ip_address: Optional[str] = None,
) -> Subscription:
    # 1. Acquire row lock on quotation
    quote = (
        db.query(Quotation)
        .filter(Quotation.id == quotation_id)
        .with_for_update()
        .first()
    )
    if not quote:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Quotation {quotation_id} not found.",
        )

    # 2. Check quotation status
    if quote.status != "CONFIRMED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Quotation {quote.quotation_number} cannot be converted because it is in '{quote.status}' status (must be 'CONFIRMED').",
        )

    # 3. Check expiration
    today = datetime.date.today()
    if today > quote.expiry_date:
        quote.status = "EXPIRED"
        db.flush()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Quotation {quote.quotation_number} has expired on {quote.expiry_date} and cannot be converted.",
        )

    # 4. Check duplicate conversion idempotency
    existing_sub = (
        db.query(Subscription)
        .filter(Subscription.quotation_id == quote.id)
        .first()
    )
    if existing_sub:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Quotation {quote.quotation_number} has already been converted to Subscription {existing_sub.subscription_number}.",
        )

    plan = quote.plan
    customer = quote.customer

    start_date = data.start_date or today
    period_end = calculate_period_end(start_date, plan.billing_interval, plan.interval_count)
    anchor_day = min(max(start_date.day, 1), 28)

    expiry_date = plan.availability_end_date if plan.availability_end_date else None
    if expiry_date and expiry_date < start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Subscription start date is after the plan availability end date.",
        )

    initial_status = "ACTIVE" if start_date <= today else "CONFIRMED"

    sub = Subscription(
        subscription_number=_generate_subscription_number(db),
        customer_id=customer.id,
        quotation_id=quote.id,
        plan_id=plan.id,
        status=initial_status,
        start_date=start_date,
        expiry_date=expiry_date,
        current_period_start=start_date,
        current_period_end=period_end,
        next_billing_date=start_date,
        billing_anchor_day=anchor_day,
        billing_interval_snapshot=plan.billing_interval,
        interval_count_snapshot=plan.interval_count,
        allow_pause_snapshot=plan.allow_pause,
        allow_early_closure_snapshot=plan.allow_early_closure,
        auto_renew_snapshot=plan.auto_renew,
        auto_close_snapshot=plan.auto_close_on_expiry,
        plan_name_snapshot=plan.name,
        plan_price_snapshot=quote.plan_price_snapshot,
        recurring_subtotal=quote.subtotal_amount,
        recurring_discount=quote.discount_amount,
        recurring_tax=quote.tax_amount,
        recurring_total_amount=quote.total_amount,
        currency=quote.currency,
        payment_terms_days=data.payment_terms_days if data.payment_terms_days is not None else 15,
        created_by_user_id=actor_user.id,
    )
    db.add(sub)
    db.flush()

    # Copy lines from quotation to subscription
    for ql in quote.lines:
        sub_line = SubscriptionLine(
            subscription_id=sub.id,
            line_type=ql.line_type,
            product_id=ql.product_id,
            variant_id=ql.variant_id,
            description_snapshot=ql.description_snapshot,
            unit_price_snapshot=ql.unit_price,
            quantity=ql.quantity,
            tax_rate_snapshot=ql.tax_rate_snapshot,
            line_total=ql.line_total,
        )
        db.add(sub_line)
        db.flush()

        for qtax in ql.taxes:
            slt = SubscriptionLineTax(
                subscription_line_id=sub_line.id,
                tax_rule_id=qtax.tax_rule_id,
                tax_name_snapshot=qtax.tax_name_snapshot,
                tax_rate_snapshot=qtax.tax_rate_snapshot,
                tax_amount=qtax.tax_amount,
            )
            db.add(slt)

    # Link any discount redemptions
    for dr in quote.discount_redemptions:
        dr.subscription_id = sub.id

    db.flush()

    log_audit_event(
        db=db,
        action="CONVERT_QUOTATION_TO_SUBSCRIPTION",
        entity_name="Subscription",
        entity_id=sub.id,
        actor_user_id=actor_user.id,
        ip_address=ip_address,
        details={
            "subscription_number": sub.subscription_number,
            "quotation_number": quote.quotation_number,
            "customer_id": str(customer.id),
        },
    )
    return sub


def list_subscriptions(
    db: Session,
    current_user: User,
    customer_id: Optional[uuid.UUID] = None,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> Tuple[List[Subscription], int]:
    query = db.query(Subscription)

    # Customer tenant isolation
    if current_user.role == "CUSTOMER":
        user_customer_ids = [
            cu.customer_id for cu in current_user.customer_memberships if cu.status == "ACTIVE"
        ]
        query = query.filter(Subscription.customer_id.in_(user_customer_ids))
    elif customer_id:
        query = query.filter(Subscription.customer_id == customer_id)

    if status_filter:
        query = query.filter(Subscription.status == status_filter)
    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Subscription.subscription_number.ilike(search_term),
                Subscription.plan_name_snapshot.ilike(search_term),
            )
        )

    total = query.count()
    items = (
        query.order_by(Subscription.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return items, total


def get_subscription_by_id(
    db: Session,
    subscription_id: uuid.UUID,
    current_user: User,
) -> Subscription:
    sub = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Subscription {subscription_id} not found.",
        )

    # Tenant check for customer
    if current_user.role == "CUSTOMER":
        user_customer_ids = {
            cu.customer_id for cu in current_user.customer_memberships if cu.status == "ACTIVE"
        }
        if sub.customer_id not in user_customer_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to subscription belonging to another customer organization.",
            )

    return sub


def activate_subscription(
    db: Session,
    subscription_id: uuid.UUID,
    actor_user: User,
    ip_address: Optional[str] = None,
) -> Subscription:
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

    if sub.status not in ("CONFIRMED", "DRAFT"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot activate subscription in '{sub.status}' state.",
        )

    sub.status = "ACTIVE"
    db.flush()

    log_audit_event(
        db=db,
        action="ACTIVATE_SUBSCRIPTION",
        entity_name="Subscription",
        entity_id=sub.id,
        actor_user_id=actor_user.id,
        ip_address=ip_address,
        details={"subscription_number": sub.subscription_number},
    )
    return sub


def pause_subscription(
    db: Session,
    subscription_id: uuid.UUID,
    data: PauseSubscriptionRequest,
    actor_user: User,
    ip_address: Optional[str] = None,
) -> Subscription:
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

    if sub.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only ACTIVE subscriptions can be paused (current status: '{sub.status}').",
        )

    if not sub.allow_pause_snapshot:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The agreed plan terms prohibit pausing this subscription.",
        )

    # Check for single open pause
    open_pause = (
        db.query(SubscriptionPauseHistory)
        .filter(SubscriptionPauseHistory.subscription_id == sub.id, SubscriptionPauseHistory.resumed_at.is_(None))
        .first()
    )
    if open_pause:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Subscription is already paused with an open pause record.",
        )

    sub.status = "PAUSED"
    pause_record = SubscriptionPauseHistory(
        subscription_id=sub.id,
        paused_at=datetime.datetime.now(datetime.timezone.utc),
        pause_reason=data.reason,
        days_extended=0,
        initiated_by_user_id=actor_user.id,
    )
    db.add(pause_record)
    db.flush()

    log_audit_event(
        db=db,
        action="PAUSE_SUBSCRIPTION",
        entity_name="Subscription",
        entity_id=sub.id,
        actor_user_id=actor_user.id,
        ip_address=ip_address,
        details={
            "subscription_number": sub.subscription_number,
            "reason": data.reason,
        },
    )
    return sub


def resume_subscription(
    db: Session,
    subscription_id: uuid.UUID,
    actor_user: User,
    ip_address: Optional[str] = None,
) -> Subscription:
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

    if sub.status != "PAUSED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only PAUSED subscriptions can be resumed (current status: '{sub.status}').",
        )

    open_pause = (
        db.query(SubscriptionPauseHistory)
        .filter(SubscriptionPauseHistory.subscription_id == sub.id, SubscriptionPauseHistory.resumed_at.is_(None))
        .first()
    )
    if not open_pause:
        sub.status = "ACTIVE"
        db.flush()
        return sub

    now = datetime.datetime.now(datetime.timezone.utc)
    open_pause.resumed_at = now

    days_extended = max(1, (now.date() - open_pause.paused_at.date()).days)
    open_pause.days_extended = days_extended

    # Shift periods and next billing date
    delta = datetime.timedelta(days=days_extended)
    sub.current_period_end = sub.current_period_end + delta
    sub.next_billing_date = sub.next_billing_date + delta
    if sub.expiry_date:
        sub.expiry_date = sub.expiry_date + delta

    sub.status = "ACTIVE"
    db.flush()

    log_audit_event(
        db=db,
        action="RESUME_SUBSCRIPTION",
        entity_name="Subscription",
        entity_id=sub.id,
        actor_user_id=actor_user.id,
        ip_address=ip_address,
        details={
            "subscription_number": sub.subscription_number,
            "days_extended": days_extended,
        },
    )
    return sub


def close_subscription(
    db: Session,
    subscription_id: uuid.UUID,
    data: CloseSubscriptionRequest,
    actor_user: User,
    ip_address: Optional[str] = None,
) -> Subscription:
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

    if sub.status in ("CLOSED", "EXPIRED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Subscription is already in terminal state '{sub.status}'.",
        )

    if not sub.allow_early_closure_snapshot and actor_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The agreed plan terms prohibit early closure. Only ADMIN can force-close.",
        )

    # Close any open pause record
    open_pause = (
        db.query(SubscriptionPauseHistory)
        .filter(SubscriptionPauseHistory.subscription_id == sub.id, SubscriptionPauseHistory.resumed_at.is_(None))
        .first()
    )
    if open_pause:
        open_pause.resumed_at = datetime.datetime.now(datetime.timezone.utc)

    sub.status = "CLOSED"
    db.flush()

    log_audit_event(
        db=db,
        action="CLOSE_SUBSCRIPTION",
        entity_name="Subscription",
        entity_id=sub.id,
        actor_user_id=actor_user.id,
        ip_address=ip_address,
        details={
            "subscription_number": sub.subscription_number,
            "reason": data.reason,
        },
    )
    return sub
