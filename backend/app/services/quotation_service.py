import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional, Tuple
import uuid
from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.auth import User
from app.models.catalog import Plan, PlanTax, Product, ProductTax, ProductVariant, TaxRule
from app.models.customer import Customer, CustomerUser
from app.models.discount import DiscountRedemption, DiscountRule
from app.models.quotation import (
    Quotation,
    QuotationLine,
    QuotationLineTax,
    QuotationTemplate,
    QuotationTemplateLine,
)
from app.schemas.discount import DiscountEvaluationRequest
from app.schemas.quotation import (
    QuotationCreate,
    QuotationLineCreate,
    QuotationStatusUpdate,
    QuotationTemplateCreate,
    QuotationTemplateUpdate,
    QuotationUpdate,
)
from app.services.audit_service import log_audit_event
from app.services.discount_service import evaluate_discount


# =========================================================================
# QUOTATION TEMPLATE SERVICES
# =========================================================================

def create_quotation_template(
    db: Session,
    data: QuotationTemplateCreate,
    actor_user: User,
    ip_address: Optional[str] = None,
) -> QuotationTemplate:
    clean_name = data.name.strip()
    existing = db.query(QuotationTemplate).filter(QuotationTemplate.name == clean_name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Quotation template with name '{clean_name}' already exists.",
        )

    # Verify plan exists
    plan = db.query(Plan).filter(Plan.id == data.plan_id).first()
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plan {data.plan_id} not found.",
        )

    template = QuotationTemplate(
        name=clean_name,
        description=data.description,
        plan_id=plan.id,
        validity_duration_days=data.validity_duration_days,
        is_active=data.is_active,
    )
    db.add(template)
    db.flush()

    # Add template lines
    for line_in in data.lines:
        prod = db.query(Product).filter(Product.id == line_in.product_id).first()
        if not prod:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product {line_in.product_id} not found for template line.",
            )
        if line_in.variant_id:
            variant = (
                db.query(ProductVariant)
                .filter(ProductVariant.id == line_in.variant_id, ProductVariant.product_id == prod.id)
                .first()
            )
            if not variant:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Variant {line_in.variant_id} does not belong to product {prod.id}.",
                )
        tpl_line = QuotationTemplateLine(
            template_id=template.id,
            product_id=prod.id,
            variant_id=line_in.variant_id,
            quantity=line_in.quantity,
            unit_price_override=line_in.unit_price_override,
        )
        db.add(tpl_line)

    db.flush()

    log_audit_event(
        db=db,
        action="CREATE_QUOTATION_TEMPLATE",
        entity_name="QuotationTemplate",
        entity_id=template.id,
        actor_user_id=actor_user.id,
        ip_address=ip_address,
        details={"name": template.name, "plan_id": str(plan.id)},
    )
    return template


def list_quotation_templates(
    db: Session,
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    page: int = 1,
    page_size: int = 20,
) -> Tuple[List[QuotationTemplate], int]:
    query = db.query(QuotationTemplate)
    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                QuotationTemplate.name.ilike(search_term),
                QuotationTemplate.description.ilike(search_term),
            )
        )
    if is_active is not None:
        query = query.filter(QuotationTemplate.is_active == is_active)

    total = query.count()
    items = (
        query.order_by(QuotationTemplate.name.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return items, total


def get_quotation_template_by_id(db: Session, template_id: uuid.UUID) -> QuotationTemplate:
    tpl = db.query(QuotationTemplate).filter(QuotationTemplate.id == template_id).first()
    if not tpl:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Quotation template {template_id} not found.",
        )
    return tpl


# =========================================================================
# QUOTATION FINANCIAL CALCULATION ENGINE
# =========================================================================

def _calculate_quotation_financials(
    db: Session,
    customer: Customer,
    plan: Plan,
    input_lines: List[QuotationLineCreate],
    discount_code: Optional[str] = None,
) -> dict:
    """
    Computes 4-decimal exact line totals, statutory tax snapshots,
    promotional discounts, and performs 2-decimal rounding with explicit
    reconciliation adjustment (-0.02 to +0.02) satisfying the database CHECK constraint:
    total_amount = subtotal_amount - discount_amount + tax_amount + rounding_adjustment
    """
    has_plan_fee_line = any(l.line_type == "PLAN_FEE" for l in input_lines)
    all_lines_to_process = list(input_lines)

    # Automatically include PLAN_FEE line if not provided
    if not has_plan_fee_line:
        all_lines_to_process.insert(
            0,
            QuotationLineCreate(
                line_type="PLAN_FEE",
                product_id=None,
                variant_id=None,
                description_snapshot=f"Subscription Plan: {plan.name}",
                unit_price=plan.base_price,
                quantity=1,
                discount_amount=Decimal("0.0000"),
            ),
        )

    processed_lines = []
    evaluation_items = []
    exact_subtotal = Decimal("0.0000")
    exact_line_discount = Decimal("0.0000")
    exact_tax = Decimal("0.0000")

    for line_in in all_lines_to_process:
        if line_in.line_type == "PLAN_FEE":
            unit_price = line_in.unit_price if line_in.unit_price is not None else plan.base_price
            desc = line_in.description_snapshot or f"Subscription Plan: {plan.name}"
            # Plan fee taxes
            tax_rules = (
                db.query(TaxRule)
                .join(PlanTax, PlanTax.tax_rule_id == TaxRule.id)
                .filter(PlanTax.plan_id == plan.id, TaxRule.is_active.is_(True))
                .all()
            )
            prod_id = None
            var_id = None
        else:
            prod = db.query(Product).filter(Product.id == line_in.product_id).first()
            if not prod:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Product {line_in.product_id} not found.",
                )
            variant = None
            if line_in.variant_id:
                variant = (
                    db.query(ProductVariant)
                    .filter(ProductVariant.id == line_in.variant_id, ProductVariant.product_id == prod.id)
                    .first()
                )
                if not variant:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Variant {line_in.variant_id} does not belong to product {prod.id}.",
                    )

            if line_in.unit_price is not None:
                unit_price = line_in.unit_price
            else:
                unit_price = prod.base_sales_price + (variant.price_adjustment if variant else Decimal("0.0000"))

            desc = line_in.description_snapshot or (f"{prod.name} ({variant.name})" if variant else prod.name)

            tax_rules = (
                db.query(TaxRule)
                .join(ProductTax, ProductTax.tax_rule_id == TaxRule.id)
                .filter(ProductTax.product_id == prod.id, TaxRule.is_active.is_(True))
                .all()
            )
            prod_id = prod.id
            var_id = variant.id if variant else None

            evaluation_items.append({
                "product_id": prod.id,
                "quantity": line_in.quantity,
                "unit_price": unit_price,
            })

        quantity = line_in.quantity
        line_base = (unit_price * Decimal(quantity)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        line_disc = line_in.discount_amount.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        line_disc = min(line_disc, line_base)
        net_line = line_base - line_disc

        # Calculate statutory taxes per line
        line_taxes = []
        line_tax_sum = Decimal("0.0000")
        total_rate = Decimal("0.0000")

        for tr in tax_rules:
            tr_amount = (net_line * (tr.rate / Decimal("100.0000"))).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
            line_taxes.append({
                "tax_rule_id": tr.id,
                "tax_name_snapshot": tr.name,
                "tax_rate_snapshot": tr.rate,
                "tax_amount": tr_amount,
            })
            line_tax_sum += tr_amount
            total_rate += tr.rate

        line_total = net_line + line_tax_sum

        exact_subtotal += line_base
        exact_line_discount += line_disc
        exact_tax += line_tax_sum

        processed_lines.append({
            "line_type": line_in.line_type,
            "product_id": prod_id,
            "variant_id": var_id,
            "description_snapshot": desc,
            "unit_price": unit_price,
            "quantity": quantity,
            "tax_rate_snapshot": total_rate,
            "tax_amount": line_tax_sum,
            "discount_amount": line_disc,
            "line_total": line_total,
            "taxes": line_taxes,
        })

    # Evaluate promotional discount code if supplied
    header_discount = Decimal("0.0000")
    applied_discount_rule = None

    if discount_code and discount_code.strip():
        eval_resp = evaluate_discount(
            db=db,
            request=DiscountEvaluationRequest(
                code=discount_code.strip(),
                order_subtotal=exact_subtotal,
                items=evaluation_items,
                cycle_number=1,
                customer_id=customer.id,
            ),
        )
        if eval_resp.is_eligible:
            header_discount = eval_resp.discount_amount
            applied_discount_rule = (
                db.query(DiscountRule).filter(DiscountRule.code == eval_resp.discount_code).first()
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Discount code '{discount_code}' is ineligible: {eval_resp.rejection_reason}",
            )

    exact_total_discount = min(exact_line_discount + header_discount, exact_subtotal)
    exact_unrounded_total = exact_subtotal - exact_total_discount + exact_tax

    # Document-level 2-decimal settlement
    subtotal_amount = exact_subtotal.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    discount_amount = exact_total_discount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    tax_amount = exact_tax.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    total_amount = exact_unrounded_total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # Explicit rounding adjustment reconciliation:
    # total_amount - (subtotal_amount - discount_amount + tax_amount)
    rounding_adjustment = total_amount - (subtotal_amount - discount_amount + tax_amount)

    return {
        "processed_lines": processed_lines,
        "subtotal_amount": subtotal_amount,
        "discount_amount": discount_amount,
        "tax_amount": tax_amount,
        "rounding_adjustment": rounding_adjustment,
        "total_amount": total_amount,
        "applied_discount_rule": applied_discount_rule,
    }


# =========================================================================
# QUOTATION CRUD & LIFECYCLE SERVICES
# =========================================================================

def _generate_quotation_number(db: Session) -> str:
    month_prefix = datetime.date.today().strftime("%Y%m")
    unique_suffix = uuid.uuid4().hex[:6].upper()
    return f"QT-{month_prefix}-{unique_suffix}"


def create_quotation(
    db: Session,
    data: QuotationCreate,
    actor_user: User,
    ip_address: Optional[str] = None,
) -> Quotation:
    customer = db.query(Customer).filter(Customer.id == data.customer_id).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer organization {data.customer_id} not found.",
        )
    if not customer.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot prepare quotation for deactivated customer organization.",
        )

    plan = db.query(Plan).filter(Plan.id == data.plan_id).first()
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plan {data.plan_id} not found.",
        )
    if not plan.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Plan '{plan.name}' is deactivated and cannot be quoted.",
        )

    # If lines not explicitly supplied but template_id is given, load template lines
    input_lines = list(data.lines)
    if not input_lines and data.template_id:
        template = get_quotation_template_by_id(db, data.template_id)
        for tline in template.lines:
            input_lines.append(
                QuotationLineCreate(
                    line_type="PRODUCT",
                    product_id=tline.product_id,
                    variant_id=tline.variant_id,
                    quantity=tline.quantity,
                    unit_price=tline.unit_price_override,
                )
            )

    calc = _calculate_quotation_financials(
        db=db,
        customer=customer,
        plan=plan,
        input_lines=input_lines,
        discount_code=data.discount_code,
    )

    issue_date = data.issue_date or datetime.date.today()
    if data.expiry_date:
        expiry_date = data.expiry_date
    else:
        duration_days = data.validity_duration_days or 30
        expiry_date = issue_date + datetime.timedelta(days=duration_days)

    if expiry_date < issue_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quotation expiry_date must be on or after issue_date.",
        )

    quote = Quotation(
        quotation_number=_generate_quotation_number(db),
        customer_id=customer.id,
        template_id=data.template_id,
        plan_id=plan.id,
        status="DRAFT",
        issue_date=issue_date,
        expiry_date=expiry_date,
        plan_price_snapshot=plan.base_price,
        subtotal_amount=calc["subtotal_amount"],
        discount_amount=calc["discount_amount"],
        tax_amount=calc["tax_amount"],
        rounding_adjustment=calc["rounding_adjustment"],
        total_amount=calc["total_amount"],
        currency=data.currency,
        notes=data.notes,
        created_by_user_id=actor_user.id,
    )
    db.add(quote)
    db.flush()

    for pl in calc["processed_lines"]:
        ql = QuotationLine(
            quotation_id=quote.id,
            line_type=pl["line_type"],
            product_id=pl["product_id"],
            variant_id=pl["variant_id"],
            description_snapshot=pl["description_snapshot"],
            unit_price=pl["unit_price"],
            quantity=pl["quantity"],
            tax_rate_snapshot=pl["tax_rate_snapshot"],
            tax_amount=pl["tax_amount"],
            discount_amount=pl["discount_amount"],
            line_total=pl["line_total"],
        )
        db.add(ql)
        db.flush()

        for t in pl["taxes"]:
            qlt = QuotationLineTax(
                quotation_line_id=ql.id,
                tax_rule_id=t["tax_rule_id"],
                tax_name_snapshot=t["tax_name_snapshot"],
                tax_rate_snapshot=t["tax_rate_snapshot"],
                tax_amount=t["tax_amount"],
            )
            db.add(qlt)

    db.flush()

    log_audit_event(
        db=db,
        action="CREATE_QUOTATION",
        entity_name="Quotation",
        entity_id=quote.id,
        actor_user_id=actor_user.id,
        ip_address=ip_address,
        details={
            "quotation_number": quote.quotation_number,
            "customer_id": str(customer.id),
            "total_amount": str(quote.total_amount),
        },
    )
    return quote


def list_quotations(
    db: Session,
    current_user: User,
    customer_id: Optional[uuid.UUID] = None,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> Tuple[List[Quotation], int]:
    query = db.query(Quotation)

    # Customer isolation
    if current_user.role == "CUSTOMER":
        user_customer_ids = [
            cu.customer_id for cu in current_user.customer_memberships if cu.status == "ACTIVE"
        ]
        query = query.filter(Quotation.customer_id.in_(user_customer_ids))
    elif customer_id:
        query = query.filter(Quotation.customer_id == customer_id)

    if status_filter:
        query = query.filter(Quotation.status == status_filter)
    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Quotation.quotation_number.ilike(search_term),
                Quotation.notes.ilike(search_term),
            )
        )

    total = query.count()
    items = (
        query.order_by(Quotation.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return items, total


def get_quotation_by_id(
    db: Session,
    quotation_id: uuid.UUID,
    current_user: User,
) -> Quotation:
    quote = db.query(Quotation).filter(Quotation.id == quotation_id).first()
    if not quote:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Quotation {quotation_id} not found.",
        )

    # Tenant check for customer
    if current_user.role == "CUSTOMER":
        user_customer_ids = {
            cu.customer_id for cu in current_user.customer_memberships if cu.status == "ACTIVE"
        }
        if quote.customer_id not in user_customer_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to quotation belonging to another customer organization.",
            )

    return quote


def update_quotation(
    db: Session,
    quotation_id: uuid.UUID,
    data: QuotationUpdate,
    actor_user: User,
    ip_address: Optional[str] = None,
) -> Quotation:
    quote = get_quotation_by_id(db, quotation_id, actor_user)

    if quote.status != "DRAFT":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot update quotation in '{quote.status}' state. Only DRAFT quotations can be modified.",
        )

    if data.expiry_date:
        if data.expiry_date < quote.issue_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="expiry_date must be on or after issue_date.",
            )
        quote.expiry_date = data.expiry_date

    if data.notes is not None:
        quote.notes = data.notes

    if data.lines is not None:
        # Recompute lines and totals
        plan = quote.plan
        customer = quote.customer
        calc = _calculate_quotation_financials(
            db=db,
            customer=customer,
            plan=plan,
            input_lines=data.lines,
            discount_code=data.discount_code,
        )

        quote.subtotal_amount = calc["subtotal_amount"]
        quote.discount_amount = calc["discount_amount"]
        quote.tax_amount = calc["tax_amount"]
        quote.rounding_adjustment = calc["rounding_adjustment"]
        quote.total_amount = calc["total_amount"]

        # Delete existing lines
        db.query(QuotationLine).filter(QuotationLine.quotation_id == quote.id).delete()
        db.flush()

        for pl in calc["processed_lines"]:
            ql = QuotationLine(
                quotation_id=quote.id,
                line_type=pl["line_type"],
                product_id=pl["product_id"],
                variant_id=pl["variant_id"],
                description_snapshot=pl["description_snapshot"],
                unit_price=pl["unit_price"],
                quantity=pl["quantity"],
                tax_rate_snapshot=pl["tax_rate_snapshot"],
                tax_amount=pl["tax_amount"],
                discount_amount=pl["discount_amount"],
                line_total=pl["line_total"],
            )
            db.add(ql)
            db.flush()

            for t in pl["taxes"]:
                qlt = QuotationLineTax(
                    quotation_line_id=ql.id,
                    tax_rule_id=t["tax_rule_id"],
                    tax_name_snapshot=t["tax_name_snapshot"],
                    tax_rate_snapshot=t["tax_rate_snapshot"],
                    tax_amount=t["tax_amount"],
                )
                db.add(qlt)

    db.flush()

    log_audit_event(
        db=db,
        action="UPDATE_QUOTATION",
        entity_name="Quotation",
        entity_id=quote.id,
        actor_user_id=actor_user.id,
        ip_address=ip_address,
        details={"quotation_number": quote.quotation_number},
    )
    return quote


def update_quotation_status(
    db: Session,
    quotation_id: uuid.UUID,
    data: QuotationStatusUpdate,
    actor_user: User,
    ip_address: Optional[str] = None,
) -> Quotation:
    quote = get_quotation_by_id(db, quotation_id, actor_user)
    target_status = data.status

    # Validate state transitions
    if quote.status in ("CONFIRMED", "REJECTED", "EXPIRED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Quotation is in terminal state '{quote.status}' and cannot transition to '{target_status}'.",
        )

    if target_status == "CONFIRMED":
        if datetime.date.today() > quote.expiry_date:
            quote.status = "EXPIRED"
            db.flush()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Quotation expired on {quote.expiry_date} and cannot be confirmed.",
            )

    quote.status = target_status
    db.flush()

    log_audit_event(
        db=db,
        action="UPDATE_QUOTATION_STATUS",
        entity_name="Quotation",
        entity_id=quote.id,
        actor_user_id=actor_user.id,
        ip_address=ip_address,
        details={
            "quotation_number": quote.quotation_number,
            "new_status": target_status,
            "rejection_reason": data.rejection_reason,
        },
    )
    return quote
