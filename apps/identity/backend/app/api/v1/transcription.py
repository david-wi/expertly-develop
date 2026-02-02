"""WebSocket proxy for Deepgram speech-to-text transcription."""

import asyncio
import json
import logging
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import websockets

from app.config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter()

# Deepgram WebSocket URL with recommended settings
# Note: Do NOT specify encoding/sample_rate - let Deepgram auto-detect from container format (WebM/Opus)
# Nova-3 (Feb 2025) offers 54% lower WER vs Nova-2, with real-time multilingual support
DEEPGRAM_WS_URL = (
    "wss://api.deepgram.com/v1/listen?"
    "model=nova-3&"
    "language=en-US&"
    "punctuate=true&"
    "interim_results=true&"
    "endpointing=300&"
    "vad_events=true"
)


@router.websocket("/transcribe")
async def transcribe_websocket(websocket: WebSocket):
    """
    WebSocket endpoint that proxies audio to Deepgram for transcription.

    Client sends: Binary audio data (WebM/Opus or similar format)
    Client receives: JSON messages with transcription results

    Message format sent to client:
    {
        "type": "transcript",
        "transcript": "the transcribed text",
        "is_final": true/false,
        "confidence": 0.95,
        "speech_final": true/false
    }

    Error format:
    {
        "type": "error",
        "message": "error description"
    }
    """
    settings = get_settings()

    if not settings.deepgram_api_key:
        await websocket.accept()
        await websocket.send_json({
            "type": "error",
            "message": "Transcription service not configured"
        })
        await websocket.close(code=1008)
        return

    await websocket.accept()
    logger.info("Client connected to transcription WebSocket")

    deepgram_ws: Optional[websockets.WebSocketClientProtocol] = None

    try:
        # Connect to Deepgram with API key
        extra_headers = {
            "Authorization": f"Token {settings.deepgram_api_key}"
        }

        deepgram_ws = await websockets.connect(
            DEEPGRAM_WS_URL,
            extra_headers=extra_headers,
            ping_interval=20,
            ping_timeout=20,
        )
        logger.info("Connected to Deepgram WebSocket")

        # Create tasks for bidirectional communication
        async def forward_audio_to_deepgram():
            """Forward audio from client to Deepgram."""
            try:
                while True:
                    data = await websocket.receive_bytes()
                    if deepgram_ws and deepgram_ws.open:
                        await deepgram_ws.send(data)
            except WebSocketDisconnect:
                logger.info("Client disconnected")
            except Exception as e:
                logger.error(f"Error forwarding audio: {e}")

        async def forward_transcripts_to_client():
            """Forward transcription results from Deepgram to client."""
            try:
                if not deepgram_ws:
                    return

                async for message in deepgram_ws:
                    try:
                        data = json.loads(message)

                        # Handle different Deepgram message types
                        if data.get("type") == "Results":
                            # Extract transcript from Deepgram response
                            channel = data.get("channel", {})
                            alternatives = channel.get("alternatives", [])

                            if alternatives:
                                alt = alternatives[0]
                                transcript = alt.get("transcript", "")
                                confidence = alt.get("confidence", 0)

                                if transcript:
                                    await websocket.send_json({
                                        "type": "transcript",
                                        "transcript": transcript,
                                        "is_final": data.get("is_final", False),
                                        "confidence": confidence,
                                        "speech_final": data.get("speech_final", False),
                                    })

                        elif data.get("type") == "SpeechStarted":
                            # Could notify client that speech started
                            pass

                        elif data.get("type") == "UtteranceEnd":
                            # Utterance ended, all results should be final
                            pass

                        elif data.get("type") == "Metadata":
                            # Connection metadata
                            logger.debug(f"Deepgram metadata: {data}")

                        elif data.get("type") == "Error":
                            error_msg = data.get("message", "Unknown error")
                            logger.error(f"Deepgram error: {error_msg}")
                            await websocket.send_json({
                                "type": "error",
                                "message": error_msg
                            })

                    except json.JSONDecodeError:
                        logger.error(f"Failed to parse Deepgram message: {message}")

            except websockets.exceptions.ConnectionClosed:
                logger.info("Deepgram connection closed")
            except Exception as e:
                logger.error(f"Error forwarding transcripts: {e}")

        # Run both tasks concurrently
        audio_task = asyncio.create_task(forward_audio_to_deepgram())
        transcript_task = asyncio.create_task(forward_transcripts_to_client())

        # Wait for either task to complete (usually means disconnect)
        done, pending = await asyncio.wait(
            [audio_task, transcript_task],
            return_when=asyncio.FIRST_COMPLETED
        )

        # Cancel remaining tasks
        for task in pending:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

    except websockets.exceptions.WebSocketException as e:
        logger.error(f"Failed to connect to Deepgram: {e}")
        await websocket.send_json({
            "type": "error",
            "message": "Failed to connect to transcription service"
        })

    except Exception as e:
        logger.error(f"Transcription error: {e}")
        try:
            await websocket.send_json({
                "type": "error",
                "message": "Transcription service error"
            })
        except Exception:
            pass

    finally:
        # Cleanup
        if deepgram_ws:
            try:
                await deepgram_ws.close()
            except Exception:
                pass

        try:
            await websocket.close()
        except Exception:
            pass

        logger.info("Transcription session ended")
