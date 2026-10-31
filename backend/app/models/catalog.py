import uuid
from datetime import date
from decimal import Decimal
from typing import Optional
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin


class Product(Base, TimestampMixin):
    __tablename__ = "products"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(64), nullable=False)
    sales_price: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    cost_price: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    __table_args__ = (
        CheckConstraint("sales_price >= 0", name="ck_products_sales_price_nonneg"),
        CheckConstraint("cost_price >= 0", name="ck_products_cost_price_nonneg"),
    )

    variants = relationship("ProductVariant", back_populates="product", cascade="all, delete-orphan")
    taxes = relationship("ProductTax", back_populates="product", cascade="all, delete-orphan")


class ProductVariant(Base, TimestampMixin):
    __tablename__ = "product_variants"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    price_adjustment: Mapped[Decimal] = mapped_column(
        Numeric(18, 2), default=Decimal("0.00"), nullable=False
    )
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    __table_args__ = (
        UniqueConstraint("product_id", "name", name="uq_product_variants_name"),
        # Composite target for plan_items and agreement_lines
        UniqueConstraint("id", "product_id", name="uq_product_variants_id_product"),
    )

    product = relationship("Product", back_populates="variants")


class Plan(Base, TimestampMixin):
    __tablename__ = "plans"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    base_fee: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    minimum_seats: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    extra_seat_unit_price: Mapped[Decimal] = mapped_column(
        Numeric(18, 2), default=Decimal("0.00"), nullable=False
    )
    interval: Mapped[str] = mapped_column(String(16), nullable=False)
    available_from: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    available_to: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    payment_term_days: Mapped[int] = mapped_column(Integer, default=15, nullable=False)
    allow_pause: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    allow_resume: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    allow_renewal: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    allow_early_closure: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    auto_close_on_expiry: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    __table_args__ = (
        CheckConstraint("base_fee >= 0", name="ck_plans_base_fee_nonneg"),
        CheckConstraint("minimum_seats > 0", name="ck_plans_min_seats_pos"),
        CheckConstraint("extra_seat_unit_price >= 0", name="ck_plans_extra_seat_price_nonneg"),
        CheckConstraint(
            "interval IN ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY')",
            name="ck_plans_interval",
        ),
        CheckConstraint("payment_term_days >= 0", name="ck_plans_payment_terms_nonneg"),
        CheckConstraint(
            "available_to IS NULL OR available_from IS NULL OR available_to >= available_from",
            name="ck_plans_available_dates",
        ),
    )

    items = relationship("PlanItem", back_populates="plan", cascade="all, delete-orphan")
    taxes = relationship("PlanTax", back_populates="plan", cascade="all, delete-orphan")
    subscriptions = relationship("Subscription", back_populates="plan")


class PlanItem(Base):
    __tablename__ = "plan_items"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    plan_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("plans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ordinal: Mapped[int] = mapped_column(Integer, nullable=False)
    product_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
    )
    variant_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("product_variants.id", ondelete="RESTRICT"),
        nullable=True,
    )
    included_quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    __table_args__ = (
        UniqueConstraint("plan_id", "ordinal", name="uq_plan_items_ordinal"),
        CheckConstraint("included_quantity > 0", name="ck_plan_items_qty_pos"),
        ForeignKeyConstraint(
            ["variant_id", "product_id"],
            ["product_variants.id", "product_variants.product_id"],
            ondelete="RESTRICT",
            name="fk_plan_items_variant_product",
        ),
    )

    plan = relationship("Plan", back_populates="items")
    product = relationship("Product", foreign_keys=[product_id])
    variant = relationship("ProductVariant", foreign_keys=[variant_id])
