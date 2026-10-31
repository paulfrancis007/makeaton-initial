from fastapi import APIRouter, Depends, Request, status, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.core.security import create_access_token
from app.models.auth import User
from app.schemas.auth import (
    BootstrapAdminRequest,
    CustomerRegisterRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    TokenResponse,
    UserLogin,
    UserPublic,
)
from app.services.audit_service import log_audit_event
from app.services.auth_service import (
    authenticate_user,
    bootstrap_initial_admin,
    confirm_password_reset,
    register_customer,
    request_password_reset,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
def login(
    payload: UserLogin,
    request: Request,
    db: Session = Depends(get_db),
):
    """Authenticate with email and password and receive a Bearer JWT."""
    user = authenticate_user(db, payload.email, payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated.",
        )

    access_token = create_access_token(subject=str(user.id))

    log_audit_event(
        db=db,
        action="USER_LOGIN_SUCCESS",
        entity_name="users",
        entity_id=user.id,
        actor_user_id=user.id,
        ip_address=request.client.host if request.client else None,
        details={"email": user.email, "role": user.role},
    )
    db.commit()

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserPublic.model_validate(user),
    )


@router.get("/me", response_model=UserPublic)
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
):
    """Return the authenticated user's safe public profile."""
    return UserPublic.model_validate(current_user)


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: CustomerRegisterRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Public customer self-registration creating user and organization atomically."""
    user, _ = register_customer(
        db=db,
        data=payload,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()

    access_token = create_access_token(subject=str(user.id))
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserPublic.model_validate(user),
    )


@router.post("/bootstrap-admin", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
def bootstrap_admin(
    payload: BootstrapAdminRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """One-time administrative bootstrap endpoint. Disabled once an administrator exists."""
    admin = bootstrap_initial_admin(
        db=db,
        data=payload,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return UserPublic.model_validate(admin)


@router.post("/password-reset-request")
def request_reset(
    payload: PasswordResetRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Request a password reset. Email delivery is currently deferred; token is created securely."""
    success, dev_token = request_password_reset(
        db=db,
        email=payload.email,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()

    response = {
        "message": "If an active account with that email exists, password reset instructions have been generated."
    }
    # In non-production development environments only, expose dev_token for local testing
    if settings.ENVIRONMENT.lower() != "production" and dev_token:
        response["dev_token"] = dev_token
    return response


@router.post("/password-reset-confirm", response_model=UserPublic)
def confirm_reset(
    payload: PasswordResetConfirm,
    request: Request,
    db: Session = Depends(get_db),
):
    """Confirm password reset using token and set new password."""
    user = confirm_password_reset(
        db=db,
        token=payload.token,
        new_password=payload.new_password,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return UserPublic.model_validate(user)
