"""Image generation API endpoints."""

import logging
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from openai import OpenAI

from app.config import get_settings
from app.utils.ai_config import get_use_case_config

router = APIRouter()
settings = get_settings()
logger = logging.getLogger(__name__)


class GenerateAvatarRequest(BaseModel):
    """Request to generate an avatar image."""

    user_type: str  # 'human' or 'bot'
    description: str  # For humans: appearance description, for bots: responsibilities
    name: str | None = None


class GenerateAvatarResponse(BaseModel):
    """Response containing the generated avatar as a data URL."""

    url: str


def get_openai_client() -> OpenAI:
    """Get OpenAI client, raising error if not configured."""
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OpenAI API key not configured",
        )
    return OpenAI(api_key=settings.openai_api_key)


@router.post("/generate-avatar", response_model=GenerateAvatarResponse)
async def generate_avatar(request: GenerateAvatarRequest) -> GenerateAvatarResponse:
    """Generate an avatar image using DALL-E.

    For bots: Creates a fun, modern flat vector illustration based on responsibilities.
    For humans: Creates a stylized portrait based on appearance description.

    Returns the image as a base64 data URL stored directly in the database.
    """
    client = get_openai_client()

    if request.user_type == "bot":
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

        # Request base64 directly from OpenAI to avoid temporary URL expiration
        response = client.images.generate(
            model=use_case_config.model_id,
            prompt=prompt,
            size="512x512",
            quality="standard",
            n=1,
            response_format="b64_json",
        )

        # Convert to data URL for direct use in img src
        b64_data = response.data[0].b64_json
        data_url = f"data:image/png;base64,{b64_data}"

        return GenerateAvatarResponse(url=data_url)

    except Exception as e:
        logger.exception("Failed to generate avatar")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate image: {str(e)}",
        )
