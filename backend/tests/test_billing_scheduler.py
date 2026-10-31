import datetime
from decimal import Decimal
import uuid
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session

from app.core.config import settings
from app.models.auth import User
from app.models.billing import Invoice
from app.models.catalog import Plan
from app.models.customer import Customer
from app.models.quotation import Quotation, QuotationLine
from app.models.subscription import Subscription, SubscriptionLine
from app.services.billing_scheduler import run_scheduled_billing
from app.services.subscription_service import convert_quotation_to_subscription
from app.schemas.subscription import ConvertQuotationRequest

TEST_DB_URL = f"postgresql+psycopg://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}@{settings.POSTGRES_SERVER}:{settings.POSTGRES_PORT}/brightloop_test"
test_engine = create_engine(TEST_DB_URL, pool_pre_ping=True)
TestSession = sessionmaker(bind=test_engine)


@pytest.fixture(scope="session", autouse=True)
def verify_test_database_target():
    with test_engine.connect() as conn:
        current_db = conn.execute(text("SELECT current_database();")).scalar()
        assert current_db == "brightloop_test", (
            f"SAFETY VIOLATION: Expected current database to be 'brightloop_test', but got '{current_db}'!"
        )


@pytest.fixture(autouse=True)
def cleanup_artifacts():
    yield
    with test_engine.begin() as conn:
        conn.execute(text("DELETE FROM payments WHERE 1=1"))
        conn.execute(text("DELETE FROM invoice_line_taxes WHERE 1=1"))
        conn.execute(text("DELETE FROM invoice_lines WHERE 1=1"))
        conn.execute(text("DELETE FROM invoices WHERE 1=1"))
        conn.execute(text("DELETE FROM subscription_line_taxes WHERE 1=1"))
        conn.execute(text("DELETE FROM subscription_lines WHERE 1=1"))
        conn.execute(text("DELETE FROM subscription_pause_history WHERE 1=1"))
        conn.execute(text("DELETE FROM subscriptions WHERE 1=1"))
        conn.execute(text("DELETE FROM quotation_line_taxes WHERE 1=1"))
        conn.execute(text("DELETE FROM quotation_lines WHERE 1=1"))
        conn.execute(text("DELETE FROM quotations WHERE 1=1"))


def test_scheduled_billing_execution_and_idempotency():
    """Verify that scheduled billing runner processes eligible subscriptions and is idempotent."""
    session = TestSession()
    try:
        suffix = uuid.uuid4().hex[:6]
        today = datetime.date.today()

        # Create staff user
        staff = User(
            email=f"staff_{suffix}@example.com",
            full_name=f"Staff {suffix}",
            hashed_password="mock",
            role="STAFF",
            is_active=True,
        )
        session.add(staff)

        # Create customer
        customer = Customer(
            company_name=f"Scheduler Test {suffix}",
            contact_email=f"sched_{suffix}@example.com",
            billing_address_line1="456 Tech Park",
            city="Bengaluru",
            state="Karnataka",
            postal_code="560001",
            country="IN",
            currency="INR",
            is_active=True,
        )
        session.add(customer)

        # Create plan
        plan = Plan(
            name=f"Sched Plan {suffix}",
            billing_interval="DAILY",
            interval_count=1,
            base_price=Decimal("150.0000"),
            is_active=True,
        )
        session.add(plan)
        session.commit()

        # Create active subscription directly
        sub = Subscription(
            subscription_number=f"SUB-SCHED-{suffix}",
            customer_id=customer.id,
            plan_id=plan.id,
            status="ACTIVE",
            start_date=today,
            expiry_date=today + datetime.timedelta(days=365),
            current_period_start=today,
            current_period_end=today + datetime.timedelta(days=1),
            next_billing_date=today,
            billing_anchor_day=today.day,
            billing_interval_snapshot="DAILY",
            interval_count_snapshot=1,
            plan_name_snapshot=plan.name,
            plan_price_snapshot=Decimal("150.0000"),
            recurring_subtotal=Decimal("150.00"),
            recurring_discount=Decimal("0.00"),
            recurring_tax=Decimal("0.00"),
            recurring_total_amount=Decimal("150.00"),
            payment_terms_days=7,
            created_by_user_id=staff.id,
        )
        session.add(sub)
        session.flush()

        sline = SubscriptionLine(
            subscription_id=sub.id,
            line_type="PLAN_FEE",
            description_snapshot="Daily Plan Fee",
            unit_price_snapshot=Decimal("150.0000"),
            quantity=1,
            tax_rate_snapshot=Decimal("0.0000"),
            line_total=Decimal("150.0000"),
        )
        session.add(sline)
        session.commit()
        sub_id = sub.id
    finally:
        session.close()

    # 1. Run scheduled billing for today
    session_run1 = TestSession()
    try:
        res1 = run_scheduled_billing(billing_date=today, db=session_run1)
        assert res1["invoices_created"] >= 1
        assert res1["failures"] == 0
    finally:
        session_run1.close()

    # Verify invoice exists in DB
    session2 = TestSession()
    try:
        inv_count = session2.query(Invoice).filter(Invoice.subscription_id == sub_id).count()
        assert inv_count == 1
    finally:
        session2.close()

    # 2. Run scheduled billing again for the exact same date -> Idempotent!
    session_run2 = TestSession()
    try:
        res2 = run_scheduled_billing(billing_date=today, db=session_run2)
        assert res2["invoices_created"] == 0
    finally:
        session_run2.close()

    session3 = TestSession()
    try:
        inv_count2 = session3.query(Invoice).filter(Invoice.subscription_id == sub_id).count()
        assert inv_count2 == 1
    finally:
        session3.close()
