import uuid
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    String,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class DiscountRule(Base):
    __tablename__ = "discount_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(50), nullable=False, unique=True)
    name = Column(String(150), nullable=False)
    discount_type = Column(String(20), nullable=False)
    discount_value = Column(Numeric(12, 4), nullable=False)
    scope = Column(String(20), nullable=False, default="ORDER")
    application_frequency = Column(String(30), nullable=False, default="FIRST_INVOICE_ONLY")
    max_cycles = Column(Integer, nullable=True)
    minimum_purchase_amount = Column(Numeric(12, 4), nullable=False, default=0)
    minimum_quantity = Column(Integer, nullable=False, default=1)
    valid_from = Column(DateTime(timezone=True), nullable=True)
    valid_until = Column(DateTime(timezone=True), nullable=True)
    max_uses = Column(Integer, nullable=True)
    current_uses = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("code = upper(code)", name="chk_discount_rules_code_upper"),
        CheckConstraint("discount_type IN ('PERCENTAGE', 'FIXED_AMOUNT')", name="chk_discount_rules_type"),
        CheckConstraint("discount_value > 0", name="chk_discount_rules_value"),
        CheckConstraint("scope IN ('ORDER', 'PRODUCT_SELECTION')", name="chk_discount_rules_scope"),
        CheckConstraint(
            "application_frequency IN ('FIRST_INVOICE_ONLY', 'RECURRING_ALL_CYCLES', 'FINITE_CYCLES')",
            name="chk_discount_rules_app_freq",
        ),
        CheckConstraint("max_cycles IS NULL OR max_cycles > 0", name="chk_discount_rules_max_cycles"),
        CheckConstraint("minimum_purchase_amount >= 0", name="chk_discount_rules_min_purchase"),
        CheckConstraint("minimum_quantity >= 1", name="chk_discount_rules_min_qty"),
        CheckConstraint("max_uses IS NULL OR max_uses > 0", name="chk_discount_rules_max_uses"),
        CheckConstraint("current_uses >= 0", name="chk_discount_rules_curr_uses"),
        CheckConstraint("max_uses IS NULL OR current_uses <= max_uses", name="chk_discount_rules_uses_limit"),
    )

    products = relationship("DiscountRuleProduct", back_populates="discount_rule", cascade="all, delete-orphan")
    redemptions = relationship("DiscountRedemption", back_populates="discount_rule")


class DiscountRuleProduct(Base):
    __tablename__ = "discount_rule_products"

    discount_rule_id = Column(UUID(as_uuid=True), ForeignKey("discount_rules.id", ondelete="CASCADE"), primary_key=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), primary_key=True)

    discount_rule = relationship("DiscountRule", back_populates="products")
    product = relationship("Product", back_populates="discount_rules")


class DiscountRedemption(Base):
    __tablename__ = "discount_redemptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    discount_rule_id = Column(UUID(as_uuid=True), ForeignKey("discount_rules.id", ondelete="RESTRICT"), nullable=False)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False)
    subscription_id = Column(UUID(as_uuid=True), nullable=True)
    invoice_id = Column(UUID(as_uuid=True), nullable=True)
    quotation_id = Column(UUID(as_uuid=True), nullable=True)
    amount_discounted = Column(Numeric(12, 4), nullable=False)
    cycle_number = Column(Integer, nullable=False, default=1)
    redeemed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("amount_discounted > 0", name="chk_discount_redemptions_amount"),
        CheckConstraint("cycle_number > 0", name="chk_discount_redemptions_cycle"),
        CheckConstraint(
            "(invoice_id IS NOT NULL AND quotation_id IS NULL) OR (invoice_id IS NULL AND quotation_id IS NOT NULL)",
            name="chk_discount_redemptions_xor_doc",
        ),
        ForeignKeyConstraint(
            ["invoice_id", "customer_id"],
            ["invoices.id", "invoices.customer_id"],
            ondelete="RESTRICT",
            name="fk_discount_redemption_invoice_cust",
        ),
        ForeignKeyConstraint(
            ["quotation_id", "customer_id"],
            ["quotations.id", "quotations.customer_id"],
            ondelete="RESTRICT",
            name="fk_discount_redemption_quotation_cust",
        ),
        ForeignKeyConstraint(
            ["subscription_id", "customer_id"],
            ["subscriptions.id", "subscriptions.customer_id"],
            ondelete="RESTRICT",
            name="fk_discount_redemption_sub_cust",
        ),
        Index(
            "idx_discount_redemption_invoice",
            "discount_rule_id",
            "invoice_id",
            unique=True,
            postgresql_where=text("invoice_id IS NOT NULL"),
        ),
        Index(
            "idx_discount_redemption_quotation",
            "discount_rule_id",
            "quotation_id",
            unique=True,
            postgresql_where=text("quotation_id IS NOT NULL"),
        ),
        Index(
            "idx_discount_redemption_sub_cycle",
            "discount_rule_id",
            "subscription_id",
            "cycle_number",
            unique=True,
            postgresql_where=text("subscription_id IS NOT NULL"),
        ),
    )

    discount_rule = relationship("DiscountRule", back_populates="redemptions")
    customer = relationship("Customer", back_populates="discount_redemptions", overlaps="subscription,invoice,quotation")
    subscription = relationship("Subscription", back_populates="discount_redemptions", overlaps="customer,discount_redemptions,invoice,quotation")
    invoice = relationship("Invoice", back_populates="discount_redemptions", overlaps="customer,discount_redemptions,subscription,quotation")
    quotation = relationship("Quotation", back_populates="discount_redemptions", overlaps="customer,discount_redemptions,subscription,invoice")
