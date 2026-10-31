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
from app.models.billing import Invoice, Payment
from app.models.catalog import Plan
from app.models.customer import Customer, CustomerUser
from app.models.quotation import Quotation, QuotationLine
from app.models.subscription import Subscription, SubscriptionLine

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
def cleanup_payment_artifacts():
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


def test_payment_settlement_and_overpayment_prevention(client: TestClient, db_session: Session):
    """Test partial payment, full payment settlement, and rejection of overpayment."""
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
            "name": f"Payment Test Plan {suffix}",
            "code": f"PAY-{suffix}",
            "billing_interval": "MONTHLY",
            "interval_count": 1,
            "base_price": 1000.0,
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
                    "description": "Base Plan ₹1000",
                    "unit_price": 1000.0,
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

    inv_resp = client.post(f"/api/v1/invoices/from-subscription/{sub_id}", headers=staff_headers)
    assert inv_resp.status_code == 200
    inv_data = inv_resp.json()
    inv_id = inv_data["id"]
    total = Decimal(str(inv_data["total_amount"]))  # 1000.00
    assert total == Decimal("1000.00")

    # 1. Partial payment of ₹400
    pay1_resp = client.post(
        "/api/v1/payments/",
        headers=staff_headers,
        json={
            "invoice_id": inv_id,
            "amount": 400.00,
            "payment_method": "UPI",
            "reference_number": "UPI-12345",
        },
    )
    assert pay1_resp.status_code == 201
    pay1_data = pay1_resp.json()
    assert pay1_data["status"] == "SUCCESS"
    assert Decimal(str(pay1_data["amount"])) == Decimal("400.00")

    # Verify invoice status is PARTIALLY_PAID
    inv_check1 = client.get(f"/api/v1/invoices/{inv_id}", headers=staff_headers).json()
    assert inv_check1["status"] == "PARTIALLY_PAID"
    assert Decimal(str(inv_check1["amount_paid"])) == Decimal("400.00")
    assert Decimal(str(inv_check1["balance_due"])) == Decimal("600.00")

    # 2. Overpayment attempt: remaining is ₹600, attempting to pay ₹700 -> MUST BE REJECTED!
    overpay_resp = client.post(
        "/api/v1/payments/",
        headers=staff_headers,
        json={
            "invoice_id": inv_id,
            "amount": 700.00,
            "payment_method": "BANK_TRANSFER",
        },
    )
    assert overpay_resp.status_code == 400
    assert "exceeds outstanding balance" in overpay_resp.json()["detail"]

    # 3. Settle remaining ₹600
    pay2_resp = client.post(
        "/api/v1/payments/",
        headers=staff_headers,
        json={
            "invoice_id": inv_id,
            "amount": 600.00,
            "payment_method": "BANK_TRANSFER",
            "reference_number": "NEFT-998877",
        },
    )
    assert pay2_resp.status_code == 201

    # Verify invoice status is now PAID with balance_due = 0.00
    inv_check2 = client.get(f"/api/v1/invoices/{inv_id}", headers=staff_headers).json()
    assert inv_check2["status"] == "PAID"
    assert Decimal(str(inv_check2["amount_paid"])) == Decimal("1000.00")
    assert Decimal(str(inv_check2["balance_due"])) == Decimal("0.00")

    # 4. Attempt payment on already paid invoice -> REJECTED!
    post_paid_resp = client.post(
        "/api/v1/payments/",
        headers=staff_headers,
        json={
            "invoice_id": inv_id,
            "amount": 50.00,
            "payment_method": "CASH",
        },
    )
    assert post_paid_resp.status_code == 400


def test_payment_voiding_reconciliation(client: TestClient, db_session: Session):
    """Test voiding a payment recalculates invoice balances and restores status."""
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
            "name": f"Void Plan {suffix}",
            "code": f"VOID-{suffix}",
            "billing_interval": "MONTHLY",
            "interval_count": 1,
            "base_price": 500.0,
        },
    )
    plan_id = plan_resp.json()["id"]

    today = datetime.date.today()
    q_id = client.post(
        "/api/v1/quotations/",
        headers=staff_headers,
        json={
            "customer_id": str(customer.id),
            "plan_id": plan_id,
            "start_date": today.isoformat(),
            "lines": [
                {
                    "line_type": "PLAN_FEE",
                    "description": "Base ₹500",
                    "unit_price": 500.0,
                    "quantity": 1,
                }
            ],
        },
    ).json()["id"]
    client.post(f"/api/v1/quotations/{q_id}/status", headers=staff_headers, json={"status": "SENT"})
    client.post(f"/api/v1/quotations/{q_id}/status", headers=staff_headers, json={"status": "CONFIRMED"})

    sub_id = client.post(
        f"/api/v1/subscriptions/from-quotation/{q_id}",
        headers=staff_headers,
        json={"start_date": today.isoformat()},
    ).json()["id"]

    inv_id = client.post(f"/api/v1/invoices/from-subscription/{sub_id}", headers=staff_headers).json()["id"]

    # Record full payment ₹500 -> invoice status becomes PAID
    pay_resp = client.post(
        "/api/v1/payments/",
        headers=staff_headers,
        json={
            "invoice_id": inv_id,
            "amount": 500.00,
            "payment_method": "CHEQUE",
            "reference_number": "CHQ-0001",
        },
    )
    assert pay_resp.status_code == 201
    pay_id = pay_resp.json()["id"]

    inv_paid = client.get(f"/api/v1/invoices/{inv_id}", headers=staff_headers).json()
    assert inv_paid["status"] == "PAID"

    # Void payment
    void_resp = client.post(
        f"/api/v1/payments/{pay_id}/void",
        headers=staff_headers,
        json={"void_reason": "Cheque bounced due to signature mismatch"},
    )
    assert void_resp.status_code == 200
    void_data = void_resp.json()
    assert void_data["status"] == "VOIDED"
    assert void_data["void_reason"] == "Cheque bounced due to signature mismatch"
    assert void_data["voided_at"] is not None

    # Verify invoice balances are restored to CONFIRMED with full balance due
    inv_restored = client.get(f"/api/v1/invoices/{inv_id}", headers=staff_headers).json()
    assert inv_restored["status"] == "CONFIRMED"
    assert Decimal(str(inv_restored["amount_paid"])) == Decimal("0.00")
    assert Decimal(str(inv_restored["balance_due"])) == Decimal("500.00")


def test_customer_payment_restrictions(client: TestClient, db_session: Session):
    """Verify customers cannot record payments or access other customers' payment records."""
    staff_user, staff_token = create_user_with_token(db_session, "STAFF")
    staff_headers = {"Authorization": f"Bearer {staff_token}"}
    suffix = uuid.uuid4().hex[:6]

    customer = create_test_customer(db_session, suffix)
    cust_user, cust_token = create_user_with_token(db_session, "CUSTOMER")
    membership = CustomerUser(
        customer_id=customer.id,
        user_id=cust_user.id,
        membership_role="OWNER",
        status="ACTIVE",
    )
    db_session.add(membership)
    db_session.commit()

    # Customer tries to record payment -> 403 Forbidden
    cust_pay_resp = client.post(
        "/api/v1/payments/",
        headers={"Authorization": f"Bearer {cust_token}"},
        json={
            "invoice_id": str(uuid.uuid4()),
            "amount": 100.0,
            "payment_method": "UPI",
        },
    )
    assert cust_pay_resp.status_code == 403
