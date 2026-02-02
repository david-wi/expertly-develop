"""Persona API endpoints."""

from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import UserContext, get_user_context
from app.database import get_database
from app.models.persona import Persona, PersonaCredentials
from app.schemas.persona import (
    PersonaCreate,
    PersonaUpdate,
    PersonaResponse,
    PersonaListResponse,
)
from app.services.encryption_service import encryption_service

router = APIRouter()


def persona_to_response(persona: Persona) -> PersonaResponse:
    """Convert persona model to response schema."""
    return PersonaResponse(
        id=str(persona.id),
        project_id=str(persona.project_id),
        name=persona.name,
        role_description=persona.role_description,
        goals=persona.goals,
        task_types=persona.task_types,
        has_credentials=persona.credentials is not None,
        created_at=persona.created_at,
        updated_at=persona.updated_at,
    )


@router.get("", response_model=PersonaListResponse)
async def list_personas(
    project_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    user: UserContext = Depends(get_user_context),
):
    """List personas, optionally filtered by project."""
    db = get_database()

    query = {"organization_id": user.organization_id}
    if project_id:
        query["project_id"] = ObjectId(project_id)

    cursor = db.personas.find(query).sort("name", 1).skip(offset).limit(limit)
    personas = [Persona.from_mongo(doc) async for doc in cursor]

    total = await db.personas.count_documents(query)

    return PersonaListResponse(
        items=[persona_to_response(p) for p in personas],
        total=total,
    )


@router.post("", response_model=PersonaResponse, status_code=status.HTTP_201_CREATED)
async def create_persona(
    data: PersonaCreate,
    user: UserContext = Depends(get_user_context),
):
    """Create a new persona."""
    db = get_database()

    # Verify project exists and belongs to tenant
    project = await db.projects.find_one({
        "_id": ObjectId(data.project_id),
        "organization_id": user.organization_id,
        "deleted_at": None,
    })
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )

    # Encrypt credentials if provided
    credentials = None
    if data.credentials:
        creds_dict = data.credentials.model_dump()
        if creds_dict.get("username"):
            creds_dict["username"] = encryption_service.encrypt(creds_dict["username"])
        if creds_dict.get("password"):
            creds_dict["password"] = encryption_service.encrypt(creds_dict["password"])
        credentials = PersonaCredentials(**creds_dict)

    persona = Persona(
        organization_id=user.organization_id,
        project_id=ObjectId(data.project_id),
        name=data.name,
        role_description=data.role_description,
        goals=data.goals,
        task_types=data.task_types,
        credentials=credentials,
    )

    result = await db.personas.insert_one(persona.to_mongo())
    persona.id = result.inserted_id

    return persona_to_response(persona)


@router.get("/{persona_id}", response_model=PersonaResponse)
async def get_persona(
    persona_id: str,
    user: UserContext = Depends(get_user_context),
):
    """Get a persona by ID."""
    db = get_database()

    doc = await db.personas.find_one({
        "_id": ObjectId(persona_id),
        "organization_id": user.organization_id,
    })

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Persona not found",
        )

    return persona_to_response(Persona.from_mongo(doc))


@router.put("/{persona_id}", response_model=PersonaResponse)
async def update_persona(
    persona_id: str,
    data: PersonaUpdate,
    user: UserContext = Depends(get_user_context),
):
    """Update a persona."""
    db = get_database()

    existing = await db.personas.find_one({
        "_id": ObjectId(persona_id),
        "organization_id": user.organization_id,
    })

    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Persona not found",
        )

    updates = data.model_dump(exclude_none=True, exclude={"credentials"})
    updates["updated_at"] = datetime.now(timezone.utc)

    # Handle credentials separately
    if data.credentials:
        creds_dict = data.credentials.model_dump()
        if creds_dict.get("username"):
            creds_dict["username"] = encryption_service.encrypt(creds_dict["username"])
        if creds_dict.get("password"):
            creds_dict["password"] = encryption_service.encrypt(creds_dict["password"])
        updates["credentials"] = creds_dict

    result = await db.personas.find_one_and_update(
        {"_id": ObjectId(persona_id)},
        {"$set": updates},
        return_document=True,
    )

    return persona_to_response(Persona.from_mongo(result))


@router.delete("/{persona_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_persona(
    persona_id: str,
    user: UserContext = Depends(get_user_context),
):
    """Delete a persona."""
    db = get_database()

    result = await db.personas.delete_one({
        "_id": ObjectId(persona_id),
        "organization_id": user.organization_id,
    })

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Persona not found",
        )
