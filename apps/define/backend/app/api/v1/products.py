from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
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
async def list_products(
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """List all products with requirement counts."""
    # Subquery for requirement counts (exclude soft-deleted)
    count_subq = (
        select(
            Requirement.product_id,
            func.count(Requirement.id).label("requirement_count")
        )
        .where(Requirement.deleted_at.is_(None))
        .group_by(Requirement.product_id)
        .subquery()
    )

    # Main query joining products with counts
    stmt = (
        select(Product, func.coalesce(count_subq.c.requirement_count, 0).label("requirement_count"))
        .outerjoin(count_subq, Product.id == count_subq.c.product_id)
        .order_by(Product.name)
    )

    result = await db.execute(stmt)
    rows = result.all()

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
        for product, count in rows
    ]


@router.post("", response_model=ProductResponse, status_code=201)
async def create_product(
    data: ProductCreate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Create a new product."""
    final_prefix = (data.prefix or generate_prefix(data.name)).upper()

    # Check if prefix already exists
    stmt = select(Product).where(Product.prefix == final_prefix)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
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
    await db.flush()
    await db.refresh(product)

    return product


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get a single product by ID."""
    stmt = select(Product).where(Product.id == product_id)
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.patch("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: str,
    data: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Update a product."""
    stmt = select(Product).where(Product.id == product_id)
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if data.name is not None:
        product.name = data.name.strip()
    if data.prefix is not None:
        new_prefix = data.prefix.upper()
        # Check if prefix already exists for another product
        check_stmt = select(Product).where(Product.prefix == new_prefix, Product.id != product_id)
        check_result = await db.execute(check_stmt)
        existing = check_result.scalar_one_or_none()
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
    await db.flush()
    await db.refresh(product)

    return product


@router.delete("/{product_id}", status_code=204)
async def delete_product(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Delete a product and all related data."""
    stmt = select(Product).where(Product.id == product_id)
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    await db.delete(product)

    return None
