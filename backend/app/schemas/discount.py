import datetime
import uuid
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class DiscountRuleBase(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=150)
    discount_type: str = Field(pattern="^(PERCENTAGE|FIXED_AMOUNT)$")
    discount_value: Decimal = Field(gt=Decimal("0.0000"), max_digits=12, decimal_places=4)
    scope: str = Field(default="ORDER", pattern="^(ORDER|PRODUCT_SELECTION)$")
    application_frequency: str = Field(
        default="FIRST_INVOICE_ONLY",
        pattern="^(FIRST_INVOICE_ONLY|RECURRING_ALL_CYCLES|FINITE_CYCLES)$",
    )
    max_cycles: Optional[int] = Field(default=None, ge=1)
    minimum_purchase_amount: Decimal = Field(
        default=Decimal("0.0000"), ge=Decimal("0.0000"), max_digits=12, decimal_places=4
    )
    minimum_quantity: int = Field(default=1, ge=1)
    valid_from: Optional[datetime.datetime] = None
    valid_until: Optional[datetime.datetime] = None
    max_uses: Optional[int] = Field(default=None, ge=1)
    is_active: bool = True

    @field_validator("code")
    @classmethod
    def force_uppercase_code(cls, v: str) -> str:
        return v.strip().upper()

    @model_validator(mode="after")
    def validate_discount_invariants(self) -> "DiscountRuleBase":
        if self.discount_type == "PERCENTAGE" and self.discount_value > Decimal("100.0000"):
            raise ValueError("Percentage discount value cannot exceed 100%.")
        if self.valid_from and self.valid_until and self.valid_until < self.valid_from:
            raise ValueError("valid_until must be on or after valid_from.")
        if self.application_frequency == "FINITE_CYCLES" and (self.max_cycles is None or self.max_cycles < 1):
            raise ValueError("max_cycles must be specified and >= 1 when application_frequency is FINITE_CYCLES.")
        return self


class DiscountRuleCreate(DiscountRuleBase):
    eligible_product_ids: Optional[List[uuid.UUID]] = None


class DiscountRuleUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    discount_type: Optional[str] = Field(default=None, pattern="^(PERCENTAGE|FIXED_AMOUNT)$")
    discount_value: Optional[Decimal] = Field(default=None, gt=Decimal("0.0000"), max_digits=12, decimal_places=4)
    scope: Optional[str] = Field(default=None, pattern="^(ORDER|PRODUCT_SELECTION)$")
    application_frequency: Optional[str] = Field(
        default=None,
        pattern="^(FIRST_INVOICE_ONLY|RECURRING_ALL_CYCLES|FINITE_CYCLES)$",
    )
    max_cycles: Optional[int] = Field(default=None, ge=1)
    minimum_purchase_amount: Optional[Decimal] = Field(
        default=None, ge=Decimal("0.0000"), max_digits=12, decimal_places=4
    )
    minimum_quantity: Optional[int] = Field(default=None, ge=1)
    valid_from: Optional[datetime.datetime] = None
    valid_until: Optional[datetime.datetime] = None
    max_uses: Optional[int] = Field(default=None, ge=1)
    is_active: Optional[bool] = None
    eligible_product_ids: Optional[List[uuid.UUID]] = None

    @model_validator(mode="after")
    def validate_discount_update_invariants(self) -> "DiscountRuleUpdate":
        if self.discount_type == "PERCENTAGE" and self.discount_value and self.discount_value > Decimal("100.0000"):
            raise ValueError("Percentage discount value cannot exceed 100%.")
        if self.valid_from and self.valid_until and self.valid_until < self.valid_from:
            raise ValueError("valid_until must be on or after valid_from.")
        return self


class DiscountRulePublic(DiscountRuleBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    current_uses: int
    created_at: datetime.datetime
    updated_at: datetime.datetime
    eligible_product_ids: List[uuid.UUID] = []


# ---------------------------------------------------------
# Discount Evaluation Schemas
# ---------------------------------------------------------

class DiscountItemInput(BaseModel):
    product_id: uuid.UUID
    quantity: int = Field(ge=1)
    unit_price: Decimal = Field(ge=Decimal("0.0000"), max_digits=12, decimal_places=4)


class DiscountEvaluationRequest(BaseModel):
    code: str = Field(min_length=1, max_length=50)
    order_subtotal: Decimal = Field(ge=Decimal("0.0000"), max_digits=12, decimal_places=4)
    items: List[DiscountItemInput] = []
    cycle_number: int = Field(default=1, ge=1)
    customer_id: Optional[uuid.UUID] = None

    @field_validator("code")
    @classmethod
    def force_uppercase_code(cls, v: str) -> str:
        return v.strip().upper()


class DiscountEvaluationResponse(BaseModel):
    is_eligible: bool
    rejection_reason: Optional[str] = None
    discount_code: str
    discount_type: Optional[str] = None
    discount_value: Optional[Decimal] = None
    discount_amount: Decimal = Decimal("0.0000")
    qualifying_subtotal: Decimal = Decimal("0.0000")
    rule_name: Optional[str] = None
    rule_id: Optional[uuid.UUID] = None
