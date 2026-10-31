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
from app.models.billing import Invoice
from app.models.catalog import Plan
from app.models.customer import Customer, CustomerUser
from app.models.governance import AuditLog
from app.models.subscription import Subscription, SubscriptionLine
from app.services.email_service import send_invoice_email
from app.services.pdf_service import generate_invoice_pdf

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
def cleanup_artifacts():
    yield
    with test_engine.begin() as conn:
        conn.execute(text("DELETE FROM audit_logs WHERE 1=1"))
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


def test_invoice_pdf_generation_and_stream(client: TestClient, db_session: Session):
    """Test generating a valid PDF and downloading it via authenticated endpoint."""
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
            "name": f"PDF Test Plan {suffix}",
            "code": f"PDF-{suffix}",
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
                    "description": "Base Plan ₹500",
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

    # 1. Direct PDF generator test
    inv = db_session.query(Invoice).filter(Invoice.id == inv_id).first()
    pdf_bytes = generate_invoice_pdf(inv)
    assert pdf_bytes.startswith(b"%PDF-1.4")
    assert b"%%EOF" in pdf_bytes
    assert b"TAX INVOICE" in pdf_bytes

    # 2. HTTP Endpoint test
    pdf_resp = client.get(f"/api/v1/invoices/{inv_id}/pdf", headers=staff_headers)
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers["content-type"] == "application/pdf"
    assert "inline; filename=" in pdf_resp.headers["content-disposition"]
    assert pdf_resp.content.startswith(b"%PDF-1.4")


def test_invoice_email_dispatch_and_audit(client: TestClient, db_session: Session):
    """Test invoice email endpoint gracefully handles environment configuration and logs audit."""
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
            "name": f"Email Test Plan {suffix}",
            "code": f"EMAIL-{suffix}",
            "billing_interval": "MONTHLY",
            "interval_count": 1,
            "base_price": 200.0,
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
                    "description": "Base ₹200",
                    "unit_price": 200.0,
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

    # Dispatch email
    email_resp = client.post(f"/api/v1/invoices/{inv_id}/send-email", headers=staff_headers)
    assert email_resp.status_code == 200
    email_data = email_resp.json()
    assert "sent" in email_data
    assert "message" in email_data

    # Verify audit log was recorded
    audit_resp = client.get("/api/v1/audit/", headers=admin_headers)
    assert audit_resp.status_code == 200
    actions = [a["action"] for a in audit_resp.json()["items"]]
    assert any("INVOICE_EMAIL" in action for action in actions)
