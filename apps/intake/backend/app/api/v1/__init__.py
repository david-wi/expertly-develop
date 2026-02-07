from fastapi import APIRouter

from .auth import router as auth_router
from .voice_profiles import router as voice_profiles_router
from .intake_types import router as intake_types_router
from .templates import router as templates_router
from .intakes import router as intakes_router
from .sections import router as sections_router
from .answers import router as answers_router
from .sessions import router as sessions_router
from .transcripts import router as transcripts_router
from .evidence import router as evidence_router
from .contributors import router as contributors_router
from .follow_ups import router as follow_ups_router
from .usage import router as usage_router
from .files import router as files_router
from .urls import router as urls_router
from .proposals import router as proposals_router
from .voice_calls import router as voice_calls_router
from .timeline import router as timeline_router
from .exports import router as exports_router

router = APIRouter()

router.include_router(auth_router, tags=["auth"])
router.include_router(voice_profiles_router, tags=["voice-profiles"])
router.include_router(intake_types_router, tags=["intake-types"])
router.include_router(templates_router, tags=["templates"])
router.include_router(intakes_router, tags=["intakes"])
router.include_router(sections_router, tags=["sections"])
router.include_router(answers_router, tags=["answers"])
router.include_router(sessions_router, tags=["sessions"])
router.include_router(transcripts_router, tags=["transcripts"])
router.include_router(evidence_router, tags=["evidence"])
router.include_router(contributors_router, tags=["contributors"])
router.include_router(follow_ups_router, tags=["follow-ups"])
router.include_router(usage_router, tags=["usage"])
router.include_router(files_router, tags=["files"])
router.include_router(urls_router, tags=["urls"])
router.include_router(proposals_router, tags=["proposals"])
router.include_router(voice_calls_router, tags=["voice-calls"])
router.include_router(timeline_router, tags=["timeline"])
router.include_router(exports_router, tags=["exports"])
