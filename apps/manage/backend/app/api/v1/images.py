import logging
import base64
import os
import uuid
import asyncio
from datetime import datetime, timezone
from typing import Optional
import aiofiles
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from pydantic import BaseModel
from openai import OpenAI

from app.config import get_settings
from app.models import User
from app.api.deps import get_current_user
from app.utils.ai_config import get_use_case_config

router = APIRouter()
settings = get_settings()
logger = logging.getLogger(__name__)

# Base directory for avatar storage
AVATARS_BASE_DIR = "/opt/expertly-develop/uploads/manage/avatars"

# In-memory job store for async avatar generation
# In production, consider using Redis for persistence across restarts
avatar_jobs: dict[str, dict] = {}


async def save_avatar_to_storage(b64_data: str, prefix: str = "avatar") -> str:
    """Save base64 image data to persistent storage and return the full URL."""
    # Ensure directory exists
    os.makedirs(AVATARS_BASE_DIR, exist_ok=True)

    # Generate unique filename
    filename = f"{prefix}_{uuid.uuid4().hex}.png"
    filepath = os.path.join(AVATARS_BASE_DIR, filename)

    # Decode and save the image
    image_data = base64.b64decode(b64_data)
    async with aiofiles.open(filepath, 'wb') as f:
        await f.write(image_data)

    # Return the absolute URL so it works from all apps
    # Use the Manage backend URL since that's where avatars are stored
    return f"https://manage.ai.devintensive.com/api/v1/images/avatars/{filename}"


class GenerateAvatarRequest(BaseModel):
    """Request to generate an avatar image."""
    user_type: str  # 'human' or 'virtual'
    description: str  # For humans: appearance description, for bots: responsibilities
    name: str | None = None


class GenerateProjectAvatarRequest(BaseModel):
    """Request to generate a project avatar image."""
    project_name: str
    project_description: str | None = None
    custom_prompt: str | None = None  # Optional custom prompt to override the default


class GenerateAvatarResponse(BaseModel):
    """Response containing the generated avatar URL."""
    url: str


class AsyncAvatarResponse(BaseModel):
    """Response for async avatar generation."""
    job_id: str
    status: str  # "pending", "generating", "completed", "failed"
    url: Optional[str] = None
    error: Optional[str] = None


class AvatarJobStatus(BaseModel):
    """Status of an avatar generation job."""
    job_id: str
    status: str
    url: Optional[str] = None
    error: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None


def _generate_avatar_sync(
    prompt: str,
    prefix: str,
    job_id: str,
):
    """Synchronously generate avatar (runs in background thread)."""
    try:
        avatar_jobs[job_id]["status"] = "generating"

        client = OpenAI(api_key=settings.openai_api_key)
        use_case_config = get_use_case_config("image_generation")

        response = client.images.generate(
            model=use_case_config.model_id,
            prompt=prompt,
            size="1024x1024",
            quality="standard",
            n=1,
            response_format="b64_json",
        )

        b64_data = response.data[0].b64_json

        # Save to storage (synchronous version)
        os.makedirs(AVATARS_BASE_DIR, exist_ok=True)
        filename = f"{prefix}_{uuid.uuid4().hex}.png"
        filepath = os.path.join(AVATARS_BASE_DIR, filename)
        image_data = base64.b64decode(b64_data)
        with open(filepath, 'wb') as f:
            f.write(image_data)

        avatar_url = f"https://manage.ai.devintensive.com/api/v1/images/avatars/{filename}"

        avatar_jobs[job_id]["status"] = "completed"
        avatar_jobs[job_id]["url"] = avatar_url
        avatar_jobs[job_id]["completed_at"] = datetime.now(timezone.utc).isoformat()
        logger.info(f"Avatar job {job_id} completed: {avatar_url}")

    except Exception as e:
        logger.exception(f"Avatar job {job_id} failed")
        avatar_jobs[job_id]["status"] = "failed"
        avatar_jobs[job_id]["error"] = str(e)
        avatar_jobs[job_id]["completed_at"] = datetime.now(timezone.utc).isoformat()


@router.get("/avatars/{filename}")
async def serve_avatar(filename: str):
    """Serve an avatar image from storage."""
    from fastapi.responses import FileResponse

    # Validate filename to prevent path traversal
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    filepath = os.path.join(AVATARS_BASE_DIR, filename)

    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Avatar not found")

    return FileResponse(
        filepath,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=31536000"}  # Cache for 1 year
    )


@router.post("/generate-avatar-async", response_model=AsyncAvatarResponse)
async def generate_avatar_async(
    request: GenerateAvatarRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
) -> AsyncAvatarResponse:
    """Start async avatar generation using DALL-E.

    Returns immediately with a job_id. Poll /avatar-job/{job_id} for status.
    """
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OpenAI API key not configured"
        )

    # Build prompt
    if request.user_type == 'virtual':
        prompt = f"""Modern flat vector illustration, explainer-style, friendly mascot character for a bot/AI assistant.
The bot's purpose: {request.description}
Style: Clean lines, vibrant colors, minimal shading, professional but approachable.
The character should visually represent their role/function in a creative way.
Square format, simple background, suitable as a profile avatar."""
    else:
        prompt = f"""Modern flat vector illustration portrait of a person, explainer-style.
Appearance: {request.description}
The person must have clearly visible facial features: eyes, nose, and mouth.
Style: Clean lines, vibrant colors, minimal shading, professional but friendly.
Head and shoulders view, simple colored background, suitable as a profile avatar.
NOT a photograph - stylized vector art illustration with a recognizable face."""

    # Create job
    job_id = uuid.uuid4().hex
    prefix = "bot" if request.user_type == 'virtual' else "user"
    avatar_jobs[job_id] = {
        "status": "pending",
        "url": None,
        "error": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None,
    }

    # Start background generation
    import concurrent.futures
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
    executor.submit(_generate_avatar_sync, prompt, prefix, job_id)

    logger.info(f"Started async avatar generation job {job_id}")

    return AsyncAvatarResponse(job_id=job_id, status="pending")


@router.post("/generate-project-avatar-async", response_model=AsyncAvatarResponse)
async def generate_project_avatar_async(
    request: GenerateProjectAvatarRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
) -> AsyncAvatarResponse:
    """Start async project avatar generation using DALL-E.

    Returns immediately with a job_id. Poll /avatar-job/{job_id} for status.
    """
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OpenAI API key not configured"
        )

    # Build prompt
    if request.custom_prompt:
        prompt = f"""Simple, minimalist white icon or logo design on a solid black background.
User's description: {request.custom_prompt}
Style: Clean white silhouette or outline, no gradients, no colors other than pure white (#FFFFFF) on pure black (#000000).
IMPORTANT: The icon must be LARGE, filling approximately 85-90% of the image area. Leave only a small 5-8% margin/buffer around the edges.
Keep the design simple - it needs to be recognizable at small sizes.
Do NOT include any border, frame, decorative outline, or box around the icon.
Square format, solid black background, white icon only."""
    else:
        description_text = f"Description: {request.project_description}" if request.project_description else ""
        prompt = f"""Simple, minimalist white icon or logo design on a solid black background.
Project name: "{request.project_name}"
{description_text}
Create a simple icon or symbol that represents this project's theme or purpose.
Style: Clean white silhouette or outline, no gradients, no colors other than pure white (#FFFFFF) on pure black (#000000).
IMPORTANT: The icon must be LARGE, filling approximately 85-90% of the image area. Leave only a small 5-8% margin/buffer around the edges.
Keep the design simple - it needs to be recognizable at small sizes.
Do NOT include any border, frame, decorative outline, or box around the icon.
Square format, solid black background, white icon only."""

    # Create job
    job_id = uuid.uuid4().hex
    avatar_jobs[job_id] = {
        "status": "pending",
        "url": None,
        "error": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None,
    }

    # Start background generation
    import concurrent.futures
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
    executor.submit(_generate_avatar_sync, prompt, "project", job_id)

    logger.info(f"Started async project avatar generation job {job_id}")

    return AsyncAvatarResponse(job_id=job_id, status="pending")


@router.get("/avatar-job/{job_id}", response_model=AvatarJobStatus)
async def get_avatar_job_status(
    job_id: str,
    current_user: User = Depends(get_current_user)
) -> AvatarJobStatus:
    """Get the status of an avatar generation job."""
    if job_id not in avatar_jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = avatar_jobs[job_id]
    return AvatarJobStatus(
        job_id=job_id,
        status=job["status"],
        url=job.get("url"),
        error=job.get("error"),
        created_at=job["created_at"],
        completed_at=job.get("completed_at"),
    )


def get_openai_client() -> OpenAI:
    """Get OpenAI client, raising error if not configured."""
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OpenAI API key not configured"
        )
    return OpenAI(api_key=settings.openai_api_key)


@router.post("/generate-avatar", response_model=GenerateAvatarResponse)
async def generate_avatar(
    request: GenerateAvatarRequest,
    current_user: User = Depends(get_current_user)
) -> GenerateAvatarResponse:
    """Generate an avatar image using DALL-E.

    For bots: Creates a fun, modern flat vector illustration based on responsibilities.
    For humans: Creates a stylized portrait based on appearance description.

    Returns a permanent URL to the stored avatar image.
    """
    client = get_openai_client()

    if request.user_type == 'virtual':
        # Bot avatar - fun illustration based on responsibilities
        prompt = f"""Modern flat vector illustration, explainer-style, friendly mascot character for a bot/AI assistant.
The bot's purpose: {request.description}
Style: Clean lines, vibrant colors, minimal shading, professional but approachable.
The character should visually represent their role/function in a creative way.
Square format, simple background, suitable as a profile avatar."""
    else:
        # Human avatar - stylized portrait with clear facial features
        prompt = f"""Modern flat vector illustration portrait of a person, explainer-style.
Appearance: {request.description}
The person must have clearly visible facial features: eyes, nose, and mouth.
Style: Clean lines, vibrant colors, minimal shading, professional but friendly.
Head and shoulders view, simple colored background, suitable as a profile avatar.
NOT a photograph - stylized vector art illustration with a recognizable face."""

    try:
        # Get model config for image generation
        use_case_config = get_use_case_config("image_generation")
        logger.debug(f"Using model {use_case_config.model_id} for image generation")

        # Request base64 directly from OpenAI
        response = client.images.generate(
            model=use_case_config.model_id,
            prompt=prompt,
            size="1024x1024",
            quality="standard",
            n=1,
            response_format="b64_json",
        )

        # Save to persistent storage and get URL
        b64_data = response.data[0].b64_json
        prefix = "bot" if request.user_type == 'virtual' else "user"
        avatar_url = await save_avatar_to_storage(b64_data, prefix)

        return GenerateAvatarResponse(url=avatar_url)

    except Exception as e:
        logger.exception("Failed to generate avatar")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate image: {str(e)}"
        )


@router.post("/generate-project-avatar", response_model=GenerateAvatarResponse)
async def generate_project_avatar(
    request: GenerateProjectAvatarRequest,
    current_user: User = Depends(get_current_user)
) -> GenerateAvatarResponse:
    """Generate an avatar image for a project using DALL-E.

    Creates a modern, professional icon/illustration that represents the project.
    If a custom_prompt is provided, it will be used to guide the generation.
    Otherwise, the project name and description are used to create an appropriate visual.

    Returns a permanent URL to the stored avatar image.
    """
    client = get_openai_client()

    if request.custom_prompt:
        # Use custom prompt but add style guidelines for white icon on black
        prompt = f"""Simple, minimalist white icon or logo design on a solid black background.
User's description: {request.custom_prompt}
Style: Clean white silhouette or outline, no gradients, no colors other than pure white (#FFFFFF) on pure black (#000000).
IMPORTANT: The icon must be LARGE, filling approximately 85-90% of the image area. Leave only a small 5-8% margin/buffer around the edges.
Keep the design simple - it needs to be recognizable at small sizes.
Do NOT include any border, frame, decorative outline, or box around the icon.
Square format, solid black background, white icon only."""
    else:
        # Generate based on project name and description
        description_text = f"Description: {request.project_description}" if request.project_description else ""
        prompt = f"""Simple, minimalist white icon or logo design on a solid black background.
Project name: "{request.project_name}"
{description_text}
Create a simple icon or symbol that represents this project's theme or purpose.
Style: Clean white silhouette or outline, no gradients, no colors other than pure white (#FFFFFF) on pure black (#000000).
IMPORTANT: The icon must be LARGE, filling approximately 85-90% of the image area. Leave only a small 5-8% margin/buffer around the edges.
Keep the design simple - it needs to be recognizable at small sizes.
Do NOT include any border, frame, decorative outline, or box around the icon.
Square format, solid black background, white icon only."""

    try:
        # Get model config for image generation
        use_case_config = get_use_case_config("image_generation")
        logger.debug(f"Using model {use_case_config.model_id} for project avatar generation")

        # Request base64 directly from OpenAI
        response = client.images.generate(
            model=use_case_config.model_id,
            prompt=prompt,
            size="1024x1024",
            quality="standard",
            n=1,
            response_format="b64_json",
        )

        # Save to persistent storage and get URL
        b64_data = response.data[0].b64_json
        avatar_url = await save_avatar_to_storage(b64_data, "project")

        return GenerateAvatarResponse(url=avatar_url)

    except Exception as e:
        logger.exception("Failed to generate project avatar")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate project avatar: {str(e)}"
        )
