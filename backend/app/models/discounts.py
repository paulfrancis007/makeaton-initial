import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin


class DiscountRule(Base, TimestampMixin):
    __tablename__ = "discount_rules"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    maximum_uses: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    disabled_from: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    __table_args__ = (
        CheckConstraint(
            "maximum_uses IS NULL OR maximum_uses > 0",
            name="ck_discount_rules_max_uses_pos",
        ),
    )

    revisions = relationship("DiscountRevision", back_populates="rule", cascade="all, delete-orphan")
    redemptions = relationship("DiscountRedemption", back_populates="rule")


class DiscountRevision(Base):
    __tablename__ = "discount_revisions"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    rule_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("discount_rules.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    revision: Mapped[int] = mapped_column(Integer, nullable=False)
    type: Mapped[str] = mapped_column(String(16), nullable=False)
    amount: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    rate: Mapped[Optional[Decimal]] = mapped_column(Numeric(7, 4), nullable=True)
    minimum_purchase: Mapped[Optional[Decimal]] = mapped_column(Numeric(18, 2), nullable=True)
    minimum_quantity: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    scope: Mapped[str] = mapped_column(String(16), nullable=False)
    valid_from: Mapped[date] = mapped_column(Date, nullable=False)
    valid_to: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("rule_id", "revision", name="uq_discount_revisions_rule_revision"),
        UniqueConstraint("id", "rule_id", name="uq_discount_revisions_id_rule"),
        CheckConstraint("type IN ('FIXED', 'PERCENT')", name="ck_discount_revisions_type"),
        CheckConstraint("scope IN ('PRODUCT', 'SUBSCRIPTION')", name="ck_discount_revisions_scope"),
        CheckConstraint("valid_to >= valid_from", name="ck_discount_revisions_valid_dates"),
        CheckConstraint("amount IS NULL OR amount > 0", name="ck_discount_revisions_amount_pos"),
        CheckConstraint("rate IS NULL OR (rate > 0 AND rate <= 100)", name="ck_discount_revisions_rate_pos"),
        CheckConstraint("minimum_purchase IS NULL OR minimum_purchase >= 0", name="ck_discount_revisions_min_purchase"),
        CheckConstraint("minimum_quantity IS NULL OR minimum_quantity > 0", name="ck_discount_revisions_min_qty"),
        CheckConstraint(
            "((type = 'FIXED' AND amount IS NOT NULL AND rate IS NULL) OR "
            "(type = 'PERCENT' AND rate IS NOT NULL AND amount IS NULL))",
            name="ck_discount_revisions_type_fields",
        ),
    )

    rule = relationship("DiscountRule", back_populates="revisions")
    products = relationship("DiscountProduct", back_populates="revision", cascade="all, delete-orphan")


class DiscountProduct(Base):
    __tablename__ = "discount_products"

    revision_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("discount_revisions.id", ondelete="CASCADE"),
        primary_key=True,
    )
    product_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("products.id", ondelete="RESTRICT"),
        primary_key=True,
    )

    revision = relationship("DiscountRevision", back_populates="products")
    product = relationship("Product")


class DiscountRedemption(Base):
    __tablename__ = "discount_redemptions"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    rule_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("discount_rules.id", ondelete="RESTRICT"),
        nullable=False,
    )
    revision_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("discount_revisions.id", ondelete="RESTRICT"),
        nullable=False,
    )
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("invoices.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("rule_id", "invoice_id", name="uq_discount_redemptions_rule_invoice"),
        UniqueConstraint("id", "invoice_id", name="uq_discount_redemptions_id_invoice"),
        CheckConstraint("amount >= 0", name="ck_discount_redemptions_amount_nonneg"),
        ForeignKeyConstraint(
            ["revision_id", "rule_id"],
            ["discount_revisions.id", "discount_revisions.rule_id"],
            ondelete="RESTRICT",
            name="fk_discount_redemptions_revision_rule",
        ),
    )

    rule = relationship("DiscountRule", back_populates="redemptions", foreign_keys=[rule_id])
    revision = relationship("DiscountRevision", foreign_keys=[revision_id])
    invoice = relationship("Invoice", back_populates="discount_redemptions")
