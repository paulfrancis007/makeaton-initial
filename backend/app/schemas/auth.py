import datetime
import uuid
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.core.security import validate_password_strength


class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=150)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class UserPublic(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role: str
    is_active: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class CustomerRegisterRequest(BaseModel):
    """Public customer self-registration payload."""
    email: EmailStr
    password: str = Field(min_length=9)
    full_name: str = Field(min_length=1, max_length=150)
    company_name: str = Field(min_length=1, max_length=200)
    contact_phone: Optional[str] = Field(default=None, max_length=50)
    billing_address_line1: str = Field(min_length=1, max_length=255)
    billing_address_line2: Optional[str] = Field(default=None, max_length=255)
    city: str = Field(min_length=1, max_length=100)
    state: str = Field(min_length=1, max_length=100)
    postal_code: str = Field(min_length=1, max_length=20)
    country: str = Field(min_length=2, max_length=2, default="IN")

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        validate_password_strength(v)
        return v


class UserCreateAdmin(BaseModel):
    """Admin-only endpoint to create STAFF or ADMIN users."""
    email: EmailStr
    password: str = Field(min_length=9)
    full_name: str = Field(min_length=1, max_length=150)
    role: str = Field(pattern="^(STAFF|ADMIN)$")

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        validate_password_strength(v)
        return v


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    is_active: Optional[bool] = None


class BootstrapAdminRequest(BaseModel):
    """One-time bootstrap request to create initial administrator."""
    email: EmailStr
    password: str = Field(min_length=9)
    full_name: str = Field(min_length=1, max_length=150)
    bootstrap_token: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        validate_password_strength(v)
        return v


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(min_length=9)

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        validate_password_strength(v)
        return v
