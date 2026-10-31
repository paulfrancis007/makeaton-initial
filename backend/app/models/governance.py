import uuid
from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(100), nullable=False)
    entity_name = Column(String(100), nullable=False)
    entity_id = Column(UUID(as_uuid=True), nullable=True)
    ip_address = Column(String(50), nullable=True)
    details = Column(JSONB, nullable=False, server_default="{}")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    actor_user = relationship("User")


class CompanySetting(Base):
    __tablename__ = "company_settings"

    id = Column(Integer, primary_key=True, default=1)
    company_name = Column(String(200), nullable=False, default="Brightloop Technologies")
    tax_registration_number = Column(String(100), nullable=True)
    currency = Column(String(3), nullable=False, default="INR")
    default_payment_terms_days = Column(Integer, nullable=False, default=15)
    billing_timezone = Column(String(50), nullable=False, default="Asia/Kolkata")
    contact_email = Column(String(255), nullable=True)
    contact_phone = Column(String(50), nullable=True)
    address = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("id = 1", name="chk_company_settings_singleton"),
        CheckConstraint("default_payment_terms_days >= 0", name="chk_company_settings_payment_terms"),
    )
