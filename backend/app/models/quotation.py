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


class QuotationTemplate(Base):
    __tablename__ = "quotation_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(150), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("plans.id", ondelete="RESTRICT"), nullable=False)
    validity_duration_days = Column(Integer, nullable=False, default=30)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("validity_duration_days > 0", name="chk_quotation_templates_validity_days"),
    )

    plan = relationship("Plan", back_populates="quotation_templates")
    lines = relationship("QuotationTemplateLine", back_populates="template", cascade="all, delete-orphan")
    quotations = relationship("Quotation", back_populates="template")


class QuotationTemplateLine(Base):
    __tablename__ = "quotation_template_lines"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    template_id = Column(UUID(as_uuid=True), ForeignKey("quotation_templates.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    variant_id = Column(UUID(as_uuid=True), nullable=True)
    quantity = Column(Integer, nullable=False, default=1)
    unit_price_override = Column(Numeric(12, 4), nullable=True)

    __table_args__ = (
        CheckConstraint("quantity > 0", name="chk_quotation_template_lines_qty"),
        CheckConstraint("unit_price_override IS NULL OR unit_price_override >= 0", name="chk_quotation_template_lines_price"),
        ForeignKeyConstraint(
            ["variant_id", "product_id"],
            ["product_variants.id", "product_variants.product_id"],
            ondelete="RESTRICT",
            name="fk_quote_template_line_variant_prod",
        ),
    )

    template = relationship("QuotationTemplate", back_populates="lines")
    product = relationship("Product")
    variant = relationship("ProductVariant", overlaps="product")


class Quotation(Base):
    __tablename__ = "quotations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quotation_number = Column(String(50), nullable=False, unique=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False)
    template_id = Column(UUID(as_uuid=True), ForeignKey("quotation_templates.id", ondelete="SET NULL"), nullable=True)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("plans.id", ondelete="RESTRICT"), nullable=False)
    status = Column(String(20), nullable=False, default="DRAFT")
    issue_date = Column(Date, server_default=func.current_date(), nullable=False)
    expiry_date = Column(Date, nullable=False)
    plan_price_snapshot = Column(Numeric(12, 4), nullable=False)
    subtotal_amount = Column(Numeric(12, 2), nullable=False, default=0.00)
    discount_amount = Column(Numeric(12, 2), nullable=False, default=0.00)
    tax_amount = Column(Numeric(12, 2), nullable=False, default=0.00)
    rounding_adjustment = Column(Numeric(12, 2), nullable=False, default=0.00)
    total_amount = Column(Numeric(12, 2), nullable=False, default=0.00)
    currency = Column(String(3), nullable=False, default="INR")
    notes = Column(Text, nullable=True)
    created_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("id", "customer_id", name="uq_quotation_customer"),
        CheckConstraint(
            "status IN ('DRAFT', 'SENT', 'CONFIRMED', 'EXPIRED', 'REJECTED')",
            name="chk_quotations_status",
        ),
        CheckConstraint("plan_price_snapshot >= 0", name="chk_quotations_plan_price"),
        CheckConstraint("subtotal_amount >= 0", name="chk_quotations_subtotal"),
        CheckConstraint("discount_amount >= 0", name="chk_quotations_discount"),
        CheckConstraint("tax_amount >= 0", name="chk_quotations_tax"),
        CheckConstraint("rounding_adjustment BETWEEN -0.02 AND 0.02", name="chk_quotations_rounding"),
        CheckConstraint("total_amount >= 0", name="chk_quotations_total"),
        CheckConstraint("expiry_date >= issue_date", name="chk_quotations_dates"),
        CheckConstraint(
            "total_amount = subtotal_amount - discount_amount + tax_amount + rounding_adjustment",
            name="chk_quotations_total_calc",
        ),
    )

    customer = relationship("Customer", back_populates="quotations")
    template = relationship("QuotationTemplate", back_populates="quotations")
    plan = relationship("Plan", back_populates="quotations")
    created_by_user = relationship("User")
    lines = relationship("QuotationLine", back_populates="quotation", cascade="all, delete-orphan")
    subscription = relationship("Subscription", back_populates="quotation", uselist=False, overlaps="customer,subscriptions")
    discount_redemptions = relationship("DiscountRedemption", back_populates="quotation", overlaps="customer,discount_redemptions,subscription,invoice")


class QuotationLine(Base):
    __tablename__ = "quotation_lines"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quotation_id = Column(UUID(as_uuid=True), ForeignKey("quotations.id", ondelete="CASCADE"), nullable=False)
    line_type = Column(String(20), nullable=False, default="PRODUCT")
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="RESTRICT"), nullable=True)
    variant_id = Column(UUID(as_uuid=True), nullable=True)
    description_snapshot = Column(String(200), nullable=False)
    unit_price = Column(Numeric(12, 4), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    tax_rate_snapshot = Column(Numeric(6, 4), nullable=False, default=0)
    tax_amount = Column(Numeric(12, 4), nullable=False, default=0)
    discount_amount = Column(Numeric(12, 4), nullable=False, default=0)
    line_total = Column(Numeric(12, 4), nullable=False)

    __table_args__ = (
        CheckConstraint("line_type IN ('PLAN_FEE', 'PRODUCT')", name="chk_quotation_lines_type"),
        CheckConstraint("unit_price >= 0", name="chk_quotation_lines_unit_price"),
        CheckConstraint("quantity > 0", name="chk_quotation_lines_qty"),
        CheckConstraint("tax_rate_snapshot >= 0", name="chk_quotation_lines_tax_rate"),
        CheckConstraint("tax_amount >= 0", name="chk_quotation_lines_tax_amt"),
        CheckConstraint("discount_amount >= 0", name="chk_quotation_lines_disc_amt"),
        CheckConstraint("line_total >= 0", name="chk_quotation_lines_line_total"),
        CheckConstraint(
            "((line_type = 'PLAN_FEE' AND product_id IS NULL AND variant_id IS NULL) OR (line_type = 'PRODUCT' AND product_id IS NOT NULL))",
            name="chk_quotation_lines_prod_variant",
        ),
        ForeignKeyConstraint(
            ["variant_id", "product_id"],
            ["product_variants.id", "product_variants.product_id"],
            ondelete="RESTRICT",
            name="fk_quote_line_variant_prod",
        ),
        Index(
            "uq_quote_single_plan_fee",
            "quotation_id",
            unique=True,
            postgresql_where=text("line_type = 'PLAN_FEE'"),
        ),
    )

    quotation = relationship("Quotation", back_populates="lines")
    product = relationship("Product")
    variant = relationship("ProductVariant", overlaps="product")
    taxes = relationship("QuotationLineTax", back_populates="quotation_line", cascade="all, delete-orphan")


class QuotationLineTax(Base):
    __tablename__ = "quotation_line_taxes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quotation_line_id = Column(UUID(as_uuid=True), ForeignKey("quotation_lines.id", ondelete="CASCADE"), nullable=False)
    tax_rule_id = Column(UUID(as_uuid=True), ForeignKey("tax_rules.id", ondelete="SET NULL"), nullable=True)
    tax_name_snapshot = Column(String(100), nullable=False)
    tax_rate_snapshot = Column(Numeric(6, 4), nullable=False)
    tax_amount = Column(Numeric(12, 4), nullable=False)

    __table_args__ = (
        CheckConstraint("tax_rate_snapshot >= 0", name="chk_quote_line_tax_rate"),
        CheckConstraint("tax_amount >= 0", name="chk_quote_line_tax_amt"),
    )

    quotation_line = relationship("QuotationLine", back_populates="taxes")
    tax_rule = relationship("TaxRule")
