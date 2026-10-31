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
from app.models.governance import AuditLog

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


def create_user_with_token(db: Session, role: str = "CUSTOMER") -> tuple[User, str]:
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


def create_customer_with_owner(db: Session, owner_user: User, prefix: str = "org") -> Customer:
    clean_prefix = prefix.lower()
    cust = Customer(
        company_name=f"Enterprise {prefix} {uuid.uuid4().hex[:6]}",
        contact_email=f"info_{clean_prefix}_{uuid.uuid4().hex[:6]}@example.com",
        billing_address_line1="100 Tech Park",
        city="Bengaluru",
        state="Karnataka",
        postal_code="560100",
        country="IN",
        currency="INR",
        is_active=True,
    )
    db.add(cust)
    db.flush()

    membership = CustomerUser(
        customer_id=cust.id,
        user_id=owner_user.id,
        membership_role="OWNER",
        is_primary=True,
        status="ACTIVE",
    )
    db.add(membership)
    db.commit()
    return cust


# ==============================================================================
# Role-Based Access Control Tests
# ==============================================================================

def test_admin_can_manage_users(client: TestClient, db_session: Session):
    _, admin_token = create_user_with_token(db_session, "ADMIN")
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Admin creates staff user
    payload = {
        "email": f"staff_{uuid.uuid4().hex[:6]}@example.com",
        "password": "StaffPassword123#",
        "full_name": "New Staff Member",
        "role": "STAFF",
    }
    response = client.post("/api/v1/users/", json=payload, headers=headers)
    assert response.status_code == 201
    assert response.json()["role"] == "STAFF"


def test_staff_cannot_manage_users(client: TestClient, db_session: Session):
    _, staff_token = create_user_with_token(db_session, "STAFF")
    headers = {"Authorization": f"Bearer {staff_token}"}

    # Staff attempts to list users -> 403 Forbidden
    resp1 = client.get("/api/v1/users/", headers=headers)
    assert resp1.status_code == 403

    # Staff attempts to create user -> 403 Forbidden
    payload = {
        "email": f"hacked_{uuid.uuid4().hex[:6]}@example.com",
        "password": "HackedPassword123#",
        "full_name": "Fake Admin",
        "role": "ADMIN",
    }
    resp2 = client.post("/api/v1/users/", json=payload, headers=headers)
    assert resp2.status_code == 403


def test_customer_cannot_manage_users_or_elevate_role(client: TestClient, db_session: Session):
    _, customer_token = create_user_with_token(db_session, "CUSTOMER")
    headers = {"Authorization": f"Bearer {customer_token}"}

    # Customer attempts to list users -> 403 Forbidden
    resp = client.get("/api/v1/users/", headers=headers)
    assert resp.status_code == 403


# ==============================================================================
# Customer Organization Management Tests
# ==============================================================================

def test_staff_can_create_and_search_customers(client: TestClient, db_session: Session):
    _, staff_token = create_user_with_token(db_session, "STAFF")
    headers = {"Authorization": f"Bearer {staff_token}"}

    # Create customer
    unique_name = f"Alpha Solutions {uuid.uuid4().hex[:6]}"
    cust_email = f"alpha_{uuid.uuid4().hex[:6]}@example.com".lower()
    payload = {
        "company_name": unique_name,
        "contact_email": cust_email,
        "billing_address_line1": "77 Indiranagar",
        "city=" : "Bengaluru",
        "city": "Bengaluru",
        "state": "Karnataka",
        "postal_code": "560038",
        "country": "IN",
        "currency": "INR",
    }
    create_resp = client.post("/api/v1/customers/", json=payload, headers=headers)
    assert create_resp.status_code == 201
    cust_data = create_resp.json()
    assert cust_data["company_name"] == unique_name

    # Search customer
    search_resp = client.get(f"/api/v1/customers/?search={unique_name[:8]}", headers=headers)
    assert search_resp.status_code == 200
    search_data = search_resp.json()
    assert search_data["total"] >= 1
    assert any(item["company_name"] == unique_name for item in search_data["items"])


def test_customer_tenant_isolation(client: TestClient, db_session: Session):
    """Customer A must NEVER be able to view or modify Customer B's organization."""
    user_a, token_a = create_user_with_token(db_session, "CUSTOMER")
    user_b, token_b = create_user_with_token(db_session, "CUSTOMER")

    cust_a = create_customer_with_owner(db_session, user_a, "TenantA")
    cust_b = create_customer_with_owner(db_session, user_b, "TenantB")

    headers_a = {"Authorization": f"Bearer {token_a}"}

    # 1. Customer A requests Customer A -> SUCCEEDS (200)
    resp_own = client.get(f"/api/v1/customers/{cust_a.id}", headers=headers_a)
    assert resp_own.status_code == 200
    assert resp_own.json()["id"] == str(cust_a.id)

    # 2. Customer A requests Customer B -> FORBIDDEN (403)
    resp_cross = client.get(f"/api/v1/customers/{cust_b.id}", headers=headers_a)
    assert resp_cross.status_code == 403

    # 3. Customer A requests members of Customer B -> FORBIDDEN (403)
    resp_cross_members = client.get(f"/api/v1/customers/{cust_b.id}/members", headers=headers_a)
    assert resp_cross_members.status_code == 403

    # 4. Customer A attempts to update Customer B -> FORBIDDEN (403)
    resp_cross_update = client.patch(
        f"/api/v1/customers/{cust_b.id}",
        json={"company_name": "Hijacked Name"},
        headers=headers_a
    )
    assert resp_cross_update.status_code == 403

    # 5. List customers as Customer A returns ONLY Tenant A
    list_resp = client.get("/api/v1/customers/", headers=headers_a)
    assert list_resp.status_code == 200
    returned_ids = [item["id"] for item in list_resp.json()["items"]]
    assert str(cust_a.id) in returned_ids
    assert str(cust_b.id) not in returned_ids


def test_customer_deactivation(client: TestClient, db_session: Session):
    _, admin_token = create_user_with_token(db_session, "ADMIN")
    user_owner, _ = create_user_with_token(db_session, "CUSTOMER")
    cust = create_customer_with_owner(db_session, user_owner, "ToDeactivate")

    headers = {"Authorization": f"Bearer {admin_token}"}
    response = client.delete(f"/api/v1/customers/{cust.id}", headers=headers)
    assert response.status_code == 200
    assert response.json()["is_active"] is False

    # Verify audit log
    audit = db_session.query(AuditLog).filter(
        AuditLog.action == "CUSTOMER_DEACTIVATED",
        AuditLog.entity_id == cust.id,
    ).first()
    assert audit is not None


# ==============================================================================
# Membership Safety & Final OWNER Protection Tests
# ==============================================================================

def test_add_and_update_member_lifecycle(client: TestClient, db_session: Session):
    user_owner, owner_token = create_user_with_token(db_session, "CUSTOMER")
    new_user, _ = create_user_with_token(db_session, "CUSTOMER")
    cust = create_customer_with_owner(db_session, user_owner, "MemberLifecycle")

    headers = {"Authorization": f"Bearer {owner_token}"}

    # 1. Add new_user as BILLING_ADMIN
    add_payload = {
        "user_id": str(new_user.id),
        "membership_role": "BILLING_ADMIN",
        "is_primary": False,
    }
    add_resp = client.post(f"/api/v1/customers/{cust.id}/members", json=add_payload, headers=headers)
    assert add_resp.status_code == 201
    membership_data = add_resp.json()
    membership_id = membership_data["id"]
    assert membership_data["membership_role"] == "BILLING_ADMIN"

    # 2. Update role to TECHNICAL_CONTACT
    patch_resp = client.patch(
        f"/api/v1/customers/{cust.id}/members/{membership_id}",
        json={"membership_role": "TECHNICAL_CONTACT"},
        headers=headers,
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["membership_role"] == "TECHNICAL_CONTACT"

    # 3. Suspend member
    suspend_resp = client.patch(
        f"/api/v1/customers/{cust.id}/members/{membership_id}",
        json={"status": "SUSPENDED"},
        headers=headers,
    )
    assert suspend_resp.status_code == 200
    assert suspend_resp.json()["status"] == "SUSPENDED"


def test_final_owner_protection(client: TestClient, db_session: Session):
    """The only active OWNER of an organization cannot be demoted or removed."""
    user_owner, owner_token = create_user_with_token(db_session, "CUSTOMER")
    cust = create_customer_with_owner(db_session, user_owner, "FinalOwnerTest")

    # Get membership ID of the sole owner
    owner_membership = db_session.query(CustomerUser).filter(
        CustomerUser.customer_id == cust.id,
        CustomerUser.user_id == user_owner.id,
    ).one()

    headers = {"Authorization": f"Bearer {owner_token}"}

    # 1. Attempt to demote sole owner to VIEWER -> 400 Bad Request
    demote_resp = client.patch(
        f"/api/v1/customers/{cust.id}/members/{owner_membership.id}",
        json={"membership_role": "VIEWER"},
        headers=headers,
    )
    assert demote_resp.status_code == 400
    assert "only active OWNER" in demote_resp.json()["detail"]

    # 2. Attempt to suspend sole owner -> 400 Bad Request
    suspend_resp = client.patch(
        f"/api/v1/customers/{cust.id}/members/{owner_membership.id}",
        json={"status": "SUSPENDED"},
        headers=headers,
    )
    assert suspend_resp.status_code == 400
    assert "only active OWNER" in suspend_resp.json()["detail"]

    # 3. Attempt to delete sole owner -> 400 Bad Request
    delete_resp = client.delete(
        f"/api/v1/customers/{cust.id}/members/{owner_membership.id}",
        headers=headers,
    )
    assert delete_resp.status_code == 400
    assert "final active OWNER" in delete_resp.json()["detail"]


def test_primary_contact_transfer(client: TestClient, db_session: Session):
    user_owner1, owner1_token = create_user_with_token(db_session, "CUSTOMER")
    user_owner2, _ = create_user_with_token(db_session, "CUSTOMER")
    cust = create_customer_with_owner(db_session, user_owner1, "PrimaryTransfer")

    # Add second owner
    headers1 = {"Authorization": f"Bearer {owner1_token}"}
    add_resp = client.post(
        f"/api/v1/customers/{cust.id}/members",
        json={"user_id": str(user_owner2.id), "membership_role": "OWNER", "is_primary": False},
        headers=headers1,
    )
    assert add_resp.status_code == 201
    membership2_id = add_resp.json()["id"]

    # Transfer primary contact to user_owner2
    transfer_resp = client.patch(
        f"/api/v1/customers/{cust.id}/members/{membership2_id}",
        json={"is_primary": True},
        headers=headers1,
    )
    assert transfer_resp.status_code == 200
    assert transfer_resp.json()["is_primary"] is True

    # Verify user_owner1 is no longer primary
    m1 = db_session.query(CustomerUser).filter(
        CustomerUser.customer_id == cust.id,
        CustomerUser.user_id == user_owner1.id,
    ).one()
    assert m1.is_primary is False
