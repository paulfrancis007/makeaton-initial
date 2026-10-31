import datetime
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session

from app.core.config import settings
from app.core.security import create_access_token, hash_password
from app.db.session import get_db
from app.main import app
from app.models.auth import PasswordResetToken, User
from app.models.customer import Customer, CustomerUser
from app.models.governance import AuditLog

# Construct strict connection URL to brightloop_test
TEST_DB_URL = f"postgresql+psycopg://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}@{settings.POSTGRES_SERVER}:{settings.POSTGRES_PORT}/brightloop_test"
test_engine = create_engine(TEST_DB_URL, pool_pre_ping=True)
TestSession = sessionmaker(bind=test_engine)


@pytest.fixture(scope="session", autouse=True)
def verify_test_database_target():
    """Fail-fast verification ensuring all tests run strictly against brightloop_test."""
    with test_engine.connect() as conn:
        current_db = conn.execute(text("SELECT current_database();")).scalar()
        assert current_db == "brightloop_test", (
            f"SAFETY VIOLATION: Expected current database to be 'brightloop_test', but got '{current_db}'!"
        )


@pytest.fixture
def db_session():
    """Provides a transactional database session rolled back or cleared after each test."""
    session = TestSession()
    assert session.execute(text("SELECT current_database();")).scalar() == "brightloop_test"
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture
def client(db_session: Session):
    """Provides FastAPI TestClient with dependency override pointing to brightloop_test."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def create_user_helper(db: Session, email_prefix: str = "user", role: str = "CUSTOMER", is_active: bool = True) -> tuple[User, str]:
    raw_password = "SecurePassword123!"
    user = User(
        email=f"{email_prefix}_{uuid.uuid4().hex[:8]}@example.com".lower(),
        hashed_password=hash_password(raw_password),
        full_name="Test User",
        role=role,
        is_active=is_active,
    )
    db.add(user)
    db.commit()
    return user, raw_password


# ==============================================================================
# Authentication Tests
# ==============================================================================

def test_login_success(client: TestClient, db_session: Session):
    user, password = create_user_helper(db_session, "login_ok")
    response = client.post("/api/v1/auth/login", json={"email": user.email, "password": password})
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == user.email
    assert data["user"]["role"] == "CUSTOMER"
    assert "hashed_password" not in data["user"]
    assert "password" not in data["user"]

    # Verify audit log created
    audit = db_session.query(AuditLog).filter(
        AuditLog.action == "USER_LOGIN_SUCCESS",
        AuditLog.entity_id == user.id,
    ).first()
    assert audit is not None
    assert audit.actor_user_id == user.id


def test_login_incorrect_password(client: TestClient, db_session: Session):
    user, _ = create_user_helper(db_session, "wrong_pwd")
    response = client.post("/api/v1/auth/login", json={"email": user.email, "password": "WrongPassword999!"})
    assert response.status_code == 401
    assert "Incorrect email or password" in response.json()["detail"]


def test_login_unknown_account(client: TestClient):
    response = client.post("/api/v1/auth/login", json={"email": "nonexistent_user@example.com", "password": "AnyPassword1!"})
    assert response.status_code == 401
    assert "Incorrect email or password" in response.json()["detail"]


def test_login_inactive_user(client: TestClient, db_session: Session):
    user, password = create_user_helper(db_session, "inactive", is_active=False)
    response = client.post("/api/v1/auth/login", json={"email": user.email, "password": password})
    assert response.status_code == 403
    assert "deactivated" in response.json()["detail"]


def test_me_endpoint_success(client: TestClient, db_session: Session):
    user, _ = create_user_helper(db_session, "me_test", role="STAFF")
    token = create_access_token(subject=str(user.id))
    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(user.id)
    assert data["email"] == user.email
    assert data["role"] == "STAFF"
    assert "hashed_password" not in data


def test_me_missing_bearer_token(client: TestClient):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert "Missing Bearer token" in response.json()["detail"]


def test_me_invalid_token(client: TestClient):
    response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer invalid.jwt.token"})
    assert response.status_code == 401
    assert "Invalid authentication token" in response.json()["detail"]


def test_me_expired_token(client: TestClient, db_session: Session):
    user, _ = create_user_helper(db_session, "expired")
    # Token expired 1 hour ago
    expired_token = create_access_token(
        subject=str(user.id),
        expires_delta=datetime.timedelta(hours=-1)
    )
    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {expired_token}"})
    assert response.status_code == 401
    assert "Token has expired" in response.json()["detail"]


def test_customer_registration_success(client: TestClient, db_session: Session):
    reg_email = f"reg_{uuid.uuid4().hex[:8]}@example.com".lower()
    payload = {
        "email": reg_email,
        "password": "ValidPassword123#",
        "full_name": "New Customer Owner",
        "company_name": "ACME Cloud Services",
        "billing_address_line1": "456 Residency Rd",
        "city": "Bengaluru",
        "state": "Karnataka",
        "postal_code": "560025",
        "country": "IN",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == reg_email
    assert data["user"]["role"] == "CUSTOMER"

    # Verify Customer and CustomerUser created in DB
    user = db_session.query(User).filter(User.email == reg_email).first()
    assert user is not None
    cust = db_session.query(Customer).filter(Customer.contact_email == reg_email).first()
    assert cust is not None
    assert cust.company_name == "ACME Cloud Services"

    cu = db_session.query(CustomerUser).filter(CustomerUser.customer_id == cust.id, CustomerUser.user_id == user.id).first()
    assert cu is not None
    assert cu.membership_role == "OWNER"
    assert cu.is_primary is True
    assert cu.status == "ACTIVE"


def test_customer_registration_weak_password_rejected(client: TestClient):
    weak_passwords = [
        "short1!",        # <= 8 chars
        "alllowercase1!", # No uppercase
        "ALLUPPERCASE1!", # No lowercase
        "NoSpecialChar1", # No special char
    ]
    for pwd in weak_passwords:
        payload = {
            "email": f"weak_{uuid.uuid4().hex[:6]}@example.com",
            "password": pwd,
            "full_name": "Test",
            "company_name": "Test Org",
            "billing_address_line1": "Address",
            "city": "City",
            "state": "State",
            "postal_code": "12345",
            "country": "IN",
        }
        response = client.post("/api/v1/auth/register", json=payload)
        assert response.status_code in (400, 422)


def test_customer_registration_duplicate_email_rejected(client: TestClient, db_session: Session):
    user, _ = create_user_helper(db_session, "dup_reg")
    payload = {
        "email": user.email,
        "password": "ValidPassword123#",
        "full_name": "Duplicate User",
        "company_name": "Duplicate Org",
        "billing_address_line1": "Address",
        "city": "City",
        "state": "State",
        "postal_code": "12345",
        "country": "IN",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]


def test_bootstrap_admin_lifecycle(client: TestClient, db_session: Session):
    # Ensure no admin exists
    db_session.query(User).filter(User.role == "ADMIN").delete()
    db_session.commit()

    admin_email = f"bootstrap_admin_{uuid.uuid4().hex[:6]}@example.com".lower()
    payload = {
        "email": admin_email,
        "password": "AdminPassword123#",
        "full_name": "Initial System Administrator",
        "bootstrap_token": settings.BOOTSTRAP_ADMIN_TOKEN,
    }
    # 1. First bootstrap succeeds
    response = client.post("/api/v1/auth/bootstrap-admin", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["role"] == "ADMIN"
    assert data["email"] == admin_email

    # 2. Second bootstrap attempt is rejected
    payload2 = {
        "email": f"second_admin_{uuid.uuid4().hex[:6]}@example.com",
        "password": "AdminPassword123#",
        "full_name": "Second Administrator Attempt",
        "bootstrap_token": settings.BOOTSTRAP_ADMIN_TOKEN,
    }
    response2 = client.post("/api/v1/auth/bootstrap-admin", json=payload2)
    assert response2.status_code == 403
    assert "permanently disabled" in response2.json()["detail"]


def test_password_reset_workflow(client: TestClient, db_session: Session):
    user, _ = create_user_helper(db_session, "pwd_reset")

    # 1. Request reset
    req_resp = client.post("/api/v1/auth/password-reset-request", json={"email": user.email})
    assert req_resp.status_code == 200
    token = req_resp.json().get("dev_token")
    assert token is not None

    # 2. Confirm reset with new password
    new_password = "NewSuperPassword123!"
    confirm_resp = client.post("/api/v1/auth/password-reset-confirm", json={"token": token, "new_password": new_password})
    assert confirm_resp.status_code == 200

    # 3. Verify user can log in with new password
    login_resp = client.post("/api/v1/auth/login", json={"email": user.email, "password": new_password})
    assert login_resp.status_code == 200

    # 4. Attempting to reuse same token is rejected
    reuse_resp = client.post("/api/v1/auth/password-reset-confirm", json={"token": token, "new_password": "AnotherPassword123!"})
    assert reuse_resp.status_code == 400
    assert "invalid, used, or expired" in reuse_resp.json()["detail"]


def test_production_jwt_signing_secret_validation():
    """Verify that Settings rejects weak or default secrets in production."""
    from pydantic import ValidationError
    from app.core.config import Settings

    with pytest.raises(ValidationError) as exc_info:
        Settings(
            ENVIRONMENT="production",
            JWT_SECRET_KEY="short-secret",
            BOOTSTRAP_ADMIN_TOKEN="custom-bootstrap-token-123456789",
        )
    assert "JWT_SECRET_KEY must be a cryptographically strong secret" in str(exc_info.value)


def test_production_default_bootstrap_token_validation():
    """Verify that Settings rejects default bootstrap token in production."""
    from pydantic import ValidationError
    from app.core.config import Settings

    with pytest.raises(ValidationError) as exc_info:
        Settings(
            ENVIRONMENT="production",
            JWT_SECRET_KEY="a-very-long-and-secure-jwt-secret-key-for-prod-32chars",
            BOOTSTRAP_ADMIN_TOKEN="brightloop-bootstrap-admin-secret-2026",
        )
    assert "default BOOTSTRAP_ADMIN_TOKEN cannot be used" in str(exc_info.value)
