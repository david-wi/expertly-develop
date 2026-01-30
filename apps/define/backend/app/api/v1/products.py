from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from uuid import uuid4
from datetime import datetime

from app.database import get_db
from app.api.deps import get_current_user, CurrentUser
from app.models.product import Product
from app.models.requirement import Requirement
from app.schemas.product import ProductCreate, ProductUpdate, ProductResponse, ProductWithCount

router = APIRouter()


def generate_prefix(name: str) -> str:
    """Generate a suggested prefix from product name."""
    words = name.strip().split()
    if len(words) == 1:
        return words[0][:3].upper()
    return "".join(w[0] for w in words[:4]).upper()


@router.get("", response_model=List[ProductWithCount])
def list_products(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """List all products with requirement counts."""
    results = (
        db.query(
            Product,
            func.count(Requirement.id).label("requirement_count"),
        )
        .outerjoin(Requirement, Product.id == Requirement.product_id)
        .group_by(Product.id)
        .order_by(Product.name)
        .all()
    )

    return [
        ProductWithCount(
            id=product.id,
            name=product.name,
            prefix=product.prefix,
            description=product.description,
            avatar_url=product.avatar_url,
            created_at=product.created_at,
            updated_at=product.updated_at,
            requirement_count=count,
        )
        for product, count in results
    ]


@router.post("", response_model=ProductResponse, status_code=201)
def create_product(
    data: ProductCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Create a new product."""
    final_prefix = (data.prefix or generate_prefix(data.name)).upper()

    # Check if prefix already exists
    existing = db.query(Product).filter(Product.prefix == final_prefix).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f'Prefix "{final_prefix}" is already in use',
        )

    now = datetime.utcnow().isoformat()
    product = Product(
        id=str(uuid4()),
        name=data.name.strip(),
        prefix=final_prefix,
        description=data.description.strip() if data.description else None,
        created_at=now,
        updated_at=now,
    )

    db.add(product)
    db.commit()
    db.refresh(product)

    return product


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(
    product_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get a single product by ID."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.patch("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: str,
    data: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Update a product."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if data.name is not None:
        product.name = data.name.strip()
    if data.prefix is not None:
        new_prefix = data.prefix.upper()
        existing = (
            db.query(Product)
            .filter(Product.prefix == new_prefix, Product.id != product_id)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f'Prefix "{new_prefix}" is already in use',
            )
        product.prefix = new_prefix
    if data.description is not None:
        product.description = data.description.strip() if data.description else None
    if data.avatar_url is not None:
        product.avatar_url = data.avatar_url if data.avatar_url else None

    product.updated_at = datetime.utcnow().isoformat()
    db.commit()
    db.refresh(product)

    return product


@router.delete("/{product_id}", status_code=204)
def delete_product(
    product_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Delete a product and all related data."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    db.delete(product)
    db.commit()

    return None
