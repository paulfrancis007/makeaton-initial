import datetime
import uuid
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.auth import User
from app.models.catalog import Plan, PlanTax, Product, ProductTax, ProductVariant, TaxRule
from app.schemas.catalog import (
    PlanCreate,
    PlanUpdate,
    ProductCreate,
    ProductUpdate,
    ProductVariantCreate,
    ProductVariantUpdate,
    TaxRuleCreate,
    TaxRuleUpdate,
)
from app.services.audit_service import log_audit_event


# =========================================================================
# PRODUCT SERVICES
# =========================================================================

def create_product(
    db: Session,
    data: ProductCreate,
    actor_user: User,
    ip_address: Optional[str] = None,
) -> Product:
    product = Product(
        name=data.name,
        product_type=data.product_type,
        description=data.description,
        base_sales_price=data.base_sales_price,
        cost_price=data.cost_price,
        is_active=data.is_active,
    )
    db.add(product)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Database constraint violation creating product: {str(exc.orig)}",
        )

    log_audit_event(
        db=db,
        action="CREATE_PRODUCT",
        entity_name="Product",
        entity_id=product.id,
        actor_user_id=actor_user.id,
        ip_address=ip_address,
        details={
            "name": product.name,
            "product_type": product.product_type,
            "base_sales_price": str(product.base_sales_price),
        },
    )
    return product


def list_products(
    db: Session,
    search: Optional[str] = None,
    product_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    page: int = 1,
    page_size: int = 20,
) -> Tuple[List[Product], int]:
    query = db.query(Product)

    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Product.name.ilike(search_term),
                Product.description.ilike(search_term),
            )
        )
    if product_type:
        query = query.filter(Product.product_type == product_type)
    if is_active is not None:
        query = query.filter(Product.is_active == is_active)

    total = query.count()
    items = (
        query.order_by(Product.name.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return items, total


def get_product_by_id(db: Session, product_id: uuid.UUID) -> Product:
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {product_id} not found.",
        )
    return product


def update_product(
    db: Session,
    product_id: uuid.UUID,
    data: ProductUpdate,
    actor_user: User,
    ip_address: Optional[str] = None,
) -> Product:
    product = get_product_by_id(db, product_id)
    update_data = data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(product, field, value)

    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Constraint violation updating product: {str(exc.orig)}",
        )

    log_audit_event(
        db=db,
        action="UPDATE_PRODUCT",
        entity_name="Product",
        entity_id=product.id,
        actor_user_id=actor_user.id,
        ip_address=ip_address,
        details={"updated_fields": list(update_data.keys())},
    )
    return product


def deactivate_product(
    db: Session,
    product_id: uuid.UUID,
    actor_user: User,
    ip_address: Optional[str] = None,
) -> Product:
    product = get_product_by_id(db, product_id)
    product.is_active = False
    db.flush()

    log_audit_event(
        db=db,
        action="DEACTIVATE_PRODUCT",
        entity_name="Product",
        entity_id=product.id,
        actor_user_id=actor_user.id,
        ip_address=ip_address,
        details={"name": product.name},
    )
    return product


def assign_product_taxes(
    db: Session,
    product_id: uuid.UUID,
    tax_rule_ids: List[uuid.UUID],
    actor_user: User,
    ip_address: Optional[str] = None,
) -> List[TaxRule]:
    product = get_product_by_id(db, product_id)

    # Verify all tax rules exist
    tax_rules = db.query(TaxRule).filter(TaxRule.id.in_(tax_rule_ids)).all()
    if len(tax_rules) != len(set(tax_rule_ids)):
        found_ids = {r.id for r in tax_rules}
        missing = set(tax_rule_ids) - found_ids
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tax rules not found: {[str(m) for m in missing]}",
        )

    # Delete existing junctions
    db.query(ProductTax).filter(ProductTax.product_id == product.id).delete()

    # Insert new junctions
    for tr_id in tax_rule_ids:
        db.add(ProductTax(product_id=product.id, tax_rule_id=tr_id))

    db.flush()

    log_audit_event(
        db=db,
        action="ASSIGN_PRODUCT_TAXES",
        entity_name="Product",
        entity_id=product.id,
        actor_user_id=actor_user.id,
        ip_address=ip_address,
        details={"tax_rule_ids": [str(t) for t in tax_rule_ids]},
    )
    return tax_rules


def get_product_taxes(db: Session, product_id: uuid.UUID) -> List[TaxRule]:
    product = get_product_by_id(db, product_id)
    tax_rules = (
        db.query(TaxRule)
        .join(ProductTax, ProductTax.tax_rule_id == TaxRule.id)
        .filter(ProductTax.product_id == product.id)
        .all()
    )
    return tax_rules


# =========================================================================
# PRODUCT VARIANT SERVICES
# =========================================================================

def create_variant(
    db: Session,
    product_id: uuid.UUID,
    data: ProductVariantCreate,
    actor_user: User,
    ip_address: Optional[str] = None,
) -> ProductVariant:
    product = get_product_by_id(db, product_id)

    if data.sku:
        existing_sku = db.query(ProductVariant).filter(ProductVariant.sku == data.sku.strip()).first()
        if existing_sku:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"SKU '{data.sku}' is already assigned to another variant.",
            )

    variant = ProductVariant(
        product_id=product.id,
        name=data.name,
        price_adjustment=data.price_adjustment,
        sku=data.sku.strip() if data.sku else None,
        is_active=data.is_active,
    )
    db.add(variant)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Integrity error creating variant: {str(exc.orig)}",
        )

    log_audit_event(
        db=db,
        action="CREATE_PRODUCT_VARIANT",
        entity_name="ProductVariant",
        entity_id=variant.id,
        actor_user_id=actor_user.id,
        ip_address=ip_address,
        details={
            "product_id": str(product.id),
            "name": variant.name,
            "sku": variant.sku,
            "price_adjustment": str(variant.price_adjustment),
        },
    )
    return variant


def list_variants_for_product(
    db: Session,
    product_id: uuid.UUID,
    is_active: Optional[bool] = None,
) -> List[ProductVariant]:
    get_product_by_id(db, product_id)  # 404 check
    query = db.query(ProductVariant).filter(ProductVariant.product_id == product_id)
    if is_active is not None:
        query = query.filter(ProductVariant.is_active == is_active)
    return query.order_by(ProductVariant.name.asc()).all()


def get_variant_by_id(
    db: Session,
    product_id: uuid.UUID,
    variant_id: uuid.UUID,
) -> ProductVariant:
    variant = (
        db.query(ProductVariant)
        .filter(ProductVariant.id == variant_id, ProductVariant.product_id == product_id)
        .first()
    )
    if not variant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Variant {variant_id} not found for product {product_id}.",
        )
    return variant


def update_variant(
    db: Session,
    product_id: uuid.UUID,
    variant_id: uuid.UUID,
    data: ProductVariantUpdate,
    actor_user: User,
    ip_address: Optional[str] = None,
) -> ProductVariant:
    variant = get_variant_by_id(db, product_id, variant_id)
    update_data = data.model_dump(exclude_unset=True)

    if "sku" in update_data and update_data["sku"]:
        sku_val = update_data["sku"].strip()
        existing_sku = (
            db.query(ProductVariant)
            .filter(ProductVariant.sku == sku_val, ProductVariant.id != variant_id)
            .first()
        )
        if existing_sku:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"SKU '{sku_val}' is already assigned to another variant.",
            )
        update_data["sku"] = sku_val

    for field, value in update_data.items():
        setattr(variant, field, value)

    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Constraint violation updating variant: {str(exc.orig)}",
        )

    log_audit_event(
        db=db,
        action="UPDATE_PRODUCT_VARIANT",
        entity_name="ProductVariant",
        entity_id=variant.id,
        actor_user_id=actor_user.id,
        ip_address=ip_address,
        details={"updated_fields": list(update_data.keys())},
    )
    return variant


def deactivate_variant(
    db: Session,
    product_id: uuid.UUID,
    variant_id: uuid.UUID,
    actor_user: User,
    ip_address: Optional[str] = None,
) -> ProductVariant:
    variant = get_variant_by_id(db, product_id, variant_id)
    variant.is_active = False
    db.flush()

    log_audit_event(
        db=db,
        action="DEACTIVATE_PRODUCT_VARIANT",
        entity_name="ProductVariant",
        entity_id=variant.id,
        actor_user_id=actor_user.id,
        ip_address=ip_address,
        details={"name": variant.name},
    )
    return variant


# =========================================================================
# SUBSCRIPTION PLAN SERVICES
# =========================================================================

def create_plan(
    db: Session,
    data: PlanCreate,
    actor_user: User,
    ip_address: Optional[str] = None,
) -> Plan:
    existing = db.query(Plan).filter(Plan.name == data.name.strip()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Plan with name '{data.name.strip()}' already exists.",
        )

    plan = Plan(
        name=data.name.strip(),
        description=data.description,
        billing_interval=data.billing_interval,
        interval_count=data.interval_count,
        base_price=data.base_price,
        minimum_quantity=data.minimum_quantity,
        availability_start_date=data.availability_start_date,
        availability_end_date=data.availability_end_date,
        auto_renew=data.auto_renew,
        auto_close_on_expiry=data.auto_close_on_expiry,
        allow_pause=data.allow_pause,
        allow_early_closure=data.allow_early_closure,
        is_active=data.is_active,
    )
    db.add(plan)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Constraint violation creating plan: {str(exc.orig)}",
        )

    log_audit_event(
        db=db,
        action="CREATE_PLAN",
        entity_name="Plan",
        entity_id=plan.id,
        actor_user_id=actor_user.id,
        ip_address=ip_address,
        details={
            "name": plan.name,
            "billing_interval": plan.billing_interval,
            "base_price": str(plan.base_price),
        },
    )
    return plan


def list_plans(
    db: Session,
    search: Optional[str] = None,
    billing_interval: Optional[str] = None,
    is_active: Optional[bool] = None,
    page: int = 1,
    page_size: int = 20,
) -> Tuple[List[Plan], int]:
    query = db.query(Plan)

    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Plan.name.ilike(search_term),
                Plan.description.ilike(search_term),
            )
        )
    if billing_interval:
        query = query.filter(Plan.billing_interval == billing_interval)
    if is_active is not None:
        query = query.filter(Plan.is_active == is_active)

    total = query.count()
    items = (
        query.order_by(Plan.name.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return items, total


def get_plan_by_id(db: Session, plan_id: uuid.UUID) -> Plan:
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plan with ID {plan_id} not found.",
        )
    return plan


def update_plan(
    db: Session,
    plan_id: uuid.UUID,
    data: PlanUpdate,
    actor_user: User,
    ip_address: Optional[str] = None,
) -> Plan:
    plan = get_plan_by_id(db, plan_id)
    update_data = data.model_dump(exclude_unset=True)

    if "name" in update_data and update_data["name"]:
        clean_name = update_data["name"].strip()
        existing = db.query(Plan).filter(Plan.name == clean_name, Plan.id != plan_id).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Plan with name '{clean_name}' already exists.",
            )
        update_data["name"] = clean_name

    # Validate mutual exclusivity of auto_renew and auto_close_on_expiry
    final_auto_renew = update_data.get("auto_renew", plan.auto_renew)
    final_auto_close = update_data.get("auto_close_on_expiry", plan.auto_close_on_expiry)
    if final_auto_renew and final_auto_close:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="auto_renew and auto_close_on_expiry are mutually exclusive. Both cannot be true.",
        )

    # Validate dates
    final_start = update_data.get("availability_start_date", plan.availability_start_date)
    final_end = update_data.get("availability_end_date", plan.availability_end_date)
    if final_start and final_end and final_end < final_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="availability_end_date must be on or after availability_start_date.",
        )

    for field, value in update_data.items():
        setattr(plan, field, value)

    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Constraint violation updating plan: {str(exc.orig)}",
        )

    log_audit_event(
        db=db,
        action="UPDATE_PLAN",
        entity_name="Plan",
        entity_id=plan.id,
        actor_user_id=actor_user.id,
        ip_address=ip_address,
        details={"updated_fields": list(update_data.keys())},
    )
    return plan


def deactivate_plan(
    db: Session,
    plan_id: uuid.UUID,
    actor_user: User,
    ip_address: Optional[str] = None,
) -> Plan:
    plan = get_plan_by_id(db, plan_id)
    plan.is_active = False
    db.flush()

    log_audit_event(
        db=db,
        action="DEACTIVATE_PLAN",
        entity_name="Plan",
        entity_id=plan.id,
        actor_user_id=actor_user.id,
        ip_address=ip_address,
        details={"name": plan.name},
    )
    return plan


def assign_plan_taxes(
    db: Session,
    plan_id: uuid.UUID,
    tax_rule_ids: List[uuid.UUID],
    actor_user: User,
    ip_address: Optional[str] = None,
) -> List[TaxRule]:
    plan = get_plan_by_id(db, plan_id)

    tax_rules = db.query(TaxRule).filter(TaxRule.id.in_(tax_rule_ids)).all()
    if len(tax_rules) != len(set(tax_rule_ids)):
        found_ids = {r.id for r in tax_rules}
        missing = set(tax_rule_ids) - found_ids
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tax rules not found: {[str(m) for m in missing]}",
        )

    db.query(PlanTax).filter(PlanTax.plan_id == plan.id).delete()

    for tr_id in tax_rule_ids:
        db.add(PlanTax(plan_id=plan.id, tax_rule_id=tr_id))

    db.flush()

    log_audit_event(
        db=db,
        action="ASSIGN_PLAN_TAXES",
        entity_name="Plan",
        entity_id=plan.id,
        actor_user_id=actor_user.id,
        ip_address=ip_address,
        details={"tax_rule_ids": [str(t) for t in tax_rule_ids]},
    )
    return tax_rules


def get_plan_taxes(db: Session, plan_id: uuid.UUID) -> List[TaxRule]:
    plan = get_plan_by_id(db, plan_id)
    tax_rules = (
        db.query(TaxRule)
        .join(PlanTax, PlanTax.tax_rule_id == TaxRule.id)
        .filter(PlanTax.plan_id == plan.id)
        .all()
    )
    return tax_rules


# =========================================================================
# TAX RULE SERVICES
# =========================================================================

def create_tax_rule(
    db: Session,
    data: TaxRuleCreate,
    actor_user: User,
    ip_address: Optional[str] = None,
) -> TaxRule:
    valid_from = data.valid_from or datetime.datetime.now(datetime.timezone.utc)
    tax_rule = TaxRule(
        name=data.name.strip(),
        rate=data.rate,
        tax_type=data.tax_type,
        is_compound=data.is_compound,
        jurisdiction_country=data.jurisdiction_country.upper(),
        jurisdiction_state=data.jurisdiction_state.strip(),
        tax_scope=data.tax_scope,
        valid_from=valid_from,
        valid_until=data.valid_until,
        is_active=data.is_active,
    )
    db.add(tax_rule)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        err_msg = str(exc.orig)
        if "excl_tax_rule_no_overlapping_scope" in err_msg:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Tax rule overlaps with an existing active tax rule in the same jurisdiction and scope.",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Constraint violation creating tax rule: {err_msg}",
        )

    log_audit_event(
        db=db,
        action="CREATE_TAX_RULE",
        entity_name="TaxRule",
        entity_id=tax_rule.id,
        actor_user_id=actor_user.id,
        ip_address=ip_address,
        details={
            "name": tax_rule.name,
            "rate": str(tax_rule.rate),
            "tax_scope": tax_rule.tax_scope,
            "country": tax_rule.jurisdiction_country,
            "state": tax_rule.jurisdiction_state,
        },
    )
    return tax_rule


def list_tax_rules(
    db: Session,
    search: Optional[str] = None,
    tax_scope: Optional[str] = None,
    jurisdiction_country: Optional[str] = None,
    jurisdiction_state: Optional[str] = None,
    is_active: Optional[bool] = None,
    page: int = 1,
    page_size: int = 20,
) -> Tuple[List[TaxRule], int]:
    query = db.query(TaxRule)

    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(TaxRule.name.ilike(search_term))
    if tax_scope:
        query = query.filter(TaxRule.tax_scope == tax_scope)
    if jurisdiction_country:
        query = query.filter(TaxRule.jurisdiction_country == jurisdiction_country.upper())
    if jurisdiction_state is not None:
        query = query.filter(TaxRule.jurisdiction_state == jurisdiction_state.strip())
    if is_active is not None:
        query = query.filter(TaxRule.is_active == is_active)

    total = query.count()
    items = (
        query.order_by(TaxRule.name.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return items, total


def get_tax_rule_by_id(db: Session, tax_rule_id: uuid.UUID) -> TaxRule:
    tax_rule = db.query(TaxRule).filter(TaxRule.id == tax_rule_id).first()
    if not tax_rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tax rule with ID {tax_rule_id} not found.",
        )
    return tax_rule


def update_tax_rule(
    db: Session,
    tax_rule_id: uuid.UUID,
    data: TaxRuleUpdate,
    actor_user: User,
    ip_address: Optional[str] = None,
) -> TaxRule:
    tax_rule = get_tax_rule_by_id(db, tax_rule_id)
    update_data = data.model_dump(exclude_unset=True)

    if "jurisdiction_country" in update_data and update_data["jurisdiction_country"]:
        update_data["jurisdiction_country"] = update_data["jurisdiction_country"].upper()
    if "jurisdiction_state" in update_data and update_data["jurisdiction_state"] is not None:
        update_data["jurisdiction_state"] = update_data["jurisdiction_state"].strip()
    if "name" in update_data and update_data["name"]:
        update_data["name"] = update_data["name"].strip()

    for field, value in update_data.items():
        setattr(tax_rule, field, value)

    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        err_msg = str(exc.orig)
        if "excl_tax_rule_no_overlapping_scope" in err_msg:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Tax rule update creates an overlap with an existing active tax rule in the same jurisdiction and scope.",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Constraint violation updating tax rule: {err_msg}",
        )

    log_audit_event(
        db=db,
        action="UPDATE_TAX_RULE",
        entity_name="TaxRule",
        entity_id=tax_rule.id,
        actor_user_id=actor_user.id,
        ip_address=ip_address,
        details={"updated_fields": list(update_data.keys())},
    )
    return tax_rule


def deactivate_tax_rule(
    db: Session,
    tax_rule_id: uuid.UUID,
    actor_user: User,
    ip_address: Optional[str] = None,
) -> TaxRule:
    tax_rule = get_tax_rule_by_id(db, tax_rule_id)
    tax_rule.is_active = False
    db.flush()

    log_audit_event(
        db=db,
        action="DEACTIVATE_TAX_RULE",
        entity_name="TaxRule",
        entity_id=tax_rule.id,
        actor_user_id=actor_user.id,
        ip_address=ip_address,
        details={"name": tax_rule.name},
    )
    return tax_rule
