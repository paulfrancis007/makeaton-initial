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
from app.models.catalog import Plan, Product, ProductVariant, TaxRule

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


# =========================================================================
# PRODUCT & VARIANT TESTS
# =========================================================================

def test_product_crud_and_rbac(client: TestClient, db_session: Session):
    admin_user, admin_token = create_user_with_token(db_session, "ADMIN")
    staff_user, staff_token = create_user_with_token(db_session, "STAFF")
    customer_user, customer_token = create_user_with_token(db_session, "CUSTOMER")

    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    staff_headers = {"Authorization": f"Bearer {staff_token}"}
    customer_headers = {"Authorization": f"Bearer {customer_token}"}

    # 1. Staff and Customer cannot create products
    prod_payload = {
        "name": f"Cloud Hosting {uuid.uuid4().hex[:6]}",
        "product_type": "SERVICE",
        "description": "Scalable managed cloud hosting",
        "base_sales_price": "1500.0000",
        "cost_price": "500.0000",
    }
    resp = client.post("/api/v1/products/", json=prod_payload, headers=staff_headers)
    assert resp.status_code == 403

    resp = client.post("/api/v1/products/", json=prod_payload, headers=customer_headers)
    assert resp.status_code == 403

    # 2. Admin creates product
    resp = client.post("/api/v1/products/", json=prod_payload, headers=admin_headers)
    assert resp.status_code == 201
    prod_data = resp.json()
    product_id = prod_data["id"]
    assert prod_data["name"] == prod_payload["name"]
    assert prod_data["base_sales_price"] == "1500.0000"

    # 3. Staff can list and retrieve
    resp = client.get("/api/v1/products/", headers=staff_headers)
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert any(p["id"] == product_id for p in items)

    resp = client.get(f"/api/v1/products/{product_id}", headers=staff_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == product_id

    # 4. Customer cannot view catalog via admin endpoints
    resp = client.get("/api/v1/products/", headers=customer_headers)
    assert resp.status_code == 403

    # 5. Admin updates product
    update_payload = {"name": f"Updated Cloud {uuid.uuid4().hex[:4]}", "base_sales_price": "1800.0000"}
    resp = client.put(f"/api/v1/products/{product_id}", json=update_payload, headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["base_sales_price"] == "1800.0000"

    # 6. Admin creates variant
    variant_payload = {
        "name": "High RAM 32GB",
        "price_adjustment": "300.0000",
        "sku": f"SKU-RAM32-{uuid.uuid4().hex[:6]}",
    }
    resp = client.post(f"/api/v1/products/{product_id}/variants", json=variant_payload, headers=admin_headers)
    assert resp.status_code == 201
    variant_id = resp.json()["id"]

    # Duplicate SKU is rejected
    resp = client.post(f"/api/v1/products/{product_id}/variants", json=variant_payload, headers=admin_headers)
    assert resp.status_code == 409

    # 7. Staff lists variants
    resp = client.get(f"/api/v1/products/{product_id}/variants", headers=staff_headers)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1

    # 8. Deactivate product
    resp = client.delete(f"/api/v1/products/{product_id}", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False


def test_product_validation_errors(client: TestClient, db_session: Session):
    admin_user, admin_token = create_user_with_token(db_session, "ADMIN")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Invalid product type
    resp = client.post(
        "/api/v1/products/",
        json={"name": "Bad Product", "product_type": "INVALID_TYPE", "base_sales_price": "10.0000"},
        headers=admin_headers,
    )
    assert resp.status_code == 422

    # Negative price
    resp = client.post(
        "/api/v1/products/",
        json={"name": "Negative Price", "product_type": "SERVICE", "base_sales_price": "-10.0000"},
        headers=admin_headers,
    )
    assert resp.status_code == 422


# =========================================================================
# SUBSCRIPTION PLAN TESTS
# =========================================================================

def test_plan_lifecycle_and_constraints(client: TestClient, db_session: Session):
    admin_user, admin_token = create_user_with_token(db_session, "ADMIN")
    staff_user, staff_token = create_user_with_token(db_session, "STAFF")

    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    staff_headers = {"Authorization": f"Bearer {staff_token}"}

    # 1. Reject mutual exclusivity violation: auto_renew=True AND auto_close_on_expiry=True
    invalid_plan = {
        "name": f"Invalid Plan {uuid.uuid4().hex[:6]}",
        "billing_interval": "MONTHLY",
        "interval_count": 1,
        "base_price": "99.0000",
        "auto_renew": True,
        "auto_close_on_expiry": True,
    }
    resp = client.post("/api/v1/plans/", json=invalid_plan, headers=admin_headers)
    assert resp.status_code == 422

    # 2. Reject invalid dates: end_date < start_date
    invalid_dates = {
        "name": f"Invalid Dates {uuid.uuid4().hex[:6]}",
        "billing_interval": "MONTHLY",
        "base_price": "99.0000",
        "availability_start_date": "2026-12-01",
        "availability_end_date": "2026-11-01",
        "auto_renew": True,
        "auto_close_on_expiry": False,
    }
    resp = client.post("/api/v1/plans/", json=invalid_dates, headers=admin_headers)
    assert resp.status_code == 422

    # 3. Create valid plan
    plan_name = f"Enterprise Pro {uuid.uuid4().hex[:6]}"
    valid_plan = {
        "name": plan_name,
        "description": "Top-tier enterprise subscription",
        "billing_interval": "MONTHLY",
        "interval_count": 1,
        "base_price": "4999.0000",
        "minimum_quantity": 5,
        "auto_renew": True,
        "auto_close_on_expiry": False,
    }
    resp = client.post("/api/v1/plans/", json=valid_plan, headers=admin_headers)
    assert resp.status_code == 201
    plan_id = resp.json()["id"]

    # 4. Duplicate name rejected with 409
    resp = client.post("/api/v1/plans/", json=valid_plan, headers=admin_headers)
    assert resp.status_code == 409

    # 5. Staff lists and views
    resp = client.get("/api/v1/plans/", headers=staff_headers)
    assert resp.status_code == 200
    assert any(p["id"] == plan_id for p in resp.json()["items"])

    # 6. Deactivate plan
    resp = client.delete(f"/api/v1/plans/{plan_id}", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False


# =========================================================================
# TAX RULES & ASSIGNMENTS TESTS
# =========================================================================

def test_tax_rules_and_exclusions(client: TestClient, db_session: Session):
    admin_user, admin_token = create_user_with_token(db_session, "ADMIN")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    tax_suffix = uuid.uuid4().hex[:6]
    state_name = f"State_{tax_suffix}"

    rule_1_payload = {
        "name": f"GST Intra-State {tax_suffix}",
        "rate": "9.0000",
        "tax_type": "PERCENTAGE",
        "jurisdiction_country": "IN",
        "jurisdiction_state": state_name,
        "tax_scope": "INTRASTATE_CGST",
        "valid_from": "2026-01-01T00:00:00Z",
        "valid_until": "2026-12-31T23:59:59Z",
    }
    resp = client.post("/api/v1/taxes/", json=rule_1_payload, headers=admin_headers)
    assert resp.status_code == 201
    tax_1_id = resp.json()["id"]

    # Overlapping active rule with identical country, state, tax_scope, and time window
    # should be rejected by PostgreSQL GiST exclusion constraint (409 Conflict)
    overlapping_payload = {
        "name": f"GST Duplicate {tax_suffix}",
        "rate": "12.0000",
        "tax_type": "PERCENTAGE",
        "jurisdiction_country": "IN",
        "jurisdiction_state": state_name,
        "tax_scope": "INTRASTATE_CGST",
        "valid_from": "2026-06-01T00:00:00Z",
        "valid_until": "2026-08-31T23:59:59Z",
    }
    resp = client.post("/api/v1/taxes/", json=overlapping_payload, headers=admin_headers)
    assert resp.status_code == 409
    assert "overlaps" in resp.json()["detail"].lower()

    # Different tax_scope (e.g. SGST in the same state and window) is permitted to coexist!
    sgst_payload = {
        "name": f"GST SGST {tax_suffix}",
        "rate": "9.0000",
        "tax_type": "PERCENTAGE",
        "jurisdiction_country": "IN",
        "jurisdiction_state": state_name,
        "tax_scope": "INTRASTATE_SGST",
        "valid_from": "2026-01-01T00:00:00Z",
        "valid_until": "2026-12-31T23:59:59Z",
    }
    resp = client.post("/api/v1/taxes/", json=sgst_payload, headers=admin_headers)
    assert resp.status_code == 201
    tax_2_id = resp.json()["id"]

    # Assign both taxes to a product
    prod_resp = client.post(
        "/api/v1/products/",
        json={"name": f"Taxed Product {tax_suffix}", "product_type": "SOFTWARE", "base_sales_price": "100.0000"},
        headers=admin_headers,
    )
    product_id = prod_resp.json()["id"]

    resp = client.put(
        f"/api/v1/products/{product_id}/taxes",
        json={"tax_rule_ids": [tax_1_id, tax_2_id]},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assigned_taxes = resp.json()
    assert len(assigned_taxes) == 2

    # Retrieve assigned taxes
    resp = client.get(f"/api/v1/products/{product_id}/taxes", headers=admin_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 2
