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
from app.models.catalog import Plan, Product
from app.models.customer import Customer, CustomerUser
from app.models.quotation import Quotation, QuotationLine
from app.models.subscription import Subscription

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
def cleanup_subscription_artifacts():
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
        billing_address_line1="100 Innovation Park",
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


def test_convert_confirmed_quotation_to_subscription(client: TestClient, db_session: Session):
    admin_user, admin_token = create_user_with_token(db_session, "ADMIN")
    staff_user, staff_token = create_user_with_token(db_session, "STAFF")

    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    customer = create_test_customer(db_session, "NovaTech")

    plan_resp = client.post(
        "/api/v1/plans/",
        json={
            "name": f"Cloud SaaS Plan {uuid.uuid4().hex[:6]}",
            "billing_interval": "MONTHLY",
            "interval_count": 1,
            "base_price": "2000.0000",
            "allow_pause": True,
            "allow_early_closure": True,
        },
        headers=admin_headers,
    )
    plan_id = plan_resp.json()["id"]

    prod_resp = client.post(
        "/api/v1/products/",
        json={"name": f"Addon Storage {uuid.uuid4().hex[:6]}", "product_type": "ADDON", "base_sales_price": "500.0000"},
        headers=admin_headers,
    )
    prod_id = prod_resp.json()["id"]

    # 1. Create quotation and confirm it
    quote_resp = client.post(
        "/api/v1/quotations/",
        json={
            "customer_id": str(customer.id),
            "plan_id": plan_id,
            "validity_duration_days": 30,
            "lines": [{"line_type": "PRODUCT", "product_id": prod_id, "quantity": 1}],
        },
        headers=staff_headers,
    )
    quote_id = quote_resp.json()["id"]

    client.post(f"/api/v1/quotations/{quote_id}/status", json={"status": "SENT"}, headers=staff_headers)
    client.post(f"/api/v1/quotations/{quote_id}/status", json={"status": "CONFIRMED"}, headers=staff_headers)

    # 2. Staff converts confirmed quotation to subscription
    convert_resp = client.post(
        f"/api/v1/subscriptions/from-quotation/{quote_id}",
        json={"start_date": str(datetime.date.today()), "payment_terms_days": 20},
        headers=staff_headers,
    )
    assert convert_resp.status_code == 201
    sub = convert_resp.json()
    assert sub["status"] == "ACTIVE"
    assert sub["quotation_id"] == quote_id
    assert Decimal(sub["recurring_subtotal"]) == Decimal("2500.00")
    assert sub["payment_terms_days"] == 20

    # 3. Duplicate conversion rejected (Idempotency / Unique constraint)
    repeat_resp = client.post(
        f"/api/v1/subscriptions/from-quotation/{quote_id}",
        json={"payment_terms_days": 20},
        headers=staff_headers,
    )
    assert repeat_resp.status_code == 409
    assert "already been converted" in repeat_resp.json()["detail"].lower()

    # 4. Snapshot preservation: changing catalog price of product does not affect agreed subscription total
    client.put(f"/api/v1/products/{prod_id}", json={"base_sales_price": "9999.0000"}, headers=admin_headers)
    sub_detail = client.get(f"/api/v1/subscriptions/{sub['id']}", headers=staff_headers).json()
    assert Decimal(sub_detail["recurring_subtotal"]) == Decimal("2500.00")


def test_subscription_pause_resume_lifecycle(client: TestClient, db_session: Session):
    admin_user, admin_token = create_user_with_token(db_session, "ADMIN")
    staff_user, staff_token = create_user_with_token(db_session, "STAFF")

    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    customer = create_test_customer(db_session, "PausableCorp")

    # Plan that permits pausing
    plan_resp = client.post(
        "/api/v1/plans/",
        json={"name": f"Pausable Plan {uuid.uuid4().hex[:6]}", "billing_interval": "MONTHLY", "base_price": "1200.0000", "allow_pause": True},
        headers=admin_headers,
    )
    plan_id = plan_resp.json()["id"]

    quote_resp = client.post(
        "/api/v1/quotations/",
        json={"customer_id": str(customer.id), "plan_id": plan_id},
        headers=staff_headers,
    )
    quote_id = quote_resp.json()["id"]
    client.post(f"/api/v1/quotations/{quote_id}/status", json={"status": "SENT"}, headers=staff_headers)
    client.post(f"/api/v1/quotations/{quote_id}/status", json={"status": "CONFIRMED"}, headers=staff_headers)

    sub = client.post(
        f"/api/v1/subscriptions/from-quotation/{quote_id}",
        json={},
        headers=staff_headers,
    ).json()
    sub_id = sub["id"]
    assert sub["status"] == "ACTIVE"

    # 1. Pause subscription
    pause_resp = client.post(
        f"/api/v1/subscriptions/{sub_id}/pause",
        json={"reason": "Seasonal maintenance shutdown"},
        headers=staff_headers,
    )
    assert pause_resp.status_code == 200
    assert pause_resp.json()["status"] == "PAUSED"

    # Cannot pause already paused subscription
    pause_again = client.post(
        f"/api/v1/subscriptions/{sub_id}/pause",
        json={"reason": "Duplicate pause attempt"},
        headers=staff_headers,
    )
    assert pause_again.status_code == 400

    # 2. Resume subscription
    resume_resp = client.post(f"/api/v1/subscriptions/{sub_id}/resume", headers=staff_headers)
    assert resume_resp.status_code == 200
    assert resume_resp.json()["status"] == "ACTIVE"

    # 3. Close subscription
    close_resp = client.post(
        f"/api/v1/subscriptions/{sub_id}/close",
        json={"reason": "Customer migration completed"},
        headers=staff_headers,
    )
    assert close_resp.status_code == 200
    assert close_resp.json()["status"] == "CLOSED"


def test_subscription_pause_prohibited_on_restricted_plan(client: TestClient, db_session: Session):
    admin_user, admin_token = create_user_with_token(db_session, "ADMIN")
    staff_user, staff_token = create_user_with_token(db_session, "STAFF")

    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    customer = create_test_customer(db_session, "NoPauseOrg")

    # Plan that DISALLOWS pausing
    plan_resp = client.post(
        "/api/v1/plans/",
        json={"name": f"Non-Pausable Plan {uuid.uuid4().hex[:6]}", "billing_interval": "MONTHLY", "base_price": "1000.0000", "allow_pause": False},
        headers=admin_headers,
    )
    plan_id = plan_resp.json()["id"]

    quote_resp = client.post(
        "/api/v1/quotations/",
        json={"customer_id": str(customer.id), "plan_id": plan_id},
        headers=staff_headers,
    )
    quote_id = quote_resp.json()["id"]
    client.post(f"/api/v1/quotations/{quote_id}/status", json={"status": "SENT"}, headers=staff_headers)
    client.post(f"/api/v1/quotations/{quote_id}/status", json={"status": "CONFIRMED"}, headers=staff_headers)

    sub = client.post(f"/api/v1/subscriptions/from-quotation/{quote_id}", json={}, headers=staff_headers).json()
    sub_id = sub["id"]

    # Pause attempt rejected
    pause_resp = client.post(
        f"/api/v1/subscriptions/{sub_id}/pause",
        json={"reason": "Unauthorized pause attempt"},
        headers=staff_headers,
    )
    assert pause_resp.status_code == 400
    assert "prohibit" in pause_resp.json()["detail"].lower()


def test_subscription_tenant_isolation_and_invalid_conversion(client: TestClient, db_session: Session):
    admin_user, admin_token = create_user_with_token(db_session, "ADMIN")
    staff_user, staff_token = create_user_with_token(db_session, "STAFF")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    # Customer 1
    cust_1 = create_test_customer(db_session, "TenantOne")
    user_1, token_1 = create_user_with_token(db_session, "CUSTOMER")
    db_session.add(CustomerUser(customer_id=cust_1.id, user_id=user_1.id, membership_role="OWNER", is_primary=True, status="ACTIVE"))

    # Customer 2
    cust_2 = create_test_customer(db_session, "TenantTwo")
    user_2, token_2 = create_user_with_token(db_session, "CUSTOMER")
    db_session.add(CustomerUser(customer_id=cust_2.id, user_id=user_2.id, membership_role="OWNER", is_primary=True, status="ACTIVE"))
    db_session.commit()

    plan_resp = client.post(
        "/api/v1/plans/",
        json={"name": f"Tenant Plan {uuid.uuid4().hex[:6]}", "billing_interval": "MONTHLY", "base_price": "800.0000"},
        headers=admin_headers,
    )
    plan_id = plan_resp.json()["id"]

    # 1. Create quotation in DRAFT status
    quote_resp = client.post(
        "/api/v1/quotations/",
        json={"customer_id": str(cust_1.id), "plan_id": plan_id},
        headers=staff_headers,
    )
    quote_id = quote_resp.json()["id"]

    # Attempting to convert DRAFT quotation is rejected (400)
    bad_convert = client.post(
        f"/api/v1/subscriptions/from-quotation/{quote_id}",
        json={},
        headers=staff_headers,
    )
    assert bad_convert.status_code == 400
    assert "confirmed" in bad_convert.json()["detail"].lower()

    # Confirm quotation
    client.post(f"/api/v1/quotations/{quote_id}/status", json={"status": "SENT"}, headers=staff_headers)
    client.post(f"/api/v1/quotations/{quote_id}/status", json={"status": "CONFIRMED"}, headers=staff_headers)

    # Convert to subscription
    sub_resp = client.post(
        f"/api/v1/subscriptions/from-quotation/{quote_id}",
        json={},
        headers=staff_headers,
    )
    assert sub_resp.status_code == 201
    sub_id = sub_resp.json()["id"]

    # User 2 attempts to view Customer 1's subscription -> 403 Forbidden
    resp = client.get(f"/api/v1/subscriptions/{sub_id}", headers={"Authorization": f"Bearer {token_2}"})
    assert resp.status_code == 403

    # User 1 views Customer 1's subscription -> 200 OK
    resp = client.get(f"/api/v1/subscriptions/{sub_id}", headers={"Authorization": f"Bearer {token_1}"})
    assert resp.status_code == 200
    assert resp.json()["id"] == sub_id
