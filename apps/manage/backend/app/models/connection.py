from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field

from app.models.base import MongoModel, PyObjectId


class ConnectionProvider(str, Enum):
    """Supported OAuth providers."""
    GOOGLE = "google"
    SLACK = "slack"
    MICROSOFT = "microsoft"
    TEAMWORK = "teamwork"


class ConnectionStatus(str, Enum):
    """Status of a connection."""
    ACTIVE = "active"
    EXPIRED = "expired"
    REVOKED = "revoked"


class Connection(MongoModel):
    """
    User's OAuth connection to an external service.
    Stores encrypted tokens for accessing external APIs.
    """
    user_id: PyObjectId
    organization_id: PyObjectId
    provider: ConnectionProvider
    provider_user_id: Optional[str] = None
    provider_email: Optional[str] = None
    access_token_encrypted: str
    refresh_token_encrypted: Optional[str] = None
    token_expires_at: Optional[datetime] = None
    scopes: list[str] = Field(default_factory=list)
    status: ConnectionStatus = ConnectionStatus.ACTIVE
    connected_at: datetime = Field(default_factory=lambda: datetime.now())
    last_used_at: Optional[datetime] = None


class ConnectionCreate(BaseModel):
    """Schema for initiating a new connection (starts OAuth flow)."""
    provider: ConnectionProvider


class ConnectionResponse(BaseModel):
    """Safe response schema - no tokens exposed."""
    id: str
    provider: str
    provider_email: Optional[str] = None
    status: str
    scopes: list[str]
    connected_at: datetime
    last_used_at: Optional[datetime] = None


class OAuthStartResponse(BaseModel):
    """Response when starting OAuth flow."""
    auth_url: str
    state: str
