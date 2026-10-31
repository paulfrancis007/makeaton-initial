import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("invoices.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    method: Mapped[str] = mapped_column(String(32), nullable=False)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    note: Mapped[str] = mapped_column(Text, nullable=False)
    reference: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    recorded_by: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    request_key: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    request_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_payments_amount_pos"),
        CheckConstraint(
            "method IN ('CASH', 'BANK_TRANSFER', 'UPI', 'CARD', 'CHEQUE', 'OTHER')",
            name="ck_payments_method",
        ),
        CheckConstraint("length(trim(note)) > 0", name="ck_payments_note_nonempty"),
    )

    invoice = relationship("Invoice", back_populates="payments", foreign_keys=[invoice_id])
    recorder = relationship("User", foreign_keys=[recorded_by])
