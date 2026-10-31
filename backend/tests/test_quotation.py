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
from app.models.catalog import Plan, Product, TaxRule
from app.models.customer import Customer, CustomerUser
from app.models.quotation import Quotation, QuotationTemplate

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
def cleanup_quotation_artifacts():
    yield
    with test_engine.connect() as conn:
        assert conn.execute(text("SELECT current_database();")).scalar() == "brightloop_test"
        conn.execute(text("""
            DELETE FROM subscription_line_taxes;
            DELETE FROM subscription_lines;
            DELETE FROM subscription_pause_history;
            DELETE FROM subscriptions;
            DELETE FROM quotation_line_taxes;
            DELETE FROM quotation_lines;
            DELETE FROM quotations;
            DELETE FROM quotation_template_lines;
            DELETE FROM quotation_templates;
        """))
        conn.commit()


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
    user = User(
        email=f"{role.lower()}_{uuid.uuid4().hex[:8]}@example.com",
        hashed_password=hash_password("SecurePassword123!"),
        full_name=f"User {role}",
        role=role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    token = create_access_token(subject=str(user.id))
    return user, token


def create_test_customer(db: Session, name_prefix: str = "Client") -> Customer:
    cust = Customer(
        company_name=f"{name_prefix} {uuid.uuid4().hex[:6]}",
        contact_email=f"info_{uuid.uuid4().hex[:6]}@example.com",
        billing_address_line1="123 Corporate Way",
        city="Bengaluru",
        state="Karnataka",
        postal_code="560001",
        country="IN",
        currency="INR",
        is_active=True,
    )
    db.add(cust)
    db.commit()
    return cust


def test_quotation_template_crud(client: TestClient, db_session: Session):
    admin_user, admin_token = create_user_with_token(db_session, "ADMIN")
    staff_user, staff_token = create_user_with_token(db_session, "STAFF")

    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    # Setup plan & product
    plan_resp = client.post(
        "/api/v1/plans/",
        json={"name": f"Plan Tpl {uuid.uuid4().hex[:6]}", "billing_interval": "MONTHLY", "base_price": "1000.0000"},
        headers=admin_headers,
    )
    plan_id = plan_resp.json()["id"]

    prod_resp = client.post(
        "/api/v1/products/",
        json={"name": f"Prod Tpl {uuid.uuid4().hex[:6]}", "product_type": "SERVICE", "base_sales_price": "200.0000"},
        headers=admin_headers,
    )
    prod_id = prod_resp.json()["id"]

    # 1. Staff cannot create templates (Admin only)
    tpl_payload = {
        "name": f"SaaS Pro Template {uuid.uuid4().hex[:6]}",
        "description": "Standard SaaS onboarding template",
        "plan_id": plan_id,
        "validity_duration_days": 45,
        "lines": [{"product_id": prod_id, "quantity": 2, "unit_price_override": "180.0000"}],
    }
    resp = client.post("/api/v1/quotations/templates", json=tpl_payload, headers=staff_headers)
    assert resp.status_code == 403

    # 2. Admin creates template
    resp = client.post("/api/v1/quotations/templates", json=tpl_payload, headers=admin_headers)
    assert resp.status_code == 201
    tpl_data = resp.json()
    assert tpl_data["validity_duration_days"] == 45
    assert len(tpl_data["lines"]) == 1

    # 3. Staff can view templates
    resp = client.get("/api/v1/quotations/templates", headers=staff_headers)
    assert resp.status_code == 200
    assert any(t["id"] == tpl_data["id"] for t in resp.json()["items"])


def test_quotation_creation_and_financial_reconciliation(client: TestClient, db_session: Session):
    admin_user, admin_token = create_user_with_token(db_session, "ADMIN")
    staff_user, staff_token = create_user_with_token(db_session, "STAFF")

    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    customer = create_test_customer(db_session, "AcmeCorp")

    # Plan with 18% tax
    tax_suffix = uuid.uuid4().hex[:6]
    tax_resp = client.post(
        "/api/v1/taxes/",
        json={
            "name": f"GST 18% {tax_suffix}",
            "rate": "18.0000",
            "jurisdiction_country": "IN",
            "jurisdiction_state": f"State_{tax_suffix}",
            "tax_scope": "STANDARD",
        },
        headers=admin_headers,
    )
    assert tax_resp.status_code == 201
    tax_id = tax_resp.json()["id"]

    plan_resp = client.post(
        "/api/v1/plans/",
        json={"name": f"Plan Quote {uuid.uuid4().hex[:6]}", "billing_interval": "MONTHLY", "base_price": "1000.0000"},
        headers=admin_headers,
    )
    plan_id = plan_resp.json()["id"]
    client.put(f"/api/v1/plans/{plan_id}/taxes", json={"tax_rule_ids": [tax_id]}, headers=admin_headers)

    # Product with 18% tax
    prod_resp = client.post(
        "/api/v1/products/",
        json={"name": f"Addon Seat {uuid.uuid4().hex[:6]}", "product_type": "SERVICE", "base_sales_price": "250.0000"},
        headers=admin_headers,
    )
    prod_id = prod_resp.json()["id"]
    client.put(f"/api/v1/products/{prod_id}/taxes", json={"tax_rule_ids": [tax_id]}, headers=admin_headers)

    # Staff creates quotation: 1 Plan fee (₹1000) + 2 Seats (₹500) = Subtotal ₹1500
    # Tax @ 18% = ₹270.00
    # Total = ₹1770.00
    quote_payload = {
        "customer_id": str(customer.id),
        "plan_id": plan_id,
        "validity_duration_days": 30,
        "notes": "Custom enterprise proposal",
        "lines": [
            {"line_type": "PRODUCT", "product_id": prod_id, "quantity": 2, "unit_price": "250.0000"}
        ],
    }
    resp = client.post("/api/v1/quotations/", json=quote_payload, headers=staff_headers)
    assert resp.status_code == 201
    quote = resp.json()
    assert quote["status"] == "DRAFT"
    assert Decimal(quote["subtotal_amount"]) == Decimal("1500.00")
    assert Decimal(quote["tax_amount"]) == Decimal("270.00")
    assert Decimal(quote["total_amount"]) == Decimal("1770.00")
    assert Decimal(quote["rounding_adjustment"]) == Decimal("0.00")
    # Verify mathematical constraint: total = subtotal - discount + tax + rounding
    subtotal = Decimal(quote["subtotal_amount"])
    discount = Decimal(quote["discount_amount"])
    tax = Decimal(quote["tax_amount"])
    rounding = Decimal(quote["rounding_adjustment"])
    total = Decimal(quote["total_amount"])
    assert total == subtotal - discount + tax + rounding


def test_quotation_lifecycle_and_expiry_protection(client: TestClient, db_session: Session):
    admin_user, admin_token = create_user_with_token(db_session, "ADMIN")
    staff_user, staff_token = create_user_with_token(db_session, "STAFF")

    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    customer = create_test_customer(db_session, "BetaOrg")
    plan_resp = client.post(
        "/api/v1/plans/",
        json={"name": f"Lifecycle Plan {uuid.uuid4().hex[:6]}", "billing_interval": "MONTHLY", "base_price": "500.0000"},
        headers=admin_headers,
    )
    plan_id = plan_resp.json()["id"]

    # 1. Create quote
    quote_resp = client.post(
        "/api/v1/quotations/",
        json={"customer_id": str(customer.id), "plan_id": plan_id, "validity_duration_days": 15},
        headers=staff_headers,
    )
    quote_id = quote_resp.json()["id"]

    # 2. Transition: DRAFT -> SENT
    resp = client.post(f"/api/v1/quotations/{quote_id}/status", json={"status": "SENT"}, headers=staff_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "SENT"

    # 3. Transition: SENT -> CONFIRMED
    resp = client.post(f"/api/v1/quotations/{quote_id}/status", json={"status": "CONFIRMED"}, headers=staff_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "CONFIRMED"

    # 4. Once CONFIRMED, editing lines is prohibited (400 Bad Request)
    resp = client.put(f"/api/v1/quotations/{quote_id}", json={"notes": "Attempting edit after confirmation"}, headers=staff_headers)
    assert resp.status_code == 400

    # 5. Cannot confirm an expired quote
    past_quote = Quotation(
        quotation_number=f"QT-EXPIRED-{uuid.uuid4().hex[:4]}",
        customer_id=customer.id,
        plan_id=uuid.UUID(plan_id),
        status="SENT",
        issue_date=datetime.date.today() - datetime.timedelta(days=40),
        expiry_date=datetime.date.today() - datetime.timedelta(days=10),
        plan_price_snapshot=Decimal("500.0000"),
        subtotal_amount=Decimal("500.00"),
        discount_amount=Decimal("0.00"),
        tax_amount=Decimal("0.00"),
        rounding_adjustment=Decimal("0.00"),
        total_amount=Decimal("500.00"),
        currency="INR",
        created_by_user_id=staff_user.id,
    )
    db_session.add(past_quote)
    db_session.commit()

    resp = client.post(f"/api/v1/quotations/{past_quote.id}/status", json={"status": "CONFIRMED"}, headers=staff_headers)
    assert resp.status_code == 400
    assert "expired" in resp.json()["detail"].lower()


def test_quotation_tenant_isolation(client: TestClient, db_session: Session):
    admin_user, admin_token = create_user_with_token(db_session, "ADMIN")
    staff_user, staff_token = create_user_with_token(db_session, "STAFF")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    # Customer A and User A
    cust_a = create_test_customer(db_session, "CompanyA")
    user_a, token_a = create_user_with_token(db_session, "CUSTOMER")
    db_session.add(CustomerUser(customer_id=cust_a.id, user_id=user_a.id, membership_role="OWNER", is_primary=True, status="ACTIVE"))

    # Customer B and User B
    cust_b = create_test_customer(db_session, "CompanyB")
    user_b, token_b = create_user_with_token(db_session, "CUSTOMER")
    db_session.add(CustomerUser(customer_id=cust_b.id, user_id=user_b.id, membership_role="OWNER", is_primary=True, status="ACTIVE"))
    db_session.commit()

    plan_resp = client.post(
        "/api/v1/plans/",
        json={"name": f"Isolated Plan {uuid.uuid4().hex[:6]}", "billing_interval": "MONTHLY", "base_price": "200.0000"},
        headers=admin_headers,
    )
    plan_id = plan_resp.json()["id"]

    # Create quotation for Customer A using staff_headers
    quote_a = client.post(
        "/api/v1/quotations/",
        json={"customer_id": str(cust_a.id), "plan_id": plan_id},
        headers=staff_headers,
    ).json()

    # User B attempts to access Customer A's quotation -> 403 Forbidden
    resp = client.get(f"/api/v1/quotations/{quote_a['id']}", headers={"Authorization": f"Bearer {token_b}"})
    assert resp.status_code == 403

    # User A accesses Customer A's quotation -> 200 OK
    resp = client.get(f"/api/v1/quotations/{quote_a['id']}", headers={"Authorization": f"Bearer {token_a}"})
    assert resp.status_code == 200
