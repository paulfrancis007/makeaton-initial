import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional, Tuple
import uuid
from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.auth import User
from app.models.catalog import Product
from app.models.discount import DiscountRule, DiscountRuleProduct
from app.schemas.discount import (
    DiscountEvaluationRequest,
    DiscountEvaluationResponse,
    DiscountRuleCreate,
    DiscountRulePublic,
    DiscountRuleUpdate,
)
from app.services.audit_service import log_audit_event


def create_discount_rule(
    db: Session,
    data: DiscountRuleCreate,
    actor_user: User,
    ip_address: Optional[str] = None,
) -> DiscountRule:
    clean_code = data.code.strip().upper()
    existing = db.query(DiscountRule).filter(DiscountRule.code == clean_code).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Discount rule with code '{clean_code}' already exists.",
        )

    # Validate eligible products if scope is PRODUCT_SELECTION
    if data.scope == "PRODUCT_SELECTION" and data.eligible_product_ids:
        products = db.query(Product).filter(Product.id.in_(data.eligible_product_ids)).all()
        if len(products) != len(set(data.eligible_product_ids)):
            found_ids = {p.id for p in products}
            missing = set(data.eligible_product_ids) - found_ids
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Eligible products not found: {[str(m) for m in missing]}",
            )

    rule = DiscountRule(
        code=clean_code,
        name=data.name.strip(),
        discount_type=data.discount_type,
        discount_value=data.discount_value,
        scope=data.scope,
        application_frequency=data.application_frequency,
        max_cycles=data.max_cycles,
        minimum_purchase_amount=data.minimum_purchase_amount,
        minimum_quantity=data.minimum_quantity,
        valid_from=data.valid_from,
        valid_until=data.valid_until,
        max_uses=data.max_uses,
        current_uses=0,
        is_active=data.is_active,
    )
    db.add(rule)

    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Constraint violation creating discount rule: {str(exc.orig)}",
        )

    # Attach eligible products if provided
    if data.eligible_product_ids:
        for pid in data.eligible_product_ids:
            db.add(DiscountRuleProduct(discount_rule_id=rule.id, product_id=pid))
        db.flush()

    log_audit_event(
        db=db,
        action="CREATE_DISCOUNT_RULE",
        entity_name="DiscountRule",
        entity_id=rule.id,
        actor_user_id=actor_user.id,
        ip_address=ip_address,
        details={
            "code": rule.code,
            "discount_type": rule.discount_type,
            "discount_value": str(rule.discount_value),
            "scope": rule.scope,
        },
    )
    return rule


def list_discount_rules(
    db: Session,
    search: Optional[str] = None,
    discount_type: Optional[str] = None,
    scope: Optional[str] = None,
    is_active: Optional[bool] = None,
    page: int = 1,
    page_size: int = 20,
) -> Tuple[List[DiscountRule], int]:
    query = db.query(DiscountRule)

    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                DiscountRule.code.ilike(search_term),
                DiscountRule.name.ilike(search_term),
            )
        )
    if discount_type:
        query = query.filter(DiscountRule.discount_type == discount_type)
    if scope:
        query = query.filter(DiscountRule.scope == scope)
    if is_active is not None:
        query = query.filter(DiscountRule.is_active == is_active)

    total = query.count()
    items = (
        query.order_by(DiscountRule.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return items, total


def get_discount_rule_by_id(db: Session, discount_rule_id: uuid.UUID) -> DiscountRule:
    rule = db.query(DiscountRule).filter(DiscountRule.id == discount_rule_id).first()
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Discount rule with ID {discount_rule_id} not found.",
        )
    return rule


def update_discount_rule(
    db: Session,
    discount_rule_id: uuid.UUID,
    data: DiscountRuleUpdate,
    actor_user: User,
    ip_address: Optional[str] = None,
) -> DiscountRule:
    rule = get_discount_rule_by_id(db, discount_rule_id)
    update_data = data.model_dump(exclude_unset=True)

    eligible_product_ids = update_data.pop("eligible_product_ids", None)

    for field, value in update_data.items():
        setattr(rule, field, value)

    if eligible_product_ids is not None:
        if eligible_product_ids:
            products = db.query(Product).filter(Product.id.in_(eligible_product_ids)).all()
            if len(products) != len(set(eligible_product_ids)):
                found_ids = {p.id for p in products}
                missing = set(eligible_product_ids) - found_ids
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Eligible products not found: {[str(m) for m in missing]}",
                )
        db.query(DiscountRuleProduct).filter(DiscountRuleProduct.discount_rule_id == rule.id).delete()
        for pid in eligible_product_ids:
            db.add(DiscountRuleProduct(discount_rule_id=rule.id, product_id=pid))

    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Constraint violation updating discount rule: {str(exc.orig)}",
        )

    log_audit_event(
        db=db,
        action="UPDATE_DISCOUNT_RULE",
        entity_name="DiscountRule",
        entity_id=rule.id,
        actor_user_id=actor_user.id,
        ip_address=ip_address,
        details={"updated_fields": list(update_data.keys())},
    )
    return rule


def deactivate_discount_rule(
    db: Session,
    discount_rule_id: uuid.UUID,
    actor_user: User,
    ip_address: Optional[str] = None,
) -> DiscountRule:
    rule = get_discount_rule_by_id(db, discount_rule_id)
    rule.is_active = False
    db.flush()

    log_audit_event(
        db=db,
        action="DEACTIVATE_DISCOUNT_RULE",
        entity_name="DiscountRule",
        entity_id=rule.id,
        actor_user_id=actor_user.id,
        ip_address=ip_address,
        details={"code": rule.code},
    )
    return rule


def evaluate_discount(
    db: Session,
    request: DiscountEvaluationRequest,
) -> DiscountEvaluationResponse:
    clean_code = request.code.strip().upper()
    rule = db.query(DiscountRule).filter(DiscountRule.code == clean_code).first()

    if not rule:
        return DiscountEvaluationResponse(
            is_eligible=False,
            rejection_reason=f"Discount code '{clean_code}' not found.",
            discount_code=clean_code,
        )

    if not rule.is_active:
        return DiscountEvaluationResponse(
            is_eligible=False,
            rejection_reason="Discount rule is not active.",
            discount_code=clean_code,
            rule_name=rule.name,
            rule_id=rule.id,
        )

    # Date validity check
    now = datetime.datetime.now(datetime.timezone.utc)
    if rule.valid_from and now < rule.valid_from:
        return DiscountEvaluationResponse(
            is_eligible=False,
            rejection_reason="Discount rule is not yet valid.",
            discount_code=clean_code,
            rule_name=rule.name,
            rule_id=rule.id,
        )
    if rule.valid_until and now > rule.valid_until:
        return DiscountEvaluationResponse(
            is_eligible=False,
            rejection_reason="Discount rule has expired.",
            discount_code=clean_code,
            rule_name=rule.name,
            rule_id=rule.id,
        )

    # Max uses check
    if rule.max_uses is not None and rule.current_uses >= rule.max_uses:
        return DiscountEvaluationResponse(
            is_eligible=False,
            rejection_reason="Discount rule has reached its maximum usage limit.",
            discount_code=clean_code,
            rule_name=rule.name,
            rule_id=rule.id,
        )

    # Cycle frequency check
    if rule.application_frequency == "FIRST_INVOICE_ONLY" and request.cycle_number > 1:
        return DiscountEvaluationResponse(
            is_eligible=False,
            rejection_reason="Discount applies only to the first billing cycle.",
            discount_code=clean_code,
            rule_name=rule.name,
            rule_id=rule.id,
        )
    if (
        rule.application_frequency == "FINITE_CYCLES"
        and rule.max_cycles is not None
        and request.cycle_number > rule.max_cycles
    ):
        return DiscountEvaluationResponse(
            is_eligible=False,
            rejection_reason=f"Discount applies only up to cycle {rule.max_cycles}.",
            discount_code=clean_code,
            rule_name=rule.name,
            rule_id=rule.id,
        )

    # Evaluate scope & qualifying subtotal / quantity
    if rule.scope == "ORDER":
        if request.items:
            qualifying_subtotal = sum(
                (item.unit_price * Decimal(item.quantity) for item in request.items),
                Decimal("0.0000"),
            )
            total_quantity = sum(item.quantity for item in request.items)
        else:
            qualifying_subtotal = request.order_subtotal
            total_quantity = 1
    elif rule.scope == "PRODUCT_SELECTION":
        eligible_pids = {drp.product_id for drp in rule.products}
        matching_items = [item for item in request.items if item.product_id in eligible_pids]
        if not matching_items:
            return DiscountEvaluationResponse(
                is_eligible=False,
                rejection_reason="No eligible products in the order for this discount rule.",
                discount_code=clean_code,
                rule_name=rule.name,
                rule_id=rule.id,
            )
        qualifying_subtotal = sum(
            (item.unit_price * Decimal(item.quantity) for item in matching_items),
            Decimal("0.0000"),
        )
        total_quantity = sum(item.quantity for item in matching_items)
    else:
        qualifying_subtotal = request.order_subtotal
        total_quantity = 1

    # Minimum purchase amount check
    if qualifying_subtotal < rule.minimum_purchase_amount:
        return DiscountEvaluationResponse(
            is_eligible=False,
            rejection_reason=(
                f"Qualifying amount {qualifying_subtotal} does not meet the minimum purchase requirement "
                f"of {rule.minimum_purchase_amount}."
            ),
            discount_code=clean_code,
            rule_name=rule.name,
            rule_id=rule.id,
            qualifying_subtotal=qualifying_subtotal,
        )

    # Minimum quantity check
    if total_quantity < rule.minimum_quantity:
        return DiscountEvaluationResponse(
            is_eligible=False,
            rejection_reason=(
                f"Total qualifying quantity {total_quantity} is less than the required minimum "
                f"quantity of {rule.minimum_quantity}."
            ),
            discount_code=clean_code,
            rule_name=rule.name,
            rule_id=rule.id,
            qualifying_subtotal=qualifying_subtotal,
        )

    # Calculate discount amount
    if rule.discount_type == "PERCENTAGE":
        raw_discount = qualifying_subtotal * (rule.discount_value / Decimal("100.0000"))
        discount_amount = min(raw_discount, qualifying_subtotal).quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP
        )
    elif rule.discount_type == "FIXED_AMOUNT":
        discount_amount = min(rule.discount_value, qualifying_subtotal).quantize(
            Decimal("0.0001"), rounding=ROUND_HALF_UP
        )
    else:
        discount_amount = Decimal("0.0000")

    return DiscountEvaluationResponse(
        is_eligible=True,
        rejection_reason=None,
        discount_code=clean_code,
        discount_type=rule.discount_type,
        discount_value=rule.discount_value,
        discount_amount=discount_amount,
        qualifying_subtotal=qualifying_subtotal,
        rule_name=rule.name,
        rule_id=rule.id,
    )
