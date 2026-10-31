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
from app.services.billing_scheduler import run_scheduled_billing

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
def cleanup_e2e_artifacts():
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
        email=f"e2e_user_{suffix}@example.com",
        full_name=f"E2E User {suffix}",
        hashed_password=hash_password("Password123!"),
        role=role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(subject=str(user.id))
    return user, token


def test_complete_platform_e2e_journey(client: TestClient, db_session: Session):
    """
    Complete end-to-end journey:
    Customer -> Product & Plan -> Quotation -> Subscription ->
    Invoice -> Partial Payment -> Settlement -> PDF Generation -> Voiding -> Scheduler Idempotency
    """
    admin_user, admin_token = create_user_with_token(db_session, "ADMIN")
    staff_user, staff_token = create_user_with_token(db_session, "STAFF")
    cust_user, cust_token = create_user_with_token(db_session, "CUSTOMER")

    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    staff_headers = {"Authorization": f"Bearer {staff_token}"}
    cust_headers = {"Authorization": f"Bearer {cust_token}"}

    suffix = uuid.uuid4().hex[:6]

    # 1. Create Customer
    customer = Customer(
        company_name=f"Acme Corp E2E {suffix}",
        contact_email=f"billing_{suffix}@example.com",
        contact_phone="9988776655",
        billing_address_line1="123 Industrial Way",
        city="Bengaluru",
        state="Karnataka",
        postal_code="560001",
        country="IN",
        currency="INR",
        is_active=True,
    )
    db_session.add(customer)
    db_session.commit()
    db_session.refresh(customer)

    # Link customer user
    cust_membership = CustomerUser(
        customer_id=customer.id,
        user_id=cust_user.id,
        membership_role="OWNER",
        status="ACTIVE",
    )
    db_session.add(cust_membership)
    db_session.commit()

    # 2. Admin creates Catalog Plan
    plan_resp = client.post(
        "/api/v1/plans/",
        headers=admin_headers,
        json={
            "name": f"Enterprise Cloud Plan {suffix}",
            "code": f"ENT-{suffix}",
            "billing_interval": "MONTHLY",
            "interval_count": 1,
            "base_price": 500.0,
        },
    )
    assert plan_resp.status_code == 201
    plan_id = plan_resp.json()["id"]

    # 3. Staff creates Quotation
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
                    "description": "Enterprise Cloud Plan ₹500",
                    "unit_price": 500.0,
                    "quantity": 1,
                }
            ],
        },
    )
    assert q_resp.status_code == 201
    quote_id = q_resp.json()["id"]

    # 4. Confirm Quotation
    client.post(f"/api/v1/quotations/{quote_id}/status", headers=staff_headers, json={"status": "SENT"})
    st_resp = client.post(f"/api/v1/quotations/{quote_id}/status", headers=staff_headers, json={"status": "CONFIRMED"})
    assert st_resp.status_code == 200

    # 5. Convert to Subscription
    sub_resp = client.post(
        f"/api/v1/subscriptions/from-quotation/{quote_id}",
        headers=staff_headers,
        json={"start_date": today.isoformat()},
    )
    assert sub_resp.status_code == 201
    sub_id = sub_resp.json()["id"]

    # 6. Generate Invoice from Subscription
    inv_resp = client.post(f"/api/v1/invoices/from-subscription/{sub_id}", headers=staff_headers)
    assert inv_resp.status_code == 200
    inv_data = inv_resp.json()
    inv_id = inv_data["id"]
    total = Decimal(str(inv_data["total_amount"]))
    assert total == Decimal("500.00")
    assert Decimal(str(inv_data["balance_due"])) == Decimal("500.00")

    # 7. Customer views invoice detail and downloads PDF
    inv_detail = client.get(f"/api/v1/invoices/{inv_id}", headers=cust_headers)
    assert inv_detail.status_code == 200
    assert inv_detail.json()["invoice_number"] == inv_data["invoice_number"]

    pdf_resp = client.get(f"/api/v1/invoices/{inv_id}/pdf", headers=cust_headers)
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers["content-type"] == "application/pdf"
    assert pdf_resp.content.startswith(b"%PDF-1.4")

    # 8. Record Partial Payment (₹300.00)
    pay1_resp = client.post(
        "/api/v1/payments/",
        headers=staff_headers,
        json={
            "invoice_id": inv_id,
            "amount": 300.00,
            "payment_method": "BANK_TRANSFER",
            "reference_number": "TXN-E2E-PARTIAL-300",
        },
    )
    assert pay1_resp.status_code == 201
    assert pay1_resp.json()["status"] == "SUCCESS"

    inv_check1 = client.get(f"/api/v1/invoices/{inv_id}", headers=staff_headers).json()
    assert inv_check1["status"] == "PARTIALLY_PAID"
    assert Decimal(str(inv_check1["amount_paid"])) == Decimal("300.00")
    assert Decimal(str(inv_check1["balance_due"])) == Decimal("200.00")

    # 9. Record Final Payment (₹200.00)
    pay2_resp = client.post(
        "/api/v1/payments/",
        headers=staff_headers,
        json={
            "invoice_id": inv_id,
            "amount": 200.00,
            "payment_method": "CARD",
            "reference_number": "TXN-E2E-FINAL-200",
        },
    )
    assert pay2_resp.status_code == 201
    pay2_id = pay2_resp.json()["id"]

    inv_check2 = client.get(f"/api/v1/invoices/{inv_id}", headers=staff_headers).json()
    assert inv_check2["status"] == "PAID"
    assert Decimal(str(inv_check2["balance_due"])) == Decimal("0.00")
    assert Decimal(str(inv_check2["amount_paid"])) == Decimal("500.00")

    # 10. Test Void Mechanism Restoring Invoice Balance
    void_resp = client.post(
        f"/api/v1/payments/{pay2_id}/void",
        headers=staff_headers,
        json={"void_reason": "Customer bank reversal dispute"},
    )
    assert void_resp.status_code == 200
    assert void_resp.json()["status"] == "VOIDED"

    inv_check3 = client.get(f"/api/v1/invoices/{inv_id}", headers=staff_headers).json()
    assert inv_check3["status"] == "PARTIALLY_PAID"
    assert Decimal(str(inv_check3["balance_due"])) == Decimal("200.00")
    assert Decimal(str(inv_check3["amount_paid"])) == Decimal("300.00")

    # 11. Scheduled Billing Idempotency
    # Running scheduled billing again for today creates 0 new invoices (idempotent, no duplicate billing)
    sched_res = run_scheduled_billing(billing_date=today, db=db_session)
    assert sched_res["invoices_created"] == 0
    assert sched_res["failures"] == 0
