from app.models.base import PyObjectId, MongoModel

# User, Organization, Team are now fetched from Identity service
# Re-export from identity_client for backward compatibility
from identity_client.models import User as IdentityUser
from identity_client.models import Organization as IdentityOrganization
from identity_client.models import Team as IdentityTeam

# Alias for backward compatibility with existing imports
User = IdentityUser
Organization = IdentityOrganization
Team = IdentityTeam

# Keep local schemas for request/response formatting
from app.models.user import UserCreate, UserUpdate, UserType, UserRole
from app.models.organization import OrganizationCreate, OrganizationUpdate, OrganizationSettings
from app.models.team import TeamCreate, TeamUpdate
from app.models.queue import Queue, QueueCreate, QueueUpdate, QueueType, ScopeType
from app.models.task import (
    Task, TaskCreate, TaskUpdate, TaskStatus, TaskPhase, VALID_PHASE_TRANSITIONS,
    TaskCheckout, TaskStart, TaskComplete, TaskFail,
    RecurringTask, RecurringTaskCreate, RecurringTaskUpdate, RecurrenceType
)
from app.models.task_update import TaskProgressUpdate, TaskProgressUpdateCreate
from app.models.project import Project, ProjectCreate, ProjectUpdate, ProjectStatus
from app.models.sop import SOP, SOPCreate, SOPUpdate, SOPType, SOPStep
from app.models.playbook import (
    Playbook, PlaybookCreate, PlaybookUpdate, PlaybookHistoryEntry,
    PlaybookStep, PlaybookStepCreate, AssigneeType, PlaybookItemType,
    PlaybookReorderItem, PlaybookReorderRequest
)
from app.models.backlog import (
    BacklogItem, BacklogItemCreate, BacklogItemUpdate,
    BacklogStatus, BacklogPriority, BacklogCategory
)
from app.models.connection import (
    Connection, ConnectionCreate, ConnectionResponse,
    ConnectionProvider, ConnectionStatus, OAuthStartResponse
)
from app.models.task_attachment import (
    TaskAttachment, TaskAttachmentCreate, TaskAttachmentResponse, AttachmentType
)
from app.models.task_comment import (
    TaskComment, TaskCommentCreate, TaskCommentUpdate, TaskCommentResponse
)
from app.models.monitor import (
    Monitor, MonitorCreate, MonitorUpdate, MonitorEvent,
    MonitorProvider, MonitorStatus, SlackConfig, GoogleDriveConfig,
    GmailConfig, OutlookConfig, TeamworkConfig, GitHubConfig
)
from app.models.notification import (
    Notification, NotificationCreate, NotificationResponse, NotificationType
)
from app.models.bot_activity import (
    BotActivity, BotActivityType, BotStatus, BotWithStatus, BotStats, BotConfigUpdate
)
from app.models.document import (
    Document, DocumentCreate, DocumentUpdate, DocumentResponse, DocumentHistoryEntry
)
from app.models.step_response import (
    TaskStepResponse, TaskStepResponseCreate, TaskStepResponseUpdate,
    TaskStepResponseComplete, TaskStepResponseResponse, StepStatus
)
from app.models.expertise import (
    Expertise, ExpertiseCreate, ExpertiseUpdate, ExpertiseResponse,
    ExpertiseHistoryEntry, ExpertiseContentType
)
from app.models.dashboard_note import (
    DashboardNote, DashboardNoteCreate, DashboardNoteUpdate,
    DashboardNoteResponse, DashboardNoteHistoryEntry, DashboardNoteVersionEntry
)

__all__ = [
    "PyObjectId",
    "MongoModel",
    "Organization",
    "OrganizationCreate",
    "OrganizationUpdate",
    "OrganizationSettings",
    "User",
    "UserCreate",
    "UserUpdate",
    "UserType",
    "UserRole",
    "Team",
    "TeamCreate",
    "TeamUpdate",
    "Queue",
    "QueueCreate",
    "QueueUpdate",
    "QueueType",
    "ScopeType",
    "Task",
    "TaskCreate",
    "TaskUpdate",
    "TaskStatus",
    "TaskPhase",
    "VALID_PHASE_TRANSITIONS",
    "TaskCheckout",
    "TaskStart",
    "TaskComplete",
    "TaskFail",
    "RecurringTask",
    "RecurringTaskCreate",
    "RecurringTaskUpdate",
    "RecurrenceType",
    "TaskProgressUpdate",
    "TaskProgressUpdateCreate",
    "Project",
    "ProjectCreate",
    "ProjectUpdate",
    "ProjectStatus",
    "SOP",
    "SOPCreate",
    "SOPUpdate",
    "SOPType",
    "SOPStep",
    "Playbook",
    "PlaybookCreate",
    "PlaybookUpdate",
    "PlaybookHistoryEntry",
    "PlaybookStep",
    "PlaybookStepCreate",
    "AssigneeType",
    "PlaybookItemType",
    "PlaybookReorderItem",
    "PlaybookReorderRequest",
    "BacklogItem",
    "BacklogItemCreate",
    "BacklogItemUpdate",
    "BacklogStatus",
    "BacklogPriority",
    "BacklogCategory",
    "Connection",
    "ConnectionCreate",
    "ConnectionResponse",
    "ConnectionProvider",
    "ConnectionStatus",
    "OAuthStartResponse",
    "TaskAttachment",
    "TaskAttachmentCreate",
    "TaskAttachmentResponse",
    "AttachmentType",
    "TaskComment",
    "TaskCommentCreate",
    "TaskCommentUpdate",
    "TaskCommentResponse",
    "Monitor",
    "MonitorCreate",
    "MonitorUpdate",
    "MonitorEvent",
    "MonitorProvider",
    "MonitorStatus",
    "SlackConfig",
    "GoogleDriveConfig",
    "GmailConfig",
    "OutlookConfig",
    "TeamworkConfig",
    "GitHubConfig",
    "Notification",
    "NotificationCreate",
    "NotificationResponse",
    "NotificationType",
    "BotActivity",
    "BotActivityType",
    "BotStatus",
    "BotWithStatus",
    "BotStats",
    "BotConfigUpdate",
    "Document",
    "DocumentCreate",
    "DocumentUpdate",
    "DocumentResponse",
    "DocumentHistoryEntry",
    "TaskStepResponse",
    "TaskStepResponseCreate",
    "TaskStepResponseUpdate",
    "TaskStepResponseComplete",
    "TaskStepResponseResponse",
    "StepStatus",
    "Expertise",
    "ExpertiseCreate",
    "ExpertiseUpdate",
    "ExpertiseResponse",
    "ExpertiseHistoryEntry",
    "ExpertiseContentType",
    "DashboardNote",
    "DashboardNoteCreate",
    "DashboardNoteUpdate",
    "DashboardNoteResponse",
    "DashboardNoteHistoryEntry",
    "DashboardNoteVersionEntry",
]
