"""
Shared artifacts management package for Expertly applications.

Provides file/link artifact management with automatic markdown conversion,
version history, and flexible context-based association.
"""

from artifacts.models import Artifact, ArtifactVersion, get_artifact_models
from artifacts.schemas import (
    ArtifactCreate,
    ArtifactLinkCreate,
    ArtifactUpdate,
    ArtifactResponse,
    ArtifactVersionResponse,
    ArtifactWithVersions,
)
from artifacts.router import create_artifacts_router, ArtifactRouterConfig
from artifacts.service import ArtifactConversionService, reflow_pdf_text
from artifacts.storage import ArtifactStorage

__all__ = [
    # Models
    "Artifact",
    "ArtifactVersion",
    "get_artifact_models",
    # Schemas
    "ArtifactCreate",
    "ArtifactLinkCreate",
    "ArtifactUpdate",
    "ArtifactResponse",
    "ArtifactVersionResponse",
    "ArtifactWithVersions",
    # Router
    "create_artifacts_router",
    "ArtifactRouterConfig",
    # Services
    "ArtifactConversionService",
    "ArtifactStorage",
    "reflow_pdf_text",
]

__version__ = "0.1.0"
