import datetime
import uuid
from typing import Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.schemas.auth import UserPublic


class CustomerBase(BaseModel):
    company_name: str = Field(min_length=1, max_length=200)
    contact_email: EmailStr
    contact_phone: Optional[str] = Field(default=None, max_length=50)
    tax_number: Optional[str] = Field(default=None, max_length=50)
    billing_address_line1: str = Field(min_length=1, max_length=255)
    billing_address_line2: Optional[str] = Field(default=None, max_length=255)
    city: str = Field(min_length=1, max_length=100)
    state: str = Field(min_length=1, max_length=100)
    postal_code: str = Field(min_length=1, max_length=20)
    country: str = Field(min_length=2, max_length=2, default="IN")
    currency: str = Field(min_length=3, max_length=3, default="INR")


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    company_name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = Field(default=None, max_length=50)
    tax_number: Optional[str] = Field(default=None, max_length=50)
    billing_address_line1: Optional[str] = Field(default=None, min_length=1, max_length=255)
    billing_address_line2: Optional[str] = Field(default=None, max_length=255)
    city: Optional[str] = Field(default=None, min_length=1, max_length=100)
    state: Optional[str] = Field(default=None, min_length=1, max_length=100)
    postal_code: Optional[str] = Field(default=None, min_length=1, max_length=20)
    country: Optional[str] = Field(default=None, min_length=2, max_length=2)
    currency: Optional[str] = Field(default=None, min_length=3, max_length=3)
    is_active: Optional[bool] = None


class CustomerPublic(CustomerBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    is_active: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime


class CustomerUserCreate(BaseModel):
    user_id: uuid.UUID
    membership_role: str = Field(
        default="VIEWER",
        pattern="^(OWNER|BILLING_ADMIN|TECHNICAL_CONTACT|VIEWER)$"
    )
    is_primary: bool = False


class CustomerUserUpdate(BaseModel):
    membership_role: Optional[str] = Field(
        default=None,
        pattern="^(OWNER|BILLING_ADMIN|TECHNICAL_CONTACT|VIEWER)$"
    )
    is_primary: Optional[bool] = None
    status: Optional[str] = Field(
        default=None,
        pattern="^(ACTIVE|INVITED|SUSPENDED)$"
    )


class CustomerUserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    customer_id: uuid.UUID
    user_id: uuid.UUID
    membership_role: str
    is_primary: bool
    status: str
    created_at: datetime.datetime
    updated_at: datetime.datetime
    user: Optional[UserPublic] = None
