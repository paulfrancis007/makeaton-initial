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


def test_admin_and_staff_dashboards(client: TestClient, db_session: Session):
    """Test metrics calculation for Admin and Staff dashboards."""
    admin_user, admin_token = create_user_with_token(db_session, "ADMIN")
    staff_user, staff_token = create_user_with_token(db_session, "STAFF")

    suffix = uuid.uuid4().hex[:6]
    customer = create_test_customer(db_session, suffix)

    # 1. Admin dashboard query
    resp = client.get("/api/v1/dashboard/admin", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert "overview" in data
    assert data["overview"]["total_customers"] >= 1

    # 2. Staff dashboard query
    resp_staff = client.get("/api/v1/dashboard/staff", headers={"Authorization": f"Bearer {staff_token}"})
    assert resp_staff.status_code == 200
    staff_data = resp_staff.json()
    assert "pending_quotations_count" in staff_data
    assert "active_subscriptions_count" in staff_data

    # 3. Staff cannot access Admin dashboard
    resp_forbidden = client.get("/api/v1/dashboard/admin", headers={"Authorization": f"Bearer {staff_token}"})
    assert resp_forbidden.status_code == 403


def test_customer_dashboard_tenant_isolation(client: TestClient, db_session: Session):
    """Test customer dashboard only returns data for the authenticated customer."""
    admin_user, admin_token = create_user_with_token(db_session, "ADMIN")
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

    resp = client.get("/api/v1/dashboard/customer", headers={"Authorization": f"Bearer {token_a}"})
    assert resp.status_code == 200
    cust_data = resp.json()
    assert str(cust_a.id) in cust_data["customer_ids"]
    assert str(cust_b.id) not in cust_data["customer_ids"]
