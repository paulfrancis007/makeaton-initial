import datetime
import uuid
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator


# ---------------------------------------------------------
# Product Schemas
# ---------------------------------------------------------

class ProductBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    product_type: str = Field(default="SERVICE", pattern="^(SERVICE|SOFTWARE|ADDON)$")
    description: Optional[str] = None
    base_sales_price: Decimal = Field(ge=Decimal("0.0000"), max_digits=12, decimal_places=4)
    cost_price: Decimal = Field(default=Decimal("0.0000"), ge=Decimal("0.0000"), max_digits=12, decimal_places=4)
    is_active: bool = True


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    product_type: Optional[str] = Field(default=None, pattern="^(SERVICE|SOFTWARE|ADDON)$")
    description: Optional[str] = None
    base_sales_price: Optional[Decimal] = Field(default=None, ge=Decimal("0.0000"), max_digits=12, decimal_places=4)
    cost_price: Optional[Decimal] = Field(default=None, ge=Decimal("0.0000"), max_digits=12, decimal_places=4)
    is_active: Optional[bool] = None


class ProductPublic(ProductBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime.datetime
    updated_at: datetime.datetime


# ---------------------------------------------------------
# Product Variant Schemas
# ---------------------------------------------------------

class ProductVariantBase(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    price_adjustment: Decimal = Field(default=Decimal("0.0000"), max_digits=12, decimal_places=4)
    sku: Optional[str] = Field(default=None, max_length=100)
    is_active: bool = True


class ProductVariantCreate(ProductVariantBase):
    pass


class ProductVariantUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    price_adjustment: Optional[Decimal] = Field(default=None, max_digits=12, decimal_places=4)
    sku: Optional[str] = Field(default=None, max_length=100)
    is_active: Optional[bool] = None


class ProductVariantPublic(ProductVariantBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    product_id: uuid.UUID
    created_at: datetime.datetime
    updated_at: datetime.datetime


# ---------------------------------------------------------
# Subscription Plan Schemas
# ---------------------------------------------------------

class PlanBase(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    description: Optional[str] = None
    billing_interval: str = Field(pattern="^(DAILY|WEEKLY|MONTHLY|YEARLY)$")
    interval_count: int = Field(default=1, ge=1)
    base_price: Decimal = Field(default=Decimal("0.0000"), ge=Decimal("0.0000"), max_digits=12, decimal_places=4)
    minimum_quantity: int = Field(default=1, ge=1)
    availability_start_date: Optional[datetime.date] = None
    availability_end_date: Optional[datetime.date] = None
    auto_renew: bool = True
    auto_close_on_expiry: bool = False
    allow_pause: bool = True
    allow_early_closure: bool = True
    is_active: bool = True

    @model_validator(mode="after")
    def validate_plan_invariants(self) -> "PlanBase":
        # Check constraint: auto_renew = FALSE OR auto_close_on_expiry = FALSE
        if self.auto_renew and self.auto_close_on_expiry:
            raise ValueError("auto_renew and auto_close_on_expiry are mutually exclusive. Both cannot be true.")
        # Check constraint: availability_end_date >= availability_start_date
        if (
            self.availability_start_date is not None
            and self.availability_end_date is not None
            and self.availability_end_date < self.availability_start_date
        ):
            raise ValueError("availability_end_date must be on or after availability_start_date.")
        return self


class PlanCreate(PlanBase):
    pass


class PlanUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    description: Optional[str] = None
    billing_interval: Optional[str] = Field(default=None, pattern="^(DAILY|WEEKLY|MONTHLY|YEARLY)$")
    interval_count: Optional[int] = Field(default=None, ge=1)
    base_price: Optional[Decimal] = Field(default=None, ge=Decimal("0.0000"), max_digits=12, decimal_places=4)
    minimum_quantity: Optional[int] = Field(default=None, ge=1)
    availability_start_date: Optional[datetime.date] = None
    availability_end_date: Optional[datetime.date] = None
    auto_renew: Optional[bool] = None
    auto_close_on_expiry: Optional[bool] = None
    allow_pause: Optional[bool] = None
    allow_early_closure: Optional[bool] = None
    is_active: Optional[bool] = None

    @model_validator(mode="after")
    def validate_update_invariants(self) -> "PlanUpdate":
        if self.auto_renew is True and self.auto_close_on_expiry is True:
            raise ValueError("auto_renew and auto_close_on_expiry are mutually exclusive. Both cannot be true.")
        if (
            self.availability_start_date is not None
            and self.availability_end_date is not None
            and self.availability_end_date < self.availability_start_date
        ):
            raise ValueError("availability_end_date must be on or after availability_start_date.")
        return self


class PlanPublic(PlanBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime.datetime
    updated_at: datetime.datetime


# ---------------------------------------------------------
# Tax Rule Schemas
# ---------------------------------------------------------

class TaxRuleBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    rate: Decimal = Field(ge=Decimal("0.0000"), le=Decimal("100.0000"), max_digits=6, decimal_places=4)
    tax_type: str = Field(default="PERCENTAGE", max_length=50)
    is_compound: bool = False
    jurisdiction_country: str = Field(min_length=2, max_length=2, default="IN")
    jurisdiction_state: str = Field(default="", max_length=100)
    tax_scope: str = Field(
        default="STANDARD",
        pattern="^(STANDARD|INTRASTATE_CGST|INTRASTATE_SGST|INTERSTATE_IGST|VAT|EXEMPT)$",
    )
    valid_from: Optional[datetime.datetime] = None
    valid_until: Optional[datetime.datetime] = None
    is_active: bool = True

    @model_validator(mode="after")
    def validate_tax_dates(self) -> "TaxRuleBase":
        if self.valid_from and self.valid_until and self.valid_until < self.valid_from:
            raise ValueError("valid_until must be on or after valid_from.")
        return self


class TaxRuleCreate(TaxRuleBase):
    pass


class TaxRuleUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    rate: Optional[Decimal] = Field(default=None, ge=Decimal("0.0000"), le=Decimal("100.0000"), max_digits=6, decimal_places=4)
    tax_type: Optional[str] = Field(default=None, max_length=50)
    is_compound: Optional[bool] = None
    jurisdiction_country: Optional[str] = Field(default=None, min_length=2, max_length=2)
    jurisdiction_state: Optional[str] = Field(default=None, max_length=100)
    tax_scope: Optional[str] = Field(
        default=None,
        pattern="^(STANDARD|INTRASTATE_CGST|INTRASTATE_SGST|INTERSTATE_IGST|VAT|EXEMPT)$",
    )
    valid_from: Optional[datetime.datetime] = None
    valid_until: Optional[datetime.datetime] = None
    is_active: Optional[bool] = None

    @model_validator(mode="after")
    def validate_tax_dates(self) -> "TaxRuleUpdate":
        if self.valid_from and self.valid_until and self.valid_until < self.valid_from:
            raise ValueError("valid_until must be on or after valid_from.")
        return self


class TaxRulePublic(TaxRuleBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime.datetime
    updated_at: datetime.datetime


# ---------------------------------------------------------
# Tax Assignment Schemas
# ---------------------------------------------------------

class TaxAssignmentRequest(BaseModel):
    tax_rule_ids: List[uuid.UUID]
