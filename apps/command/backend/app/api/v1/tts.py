"""
API router for text-to-speech using Deepgram.
"""
import logging
import httpx
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter()


class TTSRequest(BaseModel):
    """Request to generate speech from text."""
    text: str


@router.post("/speak")
async def text_to_speech(request: TTSRequest) -> Response:
    """
    Convert text to speech using Deepgram's Aura TTS API.

    Uses the Odysseus voice (masculine, natural-sounding US English).
    Returns MP3 audio data.
    """
    if not settings.deepgram_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Text-to-speech service not configured"
        )

    if not request.text or len(request.text) > 2000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Text must be between 1 and 2000 characters"
        )

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.deepgram.com/v1/speak",
                params={
                    "model": "aura-2-odysseus-en",
                    "encoding": "mp3",
                },
                headers={
                    "Authorization": f"Token {settings.deepgram_api_key}",
                    "Content-Type": "application/json",
                },
                json={"text": request.text},
                timeout=30.0,
            )

            if response.status_code != 200:
                logger.error(f"Deepgram TTS error: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Failed to generate speech"
                )

            return Response(
                content=response.content,
                media_type="audio/mpeg",
                headers={
                    "Content-Disposition": "inline",
                    "Cache-Control": "no-cache",
                }
            )
    except httpx.TimeoutException:
        logger.error("Deepgram TTS request timed out")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Speech generation timed out"
        )
    except Exception as e:
        logger.error(f"Deepgram TTS error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate speech"
        )
