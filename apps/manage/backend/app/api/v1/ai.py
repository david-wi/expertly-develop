"""
API router for AI-powered features.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.models import User
from app.services.ai_service import get_ai_service

logger = logging.getLogger(__name__)

router = APIRouter()


class ExistingStep(BaseModel):
    """Existing step for context."""
    title: str
    description: Optional[str] = None
    when_to_perform: Optional[str] = None


class GenerateStepsRequest(BaseModel):
    """Request to generate playbook steps."""
    playbook_name: str
    playbook_description: Optional[str] = None
    existing_steps: list[ExistingStep] = []
    user_prompt: Optional[str] = None


class GeneratedStep(BaseModel):
    """A generated step."""
    title: str
    description: Optional[str] = None
    when_to_perform: Optional[str] = None


class GenerateStepsResponse(BaseModel):
    """Response containing generated steps."""
    steps: list[GeneratedStep]


@router.post("/playbooks/generate-steps", response_model=GenerateStepsResponse)
async def generate_playbook_steps(
    request: GenerateStepsRequest,
    current_user: User = Depends(get_current_user)
) -> GenerateStepsResponse:
    """
    Generate playbook steps using AI.

    This endpoint uses Claude to generate high-quality, actionable steps
    for a playbook based on its name, description, and optional user instructions.
    """
    ai_service = get_ai_service()

    # Check if AI service is configured
    if not ai_service.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is not configured. Please set OPENAI_API_KEY, GROQ_API_KEY, or another supported provider key."
        )

    try:
        # Convert existing steps to dict format
        existing_steps_dict = [
            step.model_dump() for step in request.existing_steps
        ] if request.existing_steps else []

        # Generate steps
        steps = await ai_service.generate_steps(
            playbook_name=request.playbook_name,
            playbook_description=request.playbook_description,
            existing_steps=existing_steps_dict,
            user_prompt=request.user_prompt,
        )

        return GenerateStepsResponse(
            steps=[GeneratedStep(**step) for step in steps]
        )

    except ValueError as e:
        logger.error(f"AI generation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
    except Exception as e:
        logger.exception(f"Unexpected error during AI generation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate steps. Please try again."
        )
