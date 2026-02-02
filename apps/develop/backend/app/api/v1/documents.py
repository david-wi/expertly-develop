"""Document API endpoints."""

from typing import Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import Response

from app.api.deps import UserContext, get_user_context
from app.models.document import DocumentMetadata
from app.schemas.document import DocumentResponse, DocumentVersionsResponse
from app.services.document_service import document_service

router = APIRouter()


def document_to_response(doc) -> DocumentResponse:
    """Convert document model to response schema."""
    return DocumentResponse(
        id=str(doc.id),
        document_key=doc.document_key,
        version=doc.version,
        is_current=doc.is_current,
        name=doc.name,
        content_type=doc.content_type,
        file_size=doc.file_size,
        metadata=doc.metadata.model_dump() if doc.metadata else {},
        created_at=doc.created_at,
    )


@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    project_id: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),  # Comma-separated
    user: UserContext = Depends(get_user_context),
):
    """Upload a new document."""
    content = await file.read()

    metadata = DocumentMetadata(
        project_id=ObjectId(project_id) if project_id else None,
        category=category,
        tags=tags.split(",") if tags else [],
    )

    doc = await document_service.create_document(
        organization_id=user.organization_id,
        name=file.filename,
        content=content,
        content_type=file.content_type or "application/octet-stream",
        created_by=user.user_id,
        metadata=metadata,
    )

    return document_to_response(doc)


@router.post("/{document_key}/version", response_model=DocumentResponse)
async def upload_new_version(
    document_key: str,
    file: UploadFile = File(...),
    user: UserContext = Depends(get_user_context),
):
    """Upload a new version of an existing document."""
    # Verify document exists and belongs to tenant
    current = await document_service.get_current(document_key)
    if not current:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    if current.organization_id != user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    content = await file.read()

    doc = await document_service.create_version(
        document_key=document_key,
        content=content,
        content_type=file.content_type or "application/octet-stream",
        created_by=user.user_id,
        name=file.filename,
    )

    return document_to_response(doc)


@router.get("/{document_key}", response_model=DocumentResponse)
async def get_document(
    document_key: str,
    user: UserContext = Depends(get_user_context),
):
    """Get the current version of a document."""
    doc = await document_service.get_current(document_key)

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    if doc.organization_id != user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    return document_to_response(doc)


@router.get("/{document_key}/download")
async def download_document(
    document_key: str,
    user: UserContext = Depends(get_user_context),
):
    """Download the current version of a document."""
    doc = await document_service.get_current(document_key)

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    if doc.organization_id != user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    content = await document_service.get_content(doc)

    return Response(
        content=content,
        media_type=doc.content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{doc.name}"',
        },
    )


@router.get("/{document_key}/versions", response_model=DocumentVersionsResponse)
async def list_versions(
    document_key: str,
    user: UserContext = Depends(get_user_context),
):
    """List all versions of a document."""
    versions = await document_service.get_versions(document_key)

    if not versions:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    if versions[0].organization_id != user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    return DocumentVersionsResponse(
        document_key=document_key,
        versions=[document_to_response(v) for v in versions],
        total=len(versions),
    )


@router.get("/{document_key}/version/{version}", response_model=DocumentResponse)
async def get_version(
    document_key: str,
    version: int,
    user: UserContext = Depends(get_user_context),
):
    """Get a specific version of a document."""
    doc = await document_service.get_version(document_key, version)

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document version not found",
        )

    if doc.organization_id != user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    return document_to_response(doc)


@router.delete("/{document_key}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_key: str,
    user: UserContext = Depends(get_user_context),
):
    """Soft-delete a document and all its versions."""
    doc = await document_service.get_current(document_key)

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    if doc.organization_id != user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    await document_service.soft_delete(document_key)
