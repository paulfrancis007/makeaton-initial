import uuid
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
    and_,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class Customer(Base):
    __tablename__ = "customers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_name = Column(String(200), nullable=False, index=True)
    contact_email = Column(String(255), nullable=False, index=True)
    contact_phone = Column(String(50), nullable=True)
    tax_number = Column(String(50), nullable=True)
    billing_address_line1 = Column(String(255), nullable=False)
    billing_address_line2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=False)
    state = Column(String(100), nullable=False)
    postal_code = Column(String(20), nullable=False)
    country = Column(String(2), nullable=False, default="IN")
    currency = Column(String(3), nullable=False, default="INR")
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("contact_email = lower(contact_email)", name="chk_customers_contact_email_lowercase"),
        CheckConstraint("length(country) = 2", name="chk_customers_country_len"),
    )

    users = relationship("CustomerUser", back_populates="customer", cascade="all, delete-orphan")
    quotations = relationship("Quotation", back_populates="customer")
    subscriptions = relationship("Subscription", back_populates="customer")
    invoices = relationship("Invoice", back_populates="customer")
    payments = relationship("Payment", back_populates="customer")
    discount_redemptions = relationship("DiscountRedemption", back_populates="customer")


class CustomerUser(Base):
    __tablename__ = "customer_users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    membership_role = Column(String(30), nullable=False, default="VIEWER")
    is_primary = Column(Boolean, nullable=False, default=False)
    status = Column(String(20), nullable=False, default="ACTIVE")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("customer_id", "user_id", name="uq_customer_user"),
        CheckConstraint(
            "membership_role IN ('OWNER', 'BILLING_ADMIN', 'TECHNICAL_CONTACT', 'VIEWER')",
            name="chk_cust_user_role",
        ),
        CheckConstraint(
            "status IN ('ACTIVE', 'INVITED', 'SUSPENDED')",
            name="chk_cust_user_status",
        ),
        CheckConstraint(
            "is_primary = FALSE OR membership_role = 'OWNER'",
            name="chk_cust_user_primary_owner",
        ),
        Index(
            "idx_customer_users_one_primary",
            "customer_id",
            unique=True,
            postgresql_where=text("is_primary = TRUE AND status = 'ACTIVE'"),
        ),
    )

    customer = relationship("Customer", back_populates="users")
    user = relationship("User", back_populates="customer_memberships")
