import uuid
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
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


class Product(Base):
    __tablename__ = "products"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False)
    product_type = Column(String(50), nullable=False, default="SERVICE")
    description = Column(Text, nullable=True)
    base_sales_price = Column(Numeric(12, 4), nullable=False)
    cost_price = Column(Numeric(12, 4), nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("product_type IN ('SERVICE', 'SOFTWARE', 'ADDON')", name="chk_products_product_type"),
        CheckConstraint("base_sales_price >= 0", name="chk_products_base_sales_price"),
        CheckConstraint("cost_price >= 0", name="chk_products_cost_price"),
    )

    variants = relationship("ProductVariant", back_populates="product", cascade="all, delete-orphan")
    taxes = relationship("ProductTax", back_populates="product", cascade="all, delete-orphan")
    discount_rules = relationship("DiscountRuleProduct", back_populates="product", cascade="all, delete-orphan")


class ProductVariant(Base):
    __tablename__ = "product_variants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    name = Column(String(150), nullable=False)
    price_adjustment = Column(Numeric(12, 4), nullable=False, default=0)
    sku = Column(String(100), nullable=True, unique=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("id", "product_id", name="uq_product_variant_pair"),
    )

    product = relationship("Product", back_populates="variants")


class Plan(Base):
    __tablename__ = "plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(150), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    billing_interval = Column(String(20), nullable=False)
    interval_count = Column(Integer, nullable=False, default=1)
    base_price = Column(Numeric(12, 4), nullable=False, default=0)
    minimum_quantity = Column(Integer, nullable=False, default=1)
    availability_start_date = Column(Date, nullable=True)
    availability_end_date = Column(Date, nullable=True)
    auto_renew = Column(Boolean, nullable=False, default=True)
    auto_close_on_expiry = Column(Boolean, nullable=False, default=False)
    allow_pause = Column(Boolean, nullable=False, default=True)
    allow_early_closure = Column(Boolean, nullable=False, default=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("billing_interval IN ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY')", name="chk_plans_billing_interval"),
        CheckConstraint("interval_count > 0", name="chk_plans_interval_count"),
        CheckConstraint("base_price >= 0", name="chk_plans_base_price"),
        CheckConstraint("minimum_quantity >= 1", name="chk_plans_minimum_quantity"),
        CheckConstraint("availability_end_date IS NULL OR availability_start_date IS NULL OR availability_end_date >= availability_start_date", name="chk_plans_dates"),
        CheckConstraint("auto_renew = FALSE OR auto_close_on_expiry = FALSE", name="chk_plans_renew_close_excl"),
    )

    taxes = relationship("PlanTax", back_populates="plan", cascade="all, delete-orphan")
    quotations = relationship("Quotation", back_populates="plan")
    subscriptions = relationship("Subscription", back_populates="plan")
    quotation_templates = relationship("QuotationTemplate", back_populates="plan")


class TaxRule(Base):
    __tablename__ = "tax_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    rate = Column(Numeric(6, 4), nullable=False)
    tax_type = Column(String(50), nullable=False, default="PERCENTAGE")
    is_compound = Column(Boolean, nullable=False, default=False)
    jurisdiction_country = Column(String(2), nullable=False, default="IN")
    jurisdiction_state = Column(String(100), nullable=False, default="")
    tax_scope = Column(String(50), nullable=False, default="STANDARD")
    valid_from = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    valid_until = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("rate >= 0 AND rate <= 100", name="chk_tax_rules_rate"),
        CheckConstraint(
            "tax_scope IN ('STANDARD', 'INTRASTATE_CGST', 'INTRASTATE_SGST', 'INTERSTATE_IGST', 'VAT', 'EXEMPT')",
            name="chk_tax_rules_scope",
        ),
        CheckConstraint("valid_until IS NULL OR valid_until >= valid_from", name="chk_tax_rules_validity"),
        ExcludeConstraint(
            (text("jurisdiction_country"), "="),
            (text("jurisdiction_state"), "="),
            (text("tax_scope"), "="),
            (text("tstzrange(valid_from, valid_until, '[)')"), "&&"),
            name="excl_tax_rule_no_overlapping_scope",
            using="gist",
            where=text("is_active = TRUE"),
        ),
    )


class ProductTax(Base):
    __tablename__ = "product_taxes"

    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), primary_key=True)
    tax_rule_id = Column(UUID(as_uuid=True), ForeignKey("tax_rules.id", ondelete="RESTRICT"), primary_key=True)

    product = relationship("Product", back_populates="taxes")
    tax_rule = relationship("TaxRule")


class PlanTax(Base):
    __tablename__ = "plan_taxes"

    plan_id = Column(UUID(as_uuid=True), ForeignKey("plans.id", ondelete="CASCADE"), primary_key=True)
    tax_rule_id = Column(UUID(as_uuid=True), ForeignKey("tax_rules.id", ondelete="RESTRICT"), primary_key=True)

    plan = relationship("Plan", back_populates="taxes")
    tax_rule = relationship("TaxRule")
