import uuid
from typing import Optional
from sqlalchemy import (
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin


class Customer(Base, TimestampMixin):
    __tablename__ = "customers"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        unique=True,
        nullable=True,
        index=True,
    )
    email_normalized: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    company: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    billing_address_line1: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    billing_address_line2: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    billing_city: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    billing_state: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    billing_postal_code: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    billing_country: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    __table_args__ = (
        # Explicit target for composite FK in subscriptions
        UniqueConstraint("id", "email_normalized", name="uq_customers_id_email"),
    )

    user = relationship("User", back_populates="customer")
    subscriptions = relationship("Subscription", back_populates="customer", foreign_keys="[Subscription.customer_id]")
    invoices = relationship("Invoice", back_populates="customer", foreign_keys="[Invoice.customer_id]")
