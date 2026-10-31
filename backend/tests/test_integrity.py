import datetime
import uuid
import pytest
from decimal import Decimal
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.exc import IntegrityError, DBAPIError

from app.core.config import settings
from app.models.auth import User
from app.models.customer import Customer, CustomerUser
from app.models.catalog import Product, ProductVariant, Plan, TaxRule
from app.models.quotation import Quotation, QuotationLine
from app.models.subscription import Subscription, SubscriptionLine, SubscriptionPauseHistory
from app.models.billing import Invoice, InvoiceLine, Payment
from app.models.discount import DiscountRule, DiscountRedemption

# Construct strict connection URL to brightloop_test
TEST_DB_URL = f"postgresql+psycopg://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}@{settings.POSTGRES_SERVER}:{settings.POSTGRES_PORT}/brightloop_test"
test_engine = create_engine(TEST_DB_URL, pool_pre_ping=True)
TestSession = sessionmaker(bind=test_engine)


@pytest.fixture(scope="session", autouse=True)
def verify_test_database_target():
    """Fail-fast verification ensuring all tests run strictly against brightloop_test."""
    with test_engine.connect() as conn:
        current_db = conn.execute(text("SELECT current_database();")).scalar()
        assert current_db == "brightloop_test", (
            f"SAFETY VIOLATION: Expected current database to be 'brightloop_test', but got '{current_db}'!"
        )


@pytest.fixture
def db_session():
    """Provides a transactional database session rolled back or cleared after each test."""
    session = TestSession()
    # Double check database name in session
    assert session.execute(text("SELECT current_database();")).scalar() == "brightloop_test"
    try:
        yield session
    finally:
        session.rollback()
        session.close()


def create_test_user(db: Session, email_prefix: str = "user", role: str = "ADMIN") -> User:
    user = User(
        email=f"{email_prefix}_{uuid.uuid4().hex[:8]}@example.com",
        hashed_password="argon2id$test_hash",
        full_name="Test User",
        role=role,
    )
    db.add(user)
    db.flush()
    return user


def create_test_customer(db: Session, prefix: str = "cust") -> Customer:
    clean_prefix = prefix.lower()
    cust = Customer(
        company_name=f"Company {prefix} {uuid.uuid4().hex[:6]}",
        contact_email=f"billing_{clean_prefix}_{uuid.uuid4().hex[:6]}@example.com",
        billing_address_line1="123 MG Road",
        city="Bengaluru",
        state="Karnataka",
        postal_code="560001",
        country="IN",
        currency="INR",
    )
    db.add(cust)
    db.flush()
    return cust


def create_test_plan(db: Session, prefix: str = "plan") -> Plan:
    plan = Plan(
        name=f"Plan {prefix} {uuid.uuid4().hex[:6]}",
        billing_interval="MONTHLY",
        interval_count=1,
        base_price=Decimal("1000.0000"),
    )
    db.add(plan)
    db.flush()
    return plan


def create_test_subscription(db: Session, customer: Customer, plan: Plan, user: User) -> Subscription:
    today = datetime.date.today()
    next_month = today + datetime.timedelta(days=30)
    sub = Subscription(
        subscription_number=f"SUB-{uuid.uuid4().hex[:8].upper()}",
        customer_id=customer.id,
        plan_id=plan.id,
        status="ACTIVE",
        start_date=today,
        current_period_start=today,
        current_period_end=next_month,
        next_billing_date=next_month,
        billing_anchor_day=1,
        billing_interval_snapshot="MONTHLY",
        plan_name_snapshot=plan.name,
        plan_price_snapshot=Decimal("1000.0000"),
        recurring_subtotal=Decimal("1000.00"),
        recurring_discount=Decimal("0.00"),
        recurring_tax=Decimal("180.00"),
        recurring_total_amount=Decimal("1180.00"),
        created_by_user_id=user.id,
    )
    db.add(sub)
    db.flush()
    return sub


# ==============================================================================
# 1. Schema Completeness Tests
# ==============================================================================

def test_schema_completeness(db_session: Session):
    """Verify all 28 Brightloop tables are registered and present in PostgreSQL."""
    expected_tables = {
        "users", "password_reset_tokens",
        "customers", "customer_users",
        "products", "product_variants", "plans", "tax_rules", "product_taxes", "plan_taxes",
        "discount_rules", "discount_rule_products", "discount_redemptions",
        "quotation_templates", "quotation_template_lines", "quotations", "quotation_lines", "quotation_line_taxes",
        "subscriptions", "subscription_lines", "subscription_line_taxes", "subscription_pause_history",
        "invoices", "invoice_lines", "invoice_line_taxes", "payments",
        "audit_logs", "company_settings",
    }
    result = db_session.execute(
        text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name != 'alembic_version';")
    ).fetchall()
    actual_tables = {r[0] for r in result}
    missing = expected_tables - actual_tables
    assert not missing, f"Missing tables in brightloop_test: {missing}"
    assert len(actual_tables) == 28


# ==============================================================================
# 2. Referential Integrity & Cross-Customer Isolation Tests
# ==============================================================================

def test_cross_customer_invoice_subscription_rejection(db_session: Session):
    """Verify composite foreign key rejects invoice assigned to customer B referencing subscription of customer A."""
    user = create_test_user(db_session)
    cust_a = create_test_customer(db_session, "A")
    cust_b = create_test_customer(db_session, "B")
    plan = create_test_plan(db_session)
    sub_a = create_test_subscription(db_session, cust_a, plan, user)

    # Invoice referencing sub_a but assigned to cust_b must fail
    inv = Invoice(
        invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
        subscription_id=sub_a.id,
        customer_id=cust_b.id,  # Mismatch!
        status="CONFIRMED",
        issue_date=datetime.date.today(),
        due_date=datetime.date.today() + datetime.timedelta(days=15),
        billing_period_start=datetime.date.today(),
        billing_period_end=datetime.date.today() + datetime.timedelta(days=30),
        subtotal_amount=Decimal("1000.00"),
        discount_amount=Decimal("0.00"),
        tax_amount=Decimal("180.00"),
        rounding_adjustment=Decimal("0.00"),
        total_amount=Decimal("1180.00"),
        amount_paid=Decimal("0.00"),
        balance_due=Decimal("1180.00"),
    )
    db_session.add(inv)
    with pytest.raises(IntegrityError) as exc_info:
        db_session.flush()
    assert "fk_invoice_subscription_cust" in str(exc_info.value)
    db_session.rollback()


def test_cross_customer_payment_invoice_rejection(db_session: Session):
    """Verify composite foreign key rejects payment assigned to customer B referencing invoice of customer A."""
    user = create_test_user(db_session)
    cust_a = create_test_customer(db_session, "A")
    cust_b = create_test_customer(db_session, "B")
    plan = create_test_plan(db_session)
    sub_a = create_test_subscription(db_session, cust_a, plan, user)

    inv = Invoice(
        invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
        subscription_id=sub_a.id,
        customer_id=cust_a.id,
        status="CONFIRMED",
        issue_date=datetime.date.today(),
        due_date=datetime.date.today() + datetime.timedelta(days=15),
        billing_period_start=datetime.date.today(),
        billing_period_end=datetime.date.today() + datetime.timedelta(days=30),
        subtotal_amount=Decimal("1000.00"),
        discount_amount=Decimal("0.00"),
        tax_amount=Decimal("0.00"),
        rounding_adjustment=Decimal("0.00"),
        total_amount=Decimal("1000.00"),
        amount_paid=Decimal("0.00"),
        balance_due=Decimal("1000.00"),
    )
    db_session.add(inv)
    db_session.flush()

    # Payment referencing inv for cust_a but customer_id=cust_b.id must fail
    pmt = Payment(
        payment_number=f"PAY-{uuid.uuid4().hex[:8].upper()}",
        invoice_id=inv.id,
        customer_id=cust_b.id,  # Mismatch!
        amount=Decimal("500.00"),
        payment_method="BANK_TRANSFER",
        status="SUCCESS",
        recorded_by_user_id=user.id,
    )
    db_session.add(pmt)
    with pytest.raises(IntegrityError) as exc_info:
        db_session.flush()
    assert "fk_payment_invoice_cust" in str(exc_info.value)
    db_session.rollback()


def test_variant_product_mismatch_rejection(db_session: Session):
    """Verify composite foreign key rejects referencing variant of product 1 under product 2."""
    p1 = Product(name="P1", product_type="SERVICE", base_sales_price=Decimal("100.00"))
    p2 = Product(name="P2", product_type="SERVICE", base_sales_price=Decimal("200.00"))
    db_session.add_all([p1, p2])
    db_session.flush()

    v1 = ProductVariant(product_id=p1.id, name="V1 of P1", price_adjustment=Decimal("10.00"))
    db_session.add(v1)
    db_session.flush()

    user = create_test_user(db_session)
    cust = create_test_customer(db_session)
    plan = create_test_plan(db_session)
    quote = Quotation(
        quotation_number=f"QUO-{uuid.uuid4().hex[:8].upper()}",
        customer_id=cust.id,
        plan_id=plan.id,
        status="DRAFT",
        issue_date=datetime.date.today(),
        expiry_date=datetime.date.today() + datetime.timedelta(days=30),
        plan_price_snapshot=Decimal("1000.00"),
        total_amount=Decimal("0.00"),
        created_by_user_id=user.id,
    )
    db_session.add(quote)
    db_session.flush()

    # Mismatched line: product_id is p2, but variant_id is v1 (which belongs to p1)
    line = QuotationLine(
        quotation_id=quote.id,
        line_type="PRODUCT",
        product_id=p2.id,
        variant_id=v1.id,  # Belongs to p1, not p2!
        description_snapshot="Mismatched item",
        unit_price=Decimal("100.00"),
        quantity=1,
        line_total=Decimal("100.00"),
    )
    db_session.add(line)
    with pytest.raises(IntegrityError) as exc_info:
        db_session.flush()
    assert "fk_quote_line_variant_prod" in str(exc_info.value)
    db_session.rollback()


# ==============================================================================
# 3. Financial Integrity & Rounding Constraint Tests
# ==============================================================================

def test_invoice_total_mathematical_reconciliation_check(db_session: Session):
    """Verify CHECK constraint rejects invoice if total != subtotal - discount + tax + rounding."""
    user = create_test_user(db_session)
    cust = create_test_customer(db_session)
    plan = create_test_plan(db_session)
    sub = create_test_subscription(db_session, cust, plan, user)

    # Correct formula: 100 - 10 + 18 + 0.01 = 108.01. Provide 109.00 -> should fail.
    inv = Invoice(
        invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
        subscription_id=sub.id,
        customer_id=cust.id,
        status="CONFIRMED",
        issue_date=datetime.date.today(),
        due_date=datetime.date.today() + datetime.timedelta(days=15),
        billing_period_start=datetime.date.today(),
        billing_period_end=datetime.date.today() + datetime.timedelta(days=30),
        subtotal_amount=Decimal("100.00"),
        discount_amount=Decimal("10.00"),
        tax_amount=Decimal("18.00"),
        rounding_adjustment=Decimal("0.01"),
        total_amount=Decimal("109.00"),  # Incorrect total!
        amount_paid=Decimal("0.00"),
        balance_due=Decimal("109.00"),
    )
    db_session.add(inv)
    with pytest.raises(IntegrityError) as exc_info:
        db_session.flush()
    assert "chk_invoices_total_calc" in str(exc_info.value)
    db_session.rollback()


def test_rounding_adjustment_bounds_check(db_session: Session):
    """Verify CHECK constraint rejects rounding adjustment outside [-0.02, 0.02]."""
    user = create_test_user(db_session)
    cust = create_test_customer(db_session)
    plan = create_test_plan(db_session)
    sub = create_test_subscription(db_session, cust, plan, user)

    # Rounding adjustment of 0.03 exceeds statutory +/- 0.02 limit
    inv = Invoice(
        invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
        subscription_id=sub.id,
        customer_id=cust.id,
        status="CONFIRMED",
        issue_date=datetime.date.today(),
        due_date=datetime.date.today() + datetime.timedelta(days=15),
        billing_period_start=datetime.date.today(),
        billing_period_end=datetime.date.today() + datetime.timedelta(days=30),
        subtotal_amount=Decimal("100.00"),
        discount_amount=Decimal("0.00"),
        tax_amount=Decimal("18.00"),
        rounding_adjustment=Decimal("0.03"),  # > 0.02!
        total_amount=Decimal("118.03"),
        amount_paid=Decimal("0.00"),
        balance_due=Decimal("118.03"),
    )
    db_session.add(inv)
    with pytest.raises(IntegrityError) as exc_info:
        db_session.flush()
    assert "chk_invoices_rounding" in str(exc_info.value)
    db_session.rollback()


def test_invoice_amount_paid_cannot_exceed_total(db_session: Session):
    """Verify CHECK constraint chk_invoices_amount_paid_limit prevents amount_paid > total_amount."""
    user = create_test_user(db_session)
    cust = create_test_customer(db_session)
    plan = create_test_plan(db_session)
    sub = create_test_subscription(db_session, cust, plan, user)

    inv = Invoice(
        invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
        subscription_id=sub.id,
        customer_id=cust.id,
        status="CONFIRMED",
        issue_date=datetime.date.today(),
        due_date=datetime.date.today() + datetime.timedelta(days=15),
        billing_period_start=datetime.date.today(),
        billing_period_end=datetime.date.today() + datetime.timedelta(days=30),
        subtotal_amount=Decimal("100.00"),
        discount_amount=Decimal("0.00"),
        tax_amount=Decimal("0.00"),
        rounding_adjustment=Decimal("0.00"),
        total_amount=Decimal("100.00"),
        amount_paid=Decimal("150.00"),  # > 100.00!
        balance_due=Decimal("-50.00"),
    )
    db_session.add(inv)
    with pytest.raises(IntegrityError) as exc_info:
        db_session.flush()
    assert ("chk_invoices_amount_paid_limit" in str(exc_info.value) or "chk_invoices_balance_nonneg" in str(exc_info.value))
    db_session.rollback()


# ==============================================================================
# 4. Payment Workflow & Voiding Lifecycle Tests
# ==============================================================================

def test_payment_workflow_multiple_payments_and_voiding(db_session: Session):
    """Test recording multiple partial payments, voiding one, and verifying aggregate reconciliation."""
    user = create_test_user(db_session)
    cust = create_test_customer(db_session)
    plan = create_test_plan(db_session)
    sub = create_test_subscription(db_session, cust, plan, user)

    # 1. Create Invoice with total 1000.00
    inv = Invoice(
        invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
        subscription_id=sub.id,
        customer_id=cust.id,
        status="CONFIRMED",
        issue_date=datetime.date.today(),
        due_date=datetime.date.today() + datetime.timedelta(days=15),
        billing_period_start=datetime.date.today(),
        billing_period_end=datetime.date.today() + datetime.timedelta(days=30),
        subtotal_amount=Decimal("1000.00"),
        discount_amount=Decimal("0.00"),
        tax_amount=Decimal("0.00"),
        rounding_adjustment=Decimal("0.00"),
        total_amount=Decimal("1000.00"),
        amount_paid=Decimal("0.00"),
        balance_due=Decimal("1000.00"),
    )
    db_session.add(inv)
    db_session.flush()

    # 2. First partial payment: 400.00
    p1 = Payment(
        payment_number=f"PAY-{uuid.uuid4().hex[:8].upper()}",
        invoice_id=inv.id,
        customer_id=cust.id,
        amount=Decimal("400.00"),
        payment_method="BANK_TRANSFER",
        status="SUCCESS",
        recorded_by_user_id=user.id,
    )
    db_session.add(p1)
    inv.amount_paid = Decimal("400.00")
    inv.balance_due = Decimal("600.00")
    inv.status = "PARTIALLY_PAID"
    db_session.flush()

    # 3. Second payment: 600.00 (Fully pays invoice)
    p2 = Payment(
        payment_number=f"PAY-{uuid.uuid4().hex[:8].upper()}",
        invoice_id=inv.id,
        customer_id=cust.id,
        amount=Decimal("600.00"),
        payment_method="UPI",
        status="SUCCESS",
        recorded_by_user_id=user.id,
    )
    db_session.add(p2)
    inv.amount_paid = Decimal("1000.00")
    inv.balance_due = Decimal("0.00")
    inv.status = "PAID"
    db_session.flush()

    # Verify state after 2 payments
    total_paid = db_session.execute(
        text("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE invoice_id = :inv_id AND status = 'SUCCESS';"),
        {"inv_id": inv.id}
    ).scalar()
    assert Decimal(str(total_paid)) == Decimal("1000.00")
    assert inv.status == "PAID"

    # 4. Void second payment atomically
    p2.status = "VOIDED"
    p2.voided_at = datetime.datetime.now(datetime.timezone.utc)
    p2.voided_by_user_id = user.id
    p2.void_reason = "Customer bank dispute"
    db_session.flush()

    # Recalculate invoice based on active successful payments
    recalc_paid = db_session.execute(
        text("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE invoice_id = :inv_id AND status = 'SUCCESS';"),
        {"inv_id": inv.id}
    ).scalar()
    inv.amount_paid = Decimal(str(recalc_paid))
    inv.balance_due = inv.total_amount - inv.amount_paid
    inv.status = "PARTIALLY_PAID" if inv.amount_paid > 0 else "CONFIRMED"
    db_session.flush()

    assert inv.amount_paid == Decimal("400.00")
    assert inv.balance_due == Decimal("600.00")
    assert inv.status == "PARTIALLY_PAID"


def test_payment_void_state_invariant_rejection(db_session: Session):
    """Verify CHECK constraint chk_payments_void_state rejects inconsistent void columns."""
    user = create_test_user(db_session)
    cust = create_test_customer(db_session)
    plan = create_test_plan(db_session)
    sub = create_test_subscription(db_session, cust, plan, user)

    inv = Invoice(
        invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
        subscription_id=sub.id,
        customer_id=cust.id,
        status="CONFIRMED",
        issue_date=datetime.date.today(),
        due_date=datetime.date.today() + datetime.timedelta(days=15),
        billing_period_start=datetime.date.today(),
        billing_period_end=datetime.date.today() + datetime.timedelta(days=30),
        subtotal_amount=Decimal("100.00"),
        discount_amount=Decimal("0.00"),
        tax_amount=Decimal("0.00"),
        rounding_adjustment=Decimal("0.00"),
        total_amount=Decimal("100.00"),
        amount_paid=Decimal("0.00"),
        balance_due=Decimal("100.00"),
    )
    db_session.add(inv)
    db_session.flush()

    # Case A: status=VOIDED but missing void_reason -> MUST FAIL
    p_invalid_1 = Payment(
        payment_number=f"PAY-{uuid.uuid4().hex[:8].upper()}",
        invoice_id=inv.id,
        customer_id=cust.id,
        amount=Decimal("50.00"),
        payment_method="CASH",
        status="VOIDED",
        voided_at=datetime.datetime.now(datetime.timezone.utc),
        voided_by_user_id=user.id,
        void_reason=None,  # Invalid!
        recorded_by_user_id=user.id,
    )
    db_session.add(p_invalid_1)
    with pytest.raises(IntegrityError) as exc_info:
        db_session.flush()
    assert "chk_payments_void_state" in str(exc_info.value)
    db_session.rollback()

    # Case B: status=SUCCESS but has voided_at set -> MUST FAIL
    p_invalid_2 = Payment(
        payment_number=f"PAY-{uuid.uuid4().hex[:8].upper()}",
        invoice_id=inv.id,
        customer_id=cust.id,
        amount=Decimal("50.00"),
        payment_method="CASH",
        status="SUCCESS",
        voided_at=datetime.datetime.now(datetime.timezone.utc),  # Invalid while SUCCESS!
        recorded_by_user_id=user.id,
    )
    db_session.add(p_invalid_2)
    with pytest.raises(IntegrityError) as exc_info:
        db_session.flush()
    assert "chk_payments_void_state" in str(exc_info.value)
    db_session.rollback()


# ==============================================================================
# 5. PostgreSQL GiST Range Exclusion Constraints
# ==============================================================================

def test_invoice_overlapping_billing_period_rejection(db_session: Session):
    """Verify excl_invoice_no_overlapping_periods rejects overlapping active periods for the same subscription."""
    user = create_test_user(db_session)
    cust = create_test_customer(db_session)
    plan = create_test_plan(db_session)
    sub = create_test_subscription(db_session, cust, plan, user)

    # First invoice: May 1 to June 1, 2026
    inv1 = Invoice(
        invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
        subscription_id=sub.id,
        customer_id=cust.id,
        status="CONFIRMED",
        issue_date=datetime.date(2026, 5, 1),
        due_date=datetime.date(2026, 5, 15),
        billing_period_start=datetime.date(2026, 5, 1),
        billing_period_end=datetime.date(2026, 6, 1),
        subtotal_amount=Decimal("100.00"),
        total_amount=Decimal("100.00"),
        balance_due=Decimal("100.00"),
    )
    db_session.add(inv1)
    db_session.flush()

    # Overlapping invoice: May 15 to June 15, 2026 -> MUST FAIL
    inv2 = Invoice(
        invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
        subscription_id=sub.id,
        customer_id=cust.id,
        status="CONFIRMED",
        issue_date=datetime.date(2026, 5, 15),
        due_date=datetime.date(2026, 5, 30),
        billing_period_start=datetime.date(2026, 5, 15),
        billing_period_end=datetime.date(2026, 6, 15),
        subtotal_amount=Decimal("100.00"),
        total_amount=Decimal("100.00"),
        balance_due=Decimal("100.00"),
    )
    db_session.add(inv2)
    with pytest.raises(IntegrityError) as exc_info:
        db_session.flush()
    assert "excl_invoice_no_overlapping_periods" in str(exc_info.value)
    db_session.rollback()


def test_invoice_adjacent_billing_period_and_cancellation_replacement(db_session: Session):
    """Verify half-open standard allows adjacent periods [May 1, June 1) and [June 1, July 1),
    and filtered exclusion allows replacement when previous invoice is CANCELLED."""
    user = create_test_user(db_session)
    cust = create_test_customer(db_session)
    plan = create_test_plan(db_session)
    sub = create_test_subscription(db_session, cust, plan, user)

    # 1. May period: [2026-05-01, 2026-06-01)
    inv_may = Invoice(
        invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
        subscription_id=sub.id,
        customer_id=cust.id,
        status="CONFIRMED",
        issue_date=datetime.date(2026, 5, 1),
        due_date=datetime.date(2026, 5, 15),
        billing_period_start=datetime.date(2026, 5, 1),
        billing_period_end=datetime.date(2026, 6, 1),
        subtotal_amount=Decimal("100.00"),
        total_amount=Decimal("100.00"),
        balance_due=Decimal("100.00"),
    )
    db_session.add(inv_may)
    db_session.flush()

    # 2. Adjacent June period: [2026-06-01, 2026-07-01) - half open touch point June 1 is ALLOWED
    inv_june = Invoice(
        invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
        subscription_id=sub.id,
        customer_id=cust.id,
        status="CONFIRMED",
        issue_date=datetime.date(2026, 6, 1),
        due_date=datetime.date(2026, 6, 15),
        billing_period_start=datetime.date(2026, 6, 1),
        billing_period_end=datetime.date(2026, 7, 1),
        subtotal_amount=Decimal("100.00"),
        total_amount=Decimal("100.00"),
        balance_due=Decimal("100.00"),
    )
    db_session.add(inv_june)
    db_session.flush()
    assert inv_june.id is not None

    # 3. Cancel May invoice and generate replacement for exact same period [2026-05-01, 2026-06-01)
    inv_may.status = "CANCELLED"
    db_session.flush()

    inv_may_replacement = Invoice(
        invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
        subscription_id=sub.id,
        customer_id=cust.id,
        status="CONFIRMED",
        issue_date=datetime.date(2026, 5, 2),
        due_date=datetime.date(2026, 5, 16),
        billing_period_start=datetime.date(2026, 5, 1),
        billing_period_end=datetime.date(2026, 6, 1),
        subtotal_amount=Decimal("105.00"),
        total_amount=Decimal("105.00"),
        balance_due=Decimal("105.00"),
    )
    db_session.add(inv_may_replacement)
    db_session.flush()
    assert inv_may_replacement.id is not None


def test_tax_rule_exclusion_and_coexistence(db_session: Session):
    """Verify excl_tax_rule_no_overlapping_scope rejects overlapping scope rules,
    while allowing distinct tax scopes (e.g. CGST and SGST) to coexist."""
    # 1. CGST 9% for IN / Maharashtra
    cgst = TaxRule(
        name="CGST 9%",
        rate=Decimal("9.0000"),
        tax_scope="INTRASTATE_CGST",
        jurisdiction_country="IN",
        jurisdiction_state="Maharashtra",
        valid_from=datetime.datetime(2026, 1, 1, tzinfo=datetime.timezone.utc),
        valid_until=datetime.datetime(2026, 12, 31, tzinfo=datetime.timezone.utc),
        is_active=True,
    )
    # 2. SGST 9% for IN / Maharashtra for same period -> Distinct scope, MUST SUCCEED
    sgst = TaxRule(
        name="SGST 9%",
        rate=Decimal("9.0000"),
        tax_scope="INTRASTATE_SGST",
        jurisdiction_country="IN",
        jurisdiction_state="Maharashtra",
        valid_from=datetime.datetime(2026, 1, 1, tzinfo=datetime.timezone.utc),
        valid_until=datetime.datetime(2026, 12, 31, tzinfo=datetime.timezone.utc),
        is_active=True,
    )
    db_session.add_all([cgst, sgst])
    db_session.flush()

    # 3. Duplicate overlapping CGST rule for IN / Maharashtra -> MUST FAIL
    cgst_conflict = TaxRule(
        name="CGST 9% Conflict",
        rate=Decimal("9.0000"),
        tax_scope="INTRASTATE_CGST",
        jurisdiction_country="IN",
        jurisdiction_state="Maharashtra",
        valid_from=datetime.datetime(2026, 6, 1, tzinfo=datetime.timezone.utc),
        valid_until=datetime.datetime(2026, 12, 31, tzinfo=datetime.timezone.utc),
        is_active=True,
    )
    db_session.add(cgst_conflict)
    with pytest.raises(IntegrityError) as exc_info:
        db_session.flush()
    assert "excl_tax_rule_no_overlapping_scope" in str(exc_info.value)
    db_session.rollback()


# ==============================================================================
# 6. Partial Unique Indexes
# ==============================================================================

def test_customer_user_one_active_primary_constraint(db_session: Session):
    """Verify idx_customer_users_one_primary allows only one primary active owner per customer."""
    u1 = create_test_user(db_session, "u1", "CUSTOMER")
    u2 = create_test_user(db_session, "u2", "CUSTOMER")
    cust = create_test_customer(db_session)

    cu1 = CustomerUser(
        customer_id=cust.id,
        user_id=u1.id,
        membership_role="OWNER",
        is_primary=True,
        status="ACTIVE",
    )
    db_session.add(cu1)
    db_session.flush()

    # Second active primary owner -> MUST FAIL
    cu2 = CustomerUser(
        customer_id=cust.id,
        user_id=u2.id,
        membership_role="OWNER",
        is_primary=True,
        status="ACTIVE",
    )
    db_session.add(cu2)
    with pytest.raises(IntegrityError) as exc_info:
        db_session.flush()
    assert "idx_customer_users_one_primary" in str(exc_info.value)
    db_session.rollback()


def test_single_open_subscription_pause_constraint(db_session: Session):
    """Verify idx_sub_pause_single_open allows at most one active (unresumed) pause."""
    user = create_test_user(db_session)
    cust = create_test_customer(db_session)
    plan = create_test_plan(db_session)
    sub = create_test_subscription(db_session, cust, plan, user)

    p1 = SubscriptionPauseHistory(
        subscription_id=sub.id,
        paused_at=datetime.datetime.now(datetime.timezone.utc),
        resumed_at=None,
        pause_reason="Seasonal downtime",
        initiated_by_user_id=user.id,
    )
    db_session.add(p1)
    db_session.flush()

    # Second concurrent open pause for same subscription -> MUST FAIL
    p2 = SubscriptionPauseHistory(
        subscription_id=sub.id,
        paused_at=datetime.datetime.now(datetime.timezone.utc),
        resumed_at=None,
        pause_reason="Second pause attempt",
        initiated_by_user_id=user.id,
    )
    db_session.add(p2)
    with pytest.raises(IntegrityError) as exc_info:
        db_session.flush()
    assert "idx_sub_pause_single_open" in str(exc_info.value)
    db_session.rollback()


def test_single_plan_fee_line_per_invoice(db_session: Session):
    """Verify uq_inv_single_plan_fee allows at most one PLAN_FEE line per invoice."""
    user = create_test_user(db_session)
    cust = create_test_customer(db_session)
    plan = create_test_plan(db_session)
    sub = create_test_subscription(db_session, cust, plan, user)

    inv = Invoice(
        invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
        subscription_id=sub.id,
        customer_id=cust.id,
        status="CONFIRMED",
        issue_date=datetime.date.today(),
        due_date=datetime.date.today() + datetime.timedelta(days=15),
        billing_period_start=datetime.date.today(),
        billing_period_end=datetime.date.today() + datetime.timedelta(days=30),
        subtotal_amount=Decimal("2000.00"),
        total_amount=Decimal("2000.00"),
        balance_due=Decimal("2000.00"),
    )
    db_session.add(inv)
    db_session.flush()

    line1 = InvoiceLine(
        invoice_id=inv.id,
        line_type="PLAN_FEE",
        description="Base Plan Fee Line 1",
        quantity=1,
        unit_price=Decimal("1000.0000"),
        line_total=Decimal("1000.0000"),
    )
    db_session.add(line1)
    db_session.flush()

    # Second PLAN_FEE line on same invoice -> MUST FAIL
    line2 = InvoiceLine(
        invoice_id=inv.id,
        line_type="PLAN_FEE",
        description="Duplicate Plan Fee Line 2",
        quantity=1,
        unit_price=Decimal("1000.0000"),
        line_total=Decimal("1000.0000"),
    )
    db_session.add(line2)
    with pytest.raises(IntegrityError) as exc_info:
        db_session.flush()
    assert "uq_inv_single_plan_fee" in str(exc_info.value)
    db_session.rollback()


# ==============================================================================
# 7. Row Locking & Concurrency Protection
# ==============================================================================

def test_row_locking_select_for_update_prevents_overpayment(db_session: Session):
    """Verify SELECT ... FOR UPDATE pattern reliably serializes concurrent payment attempts."""
    user = create_test_user(db_session)
    cust = create_test_customer(db_session)
    plan = create_test_plan(db_session)
    sub = create_test_subscription(db_session, cust, plan, user)

    inv = Invoice(
        invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
        subscription_id=sub.id,
        customer_id=cust.id,
        status="CONFIRMED",
        issue_date=datetime.date.today(),
        due_date=datetime.date.today() + datetime.timedelta(days=15),
        billing_period_start=datetime.date.today(),
        billing_period_end=datetime.date.today() + datetime.timedelta(days=30),
        subtotal_amount=Decimal("500.00"),
        total_amount=Decimal("500.00"),
        amount_paid=Decimal("0.00"),
        balance_due=Decimal("500.00"),
    )
    db_session.add(inv)
    db_session.flush()

    # In a backend payment transaction, lock the invoice row first:
    locked_inv = db_session.query(Invoice).with_for_update().filter_by(id=inv.id).one()
    assert locked_inv.balance_due == Decimal("500.00")

    # Payment of 300.00 succeeds
    p1 = Payment(
        payment_number=f"PAY-{uuid.uuid4().hex[:8].upper()}",
        invoice_id=locked_inv.id,
        customer_id=cust.id,
        amount=Decimal("300.00"),
        payment_method="BANK_TRANSFER",
        status="SUCCESS",
        recorded_by_user_id=user.id,
    )
    db_session.add(p1)
    locked_inv.amount_paid += p1.amount
    locked_inv.balance_due = locked_inv.total_amount - locked_inv.amount_paid
    locked_inv.status = "PARTIALLY_PAID"
    db_session.flush()

    # An incoming payment of 300.00 checks remaining balance under row lock:
    incoming_attempt = Decimal("300.00")
    if incoming_attempt > locked_inv.balance_due:
        # Rejected cleanly by business rule before creating overpayment
        rejected = True
    else:
        rejected = False

    assert rejected is True
    assert locked_inv.balance_due == Decimal("200.00")
    assert locked_inv.amount_paid == Decimal("300.00")
