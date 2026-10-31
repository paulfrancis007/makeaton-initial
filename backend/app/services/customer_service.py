import uuid
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models.auth import User
from app.models.customer import Customer, CustomerUser
from app.schemas.customer import CustomerCreate, CustomerUpdate, CustomerUserCreate, CustomerUserUpdate
from app.services.audit_service import log_audit_event


def list_customers(
    db: Session,
    current_user: User,
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    page: int = 1,
    page_size: int = 20,
) -> Tuple[List[Customer], int]:
    """
    List customer organizations accessible to current_user:
    - ADMIN and STAFF can view all customer organizations.
    - CUSTOMER users can view only organizations where they have an ACTIVE membership.
    """
    query = db.query(Customer)

    if current_user.role == "CUSTOMER":
        query = query.join(
            CustomerUser,
            (CustomerUser.customer_id == Customer.id)
            & (CustomerUser.user_id == current_user.id)
            & (CustomerUser.status == "ACTIVE"),
        )

    if is_active is not None:
        query = query.filter(Customer.is_active == is_active)

    if search:
        search_pattern = f"%{search.strip().lower()}%"
        query = query.filter(
            (Customer.company_name.ilike(search_pattern))
            | (Customer.contact_email.ilike(search_pattern))
        )

    total = query.count()
    offset = (page - 1) * page_size
    items = query.order_by(Customer.created_at.desc()).offset(offset).limit(page_size).all()
    return items, total


def get_customer_by_id(
    db: Session,
    customer_id: uuid.UUID,
    current_user: User,
) -> Customer:
    """Retrieve customer details if current_user has authorized access."""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer organization not found.",
        )

    if current_user.role == "CUSTOMER":
        membership = db.query(CustomerUser).filter(
            CustomerUser.customer_id == customer_id,
            CustomerUser.user_id == current_user.id,
            CustomerUser.status == "ACTIVE",
        ).first()
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access to this customer organization is forbidden.",
            )

    return customer


def create_customer_organization(
    db: Session,
    data: CustomerCreate,
    actor_user: User,
    ip_address: Optional[str] = None,
) -> Customer:
    """Admin or Staff creation of a new customer organization."""
    if actor_user.role not in ("ADMIN", "STAFF"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators and staff can create customer organizations directly.",
        )

    customer = Customer(
        company_name=data.company_name.strip(),
        contact_email=data.contact_email.strip().lower(),
        contact_phone=data.contact_phone.strip() if data.contact_phone else None,
        tax_number=data.tax_number.strip() if data.tax_number else None,
        billing_address_line1=data.billing_address_line1.strip(),
        billing_address_line2=data.billing_address_line2.strip() if data.billing_address_line2 else None,
        city=data.city.strip(),
        state=data.state.strip(),
        postal_code=data.postal_code.strip(),
        country=data.country.strip().upper(),
        currency=data.currency.strip().upper(),
        is_active=True,
    )
    db.add(customer)
    db.flush()

    log_audit_event(
        db=db,
        action="CUSTOMER_CREATED",
        entity_name="customers",
        entity_id=customer.id,
        actor_user_id=actor_user.id,
        ip_address=ip_address,
        details={"company_name": customer.company_name, "contact_email": customer.contact_email},
    )

    return customer


def update_customer_organization(
    db: Session,
    customer_id: uuid.UUID,
    data: CustomerUpdate,
    actor_user: User,
    ip_address: Optional[str] = None,
) -> Customer:
    """Update permitted customer organization attributes."""
    customer = get_customer_by_id(db, customer_id, actor_user)

    # If actor is CUSTOMER, must be an active OWNER
    if actor_user.role == "CUSTOMER":
        membership = db.query(CustomerUser).filter(
            CustomerUser.customer_id == customer_id,
            CustomerUser.user_id == actor_user.id,
            CustomerUser.status == "ACTIVE",
            CustomerUser.membership_role == "OWNER",
        ).first()
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only an organization OWNER, staff, or administrator can modify organization details.",
            )

    update_dict = data.model_dump(exclude_unset=True)
    if "is_active" in update_dict and actor_user.role == "CUSTOMER":
        # Customers cannot change their own is_active status directly
        del update_dict["is_active"]

    if "contact_email" in update_dict and update_dict["contact_email"]:
        update_dict["contact_email"] = update_dict["contact_email"].strip().lower()

    for field, val in update_dict.items():
        setattr(customer, field, val)

    db.flush()

    log_audit_event(
        db=db,
        action="CUSTOMER_UPDATED",
        entity_name="customers",
        entity_id=customer.id,
        actor_user_id=actor_user.id,
        ip_address=ip_address,
        details={"updated_fields": list(update_dict.keys())},
    )

    return customer


def deactivate_customer_organization(
    db: Session,
    customer_id: uuid.UUID,
    actor_user: User,
    ip_address: Optional[str] = None,
) -> Customer:
    """Deactivate customer organization (ADMIN or STAFF only)."""
    if actor_user.role not in ("ADMIN", "STAFF"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators and staff can deactivate customer organizations.",
        )

    customer = get_customer_by_id(db, customer_id, actor_user)
    customer.is_active = False
    db.flush()

    log_audit_event(
        db=db,
        action="CUSTOMER_DEACTIVATED",
        entity_name="customers",
        entity_id=customer.id,
        actor_user_id=actor_user.id,
        ip_address=ip_address,
        details={"company_name": customer.company_name},
    )

    return customer


def list_customer_members(
    db: Session,
    customer_id: uuid.UUID,
    current_user: User,
) -> List[CustomerUser]:
    """List memberships of a customer organization with user details."""
    get_customer_by_id(db, customer_id, current_user)
    return (
        db.query(CustomerUser)
        .options(joinedload(CustomerUser.user))
        .filter(CustomerUser.customer_id == customer_id)
        .order_by(CustomerUser.created_at.asc())
        .all()
    )


def add_customer_member(
    db: Session,
    customer_id: uuid.UUID,
    data: CustomerUserCreate,
    actor_user: User,
    ip_address: Optional[str] = None,
) -> CustomerUser:
    """Add an existing registered CUSTOMER user to an organization."""
    get_customer_by_id(db, customer_id, actor_user)

    if actor_user.role == "CUSTOMER":
        actor_membership = db.query(CustomerUser).filter(
            CustomerUser.customer_id == customer_id,
            CustomerUser.user_id == actor_user.id,
            CustomerUser.status == "ACTIVE",
            CustomerUser.membership_role == "OWNER",
        ).first()
        if not actor_membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only an organization OWNER, staff, or administrator can add members.",
            )

    # Verify target user exists and has CUSTOMER global role
    target_user = db.query(User).filter(User.id == data.user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User to be added was not found.",
        )
    if target_user.role != "CUSTOMER":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only users with the global 'CUSTOMER' role can be added as organization members.",
        )

    # Check if membership already exists
    existing_membership = db.query(CustomerUser).filter(
        CustomerUser.customer_id == customer_id,
        CustomerUser.user_id == data.user_id,
    ).first()
    if existing_membership:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member of this organization.",
        )

    # Primary contact enforcement
    if data.is_primary:
        if data.membership_role != "OWNER":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Primary contact must hold the 'OWNER' membership role.",
            )
        # Atomically unset any previous active primary contact
        db.query(CustomerUser).filter(
            CustomerUser.customer_id == customer_id,
            CustomerUser.is_primary == True,
        ).update({"is_primary": False})

    membership = CustomerUser(
        customer_id=customer_id,
        user_id=data.user_id,
        membership_role=data.membership_role,
        is_primary=data.is_primary,
        status="ACTIVE",
    )
    db.add(membership)
    db.flush()

    log_audit_event(
        db=db,
        action="MEMBER_ADDED",
        entity_name="customer_users",
        entity_id=membership.id,
        actor_user_id=actor_user.id,
        ip_address=ip_address,
        details={
            "customer_id": str(customer_id),
            "user_id": str(data.user_id),
            "membership_role": data.membership_role,
            "is_primary": data.is_primary,
        },
    )

    return membership


def update_customer_member(
    db: Session,
    customer_id: uuid.UUID,
    membership_id: uuid.UUID,
    data: CustomerUserUpdate,
    actor_user: User,
    ip_address: Optional[str] = None,
) -> CustomerUser:
    """Update membership role, primary status, or active/suspended status."""
    get_customer_by_id(db, customer_id, actor_user)

    if actor_user.role == "CUSTOMER":
        actor_membership = db.query(CustomerUser).filter(
            CustomerUser.customer_id == customer_id,
            CustomerUser.user_id == actor_user.id,
            CustomerUser.status == "ACTIVE",
            CustomerUser.membership_role == "OWNER",
        ).first()
        if not actor_membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only an organization OWNER, staff, or administrator can update memberships.",
            )

    membership = db.query(CustomerUser).filter(
        CustomerUser.id == membership_id,
        CustomerUser.customer_id == customer_id,
    ).first()
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership record not found.",
        )

    # FINAL OWNER PROTECTION:
    # If the target membership is currently an active OWNER, check if this update demotes or deactivates them.
    will_demote_role = data.membership_role is not None and data.membership_role != "OWNER"
    will_deactivate_status = data.status is not None and data.status != "ACTIVE"
    if membership.membership_role == "OWNER" and membership.status == "ACTIVE" and (will_demote_role or will_deactivate_status):
        other_active_owners = db.query(CustomerUser).filter(
            CustomerUser.customer_id == customer_id,
            CustomerUser.membership_role == "OWNER",
            CustomerUser.status == "ACTIVE",
            CustomerUser.id != membership_id,
        ).count()
        if other_active_owners == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot demote or deactivate the only active OWNER of the organization. Transfer ownership first.",
            )

    # Primary Contact update rules
    effective_role = data.membership_role if data.membership_role is not None else membership.membership_role
    if data.is_primary is True:
        if effective_role != "OWNER":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Primary contact must hold the 'OWNER' role.",
            )
        # Atomically unset any other active primary
        db.query(CustomerUser).filter(
            CustomerUser.customer_id == customer_id,
            CustomerUser.id != membership_id,
            CustomerUser.is_primary == True,
        ).update({"is_primary": False})
        membership.is_primary = True
    elif data.is_primary is False:
        membership.is_primary = False

    if data.membership_role is not None:
        # Check constraint: is_primary = FALSE OR membership_role = 'OWNER'
        if membership.is_primary and data.membership_role != "OWNER":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot change role from OWNER while user is the primary contact.",
            )
        membership.membership_role = data.membership_role

    if data.status is not None:
        membership.status = data.status

    db.flush()

    log_audit_event(
        db=db,
        action="MEMBER_UPDATED",
        entity_name="customer_users",
        entity_id=membership.id,
        actor_user_id=actor_user.id,
        ip_address=ip_address,
        details={
            "customer_id": str(customer_id),
            "membership_id": str(membership_id),
            "membership_role": membership.membership_role,
            "status": membership.status,
            "is_primary": membership.is_primary,
        },
    )

    return membership


def remove_customer_member(
    db: Session,
    customer_id: uuid.UUID,
    membership_id: uuid.UUID,
    actor_user: User,
    ip_address: Optional[str] = None,
) -> None:
    """Remove a membership record with final active OWNER protection."""
    get_customer_by_id(db, customer_id, actor_user)

    if actor_user.role == "CUSTOMER":
        actor_membership = db.query(CustomerUser).filter(
            CustomerUser.customer_id == customer_id,
            CustomerUser.user_id == actor_user.id,
            CustomerUser.status == "ACTIVE",
            CustomerUser.membership_role == "OWNER",
        ).first()
        if not actor_membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only an organization OWNER, staff, or administrator can remove members.",
            )

    membership = db.query(CustomerUser).filter(
        CustomerUser.id == membership_id,
        CustomerUser.customer_id == customer_id,
    ).first()
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership record not found.",
        )

    # FINAL OWNER PROTECTION
    if membership.membership_role == "OWNER" and membership.status == "ACTIVE":
        other_active_owners = db.query(CustomerUser).filter(
            CustomerUser.customer_id == customer_id,
            CustomerUser.membership_role == "OWNER",
            CustomerUser.status == "ACTIVE",
            CustomerUser.id != membership_id,
        ).count()
        if other_active_owners == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove the final active OWNER of the organization.",
            )

    db.delete(membership)
    db.flush()

    log_audit_event(
        db=db,
        action="MEMBER_REMOVED",
        entity_name="customer_users",
        entity_id=membership_id,
        actor_user_id=actor_user.id,
        ip_address=ip_address,
        details={"customer_id": str(customer_id), "membership_id": str(membership_id)},
    )
