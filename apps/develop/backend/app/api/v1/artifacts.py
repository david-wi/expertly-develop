"""Artifact API endpoints."""

from typing import Dict, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response

from app.api.deps import UserContext, get_current_user
from app.database import get_database
from app.models.artifact import Artifact
from app.schemas.artifact import ArtifactResponse, ArtifactListResponse
from app.services.document_service import document_service

router = APIRouter()


def artifact_to_response(
    artifact: Artifact,
    user_names: Dict[str, str] = None,
    project_names: Dict[str, str] = None,
) -> ArtifactResponse:
    """Convert artifact model to response schema."""
    created_by_name = None
    if user_names and artifact.created_by:
        created_by_name = user_names.get(str(artifact.created_by))
    project_name = None
    if project_names and artifact.project_id:
        project_name = project_names.get(str(artifact.project_id))
    return ArtifactResponse(
        id=str(artifact.id),
        label=artifact.label,
        description=artifact.description,
        artifact_type_code=artifact.artifact_type_code,
        format=artifact.format,
        status=artifact.status,
        project_id=str(artifact.project_id) if artifact.project_id else None,
        project_name=project_name,
        job_id=str(artifact.job_id) if artifact.job_id else None,
        created_by_name=created_by_name,
        created_at=artifact.created_at,
    )


@router.get("", response_model=ArtifactListResponse)
async def list_artifacts(
    project_id: Optional[str] = None,
    artifact_type: Optional[str] = None,
    job_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    user: UserContext = Depends(get_current_user),
):
    """List artifacts with optional filters."""
    db = get_database()

    query = {"tenant_id": user.tenant_id}
    if project_id:
        query["project_id"] = ObjectId(project_id)
    if artifact_type:
        query["artifact_type_code"] = artifact_type
    if job_id:
        query["job_id"] = ObjectId(job_id)

    cursor = (
        db.artifacts.find(query)
        .sort("created_at", -1)
        .skip(offset)
        .limit(limit)
    )

    artifacts = [Artifact.from_mongo(doc) async for doc in cursor]

    # Lookup user names for artifacts with created_by
    user_ids = [a.created_by for a in artifacts if a.created_by]
    user_names = {}
    if user_ids:
        user_cursor = db.users.find({"_id": {"$in": user_ids}}, {"_id": 1, "name": 1})
        async for u in user_cursor:
            user_names[str(u["_id"])] = u["name"]

    # Lookup project names for artifacts with project_id
    project_ids = [a.project_id for a in artifacts if a.project_id]
    project_names = {}
    if project_ids:
        project_cursor = db.projects.find({"_id": {"$in": project_ids}}, {"_id": 1, "name": 1})
        async for p in project_cursor:
            project_names[str(p["_id"])] = p["name"]

    total = await db.artifacts.count_documents(query)

    return ArtifactListResponse(
        items=[artifact_to_response(a, user_names, project_names) for a in artifacts],
        total=total,
    )


@router.get("/{artifact_id}", response_model=ArtifactResponse)
async def get_artifact(
    artifact_id: str,
    user: UserContext = Depends(get_current_user),
):
    """Get an artifact by ID."""
    db = get_database()

    doc = await db.artifacts.find_one({
        "_id": ObjectId(artifact_id),
        "tenant_id": user.tenant_id,
    })

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artifact not found",
        )

    artifact = Artifact.from_mongo(doc)

    # Lookup user name if created_by is set
    user_names = {}
    if artifact.created_by:
        u = await db.users.find_one({"_id": artifact.created_by}, {"_id": 1, "name": 1})
        if u:
            user_names[str(u["_id"])] = u["name"]

    # Lookup project name if project_id is set
    project_names = {}
    if artifact.project_id:
        p = await db.projects.find_one({"_id": artifact.project_id}, {"_id": 1, "name": 1})
        if p:
            project_names[str(p["_id"])] = p["name"]

    return artifact_to_response(artifact, user_names, project_names)


@router.get("/{artifact_id}/download")
async def download_artifact(
    artifact_id: str,
    user: UserContext = Depends(get_current_user),
):
    """Download an artifact's file."""
    db = get_database()

    doc = await db.artifacts.find_one({
        "_id": ObjectId(artifact_id),
        "tenant_id": user.tenant_id,
    })

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artifact not found",
        )

    artifact = Artifact.from_mongo(doc)

    # Get the document content
    document = await document_service.get_by_id(artifact.document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artifact file not found",
        )

    content = await document_service.get_content(document)

    # Determine filename and content type
    extension = artifact.format
    filename = f"{artifact.label}.{extension}"
    content_type = {
        "pdf": "application/pdf",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    }.get(extension, "application/octet-stream")

    return Response(
        content=content,
        media_type=content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@router.delete("/{artifact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_artifact(
    artifact_id: str,
    user: UserContext = Depends(get_current_user),
):
    """Delete an artifact."""
    db = get_database()

    doc = await db.artifacts.find_one({
        "_id": ObjectId(artifact_id),
        "tenant_id": user.tenant_id,
    })

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Artifact not found",
        )

    artifact = Artifact.from_mongo(doc)

    # Delete the associated document
    if artifact.document_id:
        await document_service.soft_delete(str(artifact.document_id))

    # Delete the artifact
    await db.artifacts.delete_one({"_id": ObjectId(artifact_id)})
