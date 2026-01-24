"""People API endpoints."""

from uuid import UUID
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, and_

from app.api.deps import get_context, CurrentContext
from app.models import Person
from app.schemas.person import PersonCreate, PersonUpdate, PersonResponse

router = APIRouter()


@router.get("", response_model=List[PersonResponse])
async def list_people(
    client_id: Optional[UUID] = Query(None),
    relationship: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    ctx: CurrentContext = Depends(get_context),
):
    """List people with optional filters."""
    query = select(Person).where(Person.tenant_id == ctx.tenant.id)

    if client_id:
        query = query.where(Person.client_id == client_id)
    if relationship:
        query = query.where(Person.relationship == relationship)
    if search:
        query = query.where(Person.name.ilike(f"%{search}%"))

    query = query.order_by(Person.name)
    query = query.limit(limit).offset(offset)

    result = await ctx.db.execute(query)
    people = result.scalars().all()

    return [PersonResponse.model_validate(p) for p in people]


@router.post("", response_model=PersonResponse, status_code=status.HTTP_201_CREATED)
async def create_person(
    data: PersonCreate,
    ctx: CurrentContext = Depends(get_context),
):
    """Create a new person."""
    person = Person(
        tenant_id=ctx.tenant.id,
        name=data.name,
        email=data.email,
        phone=data.phone,
        title=data.title,
        company=data.company,
        relationship=data.relationship,
        relationship_to_user=data.relationship_to_user,
        political_context=data.political_context,
        communication_notes=data.communication_notes,
        context_notes=data.context_notes,
        client_id=data.client_id,
    )
    ctx.db.add(person)
    await ctx.db.flush()

    return PersonResponse.model_validate(person)


@router.get("/{person_id}", response_model=PersonResponse)
async def get_person(
    person_id: UUID,
    ctx: CurrentContext = Depends(get_context),
):
    """Get a person by ID."""
    result = await ctx.db.execute(
        select(Person).where(
            and_(
                Person.id == person_id,
                Person.tenant_id == ctx.tenant.id,
            )
        )
    )
    person = result.scalar_one_or_none()

    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    return PersonResponse.model_validate(person)


@router.put("/{person_id}", response_model=PersonResponse)
async def update_person(
    person_id: UUID,
    data: PersonUpdate,
    ctx: CurrentContext = Depends(get_context),
):
    """Update a person."""
    result = await ctx.db.execute(
        select(Person).where(
            and_(
                Person.id == person_id,
                Person.tenant_id == ctx.tenant.id,
            )
        )
    )
    person = result.scalar_one_or_none()

    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(person, field, value)

    await ctx.db.flush()

    return PersonResponse.model_validate(person)


@router.delete("/{person_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_person(
    person_id: UUID,
    ctx: CurrentContext = Depends(get_context),
):
    """Delete a person."""
    result = await ctx.db.execute(
        select(Person).where(
            and_(
                Person.id == person_id,
                Person.tenant_id == ctx.tenant.id,
            )
        )
    )
    person = result.scalar_one_or_none()

    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    await ctx.db.delete(person)
    await ctx.db.flush()
