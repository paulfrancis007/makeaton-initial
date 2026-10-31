import uuid
from decimal import Decimal
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin


class TaxRule(Base, TimestampMixin):
    __tablename__ = "tax_rules"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    classification: Mapped[str] = mapped_column(String(64), nullable=False)
    rate: Mapped[Decimal] = mapped_column(Numeric(7, 4), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    __table_args__ = (
        CheckConstraint("rate >= 0 AND rate <= 100", name="ck_tax_rules_rate_pct"),
    )


class ProductTax(Base):
    __tablename__ = "product_taxes"

    product_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        primary_key=True,
    )
    tax_rule_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("tax_rules.id", ondelete="RESTRICT"),
        primary_key=True,
    )

    product = relationship("Product", back_populates="taxes")
    tax_rule = relationship("TaxRule")


class PlanTax(Base):
    __tablename__ = "plan_taxes"

    plan_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("plans.id", ondelete="CASCADE"),
        primary_key=True,
    )
    tax_rule_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("tax_rules.id", ondelete="RESTRICT"),
        primary_key=True,
    )

    plan = relationship("Plan", back_populates="taxes")
    tax_rule = relationship("TaxRule")
