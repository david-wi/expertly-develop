from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Query,
    UploadFile,
    File,
    Form,
)
from fastapi.responses import FileResponse, PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import select
from uuid import uuid4
from datetime import datetime
from typing import List, Optional
import os
import asyncio
import logging
import aiofiles

from app.database import get_db
from app.api.deps import get_current_user, CurrentUser
from app.models.product import Product
from app.models.artifact import Artifact
from app.models.artifact_version import ArtifactVersion
from app.schemas.artifact import (
    ArtifactCreate,
    ArtifactLinkCreate,
    ArtifactUpdate,
    ArtifactResponse,
    ArtifactWithVersions,
    ArtifactVersionResponse,
)
from app.config import get_settings
from app.utils.ai_config import get_ai_client
from artifacts import ArtifactConversionService

logger = logging.getLogger(__name__)


async def ai_complete(
    use_case: str,
    system_prompt: str,
    user_content: str,
    images: Optional[list] = None,
) -> str:
    """AI completion function for the shared ArtifactConversionService."""
    client = get_ai_client()
    return await client.complete(use_case, system_prompt, user_content, images)

router = APIRouter()
settings = get_settings()


def get_artifact_storage_dir(artifact_id: str, version_number: int) -> str:
    """Get the storage directory for an artifact version."""
    return os.path.join(settings.uploads_dir, "artifacts", artifact_id, f"v{version_number}")


def process_conversion(
    db_url: str,
    artifact_id: str,
    version_id: str,
    file_content: bytes,
    filename: str,
    mime_type: str,
    storage_dir: str,
):
    """Synchronous wrapper for background conversion task.

    Creates its own event loop to ensure the async conversion runs reliably,
    regardless of the state of the main application's event loop.
    """
    logger.info(f"Starting conversion for artifact {artifact_id}, version {version_id}")

    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(
                _async_process_conversion(
                    db_url,
                    artifact_id,
                    version_id,
                    file_content,
                    filename,
                    mime_type,
                    storage_dir,
                )
            )
            logger.info(f"Conversion completed for artifact {artifact_id}, version {version_id}")
        finally:
            loop.close()
    except Exception as e:
        logger.error(f"Conversion failed for artifact {artifact_id}, version {version_id}: {str(e)}", exc_info=True)


async def _async_process_conversion(
    db_url: str,
    artifact_id: str,
    version_id: str,
    file_content: bytes,
    filename: str,
    mime_type: str,
    storage_dir: str,
):
    """Async implementation of file to markdown conversion."""
    # Create new async engine and session for background task
    engine = create_async_engine(db_url)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        try:
            stmt = select(ArtifactVersion).where(ArtifactVersion.id == version_id)
            result = await db.execute(stmt)
            version = result.scalar_one_or_none()
            if not version:
                logger.warning(f"Version {version_id} not found, skipping conversion")
                return

            version.conversion_status = "processing"
            await db.commit()
            logger.info(f"Conversion status set to 'processing' for version {version_id}")

            # Convert to markdown using shared service with AI function injection
            service = ArtifactConversionService(ai_complete=ai_complete)
            markdown, success = await service.convert_to_markdown(file_content, filename, mime_type)

            # Save markdown to file
            markdown_path = os.path.join(storage_dir, "markdown.md")
            async with aiofiles.open(markdown_path, "w") as f:
                await f.write(markdown)

            # Refresh version from db
            await db.refresh(version)

            # Update version record
            version.markdown_storage_path = os.path.join(
                "artifacts", artifact_id, f"v{version.version_number}", "markdown.md"
            )
            # Store first 10k chars inline for quick preview
            version.markdown_content = markdown[:10000] if len(markdown) > 10000 else markdown
            version.conversion_status = "completed" if success else "failed"
            if not success:
                version.conversion_error = "Conversion completed with warnings - see markdown for details"
            await db.commit()
            logger.info(f"Conversion status set to '{version.conversion_status}' for version {version_id}")

        except Exception as e:
            logger.error(f"Error during conversion for version {version_id}: {str(e)}", exc_info=True)
            # Format a descriptive error message
            error_message = str(e)
            if "anthropic" in error_message.lower() or "api" in error_message.lower():
                if "rate" in error_message.lower() or "429" in error_message:
                    error_message = "AI service rate limit exceeded. Please wait a moment and try again."
                elif "401" in error_message or "auth" in error_message.lower():
                    error_message = "AI service authentication failed. Please check the API key configuration."
                elif "400" in error_message:
                    error_message = f"Invalid request to AI service: {error_message}"
                elif "500" in error_message or "502" in error_message or "503" in error_message:
                    error_message = "AI service is temporarily unavailable. Please try again in a few moments."

            try:
                stmt = select(ArtifactVersion).where(ArtifactVersion.id == version_id)
                result = await db.execute(stmt)
                version = result.scalar_one_or_none()
                if version:
                    version.conversion_status = "failed"
                    version.conversion_error = error_message
                    await db.commit()
            except Exception as inner_e:
                logger.error(f"Failed to update error status: {str(inner_e)}")
        finally:
            await engine.dispose()


@router.post("", response_model=ArtifactResponse, status_code=201)
async def upload_artifact(
    background_tasks: BackgroundTasks,
    product_id: str = Form(...),
    name: str = Form(...),
    description: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Upload a new artifact for a product."""
    # Verify product exists
    stmt = select(Product).where(Product.id == product_id)
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    now = datetime.utcnow().isoformat()
    artifact_id = str(uuid4())
    version_id = str(uuid4())

    # Create storage directory
    storage_dir = get_artifact_storage_dir(artifact_id, 1)
    os.makedirs(storage_dir, exist_ok=True)

    # Save original file
    content = await file.read()
    ext = os.path.splitext(file.filename)[1] if file.filename else ""
    original_filename = f"original{ext}"
    original_path = os.path.join(storage_dir, original_filename)

    async with aiofiles.open(original_path, "wb") as f:
        await f.write(content)

    # Create artifact record
    artifact = Artifact(
        id=artifact_id,
        context={"product_id": product_id},  # Flexible context for shared package compatibility
        product_id=product_id,
        name=name,
        description=description,
        original_filename=file.filename or "unknown",
        mime_type=file.content_type or "application/octet-stream",
        current_version=1,
        status="active",
        created_at=now,
        updated_at=now,
        created_by=current_user.name,
    )

    # Create version record
    version = ArtifactVersion(
        id=version_id,
        artifact_id=artifact_id,
        version_number=1,
        original_storage_path=os.path.join(
            "artifacts", artifact_id, "v1", original_filename
        ),
        size_bytes=len(content),
        conversion_status="pending",
        changed_by=current_user.name,
        created_at=now,
    )

    db.add(artifact)
    db.add(version)
    await db.commit()  # Commit before background task so it can find the records
    await db.refresh(artifact)

    # Start background conversion
    background_tasks.add_task(
        process_conversion,
        settings.database_url,
        artifact_id,
        version_id,
        content,
        file.filename or "unknown",
        file.content_type or "application/octet-stream",
        storage_dir,
    )

    return artifact


@router.post("/link", response_model=ArtifactResponse, status_code=201)
async def create_link_artifact(
    product_id: str = Query(...),
    data: ArtifactLinkCreate = ...,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Create a new link artifact for a product."""
    try:
        # Verify product exists
        stmt = select(Product).where(Product.id == product_id)
        result = await db.execute(stmt)
        product = result.scalar_one_or_none()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product not found with ID: {product_id}")

        # Validate URL format
        if not data.url.startswith(("http://", "https://")):
            raise HTTPException(
                status_code=400,
                detail="Invalid URL format. URL must start with http:// or https://",
            )

        now = datetime.utcnow().isoformat()
        artifact_id = str(uuid4())

        # Create artifact record (no file, no versions needed)
        artifact = Artifact(
            id=artifact_id,
            context={"product_id": product_id},  # Flexible context for shared package compatibility
            product_id=product_id,
            name=data.name,
            description=data.description,
            artifact_type="link",
            url=data.url,
            original_filename=None,
            mime_type=None,
            current_version=0,  # Links don't have versions
            status="active",
            created_at=now,
            updated_at=now,
            created_by=current_user.name,
        )

        db.add(artifact)
        await db.flush()
        await db.refresh(artifact)

        return artifact
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create link artifact: {str(e)}",
        )


@router.get("", response_model=List[ArtifactResponse])
async def list_artifacts(
    product_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """List all artifacts for a product."""
    stmt = (
        select(Artifact)
        .where(Artifact.product_id == product_id)
        .order_by(Artifact.created_at.desc())
    )
    result = await db.execute(stmt)
    artifacts = result.scalars().all()
    return artifacts


@router.get("/{artifact_id}", response_model=ArtifactWithVersions)
async def get_artifact(
    artifact_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get an artifact with all its versions."""
    stmt = select(Artifact).where(Artifact.id == artifact_id)
    result = await db.execute(stmt)
    artifact = result.scalar_one_or_none()
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")

    # Get versions ordered by version number descending
    versions_stmt = (
        select(ArtifactVersion)
        .where(ArtifactVersion.artifact_id == artifact_id)
        .order_by(ArtifactVersion.version_number.desc())
    )
    versions_result = await db.execute(versions_stmt)
    versions = versions_result.scalars().all()

    return ArtifactWithVersions(
        id=artifact.id,
        product_id=artifact.product_id,
        name=artifact.name,
        description=artifact.description,
        original_filename=artifact.original_filename,
        mime_type=artifact.mime_type,
        current_version=artifact.current_version,
        status=artifact.status,
        created_at=artifact.created_at,
        updated_at=artifact.updated_at,
        created_by=artifact.created_by,
        versions=[ArtifactVersionResponse.model_validate(v) for v in versions],
    )


@router.patch("/{artifact_id}", response_model=ArtifactResponse)
async def update_artifact(
    artifact_id: str,
    data: ArtifactUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Update artifact metadata."""
    stmt = select(Artifact).where(Artifact.id == artifact_id)
    result = await db.execute(stmt)
    artifact = result.scalar_one_or_none()
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")

    if data.name is not None:
        artifact.name = data.name
    if data.description is not None:
        artifact.description = data.description
    if data.status is not None:
        if data.status not in ("active", "archived"):
            raise HTTPException(status_code=400, detail="Invalid status")
        artifact.status = data.status
    if data.url is not None and artifact.artifact_type == "link":
        artifact.url = data.url

    artifact.updated_at = datetime.utcnow().isoformat()
    await db.flush()
    await db.refresh(artifact)

    return artifact


@router.delete("/{artifact_id}", status_code=204)
async def delete_artifact(
    artifact_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Delete an artifact and all its versions."""
    stmt = select(Artifact).where(Artifact.id == artifact_id)
    result = await db.execute(stmt)
    artifact = result.scalar_one_or_none()
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")

    # Delete files from disk
    artifact_dir = os.path.join(settings.uploads_dir, "artifacts", artifact_id)
    if os.path.exists(artifact_dir):
        import shutil
        shutil.rmtree(artifact_dir)

    # Delete from database (versions cascade)
    await db.delete(artifact)

    return None


@router.post("/{artifact_id}/versions", response_model=ArtifactVersionResponse, status_code=201)
async def upload_version(
    artifact_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    change_summary: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Upload a new version of an artifact."""
    stmt = select(Artifact).where(Artifact.id == artifact_id)
    result = await db.execute(stmt)
    artifact = result.scalar_one_or_none()
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")

    now = datetime.utcnow().isoformat()
    new_version_number = artifact.current_version + 1
    version_id = str(uuid4())

    # Create storage directory
    storage_dir = get_artifact_storage_dir(artifact_id, new_version_number)
    os.makedirs(storage_dir, exist_ok=True)

    # Save original file
    content = await file.read()
    ext = os.path.splitext(file.filename)[1] if file.filename else ""
    original_filename = f"original{ext}"
    original_path = os.path.join(storage_dir, original_filename)

    async with aiofiles.open(original_path, "wb") as f:
        await f.write(content)

    # Update artifact
    artifact.current_version = new_version_number
    artifact.original_filename = file.filename or artifact.original_filename
    artifact.mime_type = file.content_type or artifact.mime_type
    artifact.updated_at = now

    # Create version record
    version = ArtifactVersion(
        id=version_id,
        artifact_id=artifact_id,
        version_number=new_version_number,
        original_storage_path=os.path.join(
            "artifacts", artifact_id, f"v{new_version_number}", original_filename
        ),
        size_bytes=len(content),
        conversion_status="pending",
        change_summary=change_summary,
        changed_by=current_user.name,
        created_at=now,
    )

    db.add(version)
    await db.commit()  # Commit before background task so it can find the records
    await db.refresh(version)

    # Start background conversion
    background_tasks.add_task(
        process_conversion,
        settings.database_url,
        artifact_id,
        version_id,
        content,
        file.filename or "unknown",
        file.content_type or "application/octet-stream",
        storage_dir,
    )

    return version


@router.get("/{artifact_id}/versions/{version_id}/original")
async def download_original(
    artifact_id: str,
    version_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Download the original file for a specific version."""
    version_stmt = (
        select(ArtifactVersion)
        .where(ArtifactVersion.id == version_id, ArtifactVersion.artifact_id == artifact_id)
    )
    version_result = await db.execute(version_stmt)
    version = version_result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    artifact_stmt = select(Artifact).where(Artifact.id == artifact_id)
    artifact_result = await db.execute(artifact_stmt)
    artifact = artifact_result.scalar_one_or_none()
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")

    full_path = os.path.join(settings.uploads_dir, version.original_storage_path)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        path=full_path,
        filename=artifact.original_filename,
        media_type=artifact.mime_type,
    )


@router.get("/{artifact_id}/versions/{version_id}/markdown")
async def get_markdown(
    artifact_id: str,
    version_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get the markdown content for a specific version."""
    version_stmt = (
        select(ArtifactVersion)
        .where(ArtifactVersion.id == version_id, ArtifactVersion.artifact_id == artifact_id)
    )
    version_result = await db.execute(version_stmt)
    version = version_result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    if version.conversion_status == "pending":
        raise HTTPException(status_code=202, detail="Conversion in progress")

    if version.conversion_status == "processing":
        raise HTTPException(status_code=202, detail="Conversion in progress")

    # Try to read full markdown from file if available
    if version.markdown_storage_path:
        full_path = os.path.join(settings.uploads_dir, version.markdown_storage_path)
        if os.path.exists(full_path):
            async with aiofiles.open(full_path, "r") as f:
                content = await f.read()
            return PlainTextResponse(content, media_type="text/markdown")

    # Fall back to inline content
    if version.markdown_content:
        return PlainTextResponse(version.markdown_content, media_type="text/markdown")

    raise HTTPException(status_code=404, detail="Markdown content not available")


@router.post("/{artifact_id}/versions/{version_id}/reconvert", response_model=ArtifactVersionResponse)
async def reconvert_version(
    artifact_id: str,
    version_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Retry conversion for a failed version."""
    version_stmt = (
        select(ArtifactVersion)
        .where(ArtifactVersion.id == version_id, ArtifactVersion.artifact_id == artifact_id)
    )
    version_result = await db.execute(version_stmt)
    version = version_result.scalar_one_or_none()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    artifact_stmt = select(Artifact).where(Artifact.id == artifact_id)
    artifact_result = await db.execute(artifact_stmt)
    artifact = artifact_result.scalar_one_or_none()
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")

    # Read original file
    full_path = os.path.join(settings.uploads_dir, version.original_storage_path)
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="Original file not found on disk")

    async with aiofiles.open(full_path, "rb") as f:
        content = await f.read()

    # Reset conversion status
    version.conversion_status = "pending"
    version.conversion_error = None
    await db.commit()  # Commit before background task so it can find the records
    await db.refresh(version)

    # Get storage directory
    storage_dir = get_artifact_storage_dir(artifact_id, version.version_number)

    # Start background conversion
    background_tasks.add_task(
        process_conversion,
        settings.database_url,
        artifact_id,
        version_id,
        content,
        artifact.original_filename,
        artifact.mime_type,
        storage_dir,
    )

    return version
