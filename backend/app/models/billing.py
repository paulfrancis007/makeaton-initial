import uuid
from sqlalchemy import (
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ExcludeConstraint, UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_number = Column(String(50), nullable=False, unique=True)
    subscription_id = Column(UUID(as_uuid=True), nullable=False)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False)
    status = Column(String(20), nullable=False, default="CONFIRMED")
    issue_date = Column(Date, server_default=func.current_date(), nullable=False)
    due_date = Column(Date, nullable=False)
    billing_period_start = Column(Date, nullable=False)
    billing_period_end = Column(Date, nullable=False)
    subtotal_amount = Column(Numeric(12, 2), nullable=False)
    discount_amount = Column(Numeric(12, 2), nullable=False, default=0.00)
    tax_amount = Column(Numeric(12, 2), nullable=False, default=0.00)
    rounding_adjustment = Column(Numeric(12, 2), nullable=False, default=0.00)
    total_amount = Column(Numeric(12, 2), nullable=False)
    amount_paid = Column(Numeric(12, 2), nullable=False, default=0.00)
    balance_due = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(3), nullable=False, default="INR")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("id", "customer_id", name="uq_invoice_customer"),
        ForeignKeyConstraint(
            ["subscription_id", "customer_id"],
            ["subscriptions.id", "subscriptions.customer_id"],
            ondelete="RESTRICT",
            name="fk_invoice_subscription_cust",
        ),
        CheckConstraint(
            "status IN ('DRAFT', 'CONFIRMED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED')",
            name="chk_invoices_status",
        ),
        CheckConstraint("billing_period_end > billing_period_start", name="chk_invoices_period"),
        CheckConstraint("due_date >= issue_date", name="chk_invoices_dates"),
        CheckConstraint("subtotal_amount >= 0", name="chk_invoices_subtotal"),
        CheckConstraint("discount_amount >= 0", name="chk_invoices_discount"),
        CheckConstraint("tax_amount >= 0", name="chk_invoices_tax"),
        CheckConstraint("rounding_adjustment BETWEEN -0.02 AND 0.02", name="chk_invoices_rounding"),
        CheckConstraint("total_amount >= 0", name="chk_invoices_total"),
        CheckConstraint("amount_paid >= 0", name="chk_invoices_paid_nonneg"),
        CheckConstraint("balance_due >= 0", name="chk_invoices_balance_nonneg"),
        CheckConstraint("amount_paid <= total_amount", name="chk_invoices_amount_paid_limit"),
        CheckConstraint("balance_due = total_amount - amount_paid", name="chk_invoices_balance_due_calc"),
        CheckConstraint(
            "total_amount = subtotal_amount - discount_amount + tax_amount + rounding_adjustment",
            name="chk_invoices_total_calc",
        ),
        ExcludeConstraint(
            (text("subscription_id"), "="),
            (text("daterange(billing_period_start, billing_period_end, '[)')"), "&&"),
            name="excl_invoice_no_overlapping_periods",
            using="gist",
            where=text("status != 'CANCELLED'"),
        ),
    )

    subscription = relationship("Subscription", back_populates="invoices", overlaps="customer,invoices")
    customer = relationship("Customer", back_populates="invoices", overlaps="subscription")
    lines = relationship("InvoiceLine", back_populates="invoice", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="invoice", overlaps="customer,payments")
    discount_redemptions = relationship("DiscountRedemption", back_populates="invoice", overlaps="customer,discount_redemptions,subscription,quotation")


class InvoiceLine(Base):
    __tablename__ = "invoice_lines"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="RESTRICT"), nullable=False)
    line_type = Column(String(20), nullable=False, default="PRODUCT")
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="RESTRICT"), nullable=True)
    variant_id = Column(UUID(as_uuid=True), nullable=True)
    description = Column(String(255), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    unit_price = Column(Numeric(12, 4), nullable=False)
    tax_rate = Column(Numeric(6, 4), nullable=False, default=0)
    tax_amount = Column(Numeric(12, 4), nullable=False, default=0)
    discount_amount = Column(Numeric(12, 4), nullable=False, default=0)
    line_total = Column(Numeric(12, 4), nullable=False)

    __table_args__ = (
        CheckConstraint("line_type IN ('PLAN_FEE', 'PRODUCT')", name="chk_invoice_lines_type"),
        CheckConstraint("quantity > 0", name="chk_invoice_lines_qty"),
        CheckConstraint("unit_price >= 0", name="chk_invoice_lines_unit_price"),
        CheckConstraint("tax_rate >= 0", name="chk_invoice_lines_tax_rate"),
        CheckConstraint("tax_amount >= 0", name="chk_invoice_lines_tax_amt"),
        CheckConstraint("discount_amount >= 0", name="chk_invoice_lines_disc_amt"),
        CheckConstraint("line_total >= 0", name="chk_invoice_lines_total"),
        CheckConstraint(
            "((line_type = 'PLAN_FEE' AND product_id IS NULL AND variant_id IS NULL) OR (line_type = 'PRODUCT' AND product_id IS NOT NULL))",
            name="chk_invoice_lines_prod_variant",
        ),
        ForeignKeyConstraint(
            ["variant_id", "product_id"],
            ["product_variants.id", "product_variants.product_id"],
            ondelete="RESTRICT",
            name="fk_invoice_line_variant_prod",
        ),
        Index(
            "uq_inv_single_plan_fee",
            "invoice_id",
            unique=True,
            postgresql_where=text("line_type = 'PLAN_FEE'"),
        ),
    )

    invoice = relationship("Invoice", back_populates="lines")
    product = relationship("Product")
    variant = relationship("ProductVariant", overlaps="product")
    taxes = relationship("InvoiceLineTax", back_populates="invoice_line", cascade="all, delete-orphan")


class InvoiceLineTax(Base):
    __tablename__ = "invoice_line_taxes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_line_id = Column(UUID(as_uuid=True), ForeignKey("invoice_lines.id", ondelete="RESTRICT"), nullable=False)
    tax_rule_id = Column(UUID(as_uuid=True), ForeignKey("tax_rules.id", ondelete="SET NULL"), nullable=True)
    tax_name_snapshot = Column(String(100), nullable=False)
    tax_rate_snapshot = Column(Numeric(6, 4), nullable=False)
    tax_amount = Column(Numeric(12, 4), nullable=False)

    __table_args__ = (
        CheckConstraint("tax_rate_snapshot >= 0", name="chk_inv_line_tax_rate"),
        CheckConstraint("tax_amount >= 0", name="chk_inv_line_tax_amt"),
    )

    invoice_line = relationship("InvoiceLine", back_populates="taxes")
    tax_rule = relationship("TaxRule")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payment_number = Column(String(50), nullable=False, unique=True)
    invoice_id = Column(UUID(as_uuid=True), nullable=False)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    payment_method = Column(String(30), nullable=False)
    status = Column(String(20), nullable=False, default="SUCCESS")
    payment_date = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    reference_number = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    voided_at = Column(DateTime(timezone=True), nullable=True)
    voided_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=True)
    void_reason = Column(Text, nullable=True)
    recorded_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        ForeignKeyConstraint(
            ["invoice_id", "customer_id"],
            ["invoices.id", "invoices.customer_id"],
            ondelete="RESTRICT",
            name="fk_payment_invoice_cust",
        ),
        CheckConstraint("amount > 0", name="chk_payments_amount"),
        CheckConstraint(
            "payment_method IN ('CASH', 'BANK_TRANSFER', 'UPI', 'CARD', 'CHEQUE', 'OTHER')",
            name="chk_payments_method",
        ),
        CheckConstraint("status IN ('SUCCESS', 'VOIDED')", name="chk_payments_status"),
        CheckConstraint(
            "((status = 'SUCCESS' AND voided_at IS NULL AND voided_by_user_id IS NULL AND void_reason IS NULL) "
            "OR (status = 'VOIDED' AND voided_at IS NOT NULL AND voided_by_user_id IS NOT NULL AND void_reason IS NOT NULL))",
            name="chk_payments_void_state",
        ),
    )

    invoice = relationship("Invoice", back_populates="payments", overlaps="customer,payments")
    customer = relationship("Customer", back_populates="payments", overlaps="invoice,payments")
    recorded_by_user = relationship("User", foreign_keys=[recorded_by_user_id])
    voided_by_user = relationship("User", foreign_keys=[voided_by_user_id])
