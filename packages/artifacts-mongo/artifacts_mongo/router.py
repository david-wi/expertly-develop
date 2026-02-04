"""FastAPI router factory for MongoDB-based artifacts."""

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional, Awaitable
from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, UploadFile, File, Form, status
from fastapi.responses import Response
from motor.motor_asyncio import AsyncIOMotorDatabase
import logging

from artifacts_mongo.models import Artifact, ArtifactVersion, DocumentMetadata
from artifacts_mongo.schemas import (
    ArtifactCreate,
    ArtifactLinkCreate,
    ArtifactUpdate,
    ArtifactResponse,
    ArtifactWithVersions,
    ArtifactVersionResponse,
    ArtifactListResponse,
)
from artifacts_mongo.document_service import DocumentService
from artifacts_mongo.base import PyObjectId

logger = logging.getLogger(__name__)


@dataclass
class UserContext:
    """User context from authentication."""

    user_id: str
    organization_id: str
    name: Optional[str] = None


@dataclass
class ArtifactRouterConfig:
    """Configuration for the artifacts router."""

    # Database access
    get_db: Callable[[], AsyncIOMotorDatabase]

    # User context dependency
    get_user_context: Callable[..., Awaitable[UserContext]]

    # Context key name for filtering (e.g., "project_id", "task_id")
    context_key: str = "project_id"

    # Optional context validator (e.g., verify project exists)
    context_validator: Optional[Callable[[str, str, AsyncIOMotorDatabase], Awaitable[bool]]] = None

    # Optional AI completion function for conversions
    ai_complete: Optional[Callable[[str, str, str, Optional[list]], Awaitable[str]]] = None

    # Collection name for looking up entity names
    context_collection: Optional[str] = "projects"
    context_name_field: str = "name"


def artifact_to_response(
    artifact: Artifact,
    entity_names: Dict[str, str] = None,
    user: UserContext = None,
) -> ArtifactResponse:
    """Convert artifact model to response schema."""
    # Use current user's name if they're the creator
    created_by_name = None
    if user and artifact.created_by == user.user_id:
        created_by_name = user.name

    # Get entity name from lookup
    entity_name = None
    if entity_names:
        for key in ["project_id", "task_id"]:
            entity_id = getattr(artifact, key, None) or artifact.context.get(key)
            if entity_id:
                entity_name = entity_names.get(str(entity_id))
                break

    return ArtifactResponse(
        id=str(artifact.id),
        organization_id=artifact.organization_id,
        context=artifact.context,
        project_id=str(artifact.project_id) if artifact.project_id else None,
        task_id=str(artifact.task_id) if artifact.task_id else None,
        job_id=str(artifact.job_id) if artifact.job_id else None,
        name=artifact.name,
        description=artifact.description,
        artifact_type=artifact.artifact_type,
        artifact_type_code=artifact.artifact_type_code,
        url=artifact.url,
        document_id=str(artifact.document_id) if artifact.document_id else None,
        original_filename=artifact.original_filename,
        mime_type=artifact.mime_type,
        format=artifact.format,
        current_version=artifact.current_version,
        status=artifact.status,
        project_name=entity_name,
        created_by_name=created_by_name,
        created_at=artifact.created_at,
        updated_at=artifact.updated_at,
    )


def create_artifacts_router(config: ArtifactRouterConfig) -> APIRouter:
    """
    Create a FastAPI router for artifacts with the given configuration.

    Args:
        config: Router configuration including database access and dependencies

    Returns:
        Configured FastAPI router
    """
    router = APIRouter()

    @router.get("", response_model=ArtifactListResponse)
    async def list_artifacts(
        context_id: Optional[str] = Query(None, alias=config.context_key),
        artifact_type: Optional[str] = None,
        status_filter: Optional[str] = Query(None, alias="status"),
        limit: int = Query(50, le=100),
        offset: int = 0,
        user: UserContext = Depends(config.get_user_context),
    ):
        """List artifacts with optional filters."""
        db = config.get_db()

        query = {
            "organization_id": user.organization_id,
            "status": {"$ne": "deleted"},
        }

        if context_id:
            # Support both context dict and direct field
            query["$or"] = [
                {f"context.{config.context_key}": context_id},
                {config.context_key: ObjectId(context_id) if ObjectId.is_valid(context_id) else context_id},
            ]

        if artifact_type:
            query["artifact_type"] = artifact_type

        if status_filter:
            query["status"] = status_filter

        cursor = (
            db.artifacts.find(query)
            .sort("created_at", -1)
            .skip(offset)
            .limit(limit)
        )

        artifacts = [Artifact.from_mongo(doc) async for doc in cursor]

        # Lookup entity names
        entity_names = {}
        if config.context_collection:
            entity_ids = []
            for a in artifacts:
                eid = getattr(a, config.context_key, None) or a.context.get(config.context_key)
                if eid:
                    entity_ids.append(ObjectId(eid) if ObjectId.is_valid(str(eid)) else eid)

            if entity_ids:
                cursor = db[config.context_collection].find(
                    {"_id": {"$in": entity_ids}},
                    {"_id": 1, config.context_name_field: 1},
                )
                async for doc in cursor:
                    entity_names[str(doc["_id"])] = doc.get(config.context_name_field, "")

        total = await db.artifacts.count_documents(query)

        return ArtifactListResponse(
            items=[artifact_to_response(a, entity_names, user) for a in artifacts],
            total=total,
        )

    @router.get("/{artifact_id}", response_model=ArtifactWithVersions)
    async def get_artifact(
        artifact_id: str,
        user: UserContext = Depends(config.get_user_context),
    ):
        """Get artifact with version history."""
        db = config.get_db()

        doc = await db.artifacts.find_one({
            "_id": ObjectId(artifact_id),
            "organization_id": user.organization_id,
        })

        if not doc:
            raise HTTPException(status_code=404, detail="Artifact not found")

        artifact = Artifact.from_mongo(doc)

        # Get version history
        versions_cursor = db.artifact_versions.find({
            "artifact_id": ObjectId(artifact_id),
        }).sort("version_number", -1)

        versions = []
        async for v in versions_cursor:
            versions.append(ArtifactVersionResponse(
                id=str(v["_id"]),
                artifact_id=str(v["artifact_id"]),
                version_number=v["version_number"],
                document_id=str(v["document_id"]),
                original_filename=v.get("original_filename"),
                mime_type=v.get("mime_type"),
                size_bytes=v.get("size_bytes", 0),
                conversion_status=v.get("conversion_status", "pending"),
                conversion_error=v.get("conversion_error"),
                change_summary=v.get("change_summary"),
                changed_by=v.get("changed_by"),
                created_at=v.get("created_at", datetime.now()),
            ))

        # Lookup entity name
        entity_names = {}
        if config.context_collection:
            eid = getattr(artifact, config.context_key, None) or artifact.context.get(config.context_key)
            if eid:
                entity_doc = await db[config.context_collection].find_one(
                    {"_id": ObjectId(eid) if ObjectId.is_valid(str(eid)) else eid},
                    {"_id": 1, config.context_name_field: 1},
                )
                if entity_doc:
                    entity_names[str(entity_doc["_id"])] = entity_doc.get(config.context_name_field, "")

        response = artifact_to_response(artifact, entity_names, user)
        return ArtifactWithVersions(**response.model_dump(), versions=versions)

    @router.post("", response_model=ArtifactResponse, status_code=201)
    async def upload_artifact(
        background_tasks: BackgroundTasks,
        context_id: str = Form(..., alias=config.context_key),
        name: str = Form(...),
        description: Optional[str] = Form(None),
        file: UploadFile = File(...),
        user: UserContext = Depends(config.get_user_context),
    ):
        """Upload a new file artifact."""
        db = config.get_db()

        # Validate context if validator provided
        if config.context_validator:
            is_valid = await config.context_validator(context_id, user.organization_id, db)
            if not is_valid:
                raise HTTPException(status_code=404, detail=f"{config.context_key} not found")

        # Read file content
        content = await file.read()
        content_type = file.content_type or "application/octet-stream"
        filename = file.filename or "unknown"

        # Create document
        doc_service = DocumentService(db)
        document = await doc_service.create(
            organization_id=user.organization_id,
            name=filename,
            content=content,
            content_type=content_type,
            created_by=user.user_id,
            metadata=DocumentMetadata(
                **{config.context_key: PyObjectId(context_id) if ObjectId.is_valid(context_id) else None}
            ),
        )

        # Determine format from extension
        format_ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else None

        now = datetime.now(timezone.utc)

        # Create artifact
        artifact = Artifact(
            organization_id=user.organization_id,
            created_by=user.user_id,
            context={config.context_key: context_id},
            name=name,
            description=description,
            artifact_type="file",
            document_id=document.id,
            original_filename=filename,
            mime_type=content_type,
            format=format_ext,
            current_version=1,
            status="active",
            created_at=now,
            updated_at=now,
        )

        # Set specific ID field if it matches config
        if config.context_key == "project_id" and ObjectId.is_valid(context_id):
            artifact.project_id = PyObjectId(context_id)
        elif config.context_key == "task_id" and ObjectId.is_valid(context_id):
            artifact.task_id = PyObjectId(context_id)

        result = await db.artifacts.insert_one(artifact.to_mongo())
        artifact.id = PyObjectId(result.inserted_id)

        # Create version record
        version = ArtifactVersion(
            artifact_id=artifact.id,
            version_number=1,
            document_id=document.id,
            original_filename=filename,
            mime_type=content_type,
            size_bytes=len(content),
            conversion_status="pending",
            changed_by=user.user_id,
            created_at=now,
        )
        await db.artifact_versions.insert_one(version.to_mongo())

        # Start background conversion if AI function provided
        if config.ai_complete:
            background_tasks.add_task(
                _convert_document,
                db,
                document.id,
                content,
                filename,
                content_type,
                config.ai_complete,
            )

        return artifact_to_response(artifact, {}, user)

    @router.post("/link", response_model=ArtifactResponse, status_code=201)
    async def create_link_artifact(
        context_id: str = Query(..., alias=config.context_key),
        data: ArtifactLinkCreate = ...,
        user: UserContext = Depends(config.get_user_context),
    ):
        """Create a link artifact."""
        db = config.get_db()

        # Validate context if validator provided
        if config.context_validator:
            is_valid = await config.context_validator(context_id, user.organization_id, db)
            if not is_valid:
                raise HTTPException(status_code=404, detail=f"{config.context_key} not found")

        # Validate URL
        if not data.url.startswith(("http://", "https://")):
            raise HTTPException(status_code=400, detail="Invalid URL format")

        now = datetime.now(timezone.utc)

        artifact = Artifact(
            organization_id=user.organization_id,
            created_by=user.user_id,
            context={config.context_key: context_id},
            name=data.name,
            description=data.description,
            artifact_type="link",
            url=data.url,
            current_version=0,
            status="active",
            created_at=now,
            updated_at=now,
        )

        if config.context_key == "project_id" and ObjectId.is_valid(context_id):
            artifact.project_id = PyObjectId(context_id)
        elif config.context_key == "task_id" and ObjectId.is_valid(context_id):
            artifact.task_id = PyObjectId(context_id)

        result = await db.artifacts.insert_one(artifact.to_mongo())
        artifact.id = PyObjectId(result.inserted_id)

        return artifact_to_response(artifact, {}, user)

    @router.patch("/{artifact_id}", response_model=ArtifactResponse)
    async def update_artifact(
        artifact_id: str,
        data: ArtifactUpdate,
        user: UserContext = Depends(config.get_user_context),
    ):
        """Update artifact metadata."""
        db = config.get_db()

        doc = await db.artifacts.find_one({
            "_id": ObjectId(artifact_id),
            "organization_id": user.organization_id,
        })

        if not doc:
            raise HTTPException(status_code=404, detail="Artifact not found")

        update = {"updated_at": datetime.now(timezone.utc)}

        if data.name is not None:
            update["name"] = data.name
        if data.description is not None:
            update["description"] = data.description
        if data.status is not None:
            if data.status not in ("active", "archived"):
                raise HTTPException(status_code=400, detail="Invalid status")
            update["status"] = data.status
        if data.url is not None and doc.get("artifact_type") == "link":
            update["url"] = data.url

        await db.artifacts.update_one({"_id": ObjectId(artifact_id)}, {"$set": update})

        updated = await db.artifacts.find_one({"_id": ObjectId(artifact_id)})
        return artifact_to_response(Artifact.from_mongo(updated), {}, user)

    @router.delete("/{artifact_id}", status_code=204)
    async def delete_artifact(
        artifact_id: str,
        user: UserContext = Depends(config.get_user_context),
    ):
        """Delete an artifact (soft delete)."""
        db = config.get_db()

        doc = await db.artifacts.find_one({
            "_id": ObjectId(artifact_id),
            "organization_id": user.organization_id,
        })

        if not doc:
            raise HTTPException(status_code=404, detail="Artifact not found")

        artifact = Artifact.from_mongo(doc)

        # Soft delete associated document
        if artifact.document_id:
            doc_service = DocumentService(db)
            await doc_service.soft_delete(artifact.document_id)

        # Soft delete artifact
        await db.artifacts.update_one(
            {"_id": ObjectId(artifact_id)},
            {"$set": {"status": "deleted", "updated_at": datetime.now(timezone.utc)}},
        )

    @router.get("/{artifact_id}/download")
    async def download_artifact(
        artifact_id: str,
        version: Optional[int] = None,
        user: UserContext = Depends(config.get_user_context),
    ):
        """Download artifact file."""
        db = config.get_db()

        doc = await db.artifacts.find_one({
            "_id": ObjectId(artifact_id),
            "organization_id": user.organization_id,
        })

        if not doc:
            raise HTTPException(status_code=404, detail="Artifact not found")

        artifact = Artifact.from_mongo(doc)

        if artifact.artifact_type == "link":
            raise HTTPException(status_code=400, detail="Cannot download link artifacts")

        # Get document
        doc_service = DocumentService(db)

        if version:
            # Get specific version
            version_doc = await db.artifact_versions.find_one({
                "artifact_id": ObjectId(artifact_id),
                "version_number": version,
            })
            if not version_doc:
                raise HTTPException(status_code=404, detail="Version not found")
            document = await doc_service.get_by_id(version_doc["document_id"])
        else:
            # Get current version
            document = await doc_service.get_by_id(artifact.document_id)

        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        content = await doc_service.get_content(document)
        filename = artifact.original_filename or f"{artifact.name}.{artifact.format or 'bin'}"

        return Response(
            content=content,
            media_type=document.content_type,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    @router.get("/{artifact_id}/markdown")
    async def get_markdown(
        artifact_id: str,
        version: Optional[int] = None,
        user: UserContext = Depends(config.get_user_context),
    ):
        """Get markdown conversion for artifact."""
        db = config.get_db()

        doc = await db.artifacts.find_one({
            "_id": ObjectId(artifact_id),
            "organization_id": user.organization_id,
        })

        if not doc:
            raise HTTPException(status_code=404, detail="Artifact not found")

        artifact = Artifact.from_mongo(doc)

        # Get document
        doc_service = DocumentService(db)

        if version:
            version_doc = await db.artifact_versions.find_one({
                "artifact_id": ObjectId(artifact_id),
                "version_number": version,
            })
            if not version_doc:
                raise HTTPException(status_code=404, detail="Version not found")
            document = await doc_service.get_by_id(version_doc["document_id"])
        else:
            document = await doc_service.get_by_id(artifact.document_id)

        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        if document.conversion_status == "pending":
            raise HTTPException(status_code=202, detail="Conversion in progress")

        if document.conversion_status == "failed":
            raise HTTPException(status_code=500, detail=document.conversion_error or "Conversion failed")

        if not document.markdown_content:
            raise HTTPException(status_code=404, detail="Markdown not available")

        return Response(content=document.markdown_content, media_type="text/markdown")

    @router.post("/{artifact_id}/versions", response_model=ArtifactVersionResponse, status_code=201)
    async def upload_version(
        artifact_id: str,
        background_tasks: BackgroundTasks,
        file: UploadFile = File(...),
        change_summary: Optional[str] = Form(None),
        user: UserContext = Depends(config.get_user_context),
    ):
        """Upload a new version of an artifact."""
        db = config.get_db()

        doc = await db.artifacts.find_one({
            "_id": ObjectId(artifact_id),
            "organization_id": user.organization_id,
        })

        if not doc:
            raise HTTPException(status_code=404, detail="Artifact not found")

        artifact = Artifact.from_mongo(doc)

        if artifact.artifact_type == "link":
            raise HTTPException(status_code=400, detail="Cannot upload versions for link artifacts")

        # Read file content
        content = await file.read()
        content_type = file.content_type or "application/octet-stream"
        filename = file.filename or "unknown"

        # Create new document version
        doc_service = DocumentService(db)

        # Get current document to get document_key
        current_doc = await doc_service.get_by_id(artifact.document_id)
        if current_doc:
            document = await doc_service.create_version(
                document_key=current_doc.document_key,
                organization_id=user.organization_id,
                name=filename,
                content=content,
                content_type=content_type,
                created_by=user.user_id,
            )
        else:
            document = await doc_service.create(
                organization_id=user.organization_id,
                name=filename,
                content=content,
                content_type=content_type,
                created_by=user.user_id,
            )

        now = datetime.now(timezone.utc)
        new_version = artifact.current_version + 1

        # Update artifact
        format_ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else None
        await db.artifacts.update_one(
            {"_id": ObjectId(artifact_id)},
            {"$set": {
                "document_id": document.id,
                "original_filename": filename,
                "mime_type": content_type,
                "format": format_ext,
                "current_version": new_version,
                "updated_at": now,
            }},
        )

        # Create version record
        version = ArtifactVersion(
            artifact_id=PyObjectId(artifact_id),
            version_number=new_version,
            document_id=document.id,
            original_filename=filename,
            mime_type=content_type,
            size_bytes=len(content),
            conversion_status="pending",
            change_summary=change_summary,
            changed_by=user.user_id,
            created_at=now,
        )
        result = await db.artifact_versions.insert_one(version.to_mongo())
        version.id = PyObjectId(result.inserted_id)

        # Start background conversion
        if config.ai_complete:
            background_tasks.add_task(
                _convert_document,
                db,
                document.id,
                content,
                filename,
                content_type,
                config.ai_complete,
            )

        return ArtifactVersionResponse(
            id=str(version.id),
            artifact_id=str(version.artifact_id),
            version_number=version.version_number,
            document_id=str(version.document_id),
            original_filename=version.original_filename,
            mime_type=version.mime_type,
            size_bytes=version.size_bytes,
            conversion_status=version.conversion_status,
            change_summary=version.change_summary,
            changed_by=version.changed_by,
            created_at=version.created_at,
        )

    return router


async def _convert_document(
    db: AsyncIOMotorDatabase,
    document_id: PyObjectId,
    content: bytes,
    filename: str,
    content_type: str,
    ai_complete: Callable,
):
    """Background task to convert document to markdown."""
    try:
        from artifacts import ArtifactConversionService

        service = ArtifactConversionService(ai_complete=ai_complete)
        markdown, success = await service.convert_to_markdown(content, filename, content_type)

        doc_service = DocumentService(db)
        await doc_service.update_conversion_status(
            document_id,
            status="completed" if success else "failed",
            markdown_content=markdown,
            error=None if success else "Conversion completed with warnings",
        )

    except Exception as e:
        logger.error(f"Document conversion failed: {e}")
        doc_service = DocumentService(db)
        await doc_service.update_conversion_status(
            document_id,
            status="failed",
            error=str(e),
        )
