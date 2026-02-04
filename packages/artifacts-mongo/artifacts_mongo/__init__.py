"""
Shared MongoDB-based artifacts management package for Expertly applications.

Provides file/link artifact management with versioned storage using GridFS,
automatic markdown conversion, and flexible context-based association.
"""

from artifacts_mongo.base import (
    MongoModel,
    PyObjectId,
    TimestampMixin,
    SoftDeleteMixin,
    OptionalObjectId,
)
from artifacts_mongo.models import (
    Artifact,
    ArtifactVersion,
    Document,
    DocumentMetadata,
)
from artifacts_mongo.schemas import (
    ArtifactCreate,
    ArtifactLinkCreate,
    ArtifactUpdate,
    ArtifactResponse,
    ArtifactWithVersions,
    ArtifactVersionResponse,
    ArtifactListResponse,
    DocumentResponse,
)
from artifacts_mongo.router import (
    create_artifacts_router,
    ArtifactRouterConfig,
    UserContext,
)
from artifacts_mongo.document_service import (
    DocumentService,
    create_document_service,
)

__all__ = [
    # Base
    "MongoModel",
    "PyObjectId",
    "TimestampMixin",
    "SoftDeleteMixin",
    "OptionalObjectId",
    # Models
    "Artifact",
    "ArtifactVersion",
    "Document",
    "DocumentMetadata",
    # Schemas
    "ArtifactCreate",
    "ArtifactLinkCreate",
    "ArtifactUpdate",
    "ArtifactResponse",
    "ArtifactWithVersions",
    "ArtifactVersionResponse",
    "ArtifactListResponse",
    "DocumentResponse",
    # Router
    "create_artifacts_router",
    "ArtifactRouterConfig",
    "UserContext",
    # Services
    "DocumentService",
    "create_document_service",
]

__version__ = "0.1.0"
