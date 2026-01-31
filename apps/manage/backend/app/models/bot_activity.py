"""Bot activity model for tracking bot performance."""
from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel

from app.models.base import MongoModel, PyObjectId


class BotActivityType(str, Enum):
    """Types of bot activities."""
    TASK_CLAIMED = "task_claimed"
    TASK_STARTED = "task_started"
    TASK_COMPLETED = "task_completed"
    TASK_FAILED = "task_failed"
    TASK_RELEASED = "task_released"
    HEARTBEAT = "heartbeat"
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"


class BotActivity(MongoModel):
    """
    Bot activity log for tracking bot actions and performance.

    Used to monitor bot health, calculate statistics, and debug issues.
    """
    organization_id: PyObjectId
    bot_id: PyObjectId  # User ID of the bot

    activity_type: BotActivityType
    task_id: Optional[PyObjectId] = None  # Related task if applicable

    # Performance metrics
    duration_seconds: Optional[int] = None  # Time taken for task completion
    error_message: Optional[str] = None  # Error details if failed

    # Additional context
    metadata: Optional[dict] = None


class BotStatus(str, Enum):
    """Bot status indicators."""
    ONLINE = "online"
    OFFLINE = "offline"
    PAUSED = "paused"
    BUSY = "busy"


class BotWithStatus(BaseModel):
    """Bot user with current status information."""
    id: str
    organization_id: str
    email: str
    name: str
    avatar_url: Optional[str] = None
    title: Optional[str] = None
    responsibilities: Optional[str] = None
    is_active: bool

    # Bot config
    poll_interval_seconds: int = 5
    max_concurrent_tasks: int = 1
    allowed_queue_ids: list[str] = []
    capabilities: list[str] = []
    what_i_can_help_with: Optional[str] = None

    # Status
    status: BotStatus = BotStatus.OFFLINE
    last_seen_at: Optional[datetime] = None
    current_task_count: int = 0

    # Stats (7-day rolling)
    tasks_completed_7d: int = 0
    tasks_failed_7d: int = 0
    avg_task_duration_seconds: Optional[float] = None

    created_at: datetime


class BotStats(BaseModel):
    """Statistics for a bot."""
    bot_id: str
    period_days: int = 7

    tasks_completed: int = 0
    tasks_failed: int = 0
    tasks_claimed: int = 0

    avg_duration_seconds: Optional[float] = None
    min_duration_seconds: Optional[int] = None
    max_duration_seconds: Optional[int] = None

    uptime_percentage: Optional[float] = None
    last_activity_at: Optional[datetime] = None


class BotConfigUpdate(BaseModel):
    """Schema for updating bot configuration."""
    poll_interval_seconds: Optional[int] = None
    max_concurrent_tasks: Optional[int] = None
    allowed_queue_ids: Optional[list[str]] = None
    capabilities: Optional[list[str]] = None
    what_i_can_help_with: Optional[str] = None
