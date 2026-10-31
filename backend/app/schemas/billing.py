import datetime
from decimal import Decimal
from typing import Any, Dict, List, Literal, Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field


class InvoiceLineTaxResponse(BaseModel):
    id: uuid.UUID
    invoice_line_id: uuid.UUID
    tax_rule_id: Optional[uuid.UUID] = None
    tax_name_snapshot: str
    tax_rate_snapshot: Decimal
    tax_amount: Decimal

    model_config = ConfigDict(from_attributes=True)


class InvoiceLineResponse(BaseModel):
    id: uuid.UUID
    invoice_id: uuid.UUID
    line_type: str
    product_id: Optional[uuid.UUID] = None
    variant_id: Optional[uuid.UUID] = None
    description: str
    quantity: int
    unit_price: Decimal
    tax_rate: Decimal
    tax_amount: Decimal
    discount_amount: Decimal
    line_total: Decimal
    taxes: List[InvoiceLineTaxResponse] = []

    model_config = ConfigDict(from_attributes=True)


class PaymentResponse(BaseModel):
    id: uuid.UUID
    payment_number: str
    invoice_id: uuid.UUID
    customer_id: uuid.UUID
    customer_name: Optional[str] = None
    invoice_number: Optional[str] = None
    amount: Decimal
    payment_method: str
    status: str
    payment_date: datetime.datetime
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    voided_at: Optional[datetime.datetime] = None
    voided_by_user_id: Optional[uuid.UUID] = None
    void_reason: Optional[str] = None
    recorded_by_user_id: uuid.UUID
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class InvoiceResponse(BaseModel):
    id: uuid.UUID
    invoice_number: str
    subscription_id: uuid.UUID
    customer_id: uuid.UUID
    customer_name: Optional[str] = None
    subscription_number: Optional[str] = None
    status: str
    issue_date: datetime.date
    due_date: datetime.date
    billing_period_start: datetime.date
    billing_period_end: datetime.date
    subtotal_amount: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    rounding_adjustment: Decimal
    total_amount: Decimal
    amount_paid: Decimal
    balance_due: Decimal
    currency: str
    notes: Optional[str] = None
    is_overdue: bool = False
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)


class InvoiceDetailResponse(InvoiceResponse):
    lines: List[InvoiceLineResponse] = []
    payments: List[PaymentResponse] = []

    model_config = ConfigDict(from_attributes=True)


class RunBillingRequest(BaseModel):
    billing_date: Optional[datetime.date] = None
    batch_size: int = Field(default=100, ge=1, le=1000)


class BillingRunResult(BaseModel):
    billing_date: datetime.date
    subscriptions_evaluated: int
    invoices_created: int
    invoices_skipped: int
    failures: int
    created_invoices: List[Dict[str, Any]] = []
    errors: List[Dict[str, Any]] = []


class PaymentCreateRequest(BaseModel):
    invoice_id: uuid.UUID
    amount: Decimal = Field(..., gt=0, decimal_places=2)
    payment_method: Literal["CASH", "BANK_TRANSFER", "UPI", "CARD", "CHEQUE", "OTHER"]
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    payment_date: Optional[datetime.datetime] = None


class PaymentVoidRequest(BaseModel):
    void_reason: str = Field(..., min_length=3, max_length=500)
