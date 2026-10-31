import datetime
from decimal import Decimal
import smtplib
from unittest.mock import MagicMock, patch
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session

from app.core.config import Settings, settings
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
        conn.execute(text("DELETE FROM plan_taxes WHERE plan_id IN (SELECT id FROM plans WHERE name LIKE 'Brevo Plan%' OR name LIKE 'PDF Test Plan%' OR name LIKE 'Email Test Plan%')"))
        conn.execute(text("DELETE FROM plans WHERE name LIKE 'Brevo Plan%' OR name LIKE 'PDF Test Plan%' OR name LIKE 'Email Test Plan%'"))


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


def test_pydantic_settings_smtp_declarations_and_defaults():
    """Verify SMTP settings are explicitly declared in Pydantic Settings class with defaults."""
    cfg = Settings()
    assert hasattr(cfg, "SMTP_HOST")
    assert hasattr(cfg, "SMTP_PORT")
    assert hasattr(cfg, "SMTP_USER")
    assert hasattr(cfg, "SMTP_PASSWORD")
    assert hasattr(cfg, "SMTP_TLS")
    assert hasattr(cfg, "EMAILS_FROM_NAME")
    assert hasattr(cfg, "EMAILS_FROM_EMAIL")

    # Verify custom values can be parsed properly
    custom_cfg = Settings(
        SMTP_HOST="smtp-relay.brevo.com",
        SMTP_PORT=587,
        SMTP_USER="test-user@brightloop.com",
        SMTP_PASSWORD="test-password-123",
        SMTP_TLS=True,
        EMAILS_FROM_NAME="Test Sender",
        EMAILS_FROM_EMAIL="sender@verifieddomain.com",
    )
    assert custom_cfg.SMTP_HOST == "smtp-relay.brevo.com"
    assert custom_cfg.SMTP_PORT == 587
    assert custom_cfg.SMTP_USER == "test-user@brightloop.com"
    assert custom_cfg.SMTP_PASSWORD == "test-password-123"
    assert custom_cfg.SMTP_TLS is True
    assert custom_cfg.EMAILS_FROM_NAME == "Test Sender"
    assert custom_cfg.EMAILS_FROM_EMAIL == "sender@verifieddomain.com"


def _setup_invoice_for_email_tests(client: TestClient, db_session: Session):
    admin_user, admin_token = create_user_with_token(db_session, "ADMIN")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    staff_user, staff_token = create_user_with_token(db_session, "STAFF")
    staff_headers = {"Authorization": f"Bearer {staff_token}"}
    suffix = uuid.uuid4().hex[:6]

    customer = create_test_customer(db_session, suffix)

    existing_plan = db_session.query(Plan).filter(Plan.is_active == True).first()
    if existing_plan:
        plan_id = str(existing_plan.id)
    else:
        plan_resp = client.post(
            "/api/v1/plans/",
            headers=admin_headers,
            json={
                "name": f"Brevo Plan {suffix}",
                "code": f"BREVO-{suffix}",
                "billing_interval": "MONTHLY",
                "interval_count": 1,
                "base_price": 350.0,
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
                    "description": "Base Fee",
                    "unit_price": 350.0,
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
    inv = db_session.query(Invoice).filter(Invoice.id == inv_id).first()
    return inv, staff_headers, admin_headers, customer, staff_user


def test_send_invoice_email_successful_brevo_flow_mocked(client: TestClient, db_session: Session, monkeypatch):
    """Test full Brevo SMTP delivery flow with mock: starttls, credentials login, MIME attachment, and audit."""
    inv, staff_headers, admin_headers, customer, staff_user = _setup_invoice_for_email_tests(client, db_session)

    monkeypatch.setattr(settings, "SMTP_HOST", "smtp-relay.brevo.com")
    monkeypatch.setattr(settings, "SMTP_PORT", 587)
    monkeypatch.setattr(settings, "SMTP_USER", "brevo-login@example.com")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "mock-brevo-api-key")
    monkeypatch.setattr(settings, "SMTP_TLS", True)
    monkeypatch.setattr(settings, "EMAILS_FROM_NAME", "Brightloop Invoicing")
    monkeypatch.setattr(settings, "EMAILS_FROM_EMAIL", "invoices@company.com")

    with patch("smtplib.SMTP") as mock_smtp_cls:
        mock_server = MagicMock()
        mock_smtp_cls.return_value.__enter__.return_value = mock_server

        result = send_invoice_email(
            db=db_session,
            invoice=inv,
            actor_user=staff_user,
            ip_address="127.0.0.1",
        )

        assert result["sent"] is True
        assert "sent successfully" in result["message"]
        assert result["recipient"] == customer.contact_email

        # Verify SMTP server call params
        mock_smtp_cls.assert_called_once_with("smtp-relay.brevo.com", 587, timeout=15)
        # Verify STARTTLS was executed
        mock_server.starttls.assert_called_once()
        # Verify login was executed with credentials
        mock_server.login.assert_called_once_with("brevo-login@example.com", "mock-brevo-api-key")
        # Verify email was dispatched
        mock_server.send_message.assert_called_once()

        # Verify MIME message contents
        sent_msg = mock_server.send_message.call_args[0][0]
        assert sent_msg["From"] == "Brightloop Invoicing <invoices@company.com>"
        assert sent_msg["To"] == customer.contact_email
        assert f"Tax Invoice {inv.invoice_number}" in sent_msg["Subject"]

        # Verify PDF attachment
        payload = sent_msg.get_payload()
        assert len(payload) == 2  # Text body and PDF attachment
        pdf_part = payload[1]
        assert pdf_part.get_content_type() == "application/pdf"
        assert f"Invoice-{inv.invoice_number}.pdf" in pdf_part["Content-Disposition"]

        # Verify audit log was recorded
        audit = (
            db_session.query(AuditLog)
            .filter(AuditLog.entity_id == inv.id, AuditLog.action == "INVOICE_EMAIL_SENT")
            .first()
        )
        assert audit is not None
        assert audit.details["recipient"] == customer.contact_email


def test_send_invoice_email_sender_validation_blocks_default_local_domain(client: TestClient, db_session: Session, monkeypatch):
    """Test that real SMTP delivery rejects default billing@brightloop.local and empty sender."""
    inv, staff_headers, admin_headers, customer, staff_user = _setup_invoice_for_email_tests(client, db_session)

    monkeypatch.setattr(settings, "SMTP_HOST", "smtp-relay.brevo.com")
    monkeypatch.setattr(settings, "EMAILS_FROM_EMAIL", "billing@brightloop.local")

    with patch("smtplib.SMTP") as mock_smtp_cls:
        result = send_invoice_email(
            db=db_session,
            invoice=inv,
            actor_user=staff_user,
        )

        assert result["sent"] is False
        assert result["error"] == "INVALID_SENDER_EMAIL"
        mock_smtp_cls.assert_not_called()

        audit = (
            db_session.query(AuditLog)
            .filter(AuditLog.entity_id == inv.id, AuditLog.action == "INVOICE_EMAIL_FAILED")
            .first()
        )
        assert audit is not None
        assert "EMAILS_FROM_EMAIL" in audit.details["reason"]


def test_send_invoice_email_smtp_auth_failure_handling(client: TestClient, db_session: Session, monkeypatch):
    """Test handling of SMTPAuthenticationError without leaking secrets."""
    inv, staff_headers, admin_headers, customer, staff_user = _setup_invoice_for_email_tests(client, db_session)

    monkeypatch.setattr(settings, "SMTP_HOST", "smtp-relay.brevo.com")
    monkeypatch.setattr(settings, "SMTP_PORT", 587)
    monkeypatch.setattr(settings, "SMTP_USER", "brevo-login@example.com")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "super-secret-key-999")
    monkeypatch.setattr(settings, "SMTP_TLS", True)
    monkeypatch.setattr(settings, "EMAILS_FROM_EMAIL", "valid@domain.com")

    with patch("smtplib.SMTP") as mock_smtp_cls:
        mock_server = MagicMock()
        mock_smtp_cls.return_value.__enter__.return_value = mock_server
        mock_server.login.side_effect = smtplib.SMTPAuthenticationError(535, b"Invalid Brevo SMTP key")

        result = send_invoice_email(
            db=db_session,
            invoice=inv,
            actor_user=staff_user,
        )

        assert result["sent"] is False
        assert result["error"] == "SMTP_AUTHENTICATION_ERROR"
        # Verify secret is not in result message
        assert "super-secret-key-999" not in result["message"]

        # Verify audit log recorded failure without secret
        audit = (
            db_session.query(AuditLog)
            .filter(AuditLog.entity_id == inv.id, AuditLog.action == "INVOICE_EMAIL_FAILED")
            .order_by(AuditLog.created_at.desc())
            .first()
        )
        assert audit is not None
        assert "super-secret-key-999" not in str(audit.details)


def test_send_invoice_email_api_endpoint_with_mocked_smtp(client: TestClient, db_session: Session, monkeypatch):
    """Test /api/v1/invoices/{id}/send-email endpoint with configured SMTP credentials and mock."""
    inv, staff_headers, admin_headers, customer, staff_user = _setup_invoice_for_email_tests(client, db_session)

    monkeypatch.setattr(settings, "SMTP_HOST", "smtp-relay.brevo.com")
    monkeypatch.setattr(settings, "SMTP_PORT", 587)
    monkeypatch.setattr(settings, "SMTP_USER", "brevo-login@example.com")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "mock-key")
    monkeypatch.setattr(settings, "SMTP_TLS", True)
    monkeypatch.setattr(settings, "EMAILS_FROM_EMAIL", "billing@mycompany.com")

    with patch("smtplib.SMTP") as mock_smtp_cls:
        mock_server = MagicMock()
        mock_smtp_cls.return_value.__enter__.return_value = mock_server

        resp = client.post(f"/api/v1/invoices/{inv.id}/send-email", headers=staff_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["sent"] is True
        assert "sent successfully" in data["message"]
