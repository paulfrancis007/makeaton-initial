import datetime
import hashlib
import secrets
from typing import Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password, validate_password_strength, verify_password
from app.models.auth import PasswordResetToken, User
from app.models.customer import Customer, CustomerUser
from app.schemas.auth import BootstrapAdminRequest, CustomerRegisterRequest, UserCreateAdmin
from app.services.audit_service import log_audit_event


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    """Authenticate a user by email and password using Argon2id verification."""
    normalized_email = email.strip().lower()
    user = db.query(User).filter(User.email == normalized_email).first()
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def _safe_validate_password(password: str) -> None:
    try:
        validate_password_strength(password)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


def register_customer(
    db: Session,
    data: CustomerRegisterRequest,
    ip_address: Optional[str] = None,
) -> Tuple[User, Customer]:
    """
    Public customer self-registration.
    Atomically creates:
    1. User account with role 'CUSTOMER'.
    2. Customer organization.
    3. CustomerUser membership as primary OWNER.
    """
    _safe_validate_password(data.password)
    normalized_email = data.email.strip().lower()

    # Check for existing email
    existing_user = db.query(User).filter(User.email == normalized_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists.",
        )

    # 1. Create User
    hashed_pwd = hash_password(data.password)
    user = User(
        email=normalized_email,
        hashed_password=hashed_pwd,
        full_name=data.full_name.strip(),
        role="CUSTOMER",
        is_active=True,
    )
    db.add(user)
    db.flush()

    # 2. Create Customer Organization
    customer = Customer(
        company_name=data.company_name.strip(),
        contact_email=normalized_email,
        contact_phone=data.contact_phone.strip() if data.contact_phone else None,
        billing_address_line1=data.billing_address_line1.strip(),
        billing_address_line2=data.billing_address_line2.strip() if data.billing_address_line2 else None,
        city=data.city.strip(),
        state=data.state.strip(),
        postal_code=data.postal_code.strip(),
        country=data.country.strip().upper(),
        currency="INR",
        is_active=True,
    )
    db.add(customer)
    db.flush()

    # 3. Create Primary OWNER Membership
    membership = CustomerUser(
        customer_id=customer.id,
        user_id=user.id,
        membership_role="OWNER",
        is_primary=True,
        status="ACTIVE",
    )
    db.add(membership)
    db.flush()

    # 4. Audit Log
    log_audit_event(
        db=db,
        action="CUSTOMER_REGISTERED",
        entity_name="users",
        entity_id=user.id,
        actor_user_id=user.id,
        ip_address=ip_address,
        details={"company_name": customer.company_name, "customer_id": str(customer.id)},
    )

    return user, customer


def create_staff_or_admin_user(
    db: Session,
    data: UserCreateAdmin,
    actor_user: User,
    ip_address: Optional[str] = None,
) -> User:
    """Admin-only creation of privileged STAFF or ADMIN accounts."""
    if actor_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can provision privileged staff or admin accounts.",
        )

    _safe_validate_password(data.password)
    normalized_email = data.email.strip().lower()

    existing = db.query(User).filter(User.email == normalized_email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists.",
        )

    hashed_pwd = hash_password(data.password)
    user = User(
        email=normalized_email,
        hashed_password=hashed_pwd,
        full_name=data.full_name.strip(),
        role=data.role,
        is_active=True,
    )
    db.add(user)
    db.flush()

    log_audit_event(
        db=db,
        action=f"{data.role}_CREATED",
        entity_name="users",
        entity_id=user.id,
        actor_user_id=actor_user.id,
        ip_address=ip_address,
        details={"role": data.role, "full_name": user.full_name},
    )

    return user


def bootstrap_initial_admin(
    db: Session,
    data: BootstrapAdminRequest,
    ip_address: Optional[str] = None,
) -> User:
    """
    One-time bootstrap endpoint to initialize the first administrator.
    Uses PostgreSQL transaction advisory lock to prevent race conditions
    under concurrent bootstrap requests.
    """
    from sqlalchemy import text
    db.execute(text("SELECT pg_advisory_xact_lock(7429183);"))

    # Check if any admin already exists
    admin_count = db.query(User).filter(User.role == "ADMIN").count()
    if admin_count > 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="An administrator already exists. Bootstrap mechanism is permanently disabled.",
        )

    # Validate bootstrap token
    if not secrets.compare_digest(data.bootstrap_token, settings.BOOTSTRAP_ADMIN_TOKEN):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid bootstrap authorization token.",
        )

    _safe_validate_password(data.password)
    normalized_email = data.email.strip().lower()

    existing = db.query(User).filter(User.email == normalized_email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists.",
        )

    hashed_pwd = hash_password(data.password)
    admin = User(
        email=normalized_email,
        hashed_password=hashed_pwd,
        full_name=data.full_name.strip(),
        role="ADMIN",
        is_active=True,
    )
    db.add(admin)
    db.flush()

    log_audit_event(
        db=db,
        action="ADMIN_BOOTSTRAPPED",
        entity_name="users",
        entity_id=admin.id,
        actor_user_id=admin.id,
        ip_address=ip_address,
        details={"action": "Initial system administrator created via bootstrap"},
    )

    return admin


def request_password_reset(
    db: Session,
    email: str,
    ip_address: Optional[str] = None,
) -> Tuple[bool, Optional[str]]:
    """
    Create a password reset token for the specified user.
    Returns (success, raw_token_if_dev). In production, email delivery is deferred.
    """
    normalized_email = email.strip().lower()
    user = db.query(User).filter(User.email == normalized_email, User.is_active == True).first()
    if not user:
        return False, None

    # Invalidate previous unused tokens for this user
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.is_used == False,
    ).update({"is_used": True})

    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=1)

    reset_record = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
        is_used=False,
    )
    db.add(reset_record)
    db.flush()

    log_audit_event(
        db=db,
        action="PASSWORD_RESET_REQUESTED",
        entity_name="users",
        entity_id=user.id,
        actor_user_id=user.id,
        ip_address=ip_address,
        details={"notice": "Reset token generated; email provider integration deferred"},
    )

    return True, raw_token


def confirm_password_reset(
    db: Session,
    token: str,
    new_password: str,
    ip_address: Optional[str] = None,
) -> User:
    """Verify reset token and update user password."""
    _safe_validate_password(new_password)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    now = datetime.datetime.now(datetime.timezone.utc)

    record = db.query(PasswordResetToken).filter(
        PasswordResetToken.token_hash == token_hash,
        PasswordResetToken.is_used == False,
        PasswordResetToken.expires_at > now,
    ).first()

    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password reset token is invalid, used, or expired.",
        )

    user = db.query(User).filter(User.id == record.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account associated with this token is not active.",
        )

    user.hashed_password = hash_password(new_password)
    record.is_used = True
    db.flush()

    log_audit_event(
        db=db,
        action="PASSWORD_RESET_COMPLETED",
        entity_name="users",
        entity_id=user.id,
        actor_user_id=user.id,
        ip_address=ip_address,
        details={"status": "Password updated successfully"},
    )

    return user
