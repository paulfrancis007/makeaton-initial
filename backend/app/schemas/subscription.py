import datetime
from decimal import Decimal
from typing import List, Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field


class SubscriptionLineTaxPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    subscription_line_id: uuid.UUID
    tax_rule_id: Optional[uuid.UUID] = None
    tax_name_snapshot: str
    tax_rate_snapshot: Decimal
    tax_amount: Decimal


class SubscriptionLinePublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    subscription_id: uuid.UUID
    line_type: str
    product_id: Optional[uuid.UUID] = None
    variant_id: Optional[uuid.UUID] = None
    description_snapshot: str
    unit_price_snapshot: Decimal
    quantity: int
    tax_rate_snapshot: Decimal
    line_total: Decimal
    taxes: List[SubscriptionLineTaxPublic] = []


class SubscriptionPauseHistoryPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    subscription_id: uuid.UUID
    paused_at: datetime.datetime
    resumed_at: Optional[datetime.datetime] = None
    pause_reason: Optional[str] = None
    days_extended: int
    initiated_by_user_id: uuid.UUID


class SubscriptionPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    subscription_number: str
    customer_id: uuid.UUID
    quotation_id: Optional[uuid.UUID] = None
    plan_id: uuid.UUID
    status: str
    start_date: datetime.date
    expiry_date: Optional[datetime.date] = None
    current_period_start: datetime.date
    current_period_end: datetime.date
    next_billing_date: datetime.date
    billing_anchor_day: int
    billing_interval_snapshot: str
    interval_count_snapshot: int
    allow_pause_snapshot: bool
    allow_early_closure_snapshot: bool
    auto_renew_snapshot: bool
    auto_close_snapshot: bool
    plan_name_snapshot: str
    plan_price_snapshot: Decimal
    recurring_subtotal: Decimal
    recurring_discount: Decimal
    recurring_tax: Decimal
    recurring_total_amount: Decimal
    currency: str
    payment_terms_days: int
    created_by_user_id: uuid.UUID
    created_at: datetime.datetime
    updated_at: datetime.datetime


class SubscriptionDetailPublic(SubscriptionPublic):
    lines: List[SubscriptionLinePublic] = []
    pause_history: List[SubscriptionPauseHistoryPublic] = []
    customer_company_name: Optional[str] = None


class ConvertQuotationRequest(BaseModel):
    start_date: Optional[datetime.date] = None
    payment_terms_days: Optional[int] = Field(default=15, ge=0)


class PauseSubscriptionRequest(BaseModel):
    reason: Optional[str] = None


class ResumeSubscriptionRequest(BaseModel):
    pass


class CloseSubscriptionRequest(BaseModel):
    reason: Optional[str] = None
