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
from app.models.catalog import Product
from app.models.discount import DiscountRule

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


def test_discount_crud_and_rbac(client: TestClient, db_session: Session):
    admin_user, admin_token = create_user_with_token(db_session, "ADMIN")
    staff_user, staff_token = create_user_with_token(db_session, "STAFF")
    customer_user, customer_token = create_user_with_token(db_session, "CUSTOMER")

    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    staff_headers = {"Authorization": f"Bearer {staff_token}"}
    customer_headers = {"Authorization": f"Bearer {customer_token}"}

    rule_code = f"DISC_{uuid.uuid4().hex[:6].upper()}"
    payload = {
        "code": rule_code.lower(),  # Verify automatic uppercase conversion
        "name": "Summer Promotional Discount",
        "discount_type": "PERCENTAGE",
        "discount_value": "15.0000",
        "scope": "ORDER",
        "application_frequency": "FIRST_INVOICE_ONLY",
        "minimum_purchase_amount": "500.0000",
        "minimum_quantity": 1,
        "max_uses": 100,
    }

    # Staff and Customer cannot create discount rules
    resp = client.post("/api/v1/discounts/", json=payload, headers=staff_headers)
    assert resp.status_code == 403

    resp = client.post("/api/v1/discounts/", json=payload, headers=customer_headers)
    assert resp.status_code == 403

    # Admin creates discount rule
    resp = client.post("/api/v1/discounts/", json=payload, headers=admin_headers)
    assert resp.status_code == 201
    data = resp.json()
    rule_id = data["id"]
    assert data["code"] == rule_code
    assert data["discount_value"] == "15.0000"

    # Duplicate code rejected
    resp = client.post("/api/v1/discounts/", json=payload, headers=admin_headers)
    assert resp.status_code == 409

    # Staff can view discount rules
    resp = client.get("/api/v1/discounts/", headers=staff_headers)
    assert resp.status_code == 200
    assert any(r["id"] == rule_id for r in resp.json()["items"])

    # Customer cannot view discount rules
    resp = client.get("/api/v1/discounts/", headers=customer_headers)
    assert resp.status_code == 403

    # Admin updates discount rule
    resp = client.put(
        f"/api/v1/discounts/{rule_id}",
        json={"name": "Updated Summer Promo", "discount_value": "20.0000"},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["discount_value"] == "20.0000"

    # Deactivate discount rule
    resp = client.delete(f"/api/v1/discounts/{rule_id}", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False


def test_discount_evaluation_order_scope(client: TestClient, db_session: Session):
    admin_user, admin_token = create_user_with_token(db_session, "ADMIN")
    staff_user, staff_token = create_user_with_token(db_session, "STAFF")

    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    # 1. Percentage discount on order
    code_pct = f"PCT_{uuid.uuid4().hex[:6].upper()}"
    client.post(
        "/api/v1/discounts/",
        json={
            "code": code_pct,
            "name": "10 Percent Off",
            "discount_type": "PERCENTAGE",
            "discount_value": "10.0000",
            "scope": "ORDER",
            "application_frequency": "FIRST_INVOICE_ONLY",
            "minimum_purchase_amount": "100.0000",
            "minimum_quantity": 2,
        },
        headers=admin_headers,
    )

    # Evaluate below minimum purchase amount
    eval_req = {
        "code": code_pct,
        "order_subtotal": "50.0000",
        "items": [{"product_id": str(uuid.uuid4()), "quantity": 2, "unit_price": "25.0000"}],
        "cycle_number": 1,
    }
    resp = client.post("/api/v1/discounts/evaluate", json=eval_req, headers=staff_headers)
    assert resp.status_code == 200
    assert resp.json()["is_eligible"] is False
    assert "minimum purchase" in resp.json()["rejection_reason"].lower()

    # Evaluate below minimum quantity
    eval_req = {
        "code": code_pct,
        "order_subtotal": "200.0000",
        "items": [{"product_id": str(uuid.uuid4()), "quantity": 1, "unit_price": "200.0000"}],
        "cycle_number": 1,
    }
    resp = client.post("/api/v1/discounts/evaluate", json=eval_req, headers=staff_headers)
    assert resp.status_code == 200
    assert resp.json()["is_eligible"] is False
    assert "minimum quantity" in resp.json()["rejection_reason"].lower()

    # Evaluate on cycle 2 for FIRST_INVOICE_ONLY
    eval_req = {
        "code": code_pct,
        "order_subtotal": "200.0000",
        "items": [{"product_id": str(uuid.uuid4()), "quantity": 2, "unit_price": "100.0000"}],
        "cycle_number": 2,
    }
    resp = client.post("/api/v1/discounts/evaluate", json=eval_req, headers=staff_headers)
    assert resp.status_code == 200
    assert resp.json()["is_eligible"] is False
    assert "first billing cycle" in resp.json()["rejection_reason"].lower()

    # Valid evaluation on cycle 1: 10% of 200.0000 = 20.0000
    eval_req["cycle_number"] = 1
    resp = client.post("/api/v1/discounts/evaluate", json=eval_req, headers=staff_headers)
    assert resp.status_code == 200
    res = resp.json()
    assert res["is_eligible"] is True
    assert res["discount_amount"] == "20.0000"


def test_discount_evaluation_product_selection_scope(client: TestClient, db_session: Session):
    admin_user, admin_token = create_user_with_token(db_session, "ADMIN")
    staff_user, staff_token = create_user_with_token(db_session, "STAFF")

    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    # Create two products
    p1_resp = client.post(
        "/api/v1/products/",
        json={"name": f"Eligible P1 {uuid.uuid4().hex[:4]}", "product_type": "SERVICE", "base_sales_price": "100.0000"},
        headers=admin_headers,
    )
    p1_id = p1_resp.json()["id"]

    p2_resp = client.post(
        "/api/v1/products/",
        json={"name": f"Ineligible P2 {uuid.uuid4().hex[:4]}", "product_type": "SERVICE", "base_sales_price": "100.0000"},
        headers=admin_headers,
    )
    p2_id = p2_resp.json()["id"]

    # Fixed amount discount for Product 1 only
    code_sel = f"SEL_{uuid.uuid4().hex[:6].upper()}"
    client.post(
        "/api/v1/discounts/",
        json={
            "code": code_sel,
            "name": "50 Off Product 1",
            "discount_type": "FIXED_AMOUNT",
            "discount_value": "50.0000",
            "scope": "PRODUCT_SELECTION",
            "application_frequency": "RECURRING_ALL_CYCLES",
            "eligible_product_ids": [p1_id],
        },
        headers=admin_headers,
    )

    # Order contains only ineligible Product 2
    eval_req = {
        "code": code_sel,
        "order_subtotal": "100.0000",
        "items": [{"product_id": p2_id, "quantity": 1, "unit_price": "100.0000"}],
        "cycle_number": 3,
    }
    resp = client.post("/api/v1/discounts/evaluate", json=eval_req, headers=staff_headers)
    assert resp.status_code == 200
    assert resp.json()["is_eligible"] is False
    assert "no eligible products" in resp.json()["rejection_reason"].lower()

    # Order contains eligible Product 1 and ineligible Product 2
    eval_req["items"] = [
        {"product_id": p1_id, "quantity": 1, "unit_price": "100.0000"},
        {"product_id": p2_id, "quantity": 1, "unit_price": "100.0000"},
    ]
    eval_req["order_subtotal"] = "200.0000"
    resp = client.post("/api/v1/discounts/evaluate", json=eval_req, headers=staff_headers)
    assert resp.status_code == 200
    res = resp.json()
    assert res["is_eligible"] is True
    assert res["discount_amount"] == "50.0000"
    assert res["qualifying_subtotal"] == "100.0000"
