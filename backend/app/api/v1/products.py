import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin, require_staff_or_admin
from app.models.auth import User
from app.schemas.catalog import (
    ProductCreate,
    ProductPublic,
    ProductUpdate,
    ProductVariantCreate,
    ProductVariantPublic,
    ProductVariantUpdate,
    TaxAssignmentRequest,
    TaxRulePublic,
)
from app.schemas.common import PaginatedResponse
from app.services.catalog_service import (
    assign_product_taxes,
    create_product,
    create_variant,
    deactivate_product,
    deactivate_variant,
    get_product_by_id,
    get_product_taxes,
    get_variant_by_id,
    list_products,
    list_variants_for_product,
    update_product,
    update_variant,
)

router = APIRouter(prefix="/products", tags=["Product Catalogue"])


# ---------------------------------------------------------
# Products Endpoints
# ---------------------------------------------------------

@router.post("/", response_model=ProductPublic, status_code=status.HTTP_201_CREATED)
def create_new_product(
    payload: ProductCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Admin endpoint to create a product."""
    product = create_product(
        db=db,
        data=payload,
        actor_user=admin_user,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return ProductPublic.model_validate(product)


@router.get("/", response_model=PaginatedResponse[ProductPublic])
def list_all_products(
    search: Optional[str] = Query(None, description="Search product name or description"),
    product_type: Optional[str] = Query(None, description="Filter by SERVICE, SOFTWARE, ADDON"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(require_staff_or_admin),
):
    """Staff/Admin endpoint to list and search catalog products."""
    items, total = list_products(
        db=db,
        search=search,
        product_type=product_type,
        is_active=is_active,
        page=page,
        page_size=page_size,
    )
    pages = (total + page_size - 1) // page_size if total > 0 else 0
    return PaginatedResponse(
        items=[ProductPublic.model_validate(p) for p in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.get("/{product_id}", response_model=ProductPublic)
def get_product(
    product_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff_or_admin),
):
    """Staff/Admin endpoint to get product details."""
    product = get_product_by_id(db, product_id)
    return ProductPublic.model_validate(product)


@router.put("/{product_id}", response_model=ProductPublic)
def update_existing_product(
    product_id: uuid.UUID,
    payload: ProductUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Admin endpoint to update product details."""
    product = update_product(
        db=db,
        product_id=product_id,
        data=payload,
        actor_user=admin_user,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return ProductPublic.model_validate(product)


@router.delete("/{product_id}", response_model=ProductPublic)
def deactivate_existing_product(
    product_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Admin endpoint to deactivate a product."""
    product = deactivate_product(
        db=db,
        product_id=product_id,
        actor_user=admin_user,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return ProductPublic.model_validate(product)


# ---------------------------------------------------------
# Product Taxes Junction Endpoints
# ---------------------------------------------------------

@router.put("/{product_id}/taxes", response_model=List[TaxRulePublic])
def set_product_taxes(
    product_id: uuid.UUID,
    payload: TaxAssignmentRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Admin endpoint to assign applicable tax rules to a product."""
    rules = assign_product_taxes(
        db=db,
        product_id=product_id,
        tax_rule_ids=payload.tax_rule_ids,
        actor_user=admin_user,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return [TaxRulePublic.model_validate(r) for r in rules]


@router.get("/{product_id}/taxes", response_model=List[TaxRulePublic])
def list_product_taxes(
    product_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff_or_admin),
):
    """Staff/Admin endpoint to view applicable taxes for a product."""
    rules = get_product_taxes(db, product_id)
    return [TaxRulePublic.model_validate(r) for r in rules]


# ---------------------------------------------------------
# Product Variants Sub-Endpoints
# ---------------------------------------------------------

@router.post("/{product_id}/variants", response_model=ProductVariantPublic, status_code=status.HTTP_201_CREATED)
def create_product_variant(
    product_id: uuid.UUID,
    payload: ProductVariantCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Admin endpoint to create a variant for a specific product."""
    variant = create_variant(
        db=db,
        product_id=product_id,
        data=payload,
        actor_user=admin_user,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return ProductVariantPublic.model_validate(variant)


@router.get("/{product_id}/variants", response_model=List[ProductVariantPublic])
def list_product_variants(
    product_id: uuid.UUID,
    is_active: Optional[bool] = Query(None, description="Filter by variant active status"),
    db: Session = Depends(get_db),
    user: User = Depends(require_staff_or_admin),
):
    """Staff/Admin endpoint to list variants for a product."""
    variants = list_variants_for_product(db, product_id, is_active=is_active)
    return [ProductVariantPublic.model_validate(v) for v in variants]


@router.get("/{product_id}/variants/{variant_id}", response_model=ProductVariantPublic)
def get_product_variant(
    product_id: uuid.UUID,
    variant_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_staff_or_admin),
):
    """Staff/Admin endpoint to get a specific variant."""
    variant = get_variant_by_id(db, product_id, variant_id)
    return ProductVariantPublic.model_validate(variant)


@router.put("/{product_id}/variants/{variant_id}", response_model=ProductVariantPublic)
def update_product_variant(
    product_id: uuid.UUID,
    variant_id: uuid.UUID,
    payload: ProductVariantUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Admin endpoint to update a variant."""
    variant = update_variant(
        db=db,
        product_id=product_id,
        variant_id=variant_id,
        data=payload,
        actor_user=admin_user,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return ProductVariantPublic.model_validate(variant)


@router.delete("/{product_id}/variants/{variant_id}", response_model=ProductVariantPublic)
def deactivate_product_variant(
    product_id: uuid.UUID,
    variant_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Admin endpoint to deactivate a variant."""
    variant = deactivate_variant(
        db=db,
        product_id=product_id,
        variant_id=variant_id,
        actor_user=admin_user,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return ProductVariantPublic.model_validate(variant)
