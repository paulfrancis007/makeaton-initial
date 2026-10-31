import uuid
from sqlalchemy import (
    Boolean,
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
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subscription_number = Column(String(50), nullable=False, unique=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False)
    quotation_id = Column(UUID(as_uuid=True), nullable=True)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("plans.id", ondelete="RESTRICT"), nullable=False)
    status = Column(String(20), nullable=False, default="CONFIRMED")
    start_date = Column(Date, nullable=False)
    expiry_date = Column(Date, nullable=True)
    current_period_start = Column(Date, nullable=False)
    current_period_end = Column(Date, nullable=False)
    next_billing_date = Column(Date, nullable=False)
    billing_anchor_day = Column(Integer, nullable=False)
    billing_interval_snapshot = Column(String(20), nullable=False)
    interval_count_snapshot = Column(Integer, nullable=False, default=1)
    allow_pause_snapshot = Column(Boolean, nullable=False, default=True)
    allow_early_closure_snapshot = Column(Boolean, nullable=False, default=True)
    auto_renew_snapshot = Column(Boolean, nullable=False, default=True)
    auto_close_snapshot = Column(Boolean, nullable=False, default=False)
    plan_name_snapshot = Column(String(150), nullable=False)
    plan_price_snapshot = Column(Numeric(12, 4), nullable=False, default=0)
    recurring_subtotal = Column(Numeric(12, 2), nullable=False, default=0.00)
    recurring_discount = Column(Numeric(12, 2), nullable=False, default=0.00)
    recurring_tax = Column(Numeric(12, 2), nullable=False, default=0.00)
    recurring_total_amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(3), nullable=False, default="INR")
    payment_terms_days = Column(Integer, nullable=False, default=15)
    created_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("id", "customer_id", name="uq_subscription_customer"),
        ForeignKeyConstraint(
            ["quotation_id", "customer_id"],
            ["quotations.id", "quotations.customer_id"],
            ondelete="RESTRICT",
            name="fk_subscription_quotation_cust",
        ),
        CheckConstraint(
            "status IN ('DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'PAUSED', 'EXPIRED', 'CLOSED')",
            name="chk_subscriptions_status",
        ),
        CheckConstraint("billing_anchor_day BETWEEN 1 AND 31", name="chk_subscriptions_billing_anchor_day"),
        CheckConstraint("interval_count_snapshot > 0", name="chk_subscriptions_interval_count"),
        CheckConstraint("plan_price_snapshot >= 0", name="chk_subscriptions_plan_price"),
        CheckConstraint("recurring_subtotal >= 0", name="chk_subscriptions_rec_subtotal"),
        CheckConstraint("recurring_discount >= 0", name="chk_subscriptions_rec_discount"),
        CheckConstraint("recurring_tax >= 0", name="chk_subscriptions_rec_tax"),
        CheckConstraint("recurring_total_amount >= 0", name="chk_subscriptions_rec_total"),
        CheckConstraint("payment_terms_days >= 0", name="chk_subscriptions_payment_terms"),
        CheckConstraint("expiry_date IS NULL OR expiry_date >= start_date", name="chk_subscriptions_expiry"),
        CheckConstraint("current_period_end > current_period_start", name="chk_subscriptions_period"),
        Index(
            "uq_subscription_quotation",
            "quotation_id",
            unique=True,
            postgresql_where=text("quotation_id IS NOT NULL"),
        ),
        Index("idx_subscriptions_status_billing", "status", "next_billing_date"),
    )

    customer = relationship("Customer", back_populates="subscriptions")
    quotation = relationship("Quotation", back_populates="subscription", overlaps="customer,subscriptions")
    plan = relationship("Plan", back_populates="subscriptions")
    created_by_user = relationship("User")
    lines = relationship("SubscriptionLine", back_populates="subscription", cascade="all, delete-orphan")
    pause_history = relationship("SubscriptionPauseHistory", back_populates="subscription", cascade="all, delete-orphan")
    invoices = relationship("Invoice", back_populates="subscription", overlaps="customer,invoices")
    discount_redemptions = relationship("DiscountRedemption", back_populates="subscription", overlaps="customer,discount_redemptions,invoice,quotation")


class SubscriptionLine(Base):
    __tablename__ = "subscription_lines"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subscription_id = Column(UUID(as_uuid=True), ForeignKey("subscriptions.id", ondelete="RESTRICT"), nullable=False)
    line_type = Column(String(20), nullable=False, default="PRODUCT")
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="RESTRICT"), nullable=True)
    variant_id = Column(UUID(as_uuid=True), nullable=True)
    description_snapshot = Column(String(200), nullable=False)
    unit_price_snapshot = Column(Numeric(12, 4), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    tax_rate_snapshot = Column(Numeric(6, 4), nullable=False, default=0)
    line_total = Column(Numeric(12, 4), nullable=False)

    __table_args__ = (
        CheckConstraint("line_type IN ('PLAN_FEE', 'PRODUCT')", name="chk_sub_lines_type"),
        CheckConstraint("unit_price_snapshot >= 0", name="chk_sub_lines_unit_price"),
        CheckConstraint("quantity > 0", name="chk_sub_lines_qty"),
        CheckConstraint("tax_rate_snapshot >= 0", name="chk_sub_lines_tax_rate"),
        CheckConstraint("line_total >= 0", name="chk_sub_lines_total"),
        CheckConstraint(
            "((line_type = 'PLAN_FEE' AND product_id IS NULL AND variant_id IS NULL) OR (line_type = 'PRODUCT' AND product_id IS NOT NULL))",
            name="chk_sub_lines_prod_variant",
        ),
        ForeignKeyConstraint(
            ["variant_id", "product_id"],
            ["product_variants.id", "product_variants.product_id"],
            ondelete="RESTRICT",
            name="fk_sub_line_variant_prod",
        ),
        Index(
            "uq_sub_single_plan_fee",
            "subscription_id",
            unique=True,
            postgresql_where=text("line_type = 'PLAN_FEE'"),
        ),
    )

    subscription = relationship("Subscription", back_populates="lines")
    product = relationship("Product")
    variant = relationship("ProductVariant", overlaps="product")
    taxes = relationship("SubscriptionLineTax", back_populates="subscription_line", cascade="all, delete-orphan")


class SubscriptionLineTax(Base):
    __tablename__ = "subscription_line_taxes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subscription_line_id = Column(UUID(as_uuid=True), ForeignKey("subscription_lines.id", ondelete="RESTRICT"), nullable=False)
    tax_rule_id = Column(UUID(as_uuid=True), ForeignKey("tax_rules.id", ondelete="SET NULL"), nullable=True)
    tax_name_snapshot = Column(String(100), nullable=False)
    tax_rate_snapshot = Column(Numeric(6, 4), nullable=False)
    tax_amount = Column(Numeric(12, 4), nullable=False)

    __table_args__ = (
        CheckConstraint("tax_rate_snapshot >= 0", name="chk_sub_line_tax_rate"),
        CheckConstraint("tax_amount >= 0", name="chk_sub_line_tax_amt"),
    )

    subscription_line = relationship("SubscriptionLine", back_populates="taxes")
    tax_rule = relationship("TaxRule")


class SubscriptionPauseHistory(Base):
    __tablename__ = "subscription_pause_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subscription_id = Column(UUID(as_uuid=True), ForeignKey("subscriptions.id", ondelete="CASCADE"), nullable=False)
    paused_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    resumed_at = Column(DateTime(timezone=True), nullable=True)
    pause_reason = Column(Text, nullable=True)
    days_extended = Column(Integer, nullable=False, default=0)
    initiated_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)

    __table_args__ = (
        CheckConstraint("days_extended >= 0", name="chk_sub_pause_days"),
        CheckConstraint("resumed_at IS NULL OR resumed_at >= paused_at", name="chk_sub_pause_dates"),
        Index(
            "idx_sub_pause_single_open",
            "subscription_id",
            unique=True,
            postgresql_where=text("resumed_at IS NULL"),
        ),
    )

    subscription = relationship("Subscription", back_populates="pause_history")
    initiated_by_user = relationship("User")
