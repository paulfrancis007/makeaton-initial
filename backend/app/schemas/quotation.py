import datetime
from decimal import Decimal
from typing import List, Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field, model_validator


# ---------------------------------------------------------
# Quotation Template Schemas
# ---------------------------------------------------------

class QuotationTemplateLineCreate(BaseModel):
    product_id: uuid.UUID
    variant_id: Optional[uuid.UUID] = None
    quantity: int = Field(default=1, ge=1)
    unit_price_override: Optional[Decimal] = Field(default=None, ge=Decimal("0.0000"), max_digits=12, decimal_places=4)


class QuotationTemplateLinePublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    template_id: uuid.UUID
    product_id: uuid.UUID
    variant_id: Optional[uuid.UUID] = None
    quantity: int
    unit_price_override: Optional[Decimal] = None


class QuotationTemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    description: Optional[str] = None
    plan_id: uuid.UUID
    validity_duration_days: int = Field(default=30, gt=0)
    is_active: bool = True
    lines: List[QuotationTemplateLineCreate] = []


class QuotationTemplateUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    description: Optional[str] = None
    plan_id: Optional[uuid.UUID] = None
    validity_duration_days: Optional[int] = Field(default=None, gt=0)
    is_active: Optional[bool] = None
    lines: Optional[List[QuotationTemplateLineCreate]] = None


class QuotationTemplatePublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: Optional[str] = None
    plan_id: uuid.UUID
    validity_duration_days: int
    is_active: bool
    created_at: datetime.datetime
    updated_at: datetime.datetime
    lines: List[QuotationTemplateLinePublic] = []


# ---------------------------------------------------------
# Quotation Line & Tax Schemas
# ---------------------------------------------------------

class QuotationLineTaxPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    quotation_line_id: uuid.UUID
    tax_rule_id: Optional[uuid.UUID] = None
    tax_name_snapshot: str
    tax_rate_snapshot: Decimal
    tax_amount: Decimal


class QuotationLineCreate(BaseModel):
    line_type: str = Field(default="PRODUCT", pattern="^(PLAN_FEE|PRODUCT)$")
    product_id: Optional[uuid.UUID] = None
    variant_id: Optional[uuid.UUID] = None
    description_snapshot: Optional[str] = None
    unit_price: Optional[Decimal] = Field(default=None, ge=Decimal("0.0000"), max_digits=12, decimal_places=4)
    quantity: int = Field(default=1, ge=1)
    discount_amount: Decimal = Field(default=Decimal("0.0000"), ge=Decimal("0.0000"), max_digits=12, decimal_places=4)

    @model_validator(mode="after")
    def validate_line_invariants(self) -> "QuotationLineCreate":
        if self.line_type == "PLAN_FEE":
            if self.product_id is not None or self.variant_id is not None:
                raise ValueError("PLAN_FEE line must have NULL product_id and variant_id.")
        elif self.line_type == "PRODUCT":
            if self.product_id is None:
                raise ValueError("PRODUCT line requires a valid product_id.")
        return self


class QuotationLinePublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    quotation_id: uuid.UUID
    line_type: str
    product_id: Optional[uuid.UUID] = None
    variant_id: Optional[uuid.UUID] = None
    description_snapshot: str
    unit_price: Decimal
    quantity: int
    tax_rate_snapshot: Decimal
    tax_amount: Decimal
    discount_amount: Decimal
    line_total: Decimal
    taxes: List[QuotationLineTaxPublic] = []


# ---------------------------------------------------------
# Quotation Header Schemas
# ---------------------------------------------------------

class QuotationCreate(BaseModel):
    customer_id: uuid.UUID
    plan_id: uuid.UUID
    template_id: Optional[uuid.UUID] = None
    issue_date: Optional[datetime.date] = None
    expiry_date: Optional[datetime.date] = None
    validity_duration_days: Optional[int] = Field(default=30, gt=0)
    currency: str = Field(default="INR", min_length=3, max_length=3)
    notes: Optional[str] = None
    discount_code: Optional[str] = None
    lines: List[QuotationLineCreate] = []


class QuotationUpdate(BaseModel):
    expiry_date: Optional[datetime.date] = None
    notes: Optional[str] = None
    discount_code: Optional[str] = None
    lines: Optional[List[QuotationLineCreate]] = None


class QuotationStatusUpdate(BaseModel):
    status: str = Field(pattern="^(SENT|CONFIRMED|REJECTED)$")
    rejection_reason: Optional[str] = None


class QuotationPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    quotation_number: str
    customer_id: uuid.UUID
    template_id: Optional[uuid.UUID] = None
    plan_id: uuid.UUID
    status: str
    issue_date: datetime.date
    expiry_date: datetime.date
    plan_price_snapshot: Decimal
    subtotal_amount: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    rounding_adjustment: Decimal
    total_amount: Decimal
    currency: str
    notes: Optional[str] = None
    created_by_user_id: uuid.UUID
    created_at: datetime.datetime
    updated_at: datetime.datetime


class QuotationDetailPublic(QuotationPublic):
    lines: List[QuotationLinePublic] = []
    plan_name: Optional[str] = None
    customer_company_name: Optional[str] = None
