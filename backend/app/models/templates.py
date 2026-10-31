import uuid
from typing import Optional
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin


class QuotationTemplate(Base, TimestampMixin):
    __tablename__ = "quotation_templates"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    plan_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("plans.id", ondelete="RESTRICT"),
        nullable=False,
    )
    validity_days: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    __table_args__ = (
        CheckConstraint("validity_days > 0", name="ck_quotation_templates_validity_days_pos"),
    )

    plan = relationship("Plan")
    lines = relationship("TemplateLine", back_populates="template", cascade="all, delete-orphan")


class TemplateLine(Base):
    __tablename__ = "template_lines"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    template_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("quotation_templates.id", ondelete="CASCADE"),
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
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    line_kind: Mapped[str] = mapped_column(String(16), nullable=False)

    __table_args__ = (
        UniqueConstraint("template_id", "ordinal", name="uq_template_lines_ordinal"),
        CheckConstraint("quantity > 0", name="ck_template_lines_qty_pos"),
        CheckConstraint("line_kind IN ('INCLUDED', 'ADDON')", name="ck_template_lines_kind"),
        ForeignKeyConstraint(
            ["variant_id", "product_id"],
            ["product_variants.id", "product_variants.product_id"],
            ondelete="RESTRICT",
            name="fk_template_lines_variant_product",
        ),
    )

    template = relationship("QuotationTemplate", back_populates="lines")
    product = relationship("Product", foreign_keys=[product_id])
    variant = relationship("ProductVariant", foreign_keys=[variant_id])
