"""Client API endpoints."""

from uuid import UUID
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from app.api.deps import get_context, CurrentContext
from app.models import Client, Person
from app.schemas.client import ClientCreate, ClientUpdate, ClientResponse, ClientWithPeople

router = APIRouter()


@router.get("", response_model=List[ClientResponse])
async def list_clients(
    status_filter: Optional[str] = Query(None, alias="status", pattern="^(prospect|active|churned|archived)$"),
    search: Optional[str] = Query(None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    ctx: CurrentContext = Depends(get_context),
):
    """List clients with optional filters."""
    query = select(Client).where(Client.tenant_id == ctx.tenant.id)

    if status_filter:
        query = query.where(Client.status == status_filter)
    if search:
        query = query.where(Client.name.ilike(f"%{search}%"))

    query = query.order_by(Client.name)
    query = query.limit(limit).offset(offset)

    result = await ctx.db.execute(query)
    clients = result.scalars().all()

    return [ClientResponse.model_validate(c) for c in clients]


@router.post("", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
async def create_client(
    data: ClientCreate,
    ctx: CurrentContext = Depends(get_context),
):
    """Create a new client."""
    client = Client(
        tenant_id=ctx.tenant.id,
        name=data.name,
        status=data.status,
        notes=data.notes,
    )
    ctx.db.add(client)
    await ctx.db.flush()

    return ClientResponse.model_validate(client)


@router.get("/{client_id}", response_model=ClientWithPeople)
async def get_client(
    client_id: UUID,
    ctx: CurrentContext = Depends(get_context),
):
    """Get a client by ID with associated people."""
    result = await ctx.db.execute(
        select(Client).where(
            and_(
                Client.id == client_id,
                Client.tenant_id == ctx.tenant.id,
            )
        )
    )
    client = result.scalar_one_or_none()

    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    # Get people for this client
    people_result = await ctx.db.execute(
        select(Person).where(
            and_(
                Person.client_id == client_id,
                Person.tenant_id == ctx.tenant.id,
            )
        )
    )
    people = people_result.scalars().all()

    # Build response manually to avoid SQLAlchemy relationship lazy loading issues
    people_list = [
        {
            "id": str(p.id),
            "name": p.name,
            "title": p.title,
            "email": p.email,
            "relationship": p.relationship,
        }
        for p in people
    ]

    return ClientWithPeople(
        id=client.id,
        tenant_id=client.tenant_id,
        name=client.name,
        status=client.status,
        notes=client.notes,
        created_at=client.created_at,
        updated_at=client.updated_at,
        people=people_list,
    )


@router.put("/{client_id}", response_model=ClientResponse)
async def update_client(
    client_id: UUID,
    data: ClientUpdate,
    ctx: CurrentContext = Depends(get_context),
):
    """Update a client."""
    result = await ctx.db.execute(
        select(Client).where(
            and_(
                Client.id == client_id,
                Client.tenant_id == ctx.tenant.id,
            )
        )
    )
    client = result.scalar_one_or_none()

    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(client, field, value)

    await ctx.db.flush()

    return ClientResponse.model_validate(client)


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client(
    client_id: UUID,
    ctx: CurrentContext = Depends(get_context),
):
    """Archive a client."""
    result = await ctx.db.execute(
        select(Client).where(
            and_(
                Client.id == client_id,
                Client.tenant_id == ctx.tenant.id,
            )
        )
    )
    client = result.scalar_one_or_none()

    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    client.status = "archived"
    await ctx.db.flush()
