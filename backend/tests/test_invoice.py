import datetime
from decimal import Decimal
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session

from app.core.config import settings
from app.core.security import create_access_token, hash_password
from app.db.session import get_db
from app.main import app
from app.models.auth import User
from app.models.billing import Invoice, InvoiceLine, InvoiceLineTax, Payment
from app.models.catalog import Plan, Product, ProductVariant, TaxRule
from app.models.customer import Customer, CustomerUser
from app.models.quotation import Quotation, QuotationLine, QuotationLineTax
from app.models.subscription import Subscription, SubscriptionLine, SubscriptionLineTax
from app.services.billing_service import calculate_next_billing_date

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


@pytest.fixture
def db_session():
    session = TestSession()
    assert session.execute(text("SELECT current_database();")).scalar() == "brightloop_test"
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture(autouse=True)
def cleanup_invoice_artifacts():
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


@pytest.fixture
def client(db_session: Session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def create_user_with_token(db: Session, role: str) -> tuple[User, str]:
    suffix = uuid.uuid4().hex[:8]
    user = User(
        email=f"user_{suffix}@example.com",
        full_name=f"User {suffix}",
        hashed_password=hash_password("Password123!"),
        role=role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(subject=str(user.id))
    return user, token


def create_test_customer(db: Session, name_suffix: str) -> Customer:
    customer = Customer(
        company_name=f"Customer {name_suffix}",
        contact_email=f"contact_{name_suffix}@example.com",
        contact_phone="9876543210",
        billing_address_line1="123 Test Street",
        city="Bengaluru",
        state="Karnataka",
        postal_code="560001",
        country="IN",
        currency="INR",
        is_active=True,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


def test_anchor_day_and_leap_year_calculation():
    """Verify month-end anchoring on 28th, 29th, 30th, 31st and leap year."""
    # Anchored on 31st: Jan 31 -> Feb 28 in non-leap year (2025)
    d1 = datetime.date(2025, 1, 31)
    d2 = calculate_next_billing_date(d1, "MONTHLY", 1, 31)
    assert d2 == datetime.date(2025, 2, 28)

    # In leap year 2024: Jan 31 -> Feb 29
    d_leap = datetime.date(2024, 1, 31)
    d_leap_2 = calculate_next_billing_date(d_leap, "MONTHLY", 1, 31)
    assert d_leap_2 == datetime.date(2024, 2, 29)

    # Feb 28 back to March with anchor 31 -> March 31
    d3 = calculate_next_billing_date(d2, "MONTHLY", 1, 31)
    assert d3 == datetime.date(2025, 3, 31)

    # March 31 to April with anchor 31 -> April 30
    d4 = calculate_next_billing_date(d3, "MONTHLY", 1, 31)
    assert d4 == datetime.date(2025, 4, 30)


def test_invoice_generation_and_check_constraints(client: TestClient, db_session: Session):
    """Test generating an invoice from subscription and verifying CHECK constraints."""
    admin_user, admin_token = create_user_with_token(db_session, "ADMIN")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    staff_user, staff_token = create_user_with_token(db_session, "STAFF")
    staff_headers = {"Authorization": f"Bearer {staff_token}"}
    suffix = uuid.uuid4().hex[:6]

    customer = create_test_customer(db_session, suffix)

    # Create Product & Variant (Admin only)
    prod_resp = client.post(
        "/api/v1/products/",
        headers=admin_headers,
        json={"name": f"Cloud VM {suffix}", "product_type": "SERVICE", "base_sales_price": "1000.0000"},
    )
    assert prod_resp.status_code == 201
    prod_id = prod_resp.json()["id"]

    var_resp = client.post(
        f"/api/v1/products/{prod_id}/variants",
        headers=admin_headers,
        json={"sku": f"VM-4C-{suffix}", "name": "4 Core 16GB", "price_adjustment": "0.0000"},
    )
    assert var_resp.status_code == 201
    var_id = var_resp.json()["id"]

    # Create Plan (Admin only)
    plan_resp = client.post(
        "/api/v1/plans/",
        headers=admin_headers,
        json={
            "name": f"Pro Plan {suffix}",
            "code": f"PRO-{suffix}",
            "billing_interval": "MONTHLY",
            "interval_count": 1,
            "base_price": 500.0,
            "payment_terms_days": 15,
        },
    )
    assert plan_resp.status_code == 201
    plan_id = plan_resp.json()["id"]

    # Create Tax Rule (Admin only)
    tax_resp = client.post(
        "/api/v1/taxes/",
        headers=admin_headers,
        json={
            "name": f"GST 18 {suffix}",
            "rate": 0.18,
            "country": "IN",
            "jurisdiction_state": f"State_{suffix}",
            "tax_scope": "STANDARD",
        },
    )
    assert tax_resp.status_code == 201
    tax_id = tax_resp.json()["id"]

    # Create & Confirm Quotation
    today = datetime.date.today()
    q_resp = client.post(
        "/api/v1/quotations/",
        headers=staff_headers,
        json={
            "customer_id": str(customer.id),
            "plan_id": plan_id,
            "start_date": today.isoformat(),
            "lines": [
                {
                    "line_type": "PLAN_FEE",
                    "description": "Monthly Plan Fee",
                    "unit_price": 500.0,
                    "quantity": 1,
                    "tax_rule_ids": [tax_id],
                },
                {
                    "line_type": "PRODUCT",
                    "product_id": prod_id,
                    "variant_id": var_id,
                    "description": "Cloud VM 4 Core",
                    "unit_price": 1000.0,
                    "quantity": 2,
                    "tax_rule_ids": [tax_id],
                },
            ],
        },
    )
    assert q_resp.status_code == 201
    quote_id = q_resp.json()["id"]

    client.post(f"/api/v1/quotations/{quote_id}/status", headers=staff_headers, json={"status": "SENT"})
    client.post(f"/api/v1/quotations/{quote_id}/status", headers=staff_headers, json={"status": "CONFIRMED"})

    # Convert to Subscription
    sub_resp = client.post(
        f"/api/v1/subscriptions/from-quotation/{quote_id}",
        headers=staff_headers,
        json={"start_date": today.isoformat()},
    )
    assert sub_resp.status_code == 201
    sub_id = sub_resp.json()["id"]

    # Generate Invoice from Subscription
    inv_resp = client.post(
        f"/api/v1/invoices/from-subscription/{sub_id}",
        headers=staff_headers,
    )
    assert inv_resp.status_code == 200
    inv_data = inv_resp.json()
    assert inv_data["status"] == "CONFIRMED"
    assert inv_data["subscription_id"] == sub_id
    assert inv_data["customer_id"] == str(customer.id)
    assert len(inv_data["lines"]) == 2

    # Check financial calculation consistency
    subtotal = Decimal(str(inv_data["subtotal_amount"]))
    discount = Decimal(str(inv_data["discount_amount"]))
    tax = Decimal(str(inv_data["tax_amount"]))
    rounding = Decimal(str(inv_data["rounding_adjustment"]))
    total = Decimal(str(inv_data["total_amount"]))
    balance = Decimal(str(inv_data["balance_due"]))

    assert total == subtotal - discount + tax + rounding
    assert balance == total
    assert Decimal("-0.02") <= rounding <= Decimal("0.02")


def test_billing_idempotency_and_duplicate_prevention(client: TestClient, db_session: Session):
    """Test that repeated invoice generation for the same period returns the same invoice without duplicates."""
    admin_user, admin_token = create_user_with_token(db_session, "ADMIN")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    staff_user, staff_token = create_user_with_token(db_session, "STAFF")
    staff_headers = {"Authorization": f"Bearer {staff_token}"}
    suffix = uuid.uuid4().hex[:6]

    customer = create_test_customer(db_session, suffix)

    plan_resp = client.post(
        "/api/v1/plans/",
        headers=admin_headers,
        json={
            "name": f"Weekly Plan {suffix}",
            "code": f"WK-{suffix}",
            "billing_interval": "WEEKLY",
            "interval_count": 1,
            "base_price": 250.0,
        },
    )
    plan_id = plan_resp.json()["id"]

    today = datetime.date.today()
    q_resp = client.post(
        "/api/v1/quotations/",
        headers=staff_headers,
        json={
            "customer_id": str(customer.id),
            "plan_id": plan_id,
            "start_date": today.isoformat(),
            "lines": [
                {
                    "line_type": "PLAN_FEE",
                    "description": "Weekly Base Plan",
                    "unit_price": 250.0,
                    "quantity": 1,
                }
            ],
        },
    )
    quote_id = q_resp.json()["id"]
    client.post(f"/api/v1/quotations/{quote_id}/status", headers=staff_headers, json={"status": "SENT"})
    client.post(f"/api/v1/quotations/{quote_id}/status", headers=staff_headers, json={"status": "CONFIRMED"})

    sub_resp = client.post(
        f"/api/v1/subscriptions/from-quotation/{quote_id}",
        headers=staff_headers,
        json={"start_date": today.isoformat()},
    )
    sub_id = sub_resp.json()["id"]

    # First generation
    inv1_resp = client.post(f"/api/v1/invoices/from-subscription/{sub_id}", headers=staff_headers)
    assert inv1_resp.status_code == 200
    inv1_id = inv1_resp.json()["id"]

    # Second generation for same date/period
    inv2_resp = client.post(f"/api/v1/invoices/from-subscription/{sub_id}", headers=staff_headers)
    assert inv2_resp.status_code == 200
    inv2_id = inv2_resp.json()["id"]

    # Must be the exact same invoice, not a duplicate!
    assert inv1_id == inv2_id

    # Verify directly in PostgreSQL count
    invoice_count = db_session.query(Invoice).filter(Invoice.subscription_id == sub_id).count()
    assert invoice_count == 1


def test_invoice_tenant_isolation(client: TestClient, db_session: Session):
    """Verify customer role cannot access another customer's invoice."""
    admin_user, admin_token = create_user_with_token(db_session, "ADMIN")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    staff_user, staff_token = create_user_with_token(db_session, "STAFF")
    staff_headers = {"Authorization": f"Bearer {staff_token}"}
    suffix_a = uuid.uuid4().hex[:6]
    suffix_b = uuid.uuid4().hex[:6]

    cust_a = create_test_customer(db_session, suffix_a)
    cust_b = create_test_customer(db_session, suffix_b)

    user_a, token_a = create_user_with_token(db_session, "CUSTOMER")
    membership_a = CustomerUser(
        customer_id=cust_a.id,
        user_id=user_a.id,
        membership_role="OWNER",
        status="ACTIVE",
    )
    db_session.add(membership_a)
    db_session.commit()

    plan_resp = client.post(
        "/api/v1/plans/",
        headers=admin_headers,
        json={
            "name": f"Isolation Plan {suffix_a}",
            "code": f"ISO-{suffix_a}",
            "billing_interval": "MONTHLY",
            "interval_count": 1,
            "base_price": 100.0,
        },
    )
    plan_id = plan_resp.json()["id"]

    today = datetime.date.today()
    # Create quote & sub for Customer B
    q_b = client.post(
        "/api/v1/quotations/",
        headers=staff_headers,
        json={
            "customer_id": str(cust_b.id),
            "plan_id": plan_id,
            "start_date": today.isoformat(),
            "lines": [
                {
                    "line_type": "PLAN_FEE",
                    "description": "Plan Fee Cust B",
                    "unit_price": 100.0,
                    "quantity": 1,
                }
            ],
        },
    ).json()["id"]
    client.post(f"/api/v1/quotations/{q_b}/status", headers=staff_headers, json={"status": "SENT"})
    client.post(f"/api/v1/quotations/{q_b}/status", headers=staff_headers, json={"status": "CONFIRMED"})

    sub_b = client.post(
        f"/api/v1/subscriptions/from-quotation/{q_b}",
        headers=staff_headers,
        json={"start_date": today.isoformat()},
    ).json()["id"]

    inv_b = client.post(f"/api/v1/invoices/from-subscription/{sub_b}", headers=staff_headers).json()["id"]

    # Customer A tries to retrieve Customer B's invoice -> 404 NOT FOUND
    resp = client.get(f"/api/v1/invoices/{inv_b}", headers={"Authorization": f"Bearer {token_a}"})
    assert resp.status_code == 404
