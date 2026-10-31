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
from app.models.customer import Customer, CustomerUser

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
def cleanup_sec_artifacts():
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
        email=f"sec_user_{suffix}@example.com",
        full_name=f"Sec User {suffix}",
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
        contact_email=f"contact_{name_suffix.lower()}@example.com",
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


def test_customer_tenant_isolation(client: TestClient, db_session: Session):
    """Ensure Customer A cannot access Customer B's invoice or PDF."""
    admin_user, admin_token = create_user_with_token(db_session, "ADMIN")
    staff_user, staff_token = create_user_with_token(db_session, "STAFF")
    user_a, token_a = create_user_with_token(db_session, "CUSTOMER")
    user_b, token_b = create_user_with_token(db_session, "CUSTOMER")

    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    staff_headers = {"Authorization": f"Bearer {staff_token}"}
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Create two customer orgs
    cust_a = create_test_customer(db_session, f"Alpha_{uuid.uuid4().hex[:4]}")
    cust_b = create_test_customer(db_session, f"Beta_{uuid.uuid4().hex[:4]}")

    db_session.add_all([
        CustomerUser(customer_id=cust_a.id, user_id=user_a.id, membership_role="OWNER", status="ACTIVE"),
        CustomerUser(customer_id=cust_b.id, user_id=user_b.id, membership_role="OWNER", status="ACTIVE"),
    ])
    db_session.commit()

    # Plan
    plan_resp = client.post(
        "/api/v1/plans/",
        headers=admin_headers,
        json={
            "name": f"Isolation Plan {uuid.uuid4().hex[:4]}",
            "code": f"ISO-{uuid.uuid4().hex[:4]}",
            "billing_interval": "MONTHLY",
            "interval_count": 1,
            "base_price": 750.0,
        },
    )
    plan_id = plan_resp.json()["id"]

    # Create subscription and invoice for Customer A
    today = datetime.date.today()
    q_resp = client.post(
        "/api/v1/quotations/",
        headers=staff_headers,
        json={
            "customer_id": str(cust_a.id),
            "plan_id": plan_id,
            "start_date": today.isoformat(),
            "lines": [{"line_type": "PLAN_FEE", "description": "Plan", "unit_price": 750.0, "quantity": 1}],
        },
    )
    q_id = q_resp.json()["id"]
    client.post(f"/api/v1/quotations/{q_id}/status", headers=staff_headers, json={"status": "SENT"})
    client.post(f"/api/v1/quotations/{q_id}/status", headers=staff_headers, json={"status": "CONFIRMED"})

    sub_resp = client.post(f"/api/v1/subscriptions/from-quotation/{q_id}", headers=staff_headers, json={"start_date": today.isoformat()})
    sub_id = sub_resp.json()["id"]

    inv_resp = client.post(f"/api/v1/invoices/from-subscription/{sub_id}", headers=staff_headers)
    inv_id = inv_resp.json()["id"]

    # Customer B attempts to view Customer A's invoice detail -> Must be 403 Forbidden or 404 Not Found (tenant scoped)
    res_b = client.get(f"/api/v1/invoices/{inv_id}", headers=headers_b)
    assert res_b.status_code in [403, 404], f"Cross-tenant access leaked! status: {res_b.status_code}"

    # Customer B attempts to download Customer A's invoice PDF -> Must be 403 Forbidden or 404 Not Found
    pdf_b = client.get(f"/api/v1/invoices/{inv_id}/pdf", headers=headers_b)
    assert pdf_b.status_code in [403, 404], f"Cross-tenant PDF download allowed! status: {pdf_b.status_code}"

    # Customer A can access their own invoice and PDF
    res_a = client.get(f"/api/v1/invoices/{inv_id}", headers=headers_a)
    assert res_a.status_code == 200

    pdf_a = client.get(f"/api/v1/invoices/{inv_id}/pdf", headers=headers_a)
    assert pdf_a.status_code == 200
    assert pdf_a.headers["content-type"] == "application/pdf"


def test_rbac_and_overpayment_protections(client: TestClient, db_session: Session):
    """Ensure Customer cannot record payments or cancel invoices, and overpayment is rejected."""
    admin_user, admin_token = create_user_with_token(db_session, "ADMIN")
    staff_user, staff_token = create_user_with_token(db_session, "STAFF")
    cust_user, cust_token = create_user_with_token(db_session, "CUSTOMER")

    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    staff_headers = {"Authorization": f"Bearer {staff_token}"}
    cust_headers = {"Authorization": f"Bearer {cust_token}"}

    # 1. Customer attempts to record payment -> 403
    p_res = client.post(
        "/api/v1/payments/",
        json={"invoice_id": str(uuid.uuid4()), "amount": 50.00, "payment_method": "CASH"},
        headers=cust_headers,
    )
    assert p_res.status_code == 403

    # 2. Customer attempts to trigger billing run -> 403
    b_res = client.post("/api/v1/invoices/run-billing", json={}, headers=cust_headers)
    assert b_res.status_code == 403

    # 3. Staff attempts to view system audit logs -> 403 (Admin only)
    audit_res = client.get("/api/v1/audit/", headers=staff_headers)
    assert audit_res.status_code == 403

    # 4. Strict Overpayment Rejection
    cust = create_test_customer(db_session, f"Solv_{uuid.uuid4().hex[:4]}")

    plan_resp = client.post(
        "/api/v1/plans/",
        headers=admin_headers,
        json={
            "name": f"Pay Plan {uuid.uuid4().hex[:4]}",
            "code": f"P-{uuid.uuid4().hex[:4]}",
            "billing_interval": "MONTHLY",
            "interval_count": 1,
            "base_price": 100.0,
        },
    )
    plan_id = plan_resp.json()["id"]

    today = datetime.date.today()
    q_resp = client.post(
        "/api/v1/quotations/",
        headers=staff_headers,
        json={
            "customer_id": str(cust.id),
            "plan_id": plan_id,
            "start_date": today.isoformat(),
            "lines": [{"line_type": "PLAN_FEE", "description": "Plan", "unit_price": 100.0, "quantity": 1}],
        },
    )
    q_id = q_resp.json()["id"]
    client.post(f"/api/v1/quotations/{q_id}/status", headers=staff_headers, json={"status": "SENT"})
    client.post(f"/api/v1/quotations/{q_id}/status", headers=staff_headers, json={"status": "CONFIRMED"})

    sub_resp = client.post(f"/api/v1/subscriptions/from-quotation/{q_id}", headers=staff_headers, json={"start_date": today.isoformat()})
    sub_id = sub_resp.json()["id"]

    inv_resp = client.post(f"/api/v1/invoices/from-subscription/{sub_id}", headers=staff_headers)
    inv_id = inv_resp.json()["id"]

    # Attempt to pay $100.01 (1 cent overpayment) -> Must be rejected with 400
    res = client.post(
        "/api/v1/payments/",
        json={
            "invoice_id": inv_id,
            "amount": 100.01,
            "payment_method": "CARD",
        },
        headers=staff_headers,
    )
    assert res.status_code == 400
    assert "exceeds" in res.text.lower() or "overpayment" in res.text.lower()
