import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_customer_access, require_staff_or_admin
from app.models.auth import User
from app.schemas.common import PaginatedResponse
from app.schemas.customer import (
    CustomerCreate,
    CustomerPublic,
    CustomerUpdate,
    CustomerUserCreate,
    CustomerUserPublic,
    CustomerUserUpdate,
)
from app.services.customer_service import (
    add_customer_member,
    create_customer_organization,
    deactivate_customer_organization,
    get_customer_by_id,
    list_customer_members,
    list_customers,
    remove_customer_member,
    update_customer_member,
    update_customer_organization,
)

router = APIRouter(prefix="/customers", tags=["Customer Organizations"])


@router.post("/", response_model=CustomerPublic, status_code=status.HTTP_201_CREATED)
def create_customer(
    payload: CustomerCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor_user: User = Depends(require_staff_or_admin),
):
    """Admin or Staff endpoint to create a new customer organization."""
    customer = create_customer_organization(
        db=db,
        data=payload,
        actor_user=actor_user,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return CustomerPublic.model_validate(customer)


@router.get("/", response_model=PaginatedResponse[CustomerPublic])
def get_customers(
    search: Optional[str] = Query(None, description="Search company name or email"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List accessible customer organizations.
    - ADMIN/STAFF: view all organizations with search and pagination.
    - CUSTOMER: view only organizations where user has an active membership.
    """
    items, total = list_customers(
        db=db,
        current_user=current_user,
        search=search,
        is_active=is_active,
        page=page,
        page_size=page_size,
    )
    pages = (total + page_size - 1) // page_size if page_size else 1
    return PaginatedResponse[CustomerPublic](
        items=[CustomerPublic.model_validate(c) for c in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.get("/{customer_id}", response_model=CustomerPublic)
def get_customer(
    customer_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve details of a customer organization with tenant authorization enforcement."""
    customer = get_customer_by_id(db, customer_id, current_user)
    return CustomerPublic.model_validate(customer)


@router.patch("/{customer_id}", response_model=CustomerPublic)
def update_customer(
    customer_id: uuid.UUID,
    payload: CustomerUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update customer organization. Authorized for ADMIN, STAFF, or customer OWNER."""
    customer = update_customer_organization(
        db=db,
        customer_id=customer_id,
        data=payload,
        actor_user=current_user,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return CustomerPublic.model_validate(customer)


@router.delete("/{customer_id}", response_model=CustomerPublic)
def deactivate_customer(
    customer_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    actor_user: User = Depends(require_staff_or_admin),
):
    """Deactivate customer organization (ADMIN or STAFF only)."""
    customer = deactivate_customer_organization(
        db=db,
        customer_id=customer_id,
        actor_user=actor_user,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return CustomerPublic.model_validate(customer)


# ------------------------------------------------------------------------------
# Membership Endpoints
# ------------------------------------------------------------------------------

@router.get("/{customer_id}/members", response_model=List[CustomerUserPublic])
def list_members(
    customer_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List members of a customer organization. Accessible to ADMIN, STAFF, or active members."""
    members = list_customer_members(db, customer_id, current_user)
    return [CustomerUserPublic.model_validate(m) for m in members]


@router.post("/{customer_id}/members", response_model=CustomerUserPublic, status_code=status.HTTP_201_CREATED)
def add_member(
    customer_id: uuid.UUID,
    payload: CustomerUserCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add an existing registered CUSTOMER user to an organization."""
    member = add_customer_member(
        db=db,
        customer_id=customer_id,
        data=payload,
        actor_user=current_user,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return CustomerUserPublic.model_validate(member)


@router.patch("/{customer_id}/members/{membership_id}", response_model=CustomerUserPublic)
def update_member(
    customer_id: uuid.UUID,
    membership_id: uuid.UUID,
    payload: CustomerUserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update member role or status. Enforces Final OWNER protection and Primary Contact rules."""
    member = update_customer_member(
        db=db,
        customer_id=customer_id,
        membership_id=membership_id,
        data=payload,
        actor_user=current_user,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return CustomerUserPublic.model_validate(member)


@router.delete("/{customer_id}/members/{membership_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    customer_id: uuid.UUID,
    membership_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove member from organization. Protected against removing the final active OWNER."""
    remove_customer_member(
        db=db,
        customer_id=customer_id,
        membership_id=membership_id,
        actor_user=current_user,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return None
