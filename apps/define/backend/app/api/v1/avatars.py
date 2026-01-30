from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from pydantic import BaseModel
from typing import Optional
import os
import base64
import aiofiles
import httpx

from app.database import get_db
from app.api.deps import get_current_user, CurrentUser
from app.models.product import Product
from app.config import get_settings

router = APIRouter()
settings = get_settings()


class GenerateAvatarRequest(BaseModel):
    product_id: str
    product_name: str
    product_description: Optional[str] = None


class AvatarResponse(BaseModel):
    avatar_url: str


def get_avatars_dir():
    """Get the avatars storage directory."""
    avatars_dir = os.path.join(settings.uploads_dir, "avatars")
    os.makedirs(avatars_dir, exist_ok=True)
    return avatars_dir


@router.post("/generate", response_model=AvatarResponse)
async def generate_avatar(
    data: GenerateAvatarRequest,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Generate an AI avatar for a product using DALL-E 3."""
    # Verify product exists
    stmt = select(Product).where(Product.id == data.product_id)
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if not settings.openai_api_key:
        raise HTTPException(
            status_code=503,
            detail="AI avatar generation is unavailable: OpenAI API key not configured. Please contact support."
        )

    # Build prompt for DALL-E
    description_part = f" {data.product_description}." if data.product_description else ""
    prompt = (
        f"A modern, minimal app icon for '{data.product_name}'.{description_part} "
        "Clean, professional design suitable for a software product logo. "
        "Simple geometric shapes, vibrant colors on a clean background. "
        "No text or letters. Icon style, not a photograph."
    )

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.openai.com/v1/images/generations",
                headers={
                    "Authorization": f"Bearer {settings.openai_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "dall-e-3",
                    "prompt": prompt,
                    "n": 1,
                    "size": "1024x1024",
                    "response_format": "b64_json",
                },
                timeout=60.0,
            )

            if response.status_code != 200:
                raise HTTPException(
                    status_code=500,
                    detail=f"OpenAI API error: {response.text}",
                )

            openai_result = response.json()
            image_data = openai_result["data"][0]["b64_json"]

    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail="Avatar generation timed out after 60 seconds. Please try again."
        )
    except HTTPException:
        raise  # Re-raise HTTPExceptions as-is
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Avatar generation failed: {type(e).__name__}: {str(e)}"
        )

    # Save the image
    avatars_dir = get_avatars_dir()
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    filename = f"avatar-{data.product_id}-{timestamp}.png"
    filepath = os.path.join(avatars_dir, filename)

    image_bytes = base64.b64decode(image_data)
    async with aiofiles.open(filepath, "wb") as f:
        await f.write(image_bytes)

    # Update product with new avatar URL
    avatar_url = f"/api/v1/avatars/{filename}"
    product.avatar_url = avatar_url
    product.updated_at = datetime.utcnow().isoformat()
    await db.flush()

    return AvatarResponse(avatar_url=avatar_url)


@router.post("/upload", response_model=AvatarResponse)
async def upload_avatar(
    product_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Upload a custom avatar for a product."""
    # Verify product exists
    stmt = select(Product).where(Product.id == product_id)
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Validate file type
    allowed_types = ["image/png", "image/jpeg", "image/gif", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed types: {', '.join(allowed_types)}",
        )

    # Save the file
    avatars_dir = get_avatars_dir()
    ext = os.path.splitext(file.filename)[1] if file.filename else ".png"
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    filename = f"avatar-{product_id}-{timestamp}{ext}"
    filepath = os.path.join(avatars_dir, filename)

    content = await file.read()
    async with aiofiles.open(filepath, "wb") as f:
        await f.write(content)

    # Update product with new avatar URL
    avatar_url = f"/api/v1/avatars/{filename}"
    product.avatar_url = avatar_url
    product.updated_at = datetime.utcnow().isoformat()
    await db.flush()

    return AvatarResponse(avatar_url=avatar_url)


@router.get("/{filename}")
async def get_avatar(
    filename: str,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Serve an avatar file."""
    avatars_dir = get_avatars_dir()
    filepath = os.path.join(avatars_dir, filename)

    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Avatar not found")

    # Determine media type
    ext = os.path.splitext(filename)[1].lower()
    media_types = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
    }
    media_type = media_types.get(ext, "image/png")

    return FileResponse(filepath, media_type=media_type)


@router.delete("/{product_id}")
async def remove_avatar(
    product_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Remove a product's avatar."""
    stmt = select(Product).where(Product.id == product_id)
    result = await db.execute(stmt)
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if product.avatar_url:
        # Try to delete the file
        filename = product.avatar_url.split("/")[-1]
        filepath = os.path.join(get_avatars_dir(), filename)
        if os.path.exists(filepath):
            os.remove(filepath)

        product.avatar_url = None
        product.updated_at = datetime.utcnow().isoformat()
        await db.flush()

    return {"status": "ok"}
