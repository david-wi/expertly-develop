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
from sqlalchemy.orm import Session
from uuid import uuid4
from datetime import datetime
from typing import List, Optional
import os
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
from app.services.artifact_conversion_service import ArtifactConversionService

router = APIRouter()
settings = get_settings()


def get_artifact_storage_dir(artifact_id: str, version_number: int) -> str:
    """Get the storage directory for an artifact version."""
    return os.path.join(settings.uploads_dir, "artifacts", artifact_id, f"v{version_number}")


async def process_conversion(
    db_url: str,
    artifact_id: str,
    version_id: str,
    file_content: bytes,
    filename: str,
    mime_type: str,
    storage_dir: str,
):
    """Background task to convert file to markdown."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    # Create new session for background task
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        version = db.query(ArtifactVersion).filter(ArtifactVersion.id == version_id).first()
        if not version:
            return

        version.conversion_status = "processing"
        db.commit()

        # Convert to markdown
        service = ArtifactConversionService()
        markdown, success = await service.convert_to_markdown(file_content, filename, mime_type)

        # Save markdown to file
        markdown_path = os.path.join(storage_dir, "markdown.md")
        async with aiofiles.open(markdown_path, "w") as f:
            await f.write(markdown)

        # Update version record
        version.markdown_storage_path = os.path.join(
            "artifacts", artifact_id, f"v{version.version_number}", "markdown.md"
        )
        # Store first 10k chars inline for quick preview
        version.markdown_content = markdown[:10000] if len(markdown) > 10000 else markdown
        version.conversion_status = "completed" if success else "failed"
        if not success:
            version.conversion_error = "Conversion completed with warnings - see markdown for details"
        db.commit()

    except Exception as e:
        try:
            version = db.query(ArtifactVersion).filter(ArtifactVersion.id == version_id).first()
            if version:
                version.conversion_status = "failed"
                version.conversion_error = str(e)
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


@router.post("", response_model=ArtifactResponse, status_code=201)
async def upload_artifact(
    background_tasks: BackgroundTasks,
    product_id: str = Form(...),
    name: str = Form(...),
    description: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Upload a new artifact for a product."""
    # Verify product exists
    product = db.query(Product).filter(Product.id == product_id).first()
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
    db.commit()
    db.refresh(artifact)

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
def create_link_artifact(
    product_id: str = Query(...),
    data: ArtifactLinkCreate = ...,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Create a new link artifact for a product."""
    # Verify product exists
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    now = datetime.utcnow().isoformat()
    artifact_id = str(uuid4())

    # Create artifact record (no file, no versions needed)
    artifact = Artifact(
        id=artifact_id,
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
    db.commit()
    db.refresh(artifact)

    return artifact


@router.get("", response_model=List[ArtifactResponse])
def list_artifacts(
    product_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """List all artifacts for a product."""
    artifacts = (
        db.query(Artifact)
        .filter(Artifact.product_id == product_id)
        .order_by(Artifact.created_at.desc())
        .all()
    )
    return artifacts


@router.get("/{artifact_id}", response_model=ArtifactWithVersions)
def get_artifact(
    artifact_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get an artifact with all its versions."""
    artifact = db.query(Artifact).filter(Artifact.id == artifact_id).first()
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")

    # Get versions ordered by version number descending
    versions = (
        db.query(ArtifactVersion)
        .filter(ArtifactVersion.artifact_id == artifact_id)
        .order_by(ArtifactVersion.version_number.desc())
        .all()
    )

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
def update_artifact(
    artifact_id: str,
    data: ArtifactUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Update artifact metadata."""
    artifact = db.query(Artifact).filter(Artifact.id == artifact_id).first()
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
    db.commit()
    db.refresh(artifact)

    return artifact


@router.delete("/{artifact_id}", status_code=204)
def delete_artifact(
    artifact_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Delete an artifact and all its versions."""
    artifact = db.query(Artifact).filter(Artifact.id == artifact_id).first()
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")

    # Delete files from disk
    artifact_dir = os.path.join(settings.uploads_dir, "artifacts", artifact_id)
    if os.path.exists(artifact_dir):
        import shutil
        shutil.rmtree(artifact_dir)

    # Delete from database (versions cascade)
    db.delete(artifact)
    db.commit()

    return None


@router.post("/{artifact_id}/versions", response_model=ArtifactVersionResponse, status_code=201)
async def upload_version(
    artifact_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    change_summary: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Upload a new version of an artifact."""
    artifact = db.query(Artifact).filter(Artifact.id == artifact_id).first()
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
    db.commit()
    db.refresh(version)

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
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Download the original file for a specific version."""
    version = (
        db.query(ArtifactVersion)
        .filter(ArtifactVersion.id == version_id, ArtifactVersion.artifact_id == artifact_id)
        .first()
    )
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    artifact = db.query(Artifact).filter(Artifact.id == artifact_id).first()
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
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get the markdown content for a specific version."""
    version = (
        db.query(ArtifactVersion)
        .filter(ArtifactVersion.id == version_id, ArtifactVersion.artifact_id == artifact_id)
        .first()
    )
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
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Retry conversion for a failed version."""
    version = (
        db.query(ArtifactVersion)
        .filter(ArtifactVersion.id == version_id, ArtifactVersion.artifact_id == artifact_id)
        .first()
    )
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    artifact = db.query(Artifact).filter(Artifact.id == artifact_id).first()
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
    db.commit()
    db.refresh(version)

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
