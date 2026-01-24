"""Pydantic schemas for API request/response validation."""

from app.schemas.tenant import TenantCreate, TenantResponse
from app.schemas.user import UserCreate, UserResponse
from app.schemas.task import (
    TaskCreate,
    TaskUpdate,
    TaskResponse,
    TaskComplete,
    TaskBlock,
    TaskNextResponse,
)
from app.schemas.question import (
    QuestionCreate,
    QuestionResponse,
    QuestionAnswer,
)
from app.schemas.project import ProjectCreate, ProjectResponse
from app.schemas.knowledge import (
    KnowledgeCapture,
    KnowledgeResponse,
    KnowledgeCaptureResponse,
    KnowledgeDismiss,
    RoutingResult,
    TriggerPhrasesResponse,
)
from app.schemas.playbook import (
    PlaybookCreate,
    PlaybookPropose,
    PlaybookUpdate,
    PlaybookResponse,
    PlaybookMatchResult,
    PlaybookMatchResponse,
    MustConsultWarning,
)
from app.schemas.person import (
    PersonCreate,
    PersonUpdate,
    PersonResponse,
    PersonContext,
)
from app.schemas.client import (
    ClientCreate,
    ClientUpdate,
    ClientResponse,
    ClientWithPeople,
)

__all__ = [
    # Tenant
    "TenantCreate",
    "TenantResponse",
    # User
    "UserCreate",
    "UserResponse",
    # Task
    "TaskCreate",
    "TaskUpdate",
    "TaskResponse",
    "TaskComplete",
    "TaskBlock",
    "TaskNextResponse",
    # Question
    "QuestionCreate",
    "QuestionResponse",
    "QuestionAnswer",
    # Project
    "ProjectCreate",
    "ProjectResponse",
    # Knowledge
    "KnowledgeCapture",
    "KnowledgeResponse",
    "KnowledgeCaptureResponse",
    "KnowledgeDismiss",
    "RoutingResult",
    "TriggerPhrasesResponse",
    # Playbook
    "PlaybookCreate",
    "PlaybookPropose",
    "PlaybookUpdate",
    "PlaybookResponse",
    "PlaybookMatchResult",
    "PlaybookMatchResponse",
    "MustConsultWarning",
    # Person
    "PersonCreate",
    "PersonUpdate",
    "PersonResponse",
    "PersonContext",
    # Client
    "ClientCreate",
    "ClientUpdate",
    "ClientResponse",
    "ClientWithPeople",
]
